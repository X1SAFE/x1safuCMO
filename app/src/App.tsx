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

import { Dashboard } from './components/Dashboard'
import { Deposit }   from './components/Deposit'
import { Withdraw }  from './components/Withdraw'
import { Exit }      from './components/Exit'
import { Connect }   from './components/Connect'
import { RPC_URL }   from './lib/vault'

declare global {
  interface Window { backpack?: any; xnft?: any }
}

type Tab = 'connect' | 'dashboard' | 'deposit' | 'withdraw' | 'exit'

const TABS: { key: Tab; label: string }[] = [
  { key: 'connect',   label: 'Connect'   },
  { key: 'dashboard', label: 'Overview'  },
  { key: 'deposit',   label: 'Deposit'   },
  { key: 'withdraw',  label: 'Withdraw'  },
  { key: 'exit',      label: 'Exit'      },
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
            {/* Simple shield SVG instead of lucide dep */}
            <div className="brand-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
              </svg>
            </div>
            <div>
              <div className="brand-name">X1SAFE</div>
              <div className="brand-sub">Multi-Asset Vault</div>
            </div>
          </div>
          {isConnected && shortAddr && (
            <span className="badge badge-green mono">{shortAddr}</span>
          )}
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
