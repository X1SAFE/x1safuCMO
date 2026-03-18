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
    desc:        'Recommended for X1',
    tag:         'Best for X1',
    tagColor:    'success',
    svgColor:    '#e53e3e',
    svg: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="6" fill="#e53e3e"/>
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
    desc:        'Popular Solana wallet',
    tag:         null,
    svgColor:    '#ab9ff2',
    svg: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="6" fill="#ab9ff2"/>
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
    desc:        'Desktop & mobile',
    tag:         null,
    svgColor:    '#fc822b',
    svg: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="6" fill="#fc822b"/>
        <circle cx="12" cy="12" r="4" fill="white"/>
        <path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.34 6.34l1.42 1.42M16.24 16.24l1.42 1.42M6.34 17.66l1.42-1.42M16.24 7.76l1.42-1.42" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
]

/* ── Animated checkmark SVG ── */

/* ── Protocol info pills ── */
const INFO_PILLS = [
  { icon: '🔒', label: 'Non-custodial' },
  { icon: '🌐', label: 'X1 Testnet' },
  { icon: '📈', label: '$1 USD peg' },
]

export function Connect() {
  const { wallets, select, connect, disconnect, connected, connecting, publicKey } = useWallet()
  const [error,   setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [copied,  setCopied]  = useState(false)

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(null), 6000)
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
        setError(`${def.name} not found. Install it then refresh this page.`)
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

  /* ─────────── Connected state ─────────── */
  if (connected && publicKey) {
    const addr = publicKey.toString()
    const short = `${addr.slice(0, 6)}...${addr.slice(-6)}`

    return (
      <div className="connect-page">
        {/* Success hero */}
        <div style={{ textAlign: 'center', padding: '36px 20px 24px' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(34,197,94,0.18) 0%, rgba(34,197,94,0.04) 100%)',
            border: '1.5px solid rgba(34,197,94,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 18px', fontSize: '1.8rem',
            boxShadow: '0 0 24px rgba(34,197,94,0.12)',
          }}>
            ✓
          </div>
          <div style={{ fontWeight: 800, fontSize: '1.15rem', letterSpacing: '-0.02em', marginBottom: 6 }}>
            Wallet connected
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-2)', lineHeight: 1.6 }}>
            Your vault is ready. Deposit assets to start earning X1SAFE tokens.
          </div>
        </div>

        {/* Address card */}
        <div style={{
          background: 'var(--bg-elevated)',
          border: '1px solid rgba(34,197,94,0.14)',
          borderRadius: 'var(--radius-lg)',
          padding: '16px 18px',
          marginBottom: 12,
        }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Connected Wallet
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #22c55e20, #16a34a10)',
              border: '1px solid rgba(34,197,94,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1rem', flexShrink: 0,
            }}>
              👛
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="mono" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', letterSpacing: '0.01em' }}>
                {short}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--success)', marginTop: 2 }}>
                ● Active on X1 Testnet
              </div>
            </div>
            <button
              onClick={handleCopy}
              style={{
                background: copied ? 'rgba(34,197,94,0.1)' : 'var(--bg-hover)',
                border: `1px solid ${copied ? 'rgba(34,197,94,0.25)' : 'var(--border)'}`,
                borderRadius: 8,
                padding: '6px 10px',
                color: copied ? 'var(--success)' : 'var(--text-2)',
                fontSize: '0.72rem',
                fontFamily: 'inherit',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
                flexShrink: 0,
              }}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Quick nav cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          {[
            { icon: '↓', label: 'Deposit', sub: 'Add assets to vault', color: 'var(--success)', bg: 'rgba(34,197,94,0.06)' },
            { icon: '◈', label: 'Overview', sub: 'View your position', color: 'var(--blue)', bg: 'rgba(59,130,246,0.06)' },
          ].map(item => (
            <div key={item.label} style={{
              background: item.bg,
              border: `1px solid ${item.color}22`,
              borderRadius: 'var(--radius)',
              padding: '14px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '1.4rem', marginBottom: 4 }}>{item.icon}</div>
              <div style={{ fontWeight: 700, fontSize: '0.82rem', color: item.color }}>{item.label}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', marginTop: 2 }}>{item.sub}</div>
            </div>
          ))}
        </div>

        {/* Disconnect */}
        <button className="btn btn-secondary btn-full" onClick={handleDisconnect}>
          Disconnect wallet
        </button>
      </div>
    )
  }

  /* ─────────── Connect picker ─────────── */
  return (
    <div className="connect-page">

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '28px 16px 20px' }}>
        {/* Animated shield */}
        <div style={{
          width: 72, height: 72,
          borderRadius: 20,
          background: 'linear-gradient(135deg, #111 0%, #0d0d0d 100%)',
          border: '1px solid #2a2a2a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 18px',
          boxShadow: '0 0 0 8px rgba(34,197,94,0.04), 0 0 0 16px rgba(34,197,94,0.02)',
          position: 'relative' as const,
        }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L3 6v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V6l-9-4z" fill="url(#shieldGrad)"/>
            <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <defs>
              <linearGradient id="shieldGrad" x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#22c55e"/>
                <stop offset="100%" stopColor="#16a34a"/>
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div style={{ fontWeight: 800, fontSize: '1.3rem', letterSpacing: '-0.03em', marginBottom: 8 }}>
          Connect your wallet
        </div>
        <div style={{ fontSize: '0.83rem', color: 'var(--text-2)', lineHeight: 1.65, maxWidth: 280, margin: '0 auto' }}>
          Access your X1SAFE vault. Deposit, earn, and withdraw at any time.
        </div>

        {/* Info pills */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 14, flexWrap: 'wrap' as const }}>
          {INFO_PILLS.map(p => (
            <div key={p.label} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 20,
              padding: '4px 10px',
              fontSize: '0.7rem',
              color: 'var(--text-2)',
              fontWeight: 500,
            }}>
              <span>{p.icon}</span>
              <span>{p.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Wallet list */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        marginBottom: 14,
      }}>
        <div style={{
          padding: '10px 16px 8px',
          fontSize: '0.68rem',
          fontWeight: 600,
          color: 'var(--text-3)',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.08em',
          borderBottom: '1px solid var(--border)',
        }}>
          Choose wallet
        </div>

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
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                width: '100%',
                padding: '15px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: isLast ? 'none' : '1px solid var(--border)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                color: 'var(--text)',
                textAlign: 'left' as const,
                transition: 'background 0.15s',
                opacity: (loading !== null || connecting) && !isActive ? 0.45 : 1,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {/* Wallet logo */}
              <div style={{
                width: 44, height: 44,
                borderRadius: 12,
                overflow: 'hidden',
                flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
              }}>
                {def.svg}
              </div>

              {/* Name + desc */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {def.name}
                  {def.tag && (
                    <span style={{
                      fontSize: '0.62rem', fontWeight: 700,
                      background: 'rgba(34,197,94,0.1)',
                      color: 'var(--success)',
                      border: '1px solid rgba(34,197,94,0.2)',
                      borderRadius: 20,
                      padding: '1px 7px',
                      letterSpacing: '0.04em',
                    }}>
                      {def.tag}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>{def.desc}</div>
              </div>

              {/* Status */}
              <div style={{ marginLeft: 'auto', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                {isActive ? (
                  <span className="loading" style={{ width: 16, height: 16 }} />
                ) : isReady ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 600,
                      background: 'rgba(34,197,94,0.1)',
                      color: 'var(--success)',
                      border: '1px solid rgba(34,197,94,0.2)',
                      borderRadius: 20, padding: '2px 8px',
                    }}>
                      ✓ Detected
                    </span>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M5 7l2 2 4-4" stroke="var(--success)" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                ) : (
                  <div style={{
                    fontSize: '0.72rem', fontWeight: 600,
                    color: 'var(--text-2)',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    borderRadius: 20, padding: '3px 10px',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    {isMobile ? 'Open' : 'Install'}
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5h6M5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 8,
          background: 'rgba(239,68,68,0.06)',
          border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 'var(--radius)',
          padding: '12px 14px', marginBottom: 12,
          fontSize: '0.8rem', color: 'var(--danger)', lineHeight: 1.5,
        }}>
          <span>⚠</span> {error}
        </div>
      )}

      {/* Mobile tip */}
      {isMobile && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          marginBottom: 12,
          fontSize: '0.75rem', color: 'var(--text-2)',
        }}>
          <span style={{ fontSize: '1rem' }}>📱</span>
          Tap a wallet to open in its built-in browser
        </div>
      )}

      {/* About box */}
      <div style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L3 6v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V6l-9-4z" fill="#22c55e" opacity="0.8"/>
          </svg>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-2)' }}>About X1SAFE</span>
        </div>
        <div style={{ padding: '12px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            {[
              { label: 'Supported Assets', value: 'USDC.X · XNT · XEN · XNM' },
              { label: 'Token Peg',         value: '1 X1SAFE = $1 USD' },
              { label: 'Exchange Rate',     value: '1 USD → 1 X1SAFE' },
              { label: 'Network',           value: 'X1 Testnet' },
            ].map(item => (
              <div key={item.label}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', textTransform: 'uppercase' as const, letterSpacing: '0.07em', fontWeight: 600, marginBottom: 2 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-2)', fontWeight: 600 }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>
          <div style={{
            fontSize: '0.72rem', color: 'var(--text-3)', lineHeight: 1.6,
            paddingTop: 10, borderTop: '1px solid var(--border)',
          }}>
            X1SAFE is a non-custodial vault. You maintain full ownership of your assets at all times. Contracts are open-source and deployed on X1 Testnet.
          </div>
        </div>
      </div>

    </div>
  )
}
