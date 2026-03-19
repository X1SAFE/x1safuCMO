import { useState } from 'react'

export function Sell() {
  const [amount, setAmount] = useState('')
  const balance = 5000 // Mock balance

  const xDexUrl = 'https://app.xdex.xyz/swap'

  return (
    <div className="sell">
      <style>{`
        .sell { animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Sell X1SAFE</div>
            <div className="card-subtitle">Trade on xDEX for best rates</div>
          </div>
        </div>

        <div className="info-box">
          <div className="info-box-title">ℹ️ About Selling</div>
          <div className="info-box-text">
            When you sell X1SAFE on xDEX, you receive the trading pair asset (typically XNT or USDC.X).
            <br /><br />
            Your exit rights remain intact until you withdraw or exit.
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Amount to Sell</label>
          <input
            type="number"
            className="form-input"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <span>Balance: {balance.toLocaleString()} X1SAFE</span>
            <button 
              style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}
              onClick={() => setAmount(balance.toString())}
            >
              MAX
            </button>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">You Receive (Estimated)</label>
          <input
            type="text"
            className="form-input"
            value={amount ? `${parseFloat(amount || '0').toFixed(2)} USDC.X` : '-'}
            disabled
            style={{ opacity: 0.7 }}
          />
          <div style={{ marginTop: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Rate: 1 X1SAFE ≈ $1.00 USDC.X
          </div>
        </div>

        <a 
          href={xDexUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary btn-full"
          style={{ textDecoration: 'none', marginTop: '8px' }}
        >
          Open xDEX
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: '8px' }}>
            <path d="M7 17L17 7M17 7H7M17 7V17" />
          </svg>
        </a>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Trading Info</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '4px' }}>24h Volume</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', fontWeight: 600 }}>$125,420</div>
          </div>

          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '4px' }}>Liquidity</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', fontWeight: 600 }}>$892,150</div>
          </div>

          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '4px' }}>Price Impact (1%)</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', fontWeight: 600 }}>0.02%</div>
          </div>

          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '4px' }}>Fee</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', fontWeight: 600 }}>0.3%</div>
          </div>
        </div>
      </div>
    </div>
  )
}