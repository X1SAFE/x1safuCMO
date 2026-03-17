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
    desc:        'Best for X1 / Solana',
  },
  {
    name:        'Phantom',
    adapterName: 'Phantom',
    deeplink:    `https://phantom.app/ul/browse/${encodeURIComponent(SITE_URL)}?ref=${encodeURIComponent(SITE_URL)}`,
    install:     'https://phantom.app',
    desc:        'Popular Solana wallet',
  },
  {
    name:        'Solflare',
    adapterName: 'Solflare',
    deeplink:    `https://solflare.com/ul/v1/browse/${encodeURIComponent(SITE_URL)}?ref=${encodeURIComponent(SITE_URL)}`,
    install:     'https://solflare.com',
    desc:        'Desktop & mobile',
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
      <div style={{ maxWidth: 400, margin: '32px auto' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--success-dim)', border: '1px solid rgba(34,197,94,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: '1.4rem' }}>
            ✅
          </div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Wallet connected</div>
          <div className="mono" style={{ color: 'var(--text-2)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', marginBottom: 16, wordBreak: 'break-all', fontSize: '0.78rem' }}>
            {publicKey.toString()}
          </div>
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={handleDisconnect}>
            Disconnect
          </button>
        </div>
      </div>
    )
  }

  /* ── Picker ── */
  return (
    <div style={{ maxWidth: 400, margin: '32px auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--bg-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white" opacity="0.9">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
          </svg>
        </div>
        <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 4 }}>Connect wallet</div>
        <div style={{ color: 'var(--text-2)', fontSize: '0.82rem' }}>
          Choose your wallet to access X1SAFE
        </div>
      </div>

      <div className="card" style={{ padding: 8 }}>
        {WALLET_DEFS.map((def, i) => {
          const adapter   = wallets.find(w => w.adapter.name.toLowerCase() === def.adapterName.toLowerCase())
          const isReady   = adapter?.readyState === WalletReadyState.Installed || adapter?.readyState === WalletReadyState.Loadable
          const isLoading = loading === def.name || (connecting && loading === def.name)
          const isMobile  = /iPhone|iPad|Android/i.test(navigator.userAgent)

          return (
            <button
              key={def.name}
              onClick={() => handleConnect(def)}
              disabled={loading !== null || connecting}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                padding: '12px 14px',
                background: 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: loading || connecting ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
                fontFamily: 'inherit',
                color: 'var(--text)',
                borderBottom: i < WALLET_DEFS.length - 1 ? '1px solid var(--border)' : 'none',
                opacity: loading && loading !== def.name ? 0.5 : 1,
              }}
              onMouseEnter={e => { if (!loading && !connecting) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--bg-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0 }}>
                {def.name === 'Backpack' ? '🎒' : def.name === 'Phantom' ? '👻' : '🌟'}
              </div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{def.name}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-2)' }}>{def.desc}</div>
              </div>
              {isLoading ? (
                <span className="loading" style={{ color: 'var(--text-2)' }} />
              ) : isReady ? (
                <span className="badge badge-green">Detected</span>
              ) : (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
                  {isMobile ? 'Open →' : 'Install →'}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {error && (
        <div className="tx-status error" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}

      {/iPhone|iPad|Android/i.test(navigator.userAgent) && (
        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 14 }}>
          On mobile, tap a wallet to open in-app browser
        </p>
      )}
    </div>
  )
}
