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

const ASSET_CLASSES: Record<string, string> = { USDCX: 'usdcx', XNT: 'xnt', XEN: 'xen', XNM: 'xnm' }
const ASSET_SHORT:   Record<string, string> = { USDCX: '$', XNT: 'X', XEN: 'E', XNM: 'N' }

export function Withdraw() {
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

  const asset    = ASSETS.find(a => a.key === assetKey)!
  const numAmt   = parseFloat(amount) || 0
  const posAmt   = position?.amount || 0

  useEffect(() => {
    if (!wallet.publicKey) return
    fetchUserPosition(connection, wallet.publicKey).then(pos => {
      setPosition(pos ? { amount: pos.amount / 1e6 } : null)
    })
  }, [wallet.publicKey, connection, txSig])

  const handleWithdraw = async () => {
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
      <div style={{ maxWidth: 480, margin: '24px auto' }}>
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🔐</div>
            <div className="empty-state-title">Wallet not connected</div>
            <div className="empty-state-sub">Connect your wallet to withdraw assets from the vault.</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      {/* ── Page header ── */}
      <div style={{ marginBottom: 18 }}>
        <div className="page-title">Withdraw</div>
        <div className="page-subtitle">Redeem your deposited assets from the vault</div>
      </div>

      {/* ── Position banner ── */}
      <div style={{
        background: posAmt > 0
          ? 'linear-gradient(135deg, rgba(34,197,94,0.06) 0%, rgba(34,197,94,0.02) 100%)'
          : 'var(--bg-elevated)',
        border: `1px solid ${posAmt > 0 ? 'rgba(34,197,94,0.14)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: '18px 20px',
        marginBottom: 14,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 4 }}>
            Your Position
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.03em', color: posAmt > 0 ? 'var(--success)' : 'var(--text-3)' }}>
            {posAmt > 0 ? `$${posAmt.toFixed(2)}` : 'No position'}
          </div>
          {posAmt > 0 && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-2)', marginTop: 2 }}>
              USD value in vault
            </div>
          )}
        </div>
        {posAmt > 0 && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Available</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--success)' }}>${posAmt.toFixed(2)}</div>
          </div>
        )}
      </div>

      {/* ── Receive asset selector ── */}
      <div className="section-header">
        <span className="section-title">Receive As</span>
      </div>

      <div className="asset-grid" style={{ marginBottom: 14 }}>
        {ASSETS.map(a => {
          const cls = ASSET_CLASSES[a.key] || 'usdcx'
          const shortIcon = ASSET_SHORT[a.key] || a.label[0]
          return (
            <button
              key={a.key}
              className={`asset-card ${cls}${assetKey === a.key ? ' selected' : ''}`}
              onClick={() => setAssetKey(a.key)}
              style={{ minHeight: 70 }}
            >
              <div className="asset-card-icon">{shortIcon}</div>
              <div className="asset-card-symbol">{a.label}</div>
            </button>
          )
        })}
      </div>

      {/* ── Amount input ── */}
      <div className="section-header">
        <span className="section-title">Amount to Withdraw</span>
        {posAmt > 0 && (
          <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
            Max: <strong style={{ color: 'var(--text-2)' }}>${posAmt.toFixed(2)}</strong>
          </span>
        )}
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
          <div className="amount-input-asset">
            <span style={{ fontSize: '0.78rem' }}>{ASSET_SHORT[assetKey]}</span>
            {asset.label}
          </div>
        </div>
        <div className="amount-input-footer">
          <span className="amount-usd">
            {numAmt > 0 ? `Withdrawing ${numAmt.toFixed(4)} ${asset.label}` : 'Enter amount'}
          </span>
          <button
            className="amount-max-btn"
            onClick={() => setAmount(posAmt.toFixed(6))}
          >
            MAX
          </button>
        </div>
      </div>

      {/* ── Summary ── */}
      {numAmt > 0 && (
        <div className="preview-box" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--text-2)' }}>Withdraw</span>
            <span style={{ fontWeight: 600 }}>{numAmt.toFixed(4)} {asset.label}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--text-2)' }}>Remaining position</span>
            <span style={{ fontWeight: 600 }}>${Math.max(0, posAmt - numAmt).toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* ── Warning ── */}
      <div className="info-box warning" style={{ marginBottom: 14 }}>
        Withdrawing returns your deposited assets and reduces your vault position.
      </div>

      {/* ── Action ── */}
      {error && (
        <div className="tx-status error" style={{ marginBottom: 12 }}>
          <span>⚠</span> {error}
        </div>
      )}

      {!showConfirm ? (
        <button
          className="btn btn-primary btn-full btn-lg"
          onClick={() => setShowConfirm(true)}
          disabled={!amount || numAmt <= 0 || !position}
        >
          Withdraw {numAmt > 0 ? `${numAmt.toFixed(4)} ${asset.label}` : ''}
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ padding: '14px 16px', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.18)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: 'var(--warning)', fontWeight: 500 }}>
            Confirm: withdraw {numAmt.toFixed(4)} {asset.label}?
          </div>
          <button className="btn btn-primary btn-full" onClick={handleWithdraw} disabled={loading}>
            {loading ? <><span className="loading" style={{ borderTopColor: '#000' }} /> Processing…</> : '✓ Confirm Withdraw'}
          </button>
          <button className="btn btn-secondary btn-full" onClick={() => setShowConfirm(false)} disabled={loading}>
            Cancel
          </button>
        </div>
      )}

      {txSig && (
        <div className="tx-status success" style={{ marginTop: 12 }}>
          <span>✓</span>
          <span>
            Withdrawn successfully!{' '}
            <a href={`${EXPLORER}/tx/${txSig}`} target="_blank" rel="noopener" style={{ color: 'var(--success)', fontWeight: 700 }}>
              View tx ↗
            </a>
          </span>
        </div>
      )}

      <div className="program-footer" style={{ marginTop: 16 }}>
        <span>{IS_TESTNET ? '🔶 Testnet' : '🟢 Mainnet'}</span>
        <span>Vault withdraw</span>
      </div>
    </div>
  )
}
