import { useState, useEffect } from 'react'
import { useConnection, useWallet, useAnchorWallet } from '@solana/wallet-adapter-react'
import { AnchorProvider }       from '@coral-xyz/anchor'
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getAccount } from '@solana/spl-token'
import { Transaction }          from '@solana/web3.js'
import {
  ASSETS, EXPLORER, IS_TESTNET, X1SAFE_PER_USD,
  getProgram, getVaultPDA, getVaultTokenAccount, getUserPositionPDA,
  getTokenBalance, fetchAssetPrices, calcX1SAFE, toBaseUnits,
} from '../lib/vault'

const ASSET_CLASSES: Record<string, string> = { USDCX: 'usdcx', XNT: 'xnt', XEN: 'xen', XNM: 'xnm' }
const ASSET_SHORT:   Record<string, string> = { USDCX: '$', XNT: 'X', XEN: 'E', XNM: 'N' }
const ASSET_NAMES:   Record<string, string> = { USDCX: 'USD Coin (X1)', XNT: 'XNT Token', XEN: 'XEN Token', XNM: 'XNM Token' }

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
  const numAmount    = parseFloat(amount) || 0

  const handleDeposit = async () => {
    if (!wallet.publicKey || !anchorWallet || !amount) return
    setLoading(true)
    setError('')
    setTxSig('')
    try {
      const provider          = new AnchorProvider(connection, anchorWallet, { commitment: 'confirmed' })
      const program           = getProgram(provider)
      const vault             = getVaultPDA()
      const userPosition      = getUserPositionPDA(wallet.publicKey)
      const userTokenAccount  = await getAssociatedTokenAddress(asset.mint, wallet.publicKey)
      // vault_token_account = ATA(vaultPDA, mint) — vault PDA is the token authority
      const vaultTokenAccount = getVaultTokenAccount(asset.mint)

      // Step 1: Create vault ATA if it doesn't exist yet (first deposit for this token)
      try {
        await getAccount(connection, vaultTokenAccount)
      } catch {
        // Vault ATA doesn't exist — create it first
        // createAssociatedTokenAccountInstruction(payer, ataAddress, owner, mint)
        const createAtaTx = new Transaction()
        createAtaTx.add(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey,   // payer (pays for account creation)
            vaultTokenAccount,  // the ATA address to create
            vault,              // owner = vault PDA
            asset.mint          // token mint
          )
        )
        createAtaTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
        createAtaTx.feePayer = wallet.publicKey
        const signed = await wallet.signTransaction!(createAtaTx)
        const sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false })
        // Wait for confirmation before proceeding
        await connection.confirmTransaction(sig, 'confirmed')
      }

      // Step 2: Execute deposit
      const amountBN = toBaseUnits(parseFloat(amount), asset.decimals)
      const tx = await program.methods
        .deposit(amountBN)
        .accounts({
          user:              wallet.publicKey,
          vault,
          userPosition,
          userTokenAccount,
          vaultTokenAccount,
        })
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
      <div style={{ maxWidth: 480, margin: '24px auto' }}>
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🔐</div>
            <div className="empty-state-title">Wallet not connected</div>
            <div className="empty-state-sub">Connect your wallet from the Connect tab to start depositing assets.</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      <div style={{ marginBottom: 18 }}>
        <div className="page-title">Deposit</div>
        <div className="page-subtitle">Select an asset and amount to deposit into the vault</div>
      </div>

      {/* Asset selector */}
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
          const cls  = ASSET_CLASSES[a.key] || 'usdcx'
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

      {/* Amount input */}
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

      {/* Conversion preview */}
      {numAmount > 0 && (
        <div className="conversion-card">
          <div className="conversion-row">
            <span className="label">Input</span>
            <span className="value">{numAmount.toFixed(4)} {asset.label}</span>
          </div>
          <div className="conversion-row">
            <span className="label">Asset price</span>
            <span className="value">${assetPrice.toPrecision(4)}</span>
          </div>
          <div className="conversion-row">
            <span className="label">USD value</span>
            <span className="value">${usdValue.toFixed(4)}</span>
          </div>
          <div className="conversion-divider" />
          <div className="conversion-total">
            <span className="label">→ You receive</span>
            <span className="value">{x1safeAmount.toFixed(2)} X1SAFE</span>
          </div>
        </div>
      )}

      <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginBottom: 14, textAlign: 'center' }}>
        $1 USD = {X1SAFE_PER_USD} X1SAFE token · price via xDEX
      </div>

      {/* Error */}
      {error && (
        <div className="tx-status error" style={{ marginBottom: 12 }}>
          <span>⚠</span> {error}
        </div>
      )}

      {/* Submit */}
      <button
        className="btn btn-primary btn-full btn-lg"
        onClick={handleDeposit}
        disabled={loading || !amount || numAmount <= 0}
      >
        {loading
          ? <><span className="loading" style={{ borderTopColor: '#000' }} /> Processing…</>
          : `Deposit ${numAmount > 0 ? `${numAmount.toFixed(4)} ${asset.label}` : ''}`
        }
      </button>

      {/* Success */}
      {txSig && (
        <div className="tx-status success" style={{ marginTop: 12 }}>
          <span>✓</span>
          <span>
            Deposited successfully!{' '}
            <a href={`${EXPLORER}/tx/${txSig}`} target="_blank" rel="noopener" style={{ color: 'var(--success)', fontWeight: 700 }}>
              View tx ↗
            </a>
          </span>
        </div>
      )}

      <div className="program-footer" style={{ marginTop: 16 }}>
        <span>{IS_TESTNET ? '🔶 Testnet' : '🟢 Mainnet'}</span>
        <span>Multi-asset vault deposit</span>
      </div>
    </div>
  )
}
