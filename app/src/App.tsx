import { useMemo, useState, useEffect, useCallback } from 'react'
import {
  ConnectionProvider,
  WalletProvider,
  useWallet,
} from '@solana/wallet-adapter-react'
import {
  WalletModalProvider,
  WalletMultiButton,
} from '@solana/wallet-adapter-react-ui'
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets'
import { BackpackWalletAdapter } from '@solana/wallet-adapter-backpack'
import { Shield } from 'lucide-react'
import '@solana/wallet-adapter-react-ui/styles.css'

import { Dashboard } from './components/Dashboard'
import { Deposit }   from './components/Deposit'
import { Withdraw }  from './components/Withdraw'
import { Exit }      from './components/Exit'
import { RPC_URL }   from './lib/vault'

declare global {
  interface Window {
    backpack?: any
    xnft?: any
    phantom?: any
  }
}

type Tab = 'dashboard' | 'deposit' | 'withdraw' | 'exit'

function ConnectSection() {
  const { connected, publicKey, disconnect } = useWallet()
  const [backpackPubkey, setBackpackPubkey] = useState<string | null>(null)
  const [backpackConnecting, setBackpackConnecting] = useState(false)
  const hasBackpack = typeof window !== 'undefined' && (window.backpack || window.xnft)

  const connectBackpack = useCallback(async () => {
    try {
      setBackpackConnecting(true)
      const provider = window.backpack || window.xnft?.solana
      if (!provider) return
      const resp = await provider.connect()
      setBackpackPubkey(resp.publicKey.toString())
    } catch (e) {
      console.error('Backpack connect error', e)
    } finally {
      setBackpackConnecting(false)
    }
  }, [])

  const disconnectBackpack = useCallback(async () => {
    try {
      const provider = window.backpack || window.xnft?.solana
      if (provider) await provider.disconnect()
      setBackpackPubkey(null)
    } catch {}
  }, [])

  // If WalletAdapter already connected (Phantom/Solflare)
  if (connected && publicKey) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <WalletMultiButton />
      </div>
    )
  }

  // If Backpack connected directly
  if (backpackPubkey) {
    const short = `${backpackPubkey.slice(0,4)}…${backpackPubkey.slice(-4)}`
    return (
      <button className="btn btn-secondary" onClick={disconnectBackpack} style={{ fontSize: '0.85rem', padding: '8px 14px' }}>
        🎒 {short} · Disconnect
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <WalletMultiButton />
      {hasBackpack && (
        <button
          className="btn btn-secondary"
          style={{ padding: '8px 14px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
          onClick={connectBackpack}
          disabled={backpackConnecting}
        >
          {backpackConnecting ? <span className="loading" /> : '🎒 Backpack'}
        </button>
      )}
    </div>
  )
}

function App() {
  const [tab, setTab] = useState<Tab>('dashboard')

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: '📊' },
    { key: 'deposit',   label: 'Deposit',   icon: '⬇️' },
    { key: 'withdraw',  label: 'Withdraw',  icon: '🔄' },
    { key: 'exit',      label: 'Exit',      icon: '🚪' },
  ]

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <div className="brand">
            <div className="brand-icon"><Shield size={20} /></div>
            <div>
              <div className="brand-name">X1SAFE</div>
              <div className="brand-sub">Multi-Asset Vault</div>
            </div>
          </div>
          <ConnectSection />
        </div>
      </header>

      <nav className="tab-nav">
        {tabs.map(t => (
          <button
            key={t.key}
            className={`tab-btn ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </nav>

      <main className="app-main">
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'deposit'   && <Deposit />}
        {tab === 'withdraw'  && <Withdraw />}
        {tab === 'exit'      && <Exit />}
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
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <App />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
