import { useState, useEffect } from 'react'
import { useConnection, useWallet, useAnchorWallet } from '@solana/wallet-adapter-react'
import { AnchorProvider } from '@coral-xyz/anchor'
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getAccount } from '@solana/spl-token'
import { Transaction } from '@solana/web3.js'
import {
  EXPLORER, IS_TESTNET,
  getProgram, getStakePoolPDA, getSafeMintPDA, getSx1safeMintPDA,
  getStakeReservePDA, getRewardReservePDA, getUserStakePDA,
  fetchStakePool, fetchUserStake, getTokenBalance, toBaseUnits,
  saveStakeTimestamp, getStakeTimestamp, estimateAccruedRewards,
} from '../lib/vault'

export function Stake() {
  const { connection } = useConnection()
  const wallet         = useWallet()
  const anchorWallet   = useAnchorWallet()

  const [mode,          setMode]         = useState<'stake' | 'unstake'>('stake')
  const [amount,        setAmount]       = useState('')
  const [loading,       setLoading]      = useState(false)
  const [txSig,         setTxSig]        = useState('')
  const [error,         setError]        = useState('')
  const [safeBalance,   setSafeBalance]  = useState(0)
  const [sxBalance,     setSxBalance]    = useState(0)
  const [stakePool,     setStakePool]    = useState<any>(null)
  const [userStake,     setUserStake]    = useState<any>(null)

  const numAmt = parseFloat(amount) || 0

  const load = async () => {
    if (!wallet.publicKey) return
    const safeMint  = getSafeMintPDA()
    const sx1sMint  = getSx1safeMintPDA()
    const [safeBal, sxBal, pool, stake] = await Promise.all([
      getTokenBalance(connection, wallet.publicKey, safeMint),
      getTokenBalance(connection, wallet.publicKey, sx1sMint),
      fetchStakePool(connection),
      fetchUserStake(connection, wallet.publicKey),
    ])
    setSafeBalance(safeBal)
    setSxBalance(sxBal)
    setStakePool(pool)
    setUserStake(stake)
  }

  useEffect(() => { load() }, [wallet.publicKey, connection, txSig])

  const handleStake = async () => {
    if (!wallet.publicKey || !anchorWallet || !amount) return
    setLoading(true); setError(''); setTxSig('')
    try {
      const provider    = new AnchorProvider(connection, anchorWallet, { commitment: 'confirmed' })
      const program     = getProgram(provider)
      const stakePoolPK = getStakePoolPDA()
      const sx1safeMint = getSx1safeMintPDA()
      const safeMint    = getSafeMintPDA()
      const stakeReserve = getStakeReservePDA()
      const userStakePK  = getUserStakePDA(wallet.publicKey)

      const userX1safe  = await getAssociatedTokenAddress(safeMint, wallet.publicKey)
      const userSx1safe = await getAssociatedTokenAddress(sx1safeMint, wallet.publicKey)

      // Ensure sX1SAFE ATA exists
      try { await getAccount(connection, userSx1safe) } catch {
        const tx = new Transaction()
        tx.add(createAssociatedTokenAccountInstruction(wallet.publicKey, userSx1safe, wallet.publicKey, sx1safeMint))
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
        tx.feePayer = wallet.publicKey
        const signed = await wallet.signTransaction!(tx)
        await connection.confirmTransaction(
          await connection.sendRawTransaction(signed.serialize()),
          'confirmed'
        )
      }

      const tx = await program.methods
        .stake(toBaseUnits(numAmt, 6))
        .accounts({
          user: wallet.publicKey,
          stakePool: stakePoolPK,
          userStake: userStakePK,
          sx1safeMint,
          userX1safe,
          userSx1safe,
          stakeReserve,
        })
        .rpc()

      // Save stake timestamp locally for off-chain reward estimation
      if (wallet.publicKey) saveStakeTimestamp(wallet.publicKey)
      setTxSig(tx); setAmount('')
    } catch (e: any) {
      setError(e?.message || 'Transaction failed')
    } finally { setLoading(false) }
  }

  const handleUnstake = async () => {
    if (!wallet.publicKey || !anchorWallet || !amount) return
    setLoading(true); setError(''); setTxSig('')
    try {
      const provider     = new AnchorProvider(connection, anchorWallet, { commitment: 'confirmed' })
      const program      = getProgram(provider)
      const stakePoolPK  = getStakePoolPDA()
      const sx1safeMint  = getSx1safeMintPDA()
      const safeMint     = getSafeMintPDA()
      const stakeReserve  = getStakeReservePDA()
      const rewardReserve = getRewardReservePDA()
      const userStakePK   = getUserStakePDA(wallet.publicKey)

      const userX1safe  = await getAssociatedTokenAddress(safeMint, wallet.publicKey)
      const userSx1safe = await getAssociatedTokenAddress(sx1safeMint, wallet.publicKey)

      const tx = await program.methods
        .unstake(toBaseUnits(numAmt, 6))
        .accounts({
          user: wallet.publicKey,
          stakePool: stakePoolPK,
          userStake: userStakePK,
          sx1safeMint,
          userX1safe,
          userSx1safe,
          stakeReserve,
          rewardReserve,
        })
        .rpc()

      setTxSig(tx); setAmount('')
    } catch (e: any) {
      setError(e?.message || 'Transaction failed')
    } finally { setLoading(false) }
  }

  const handleClaimRewards = async () => {
    if (!wallet.publicKey || !anchorWallet) return
    setLoading(true); setError(''); setTxSig('')
    try {
      const provider      = new AnchorProvider(connection, anchorWallet, { commitment: 'confirmed' })
      const program       = getProgram(provider)
      const stakePoolPK   = getStakePoolPDA()
      const safeMint      = getSafeMintPDA()
      const rewardReserve = getRewardReservePDA()
      const userStakePK   = getUserStakePDA(wallet.publicKey)
      const userX1safe    = await getAssociatedTokenAddress(safeMint, wallet.publicKey)

      const tx = await program.methods
        .claimRewards()
        .accounts({
          user: wallet.publicKey,
          stakePool: stakePoolPK,
          userStake: userStakePK,
          userX1safe,
          rewardReserve,
        })
        .rpc()

      setTxSig(tx)
    } catch (e: any) {
      setError(e?.message || 'Transaction failed')
    } finally { setLoading(false) }
  }

  const apyPct      = stakePool ? (stakePool.apyBps / 100).toFixed(1) : '—'
  const totalStaked = stakePool ? (stakePool.totalStaked / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'
  const myStaked    = userStake ? (userStake.stakedAmount / 1e6).toFixed(4) : '0'

  // Off-chain accrued estimate (accumulates continuously)
  const stakeTs         = wallet.publicKey ? getStakeTimestamp(wallet.publicKey) : null
  const apyBps          = stakePool ? stakePool.apyBps : 0
  const onChainPending  = userStake ? userStake.rewardsPending / 1e6 : 0
  const accrued         = (userStake && stakeTs && apyBps > 0)
    ? estimateAccruedRewards(userStake.stakedAmount, apyBps, stakeTs) / 1e6
    : 0
  const pending         = (onChainPending + accrued).toFixed(6)
  const maxBal          = mode === 'stake' ? safeBalance : sxBalance

  if (!wallet.connected) {
    return (
      <div style={{ maxWidth: 480, margin: '24px auto' }}>
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🔐</div>
            <div className="empty-state-title">Wallet not connected</div>
            <div className="empty-state-sub">Connect to stake X1SAFE.</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      <div style={{ marginBottom: 18 }}>
        <div className="page-title">Stake</div>
        <div className="page-subtitle">Stake X1SAFE → receive sX1SAFE + earn yield</div>
      </div>

      {/* Pool stats */}
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

      {/* User stake summary */}
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
              Claim {parseFloat(pending).toFixed(4)} X1SAFE
            </button>
          )}
        </div>
        <div className="stats-grid" style={{ margin: 0 }}>
          <div className="stat-card" style={{ background: 'transparent', border: 'none', padding: '8px 0' }}>
            <div className="stat-label">Staked</div>
            <div className="stat-value" style={{ fontSize: '1.1rem' }}>{myStaked}</div>
            <div className="stat-sub">X1SAFE</div>
          </div>
          <div className="stat-card" style={{ background: 'transparent', border: 'none', padding: '8px 0' }}>
            <div className="stat-label">sX1SAFE</div>
            <div className="stat-value" style={{ fontSize: '1.1rem' }}>{sxBalance.toFixed(4)}</div>
            <div className="stat-sub">receipt tokens</div>
          </div>
          <div className="stat-card" style={{ background: 'transparent', border: 'none', padding: '8px 0' }}>
            <div className="stat-label">Pending</div>
            <div className="stat-value" style={{ fontSize: '1.1rem', color: parseFloat(pending) > 0 ? 'var(--success)' : undefined }}>{pending}</div>
            <div className="stat-sub">rewards</div>
          </div>
          <div className="stat-card" style={{ background: 'transparent', border: 'none', padding: '8px 0' }}>
            <div className="stat-label">Wallet</div>
            <div className="stat-value" style={{ fontSize: '1.1rem' }}>{safeBalance.toFixed(4)}</div>
            <div className="stat-sub">free X1SAFE</div>
          </div>
        </div>
      </div>

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button
          className={`btn btn-full${mode === 'stake' ? ' btn-primary' : ' btn-secondary'}`}
          onClick={() => { setMode('stake'); setAmount('') }}
        >Stake</button>
        <button
          className={`btn btn-full${mode === 'unstake' ? ' btn-primary' : ' btn-secondary'}`}
          onClick={() => { setMode('unstake'); setAmount('') }}
        >Unstake</button>
      </div>

      <div className="section-header">
        <span className="section-title">{mode === 'stake' ? 'Amount to Stake' : 'Amount to Unstake'}</span>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
          {mode === 'stake' ? `X1SAFE: ${safeBalance.toFixed(4)}` : `sX1SAFE: ${sxBalance.toFixed(4)}`}
        </span>
      </div>

      <div className="amount-input-block">
        <div className="amount-input-row">
          <input
            type="number"
            className="amount-input-big"
            placeholder="0.00"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
          <div className="amount-input-asset">{mode === 'stake' ? 'X1SAFE' : 'sX1SAFE'}</div>
        </div>
        <div className="amount-input-footer">
          <span className="amount-usd">
            {mode === 'stake'
              ? (numAmt > 0 ? `→ ${numAmt.toFixed(4)} sX1SAFE` : 'Enter amount')
              : (numAmt > 0 ? `→ ${numAmt.toFixed(4)} X1SAFE + rewards` : 'Enter amount')}
          </span>
          <button className="amount-max-btn" onClick={() => setAmount(maxBal.toFixed(6))}>MAX</button>
        </div>
      </div>

      {error && (
        <div className="tx-status error" style={{ marginBottom: 12 }}>
          <span>⚠</span> {error}
        </div>
      )}

      <button
        className="btn btn-primary btn-full btn-lg"
        onClick={mode === 'stake' ? handleStake : handleUnstake}
        disabled={loading || !amount || numAmt <= 0}
      >
        {loading
          ? <><span className="loading" style={{ borderTopColor: '#000' }} /> Processing…</>
          : mode === 'stake'
            ? `Stake ${numAmt > 0 ? `${numAmt.toFixed(4)} X1SAFE` : ''}`
            : `Unstake ${numAmt > 0 ? `${numAmt.toFixed(4)} sX1SAFE` : ''}`}
      </button>

      {txSig && (
        <div className="tx-status success" style={{ marginTop: 12 }}>
          <span>✓</span>
          <span>
            Success!{' '}
            <a href={`${EXPLORER}/tx/${txSig}`} target="_blank" rel="noopener" style={{ color: 'var(--success)', fontWeight: 700 }}>View tx ↗</a>
          </span>
        </div>
      )}

      <div className="program-footer" style={{ marginTop: 16 }}>
        <span>{IS_TESTNET ? '🔶 Testnet' : '🟢 Mainnet'}</span>
        <span>sX1SAFE staking pool</span>
      </div>
    </div>
  )
}
