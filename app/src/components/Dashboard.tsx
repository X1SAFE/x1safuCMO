import { useState, useEffect } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import {
  ASSETS, EXPLORER, IS_TESTNET, PROGRAM_ID, X1SAFE_PER_USD,
  fetchVaultState, fetchUserPosition, getTokenBalance, fetchAssetPrices, calcX1SAFE,
} from '../lib/vault'

export function Dashboard() {
  const { connection } = useConnection()
  const wallet         = useWallet()

  const [vaultState,   setVaultState]   = useState<any>(null)
  const [position,     setPosition]     = useState<any>(null)
  const [balances,     setBalances]     = useState<Record<string, number>>({})
  const [prices,       setPrices]       = useState<Record<string, number>>({ USDCX: 1.0 })
  const [loading,      setLoading]      = useState(true)
  const [lastUpdated,  setLastUpdated]  = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [state, p] = await Promise.all([fetchVaultState(connection), fetchAssetPrices()])
      setVaultState(state)
      if (Object.keys(p).length > 0) setPrices(p)
      setLastUpdated(new Date().toLocaleTimeString())

      if (wallet.publicKey) {
        const [pos, ...bals] = await Promise.all([
          fetchUserPosition(connection, wallet.publicKey),
          ...ASSETS.map(a => getTokenBalance(connection, wallet.publicKey!, a.mint)),
        ])
        setPosition(pos)
        const result: Record<string, number> = {}
        ASSETS.forEach((a, i) => { result[a.key] = bals[i] })
        setBalances(result)
      }
      setLoading(false)
    }
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [wallet.publicKey, connection])

  const tvlUsd   = vaultState ? vaultState.totalTvl / 1e6 : 0
  const posUsd   = position   ? position.amount / 1e6      : 0
  const posX1SAFE = posUsd * X1SAFE_PER_USD

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', color: 'var(--text-2)', gap: 10, fontSize: '0.85rem' }}>
        <span className="loading" style={{ color: 'var(--text-2)' }} />
        Loading vault data…
      </div>
    )
  }

  return (
    <div className="dashboard">
      {/* ── Status bar ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Overview</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`badge ${vaultState ? 'badge-green' : 'badge-gray'}`}>
            {vaultState ? '● Active' : '○ Uninitialized'}
          </span>
          <span className="badge badge-blue">{IS_TESTNET ? 'Testnet' : 'Mainnet'}</span>
        </div>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-label">Total TVL</div>
          <div className="stat-value">${tvlUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">X1SAFE rate</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, marginTop: 2 }}>
            $1 = {X1SAFE_PER_USD} <span style={{ color: 'var(--text-2)', fontSize: '0.78rem', fontWeight: 400 }}>token</span>
          </div>
        </div>
      </div>

      {/* ── Live Prices ── */}
      <div className="card">
        <div className="card-header" style={{ marginBottom: 14 }}>
          <div>
            <div className="card-title" style={{ fontSize: '0.875rem' }}>Oracle Prices</div>
            <div className="card-subtitle">via xDEX Mainnet{lastUpdated && ` · ${lastUpdated}`}</div>
          </div>
        </div>
        <div className="row-list">
          {ASSETS.map(a => {
            const price = prices[a.key] || 0
            const x1safePerUnit = price * X1SAFE_PER_USD
            return (
              <div key={a.key} className="row-item">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '1.2rem' }}>{a.icon}</span>
                  <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>{a.label}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--success)' }}>
                    ${price < 0.001 ? price.toExponential(2) : price.toFixed(4)}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-2)' }}>
                    = {x1safePerUnit.toFixed(2)} X1SAFE
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── User position ── */}
      {wallet.connected ? (
        <div className="card">
          <div className="card-header" style={{ marginBottom: 14 }}>
            <div className="card-title" style={{ fontSize: '0.875rem' }}>Your Position</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div className="position-card">
              <div style={{ fontSize: '0.7rem', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Deposited (USD)</div>
              <div style={{ fontWeight: 700, fontSize: '1.3rem', letterSpacing: '-0.02em' }}>${posUsd.toFixed(2)}</div>
            </div>
            <div className="position-card">
              <div style={{ fontSize: '0.7rem', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>X1SAFE Issued</div>
              <div style={{ fontWeight: 700, fontSize: '1.3rem', letterSpacing: '-0.02em', color: 'var(--success)' }}>{posX1SAFE.toFixed(2)}</div>
            </div>
          </div>

          {/* Wallet Balances */}
          <div style={{ fontWeight: 600, fontSize: '0.78rem', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Wallet balances</div>
          <div className="row-list">
            {ASSETS.map(a => {
              const bal = balances[a.key] || 0
              const usd = bal * (prices[a.key] || 0)
              return (
                <div key={a.key} className="row-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '1.1rem' }}>{a.icon}</span>
                    <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>{a.label}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{bal.toFixed(4)}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-2)' }}>
                      ≈ ${usd < 0.0001 ? usd.toExponential(2) : usd.toFixed(4)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* If-deposited preview */}
          {Object.values(balances).some(v => v > 0) && (
            <div className="preview-box" style={{ marginTop: 14, background: 'var(--success-dim)', border: '1px solid rgba(34,197,94,0.15)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>If you deposit all balances</span>
                <span style={{ fontWeight: 700, color: 'var(--success)', fontSize: '0.9rem' }}>
                  {ASSETS.reduce((s, a) => s + calcX1SAFE(balances[a.key] || 0, prices[a.key] || 0), 0).toFixed(2)} X1SAFE
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '32px 20px' }}>
          <div style={{ color: 'var(--text-2)', fontSize: '0.85rem', marginBottom: 4 }}>Connect your wallet</div>
          <div style={{ color: 'var(--text-3)', fontSize: '0.78rem' }}>to see your position and balances</div>
        </div>
      )}

      {/* ── Program info ── */}
      <div style={{ marginTop: 4, padding: '10px 14px', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '0.72rem', color: 'var(--text-3)' }}>
        Program:{' '}
        <a
          href={`${EXPLORER}/address/${PROGRAM_ID.toBase58()}`}
          target="_blank"
          rel="noopener"
          className="mono"
          style={{ color: 'var(--text-2)', textDecoration: 'none' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-2)')}
        >
          {PROGRAM_ID.toBase58().slice(0, 16)}…
        </a>
      </div>
    </div>
  )
}
