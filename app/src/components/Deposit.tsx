import { useState, useEffect } from 'react'
import { useConnection, useWallet, useAnchorWallet } from '@solana/wallet-adapter-react'
import { Transaction } from '@solana/web3.js'
import { AnchorProvider } from '@coral-xyz/anchor'
import {
  getAssociatedTokenAddressSync, getAccount,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token'
import {
  ASSETS, EXPLORER,
  getProgram, getVaultPDA, getPutMintPDA, getAssetConfigPDA,
  getReserveAccount, getUserPositionPDA,
  toBaseUnits, getTokenBalance,
  TOKEN_PROGRAM_ID, getMintTokenProgram,
} from '../lib/vault'
import { AssetLogo } from './TokenLogo'

const ASSET_NAMES:  Record<string, string> = { USDCX: 'USD Coin (X1)', XNT: 'XNT Token', XEN: 'XEN Token' }
const ASSET_COLORS: Record<string, string> = { USDCX: 'var(--usdcx-color)', XNT: 'var(--xnt-color)', XEN: 'var(--xen-color)' }
const ASSET_CLASS:  Record<string, string> = { USDCX: 'usdcx', XNT: 'xnt', XEN: 'xen' }

export function Deposit() {
  const { connection } = useConnection()
  const wallet         = useWallet()
  const anchorWallet   = useAnchorWallet()
  const [assetKey, setAssetKey] = useState('XNT')
  const [amount,   setAmount]   = useState('')
  const [balances, setBalances] = useState<Record<string, number>>({})
  const [prices]   = useState<Record<string, number>>({ USDCX: 1.0, XNT: 0.35 })
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [txSig,    setTxSig]    = useState('')

  const asset = ASSETS.find(a => a.key === assetKey)!

  useEffect(() => {
    if (!wallet.publicKey) return
    const load = async () => {
      const result: Record<string, number> = {}
      for (const a of ASSETS) result[a.key] = await getTokenBalance(connection, wallet.publicKey!, a.mint)
      setBalances(result)
    }
    load()
  }, [wallet.publicKey, connection])

  const assetPrice   = prices[assetKey] ?? 0
  const numAmount    = parseFloat(amount) || 0
  const usdValue     = numAmount * assetPrice
  const x1safeAmount = usdValue * 100  // 1 USD = 100 X1SAFE_PUT

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

      // Detect correct token program per mint (XNM = Token-2022)
      const assetTokenProg = await getMintTokenProgram(connection, asset.mint)
      const userAssetAta   = getAssociatedTokenAddressSync(asset.mint, wallet.publicKey, false, assetTokenProg)
      const userPutAta     = getAssociatedTokenAddressSync(putMint, wallet.publicKey, false, TOKEN_PROGRAM_ID)

      // Pre-create ATAs if needed (separate transactions)
      const setupTx = new Transaction()
      let needSetup = false

      try { await getAccount(connection, reserveAccount, 'confirmed', assetTokenProg) } catch {
        setupTx.add(createAssociatedTokenAccountInstruction(
          wallet.publicKey, reserveAccount, vault, asset.mint, assetTokenProg
        ))
        needSetup = true
      }
      try { await getAccount(connection, userPutAta, 'confirmed', TOKEN_PROGRAM_ID) } catch {
        setupTx.add(createAssociatedTokenAccountInstruction(
          wallet.publicKey, userPutAta, wallet.publicKey, putMint, TOKEN_PROGRAM_ID
        ))
        needSetup = true
      }

      if (needSetup) {
        setupTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
        setupTx.feePayer = wallet.publicKey
        const signed = await wallet.signTransaction!(setupTx)
        await connection.confirmTransaction(
          await connection.sendRawTransaction(signed.serialize()), 'confirmed'
        )
      }

      // Anchor deposit — IDL handles correct account ordering
      const sig = await program.methods
        .deposit(toBaseUnits(numAmount, asset.decimals))
        .accounts({
          user:             wallet.publicKey,
          vault,
          assetConfig,
          reserveAccount,
          userAssetAccount: userAssetAta,
          putMint,
          userPutAta,
          userPosition,
          tokenProgram:     assetTokenProg,
        })
        .rpc()

      setTxSig(sig)
      setAmount('')
      const updated: Record<string, number> = {}
      for (const a of ASSETS) updated[a.key] = await getTokenBalance(connection, wallet.publicKey!, a.mint)
      setBalances(updated)
    } catch (e: any) {
      setError(e?.message || 'Transaction failed')
    } finally { setLoading(false) }
  }

  if (!wallet.connected) {
    return (
      <div className="tab-content">
        <div className="empty-state">
          <div className="empty-state-icon">🔒</div>
          <div className="empty-state-text">Connect Wallet to Deposit</div>
          <div className="empty-state-sub">Connect your Solana wallet to get started.</div>
        </div>
      </div>
    )
  }

  const balance = balances[assetKey] || 0
  const halfBal = balance / 2
  const isInsufficient = numAmount > balance && balance > 0
  const canDeposit = !loading && numAmount > 0 && !isInsufficient && wallet.signTransaction

  return (
    <div className="tab-content">

      {/* ── Asset selector ── */}
      <div className="form-label" style={{ marginBottom: 10 }}>Select Asset</div>
      <div className="asset-grid" style={{ marginBottom: 20 }}>
        {ASSETS.map(a => {
          const bal = balances[a.key] || 0
          const selected = assetKey === a.key
          return (
            <button
              key={a.key}
              onClick={() => { setAssetKey(a.key); setAmount(''); setError(''); setTxSig('') }}
              className={`asset-card ${ASSET_CLASS[a.key] || ''}${selected ? ' selected' : ''}`}
              style={{ cursor: 'pointer' }}
            >
              <div className="asset-card-icon"><AssetLogo assetKey={a.key} size={36} /></div>
              <div className="asset-card-symbol">{a.label}</div>
              <div className="asset-card-name">{ASSET_NAMES[a.key] || a.label}</div>
              <div className="asset-card-price">${(prices[a.key] || a.price || 0).toFixed(4)}</div>
              <div className="asset-card-balance" style={{ color: bal > 0 ? ASSET_COLORS[a.key] : undefined }}>
                {bal > 0 ? `${bal.toLocaleString(undefined, { maximumFractionDigits: 2 })} held` : 'No balance'}
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Amount input block ── */}
      <div className="amount-input-block" style={{ marginBottom: 14 }}>
        <div className="amount-input-row">
          <input
            className="amount-input-big"
            type="number"
            placeholder="0.00"
            value={amount}
            min="0"
            step="any"
            onChange={e => { setAmount(e.target.value); setError(''); setTxSig('') }}
          />
          <div className="amount-input-asset">
            <AssetLogo assetKey={assetKey} size={22} style={{ flexShrink: 0 }} />
            <span style={{ color: ASSET_COLORS[assetKey] }}>{asset.label}</span>
          </div>
        </div>
        <div className="amount-input-footer">
          <span className="amount-usd">
            {numAmount > 0 ? `≈ $${usdValue.toFixed(4)} USD` : 'Enter amount'}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="amount-max-btn"
              onClick={() => setAmount(halfBal > 0 ? halfBal.toFixed(6) : '')}
              disabled={balance === 0}
            >
              HALF
            </button>
            <button
              className="amount-max-btn"
              onClick={() => setAmount(balance > 0 ? balance.toFixed(6) : '')}
              disabled={balance === 0}
            >
              MAX
            </button>
          </div>
        </div>
        <div style={{
          marginTop: 10,
          paddingTop: 10,
          borderTop: '1px solid var(--border-soft)',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.75rem',
          color: 'var(--text-3)',
        }}>
          <span>Balance</span>
          <span style={{ color: balance > 0 ? ASSET_COLORS[assetKey] : undefined, fontWeight: 600 }}>
            {balance.toLocaleString(undefined, { maximumFractionDigits: 6 })} {asset.label}
          </span>
        </div>
      </div>

      {/* ── Conversion card ── */}
      {numAmount > 0 && (
        <div className="conversion-card" style={{ marginBottom: 14 }}>
          <div className="conversion-row">
            <span className="label">You deposit</span>
            <span className="value">{numAmount.toFixed(4)} {asset.label}</span>
          </div>
          <div className="conversion-row">
            <span className="label">Oracle price</span>
            <span className="value" style={{ color: ASSET_COLORS[assetKey] }}>${assetPrice.toFixed(4)}</span>
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
          <div style={{ marginTop: 10, fontSize: '0.7rem', color: 'var(--text-3)', display: 'flex', gap: 12 }}>
            <span>$1 USD = 100 X1SAFE_PUT</span>
            <span>·</span>
            <span>🔒 Receipt locked to wallet</span>
          </div>
        </div>
      )}

      {/* ── Warnings ── */}
      {isInsufficient && (
        <div className="info-box warning" style={{ marginBottom: 14 }}>
          ⚠️ Amount exceeds balance ({balance.toFixed(4)} {asset.label})
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="info-box danger" style={{ marginBottom: 14 }}>
          ❌ {error}
        </div>
      )}

      {/* ── Success ── */}
      {txSig && (
        <div className="tx-status success" style={{ marginBottom: 14 }}>
          <span>✅ Deposit confirmed</span>
          <a
            href={`${EXPLORER}/tx/${txSig}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--success)', textDecoration: 'none' }}
          >
            View on Explorer ↗
          </a>
        </div>
      )}

      {/* ── Deposit button ── */}
      <button
        className="btn btn-primary btn-full btn-lg"
        onClick={handleDeposit}
        disabled={!canDeposit}
        style={{ fontWeight: 700, letterSpacing: '-0.02em' }}
      >
        {loading ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
            Processing…
          </span>
        ) : numAmount > 0 ? (
          `Deposit ${numAmount.toFixed(4)} ${asset.label} → ${x1safeAmount.toFixed(2)} X1SAFE_PUT`
        ) : (
          `Deposit ${asset.label}`
        )}
      </button>

      <div style={{ marginTop: 12, textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-3)' }}>
        Deposits are locked in the vault. Withdraw anytime using your X1SAFE_PUT receipt.
      </div>

    </div>
  )
}
