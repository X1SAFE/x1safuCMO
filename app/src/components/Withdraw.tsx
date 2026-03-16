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

export function Withdraw() {
  const { connection } = useConnection()
  const wallet         = useWallet()
  const anchorWallet   = useAnchorWallet()

  const [amount, setAmount]         = useState('')
  const [assetKey, setAssetKey]     = useState('USDCX')
  const [loading, setLoading]       = useState(false)
  const [txSig, setTxSig]           = useState('')
  const [error, setError]           = useState('')
  const [position, setPosition]     = useState<{ amount: number } | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  const asset = ASSETS.find(a => a.key === assetKey)!

  useEffect(() => {
    if (!wallet.publicKey) return
    fetchUserPosition(connection, wallet.publicKey).then(pos => {
      setPosition(pos ? { amount: pos.amount / 1e6 } : null)
    })
  }, [wallet.publicKey, connection, txSig])

  const handleWithdraw = async () => {
    if (!wallet.publicKey || !anchorWallet || !amount) return
    setLoading(true)
    setError('')
    setTxSig('')

    try {
      const provider = new AnchorProvider(connection, anchorWallet, { commitment: 'confirmed' })
      const program  = getProgram(provider)

      const vault             = getVaultPDA()
      const userPosition      = getUserPositionPDA(wallet.publicKey)
      const userTokenAccount  = await getAssociatedTokenAddress(asset.mint, wallet.publicKey)
      const vaultTokenAccount = getVaultTokenAccountPDA(asset.mint)

      // Pre-create user ATA if needed
      try {
        await getAccount(connection, userTokenAccount)
      } catch {
        const preTx = new Transaction()
        preTx.add(createAssociatedTokenAccountInstruction(wallet.publicKey, userTokenAccount, wallet.publicKey, asset.mint))
        preTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
        preTx.feePayer = wallet.publicKey
        const signed = await wallet.signTransaction!(preTx)
        await connection.sendRawTransaction(signed.serialize())
        await new Promise(r => setTimeout(r, 2000))
      }

      const amountBN = toBaseUnits(parseFloat(amount), asset.decimals)

      const tx = await program.methods
        .withdraw(amountBN)
        .accounts({
          user: wallet.publicKey,
          vault,
          userPosition,
          userTokenAccount,
          vaultTokenAccount,
        })
        .rpc()

      setTxSig(tx)
      setAmount('')
      setShowConfirm(false)
    } catch (e: any) {
      setError(e?.message || 'Transaction failed')
    } finally {
      setLoading(false)
    }
  }

  if (!wallet.connected) {
    return (
      <div className="card" style={{ maxWidth: 480, margin: '40px auto', textAlign: 'center', padding: '40px' }}>
        <div style={{ fontSize: '2rem', marginBottom: 12 }}>🔐</div>
        <div style={{ color: 'var(--text-secondary)' }}>Connect wallet to withdraw</div>
      </div>
    )
  }

  return (
    <div className="withdraw">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">🔄 Withdraw Assets</div>
            <div className="card-subtitle">Reclaim your deposited collateral</div>
          </div>
        </div>

        <div className="info-box warning">
          <div className="info-box-title">⚠️ Note</div>
          <div className="info-box-text">
            Withdraw transfers your deposited assets back to your wallet.
            Your position will be reduced accordingly.
          </div>
        </div>

        {/* Position display */}
        <div className="position-card" style={{ marginBottom: 20 }}>
          <div className="position-row">
            <span className="position-label">Your Position (USD)</span>
            <span className="position-value">
              {position ? `$${position.amount.toFixed(2)}` : 'No position'}
            </span>
          </div>
        </div>

        {/* Asset selector */}
        <div className="form-group">
          <label className="form-label">Receive Asset</label>
          <div className="asset-grid">
            {ASSETS.map(a => (
              <div
                key={a.key}
                className={`asset-option ${assetKey === a.key ? 'selected' : ''}`}
                onClick={() => setAssetKey(a.key)}
              >
                <div className="asset-icon">{a.icon}</div>
                <div className="asset-name">{a.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Amount */}
        <div className="form-group">
          <label className="form-label">Amount ({asset.label})</label>
          <div style={{ position: 'relative' }}>
            <input
              type="number"
              className="form-input"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
            <button
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700 }}
              onClick={() => setAmount((position?.amount || 0).toFixed(6))}
            >MAX</button>
          </div>
        </div>

        {error && <div className="tx-status error">❌ {error}</div>}

        {!showConfirm ? (
          <button
            className="btn btn-secondary btn-full"
            onClick={() => setShowConfirm(true)}
            disabled={!amount || parseFloat(amount) <= 0 || !position}
          >
            Continue
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="info-box">
              <div className="info-box-title">Withdraw {amount} {asset.label}?</div>
            </div>
            <button className="btn btn-secondary btn-full" onClick={handleWithdraw} disabled={loading}>
              {loading ? <><span className="loading" /> Withdrawing...</> : 'Confirm Withdraw'}
            </button>
            <button className="btn btn-secondary btn-full" onClick={() => setShowConfirm(false)} disabled={loading}>
              Cancel
            </button>
          </div>
        )}

        {txSig && (
          <div className="tx-status success">
            ✅ Withdrawn!{' '}
            <a href={`${EXPLORER}/tx/${txSig}`} target="_blank" rel="noopener" style={{ color: 'var(--primary)' }}>
              View Tx ↗
            </a>
          </div>
        )}

        <div style={{ marginTop: 16, fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          {IS_TESTNET ? '🔧 Testnet' : '🌐 Mainnet'}
        </div>
      </div>
    </div>
  )
}
