import { useState, useCallback, useEffect } from 'react'
import { useWallet }                        from '@solana/wallet-adapter-react'
import { WalletReadyState }                 from '@solana/wallet-adapter-base'

const SITE_URL = 'https://x1safu-cmo.vercel.app'

const WALLET_DEFS = [
  {
    name:        'Backpack',
    adapterName: 'Backpack',
    deeplink:    `https://backpack.app/ul/v1/browse/${encodeURIComponent(SITE_URL)}`,
    install:     'https://backpack.app',
    tag:         'Best for X1',
    svg: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="7" fill="#e53e3e"/>
        <path d="M7 9.5C7 7.567 8.567 6 10.5 6H13.5C15.433 6 17 7.567 17 9.5V17H7V9.5Z" fill="white"/>
        <path d="M9 6C9 4.895 9.895 4 11 4H13C14.105 4 15 4.895 15 6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="12" cy="13" r="2" fill="#e53e3e"/>
      </svg>
    ),
  },
  {
    name:        'Phantom',
    adapterName: 'Phantom',
    deeplink:    `https://phantom.app/ul/browse/${encodeURIComponent(SITE_URL)}?ref=${encodeURIComponent(SITE_URL)}`,
    install:     'https://phantom.app',
    tag:         null,
    svg: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="7" fill="#ab9ff2"/>
        <path d="M12 4C7.582 4 4 7.582 4 12c0 4.418 3.582 8 8 8 1.008 0 1.97-.188 2.856-.528A5.985 5.985 0 0 0 20 14c0-3.314-2.686-6-6-6a5.985 5.985 0 0 0-3.528 1.144A7.963 7.963 0 0 1 12 4z" fill="white" opacity="0.9"/>
        <circle cx="9.5" cy="11.5" r="1.2" fill="#ab9ff2"/>
        <circle cx="14.5" cy="11.5" r="1.2" fill="#ab9ff2"/>
      </svg>
    ),
  },
  {
    name:        'Solflare',
    adapterName: 'Solflare',
    deeplink:    `https://solflare.com/ul/v1/browse/${encodeURIComponent(SITE_URL)}?ref=${encodeURIComponent(SITE_URL)}`,
    install:     'https://solflare.com',
    tag:         null,
    svg: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="7" fill="#fc822b"/>
        <circle cx="12" cy="12" r="3.5" fill="white"/>
        <path d="M12 5v1.5M12 17.5V19M5 12h1.5M17.5 12H19M6.9 6.9l1.06 1.06M16.04 16.04l1.06 1.06M6.9 17.1l1.06-1.06M16.04 7.96l1.06-1.06" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
  },
]

export function Connect() {
  const { wallets, select, connect, disconnect, connected, connecting, publicKey } = useWallet()
  const [error,   setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [copied,  setCopied]  = useState(false)

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(null), 5000)
    return () => clearTimeout(t)
  }, [error])

  const handleConnect = useCallback(async (def: typeof WALLET_DEFS[0]) => {
    setError(null)
    setLoading(def.name)
    try {
      const adapter = wallets.find(w =>
        w.adapter.name.toLowerCase() === def.adapterName.toLowerCase()
      )
      const state = adapter?.readyState
      if (!adapter || state === WalletReadyState.NotDetected || state === WalletReadyState.Unsupported) {
        const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent)
        if (isMobile) { window.location.href = def.deeplink; return }
        window.open(def.install, '_blank')
        setError(`${def.name} not found — install it then refresh.`)
        return
      }
      select(def.adapterName as any)
      await new Promise(r => setTimeout(r, 150))
      await connect()
    } catch (e: any) {
      const msg = e?.message || `${def.name} connection failed`
      if (!msg.toLowerCase().includes('user rejected')) setError(msg)
    } finally {
      setLoading(null)
    }
  }, [wallets, select, connect])

  const handleDisconnect = useCallback(async () => {
    try { await disconnect() } catch {}
    setError(null)
  }, [disconnect])

  const handleCopy = () => {
    if (!publicKey) return
    navigator.clipboard.writeText(publicKey.toString()).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent)

  /* ── Connected ── */
  if (connected && publicKey) {
    const addr  = publicKey.toString()
    const short = `${addr.slice(0, 6)}…${addr.slice(-6)}`

    return (
      <div className="tab-content" style={{ maxWidth: 420, margin: '0 auto' }}>

        {/* Status hero */}
        <div style={{ textAlign: 'center', padding: '32px 0 24px' }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(34,197,94,0.15) 0%, transparent 70%)',
            border: '1.5px solid rgba(34,197,94,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px',
            fontSize: '1.6rem',
            boxShadow: '0 0 20px rgba(34,197,94,0.1)',
          }}>✓</div>
          <div style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em', marginBottom: 4 }}>
            Wallet connected
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}>
            ● X1 Testnet · Ready
          </div>
        </div>

        {/* Address */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--bg-elevated)',
          border: '1px solid rgba(34,197,94,0.15)',
          borderRadius: 'var(--radius)',
          padding: '12px 14px',
          marginBottom: 20,
        }}>
          <span style={{ fontSize: '1.1rem' }}>👛</span>
          <span className="mono" style={{ flex: 1, fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-2)' }}>
            {short}
          </span>
          <button
            onClick={handleCopy}
            style={{
              background: copied ? 'rgba(34,197,94,0.1)' : 'var(--bg-hover)',
              border: `1px solid ${copied ? 'rgba(34,197,94,0.25)' : 'var(--border)'}`,
              borderRadius: 6, padding: '5px 10px',
              color: copied ? 'var(--success)' : 'var(--text-3)',
              fontSize: '0.72rem', fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>

        {/* Quick nav */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          {[
            { icon: '↓', label: 'Deposit',  sub: 'Add to vault',    color: '#22c55e', bg: 'rgba(34,197,94,0.06)'  },
            { icon: '◈', label: 'Overview', sub: 'Your position',   color: '#3b82f6', bg: 'rgba(59,130,246,0.06)' },
            { icon: '↑', label: 'Withdraw', sub: 'PUT → X1SAFE',    color: '#a855f7', bg: 'rgba(168,85,247,0.06)' },
            { icon: '✕', label: 'Exit',     sub: 'Close vault',     color: '#f59e0b', bg: 'rgba(245,158,11,0.06)' },
          ].map(item => (
            <div key={item.label} style={{
              background: item.bg,
              border: `1px solid ${item.color}22`,
              borderRadius: 'var(--radius)',
              padding: '14px 12px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '1.2rem', color: item.color, fontWeight: 800, marginBottom: 4 }}>{item.icon}</div>
              <div style={{ fontWeight: 700, fontSize: '0.8rem', color: item.color }}>{item.label}</div>
              <div style={{ fontSize: '0.66rem', color: 'var(--text-3)', marginTop: 2 }}>{item.sub}</div>
            </div>
          ))}
        </div>

        <button className="btn btn-secondary btn-full" onClick={handleDisconnect}
          style={{ fontSize: '0.82rem', color: 'var(--text-3)' }}>
          Disconnect
        </button>
      </div>
    )
  }

  /* ── Connect picker ── */
  return (
    <div className="tab-content" style={{ maxWidth: 420, margin: '0 auto' }}>

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '28px 0 22px' }}>
        <div style={{
          width: 64, height: 64, borderRadius: 18,
          background: 'linear-gradient(135deg, #111, #0d0d0d)',
          border: '1px solid #2a2a2a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
          boxShadow: '0 0 0 8px rgba(34,197,94,0.04)',
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L3 6v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V6l-9-4z" fill="url(#sg)"/>
            <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <defs>
              <linearGradient id="sg" x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#22c55e"/>
                <stop offset="100%" stopColor="#16a34a"/>
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.03em', marginBottom: 6 }}>
          Connect Wallet
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-3)', lineHeight: 1.6 }}>
          Deposit · Earn · Withdraw on X1 Testnet
        </div>
      </div>

      {/* Wallet list */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        marginBottom: 12,
      }}>
        {WALLET_DEFS.map((def, idx) => {
          const adapter  = wallets.find(w => w.adapter.name.toLowerCase() === def.adapterName.toLowerCase())
          const isReady  = adapter?.readyState === WalletReadyState.Installed || adapter?.readyState === WalletReadyState.Loadable
          const isActive = loading === def.name || (connecting && loading === def.name)
          const isLast   = idx === WALLET_DEFS.length - 1

          return (
            <button
              key={def.name}
              onClick={() => handleConnect(def)}
              disabled={loading !== null || connecting}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                width: '100%', padding: '14px 16px',
                background: 'transparent', border: 'none',
                borderBottom: isLast ? 'none' : '1px solid var(--border)',
                cursor: 'pointer', fontFamily: 'inherit',
                color: 'var(--text)', textAlign: 'left',
                transition: 'background 0.12s',
                opacity: (loading !== null || connecting) && !isActive ? 0.4 : 1,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {/* Icon */}
              <div style={{
                width: 42, height: 42, borderRadius: 11,
                overflow: 'hidden', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
              }}>
                {def.svg}
              </div>

              {/* Name + tag */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{def.name}</span>
                  {def.tag && (
                    <span style={{
                      fontSize: '0.6rem', fontWeight: 700,
                      background: 'rgba(34,197,94,0.1)', color: 'var(--success)',
                      border: '1px solid rgba(34,197,94,0.2)',
                      borderRadius: 20, padding: '1px 7px', letterSpacing: '0.04em',
                    }}>
                      {def.tag}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
                  {isReady ? '● Detected' : isMobile ? 'Tap to open' : 'Click to install'}
                </div>
              </div>

              {/* Right badge */}
              <div style={{ flexShrink: 0 }}>
                {isActive ? (
                  <span style={{
                    display: 'inline-block', width: 16, height: 16,
                    border: '2px solid var(--border)', borderTop: '2px solid var(--success)',
                    borderRadius: '50%', animation: 'spin 0.7s linear infinite',
                  }}/>
                ) : isReady ? (
                  <span style={{
                    fontSize: '0.68rem', fontWeight: 700,
                    background: 'rgba(34,197,94,0.1)', color: 'var(--success)',
                    border: '1px solid rgba(34,197,94,0.2)',
                    borderRadius: 20, padding: '3px 9px',
                  }}>
                    ✓
                  </span>
                ) : (
                  <span style={{
                    fontSize: '0.68rem', fontWeight: 600,
                    color: 'var(--text-3)',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 20, padding: '3px 9px',
                  }}>
                    {isMobile ? 'Open →' : 'Install →'}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          display: 'flex', gap: 8, alignItems: 'flex-start',
          background: 'rgba(239,68,68,0.06)',
          border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 'var(--radius)',
          padding: '11px 13px', marginBottom: 10,
          fontSize: '0.78rem', color: 'var(--danger)', lineHeight: 1.5,
        }}>
          <span>⚠</span> {error}
        </div>
      )}

      {/* Mobile tip */}
      {isMobile && !error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 13px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          fontSize: '0.73rem', color: 'var(--text-3)',
        }}>
          <span>📱</span> Tap a wallet to open in its browser
        </div>
      )}

      {/* Footer pills */}
      {!isMobile && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
          {['🔒 Non-custodial', '🌐 X1 Testnet', '⚡ Instant'].map(p => (
            <div key={p} style={{
              background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              borderRadius: 20, padding: '3px 10px',
              fontSize: '0.68rem', color: 'var(--text-3)', fontWeight: 500,
            }}>
              {p}
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
