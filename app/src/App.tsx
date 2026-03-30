import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import {
  ConnectionProvider,
  WalletProvider,
  useWallet,
} from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets'
import { BackpackWalletAdapter } from '@solana/wallet-adapter-backpack'
import { WalletReadyState }      from '@solana/wallet-adapter-base'
import '@solana/wallet-adapter-react-ui/styles.css'
import './App.css'

import { Dashboard }   from './components/Dashboard'
import { Deposit }     from './components/Deposit'
import { Withdraw }    from './components/Withdraw'
import { Exit }        from './components/Exit'
import { Redeposit }   from './components/Redeposit'
import { Stake }       from './components/Stake'
import { Whitepaper }  from './components/Whitepaper'
import { RPC_URL, IS_TESTNET } from './lib/vault'

declare global {
  interface Window { backpack?: any; xnft?: any }
}

type Tab = 'dashboard' | 'deposit' | 'withdraw' | 'exit' | 'redeposit' | 'stake' | 'whitepaper'

const TABS_PRIMARY: { key: Tab; label: string; icon: string }[] = [
  { key: 'deposit',   label: 'Deposit',  icon: '↓' },
  { key: 'withdraw',  label: 'Withdraw', icon: '↑' },
  { key: 'dashboard', label: 'Overview', icon: '◈' },
]
const TABS_SECONDARY: { key: Tab; label: string; icon: string }[] = [
  { key: 'exit',       label: 'Exit',       icon: '✕' },
  { key: 'redeposit',  label: 'Re-lock',    icon: '⟳' },
  { key: 'stake',      label: 'Stake',      icon: '⬡' },
  { key: 'whitepaper', label: 'Whitepaper', icon: '📄' },
]

const SITE_URL = 'https://x1safu-cmo.vercel.app'
const WALLET_DEFS = [
  {
    name: 'Backpack', adapterName: 'Backpack',
    deeplink: `https://backpack.app/ul/v1/browse/${encodeURIComponent(SITE_URL)}`,
    install:  'https://backpack.app',
    tag: 'Best for X1',
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
    name: 'Phantom', adapterName: 'Phantom',
    deeplink: `https://phantom.app/ul/browse/${encodeURIComponent(SITE_URL)}?ref=${encodeURIComponent(SITE_URL)}`,
    install:  'https://phantom.app',
    tag: null,
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
    name: 'Solflare', adapterName: 'Solflare',
    deeplink: `https://solflare.com/ul/v1/browse/${encodeURIComponent(SITE_URL)}?ref=${encodeURIComponent(SITE_URL)}`,
    install:  'https://solflare.com',
    tag: null,
    svg: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="6" fill="#fc822b"/>
        <circle cx="12" cy="12" r="3.5" fill="white"/>
        <path d="M12 5v1.5M12 17.5V19M5 12h1.5M17.5 12H19M6.9 6.9l1.06 1.06M16.04 16.04l1.06 1.06M6.9 17.1l1.06-1.06M16.04 7.96l1.06-1.06" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
  },
]

/* ── Compact Wallet Button + Dropdown (header) ── */
function WalletButton() {
  const { wallets, select, connect, disconnect, connected, connecting, publicKey } = useWallet()
  const [open,    setOpen]    = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [copied,  setCopied]  = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent)

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleConnect = useCallback(async (def: typeof WALLET_DEFS[0]) => {
    setLoading(def.name)
    try {
      const adapter = wallets.find(w => w.adapter.name.toLowerCase() === def.adapterName.toLowerCase())
      const state   = adapter?.readyState
      if (!adapter || state === WalletReadyState.NotDetected || state === WalletReadyState.Unsupported) {
        if (isMobile) { window.location.href = def.deeplink; return }
        window.open(def.install, '_blank')
        setOpen(false)
        return
      }
      select(def.adapterName as any)
      await new Promise(r => setTimeout(r, 150))
      await connect()
      setOpen(false)
    } catch (e: any) {
      const msg = e?.message || ''
      if (!msg.toLowerCase().includes('user rejected')) console.warn(msg)
    } finally { setLoading(null) }
  }, [wallets, select, connect, isMobile])

  const handleDisconnect = useCallback(async () => {
    try { await disconnect() } catch {}
    setOpen(false)
  }, [disconnect])

  const handleCopy = () => {
    if (!publicKey) return
    navigator.clipboard.writeText(publicKey.toString()).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }

  const short = publicKey
    ? `${publicKey.toBase58().slice(0,4)}…${publicKey.toBase58().slice(-4)}`
    : null

  return (
    <div ref={ref} style={{ position: 'relative' }}>

      {/* Trigger button */}
      {connected && short ? (
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: open ? 'var(--bg-elevated)' : 'var(--bg-elevated)',
            border: `1px solid ${open ? 'var(--border-focus)' : 'var(--border)'}`,
            borderRadius: 20,
            padding: '5px 12px 5px 8px',
            color: 'var(--text)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: '0.75rem',
            fontWeight: 600,
            transition: 'all 0.15s',
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', flexShrink: 0, boxShadow: '0 0 6px var(--success)' }} />
          <span className="mono">{short}</span>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: 0.4, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
            <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </button>
      ) : (
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: open ? 'rgba(34,197,94,0.1)' : 'rgba(34,197,94,0.07)',
            border: `1px solid ${open ? 'rgba(34,197,94,0.35)' : 'rgba(34,197,94,0.2)'}`,
            borderRadius: 20,
            padding: '6px 14px',
            color: 'var(--success)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: '0.78rem',
            fontWeight: 700,
            transition: 'all 0.15s',
          }}
        >
          {connecting ? (
            <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid rgba(34,197,94,0.3)', borderTop: '2px solid var(--success)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }}/>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 6v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V6l-9-4z" fill="currentColor" opacity="0.9"/>
            </svg>
          )}
          Connect
        </button>
      )}

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: 240,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          overflow: 'hidden',
          zIndex: 999,
          animation: 'fadeSlideDown 0.12s ease',
        }}>

          {connected && publicKey ? (
            /* Connected dropdown */
            <>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  Connected · X1 Testnet
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 6px var(--success)', flexShrink: 0 }}/>
                  <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {publicKey.toBase58()}
                  </span>
                  <button
                    onClick={handleCopy}
                    style={{
                      background: copied ? 'rgba(34,197,94,0.1)' : 'var(--bg-hover)',
                      border: `1px solid ${copied ? 'rgba(34,197,94,0.2)' : 'var(--border)'}`,
                      borderRadius: 6, padding: '3px 8px',
                      color: copied ? 'var(--success)' : 'var(--text-3)',
                      fontSize: '0.68rem', fontWeight: 700,
                      cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                    }}
                  >
                    {copied ? '✓' : 'Copy'}
                  </button>
                </div>
              </div>
              <button
                onClick={handleDisconnect}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '11px 14px',
                  background: 'transparent', border: 'none',
                  color: 'var(--danger)', fontSize: '0.8rem', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Disconnect
              </button>
            </>
          ) : (
            /* Wallet picker dropdown */
            <>
              <div style={{ padding: '10px 14px 8px', fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--border)' }}>
                Choose wallet
              </div>
              {WALLET_DEFS.map((def, idx) => {
                const adapter = wallets.find(w => w.adapter.name.toLowerCase() === def.adapterName.toLowerCase())
                const isReady = adapter?.readyState === WalletReadyState.Installed || adapter?.readyState === WalletReadyState.Loadable
                const isActive = loading === def.name
                return (
                  <button
                    key={def.name}
                    onClick={() => handleConnect(def)}
                    disabled={loading !== null || connecting}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', padding: '11px 14px',
                      background: 'transparent', border: 'none',
                      borderBottom: idx < WALLET_DEFS.length - 1 ? '1px solid var(--border)' : 'none',
                      color: 'var(--text)', cursor: 'pointer',
                      fontFamily: 'inherit', textAlign: 'left',
                      transition: 'background 0.12s',
                      opacity: loading !== null && !isActive ? 0.45 : 1,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 9, overflow: 'hidden', flexShrink: 0, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-elevated)' }}>
                      {def.svg}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>{def.name}</span>
                        {def.tag && (
                          <span style={{ fontSize: '0.58rem', fontWeight: 700, background: 'rgba(34,197,94,0.1)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '1px 5px' }}>
                            {def.tag}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.67rem', color: 'var(--text-3)', marginTop: 1 }}>
                        {isReady ? '● Detected' : isMobile ? 'Tap to open' : 'Not installed'}
                      </div>
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      {isActive ? (
                        <span style={{ display: 'inline-block', width: 13, height: 13, border: '2px solid var(--border)', borderTop: '2px solid var(--success)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }}/>
                      ) : isReady ? (
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--success)', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '2px 7px' }}>✓</span>
                      ) : (
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-3)' }}>→</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function App() {
  const { connected } = useWallet()
  const bpConnected = typeof window !== 'undefined' &&
    (window.backpack?.publicKey || window.xnft?.solana?.publicKey)
  const isConnected = connected || !!bpConnected

  const [tab, setTab] = useState<Tab>('dashboard')

  return (
    <div className="app-shell">
      {/* ── Header ── */}
      <header className="app-header">
        <div className="header-inner">
          <div className="brand">
            <div className="brand-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
              </svg>
            </div>
            <div>
              <div className="brand-name">X1SAFE</div>
              <div className="brand-sub">Multi-Asset Vault · X1 Testnet</div>
            </div>
          </div>
          <div className="header-right">
            {IS_TESTNET && (
              <span className="badge badge-testnet">Testnet</span>
            )}
            {/* Compact wallet button — replaces the old Connect tab */}
            <WalletButton />
          </div>
        </div>
      </header>

      {/* ── Tab Nav (no Connect tab) ── */}
      <nav className="tab-nav">
        {/* Primary row */}
        <div className="tab-row-primary">
          {TABS_PRIMARY.map(t => (
            <button
              key={t.key}
              data-tab={t.key}
              className={`tab-btn${tab === t.key ? ' active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              <span className="tab-icon">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
        {/* Secondary row */}
        <div className="tab-row-secondary">
          {TABS_SECONDARY.map(t => (
            <button
              key={t.key}
              data-tab={t.key}
              className={`tab-btn${tab === t.key ? ' active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              <span className="tab-icon">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Content ── */}
      <main className="app-main">
        {!isConnected && (
          <div style={{
            margin: '24px 20px 0',
            padding: '14px 16px',
            background: 'rgba(34,197,94,0.04)',
            border: '1px solid rgba(34,197,94,0.15)',
            borderRadius: 'var(--radius)',
            display: 'flex', alignItems: 'center', gap: 10,
            fontSize: '0.82rem', color: 'var(--text-2)',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 6v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V6l-9-4z" fill="#22c55e" opacity="0.7"/>
            </svg>
            <span>Connect your wallet using the button in the top-right to get started.</span>
          </div>
        )}
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'deposit'   && <Deposit />}
        {tab === 'withdraw'  && <Withdraw />}
        {tab === 'exit'      && <Exit />}
        {tab === 'redeposit' && <Redeposit />}
        {tab === 'stake'      && <Stake />}
        {tab === 'whitepaper' && <Whitepaper />}
      </main>
    </div>
  )
}

export default function AppWithWallet() {
  const endpoint = useMemo(() => RPC_URL, [])
  const wallets  = useMemo(() => [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
    new BackpackWalletAdapter(),
  ], [])

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          <App />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
