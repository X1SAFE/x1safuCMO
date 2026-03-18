import { useState, useEffect } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import {
  Transaction, SystemProgram, SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} from '@solana/web3.js'
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync, getAccount,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token'
import {
  PROGRAM_ID, ASSETS, EXPLORER,
  getVaultPDA, getPutMintPDA, getAssetConfigPDA,
  getReserveAccount, getUserPositionPDA,
  toBaseUnits, getTokenBalance,
} from '../lib/vault'
import { sha256 } from '@noble/hashes/sha256'

function disc(name: string): Buffer {
  return Buffer.from(sha256(new TextEncoder().encode('global:' + name))).subarray(0, 8)
}

const ASSET_CLASSES: Record<string, string> = { USDCX: 'usdcx', XNT: 'xnt', XEN: 'xen' }
const ASSET_SHORT:   Record<string, string> = { USDCX: '$', XNT: 'X', XEN: 'E' }
const ASSET_NAMES:   Record<string, string> = { USDCX: 'USD Coin (X1)', XNT: 'XNT Token', XEN: 'XEN Token' }

export function Deposit() {
  const { connection } = useConnection()
  const wallet = useWallet()
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
    if (!wallet.publicKey || !wallet.signTransaction || !amount) return
    setLoading(true); setError(''); setTxSig('')
    try {
      const vault          = getVaultPDA()
      const assetConfig    = getAssetConfigPDA(asset.mint)
      const reserveAccount = getReserveAccount(asset.mint)
      const putMint        = getPutMintPDA()
      const userPosition   = getUserPositionPDA(wallet.publicKey)
      const userAssetAta   = getAssociatedTokenAddressSync(asset.mint, wallet.publicKey, false, TOKEN_PROGRAM_ID)
      const userPutAta     = getAssociatedTokenAddressSync(putMint, wallet.publicKey, false, TOKEN_PROGRAM_ID)

      const tx = new Transaction()

      // Create reserve ATA if needed
      try { await getAccount(connection, reserveAccount) } catch {
        tx.add(createAssociatedTokenAccountInstruction(
          wallet.publicKey, reserveAccount, vault, asset.mint,
          undefined, TOKEN_PROGRAM_ID
        ))
      }
      // Create user PUT ATA if needed
      try { await getAccount(connection, userPutAta) } catch {
        tx.add(createAssociatedTokenAccountInstruction(
          wallet.publicKey, userPutAta, wallet.publicKey, putMint,
          undefined, TOKEN_PROGRAM_ID
        ))
      }

      // Deposit instruction (raw — bypasses IDL version mismatch)
      const amountBN = toBaseUnits(numAmount, asset.decimals)
      const data = Buffer.alloc(16)
      disc('deposit').copy(data, 0)
      data.writeBigUInt64LE(BigInt(amountBN.toString()), 8)

      tx.add(new TransactionInstruction({
        programId: PROGRAM_ID,
        keys: [
          { pubkey: wallet.publicKey, isSigner: true,  isWritable: true  },
          { pubkey: vault,            isSigner: false, isWritable: true  },
          { pubkey: assetConfig,      isSigner: false, isWritable: true  },
          { pubkey: reserveAccount,   isSigner: false, isWritable: true  },
          { pubkey: userAssetAta,     isSigner: false, isWritable: true  },
          { pubkey: putMint,          isSigner: false, isWritable: true  },
          { pubkey: userPutAta,       isSigner: false, isWritable: true  },
          { pubkey: userPosition,     isSigner: false, isWritable: true  },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          { pubkey: SYSVAR_RENT_PUBKEY,      isSigner: false, isWritable: false },
        ],
        data,
      }))

      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
      tx.feePayer = wallet.publicKey
      const signed = await wallet.signTransaction(tx)
      const rawTx  = signed.serialize()
      const sig    = await connection.sendRawTransaction(rawTx)
      await connection.confirmTransaction(sig, 'confirmed')
      setTxSig(sig)
      setAmount('')
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
          <div className="empty-state-sub">Connect your wallet to deposit.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="tab-content">
      <div className="asset-grid">
        {ASSETS.map(a => {
          const cls = ASSET_CLASSES[a.key] || ''
          const short = ASSET_SHORT[a.key] || a.label[0]
          const name = ASSET_NAMES[a.key] || a.label
          const bal = balances[a.key] || 0
          return (
            <button
              key={a.key}
              onClick={() => setAssetKey(a.key)}
              className={`asset-card ${cls}${assetKey === a.key ? ' selected' : ''}`}
            >
              <div className="asset-card-icon">{short}</div>
              <div className="asset-card-symbol">{a.label}</div>
              <div className="asset-card-name">{name}</div>
              <div className="asset-card-price">
                ${(prices[a.key] || a.price || 0).toFixed(4)}
              </div>
              <div className="asset-card-balance">{bal > 0 ? `${bal.toFixed(2)} held` : 'No balance'}</div>
            </button>
          )
        })}
      </div>

      <div className="amount-input-row">
        <span>Balance: <strong style={{ color: 'var(--text-2)' }}>{(balances[assetKey] || 0).toFixed(4)} {asset.label}</strong></span>
      </div>

      <div className="amount-input-wrap">
        <input
          className="amount-input"
          type="number"
          placeholder="0.00"
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />
        <div className="amount-input-asset">
          <span style={{ fontSize: '0.78rem' }}>{ASSET_SHORT[assetKey]}</span>
          {asset.label}
        </div>
        <button className="amount-max-btn" onClick={() => setAmount((balances[assetKey] || 0).toFixed(6))}>MAX</button>
      </div>

      {numAmount > 0 && (
        <div className="deposit-summary">
          <div className="summary-row"><span className="label">Input</span><span className="value">{numAmount.toFixed(4)} {asset.label}</span></div>
          <div className="summary-row"><span className="label">Oracle price</span><span className="value">${assetPrice.toPrecision(4)}</span></div>
          <div className="summary-row"><span className="label">USD value</span><span className="value">${usdValue.toFixed(4)}</span></div>
          <div className="summary-row highlight"><span className="label">→ You receive</span><span className="value">{x1safeAmount.toFixed(2)} X1SAFE_PUT</span></div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: 4 }}>
            $1 USD = 100 X1SAFE_PUT &nbsp;·&nbsp; PUT is locked (non-transferable receipt)
          </div>
        </div>
      )}

      {error && <div className="error-box">{error}</div>}
      {txSig && (
        <div className="success-box">
          ✅ Deposited!&nbsp;
          <a href={`${EXPLORER}/tx/${txSig}`} target="_blank" rel="noopener noreferrer">View tx ↗</a>
        </div>
      )}

      <button
        className="btn-primary"
        onClick={handleDeposit}
        disabled={loading || !numAmount || numAmount <= 0}
      >
        {loading ? 'Processing…' : `Deposit ${numAmount > 0 ? numAmount.toFixed(4) : ''} ${asset.label}`}
      </button>
    </div>
  )
}
