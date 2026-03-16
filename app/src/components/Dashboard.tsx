import { useState, useEffect } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import {
  ASSETS, EXPLORER, IS_TESTNET, PROGRAM_ID,
  fetchVaultState, fetchUserPosition, getTokenBalance, fetchAssetPrices,
} from '../lib/vault'

export function Dashboard() {
  const { connection } = useConnection()
  const wallet         = useWallet()

  const [vaultState, setVaultState] = useState<any>(null)
  const [position, setPosition]     = useState<any>(null)
  const [balances, setBalances]     = useState<Record<string, number>>({})
  const [prices, setPrices]         = useState<Record<string, number>>({ USDCX: 1.0 })
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [state, p] = await Promise.all([
        fetchVaultState(connection),
        fetchAssetPrices(),
      ])
      setVaultState(state)
      if (Object.keys(p).length > 0) setPrices(p)

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

  const tvlFormatted = vaultState
    ? `$${(vaultState.totalTvl / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
    : '—'
  const positionUsd = position ? (position.amount / 1e6).toFixed(2) : null

  return (
    <div className="dashboard">
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">📊 X1SAFE Dashboard</div>
            <div className="card-subtitle">{IS_TESTNET ? '🔧 Testnet' : '🌐 Mainnet'} · Live on-chain data</div>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            <span className="loading" /> Loading vault state...
          </div>
        ) : (
          <>
            {/* Protocol stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 24 }}>
              <div className="position-card">
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 4 }}>Total Value Locked</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary)' }}>{tvlFormatted}</div>
              </div>
              <div className="position-card">
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 4 }}>Status</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: vaultState ? '#22c55e' : '#ef4444' }}>
                  {vaultState ? '✅ Active' : '❌ Not init'}
                </div>
              </div>
              <div className="position-card">
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 4 }}>X1SAFE Price</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>$1.00</div>
              </div>
            </div>

            {/* Live prices */}
            <div style={{ fontWeight: 600, marginBottom: 10, fontSize: '0.9rem' }}>Live Prices (xDEX Oracle)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 22 }}>
              {ASSETS.map(a => (
                <div key={a.key} className="position-card" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem' }}>{a.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{a.label}</div>
                  <div style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '0.95rem' }}>
                    ${(prices[a.key] || (a.key === 'USDCX' ? 1 : 0)).toFixed(4)}
                  </div>
                </div>
              ))}
            </div>

            {/* User position */}
            {wallet.connected ? (
              <>
                <div style={{ fontWeight: 600, marginBottom: 10, fontSize: '0.9rem' }}>Your Position</div>
                <div className="position-card" style={{ marginBottom: 14 }}>
                  <div className="position-row">
                    <span className="position-label">Deposited (USD)</span>
                    <span className="position-value" style={{ color: 'var(--primary)', fontSize: '1.2rem' }}>
                      {positionUsd ? `$${positionUsd}` : 'No position'}
                    </span>
                  </div>
                </div>

                <div style={{ fontWeight: 600, marginBottom: 10, fontSize: '0.9rem' }}>Wallet Balances</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {ASSETS.map(a => (
                    <div key={a.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 10 }}>
                      <span>{a.icon} {a.label}</span>
                      <span style={{ fontWeight: 700 }}>{(balances[a.key] || 0).toFixed(4)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                Connect wallet to see your position
              </div>
            )}

            {/* Program info */}
            <div style={{ marginTop: 20, padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 8, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <div style={{ marginBottom: 4 }}>
                <strong>Program: </strong>
                <a href={`${EXPLORER}/address/${PROGRAM_ID.toBase58()}`} target="_blank" rel="noopener" style={{ color: 'var(--primary)', fontFamily: 'monospace' }}>
                  {PROGRAM_ID.toBase58().slice(0, 20)}...
                </a>
              </div>
              <div>
                <strong>Vault PDA: </strong>
                <span style={{ fontFamily: 'monospace' }}>
                  {vaultState ? `${vaultState.authority.toBase58().slice(0,16)}...` : '—'}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
