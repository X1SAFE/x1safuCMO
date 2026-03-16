import { useState, useEffect } from 'react'
import { useConnection, useWallet, useAnchorWallet } from '@solana/wallet-adapter-react'
import { AnchorProvider } from '@coral-xyz/anchor'
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getAccount } from '@solana/spl-token'
import { Transaction } from '@solana/web3.js'
import {
  ASSETS, EXPLORER, IS_TESTNET, PROGRAM_ID, X1SAFE_PER_USD,
  getProgram, getVaultPDA, getVaultTokenAccountPDA, getUserPositionPDA,
  getTokenBalance, fetchAssetPrices, calcX1SAFE, toBaseUnits,
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
  const [priceLoading, setPriceLoading] = useState(true)
  const [lastUpdated, setLastUpdated]   = useState('')

  const asset = ASSETS.find(a => a.key === assetKey)!

  const loadPrices = async () => {
    setPriceLoading(true)
    const p = await fetchAssetPrices()
    setPrices(p)
    setLastUpdated(new Date().toLocaleTimeString())
    setPriceLoading(false)
  }

  useEffect(() => {
    if (!wallet.publicKey) return
    const load = async () => {
      const result: Record<string, number> = {}
      for (const a of ASSETS) {
        result[a.key] = await getTokenBalance(connection, wallet.publicKey!, a.mint)
      }
      setBalances(result)
    }
    load()
  }, [wallet.publicKey, connection, txSig])

  useEffect(() => {
    loadPrices()
    const t = setInterval(loadPrices, 30000) // refresh every 30s
    return () => clearInterval(t)
  }, [])

  const assetPrice   = prices[assetKey] ?? 0
  const usdValue     = amount ? parseFloat(amount) * assetPrice : 0
  const x1safeAmount = amount ? calcX1SAFE(parseFloat(amount), assetPrice) : 0

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

      // Pre-create vault token ATA (authority = vault PDA) if needed
      const preTx = new Transaction()
      let needsPre = false
      try {
        await getAccount(connection, vaultTokenAccount)
      } catch {
        preTx.add(createAssociatedTokenAccountInstruction(wallet.publicKey, vaultTokenAccount, vault, asset.mint))
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
        .accounts({ user: wallet.publicKey, vault, userPosition, userTokenAccount, vaultTokenAccount })
        .rpc()

      setTxSig(tx)
      setAmount('')
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
            <div className="card-subtitle">Lock assets → receive X1SAFE tokens</div>
          </div>
        </div>

        {/* Rate info box */}
        <div className="info-box" style={{ borderColor: '#2563eb', background: 'rgba(37,99,235,0.08)' }}>
          <div className="info-box-title" style={{ color: '#60a5fa' }}>💡 X1SAFE Rate</div>
          <div className="info-box-text">
            <strong style={{ color: '#f1f5f9' }}>$1 USD = {X1SAFE_PER_USD} X1SAFE</strong>
            <span style={{ color: 'var(--text-muted)' }}> · 1 X1SAFE = $0.01</span>
            <br />
            <span style={{ fontSize: '0.8em', color: 'var(--text-muted)' }}>
              Oracle: xDEX Mainnet pool prices
              {lastUpdated && ` · Updated ${lastUpdated}`}
            </span>
          </div>
        </div>

        {/* Live price ticker */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
          {ASSETS.map(a => (
            <div key={a.key}
              onClick={() => setAssetKey(a.key)}
              style={{
                padding: '10px 8px',
                borderRadius: 10,
                background: assetKey === a.key ? 'rgba(37,99,235,0.15)' : 'var(--bg-secondary)',
                border: assetKey === a.key ? '1.5px solid #2563eb' : '1.5px solid transparent',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: '1.3rem' }}>{a.icon}</div>
              <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{a.label}</div>
              <div style={{ fontSize: '0.78rem', color: priceLoading ? 'var(--text-muted)' : '#22c55e', fontWeight: 600 }}>
                {priceLoading ? '...' : `$${(prices[a.key] || 0).toPrecision(4)}`}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                {balances[a.key] !== undefined ? balances[a.key].toFixed(3) : '—'} bal
              </div>
            </div>
          ))}
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
        </div>

        {/* Conversion preview */}
        {amount && parseFloat(amount) > 0 && (
          <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>USD Value</span>
              <span style={{ fontWeight: 700 }}>${usdValue.toFixed(4)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Rate</span>
              <span style={{ fontSize: '0.85rem' }}>1 {asset.label} = ${assetPrice.toPrecision(4)}</span>
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#22c55e', fontWeight: 700 }}>You receive</span>
              <span style={{ color: '#22c55e', fontWeight: 800, fontSize: '1.1rem' }}>
                {x1safeAmount.toFixed(2)} X1SAFE
              </span>
            </div>
          </div>
        )}

        {error && <div className="tx-status error">❌ {error}</div>}

        <button
          className="btn btn-primary btn-full"
          onClick={handleDeposit}
          disabled={!amount || parseFloat(amount) <= 0 || loading || assetPrice === 0}
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

        <div style={{ marginTop: 12, fontSize: '0.76rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          {IS_TESTNET ? '🔧 Testnet' : '🌐 Mainnet'} · {PROGRAM_ID.toBase58().slice(0, 8)}...
          {' · '}
          <button onClick={loadPrices} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.76rem', padding: 0 }}>
            🔄 Refresh prices
          </button>
        </div>
      </div>
    </div>
  )
}
