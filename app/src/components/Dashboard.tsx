import { useState, useEffect } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import {
  ASSETS, EXPLORER, IS_TESTNET, PROGRAM_ID, X1SAFE_PER_USD,
  fetchVaultState, fetchUserPosition, getTokenBalance, fetchAssetPrices, calcX1SAFE,
} from '../lib/vault'

export function Dashboard() {
  const { connection } = useConnection()
  const wallet         = useWallet()

  const [vaultState, setVaultState] = useState<any>(null)
  const [position, setPosition]     = useState<any>(null)
  const [balances, setBalances]     = useState<Record<string, number>>({})
  const [prices, setPrices]         = useState<Record<string, number>>({ USDCX: 1.0 })
  const [loading, setLoading]       = useState(true)
  const [lastUpdated, setLastUpdated] = useState('')

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

  const tvlUsd = vaultState ? vaultState.totalTvl / 1e6 : 0
  // position amount is stored in base units (lamports of deposited asset)
  const posUsd = position ? position.amount / 1e6 : 0
  const posX1SAFE = posUsd * X1SAFE_PER_USD

  return (
    <div className="dashboard">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">📊 X1SAFE Dashboard</div>
            <div className="card-subtitle">
              {IS_TESTNET ? '🔧 Testnet' : '🌐 Mainnet'} · Auto-refresh 15s
              {lastUpdated && ` · ${lastUpdated}`}
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            <span className="loading" /> Loading vault state...
          </div>
        ) : (
          <>
            {/* Protocol stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
              <div className="position-card">
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: 4 }}>TVL (USD)</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>
                  ${tvlUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
              </div>
              <div className="position-card">
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: 4 }}>X1SAFE Rate</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800 }}>
                  <span style={{ color: '#22c55e' }}>${1/X1SAFE_PER_USD}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}> /token</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>1 USD = {X1SAFE_PER_USD} X1SAFE</div>
              </div>
              <div className="position-card">
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: 4 }}>Status</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: vaultState ? '#22c55e' : '#ef4444' }}>
                  {vaultState ? '✅ Active' : '❌ Not init'}
                </div>
              </div>
            </div>

            {/* Live oracle prices */}
            <div style={{ fontWeight: 700, marginBottom: 10, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              📡 Live Oracle Prices
              <span style={{ fontSize: '0.72rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>
                via xDEX Mainnet pools
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 22 }}>
              {ASSETS.map(a => {
                const price = prices[a.key] || 0
                // X1SAFE you get per 1 unit of this asset
                const x1safePerUnit = price * X1SAFE_PER_USD
                return (
                  <div key={a.key} className="position-card" style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.4rem' }}>{a.icon}</div>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{a.label}</div>
                    <div style={{ color: '#22c55e', fontWeight: 800, fontSize: '0.92rem' }}>
                      ${price < 0.001 ? price.toExponential(2) : price.toFixed(4)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      1 {a.label} = {x1safePerUnit.toFixed(2)} X1SAFE
                    </div>
                  </div>
                )
              })}
            </div>

            {/* User position */}
            {wallet.connected ? (
              <>
                <div style={{ fontWeight: 700, marginBottom: 10, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                  💼 Your Position
                </div>
                <div style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.25)', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
                  {position ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: 2 }}>Deposited (USD)</div>
                        <div style={{ fontWeight: 800, fontSize: '1.3rem', color: 'var(--primary)' }}>${posUsd.toFixed(2)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: 2 }}>X1SAFE Issued</div>
                        <div style={{ fontWeight: 800, fontSize: '1.3rem', color: '#22c55e' }}>{posX1SAFE.toFixed(2)}</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem', padding: '8px 0' }}>
                      No active position · Deposit to get started
                    </div>
                  )}
                </div>

                <div style={{ fontWeight: 700, marginBottom: 10, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                  👛 Wallet Balances
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {ASSETS.map(a => {
                    const bal   = balances[a.key] || 0
                    const price = prices[a.key] || 0
                    const usd   = bal * price
                    return (
                      <div key={a.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 10 }}>
                        <span style={{ fontWeight: 600 }}>{a.icon} {a.label}</span>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700 }}>{bal.toFixed(4)}</div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            ≈ ${usd < 0.0001 ? usd.toExponential(2) : usd.toFixed(4)}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* X1SAFE conversion preview */}
                {Object.values(balances).some(v => v > 0) && (
                  <div style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10 }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>If you deposit all balances</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>Total X1SAFE you'd receive</span>
                      <span style={{ fontWeight: 800, color: '#22c55e' }}>
                        {ASSETS.reduce((sum, a) => sum + calcX1SAFE(balances[a.key] || 0, prices[a.key] || 0), 0).toFixed(2)} X1SAFE
                      </span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                Connect wallet to see your position
              </div>
            )}

            {/* Program info */}
            <div style={{ marginTop: 20, padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 8, fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              <div><strong>Program:</strong>{' '}
                <a href={`${EXPLORER}/address/${PROGRAM_ID.toBase58()}`} target="_blank" rel="noopener" style={{ color: 'var(--primary)', fontFamily: 'monospace' }}>
                  {PROGRAM_ID.toBase58().slice(0, 20)}...
                </a>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
