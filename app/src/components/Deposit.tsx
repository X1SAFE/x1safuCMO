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

  const [amount,       setAmount]       = useState('')
  const [assetKey,     setAssetKey]     = useState('USDCX')
  const [loading,      setLoading]      = useState(false)
  const [txSig,        setTxSig]        = useState('')
  const [error,        setError]        = useState('')
  const [balances,     setBalances]     = useState<Record<string, number>>({})
  const [prices,       setPrices]       = useState<Record<string, number>>({ USDCX: 1.0 })
  const [priceLoading, setPriceLoading] = useState(true)
  const [lastUpdated,  setLastUpdated]  = useState('')

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
      for (const a of ASSETS) result[a.key] = await getTokenBalance(connection, wallet.publicKey!, a.mint)
      setBalances(result)
    }
    load()
  }, [wallet.publicKey, connection, txSig])

  useEffect(() => {
    loadPrices()
    const t = setInterval(loadPrices, 30000)
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

      const preTx = new Transaction()
      let needsPre = false
      try { await getAccount(connection, vaultTokenAccount) } catch {
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
      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 14 }}>Deposit</div>

      {/* ── Asset selector ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 18 }}>
        {ASSETS.map(a => (
          <button
            key={a.key}
            className={`asset-chip${assetKey === a.key ? ' selected' : ''}`}
            onClick={() => setAssetKey(a.key)}
          >
            <span style={{ fontSize: '1.2rem' }}>{a.icon}</span>
            <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>{a.label}</span>
            <span style={{ fontSize: '0.7rem', color: priceLoading ? 'var(--text-3)' : 'var(--success)', fontWeight: 600 }}>
              {priceLoading ? '…' : `$${(prices[a.key] || 0).toPrecision(3)}`}
            </span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>
              {balances[a.key] !== undefined ? `${balances[a.key].toFixed(2)} bal` : '—'}
            </span>
          </button>
        ))}
      </div>

      {/* ── Amount ── */}
      <div className="card">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Amount ({asset.label})</label>
          <div style={{ position: 'relative' }}>
            <input
              type="number"
              className="form-input"
              placeholder="0.00"
              value={amount}
              min="0"
              onChange={e => setAmount(e.target.value)}
              style={{ paddingRight: 52 }}
            />
            <button
              onClick={() => setAmount((balances[assetKey] || 0).toFixed(6))}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700, fontFamily: 'inherit', padding: '2px 4px' }}
            >
              MAX
            </button>
          </div>
        </div>

        {/* ── Preview ── */}
        {amount && parseFloat(amount) > 0 && (
          <div className="preview-box" style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--text-2)' }}>USD value</span>
              <span style={{ fontWeight: 600 }}>${usdValue.toFixed(4)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.8rem' }}>
              <span style={{ color: 'var(--text-2)' }}>Rate</span>
              <span>1 {asset.label} = ${assetPrice.toPrecision(4)}</span>
            </div>
            <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ fontWeight: 600 }}>You receive</span>
              <span style={{ fontWeight: 700, color: 'var(--success)' }}>
                {x1safeAmount.toFixed(2)} X1SAFE
              </span>
            </div>
          </div>
        )}

        {/* ── Rate note ── */}
        <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: 10, display: 'flex', justifyContent: 'space-between' }}>
          <span>$1 USD = {X1SAFE_PER_USD} X1SAFE</span>
          <button onClick={loadPrices} style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: '0.72rem', fontFamily: 'inherit', padding: 0 }}>
            ↻ Refresh{lastUpdated && ` · ${lastUpdated}`}
          </button>
        </div>
      </div>

      {/* ── Action ── */}
      <div style={{ marginTop: 12 }}>
        {error && <div className="tx-status error" style={{ marginBottom: 10 }}>{error}</div>}
        <button
          className="btn btn-primary btn-full"
          onClick={handleDeposit}
          disabled={!amount || parseFloat(amount) <= 0 || loading || assetPrice === 0}
        >
          {loading ? <><span className="loading" /> Processing…</> : 'Deposit'}
        </button>
        {txSig && (
          <div className="tx-status success" style={{ marginTop: 10 }}>
            Deposited!{' '}
            <a href={`${EXPLORER}/tx/${txSig}`} target="_blank" rel="noopener" style={{ color: 'var(--success)', fontWeight: 700 }}>
              View tx ↗
            </a>
          </div>
        )}
      </div>

      <div style={{ marginTop: 14, fontSize: '0.7rem', color: 'var(--text-3)', textAlign: 'center' }}>
        {IS_TESTNET ? 'Testnet' : 'Mainnet'} · {PROGRAM_ID.toBase58().slice(0, 8)}…
      </div>
    </div>
  )
}
