import { useMemo, useState } from 'react'
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
import '@solana/wallet-adapter-react-ui/styles.css'
import './App.css'

import { Dashboard } from './components/Dashboard'
import { Deposit }   from './components/Deposit'
import { Withdraw }  from './components/Withdraw'
import { Exit }      from './components/Exit'
import { Connect }   from './components/Connect'
import { RPC_URL, IS_TESTNET } from './lib/vault'

declare global {
  interface Window { backpack?: any; xnft?: any }
}

type Tab = 'connect' | 'dashboard' | 'deposit' | 'withdraw' | 'exit'

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'connect',   label: 'Connect',  icon: '⬡' },
  { key: 'dashboard', label: 'Overview', icon: '◈' },
  { key: 'deposit',   label: 'Deposit',  icon: '↓' },
  { key: 'withdraw',  label: 'Withdraw', icon: '↑' },
  { key: 'exit',      label: 'Exit',     icon: '✕' },
]

function App() {
  const { connected, publicKey } = useWallet()
  const bpConnected = typeof window !== 'undefined' &&
    (window.backpack?.publicKey || window.xnft?.solana?.publicKey)
  const isConnected = connected || !!bpConnected

  const [tab, setTab] = useState<Tab>('connect')

  const shortAddr = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}`
    : null

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
            {isConnected && shortAddr && (
              <span className="badge badge-wallet mono">
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                  <circle cx="4" cy="4" r="3" fill="#22c55e"/>
                </svg>
                {shortAddr}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ── Tab Nav ── */}
      <nav className="tab-nav">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`tab-btn${tab === t.key ? ' active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            <span className="tab-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {/* ── Content ── */}
      <main className="app-main">
        {tab === 'connect'   && <Connect />}
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
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          <App />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
