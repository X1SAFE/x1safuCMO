import { useState, useEffect } from 'react'
import { useConnection, useWallet, useAnchorWallet } from '@solana/wallet-adapter-react'
import { AnchorProvider } from '@coral-xyz/anchor'
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from '@solana/spl-token'
import { Transaction } from '@solana/web3.js'
import {
  ASSETS, EXPLORER, IS_TESTNET, X1SAFE_PER_USD,
  getProgram, getVaultPDA, getAssetConfigPDA, getReserveAccount,
  getPutMintPDA, getUserPositionPDA,
  getTokenBalance, fetchAssetPrices, calcX1SAFE, toBaseUnits,
} from '../lib/vault'

const ASSET_CLASSES: Record<string, string> = { USDCX: 'usdcx', XNT: 'xnt', XEN: 'xen' }
const ASSET_SHORT:   Record<string, string> = { USDCX: '$', XNT: 'X', XEN: 'E' }
const ASSET_NAMES:   Record<string, string> = { USDCX: 'USD Coin (X1)', XNT: 'XNT Token', XEN: 'XEN Token' }

export function Deposit() {
  const { connection } = useConnection()
  const wallet         = useWallet()
  const anchorWallet   = useAnchorWallet()

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
  const numAmount    = parseFloat(amount) || 0

  const handleDeposit = async () => {
    if (!wallet.publicKey || !anchorWallet || !amount) return
    setLoading(true); setError(''); setTxSig('')
    try {
      const provider       = new AnchorProvider(connection, anchorWallet, { commitment: 'confirmed' })
      const program        = getProgram(provider)
      const vault          = getVaultPDA()
      const assetConfig    = getAssetConfigPDA(asset.mint)
      const reserveAccount = getReserveAccount(asset.mint)
      const putMint        = getPutMintPDA()
      const userPosition   = getUserPositionPDA(wallet.publicKey)

      const userAssetAccount = await getAssociatedTokenAddress(asset.mint, wallet.publicKey)
      const userPutAta       = await getAssociatedTokenAddress(putMint, wallet.publicKey)

      // Ensure vault reserve ATA exists
      try { await getAccount(connection, reserveAccount) } catch {
        const tx = new Transaction()
        tx.add(createAssociatedTokenAccountInstruction(wallet.publicKey, reserveAccount, vault, asset.mint))
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
        tx.feePayer = wallet.publicKey
        const signed = await wallet.signTransaction!(tx)
        await connection.confirmTransaction(
          await connection.sendRawTransaction(signed.serialize()),
          'confirmed'
        )
      }

      // Ensure user PUT ATA exists
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

      const amountBN = toBaseUnits(parseFloat(amount), asset.decimals)
      const tx = await program.methods
        .deposit(amountBN)
        .accounts({
          user: wallet.publicKey,
          vault,
          assetConfig,
          reserveAccount,
          userAssetAccount,
          putMint,
          userPutAta,
          userPosition,
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
            <div className="empty-state-sub">Connect your wallet to deposit.</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      <div style={{ marginBottom: 18 }}>
        <div className="page-title">Deposit</div>
        <div className="page-subtitle">Deposit collateral → receive X1SAFE_PUT (locked receipt)</div>
      </div>

      <div className="section-header">
        <span className="section-title">Select Asset</span>
        <button
          onClick={loadPrices}
          style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '0.7rem', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          {priceLoading ? <span className="loading" style={{ width: 10, height: 10 }} /> : '↻'}{' '}
          {lastUpdated || 'Loading…'}
        </button>
      </div>

      <div className="asset-grid">
        {ASSETS.map(a => {
          const cls   = ASSET_CLASSES[a.key] || 'usdcx'
          const short = ASSET_SHORT[a.key] || a.label[0]
          const name  = ASSET_NAMES[a.key] || a.label
          const price = prices[a.key] || 0
          const bal   = balances[a.key] || 0
          return (
            <button
              key={a.key}
              className={`asset-card ${cls}${assetKey === a.key ? ' selected' : ''}`}
              onClick={() => setAssetKey(a.key)}
            >
              <div className="asset-card-icon">{short}</div>
              <div className="asset-card-symbol">{a.label}</div>
              <div className="asset-card-name">{name}</div>
              <div className="asset-card-price">
                {priceLoading ? <span style={{ color: 'var(--text-3)' }}>…</span> : `$${price < 0.0001 ? price.toExponential(2) : price.toFixed(4)}`}
              </div>
              <div className="asset-card-balance">{bal > 0 ? `${bal.toFixed(2)} held` : 'No balance'}</div>
            </button>
          )
        })}
      </div>

      <div className="section-header" style={{ marginTop: 4 }}>
        <span className="section-title">Amount</span>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
          Balance: <strong style={{ color: 'var(--text-2)' }}>{(balances[assetKey] || 0).toFixed(4)} {asset.label}</strong>
        </span>
      </div>

      <div className="amount-input-block">
        <div className="amount-input-row">
          <input
            type="number"
            className="amount-input-big"
            placeholder="0.00"
            value={amount}
            min="0"
            onChange={e => setAmount(e.target.value)}
          />
          <div className="amount-input-asset">
            <span style={{ fontSize: '0.78rem' }}>{ASSET_SHORT[assetKey]}</span>
            {asset.label}
          </div>
        </div>
        <div className="amount-input-footer">
          <span className="amount-usd">
            {numAmount > 0 ? `≈ $${usdValue.toFixed(4)} USD` : 'Enter amount'}
          </span>
          <button className="amount-max-btn" onClick={() => setAmount((balances[assetKey] || 0).toFixed(6))}>MAX</button>
        </div>
      </div>

      {numAmount > 0 && (
        <div className="conversion-card">
          <div className="conversion-row">
            <span className="label">Input</span>
            <span className="value">{numAmount.toFixed(4)} {asset.label}</span>
          </div>
          <div className="conversion-row">
            <span className="label">Oracle price</span>
            <span className="value">${assetPrice.toPrecision(4)}</span>
          </div>
          <div className="conversion-row">
            <span className="label">USD value</span>
            <span className="value">${usdValue.toFixed(4)}</span>
          </div>
          <div className="conversion-divider" />
          <div className="conversion-total">
            <span className="label">→ You receive</span>
            <span className="value">{x1safeAmount.toFixed(2)} X1SAFE_PUT</span>
          </div>
        </div>
      )}

      <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginBottom: 14, textAlign: 'center' }}>
        $1 USD = {X1SAFE_PER_USD} X1SAFE_PUT · PUT is locked (non-transferable receipt)
      </div>

      {error && (
        <div className="tx-status error" style={{ marginBottom: 12 }}>
          <span>⚠</span> {error}
        </div>
      )}

      <button
        className="btn btn-primary btn-full btn-lg"
        onClick={handleDeposit}
        disabled={loading || !amount || numAmount <= 0}
      >
        {loading
          ? <><span className="loading" style={{ borderTopColor: '#000' }} /> Processing…</>
          : `Deposit ${numAmount > 0 ? `${numAmount.toFixed(4)} ${asset.label}` : ''}`}
      </button>

      {txSig && (
        <div className="tx-status success" style={{ marginTop: 12 }}>
          <span>✓</span>
          <span>
            Deposited!{' '}
            <a href={`${EXPLORER}/tx/${txSig}`} target="_blank" rel="noopener" style={{ color: 'var(--success)', fontWeight: 700 }}>
              View tx ↗
            </a>
          </span>
        </div>
      )}

      <div className="program-footer" style={{ marginTop: 16 }}>
        <span>{IS_TESTNET ? '🔶 Testnet' : '🟢 Mainnet'}</span>
        <span>Flying Tulip PUT model</span>
      </div>
    </div>
  )
}
