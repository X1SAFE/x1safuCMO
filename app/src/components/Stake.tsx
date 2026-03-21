import { useState, useEffect } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import {
  Transaction, SystemProgram, SYSVAR_RENT_PUBKEY,
  TransactionInstruction, PublicKey,
} from '@solana/web3.js'
import {
  TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { sha256 } from '@noble/hashes/sha256'
import {
  STAKING_PROGRAM_ID, STAKING_VAULT_STATE,
  STAKING_X1SAFE_MINT, STAKING_X1SAFE_PUT_MINT, STAKING_STAKE_VAULT,
  EXPLORER, IS_TESTNET, MINTS,
  getTokenBalance, toBaseUnits,
} from '../lib/vault'

function disc(name: string): Buffer {
  return Buffer.from(sha256(new TextEncoder().encode('global:' + name))).subarray(0, 8)
}

function createATAInstruction(payer: PublicKey, ata: PublicKey, owner: PublicKey, mint: PublicKey) {
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

const USER_POSITION_SEED    = Buffer.from('user_position')
const STAKE_ACCOUNT_SEED    = Buffer.from('stake_account')
const VESTING_SCHEDULE_SEED = Buffer.from('vesting_schedule')
const REWARD_POOL_SEED      = Buffer.from('reward_pool')

function getUserPositionPDA(user: PublicKey, tokenMint: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [USER_POSITION_SEED, user.toBuffer(), tokenMint.toBuffer()], STAKING_PROGRAM_ID)[0]
}
function getStakeAccountPDA(user: PublicKey, tokenMint: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [STAKE_ACCOUNT_SEED, user.toBuffer(), tokenMint.toBuffer()], STAKING_PROGRAM_ID)[0]
}
function getVestingSchedulePDA(user: PublicKey, tokenMint: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [VESTING_SCHEDULE_SEED, user.toBuffer(), tokenMint.toBuffer()], STAKING_PROGRAM_ID)[0]
}
function getRewardPoolAta(vaultState: PublicKey) {
  return getAssociatedTokenAddressSync(STAKING_X1SAFE_MINT, vaultState, true, TOKEN_PROGRAM_ID)
}

const DEPOSIT_MINTS = [MINTS.XNT, MINTS.USDCX]

export function Stake() {
  const { connection } = useConnection()
  const wallet = useWallet()

  const [stakeAmount,   setStakeAmount]   = useState('')
  const [loading,       setLoading]       = useState(false)
  const [txSig,         setTxSig]         = useState('')
  const [error,         setError]         = useState('')
  const [putBalance,    setPutBalance]    = useState(0)
  const [safeBalance,   setSafeBalance]   = useState(0)
  const [stakedBalance, setStakedBalance] = useState(0)
  const [showConfirm,   setShowConfirm]   = useState(false)
  const [depositMint,   setDepositMint]   = useState<PublicKey>(MINTS.XNT)
  const [hasStake,      setHasStake]      = useState(false)

  const numAmt = parseFloat(stakeAmount) || 0

  const load = async () => {
    if (!wallet.publicKey) return
    const [put, safe] = await Promise.all([
      getTokenBalance(connection, wallet.publicKey, STAKING_X1SAFE_PUT_MINT),
      getTokenBalance(connection, wallet.publicKey, STAKING_X1SAFE_MINT),
    ])
    setPutBalance(put)
    setSafeBalance(safe)

    // Find active user_position and stake_account
    for (const mint of DEPOSIT_MINTS) {
      const pos = getUserPositionPDA(wallet.publicKey, mint)
      const info = await connection.getAccountInfo(pos)
      if (info) {
        setDepositMint(mint)
        // Check if stake account exists
        const stakePda = getStakeAccountPDA(wallet.publicKey, mint)
        const stakeInfo = await connection.getAccountInfo(stakePda)
        setHasStake(!!stakeInfo)
        if (stakeInfo) {
          // Parse amount_staked (u64 at offset 8+32 = 40)
          const staked = Number(stakeInfo.data.readBigUInt64LE(40)) / 1e6
          setStakedBalance(staked)
        }
        break
      }
    }
  }

  useEffect(() => { load() }, [wallet.publicKey, connection, txSig])

  const handleStake = async () => {
    if (!wallet.publicKey || !wallet.signTransaction || !stakeAmount) return
    if (hasStake) { setError('Bạn đã có stake active. Unstake trước rồi stake lại.'); return }
    setLoading(true); setError(''); setTxSig('')
    try {
      const vaultState       = STAKING_VAULT_STATE
      const putMint          = STAKING_X1SAFE_PUT_MINT
      const stakeVault       = STAKING_STAKE_VAULT
      const userPosition     = getUserPositionPDA(wallet.publicKey, depositMint)
      const stakeAccount     = getStakeAccountPDA(wallet.publicKey, depositMint)
      const vestingSchedule  = getVestingSchedulePDA(wallet.publicKey, depositMint)

      const userPutAta = getAssociatedTokenAddressSync(putMint, wallet.publicKey, false, TOKEN_PROGRAM_ID)

      // Build stake instruction
      // Args: amount: u64 (8 bytes)
      const discBuf = disc('stake')
      const amtBuf  = Buffer.allocUnsafe(8)
      amtBuf.writeBigUInt64LE(BigInt(toBaseUnits(numAmt, 6).toString()))
      const data = Buffer.concat([discBuf, amtBuf])

      // Account order matches Stake<'info>:
      // user, vault_state, user_position, token_mint,
      // user_x1safe_put_account, stake_vault, stake_account,
      // vesting_schedule, system_program, token_program, rent
      const tx = new Transaction()
      tx.add(new TransactionInstruction({
        programId: STAKING_PROGRAM_ID,
        keys: [
          { pubkey: wallet.publicKey,        isSigner: true,  isWritable: true  }, // user
          { pubkey: vaultState,              isSigner: false, isWritable: true  }, // vault_state
          { pubkey: userPosition,            isSigner: false, isWritable: true  }, // user_position
          { pubkey: depositMint,             isSigner: false, isWritable: false }, // token_mint
          { pubkey: userPutAta,              isSigner: false, isWritable: true  }, // user_x1safe_put_account
          { pubkey: stakeVault,              isSigner: false, isWritable: true  }, // stake_vault
          { pubkey: stakeAccount,            isSigner: false, isWritable: true  }, // stake_account (init)
          { pubkey: vestingSchedule,         isSigner: false, isWritable: true  }, // vesting_schedule (init)
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
    } finally { setLoading(false) }
  }

  if (!wallet.connected) {
    return (
      <div className="tab-content">
        <div className="empty-state">
          <div className="empty-state-icon">⚡</div>
          <div className="empty-state-text">Connect Wallet to Stake</div>
          <div className="empty-state-sub">Stake X1SAFE_PUT to earn rewards from the Exit pool.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="tab-content">

      <div style={{ marginBottom: 16 }}>
        <div className="page-title" style={{ fontSize: '1.15rem', fontWeight: 800 }}>Stake PUT</div>
        <div className="page-subtitle">Lock X1SAFE_PUT → earn X1SAFE từ reward pool</div>
      </div>

      {/* ── Info ── */}
      <div style={{
        marginBottom: 14, padding: '12px 14px',
        background: 'rgba(234,179,8,0.04)', border: '1px solid rgba(234,179,8,0.15)',
        borderRadius: 'var(--radius)', fontSize: '0.78rem', color: 'var(--text-2)', lineHeight: 1.6,
      }}>
        <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--warning, #eab308)' }}>⚡ Staking = earn từ Exit pool</div>
        <div>• Mỗi lần user Exit → X1SAFE mint vào reward pool</div>
        <div>• Stakers chia sẻ pool theo tỉ lệ stake</div>
        <div>• Claim rewards mỗi 7 ngày (vesting 6 tranches)</div>
      </div>

      {/* ── Balance cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
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
          background: stakedBalance > 0 ? 'linear-gradient(135deg,rgba(234,179,8,.07),rgba(234,179,8,.02))' : 'var(--bg-elevated)',
          border: `1px solid ${stakedBalance > 0 ? 'rgba(234,179,8,.25)' : 'var(--border)'}`,
          borderRadius: 'var(--radius)', padding: 14,
        }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 4 }}>Currently Staked</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: stakedBalance > 0 ? '#eab308' : 'var(--text-3)' }}>{stakedBalance.toFixed(2)}</div>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-3)', marginTop: 3 }}>Earning rewards</div>
        </div>
      </div>

      {safeBalance > 0 && (
        <div style={{
          marginBottom: 14, padding: '10px 14px',
          background: 'rgba(34,197,94,.04)', border: '1px solid rgba(34,197,94,.15)',
          borderRadius: 'var(--radius)', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem',
        }}>
          <span style={{ color: 'var(--text-3)' }}>X1SAFE earned (claimable)</span>
          <span style={{ color: 'var(--success)', fontWeight: 700 }}>{safeBalance.toFixed(4)} X1SAFE</span>
        </div>
      )}

      {hasStake && (
        <div className="info-box warning" style={{ marginBottom: 14, fontSize: '0.78rem' }}>
          ⚠️ Bạn đã có stake active ({stakedBalance.toFixed(4)} PUT). Unstake trước rồi mới stake lại được.
        </div>
      )}

      {putBalance === 0 && !hasStake && (
        <div className="info-box warning" style={{ marginBottom: 14, fontSize: '0.78rem' }}>
          ⚠️ Không có X1SAFE_PUT. Hãy <strong>Deposit</strong> collateral trước.
        </div>
      )}

      {/* ── Stake amount input ── */}
      {!hasStake && (
        <>
          <div className="form-label" style={{ marginBottom: 8 }}>Amount to Stake</div>
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
              <span className="amount-usd">{numAmt > 0 ? `${numAmt.toFixed(4)} PUT → staking` : 'Enter amount'}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="amount-max-btn" onClick={() => { setStakeAmount((putBalance / 2).toFixed(6)); setShowConfirm(false) }} disabled={putBalance === 0}>HALF</button>
                <button className="amount-max-btn" onClick={() => { setStakeAmount(putBalance.toFixed(6)); setShowConfirm(false) }} disabled={putBalance === 0}>MAX</button>
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
                <span className="label">Claim schedule</span>
                <span className="value">6 tranches × 7 ngày</span>
              </div>
              <div style={{ marginTop: 8, fontSize: '0.68rem', color: 'var(--text-3)' }}>
                PUT bị lock trong stake vault · Claim từng tranche mỗi 7 ngày
              </div>
            </div>
          )}

          {numAmt > putBalance && putBalance > 0 && (
            <div className="info-box warning" style={{ marginBottom: 14 }}>⚠️ Vượt balance ({putBalance.toFixed(4)} PUT)</div>
          )}
        </>
      )}

      {error && <div className="info-box danger" style={{ marginBottom: 14 }}>❌ {error}</div>}
      {txSig && (
        <div className="tx-status success" style={{ marginBottom: 14 }}>
          <span>✅ Staked! PUT đang earn rewards</span>
          <a href={`${EXPLORER}/tx/${txSig}`} target="_blank" rel="noopener noreferrer"
            style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--success)', textDecoration: 'none' }}>View ↗</a>
        </div>
      )}

      {showConfirm && numAmt > 0 && !error && !hasStake && (
        <div style={{ padding: '12px 14px', background: 'rgba(234,179,8,.05)', border: '1px solid rgba(234,179,8,.2)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: '#eab308', fontWeight: 500, marginBottom: 10 }}>
          ⚡ Stake {numAmt.toFixed(4)} PUT → earn X1SAFE rewards
        </div>
      )}

      {!hasStake && (
        !showConfirm ? (
          <button className="btn btn-primary btn-full btn-lg"
            disabled={!numAmt || numAmt > putBalance || putBalance === 0}
            onClick={() => setShowConfirm(true)}
            style={{ fontWeight: 700 }}>
            Stake {numAmt > 0 ? `${numAmt.toFixed(4)} PUT` : ''}
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button className="btn btn-primary btn-full btn-lg" onClick={handleStake} disabled={loading} style={{ fontWeight: 700 }}>
              {loading
                ? <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>Processing…</span>
                : '✓ Confirm Stake'}
            </button>
            <button className="btn btn-secondary btn-full" onClick={() => setShowConfirm(false)} disabled={loading}>Cancel</button>
          </div>
        )
      )}

      <div style={{ marginTop: 12, textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-3)' }}>
        {IS_TESTNET ? '🔶 Testnet' : '🟢 Mainnet'} · stake · PUT → vault · earn X1SAFE từ Exit pool
      </div>

    </div>
  )
}
