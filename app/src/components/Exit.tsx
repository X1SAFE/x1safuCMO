import { useState, useEffect } from 'react'
import { useConnection, useWallet, useAnchorWallet } from '@solana/wallet-adapter-react'
import { AnchorProvider } from '@coral-xyz/anchor'
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getAccount, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { Transaction } from '@solana/web3.js'
import {
  ASSETS, EXPLORER, IS_TESTNET,
  getProgram, getVaultPDA, getPutMintPDA, getSafeMintPDA,
  getReserveAccount, getUserPositionPDA,
  fetchVaultState, getTokenBalance, toBaseUnits,
} from '../lib/vault'

type ExitSource = 'put' | 'free'

export function Exit() {
  const { connection } = useConnection()
  const wallet         = useWallet()
  const anchorWallet   = useAnchorWallet()

  const [source,      setSource]      = useState<ExitSource>('put')
  const [amount,      setAmount]      = useState('')
  const [loading,     setLoading]     = useState(false)
  const [txSig,       setTxSig]       = useState('')
  const [error,       setError]       = useState('')
  const [putBalance,  setPutBalance]  = useState(0)
  const [safeBalance, setSafeBalance] = useState(0)
  const [totalFree,   setTotalFree]   = useState(0)
  const [showConfirm, setShowConfirm] = useState(false)

  const numAmt = parseFloat(amount) || 0
  const maxBal = source === 'put' ? putBalance : safeBalance

  const load = async () => {
    if (!wallet.publicKey) return
    const putMint  = getPutMintPDA()
    const safeMint = getSafeMintPDA()
    const [put, safe, state] = await Promise.all([
      getTokenBalance(connection, wallet.publicKey, putMint),
      getTokenBalance(connection, wallet.publicKey, safeMint),
      fetchVaultState(connection),
    ])
    setPutBalance(put)
    setSafeBalance(safe)
    if (state) setTotalFree(state.totalX1safePutSupply / 1e9)
  }

  useEffect(() => { load() }, [wallet.publicKey, connection, txSig])

  // Build remaining accounts for exit (create missing ATAs first)
  const buildRemainingAccounts = async () => {
    const remaining: { pubkey: import('@solana/web3.js').PublicKey; isWritable: boolean; isSigner: boolean }[] = []
    for (const a of ASSETS) {
      const reserveAcct = getReserveAccount(a.mint)
      const userAta     = await getAssociatedTokenAddress(a.mint, wallet.publicKey!, false, TOKEN_PROGRAM_ID)
      try { await getAccount(connection, userAta, undefined, TOKEN_PROGRAM_ID) } catch {
        const tx = new Transaction()
        tx.add(createAssociatedTokenAccountInstruction(wallet.publicKey!, userAta, wallet.publicKey!, a.mint, TOKEN_PROGRAM_ID))
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
        tx.feePayer = wallet.publicKey!
        const signed = await wallet.signTransaction!(tx)
        await connection.confirmTransaction(await connection.sendRawTransaction(signed.serialize()), 'confirmed')
      }
      remaining.push({ pubkey: reserveAcct, isWritable: true, isSigner: false })
      remaining.push({ pubkey: userAta,     isWritable: true, isSigner: false })
    }
    return remaining
  }

  // Exit from X1SAFE_FREE directly
  const handleExitFREE = async () => {
    if (!wallet.publicKey || !anchorWallet || !amount) return
    setLoading(true); setError(''); setTxSig('')
    try {
      const provider    = new AnchorProvider(connection, anchorWallet, { commitment: 'confirmed' })
      const program     = getProgram(provider)
      const vault       = getVaultPDA()
      const safeMint    = getSafeMintPDA()
      const userSafeAta = await getAssociatedTokenAddress(safeMint, wallet.publicKey, false, TOKEN_PROGRAM_ID)
      const remaining   = await buildRemainingAccounts()

      const tx = await program.methods
        .exit(toBaseUnits(numAmt, 9))
        .accounts({ user: wallet.publicKey, vault, safeMint, userSafeAccount: userSafeAta })
        .remainingAccounts(remaining)
        .rpc()

      setTxSig(tx); setAmount(''); setShowConfirm(false)
    } catch (e: any) {
      setError(e?.message || 'Transaction failed')
    } finally { setLoading(false) }
  }

  // Exit from PUT: withdraw (PUT→FREE) + exit (FREE→collateral) in 1 tx
  const handleExitPUT = async () => {
    if (!wallet.publicKey || !wallet.signTransaction || !anchorWallet || !amount) return
    setLoading(true); setError(''); setTxSig('')
    try {
      const provider    = new AnchorProvider(connection, anchorWallet, { commitment: 'confirmed' })
      const program     = getProgram(provider)
      const vault       = getVaultPDA()
      const putMint     = getPutMintPDA()
      const safeMint    = getSafeMintPDA()
      const userPos     = getUserPositionPDA(wallet.publicKey)
      const userPutAta  = await getAssociatedTokenAddress(putMint,  wallet.publicKey, false, TOKEN_PROGRAM_ID)
      const userSafeAta = await getAssociatedTokenAddress(safeMint, wallet.publicKey, false, TOKEN_PROGRAM_ID)
      const remaining   = await buildRemainingAccounts()
      const amountBN    = toBaseUnits(numAmt, 9)

      const tx = new Transaction()

      // Create X1SAFE_FREE ATA if needed (intermediate holding account)
      try { await getAccount(connection, userSafeAta, undefined, TOKEN_PROGRAM_ID) } catch {
        tx.add(createAssociatedTokenAccountInstruction(
          wallet.publicKey, userSafeAta, wallet.publicKey, safeMint, TOKEN_PROGRAM_ID
        ))
      }

      // Ix 1: withdraw PUT → X1SAFE FREE (burn PUT, mint FREE)
      tx.add(await program.methods
        .withdraw(amountBN)
        .accounts({
          user: wallet.publicKey, vault, putMint, safeMint,
          userPutAccount: userPutAta, userSafeAccount: userSafeAta,
          userPosition: userPos,
        })
        .instruction()
      )

      // Ix 2: exit X1SAFE FREE → proportional collateral (burn FREE, release reserves)
      tx.add(await program.methods
        .exit(amountBN)
        .accounts({ user: wallet.publicKey, vault, safeMint, userSafeAccount: userSafeAta })
        .remainingAccounts(remaining)
        .instruction()
      )

      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
      tx.feePayer = wallet.publicKey
      const signed = await wallet.signTransaction(tx)
      const sig    = await connection.sendRawTransaction(signed.serialize())
      await connection.confirmTransaction(sig, 'confirmed')
      setTxSig(sig); setAmount(''); setShowConfirm(false)
    } catch (e: any) {
      setError(e?.message || 'Transaction failed')
    } finally { setLoading(false) }
  }

  const estPct    = totalFree > 0 && numAmt > 0 ? ((numAmt / totalFree) * 100).toFixed(2) : '0'

  if (!wallet.connected) {
    return (
      <div className="tab-content">
        <div className="empty-state">
          <div className="empty-state-icon">⏏</div>
          <div className="empty-state-text">Connect Wallet to Exit</div>
          <div className="empty-state-sub">Connect your wallet to exit the vault.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="tab-content">

      <div style={{ marginBottom: 16 }}>
        <div className="page-title" style={{ fontSize: '1.15rem', fontWeight: 800 }}>Exit Vault</div>
        <div className="page-subtitle">Burn X1SAFE_PUT or X1SAFE → receive proportional collateral back</div>
      </div>

      {/* ── Warning ── */}
      <div className="info-box danger" style={{ marginBottom: 14, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ fontSize: '1rem', flexShrink: 0 }}>⚠️</span>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>This releases your collateral</div>
          <div style={{ fontSize: '0.78rem' }}>You will receive a proportional share of vault reserves (XNT, USDC.X). This action cannot be undone.</div>
        </div>
      </div>

      {/* ── Source selector ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        <button
          onClick={() => { setSource('put'); setAmount(''); setShowConfirm(false) }}
          style={{
            padding: '12px 14px', borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'left',
            border: `1.5px solid ${source === 'put' ? 'rgba(168,85,247,0.5)' : 'var(--border)'}`,
            background: source === 'put' ? 'rgba(168,85,247,0.06)' : 'var(--bg-elevated)',
            transition: 'all 0.15s',
          }}
        >
          <div style={{ fontSize: '0.62rem', color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            From X1SAFE_PUT
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: source === 'put' ? 'var(--xnt-color)' : 'var(--text)', letterSpacing: '-0.02em' }}>
            {putBalance.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.62rem', color: 'var(--text-3)', marginTop: 3 }}>Auto-unlocks + exits in 1 tx</div>
        </button>

        <button
          onClick={() => { setSource('free'); setAmount(''); setShowConfirm(false) }}
          style={{
            padding: '12px 14px', borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'left',
            border: `1.5px solid ${source === 'free' ? 'rgba(239,68,68,0.4)' : 'var(--border)'}`,
            background: source === 'free' ? 'rgba(239,68,68,0.04)' : 'var(--bg-elevated)',
            transition: 'all 0.15s',
          }}
        >
          <div style={{ fontSize: '0.62rem', color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            From X1SAFE (free)
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: source === 'free' ? 'var(--danger)' : 'var(--text)', letterSpacing: '-0.02em' }}>
            {safeBalance.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.62rem', color: 'var(--text-3)', marginTop: 3 }}>Direct exit</div>
        </button>
      </div>

      {/* ── Amount input ── */}
      <div className="amount-input-block" style={{ marginBottom: 14, borderColor: numAmt > 0 ? 'rgba(239,68,68,0.25)' : 'var(--border)' }}>
        <div className="amount-input-row">
          <input
            type="number"
            className="amount-input-big"
            placeholder="0.00"
            value={amount}
            min="0"
            step="any"
            onChange={e => { setAmount(e.target.value); setError(''); setTxSig(''); setShowConfirm(false) }}
            style={{ color: numAmt > 0 ? 'var(--danger)' : undefined }}
          />
          <div className="amount-input-asset" style={{ color: source === 'put' ? 'var(--xnt-color)' : 'var(--danger)' }}>
            {source === 'put' ? 'PUT' : 'X1SAFE'}
          </div>
        </div>
        <div className="amount-input-footer">
          <span className="amount-usd">{numAmt > 0 ? `~${estPct}% of vault reserves` : 'Enter amount'}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="amount-max-btn" style={{ color: 'var(--danger)' }}
              onClick={() => { setAmount((maxBal / 2).toFixed(6)); setShowConfirm(false) }} disabled={maxBal === 0}>HALF</button>
            <button className="amount-max-btn" style={{ color: 'var(--danger)' }}
              onClick={() => { setAmount(maxBal.toFixed(6)); setShowConfirm(false) }} disabled={maxBal === 0}>MAX</button>
          </div>
        </div>
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-3)' }}>
          <span>Balance</span>
          <span style={{ color: maxBal > 0 ? (source === 'put' ? 'var(--xnt-color)' : 'var(--danger)') : undefined, fontWeight: 600 }}>
            {maxBal.toFixed(4)} {source === 'put' ? 'PUT' : 'X1SAFE'}
          </span>
        </div>
      </div>

      {/* ── Conversion card ── */}
      {numAmt > 0 && (
        <div className="conversion-card" style={{ marginBottom: 14 }}>
          {source === 'put' && (
            <div className="conversion-row">
              <span className="label">🔓 Unlock (burn PUT)</span>
              <span className="value" style={{ color: 'var(--xnt-color)' }}>{numAmt.toFixed(4)} X1SAFE_PUT</span>
            </div>
          )}
          <div className="conversion-row">
            <span className="label">🔥 Burn X1SAFE</span>
            <span className="value" style={{ color: 'var(--danger)' }}>{numAmt.toFixed(4)} X1SAFE</span>
          </div>
          <div className="conversion-row">
            <span className="label">% of reserves</span>
            <span className="value">{estPct}%</span>
          </div>
          <div className="conversion-divider" />
          {ASSETS.filter(a => a.key === 'USDCX' || a.key === 'XNT').map(a => (
            <div key={a.key} className="conversion-row">
              <span className="label">→ {a.label}</span>
              <span className="value" style={{ color: 'var(--success)' }}>proportional share</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Warnings ── */}
      {source === 'put' && putBalance === 0 && (
        <div className="info-box warning" style={{ marginBottom: 14 }}>
          ⚠️ No X1SAFE_PUT — deposit collateral first.
        </div>
      )}
      {source === 'free' && safeBalance === 0 && (
        <div className="info-box warning" style={{ marginBottom: 14 }}>
          ⚠️ No X1SAFE (free) — withdraw from Withdraw tab first.
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
          <span>✅ Exit confirmed</span>
          <a href={`${EXPLORER}/tx/${txSig}`} target="_blank" rel="noopener noreferrer"
            style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--success)', textDecoration: 'none' }}>
            View ↗
          </a>
        </div>
      )}

      {/* ── Confirm step ── */}
      {showConfirm && numAmt > 0 && !error && (
        <div style={{ padding: '14px 16px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: 'var(--danger)', fontWeight: 500, marginBottom: 10 }}>
          ⚠️ Confirm exit {numAmt.toFixed(4)} {source === 'put' ? 'X1SAFE_PUT' : 'X1SAFE'} — cannot be undone
        </div>
      )}

      {/* ── Buttons ── */}
      {!showConfirm ? (
        <button
          className="btn btn-danger btn-full btn-lg"
          onClick={() => setShowConfirm(true)}
          disabled={!numAmt || numAmt > maxBal || maxBal === 0}
          style={{ fontWeight: 700 }}
        >
          Exit {numAmt > 0 ? `${numAmt.toFixed(4)} ${source === 'put' ? 'PUT' : 'X1SAFE'}` : ''}
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            className="btn btn-danger btn-full btn-lg"
            onClick={source === 'put' ? handleExitPUT : handleExitFREE}
            disabled={loading}
            style={{ fontWeight: 700 }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
                Processing…
              </span>
            ) : '✓ Confirm Exit'}
          </button>
          <button className="btn btn-secondary btn-full" onClick={() => setShowConfirm(false)} disabled={loading}>
            Cancel
          </button>
        </div>
      )}

      <div style={{ marginTop: 12, textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-3)' }}>
        {IS_TESTNET ? '🔶 Testnet' : '🟢 Mainnet'} · Proportional exit · {source === 'put' ? 'PUT→FREE→Collateral in 1 tx' : 'FREE→Collateral'}
      </div>

    </div>
  )
}
