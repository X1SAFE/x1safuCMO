import { useMemo, useState } from 'react'
import {
  ConnectionProvider,
  WalletProvider,
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

type Tab = 'dashboard' | 'deposit' | 'withdraw' | 'exit'

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
      {/* Header */}
      <header className="app-header">
        <div className="header-inner">
          <div className="brand">
            <div className="brand-icon"><Shield size={20} /></div>
            <div>
              <div className="brand-name">X1SAFE</div>
              <div className="brand-sub">Multi-Asset Vault</div>
            </div>
          </div>
          <WalletMultiButton />
        </div>
      </header>

      {/* Nav */}
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

      {/* Content */}
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
