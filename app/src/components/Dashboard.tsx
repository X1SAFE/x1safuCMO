import { useState, useEffect } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import {
  ASSETS, EXPLORER, IS_TESTNET, PROGRAM_ID, X1SAFE_PER_USD,
  fetchVaultState, fetchUserPosition, getTokenBalance, fetchAssetPrices, calcX1SAFE,
} from '../lib/vault'

const ASSET_CLASSES: Record<string, string> = {
  USDCX: 'usdcx',
  XNT:   'xnt',
  XEN:   'xen',
  XNM:   'xnm',
}

const ASSET_SHORT_ICONS: Record<string, string> = {
  USDCX: '$',
  XNT:   'X',
  XEN:   'E',
  XNM:   'N',
}

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

  const tvlUsd    = vaultState ? vaultState.totalTvl / 1e6 : 0
  const posUsd    = position   ? position.amount / 1e6      : 0
  const posX1SAFE = posUsd * X1SAFE_PER_USD

  // Compute allocation percentages for chart
  const totalWalletUsd = ASSETS.reduce((s, a) => s + (balances[a.key] || 0) * (prices[a.key] || 0), 0)
  const allocationData = ASSETS.map(a => {
    const usd = (balances[a.key] || 0) * (prices[a.key] || 0)
    return { ...a, usd, pct: totalWalletUsd > 0 ? (usd / totalWalletUsd) * 100 : 0 }
  })

  if (loading) {
    return (
      <div>
        {/* Skeleton loading */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="skeleton" style={{ width: 60, height: 10, marginBottom: 10 }} />
            <div className="skeleton" style={{ width: 100, height: 24 }} />
          </div>
          <div className="stat-card">
            <div className="skeleton" style={{ width: 60, height: 10, marginBottom: 10 }} />
            <div className="skeleton" style={{ width: 80, height: 24 }} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', color: 'var(--text-2)', gap: 10, fontSize: '0.85rem' }}>
          <span className="loading" style={{ color: 'var(--text-2)' }} />
          Loading vault data…
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div className="page-title">Overview</div>
          <div className="page-subtitle">Vault stats &amp; your position</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className={`badge ${vaultState ? 'badge-green' : 'badge-gray'}`}>
            {vaultState ? '● Active' : '○ Uninitialized'}
          </span>
        </div>
      </div>

      {/* ── Protocol Stats ── */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total TVL</div>
          <div className="stat-value">${tvlUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          <div className="stat-sub">Across all assets</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">X1SAFE Rate</div>
          <div className="stat-value" style={{ fontSize: '1.1rem' }}>1 : 1 <span style={{ fontSize: '0.72rem', fontWeight: 400, color: 'var(--text-3)' }}>USD</span></div>
          <div className="stat-sub">{X1SAFE_PER_USD} token per $1</div>
        </div>
      </div>

      {/* ── Live Prices ── */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Oracle Prices</div>
            <div className="card-subtitle">via xDEX Mainnet{lastUpdated && ` · ${lastUpdated}`}</div>
          </div>
          <span className="badge badge-blue">Live</span>
        </div>

        {ASSETS.map(a => {
          const price = prices[a.key] || 0
          const x1safePerUnit = price * X1SAFE_PER_USD
          const cls = ASSET_CLASSES[a.key] || 'usdcx'
          const shortIcon = ASSET_SHORT_ICONS[a.key] || a.label[0]
          return (
            <div key={a.key} className="price-row">
              <div className="price-row-left">
                <div className={`price-row-icon ${cls}`}>{shortIcon}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{a.label}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>
                    = {x1safePerUnit.toFixed(2)} X1SAFE
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--success)' }}>
                  ${price < 0.001 ? price.toExponential(2) : price.toFixed(4)}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>per token</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── User position ── */}
      {wallet.connected ? (
        <>
          {/* Position hero */}
          {posX1SAFE > 0 ? (
            <div className="hero-stat card-glow" style={{ marginBottom: 12, background: 'linear-gradient(135deg, #0d0d0d 0%, #080808 100%)', border: '1px solid rgba(34,197,94,0.12)', borderRadius: 'var(--radius-lg)', padding: '24px 20px' }}>
              <div className="hero-stat-label">Your X1SAFE Balance</div>
              <div className="hero-stat-value" style={{ color: 'var(--success)' }}>{posX1SAFE.toFixed(2)}</div>
              <div className="hero-stat-usd">≈ ${posUsd.toFixed(2)} USD deposited</div>
            </div>
          ) : (
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="empty-state" style={{ padding: '28px 20px' }}>
                <div className="empty-state-icon">🏦</div>
                <div className="empty-state-title">No position yet</div>
                <div className="empty-state-sub">
                  Deposit USDC.X, XNT, XEN, or XNM to start earning X1SAFE tokens.
                </div>
              </div>
            </div>
          )}

          {/* Position stats */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Deposited</div>
              <div className="stat-value">${posUsd.toFixed(2)}</div>
              <div className="stat-sub">USD value</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">X1SAFE Issued</div>
              <div className="stat-value" style={{ color: posX1SAFE > 0 ? 'var(--success)' : 'var(--text)' }}>
                {posX1SAFE.toFixed(2)}
              </div>
              <div className="stat-sub">tokens held</div>
            </div>
          </div>

          {/* Wallet balances */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Wallet Balances</div>
                <div className="card-subtitle">Available to deposit</div>
              </div>
              {totalWalletUsd > 0 && (
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-2)' }}>
                  ≈ ${totalWalletUsd.toFixed(2)}
                </span>
              )}
            </div>

            {ASSETS.map(a => {
              const bal = balances[a.key] || 0
              const usd = bal * (prices[a.key] || 0)
              const cls = ASSET_CLASSES[a.key] || 'usdcx'
              const shortIcon = ASSET_SHORT_ICONS[a.key] || a.label[0]
              return (
                <div key={a.key} className="price-row">
                  <div className="price-row-left">
                    <div className={`price-row-icon ${cls}`}>{shortIcon}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{a.label}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>
                        ≈ ${usd < 0.0001 ? usd.toExponential(2) : usd.toFixed(4)}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{bal.toFixed(4)}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-3)' }}>{a.label}</div>
                  </div>
                </div>
              )
            })}

            {/* Allocation chart */}
            {totalWalletUsd > 0 && (
              <>
                <div className="divider" style={{ margin: '12px 0' }} />
                <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 10 }}>
                  Allocation
                </div>
                <div className="chart-container" style={{ padding: '0' }}>
                  {allocationData.filter(a => a.usd > 0).map(a => {
                    const cls = ASSET_CLASSES[a.key] || 'usdcx'
                    return (
                      <div key={a.key} className="chart-row">
                        <div className="chart-row-label">{a.label}</div>
                        <div className="chart-bar-track">
                          <div
                            className={`chart-bar-fill ${cls}`}
                            style={{ width: `${a.pct}%` }}
                          />
                        </div>
                        <div className="chart-row-pct">{a.pct.toFixed(0)}%</div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* If-deposited preview */}
            {Object.values(balances).some(v => v > 0) && (
              <>
                <div className="divider" style={{ margin: '12px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>If you deposit all</span>
                  <span style={{ fontWeight: 700, color: 'var(--success)', fontSize: '0.9rem' }}>
                    +{ASSETS.reduce((s, a) => s + calcX1SAFE(balances[a.key] || 0, prices[a.key] || 0), 0).toFixed(2)} X1SAFE
                  </span>
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">👛</div>
            <div className="empty-state-title">Connect your wallet</div>
            <div className="empty-state-sub">
              Connect to see your position, balances, and asset allocation.
            </div>
          </div>
        </div>
      )}

      {/* ── Program info ── */}
      <div className="program-footer">
        <span>Program</span>
        <a
          href={`${EXPLORER}/address/${PROGRAM_ID.toBase58()}`}
          target="_blank"
          rel="noopener"
          className="mono"
        >
          {PROGRAM_ID.toBase58().slice(0, 20)}…
        </a>
        <span className="badge badge-testnet" style={{ fontSize: '0.62rem', padding: '2px 6px' }}>
          {IS_TESTNET ? 'Testnet' : 'Mainnet'}
        </span>
      </div>
    </div>
  )
}
