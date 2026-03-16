import { useState, useEffect } from 'react'
import { useConnection, useWallet, useAnchorWallet } from '@solana/wallet-adapter-react'
import { AnchorProvider } from '@coral-xyz/anchor'
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getAccount } from '@solana/spl-token'
import { Transaction } from '@solana/web3.js'
import {
  ASSETS, EXPLORER, IS_TESTNET, PROGRAM_ID,
  getProgram, getVaultPDA, getVaultTokenAccountPDA, getUserPositionPDA,
  getTokenBalance, fetchAssetPrices, toBaseUnits,
} from '../lib/vault'

export function Deposit() {
  const { connection }  = useConnection()
  const wallet          = useWallet()
  const anchorWallet    = useAnchorWallet()

  const [amount, setAmount]     = useState('')
  const [assetKey, setAssetKey] = useState('USDCX')
  const [loading, setLoading]   = useState(false)
  const [txSig, setTxSig]       = useState('')
  const [error, setError]       = useState('')
  const [balances, setBalances] = useState<Record<string, number>>({})
  const [prices, setPrices]     = useState<Record<string, number>>({ USDCX: 1.0 })

  const asset = ASSETS.find(a => a.key === assetKey)!

  // Fetch balances + prices
  useEffect(() => {
    if (!wallet.publicKey) return
    const load = async () => {
      const result: Record<string, number> = {}
      for (const a of ASSETS) {
        result[a.key] = await getTokenBalance(connection, wallet.publicKey!, a.mint)
      }
      setBalances(result)
      const p = await fetchAssetPrices()
      if (Object.keys(p).length > 0) setPrices(p)
    }
    load()
  }, [wallet.publicKey, connection, txSig])

  const assetPrice     = prices[assetKey] ?? asset.price ?? 0
  const estimatedValue = amount ? (parseFloat(amount) * assetPrice).toFixed(2) : '0.00'

  const handleDeposit = async () => {
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

      // Pre-create vaultTokenAccount as ATA if needed
      const preTx = new Transaction()
      let needsPre = false

      try {
        await getAccount(connection, vaultTokenAccount)
      } catch {
        // vault token account needs init — vault PDA is authority
        preTx.add(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            vaultTokenAccount,
            vault,
            asset.mint
          )
        )
        needsPre = true
      }

      if (needsPre) {
        preTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
        preTx.feePayer = wallet.publicKey
        const signed = await wallet.signTransaction!(preTx)
        await connection.sendRawTransaction(signed.serialize())
        await new Promise(r => setTimeout(r, 2500))
      }

      const amountBN = toBaseUnits(parseFloat(amount), asset.decimals)

      const tx = await program.methods
        .deposit(amountBN)
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
    } catch (e: any) {
      const msg = e?.message || 'Transaction failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (!wallet.connected) {
    return (
      <div className="card" style={{ maxWidth: 480, margin: '40px auto', textAlign: 'center', padding: '40px' }}>
        <div style={{ fontSize: '2rem', marginBottom: 12 }}>🔐</div>
        <div style={{ color: 'var(--text-secondary)' }}>Connect wallet to deposit</div>
      </div>
    )
  }

  return (
    <div className="deposit">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">⬇️ Deposit Assets</div>
            <div className="card-subtitle">Lock assets in vault · 1:1 USD value recorded</div>
          </div>
        </div>

        <div className="info-box">
          <div className="info-box-title">ℹ️ How it works</div>
          <div className="info-box-text">
            Deposit USDC.X, XNT, or XEN → your position is recorded on-chain.
            Use <strong>Withdraw</strong> to reclaim your assets at any time.
          </div>
        </div>

        {/* Asset selector */}
        <div className="form-group">
          <label className="form-label">Select Asset</label>
          <div className="asset-grid">
            {ASSETS.map(a => (
              <div
                key={a.key}
                className={`asset-option ${assetKey === a.key ? 'selected' : ''}`}
                onClick={() => setAssetKey(a.key)}
              >
                <div className="asset-icon">{a.icon}</div>
                <div className="asset-name">{a.label}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  {balances[a.key] !== undefined ? balances[a.key].toFixed(4) : '—'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Amount input */}
        <div className="form-group">
          <label className="form-label">Amount ({asset.label})</label>
          <div style={{ position: 'relative' }}>
            <input
              type="number"
              className="form-input"
              placeholder="0.00"
              value={amount}
              min="0"
              onChange={e => setAmount(e.target.value)}
            />
            <button
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700 }}
              onClick={() => setAmount((balances[assetKey] || 0).toFixed(6))}
            >MAX</button>
          </div>
          <div style={{ marginTop: 6, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Wallet: {(balances[assetKey] || 0).toFixed(4)} {asset.label}
          </div>
        </div>

        {/* Estimate */}
        <div className="form-group">
          <label className="form-label">USD Value (estimated)</label>
          <input type="text" className="form-input" value={`$${estimatedValue}`} disabled style={{ opacity: 0.7 }} />
          <div style={{ marginTop: 6, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            1 {asset.label} ≈ ${assetPrice > 0 ? assetPrice.toFixed(4) : 'loading...'} · oracle: xDEX
          </div>
        </div>

        {error && <div className="tx-status error">❌ {error}</div>}

        <button
          className="btn btn-primary btn-full"
          onClick={handleDeposit}
          disabled={!amount || parseFloat(amount) <= 0 || loading}
        >
          {loading ? <><span className="loading" /> Processing...</> : '⬇️ Deposit'}
        </button>

        {txSig && (
          <div className="tx-status success">
            ✅ Deposited!{' '}
            <a href={`${EXPLORER}/tx/${txSig}`} target="_blank" rel="noopener" style={{ color: 'var(--primary)' }}>
              View Tx ↗
            </a>
          </div>
        )}

        <div style={{ marginTop: 16, fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          {IS_TESTNET ? '🔧 Testnet' : '🌐 Mainnet'} · {PROGRAM_ID.toBase58().slice(0, 8)}...
        </div>
      </div>
    </div>
  )
}
