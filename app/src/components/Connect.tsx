import { useState, useCallback, useEffect } from 'react'
import { useWallet }                        from '@solana/wallet-adapter-react'
import { WalletReadyState }                 from '@solana/wallet-adapter-base'

const SITE_URL = 'https://x1safu-cmo.vercel.app'

// Wallet definitions with deeplinks for mobile
const WALLET_DEFS = [
  {
    name:     'Backpack',
    adapterName: 'Backpack',
    icon:     '🎒',
    deeplink: `https://backpack.app/ul/v1/browse/${encodeURIComponent(SITE_URL)}`,
    install:  'https://backpack.app',
    hint:     'Best for X1 / Solana mobile',
  },
  {
    name:     'Phantom',
    adapterName: 'Phantom',
    icon:     '👻',
    deeplink: `https://phantom.app/ul/browse/${encodeURIComponent(SITE_URL)}?ref=${encodeURIComponent(SITE_URL)}`,
    install:  'https://phantom.app',
    hint:     'Popular Solana wallet',
  },
  {
    name:     'Solflare',
    adapterName: 'Solflare',
    icon:     '🌟',
    deeplink: `https://solflare.com/ul/v1/browse/${encodeURIComponent(SITE_URL)}?ref=${encodeURIComponent(SITE_URL)}`,
    install:  'https://solflare.com',
    hint:     'Desktop & mobile',
  },
]

export function Connect() {
  const { wallets, select, connect, disconnect, connected, connecting, publicKey } = useWallet()
  const [error,   setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)

  // Auto-clear error after 6s
  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(null), 6000)
    return () => clearTimeout(t)
  }, [error])

  const handleConnect = useCallback(async (def: typeof WALLET_DEFS[0]) => {
    setError(null)
    setLoading(def.name)
    try {
      // Find matching adapter
      const adapter = wallets.find(w =>
        w.adapter.name.toLowerCase() === def.adapterName.toLowerCase()
      )

      const state = adapter?.readyState

      // Not installed / not in browser → try deeplink (mobile)
      if (!adapter || state === WalletReadyState.NotDetected || state === WalletReadyState.Unsupported) {
        // On mobile: try deeplink first
        const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent)
        if (isMobile) {
          window.location.href = def.deeplink
          return
        }
        // On desktop: open install page
        window.open(def.install, '_blank')
        setError(`${def.name} not detected. Install it and refresh.`)
        return
      }

      // Adapter found and ready
      select(def.adapterName as any)
      await new Promise(r => setTimeout(r, 150)) // let adapter settle
      await connect()
    } catch (e: any) {
      const msg = e?.message || `${def.name} connection failed`
      // User reject is not an error we need to show loudly
      if (!msg.toLowerCase().includes('user rejected')) {
        setError(msg)
      }
    } finally {
      setLoading(null)
    }
  }, [wallets, select, connect])

  const handleDisconnect = useCallback(async () => {
    try { await disconnect() } catch {}
    setError(null)
  }, [disconnect])

  // ── Connected state ────────────────────────────────────────────────────────
  if (connected && publicKey) {
    return (
      <div className="card" style={{ maxWidth: 440, margin: '40px auto', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: 10 }}>✅</div>
        <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 6 }}>Wallet Connected</div>
        <div style={{
          fontFamily: 'monospace', fontSize: '0.78rem',
          color: 'var(--text-secondary)', wordBreak: 'break-all',
          background: 'var(--bg-secondary)', padding: '8px 12px',
          borderRadius: 8, marginBottom: 20,
        }}>
          {publicKey.toString()}
        </div>
        <button className="btn btn-secondary" onClick={handleDisconnect}>
          Disconnect
        </button>
      </div>
    )
  }

  // ── Wallet picker ──────────────────────────────────────────────────────────
  return (
    <div className="card" style={{ maxWidth: 440, margin: '40px auto', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem', marginBottom: 8 }}>🔐</div>
      <div style={{ fontWeight: 700, fontSize: '1.25rem', marginBottom: 4 }}>X1SAFE</div>
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: 24 }}>
        Connect your wallet to continue
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {WALLET_DEFS.map(def => {
          const adapter   = wallets.find(w => w.adapter.name.toLowerCase() === def.adapterName.toLowerCase())
          const isReady   = adapter?.readyState === WalletReadyState.Installed ||
                            adapter?.readyState === WalletReadyState.Loadable
          const isLoading = loading === def.name || (connecting && loading === def.name)

          return (
            <button
              key={def.name}
              className="btn btn-secondary btn-full"
              style={{ justifyContent: 'flex-start', gap: 12, padding: '13px 16px' }}
              onClick={() => handleConnect(def)}
              disabled={loading !== null || connecting}
            >
              <span style={{ fontSize: '1.5rem' }}>{def.icon}</span>

              <span style={{ flex: 1, textAlign: 'left' }}>
                <span style={{ fontWeight: 700, display: 'block' }}>{def.name}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{def.hint}</span>
              </span>

              {isLoading ? (
                <span className="loading" />
              ) : isReady ? (
                <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700 }}>
                  Detected ✓
                </span>
              ) : (
                <span style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 600 }}>
                  {/iPhone|iPad|Android/i.test(navigator.userAgent) ? 'Open app →' : 'Install →'}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Mobile deeplink tip */}
      {/iPhone|iPad|Android/i.test(navigator.userAgent) && (
        <div style={{
          marginTop: 16, padding: '10px 14px',
          background: 'var(--bg-secondary)', borderRadius: 8,
          fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'left',
        }}>
          📱 <strong>Mobile:</strong> Nhấn <strong>🎒 Backpack</strong> → trang mở trong app → kết nối ví.
        </div>
      )}

      {error && (
        <div className="tx-status error" style={{ marginTop: 14, textAlign: 'left' }}>
          ❌ {error}
        </div>
      )}
    </div>
  )
}
