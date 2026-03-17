import { useState, useEffect } from 'react'
import { useConnection, useWallet, useAnchorWallet } from '@solana/wallet-adapter-react'
import { AnchorProvider } from '@coral-xyz/anchor'
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getAccount } from '@solana/spl-token'
import { Transaction } from '@solana/web3.js'
import {
  ASSETS, EXPLORER, IS_TESTNET,
  getProgram, getVaultPDA, getVaultTokenAccountPDA, getUserPositionPDA,
  fetchUserPosition, toBaseUnits,
} from '../lib/vault'

export function Exit() {
  const { connection } = useConnection()
  const wallet         = useWallet()
  const anchorWallet   = useAnchorWallet()

  const [amount,      setAmount]      = useState('')
  const [assetKey,    setAssetKey]    = useState('USDCX')
  const [loading,     setLoading]     = useState(false)
  const [txSig,       setTxSig]       = useState('')
  const [error,       setError]       = useState('')
  const [position,    setPosition]    = useState<{ amount: number } | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  const asset = ASSETS.find(a => a.key === assetKey)!

  useEffect(() => {
    if (!wallet.publicKey) return
    fetchUserPosition(connection, wallet.publicKey).then(pos => {
      setPosition(pos ? { amount: pos.amount / 1e6 } : null)
    })
  }, [wallet.publicKey, connection, txSig])

  const handleExit = async () => {
    if (!wallet.publicKey || !anchorWallet || !amount) return
    setLoading(true); setError(''); setTxSig('')
    try {
      const provider       = new AnchorProvider(connection, anchorWallet, { commitment: 'confirmed' })
      const program        = getProgram(provider)
      const vault          = getVaultPDA()
      const userPosition   = getUserPositionPDA(wallet.publicKey)
      const userTokenAcct  = await getAssociatedTokenAddress(asset.mint, wallet.publicKey)
      const vaultTokenAcct = getVaultTokenAccountPDA(asset.mint)

      try { await getAccount(connection, userTokenAcct) } catch {
        const preTx = new Transaction()
        preTx.add(createAssociatedTokenAccountInstruction(wallet.publicKey, userTokenAcct, wallet.publicKey, asset.mint))
        preTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
        preTx.feePayer = wallet.publicKey
        const signed = await wallet.signTransaction!(preTx)
        await connection.sendRawTransaction(signed.serialize())
        await new Promise(r => setTimeout(r, 2000))
      }

      const tx = await program.methods
        .withdraw(toBaseUnits(parseFloat(amount), asset.decimals))
        .accounts({ user: wallet.publicKey, vault, userPosition, userTokenAccount: userTokenAcct, vaultTokenAccount: vaultTokenAcct })
        .rpc()

      setTxSig(tx); setAmount(''); setShowConfirm(false)
    } catch (e: any) {
      setError(e?.message || 'Transaction failed')
    } finally { setLoading(false) }
  }

  if (!wallet.connected) {
    return (
      <div style={{ maxWidth: 440, margin: '32px auto', textAlign: 'center' }}>
        <div className="card" style={{ padding: '36px 20px' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-2)', marginBottom: 4 }}>Wallet not connected</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>Go to Connect tab to get started</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 440, margin: '0 auto' }}>
      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 14 }}>Exit Position</div>

      {/* Position */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>Your position (USD)</span>
          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: position ? 'var(--danger)' : 'var(--text-3)' }}>
            {position ? `$${position.amount.toFixed(2)}` : 'No position'}
          </span>
        </div>
      </div>

      <div className="card">
        {/* Receive asset */}
        <div className="form-group">
          <label className="form-label">Receive asset</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {ASSETS.map(a => (
              <button
                key={a.key}
                className={`asset-chip${assetKey === a.key ? ' selected' : ''}`}
                onClick={() => setAssetKey(a.key)}
              >
                <span style={{ fontSize: '1.2rem' }}>{a.icon}</span>
                <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>{a.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Amount */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Amount ({asset.label})</label>
          <div style={{ position: 'relative' }}>
            <input
              type="number"
              className="form-input"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={{ paddingRight: 52 }}
            />
            <button
              onClick={() => setAmount((position?.amount || 0).toFixed(6))}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, fontFamily: 'inherit', padding: '2px 4px' }}
            >MAX</button>
          </div>
        </div>
      </div>

      {/* Danger note */}
      <div style={{ padding: '10px 14px', background: 'var(--danger-dim)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: 'var(--danger)', marginTop: 10 }}>
        Full exit withdraws your collateral and closes your position.
      </div>

      {/* Action */}
      <div style={{ marginTop: 12 }}>
        {error && <div className="tx-status error" style={{ marginBottom: 10 }}>{error}</div>}

        {!showConfirm ? (
          <button
            className="btn btn-full"
            style={{ background: 'var(--danger)', color: '#fff', borderRadius: 'var(--radius-sm)', padding: '10px 18px', fontWeight: 600, fontSize: '0.875rem', border: 'none', cursor: (!amount || parseFloat(amount) <= 0 || !position) ? 'not-allowed' : 'pointer', opacity: (!amount || parseFloat(amount) <= 0 || !position) ? 0.4 : 1 }}
            onClick={() => setShowConfirm(true)}
            disabled={!amount || parseFloat(amount) <= 0 || !position}
          >
            Exit position
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ padding: '10px 14px', background: 'var(--danger-dim)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: 'var(--danger)' }}>
              Exit {amount} {asset.label}? This cannot be undone.
            </div>
            <button
              className="btn btn-full"
              style={{ background: 'var(--danger)', color: '#fff', borderRadius: 'var(--radius-sm)', padding: '10px 18px', fontWeight: 600, fontSize: '0.875rem', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}
              onClick={handleExit}
              disabled={loading}
            >
              {loading ? <><span className="loading" style={{ borderTopColor: '#fff' }} /> Processing…</> : 'Confirm exit'}
            </button>
            <button className="btn btn-secondary btn-full" onClick={() => setShowConfirm(false)} disabled={loading}>
              Cancel
            </button>
          </div>
        )}

        {txSig && (
          <div className="tx-status success" style={{ marginTop: 10 }}>
            Exit successful!{' '}
            <a href={`${EXPLORER}/tx/${txSig}`} target="_blank" rel="noopener" style={{ color: 'var(--success)', fontWeight: 700 }}>
              View tx ↗
            </a>
          </div>
        )}
      </div>

      <div style={{ marginTop: 14, fontSize: '0.7rem', color: 'var(--text-3)', textAlign: 'center' }}>
        {IS_TESTNET ? 'Testnet' : 'Mainnet'}
      </div>
    </div>
  )
}
