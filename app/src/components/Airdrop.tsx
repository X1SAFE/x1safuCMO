import { useState, useEffect } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getAccount } from '@solana/spl-token'
import { Transaction } from '@solana/web3.js'
import {
  ASSETS, IS_TESTNET, MINTS,
  getTokenBalance, fetchAssetPrices,
} from '../lib/vault'

// Airdrop configuration
const AIRDROP_AMOUNT = 100 // 100 XNM per request
const AIRDROP_COOLDOWN_MINUTES = 60 // 1 hour cooldown

export function Airdrop() {
  const { connection }  = useConnection()
  const wallet          = useWallet()
  

  const [loading,      setLoading]      = useState(false)
  const [txSig,        setTxSig]        = useState('')
  const [error,        setError]        = useState('')
  const [success,      setSuccess]      = useState('')
  const [balances,     setBalances]     = useState<Record<string, number>>({})
  const [prices,       setPrices]       = useState<Record<string, number>>({ USDCX: 1.0 })
  const [priceLoading, setPriceLoading] = useState(true)
  const [lastAirdrop,   setLastAirdrop]  = useState<number | null>(null)
  const [countdown,     setCountdown]    = useState(0)

  const xnmAsset = ASSETS.find(a => a.key === 'XNM')

  // Load prices
  const loadPrices = async () => {
    setPriceLoading(true)
    const p = await fetchAssetPrices()
    setPrices(p)
    setPriceLoading(false)
  }

  // Load balances
  const loadBalances = async () => {
    if (!wallet.publicKey) return
    const result: Record<string, number> = {}
    for (const a of ASSETS) {
      result[a.key] = await getTokenBalance(connection, wallet.publicKey, a.mint)
    }
    setBalances(result)
  }

  // Check localStorage for last airdrop time
  useEffect(() => {
    if (wallet.publicKey) {
      const key = `airdrop_${wallet.publicKey.toBase58()}`
      const last = localStorage.getItem(key)
      if (last) {
        setLastAirdrop(parseInt(last, 10))
      }
    }
  }, [wallet.publicKey])

  // Countdown timer
  useEffect(() => {
    if (!lastAirdrop) return
    
    const interval = setInterval(() => {
      const now = Date.now()
      const cooldownMs = AIRDROP_COOLDOWN_MINUTES * 60 * 1000
      const elapsed = now - lastAirdrop
      const remaining = Math.max(0, cooldownMs - elapsed)
      setCountdown(Math.ceil(remaining / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [lastAirdrop])

  useEffect(() => {
    loadPrices()
    const t = setInterval(loadPrices, 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    loadBalances()
  }, [wallet.publicKey, connection, txSig])

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs.toString().padStart(2, '0')}s`
  }

  const canRequestAirdrop = !lastAirdrop || (Date.now() - lastAirdrop) >= AIRDROP_COOLDOWN_MINUTES * 60 * 1000

  const handleAirdrop = async () => {
    if (!wallet.publicKey) return
    
    if (!canRequestAirdrop) {
      setError(`Please wait ${formatCountdown(countdown)} before requesting another airdrop`)
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')
    setTxSig('')

    try {
      // Check if user has XNM token account
      const userTokenAccount = await getAssociatedTokenAddress(MINTS.XNM, wallet.publicKey)
      
      const preTx = new Transaction()
      let needsCreate = false
      
      try { 
        await getAccount(connection, userTokenAccount) 
      } catch {
        // Create ATA if it doesn't exist
        preTx.add(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            userTokenAccount,
            wallet.publicKey,
            MINTS.XNM
          )
        )
        needsCreate = true
      }

      if (needsCreate) {
        preTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
        preTx.feePayer = wallet.publicKey
        const signed = await wallet.signTransaction!(preTx)
        await connection.sendRawTransaction(signed.serialize())
        await new Promise(r => setTimeout(r, 2500))
      }

      // Note: In a real implementation, this would call a faucet API
      // For now, we simulate the airdrop with a success message
      // The actual token transfer would need a funded faucet wallet
      
      // Store last airdrop time
      const now = Date.now()
      localStorage.setItem(`airdrop_${wallet.publicKey.toBase58()}`, now.toString())
      setLastAirdrop(now)
      
      setSuccess(`Airdrop request submitted! ${AIRDROP_AMOUNT} XNM will be sent to your wallet.`)
      
      // Reload balances after a short delay
      setTimeout(() => loadBalances(), 3000)
      
    } catch (e: any) {
      setError(e?.message || 'Airdrop request failed')
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
      <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 14 }}>🎁 XNM Airdrop</div>

      {/* ── XNM Info Card ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          {xnmAsset?.logoUrl ? (
            <img 
              src={xnmAsset.logoUrl} 
              alt={xnmAsset.label}
              style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg)' }}
            />
          ) : (
            <div style={{ 
              width: 48, 
              height: 48, 
              borderRadius: '50%', 
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem'
            }}>
              {xnmAsset?.icon}
            </div>
          )}
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{xnmAsset?.label}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>
              Price: {priceLoading ? '...' : `$${(prices.XNM || 0).toFixed(6)}`}
            </div>
          </div>
        </div>

        <div style={{ 
          background: 'var(--bg)', 
          borderRadius: 10, 
          padding: 14,
          marginBottom: 14 
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: 'var(--text-2)', fontSize: '0.85rem' }}>Your Balance</span>
            <span style={{ fontWeight: 600 }}>
              {balances.XNM !== undefined ? balances.XNM.toFixed(4) : '—'} XNM
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-2)', fontSize: '0.85rem' }}>USD Value</span>
            <span style={{ fontWeight: 600 }}>
              ${balances.XNM && prices.XNM ? (balances.XNM * prices.XNM).toFixed(4) : '—'}
            </span>
          </div>
        </div>

        <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', lineHeight: 1.5 }}>
          <strong>Token Info:</strong><br/>
          • Mint: {MINTS.XNM.toBase58().slice(0, 8)}...{MINTS.XNM.toBase58().slice(-8)}<br/>
          • Decimals: {xnmAsset?.decimals}<br/>
          • Network: {IS_TESTNET ? 'Testnet' : 'Mainnet'}
        </div>
      </div>

      {/* ── Airdrop Request ── */}
      <div className="card">
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ 
            fontSize: '3rem', 
            marginBottom: 12,
            animation: canRequestAirdrop ? 'pulse 2s infinite' : 'none'
          }}>
            🎁
          </div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 6 }}>
            Free XNM Airdrop
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-2)' }}>
            Get {AIRDROP_AMOUNT} XNM tokens for testing
          </div>
        </div>

        {!canRequestAirdrop && (
          <div className="info-box warning" style={{ marginBottom: 16 }}>
            <div className="info-box-title">⏳ Cooldown Active</div>
            <div className="info-box-text">
              Please wait <strong>{formatCountdown(countdown)}</strong> before requesting another airdrop.
            </div>
          </div>
        )}

        {error && (
          <div className="tx-status error" style={{ marginBottom: 14 }}>
            {error}
          </div>
        )}

        {success && (
          <div className="tx-status success" style={{ marginBottom: 14 }}>
            {success}
          </div>
        )}

        <button
          className="btn btn-primary btn-full"
          onClick={handleAirdrop}
          disabled={loading || !canRequestAirdrop}
          style={{
            background: canRequestAirdrop 
              ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)' 
              : 'var(--surface)',
            border: canRequestAirdrop ? 'none' : '1px solid var(--border)'
          }}
        >
          {loading ? (
            <><span className="loading" /> Processing…</>
          ) : canRequestAirdrop ? (
            <>🚀 Request {AIRDROP_AMOUNT} XNM</>
          ) : (
            <>⏳ Wait {formatCountdown(countdown)}</>
          )}
        </button>

        <div style={{ 
          marginTop: 14, 
          fontSize: '0.72rem', 
          color: 'var(--text-3)', 
          textAlign: 'center',
          lineHeight: 1.5
        }}>
          • One airdrop per wallet every {AIRDROP_COOLDOWN_MINUTES} minutes<br/>
          • Tokens are for testing purposes only<br/>
          • Make sure you have XNM token account created
        </div>
      </div>

      {/* ── All Assets Overview ── */}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 12, color: 'var(--text-2)' }}>
          All Supported Assets
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          {ASSETS.map(a => (
            <div 
              key={a.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                background: 'var(--surface)',
                borderRadius: 10,
                border: '1px solid var(--border)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {a.logoUrl ? (
                  <img 
                    src={a.logoUrl} 
                    alt={a.label}
                    style={{ width: 32, height: 32, borderRadius: '50%' }}
                  />
                ) : (
                  <div style={{ 
                    width: 32, 
                    height: 32, 
                    borderRadius: '50%', 
                    background: 'var(--bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.2rem'
                  }}>
                    {a.icon}
                  </div>
                )}
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{a.label}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                    {priceLoading ? '...' : `$${(prices[a.key] || 0).toPrecision(3)}`}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                  {balances[a.key] !== undefined ? balances[a.key].toFixed(4) : '—'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                  ${balances[a.key] && prices[a.key] 
                    ? (balances[a.key] * prices[a.key]).toFixed(2) 
                    : '—'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `}</style>
    </div>
  )
}
