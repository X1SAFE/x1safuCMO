import { useState, useEffect } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import {
  ASSETS, EXPLORER, IS_TESTNET, PROGRAM_ID, X1SAFE_PER_USD,
  fetchVaultState, fetchUserPosition, fetchStakePool, fetchUserStake,
  getTokenBalance, getPutMintPDA, getSafeMintPDA, getSx1safeMintPDA,
  fetchAssetPrices, calcX1SAFE,
} from '../lib/vault'

const ASSET_CLASSES:     Record<string, string> = { USDCX: 'usdcx', XNT: 'xnt', XEN: 'xen' }
const ASSET_SHORT_ICONS: Record<string, string> = { USDCX: '$', XNT: 'X', XEN: 'E' }

export function Dashboard() {
  const { connection } = useConnection()
  const wallet         = useWallet()

  const [vaultState,  setVaultState]  = useState<any>(null)
  const [_position,   setPosition]    = useState<any>(null)
  const [stakePool,   setStakePool]   = useState<any>(null)
  const [userStake,   setUserStake]   = useState<any>(null)
  const [balances,    setBalances]    = useState<Record<string, number>>({})
  const [putBal,      setPutBal]      = useState(0)
  const [safeBal,     setSafeBal]     = useState(0)
  const [sxBal,       setSxBal]       = useState(0)
  const [prices,      setPrices]      = useState<Record<string, number>>({ USDCX: 1.0 })
  const [loading,     setLoading]     = useState(true)
  const [lastUpdated, setLastUpdated] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [state, pool, p] = await Promise.all([
        fetchVaultState(connection),
        fetchStakePool(connection),
        fetchAssetPrices(),
      ])
      setVaultState(state)
      setStakePool(pool)
      if (Object.keys(p).length > 0) setPrices(p)
      setLastUpdated(new Date().toLocaleTimeString())

      if (wallet.publicKey) {
        const putMint  = getPutMintPDA()
        const safeMint = getSafeMintPDA()
        const sx1sMint = getSx1safeMintPDA()

        const [pos, stake, putB, safeB, sxB, ...bals] = await Promise.all([
          fetchUserPosition(connection, wallet.publicKey),
          fetchUserStake(connection, wallet.publicKey),
          getTokenBalance(connection, wallet.publicKey, putMint),
          getTokenBalance(connection, wallet.publicKey, safeMint),
          getTokenBalance(connection, wallet.publicKey, sx1sMint),
          ...ASSETS.map(a => getTokenBalance(connection, wallet.publicKey!, a.mint)),
        ])
        setPosition(pos)
        setUserStake(stake)
        setPutBal(putB)
        setSafeBal(safeB)
        setSxBal(sxB)
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

  const totalPutSupply  = vaultState ? vaultState.totalPutSupply  / 1e6 : 0
  const totalFreeSupply = vaultState ? vaultState.totalFreeSupply / 1e6 : 0
  const tvl             = totalPutSupply + totalFreeSupply
  const myPut           = putBal
  const myFree          = safeBal
  const myStaked        = userStake ? userStake.stakedAmount / 1e6 : 0
  const myPending       = userStake ? userStake.rewardsPending / 1e6 : 0
  const apyPct          = stakePool ? (stakePool.apyBps / 100).toFixed(1) : '—'
  const totalWalletUsd  = ASSETS.reduce((s, a) => s + (balances[a.key] || 0) * (prices[a.key] || 0), 0)

  if (loading) {
    return (
      <div>
        <div className="stats-grid">
          {[0,1,2,3].map(i => (
            <div key={i} className="stat-card">
              <div className="skeleton" style={{ width: 60, height: 10, marginBottom: 10 }} />
              <div className="skeleton" style={{ width: 100, height: 24 }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0', color: 'var(--text-2)', gap: 10, fontSize: '0.85rem' }}>
          <span className="loading" /> Loading vault data…
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div className="page-title">Overview</div>
          <div className="page-subtitle">Flying Tulip PUT model · X1 Testnet</div>
        </div>
        <span className={`badge ${vaultState ? 'badge-green' : 'badge-gray'}`}>
          {vaultState ? '● Active' : '○ Uninitialized'}
        </span>
      </div>

      {/* Protocol stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: 14 }}>
        <div className="stat-card">
          <div className="stat-label">Total TVL</div>
          <div className="stat-value">{tvl.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          <div className="stat-sub">X1SAFE tokens</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Staking APY</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{apyPct}%</div>
          <div className="stat-sub">sX1SAFE yield</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">PUT Supply</div>
          <div className="stat-value" style={{ fontSize: '1.1rem' }}>{totalPutSupply.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          <div className="stat-sub">locked receipt</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">FREE Supply</div>
          <div className="stat-value" style={{ fontSize: '1.1rem' }}>{totalFreeSupply.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          <div className="stat-sub">tradeable</div>
        </div>
      </div>

      {/* State machine flow */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-title" style={{ marginBottom: 10 }}>State Machine</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--text-2)' }}>
          <span style={{ padding: '4px 10px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 6 }}>Collateral</span>
          <span style={{ color: 'var(--text-3)' }}>→ Deposit →</span>
          <span style={{ padding: '4px 10px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 6 }}>X1SAFE_PUT</span>
          <span style={{ color: 'var(--text-3)' }}>→ Withdraw →</span>
          <span style={{ padding: '4px 10px', background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)', borderRadius: 6 }}>X1SAFE FREE</span>
          <span style={{ color: 'var(--text-3)' }}>→ Stake / Exit / Re-lock</span>
        </div>
      </div>

      {/* Oracle prices */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Oracle Prices</div>
            <div className="card-subtitle">via xDEX{lastUpdated && ` · ${lastUpdated}`}</div>
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
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>= {x1safePerUnit.toFixed(2)} X1SAFE_PUT</div>
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

      {/* User position */}
      {wallet.connected ? (
        <>
          {/* My balances */}
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-title" style={{ marginBottom: 10 }}>My Balances</div>
            <div className="stats-grid" style={{ margin: 0 }}>
              {[
                { label: 'X1SAFE_PUT',  value: myPut.toFixed(2),    sub: 'locked receipt'  },
                { label: 'X1SAFE FREE', value: myFree.toFixed(2),   sub: 'tradeable'       },
                { label: 'Staked',      value: myStaked.toFixed(2), sub: 'sX1SAFE = ' + sxBal.toFixed(2) },
                { label: 'Rewards',     value: myPending.toFixed(4), sub: 'pending X1SAFE', highlight: myPending > 0 },
              ].map(item => (
                <div key={item.label} className="stat-card">
                  <div className="stat-label">{item.label}</div>
                  <div className="stat-value" style={{ fontSize: '1.1rem', color: (item as any).highlight ? 'var(--success)' : undefined }}>
                    {item.value}
                  </div>
                  <div className="stat-sub">{item.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Wallet asset balances */}
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Wallet Assets</div>
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
            {Object.values(balances).some(v => v > 0) && (
              <>
                <div className="divider" style={{ margin: '12px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>If you deposit all</span>
                  <span style={{ fontWeight: 700, color: 'var(--success)', fontSize: '0.9rem' }}>
                    +{ASSETS.reduce((s, a) => s + calcX1SAFE(balances[a.key] || 0, prices[a.key] || 0), 0).toFixed(2)} X1SAFE_PUT
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
            <div className="empty-state-sub">Connect to see your position, balances, and staking.</div>
          </div>
        </div>
      )}

      <div className="program-footer">
        <span>Program</span>
        <a href={`${EXPLORER}/address/${PROGRAM_ID.toBase58()}`} target="_blank" rel="noopener" className="mono">
          {PROGRAM_ID.toBase58().slice(0, 20)}…
        </a>
        <span className="badge badge-testnet" style={{ fontSize: '0.62rem', padding: '2px 6px' }}>
          {IS_TESTNET ? 'Testnet' : 'Mainnet'}
        </span>
      </div>
    </div>
  )
}
