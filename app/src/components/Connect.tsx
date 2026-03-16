import { useState, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'

declare global {
  interface Window {
    backpack?: any
    xnft?: any
    solana?: any
    phantom?: any
  }
}

type WalletOption = 'backpack' | 'phantom' | 'solflare'

export function Connect() {
  const { wallets, select, connect, connected, publicKey, disconnect } = useWallet()
  const [error, setError]     = useState<string | null>(null)
  const [bpKey, setBpKey]     = useState<string | null>(null)
  const [loading, setLoading] = useState<WalletOption | null>(null)

  const isConnected = connected || !!bpKey
  const activeKey   = publicKey?.toString() || bpKey

  const connectBackpack = useCallback(async () => {
    setLoading('backpack')
    setError(null)
    try {
      const p = window.backpack?.solana ?? window.backpack ?? window.xnft?.solana
      if (!p) throw new Error('Backpack not detected. Please open inside the Backpack app.')
      const resp = await p.connect()
      const key = resp?.publicKey?.toString() ?? p.publicKey?.toString()
      if (!key) throw new Error('Could not get public key from Backpack')
      setBpKey(key)
    } catch (e: any) {
      setError(e?.message || 'Backpack connection failed')
    } finally {
      setLoading(null)
    }
  }, [])

  const connectPhantom = useCallback(async () => {
    setLoading('phantom')
    setError(null)
    try {
      const p = window.phantom?.solana ?? (window.solana?.isPhantom ? window.solana : null)
      if (!p) throw new Error('Phantom not detected. Please install Phantom wallet.')
      const resp = await p.connect()
      const key = resp?.publicKey?.toString()
      if (!key) throw new Error('Could not get public key from Phantom')
      setBpKey(key)
    } catch (e: any) {
      setError(e?.message || 'Phantom connection failed')
    } finally {
      setLoading(null)
    }
  }, [])

  const connectSolflare = useCallback(async () => {
    setLoading('solflare')
    setError(null)
    try {
      const w = wallets.find(x => x.adapter.name === 'Solflare')
      if (!w) throw new Error('Solflare not detected. Please install Solflare wallet.')
      select(w.adapter.name as any)
      await new Promise(r => setTimeout(r, 300))
      await connect()
    } catch (e: any) {
      setError(e?.message || 'Solflare connection failed')
    } finally {
      setLoading(null)
    }
  }, [wallets, select, connect])

  const disconnectAll = useCallback(async () => {
    try {
      if (bpKey) {
        const p = window.backpack?.solana ?? window.backpack ?? window.xnft?.solana ?? window.phantom?.solana ?? window.solana
        if (p?.disconnect) await p.disconnect()
        setBpKey(null)
      }
      if (connected) await disconnect()
      setError(null)
    } catch {}
  }, [bpKey, connected, disconnect])

  const hasBackpack = typeof window !== 'undefined' && (window.backpack || window.xnft?.solana)
  const hasPhantom  = typeof window !== 'undefined' && (window.phantom?.solana || window.solana?.isPhantom)

  if (isConnected) {
    return (
      <div className="card" style={{ maxWidth: 420, margin: '40px auto', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: 12 }}>✅</div>
        <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 8 }}>Wallet Connected</div>
        <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-secondary)', wordBreak: 'break-all', background: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: 8, marginBottom: 20 }}>
          {activeKey}
        </div>
        <button className="btn btn-secondary" onClick={disconnectAll}>Disconnect</button>
      </div>
    )
  }

  return (
    <div className="card" style={{ maxWidth: 420, margin: '40px auto', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem', marginBottom: 8 }}>🔐</div>
      <div style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: 4 }}>X1SAFE</div>
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 24 }}>
        Choose your wallet to connect
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Backpack */}
        <button
          className="btn btn-secondary btn-full"
          style={{ justifyContent: 'flex-start', gap: 12, padding: '12px 16px' }}
          onClick={connectBackpack}
          disabled={loading !== null}
        >
          <span style={{ fontSize: '1.4rem' }}>🎒</span>
          <span style={{ flex: 1, textAlign: 'left', fontWeight: 600 }}>Backpack</span>
          {loading === 'backpack'
            ? <span className="loading" />
            : hasBackpack
              ? <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>Detected</span>
              : <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Open in app</span>
          }
        </button>

        {/* Phantom */}
        <button
          className="btn btn-secondary btn-full"
          style={{ justifyContent: 'flex-start', gap: 12, padding: '12px 16px' }}
          onClick={connectPhantom}
          disabled={loading !== null}
        >
          <span style={{ fontSize: '1.4rem' }}>👻</span>
          <span style={{ flex: 1, textAlign: 'left', fontWeight: 600 }}>Phantom</span>
          {loading === 'phantom'
            ? <span className="loading" />
            : hasPhantom
              ? <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>Detected</span>
              : <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Not detected</span>
          }
        </button>

        {/* Solflare */}
        <button
          className="btn btn-secondary btn-full"
          style={{ justifyContent: 'flex-start', gap: 12, padding: '12px 16px' }}
          onClick={connectSolflare}
          disabled={loading !== null}
        >
          <span style={{ fontSize: '1.4rem' }}>🌟</span>
          <span style={{ flex: 1, textAlign: 'left', fontWeight: 600 }}>Solflare</span>
          {loading === 'solflare'
            ? <span className="loading" />
            : <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Extension</span>
          }
        </button>

      </div>

      {error && (
        <div className="tx-status error" style={{ marginTop: 14, textAlign: 'left' }}>❌ {error}</div>
      )}
    </div>
  )
}
