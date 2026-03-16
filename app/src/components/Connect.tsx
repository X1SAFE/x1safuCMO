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

export function Connect() {
  const { wallets, select, connect, connected, publicKey, disconnect } = useWallet()
  const [error, setError]     = useState<string | null>(null)
  const [bpKey, setBpKey]     = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const isConnected = connected || !!bpKey
  const activeKey   = publicKey?.toString() || bpKey

  const detectProvider = () => {
    if (typeof window === 'undefined') return null
    if (window.backpack)                return 'backpack'
    if (window.xnft?.solana)            return 'xnft'
    if (window.phantom?.solana)         return 'phantom'
    if (window.solana?.isPhantom)       return 'phantom-legacy'
    const sf = wallets.find(x => x.adapter.name === 'Solflare')
    if (sf) return 'solflare'
    return null
  }

  const connectWallet = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const provider = detectProvider()
      if (provider === 'backpack') {
        const p = window.backpack?.solana || window.backpack
        const resp = await p.connect()
        setBpKey(resp?.publicKey?.toString() || p.publicKey?.toString())
      } else if (provider === 'xnft') {
        const p = window.xnft.solana
        const resp = await p.connect()
        setBpKey(resp?.publicKey?.toString() || p.publicKey?.toString())
      } else if (provider === 'phantom' || provider === 'phantom-legacy') {
        const p = window.phantom?.solana || window.solana
        const resp = await p.connect()
        setBpKey(resp?.publicKey?.toString())
      } else if (provider === 'solflare') {
        const w = wallets.find(x => x.adapter.name === 'Solflare')!
        select(w.adapter.name as any)
        await new Promise(r => setTimeout(r, 300))
        await connect()
      } else {
        throw new Error('No wallet detected. Please open inside Backpack app or install a wallet extension.')
      }
    } catch (e: any) {
      setError(e?.message || 'Connection failed')
    } finally {
      setLoading(false)
    }
  }, [wallets, select, connect])

  const disconnectAll = useCallback(async () => {
    try {
      if (bpKey) {
        const p = window.backpack?.solana || window.backpack || window.xnft?.solana || window.phantom?.solana || window.solana
        if (p?.disconnect) await p.disconnect()
        setBpKey(null)
      }
      if (connected) await disconnect()
      setError(null)
    } catch {}
  }, [bpKey, connected, disconnect])

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
      <div style={{ fontSize: '3rem', marginBottom: 12 }}>🔐</div>
      <div style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: 6 }}>X1SAFE</div>
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 28 }}>
        Connect your wallet to access the vault
      </div>
      <button
        className="btn btn-primary btn-full"
        style={{ fontSize: '1rem', padding: '14px', marginBottom: 12 }}
        onClick={connectWallet}
        disabled={loading}
      >
        {loading ? <span className="loading" /> : '🔗 Connect Wallet'}
      </button>
      {error && (
        <div className="tx-status error" style={{ marginTop: 12, textAlign: 'left' }}>❌ {error}</div>
      )}
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 16 }}>
        Supports Backpack · Phantom · Solflare
      </div>
    </div>
  )
}
