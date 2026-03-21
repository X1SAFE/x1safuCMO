import { useState, useEffect, useCallback } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import {
  Transaction, SystemProgram, SYSVAR_RENT_PUBKEY,
  TransactionInstruction, PublicKey,
} from '@solana/web3.js'
import {
  TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync,
  getAccount, ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { sha256 } from '@noble/hashes/sha256'
import {
  STAKING_PROGRAM_ID, STAKING_VAULT_STATE,
  STAKING_X1SAFE_MINT, STAKING_X1SAFE_PUT_MINT, STAKING_STAKE_VAULT,
  EXPLORER, IS_TESTNET, MINTS,
  getTokenBalance, toBaseUnits,
} from '../lib/vault'

// ── helpers ──────────────────────────────────────────────────────────────────
function disc(name: string): Buffer {
  return Buffer.from(sha256(new TextEncoder().encode('global:' + name))).subarray(0, 8)
}
function createATAIx(payer: PublicKey, ata: PublicKey, owner: PublicKey, mint: PublicKey) {
  return new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: payer,                   isSigner: true,  isWritable: true  },
      { pubkey: ata,                     isSigner: false, isWritable: true  },
      { pubkey: owner,                   isSigner: false, isWritable: false },
      { pubkey: mint,                    isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID,        isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY,      isSigner: false, isWritable: false },
    ],
    data: Buffer.from([0]),
  })
}

// ── PDAs ─────────────────────────────────────────────────────────────────────
const USER_POSITION_SEED    = Buffer.from('user_position')
const STAKE_ACCOUNT_SEED    = Buffer.from('stake_account')
const VESTING_SCHEDULE_SEED = Buffer.from('vesting_schedule')

function getUserPositionPDA(user: PublicKey, mint: PublicKey) {
  return PublicKey.findProgramAddressSync([USER_POSITION_SEED, user.toBuffer(), mint.toBuffer()], STAKING_PROGRAM_ID)[0]
}
function getStakeAccountPDA(user: PublicKey, mint: PublicKey) {
  return PublicKey.findProgramAddressSync([STAKE_ACCOUNT_SEED, user.toBuffer(), mint.toBuffer()], STAKING_PROGRAM_ID)[0]
}
function getVestingSchedulePDA(user: PublicKey, mint: PublicKey) {
  return PublicKey.findProgramAddressSync([VESTING_SCHEDULE_SEED, user.toBuffer(), mint.toBuffer()], STAKING_PROGRAM_ID)[0]
}
function getRewardPoolAta() {
  return getAssociatedTokenAddressSync(STAKING_X1SAFE_MINT, STAKING_VAULT_STATE, true, TOKEN_PROGRAM_ID)
}

const DEPOSIT_MINTS = [MINTS.XNT, MINTS.USDCX]

// ── on-chain account parsers ──────────────────────────────────────────────────
interface VestingPhase {
  phase_index: number
  start_time:  number
  end_time:    number
  amount:      number
  claimed:     boolean
}
interface VestingInfo {
  total_amount:    number
  released_amount: number
  start_timestamp: number
  current_phase:   number
  phase_duration:  number
  phases:          VestingPhase[]
  active:          boolean
}
interface StakeInfo {
  amount_staked:         number
  entry_timestamp:       number
  pending_x1safe:        number
  total_x1safe_claimed:  number
  active:                boolean
}

function parseStakeAccount(data: Buffer): StakeInfo {
  // discriminator 8 + owner 32 = offset 40
  return {
    amount_staked:        Number(data.readBigUInt64LE(40)) / 1e6,
    entry_timestamp:      Number(data.readBigInt64LE(48)),
    // last_claim 8, reward_index 16, pending_usdc 8 → pending_x1safe at 80
    pending_x1safe:       Number(data.readBigUInt64LE(80)) / 1e6,
    total_x1safe_claimed: Number(data.readBigUInt64LE(96)) / 1e6,
    active:               data[105] !== 0,
  }
}
function parseVestingSchedule(data: Buffer): VestingInfo {
  // discriminator 8 + owner 32 + total 8 + released 8 + start 8 + phase 1 + dur 8 = 73
  const VESTING_PHASE_LEN = 26 // 1+8+8+8+1
  const phases: VestingPhase[] = []
  let offset = 8 + 32 + 8 + 8 + 8 + 1 + 8 // = 73
  // current_phase unused     // current_phase at 64
  for (let i = 0; i < 6; i++) {
    const base = offset + i * VESTING_PHASE_LEN
    phases.push({
      phase_index: data[base],
      start_time:  Number(data.readBigInt64LE(base + 1)),
      end_time:    Number(data.readBigInt64LE(base + 9)),
      amount:      Number(data.readBigUInt64LE(base + 17)) / 1e6,
      claimed:     data[base + 25] !== 0,
    })
  }
  return {
    total_amount:    Number(data.readBigUInt64LE(40)) / 1e6,
    released_amount: Number(data.readBigUInt64LE(48)) / 1e6,
    start_timestamp: Number(data.readBigInt64LE(56)),
    current_phase:   data[64],
    phase_duration:  Number(data.readBigInt64LE(65)),
    phases,
    active:          data[73 + 6 * VESTING_PHASE_LEN] !== 0,
  }
}

// ── component ────────────────────────────────────────────────────────────────
export function Stake() {
  const { connection } = useConnection()
  const wallet = useWallet()

  // stake form
  const [stakeAmount,   setStakeAmount]   = useState('')
  const [loadingStake,  setLoadingStake]  = useState(false)
  const [loadingClaim,  setLoadingClaim]  = useState(false)
  const [txSig,         setTxSig]         = useState('')
  const [error,         setError]         = useState('')
  const [showConfirm,   setShowConfirm]   = useState(false)

  // on-chain state
  const [depositMint,   setDepositMint]   = useState<PublicKey>(MINTS.XNT)
  const [putBalance,    setPutBalance]    = useState(0)
  const [safeBalance,   setSafeBalance]   = useState(0)
  const [stakeInfo,     setStakeInfo]     = useState<StakeInfo | null>(null)
  const [vestingInfo,   setVestingInfo]   = useState<VestingInfo | null>(null)

  const numAmt = parseFloat(stakeAmount) || 0
  const now    = Math.floor(Date.now() / 1000)

  // ── load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!wallet.publicKey) return
    const [put, safe] = await Promise.all([
      getTokenBalance(connection, wallet.publicKey, STAKING_X1SAFE_PUT_MINT),
      getTokenBalance(connection, wallet.publicKey, STAKING_X1SAFE_MINT),
    ])
    setPutBalance(put)
    setSafeBalance(safe)

    for (const mint of DEPOSIT_MINTS) {
      const pos = getUserPositionPDA(wallet.publicKey, mint)
      if (await connection.getAccountInfo(pos)) {
        setDepositMint(mint)

        const [stakeRaw, vestRaw] = await Promise.all([
          connection.getAccountInfo(getStakeAccountPDA(wallet.publicKey, mint)),
          connection.getAccountInfo(getVestingSchedulePDA(wallet.publicKey, mint)),
        ])
        if (stakeRaw) setStakeInfo(parseStakeAccount(Buffer.from(stakeRaw.data)))
        if (vestRaw)  setVestingInfo(parseVestingSchedule(Buffer.from(vestRaw.data)))
        break
      }
    }
  }, [wallet.publicKey, connection])

  useEffect(() => { load() }, [load, txSig])

  // ── stake ─────────────────────────────────────────────────────────────────
  const handleStake = async () => {
    if (!wallet.publicKey || !wallet.signTransaction || !stakeAmount) return
    if (stakeInfo?.active) { setError('Đã có stake active. Unstake trước.'); return }
    setLoadingStake(true); setError(''); setTxSig('')
    try {
      const vaultState      = STAKING_VAULT_STATE
      const stakeVault      = STAKING_STAKE_VAULT
      const userPosition    = getUserPositionPDA(wallet.publicKey, depositMint)
      const stakeAccount    = getStakeAccountPDA(wallet.publicKey, depositMint)
      const vestingSchedule = getVestingSchedulePDA(wallet.publicKey, depositMint)
      const userPutAta      = getAssociatedTokenAddressSync(STAKING_X1SAFE_PUT_MINT, wallet.publicKey, false, TOKEN_PROGRAM_ID)

      const data = Buffer.concat([
        disc('stake'),
        (() => { const b = Buffer.allocUnsafe(8); b.writeBigUInt64LE(BigInt(toBaseUnits(numAmt, 6).toString())); return b })(),
      ])

      const tx = new Transaction()
      tx.add(new TransactionInstruction({
        programId: STAKING_PROGRAM_ID,
        keys: [
          { pubkey: wallet.publicKey,        isSigner: true,  isWritable: true  },
          { pubkey: vaultState,              isSigner: false, isWritable: true  },
          { pubkey: userPosition,            isSigner: false, isWritable: true  },
          { pubkey: depositMint,             isSigner: false, isWritable: false },
          { pubkey: userPutAta,              isSigner: false, isWritable: true  },
          { pubkey: stakeVault,              isSigner: false, isWritable: true  },
          { pubkey: stakeAccount,            isSigner: false, isWritable: true  },
          { pubkey: vestingSchedule,         isSigner: false, isWritable: true  },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: TOKEN_PROGRAM_ID,        isSigner: false, isWritable: false },
          { pubkey: SYSVAR_RENT_PUBKEY,      isSigner: false, isWritable: false },
        ],
        data,
      }))
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
      tx.feePayer = wallet.publicKey
      const signed = await wallet.signTransaction(tx)
      const sig    = await connection.sendRawTransaction(signed.serialize())
      await connection.confirmTransaction(sig, 'confirmed')
      setTxSig(sig); setStakeAmount(''); setShowConfirm(false)
    } catch (e: any) {
      setError(e?.message || 'Transaction failed')
    } finally { setLoadingStake(false) }
  }

  // ── claim rewards ─────────────────────────────────────────────────────────
  const handleClaim = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) return
    setLoadingClaim(true); setError(''); setTxSig('')
    try {
      const vaultState      = STAKING_VAULT_STATE
      const userPosition    = getUserPositionPDA(wallet.publicKey, depositMint)
      const stakeAccount    = getStakeAccountPDA(wallet.publicKey, depositMint)
      const vestingSchedule = getVestingSchedulePDA(wallet.publicKey, depositMint)
      const rewardPool      = getRewardPoolAta()
      const userSafeAta     = getAssociatedTokenAddressSync(STAKING_X1SAFE_MINT, wallet.publicKey, false, TOKEN_PROGRAM_ID)

      const tx = new Transaction()

      // ensure user X1SAFE ATA exists
      try { await getAccount(connection, userSafeAta, undefined, TOKEN_PROGRAM_ID) }
      catch { tx.add(createATAIx(wallet.publicKey, userSafeAta, wallet.publicKey, STAKING_X1SAFE_MINT)) }

      // claim_x1safe_rewards instruction — no args (discriminator only)
      // Account order = ClaimX1safeRewards<'info>:
      // user, vault_state, user_position, token_mint, stake_account,
      // vesting_schedule, x1safe_mint, reward_pool_x1safe,
      // user_x1safe_account, vault_state_pda, token_program
      tx.add(new TransactionInstruction({
        programId: STAKING_PROGRAM_ID,
        keys: [
          { pubkey: wallet.publicKey,    isSigner: true,  isWritable: true  }, // user
          { pubkey: vaultState,          isSigner: false, isWritable: true  }, // vault_state
          { pubkey: userPosition,        isSigner: false, isWritable: true  }, // user_position
          { pubkey: depositMint,         isSigner: false, isWritable: false }, // token_mint
          { pubkey: stakeAccount,        isSigner: false, isWritable: true  }, // stake_account
          { pubkey: vestingSchedule,     isSigner: false, isWritable: true  }, // vesting_schedule
          { pubkey: STAKING_X1SAFE_MINT, isSigner: false, isWritable: true  }, // x1safe_mint
          { pubkey: rewardPool,          isSigner: false, isWritable: true  }, // reward_pool_x1safe
          { pubkey: userSafeAta,         isSigner: false, isWritable: true  }, // user_x1safe_account
          { pubkey: vaultState,          isSigner: false, isWritable: false }, // vault_state_pda (signing)
          { pubkey: TOKEN_PROGRAM_ID,    isSigner: false, isWritable: false },
        ],
        data: disc('claim_x1safe_rewards'),
      }))

      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
      tx.feePayer = wallet.publicKey
      const signed = await wallet.signTransaction(tx)
      const sig    = await connection.sendRawTransaction(signed.serialize())
      await connection.confirmTransaction(sig, 'confirmed')
      setTxSig(sig)
    } catch (e: any) {
      setError(e?.message || 'Claim failed')
    } finally { setLoadingClaim(false) }
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  const fmtDate = (ts: number) =>
    new Date(ts * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

  const claimable = vestingInfo
    ? vestingInfo.phases.reduce((acc, p) => {
        if (p.claimed) return acc
        if (now >= p.end_time) return acc + p.amount
        if (now >= p.start_time) {
          const elapsed = now - p.start_time
          const dur = p.end_time - p.start_time
          return acc + (p.amount * elapsed / dur)
        }
        return acc
      }, 0)
    : 0

  const vestingProgress = vestingInfo && vestingInfo.start_timestamp > 0
    ? Math.min(100, Math.floor((now - vestingInfo.start_timestamp) / (vestingInfo.phase_duration * 6) * 100))
    : 0

  // ── render ────────────────────────────────────────────────────────────────
  if (!wallet.connected) {
    return (
      <div className="tab-content">
        <div className="empty-state">
          <div className="empty-state-icon">⚡</div>
          <div className="empty-state-text">Connect Wallet to Stake</div>
          <div className="empty-state-sub">Stake X1SAFE_PUT to earn X1SAFE rewards from the Exit pool.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="tab-content">

      {/* ── Header ── */}
      <div style={{ marginBottom: 16 }}>
        <div className="page-title" style={{ fontSize: '1.15rem', fontWeight: 800 }}>Stake PUT</div>
        <div className="page-subtitle">Lock X1SAFE_PUT → earn X1SAFE từ Exit reward pool (vesting 42 ngày)</div>
      </div>

      {/* ── Balance cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div style={{
          background: putBalance > 0 ? 'linear-gradient(135deg,rgba(147,51,234,.07),rgba(147,51,234,.02))' : 'var(--bg-elevated)',
          border: `1px solid ${putBalance > 0 ? 'rgba(147,51,234,.25)' : 'var(--border)'}`,
          borderRadius: 'var(--radius)', padding: 14,
        }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 4 }}>Available PUT</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: putBalance > 0 ? 'var(--xnt-color)' : 'var(--text-3)' }}>{putBalance.toFixed(2)}</div>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-3)', marginTop: 3 }}>Stakeable</div>
        </div>
        <div style={{
          background: stakeInfo?.active ? 'linear-gradient(135deg,rgba(234,179,8,.07),rgba(234,179,8,.02))' : 'var(--bg-elevated)',
          border: `1px solid ${stakeInfo?.active ? 'rgba(234,179,8,.25)' : 'var(--border)'}`,
          borderRadius: 'var(--radius)', padding: 14,
        }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 4 }}>Currently Staked</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: stakeInfo?.active ? '#eab308' : 'var(--text-3)' }}>
            {stakeInfo?.active ? stakeInfo.amount_staked.toFixed(2) : '0.00'}
          </div>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-3)', marginTop: 3 }}>Earning rewards</div>
        </div>
      </div>

      {/* ── Claim Rewards Panel ── */}
      {stakeInfo?.active && (
        <div style={{
          marginBottom: 16,
          border: '1px solid rgba(34,197,94,.2)',
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            background: 'rgba(34,197,94,.06)',
            padding: '12px 16px',
            borderBottom: '1px solid rgba(34,197,94,.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--success)' }}>⬡ X1SAFE Rewards</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', marginTop: 2 }}>
                {vestingInfo?.active ? `${vestingProgress}% vested · 6 tranches × 7 ngày` : 'Stake PUT để bắt đầu nhận reward'}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--success)' }}>
                {claimable.toFixed(4)}
              </div>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-3)' }}>X1SAFE claimable</div>
            </div>
          </div>

          {/* Vesting progress bar */}
          {vestingInfo?.active && (
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(34,197,94,.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-3)', marginBottom: 6 }}>
                <span>Vesting Progress</span>
                <span style={{ color: 'var(--success)', fontWeight: 600 }}>{vestingProgress}%</span>
              </div>
              <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 3,
                  width: `${vestingProgress}%`,
                  background: 'linear-gradient(90deg, #22c55e, #86efac)',
                  transition: 'width .4s ease',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: 'var(--text-3)', marginTop: 5 }}>
                <span>Released: {vestingInfo.released_amount.toFixed(2)} X1SAFE</span>
                <span>Total: {vestingInfo.total_amount.toFixed(2)} X1SAFE</span>
              </div>
            </div>
          )}

          {/* Vesting phases */}
          {vestingInfo?.active && (
            <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(34,197,94,.08)' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                6 Tranches
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {vestingInfo.phases.map((p, i) => {
                  const isUnlocked = now >= p.end_time
                  const isActive   = now >= p.start_time && now < p.end_time
                  const _isPending  = now < p.start_time
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '5px 8px',
                      borderRadius: 6,
                      background: p.claimed
                        ? 'rgba(34,197,94,.04)'
                        : isUnlocked
                          ? 'rgba(34,197,94,.08)'
                          : isActive
                            ? 'rgba(234,179,8,.06)'
                            : 'rgba(255,255,255,.02)',
                      border: `1px solid ${p.claimed ? 'rgba(34,197,94,.15)' : isUnlocked ? 'rgba(34,197,94,.2)' : isActive ? 'rgba(234,179,8,.2)' : 'var(--border-soft)'}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ fontSize: '0.75rem' }}>
                          {p.claimed ? '✅' : isUnlocked ? '🟢' : isActive ? '⏳' : '🔒'}
                        </span>
                        <div>
                          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: p.claimed ? 'var(--text-3)' : 'var(--text-1)' }}>
                            Tranche {i + 1}
                          </div>
                          <div style={{ fontSize: '0.6rem', color: 'var(--text-3)' }}>
                            {p.claimed ? 'Claimed' : isUnlocked ? 'Ready' : isActive ? `Active → ${fmtDate(p.end_time)}` : `Unlock ${fmtDate(p.start_time)}`}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: p.claimed ? 'var(--text-3)' : isUnlocked ? 'var(--success)' : 'var(--text-2)' }}>
                          {p.amount.toFixed(4)}
                        </div>
                        <div style={{ fontSize: '0.58rem', color: 'var(--text-3)' }}>X1SAFE</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* pending from stake_account (before vesting initialised) */}
          {stakeInfo && !vestingInfo?.active && stakeInfo.pending_x1safe > 0 && (
            <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(34,197,94,.08)', fontSize: '0.78rem', color: 'var(--text-2)' }}>
              ⏳ Pending X1SAFE: <strong>{stakeInfo.pending_x1safe.toFixed(4)}</strong> — Claim để khởi tạo vesting schedule
            </div>
          )}

          {/* Claim button */}
          <div style={{ padding: '12px 16px' }}>
            {claimable > 0 || (stakeInfo?.pending_x1safe ?? 0) > 0 ? (
              <button
                className="btn btn-success btn-full"
                onClick={handleClaim}
                disabled={loadingClaim}
                style={{ fontWeight: 700, background: 'rgba(34,197,94,.15)', color: 'var(--success)', border: '1px solid rgba(34,197,94,.3)' }}
              >
                {loadingClaim
                  ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
                      Claiming…
                    </span>
                  : `⬡ Claim ${claimable > 0 ? claimable.toFixed(4) : stakeInfo?.pending_x1safe.toFixed(4)} X1SAFE`
                }
              </button>
            ) : (
              <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-3)', padding: '4px 0' }}>
                {vestingInfo?.active
                  ? `⏳ Chờ tranche tiếp theo — ${fmtDate(vestingInfo.phases.find(p => !p.claimed)?.start_time ?? 0)}`
                  : '— Chưa có reward —'
                }
              </div>
            )}
            {safeBalance > 0 && (
              <div style={{ marginTop: 8, textAlign: 'center', fontSize: '0.68rem', color: 'var(--text-3)' }}>
                X1SAFE trong ví: <span style={{ color: 'var(--success)', fontWeight: 600 }}>{safeBalance.toFixed(4)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Stake form ── */}
      {!stakeInfo?.active && (
        <>
          <div style={{
            marginBottom: 14, padding: '12px 14px',
            background: 'rgba(234,179,8,.04)', border: '1px solid rgba(234,179,8,.15)',
            borderRadius: 'var(--radius)', fontSize: '0.78rem', color: 'var(--text-2)', lineHeight: 1.6,
          }}>
            <div style={{ fontWeight: 700, marginBottom: 6, color: '#eab308' }}>⚡ Staking = earn từ Exit pool</div>
            <div>• Mỗi lần user Exit → X1SAFE mint vào reward pool</div>
            <div>• Stakers chia sẻ pool theo tỉ lệ PUT đang stake</div>
            <div>• Rewards vest qua 6 tranches × 7 ngày (42 ngày total)</div>
          </div>

          {putBalance === 0 && (
            <div className="info-box warning" style={{ marginBottom: 14, fontSize: '0.78rem' }}>
              ⚠️ Không có X1SAFE_PUT. Hãy <strong>Deposit</strong> collateral trước.
            </div>
          )}

          <div className="amount-input-block" style={{ marginBottom: 14 }}>
            <div className="amount-input-row">
              <input type="number" className="amount-input-big" placeholder="0.00"
                value={stakeAmount} min="0" step="any"
                disabled={putBalance === 0}
                onChange={e => { setStakeAmount(e.target.value); setError(''); setTxSig(''); setShowConfirm(false) }}
                style={{ color: numAmt > 0 ? 'var(--xnt-color)' : undefined }}
              />
              <div className="amount-input-asset" style={{ color: 'var(--xnt-color)' }}>PUT</div>
            </div>
            <div className="amount-input-footer">
              <span className="amount-usd">{numAmt > 0 ? `→ lock PUT, earn X1SAFE` : 'Enter PUT amount'}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="amount-max-btn" onClick={() => { setStakeAmount((putBalance/2).toFixed(6)); setShowConfirm(false) }} disabled={putBalance===0}>HALF</button>
                <button className="amount-max-btn" onClick={() => { setStakeAmount(putBalance.toFixed(6)); setShowConfirm(false) }} disabled={putBalance===0}>MAX</button>
              </div>
            </div>
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-3)' }}>
              <span>PUT Balance</span>
              <span style={{ color: putBalance > 0 ? 'var(--xnt-color)' : undefined, fontWeight: 600 }}>{putBalance.toFixed(4)} PUT</span>
            </div>
          </div>

          {numAmt > 0 && (
            <div className="conversion-card" style={{ marginBottom: 14 }}>
              <div className="conversion-row">
                <span className="label">⚡ Stake</span>
                <span className="value" style={{ color: 'var(--xnt-color)' }}>{numAmt.toFixed(4)} X1SAFE_PUT</span>
              </div>
              <div className="conversion-row">
                <span className="label">Rewards từ</span>
                <span className="value">Exit pool (X1SAFE)</span>
              </div>
              <div className="conversion-row">
                <span className="label">Vesting</span>
                <span className="value">6 tranches × 7 ngày</span>
              </div>
            </div>
          )}

          {numAmt > putBalance && putBalance > 0 && (
            <div className="info-box warning" style={{ marginBottom: 14 }}>⚠️ Vượt balance ({putBalance.toFixed(4)} PUT)</div>
          )}

          {showConfirm && numAmt > 0 && !error && (
            <div style={{ padding: '12px 14px', background: 'rgba(234,179,8,.05)', border: '1px solid rgba(234,179,8,.2)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: '#eab308', fontWeight: 500, marginBottom: 10 }}>
              ⚡ Stake {numAmt.toFixed(4)} PUT → earn X1SAFE rewards (42 ngày vesting)
            </div>
          )}

          {!showConfirm ? (
            <button className="btn btn-primary btn-full btn-lg"
              disabled={!numAmt || numAmt > putBalance || putBalance === 0}
              onClick={() => setShowConfirm(true)}
              style={{ fontWeight: 700 }}>
              Stake {numAmt > 0 ? `${numAmt.toFixed(4)} PUT` : ''}
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className="btn btn-primary btn-full btn-lg" onClick={handleStake} disabled={loadingStake} style={{ fontWeight: 700 }}>
                {loadingStake
                  ? <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>Processing…</span>
                  : '✓ Confirm Stake'}
              </button>
              <button className="btn btn-secondary btn-full" onClick={() => setShowConfirm(false)} disabled={loadingStake}>Cancel</button>
            </div>
          )}
        </>
      )}

      {/* ── Feedback ── */}
      {error && <div className="info-box danger" style={{ marginTop: 12 }}>❌ {error}</div>}
      {txSig && (
        <div className="tx-status success" style={{ marginTop: 12 }}>
          <span>✅ Done!</span>
          <a href={`${EXPLORER}/tx/${txSig}`} target="_blank" rel="noopener noreferrer"
            style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--success)', textDecoration: 'none' }}>View ↗</a>
        </div>
      )}

      <div style={{ marginTop: 14, textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-3)' }}>
        {IS_TESTNET ? '🔶 Testnet' : '🟢 Mainnet'} · X1SAFE_PUT → stake → earn X1SAFE · 6 tranches × 7d
      </div>

    </div>
  )
}
