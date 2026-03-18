import { useState, useEffect } from 'react'
import { useConnection, useWallet, useAnchorWallet } from '@solana/wallet-adapter-react'
import { AnchorProvider } from '@coral-xyz/anchor'
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getAccount } from '@solana/spl-token'
import { Transaction } from '@solana/web3.js'
import {
  EXPLORER, IS_TESTNET,
  getProgram, getVaultPDA, getPutMintPDA, getSafeMintPDA,
  getTokenBalance, toBaseUnits,
} from '../lib/vault'

export function Redeposit() {
  const { connection } = useConnection()
  const wallet         = useWallet()
  const anchorWallet   = useAnchorWallet()

  const [amount,      setAmount]      = useState('')
  const [loading,     setLoading]     = useState(false)
  const [txSig,       setTxSig]       = useState('')
  const [error,       setError]       = useState('')
  const [safeBalance, setSafeBalance] = useState(0)

  const numAmt = parseFloat(amount) || 0

  const load = async () => {
    if (!wallet.publicKey) return
    const bal = await getTokenBalance(connection, wallet.publicKey, getSafeMintPDA())
    setSafeBalance(bal)
  }

  useEffect(() => { load() }, [wallet.publicKey, connection, txSig])

  const handleRedeposit = async () => {
    if (!wallet.publicKey || !anchorWallet || !amount) return
    setLoading(true); setError(''); setTxSig('')
    try {
      const provider = new AnchorProvider(connection, anchorWallet, { commitment: 'confirmed' })
      const program  = getProgram(provider)
      const vault    = getVaultPDA()
      const putMint  = getPutMintPDA()
      const safeMint = getSafeMintPDA()

      const userSafeAccount = await getAssociatedTokenAddress(safeMint, wallet.publicKey)
      const userPutAta      = await getAssociatedTokenAddress(putMint, wallet.publicKey)

      // Ensure PUT ATA exists
      try { await getAccount(connection, userPutAta) } catch {
        const tx = new Transaction()
        tx.add(createAssociatedTokenAccountInstruction(wallet.publicKey, userPutAta, wallet.publicKey, putMint))
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
        tx.feePayer = wallet.publicKey
        const signed = await wallet.signTransaction!(tx)
        await connection.confirmTransaction(
          await connection.sendRawTransaction(signed.serialize()),
          'confirmed'
        )
      }

      const tx = await program.methods
        .redeposit(toBaseUnits(numAmt, 6))
        .accounts({
          user: wallet.publicKey,
          vault,
          safeMint,
          putMint,
          userSafeAccount,
          userPutAta,
        })
        .rpc()

      setTxSig(tx); setAmount('')
    } catch (e: any) {
      setError(e?.message || 'Transaction failed')
    } finally { setLoading(false) }
  }

  if (!wallet.connected) {
    return (
      <div style={{ maxWidth: 480, margin: '24px auto' }}>
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🔐</div>
            <div className="empty-state-title">Wallet not connected</div>
            <div className="empty-state-sub">Connect to re-lock X1SAFE as PUT.</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      <div style={{ marginBottom: 18 }}>
        <div className="page-title">Re-lock</div>
        <div className="page-subtitle">Burn X1SAFE (free) → re-lock as X1SAFE_PUT (1:1)</div>
      </div>

      <div className="info-box" style={{ marginBottom: 14, fontSize: '0.82rem' }}>
        Re-lock your free X1SAFE back into the vault as PUT. This re-asserts your direct collateral backing without changing the vault reserves.
      </div>

      <div style={{
        background: safeBalance > 0 ? 'linear-gradient(135deg, rgba(34,197,94,0.06) 0%, rgba(34,197,94,0.02) 100%)' : 'var(--bg-elevated)',
        border: `1px solid ${safeBalance > 0 ? 'rgba(34,197,94,0.14)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: '18px 20px',
        marginBottom: 14,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 4 }}>
            X1SAFE (Free) Balance
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.03em', color: safeBalance > 0 ? 'var(--success)' : 'var(--text-3)' }}>
            {safeBalance > 0 ? safeBalance.toFixed(2) : 'No X1SAFE'}
          </div>
        </div>
        {safeBalance > 0 && (
          <button className="btn btn-sm"
            style={{ background: 'rgba(34,197,94,0.08)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.2)' }}
            onClick={() => setAmount(safeBalance.toFixed(6))}>
            Max
          </button>
        )}
      </div>

      <div className="section-header">
        <span className="section-title">Amount to Re-lock</span>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
          Available: <strong style={{ color: 'var(--text-2)' }}>{safeBalance.toFixed(2)}</strong>
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
          <div className="amount-input-asset">X1SAFE</div>
        </div>
        <div className="amount-input-footer">
          <span className="amount-usd">{numAmt > 0 ? `→ ${numAmt.toFixed(4)} X1SAFE_PUT` : 'Enter amount'}</span>
          <button className="amount-max-btn" onClick={() => setAmount(safeBalance.toFixed(6))}>MAX</button>
        </div>
      </div>

      {numAmt > 0 && (
        <div className="conversion-card">
          <div className="conversion-row">
            <span className="label">Burn</span>
            <span className="value">{numAmt.toFixed(4)} X1SAFE (free)</span>
          </div>
          <div className="conversion-divider" />
          <div className="conversion-total">
            <span className="label">→ You receive</span>
            <span className="value">{numAmt.toFixed(4)} X1SAFE_PUT</span>
          </div>
        </div>
      )}

      {error && (
        <div className="tx-status error" style={{ marginBottom: 12 }}>
          <span>⚠</span> {error}
        </div>
      )}

      <button
        className="btn btn-primary btn-full btn-lg"
        onClick={handleRedeposit}
        disabled={loading || !amount || numAmt <= 0 || safeBalance <= 0}
      >
        {loading
          ? <><span className="loading" style={{ borderTopColor: '#000' }} /> Processing…</>
          : `Re-lock ${numAmt > 0 ? `${numAmt.toFixed(4)} X1SAFE → PUT` : ''}`}
      </button>

      {txSig && (
        <div className="tx-status success" style={{ marginTop: 12 }}>
          <span>✓</span>
          <span>Re-locked!{' '}
            <a href={`${EXPLORER}/tx/${txSig}`} target="_blank" rel="noopener" style={{ color: 'var(--success)', fontWeight: 700 }}>View tx ↗</a>
          </span>
        </div>
      )}

      <div className="program-footer" style={{ marginTop: 16 }}>
        <span>{IS_TESTNET ? '🔶 Testnet' : '🟢 Mainnet'}</span>
        <span>FREE → PUT (1:1)</span>
      </div>
    </div>
  )
}
