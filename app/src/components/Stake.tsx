import { useState, useEffect } from 'react'
import { useConnection, useWallet, useAnchorWallet } from '@solana/wallet-adapter-react'
import { AnchorProvider } from '@coral-xyz/anchor'
import {
  getAssociatedTokenAddress, createAssociatedTokenAccountInstruction,
  getAccount, TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import {
  Transaction, TransactionInstruction, PublicKey,
  SystemProgram, SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js'
import { sha256 } from '@noble/hashes/sha256'
import {
  EXPLORER, IS_TESTNET, PROGRAM_ID,
  getProgram, getStakingProgram, loadStakingIDL,
  getVaultPDA, getPutMintPDA, getSafeMintPDA, getSx1safeMintPDA,
  getStakePoolPDA, getStakeReservePDA, getRewardReservePDA,
  getUserStakePDA, getUserPositionPDA,
  fetchStakePool, fetchUserStake, getTokenBalance, toBaseUnits,
} from '../lib/vault'

function disc(name: string): Buffer {
  return Buffer.from(sha256(new TextEncoder().encode('global:' + name))).subarray(0, 8)
}

// Source type: stake from PUT receipt or from free X1SAFE
type StakeSource = 'put' | 'free'
type Mode = 'stake' | 'unstake'

export function Stake() {
  const { connection } = useConnection()
  const wallet         = useWallet()
  const anchorWallet   = useAnchorWallet()

  const [mode,        setMode]       = useState<Mode>('stake')
  const [source,      setSource]     = useState<StakeSource>('put')
  const [amount,      setAmount]     = useState('')
  const [loading,     setLoading]    = useState(false)
  const [txSig,       setTxSig]      = useState('')
  const [error,       setError]      = useState('')
  const [putBalance,  setPutBalance] = useState(0)
  const [safeBalance, setSafeBalance]= useState(0)
  const [sxBalance,   setSxBalance]  = useState(0)
  const [stakePool,   setStakePool]  = useState<any>(null)
  const [userStake,   setUserStake]  = useState<any>(null)

  const numAmt = parseFloat(amount) || 0
  const maxBal = mode === 'unstake' ? sxBalance : (source === 'put' ? putBalance : safeBalance)

  const load = async () => {
    if (!wallet.publicKey) return
    const putMint  = getPutMintPDA()
    const safeMint = getSafeMintPDA()
    const sx1sMint = getSx1safeMintPDA()
    const [put, safe, sx, pool, stake] = await Promise.all([
      getTokenBalance(connection, wallet.publicKey, putMint),
      getTokenBalance(connection, wallet.publicKey, safeMint),
      getTokenBalance(connection, wallet.publicKey, sx1sMint),
      fetchStakePool(connection),
      fetchUserStake(connection, wallet.publicKey),
    ])
    setPutBalance(put)
    setSafeBalance(safe)
    setSxBalance(sx)
    setStakePool(pool)
    setUserStake(stake)
  }

  useEffect(() => { load() }, [wallet.publicKey, connection, txSig])

  // ── Stake: withdraw PUT→FREE then stake FREE→sX1SAFE (1 tx) ──────────────
  const handleStakePUT = async () => {
    if (!wallet.publicKey || !wallet.signTransaction || !anchorWallet || !amount) return
    setLoading(true); setError(''); setTxSig('')
    try {
      await loadStakingIDL()
      const provider   = new AnchorProvider(connection, anchorWallet, { commitment: 'confirmed' })
      const mainProg   = getProgram(provider)
      const stakeProg  = getStakingProgram(provider)

      const vault       = getVaultPDA()
      const putMint     = getPutMintPDA()
      const safeMint    = getSafeMintPDA()
      const sx1safeMint = getSx1safeMintPDA()
      const stakePoolPK = getStakePoolPDA()
      const stakeRsv    = getStakeReservePDA()
      const userPos     = getUserPositionPDA(wallet.publicKey)
      const userStakePK = getUserStakePDA(wallet.publicKey)

      const userPutAta    = await getAssociatedTokenAddress(putMint,     wallet.publicKey, false, TOKEN_PROGRAM_ID)
      const userSafeAta   = await getAssociatedTokenAddress(safeMint,    wallet.publicKey, false, TOKEN_PROGRAM_ID)
      const userSx1sAta   = await getAssociatedTokenAddress(sx1safeMint, wallet.publicKey, false, TOKEN_PROGRAM_ID)

      const amountBN = toBaseUnits(numAmt, 9) // PUT has 9 decimals

      const tx = new Transaction()

      // Ensure X1SAFE_FREE ATA exists (needed to receive from withdraw)
      try { await getAccount(connection, userSafeAta, undefined, TOKEN_PROGRAM_ID) } catch {
        tx.add(createAssociatedTokenAccountInstruction(
          wallet.publicKey, userSafeAta, wallet.publicKey, safeMint, TOKEN_PROGRAM_ID
        ))
      }

      // Ensure sX1SAFE ATA exists (needed to receive from stake)
      try { await getAccount(connection, userSx1sAta, undefined, TOKEN_PROGRAM_ID) } catch {
        tx.add(createAssociatedTokenAccountInstruction(
          wallet.publicKey, userSx1sAta, wallet.publicKey, sx1safeMint, TOKEN_PROGRAM_ID
        ))
      }

      // Instruction 1: withdraw PUT → X1SAFE FREE (burn PUT, mint SAFE)
      const withdrawIx = await mainProg.methods
        .withdraw(amountBN)
        .accounts({
          user: wallet.publicKey,
          vault,
          putMint,
          safeMint,
          userPutAccount:  userPutAta,
          userSafeAccount: userSafeAta,
          userPosition:    userPos,
        })
        .instruction()
      tx.add(withdrawIx)

      // Instruction 2: stake X1SAFE FREE → sX1SAFE
      const stakeIx = await stakeProg.methods
        .stake(amountBN)
        .accounts({
          user:       wallet.publicKey,
          stakePool:  stakePoolPK,
          userStake:  userStakePK,
          sx1safeMint,
          userX1safe:  userSafeAta,
          userSx1safe: userSx1sAta,
          stakeReserve: stakeRsv,
        })
        .instruction()
      tx.add(stakeIx)

      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
      tx.feePayer = wallet.publicKey
      const signed = await wallet.signTransaction(tx)
      const sig = await connection.sendRawTransaction(signed.serialize())
      await connection.confirmTransaction(sig, 'confirmed')
      setTxSig(sig)
      setAmount('')
    } catch (e: any) {
      setError(e?.message || 'Transaction failed')
    } finally { setLoading(false) }
  }

  // ── Stake: stake X1SAFE FREE → sX1SAFE directly ──────────────────────────
  const handleStakeFREE = async () => {
    if (!wallet.publicKey || !anchorWallet || !amount) return
    setLoading(true); setError(''); setTxSig('')
    try {
      await loadStakingIDL()
      const provider    = new AnchorProvider(connection, anchorWallet, { commitment: 'confirmed' })
      const program     = getStakingProgram(provider)
      const sx1safeMint = getSx1safeMintPDA()
      const safeMint    = getSafeMintPDA()
      const stakePoolPK = getStakePoolPDA()
      const stakeRsv    = getStakeReservePDA()
      const userStakePK = getUserStakePDA(wallet.publicKey)

      const userX1safe  = await getAssociatedTokenAddress(safeMint,    wallet.publicKey, false, TOKEN_PROGRAM_ID)
      const userSx1safe = await getAssociatedTokenAddress(sx1safeMint, wallet.publicKey, false, TOKEN_PROGRAM_ID)

      const tx = new Transaction()
      try { await getAccount(connection, userSx1safe, undefined, TOKEN_PROGRAM_ID) } catch {
        tx.add(createAssociatedTokenAccountInstruction(
          wallet.publicKey, userSx1safe, wallet.publicKey, sx1safeMint, TOKEN_PROGRAM_ID
        ))
      }

      const stakeIx = await program.methods
        .stake(toBaseUnits(numAmt, 9))
        .accounts({
          user:       wallet.publicKey,
          stakePool:  stakePoolPK,
          userStake:  userStakePK,
          sx1safeMint,
          userX1safe,
          userSx1safe,
          stakeReserve: stakeRsv,
        })
        .instruction()
      tx.add(stakeIx)

      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
      tx.feePayer = wallet.publicKey
      const signed = await wallet.signTransaction!(tx)
      const sig = await connection.sendRawTransaction(signed.serialize())
      await connection.confirmTransaction(sig, 'confirmed')
      setTxSig(sig)
      setAmount('')
    } catch (e: any) {
      setError(e?.message || 'Transaction failed')
    } finally { setLoading(false) }
  }

  // ── Unstake: sX1SAFE → X1SAFE FREE ───────────────────────────────────────
  const handleUnstake = async () => {
    if (!wallet.publicKey || !anchorWallet || !amount) return
    setLoading(true); setError(''); setTxSig('')
    try {
      await loadStakingIDL()
      const provider     = new AnchorProvider(connection, anchorWallet, { commitment: 'confirmed' })
      const program      = getStakingProgram(provider)
      const sx1safeMint  = getSx1safeMintPDA()
      const safeMint     = getSafeMintPDA()
      const stakePoolPK  = getStakePoolPDA()
      const stakeRsv     = getStakeReservePDA()
      const rewardRsv    = getRewardReservePDA()
      const userStakePK  = getUserStakePDA(wallet.publicKey)

      const userX1safe  = await getAssociatedTokenAddress(safeMint,    wallet.publicKey, false, TOKEN_PROGRAM_ID)
      const userSx1safe = await getAssociatedTokenAddress(sx1safeMint, wallet.publicKey, false, TOKEN_PROGRAM_ID)

      const tx = await program.methods
        .unstake(toBaseUnits(numAmt, 9))
        .accounts({
          user:          wallet.publicKey,
          stakePool:     stakePoolPK,
          userStake:     userStakePK,
          sx1safeMint,
          userX1safe,
          userSx1safe,
          stakeReserve:  stakeRsv,
          rewardReserve: rewardRsv,
        })
        .rpc()

      setTxSig(tx)
      setAmount('')
    } catch (e: any) {
      setError(e?.message || 'Transaction failed')
    } finally { setLoading(false) }
  }

  // ── Claim rewards ─────────────────────────────────────────────────────────
  const handleClaimRewards = async () => {
    if (!wallet.publicKey || !anchorWallet) return
    setLoading(true); setError(''); setTxSig('')
    try {
      await loadStakingIDL()
      const provider      = new AnchorProvider(connection, anchorWallet, { commitment: 'confirmed' })
      const program       = getStakingProgram(provider)
      const safeMint      = getSafeMintPDA()
      const stakePoolPK   = getStakePoolPDA()
      const rewardRsv     = getRewardReservePDA()
      const userStakePK   = getUserStakePDA(wallet.publicKey)
      const userX1safe    = await getAssociatedTokenAddress(safeMint, wallet.publicKey, false, TOKEN_PROGRAM_ID)

      const tx = await program.methods
        .claimRewards()
        .accounts({
          user:          wallet.publicKey,
          stakePool:     stakePoolPK,
          userStake:     userStakePK,
          userX1safe,
          rewardReserve: rewardRsv,
        })
        .rpc()

      setTxSig(tx)
    } catch (e: any) {
      setError(e?.message || 'Transaction failed')
    } finally { setLoading(false) }
  }

  const apyPct      = stakePool ? (stakePool.apyBps / 100).toFixed(1) : '—'
  const totalStaked = stakePool ? (stakePool.totalStaked / 1e9).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'
  const myStaked    = userStake ? (userStake.stakedAmount / 1e9).toFixed(4) : '0'
  const pending     = userStake ? (userStake.rewardsPending / 1e9).toFixed(6) : '0'

  if (!wallet.connected) {
    return (
      <div className="tab-content">
        <div className="empty-state">
          <div className="empty-state-icon">🔐</div>
          <div className="empty-state-text">Connect Wallet to Stake</div>
          <div className="empty-state-sub">Connect your wallet to stake X1SAFE_PUT.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="tab-content">

      {/* ── Page title ── */}
      <div style={{ marginBottom: 16 }}>
        <div className="page-title" style={{ fontSize: '1.15rem', fontWeight: 800 }}>Stake</div>
        <div className="page-subtitle">Stake X1SAFE_PUT or X1SAFE → earn yield as sX1SAFE</div>
      </div>

      {/* ── Pool stats ── */}
      <div className="stats-grid" style={{ marginBottom: 14 }}>
        <div className="stat-card">
          <div className="stat-label">APY</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{apyPct}%</div>
          <div className="stat-sub">Annual yield</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Staked</div>
          <div className="stat-value" style={{ fontSize: '1.1rem' }}>{totalStaked}</div>
          <div className="stat-sub">X1SAFE locked</div>
        </div>
      </div>

      {/* ── User position ── */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-header">
          <div className="card-title">Your Position</div>
          {parseFloat(pending) > 0 && (
            <button
              className="btn btn-sm"
              style={{ background: 'rgba(34,197,94,0.08)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.2)' }}
              onClick={handleClaimRewards}
              disabled={loading}
            >
              Claim {parseFloat(pending).toFixed(4)}
            </button>
          )}
        </div>
        <div className="stats-grid" style={{ margin: 0 }}>
          {[
            { label: 'PUT',        val: putBalance.toFixed(2),  sub: 'unstaked receipt',   color: 'var(--xnt-color)' },
            { label: 'X1SAFE',     val: safeBalance.toFixed(2), sub: 'free / stakeable',   color: 'var(--success)' },
            { label: 'sX1SAFE',    val: sxBalance.toFixed(4),   sub: 'staked receipt',     color: 'var(--text-2)' },
            { label: 'Rewards',    val: pending,                sub: 'pending X1SAFE',     color: parseFloat(pending) > 0 ? 'var(--success)' : undefined },
          ].map(s => (
            <div key={s.label} className="stat-card" style={{ background: 'transparent', border: 'none', padding: '8px 0' }}>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ fontSize: '1rem', color: s.color }}>{s.val}</div>
              <div className="stat-sub">{s.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Mode toggle: Stake / Unstake ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button
          className={`btn btn-full${mode === 'stake' ? ' btn-primary' : ' btn-secondary'}`}
          onClick={() => { setMode('stake'); setAmount('') }}
        >⬡ Stake</button>
        <button
          className={`btn btn-full${mode === 'unstake' ? ' btn-primary' : ' btn-secondary'}`}
          onClick={() => { setMode('unstake'); setAmount('') }}
        >↩ Unstake</button>
      </div>

      {/* ── Source selector (stake mode only) ── */}
      {mode === 'stake' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          {/* Stake from PUT */}
          <button
            onClick={() => { setSource('put'); setAmount('') }}
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius)',
              border: `1.5px solid ${source === 'put' ? 'var(--xnt-color)' : 'var(--border)'}`,
              background: source === 'put' ? 'rgba(168,85,247,0.06)' : 'var(--bg-elevated)',
              cursor: 'pointer', textAlign: 'left',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              From X1SAFE_PUT
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: source === 'put' ? 'var(--xnt-color)' : 'var(--text)', letterSpacing: '-0.02em' }}>
              {putBalance.toFixed(2)}
            </div>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-3)', marginTop: 3 }}>
              Auto-unlocks PUT → stakes in 1 tx
            </div>
          </button>

          {/* Stake from FREE */}
          <button
            onClick={() => { setSource('free'); setAmount('') }}
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius)',
              border: `1.5px solid ${source === 'free' ? 'var(--success)' : 'var(--border)'}`,
              background: source === 'free' ? 'rgba(34,197,94,0.06)' : 'var(--bg-elevated)',
              cursor: 'pointer', textAlign: 'left',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              From X1SAFE (free)
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: source === 'free' ? 'var(--success)' : 'var(--text)', letterSpacing: '-0.02em' }}>
              {safeBalance.toFixed(2)}
            </div>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-3)', marginTop: 3 }}>
              Direct stake
            </div>
          </button>
        </div>
      )}

      {/* ── Amount input ── */}
      <div className="amount-input-block" style={{ marginBottom: 14 }}>
        <div className="amount-input-row">
          <input
            type="number"
            className="amount-input-big"
            placeholder="0.00"
            value={amount}
            min="0"
            step="any"
            onChange={e => { setAmount(e.target.value); setError(''); setTxSig('') }}
          />
          <div className="amount-input-asset" style={{ color: mode === 'unstake' ? 'var(--text-2)' : source === 'put' ? 'var(--xnt-color)' : 'var(--success)' }}>
            {mode === 'unstake' ? 'sX1SAFE' : source === 'put' ? 'PUT' : 'X1SAFE'}
          </div>
        </div>
        <div className="amount-input-footer">
          <span className="amount-usd">
            {numAmt > 0
              ? mode === 'unstake'
                ? `→ ${numAmt.toFixed(4)} X1SAFE + rewards`
                : source === 'put'
                  ? `Unlock PUT → Stake ${numAmt.toFixed(4)} → sX1SAFE`
                  : `→ ${numAmt.toFixed(4)} sX1SAFE`
              : 'Enter amount'}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="amount-max-btn" onClick={() => setAmount((maxBal / 2).toFixed(6))} disabled={maxBal === 0}>HALF</button>
            <button className="amount-max-btn" onClick={() => setAmount(maxBal.toFixed(6))} disabled={maxBal === 0}>MAX</button>
          </div>
        </div>
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-3)' }}>
          <span>Balance</span>
          <span style={{ fontWeight: 600 }}>{maxBal.toFixed(4)} {mode === 'unstake' ? 'sX1SAFE' : source === 'put' ? 'PUT' : 'X1SAFE'}</span>
        </div>
      </div>

      {/* ── Conversion card ── */}
      {numAmt > 0 && (
        <div className="conversion-card" style={{ marginBottom: 14 }}>
          {mode === 'stake' && source === 'put' && (
            <>
              <div className="conversion-row">
                <span className="label">🔥 Unlock (burn)</span>
                <span className="value" style={{ color: 'var(--xnt-color)' }}>{numAmt.toFixed(4)} X1SAFE_PUT</span>
              </div>
              <div className="conversion-row">
                <span className="label">⬡ Auto-stake</span>
                <span className="value" style={{ color: 'var(--success)' }}>{numAmt.toFixed(4)} X1SAFE → sX1SAFE</span>
              </div>
            </>
          )}
          {mode === 'stake' && source === 'free' && (
            <div className="conversion-row">
              <span className="label">⬡ Stake</span>
              <span className="value" style={{ color: 'var(--success)' }}>{numAmt.toFixed(4)} X1SAFE → sX1SAFE</span>
            </div>
          )}
          {mode === 'unstake' && (
            <div className="conversion-row">
              <span className="label">↩ Unstake</span>
              <span className="value">{numAmt.toFixed(4)} sX1SAFE → X1SAFE + rewards</span>
            </div>
          )}
          <div className="conversion-divider" />
          <div className="conversion-total">
            <span className="label">→ You receive</span>
            <span className="value">
              {mode === 'unstake'
                ? `${numAmt.toFixed(4)} X1SAFE + pending rewards`
                : `${numAmt.toFixed(4)} sX1SAFE`}
            </span>
          </div>
        </div>
      )}

      {/* ── Warnings ── */}
      {mode === 'stake' && source === 'put' && putBalance === 0 && (
        <div className="info-box warning" style={{ marginBottom: 14 }}>
          ⚠️ No X1SAFE_PUT — deposit collateral first on the Deposit tab.
        </div>
      )}
      {mode === 'stake' && source === 'free' && safeBalance === 0 && (
        <div className="info-box warning" style={{ marginBottom: 14 }}>
          ⚠️ No X1SAFE (free) — go to Withdraw tab to convert PUT → X1SAFE first.
        </div>
      )}
      {mode === 'unstake' && sxBalance === 0 && (
        <div className="info-box warning" style={{ marginBottom: 14 }}>
          ⚠️ No sX1SAFE to unstake.
        </div>
      )}
      {numAmt > maxBal && maxBal > 0 && (
        <div className="info-box warning" style={{ marginBottom: 14 }}>
          ⚠️ Amount exceeds balance ({maxBal.toFixed(4)})
        </div>
      )}

      {/* ── Error / Success ── */}
      {error && (
        <div className="info-box danger" style={{ marginBottom: 14 }}>❌ {error}</div>
      )}
      {txSig && (
        <div className="tx-status success" style={{ marginBottom: 14 }}>
          <span>✅ {mode === 'stake' ? 'Staked!' : 'Unstaked!'}</span>
          <a href={`${EXPLORER}/tx/${txSig}`} target="_blank" rel="noopener noreferrer"
            style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--success)', textDecoration: 'none' }}>
            View ↗
          </a>
        </div>
      )}

      {/* ── Action button ── */}
      <button
        className="btn btn-primary btn-full btn-lg"
        disabled={loading || !numAmt || numAmt > maxBal}
        onClick={
          mode === 'unstake' ? handleUnstake :
          source === 'put'   ? handleStakePUT :
                               handleStakeFREE
        }
        style={{ fontWeight: 700, letterSpacing: '-0.02em' }}
      >
        {loading ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
            Processing…
          </span>
        ) : mode === 'unstake' ? (
          `Unstake ${numAmt > 0 ? numAmt.toFixed(4) + ' sX1SAFE' : ''}`
        ) : source === 'put' ? (
          `Stake PUT ${numAmt > 0 ? numAmt.toFixed(4) : ''} → sX1SAFE`
        ) : (
          `Stake ${numAmt > 0 ? numAmt.toFixed(4) + ' X1SAFE' : ''} → sX1SAFE`
        )}
      </button>

      <div style={{ marginTop: 12, textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-3)' }}>
        {IS_TESTNET ? '🔶 Testnet' : '🟢 Mainnet'} · sX1SAFE staking pool · APY {apyPct}%
      </div>

    </div>
  )
}
