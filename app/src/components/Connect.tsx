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
    desc:        'Best for X1 · Recommended',
    emoji:       '🎒',
  },
  {
    name:        'Phantom',
    adapterName: 'Phantom',
    deeplink:    `https://phantom.app/ul/browse/${encodeURIComponent(SITE_URL)}?ref=${encodeURIComponent(SITE_URL)}`,
    install:     'https://phantom.app',
    desc:        'Popular Solana wallet',
    emoji:       '👻',
  },
  {
    name:        'Solflare',
    adapterName: 'Solflare',
    deeplink:    `https://solflare.com/ul/v1/browse/${encodeURIComponent(SITE_URL)}?ref=${encodeURIComponent(SITE_URL)}`,
    install:     'https://solflare.com',
    desc:        'Desktop & mobile',
    emoji:       '🌟',
  },
]

export function Connect() {
  const { wallets, select, connect, disconnect, connected, connecting, publicKey } = useWallet()
  const [error,   setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)

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
        setError(`${def.name} not detected. Install it and refresh.`)
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

  /* ── Connected ── */
  if (connected && publicKey) {
    return (
      <div className="connect-page">
        <div className="connected-card">
          <div className="connected-icon">✓</div>
          <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 6 }}>Wallet connected</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-2)', marginBottom: 16 }}>
            You can now deposit, withdraw, and manage your position.
          </div>
          <div
            className="mono"
            style={{
              color: 'var(--text-2)',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(34,197,94,0.15)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 12px',
              marginBottom: 18,
              wordBreak: 'break-all',
              fontSize: '0.75rem',
              lineHeight: 1.6,
            }}
          >
            {publicKey.toString()}
          </div>
          <button
            className="btn btn-secondary btn-full"
            onClick={handleDisconnect}
          >
            Disconnect wallet
          </button>
        </div>

        <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ fontSize: '1rem' }}>ℹ️</span>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-2)', lineHeight: 1.6 }}>
            Navigate to <strong style={{ color: 'var(--text)' }}>Deposit</strong> to add assets,
            or <strong style={{ color: 'var(--text)' }}>Overview</strong> to see your position.
          </div>
        </div>
      </div>
    )
  }

  /* ── Picker ── */
  return (
    <div className="connect-page">
      <div className="connect-hero">
        <div className="connect-icon-wrap">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white" opacity="0.9">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
          </svg>
        </div>
        <div className="connect-title">Connect your wallet</div>
        <div className="connect-sub">
          Choose a wallet to access X1SAFE.<br/>
          Deposit assets, earn yield, exit anytime.
        </div>
      </div>

      <div className="wallet-list">
        {WALLET_DEFS.map((def) => {
          const adapter   = wallets.find(w => w.adapter.name.toLowerCase() === def.adapterName.toLowerCase())
          const isReady   = adapter?.readyState === WalletReadyState.Installed || adapter?.readyState === WalletReadyState.Loadable
          const isLoading = loading === def.name || (connecting && loading === def.name)
          const isMobile  = /iPhone|iPad|Android/i.test(navigator.userAgent)

          return (
            <button
              key={def.name}
              className="wallet-btn"
              onClick={() => handleConnect(def)}
              disabled={loading !== null || connecting}
            >
              <div className="wallet-btn-icon">{def.emoji}</div>
              <div style={{ flex: 1 }}>
                <div className="wallet-btn-name">{def.name}</div>
                <div className="wallet-btn-desc">{def.desc}</div>
              </div>
              <div className="wallet-btn-right">
                {isLoading ? (
                  <span className="loading" style={{ color: 'var(--text-2)' }} />
                ) : isReady ? (
                  <span className="badge badge-green">Detected</span>
                ) : (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
                    {isMobile ? 'Open →' : 'Install →'}
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {error && (
        <div className="tx-status error" style={{ marginTop: 14 }}>
          <span>⚠</span> {error}
        </div>
      )}

      {/iPhone|iPad|Android/i.test(navigator.userAgent) && (
        <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-3)', marginTop: 16, lineHeight: 1.6 }}>
          On mobile, tap a wallet to open in the in-app browser
        </p>
      )}

      <div style={{ marginTop: 20, padding: '12px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.75rem', color: 'var(--text-3)', lineHeight: 1.7 }}>
        <div style={{ color: 'var(--text-2)', fontWeight: 600, marginBottom: 4 }}>About X1SAFE</div>
        Multi-asset vault on X1 Testnet. Deposit USDC.X, XNT, XEN, or XNM —
        receive X1SAFE tokens at a $1 USD peg.
        1 USD deposited = 1 X1SAFE token.
      </div>
    </div>
  )
}
