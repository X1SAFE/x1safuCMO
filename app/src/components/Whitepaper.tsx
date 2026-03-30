export function Whitepaper() {
  return (
    <div style={{
      maxWidth: 780,
      margin: '0 auto',
      padding: '28px 20px 60px',
      color: 'var(--text)',
      fontFamily: 'inherit',
      lineHeight: 1.7,
    }}>

      {/* Header */}
      <div style={{
        textAlign: 'center',
        marginBottom: 40,
        padding: '32px 24px',
        background: 'linear-gradient(135deg, rgba(34,197,94,0.06) 0%, rgba(59,130,246,0.04) 100%)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
      }}>
        <div style={{ fontSize: '2rem', marginBottom: 8 }}>🛡️</div>
        <h1 style={{ margin: 0, fontSize: '1.7rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)' }}>
          X1SAFU
        </h1>
        <div style={{ fontSize: '1rem', color: 'var(--text-2)', marginTop: 4, fontWeight: 600 }}>
          Secure Savings Protocol
        </div>
        <div style={{
          display: 'inline-block',
          marginTop: 14,
          padding: '4px 14px',
          background: 'rgba(34,197,94,0.08)',
          border: '1px solid rgba(34,197,94,0.2)',
          borderRadius: 20,
          fontSize: '0.72rem',
          fontWeight: 700,
          color: 'var(--success)',
          letterSpacing: '0.05em',
        }}>
          WHITEPAPER v1.1 · X1 BLOCKCHAIN (SVM)
        </div>
        <div style={{ marginTop: 16, fontSize: '1rem', fontStyle: 'italic', color: 'var(--text-3)' }}>
          "1 X1SAFE = 1 USD tương đương tại thời điểm gửi."
        </div>
      </div>

      <Section num="01" title="Tổng Quan">
        <p>
          X1SAFU là giao thức tiết kiệm phi tập trung (DeFi Savings Protocol) xây dựng trên{' '}
          <strong>X1 Blockchain</strong> — blockchain SVM-compatible, tốc độ cao, chi phí giao dịch gần như bằng 0.
          X1SAFU cho phép người dùng gửi tài sản thực và nhận token đại diện giá trị USD,
          sau đó lưu thông, giao dịch, staking hoặc rút lại tài sản gốc bất kỳ lúc nào.
        </p>
        <VersionBadges />
      </Section>

      <Section num="02" title="Hệ Thống Token">
        <Table
          headers={['Token', 'Ký hiệu', 'Peg', 'Mô tả']}
          rows={[
            ['X1SAFE PUT',  'PUT',     '$0.01 USD',    'Chứng nhận giá trị USD khi gửi. Locked trong vault.'],
            ['X1SAFE FREE', 'SAFE',    '$0.01 USD',    'Token tự do — giao dịch trên xDEX hoặc staking.'],
            ['sX1SAFE',     'sX1SAFE', '1:1 với SAFE', 'Receipt token khi stake X1SAFE FREE.'],
          ]}
        />
        <CodeBlock label="Công thức tạo PUT">
{`PUT minted = token_amount × oracle_price × 100 / PRICE_SCALE

Ví dụ: 5 XNT × $0.37 = $1.85 → mint 185 X1SAFE_PUT`}
        </CodeBlock>
      </Section>

      <Section num="03" title="Tài Sản Được Hỗ Trợ">
        <p>8 loại tài sản, lock linh hoạt <strong>1–360 ngày</strong>:</p>
        <Table
          headers={['Asset', 'Định giá', 'Testnet Mint']}
          rows={[
            ['USDC.X', 'Fixed 1:1',     '—'],
            ['XNT',    'Oracle (xDEX)', 'CDREeqfWSxQvPa9ofxVrHFP5VZeF2xSc2EtAdXmNumuW'],
            ['XEN',    'Oracle',        '—'],
            ['XNM',    'Oracle',        '—'],
            ['PURGE',  'Oracle',        '6To4f6r9X3WFsLwWLFdj7ju8BNquzZwupVHUc8oS5pgP'],
            ['THEO',   'Oracle',        '5aXz3n196NK41nSRiM9kS5NGCftmF7vnQFiY8AVFmkkS'],
            ['AGI',    'Oracle',        '7SXmUpcBGSAwW5LmtzQVF9jHswZ7xzmdKqWa4nDgL3ER'],
            ['PEPE',   'Oracle',        '81LkybSBLvXYMTF6azXohUWyBvDGUXznm4yiXPkYkDTJ'],
          ]}
          monoLast
        />
      </Section>

      <Section num="04" title="Cơ Chế Hoạt Động">
        <FlowGrid />
      </Section>

      <Section num="05" title="Dual Reward Streams">
        <Table
          headers={['Loại phần thưởng', 'Token', 'Vesting']}
          rows={[
            ['USDC.X Fees',   'USDC.X',     'Ngay lập tức'],
            ['Staking Yield', 'X1SAFE FREE', '42 ngày (6 giai đoạn × 7 ngày)'],
          ]}
        />
        <div style={{ marginTop: 20 }}>
          <div style={{ fontWeight: 700, marginBottom: 10, color: 'var(--text-2)' }}>Fee Split</div>
          <FeeBar />
        </div>
        <CodeBlock label="Công thức phân phối reward">
{`reward_per_token += undistributed_rewards × 10^12 / total_staked
earned = staked × (reward_per_token - reward_per_token_paid) / 10^12`}
        </CodeBlock>
        <div style={{ marginTop: 16, fontSize: '0.78rem', color: 'var(--text-3)' }}>
          Treasury:{' '}
          <span style={{ fontFamily: 'monospace', color: 'var(--text-2)', fontSize: '0.73rem' }}>
            2u6H7CjFLGVezjSWDy1Rt6cPo23h89vRqUhocw67RD8R
          </span>
        </div>
      </Section>

      <Section num="06" title="Bảo Mật On-Chain">
        <SecurityList />
      </Section>

      <Section num="07" title="Thông Số Kỹ Thuật">
        <Table
          headers={['Tham số', 'Giá trị']}
          rows={[
            ['Ngôn ngữ',       'Rust + Anchor 0.30.1'],
            ['Network',        'X1 Testnet → Mainnet'],
            ['Program v1',     '3YqHMLwVVChoSAaN6SjVeKLwKNFN3WQMJ1tFGC2N7Upw'],
            ['Program v2',     'F2JnWVnjP1h6WG7KKUHqhp23etEJ4amdJquAcE9ecCoe'],
            ['Vault PDA',      'SCZPFHUFCZf91GMVSkxQZahi7ueH8NodRoE8KaqW8Ny'],
            ['PUT/SAFE decimals', '6'],
            ['Lock range',     '1–360 ngày'],
            ['Vesting cycles', '6 giai đoạn × 7 ngày = 42 ngày'],
            ['Fee split',      '60 / 20 / 20'],
            ['Frontend',       'React 18 + TypeScript + Vite'],
            ['Wallet',         'Solana Wallet Adapter'],
            ['Deploy',         'Vercel'],
            ['Testnet RPC',    'https://rpc.testnet.x1.xyz'],
          ]}
          monoSecond
        />
      </Section>

      <Section num="08" title="Lộ Trình Phát Triển">
        <Roadmap />
      </Section>

      <Section num="09" title="Links">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { icon: '🌐', label: 'App',      href: 'https://x1safu-cmo.vercel.app' },
            { icon: '📦', label: 'GitHub',   href: 'https://github.com/X1SAFE/x1safuCMO' },
            { icon: '🔍', label: 'Explorer', href: 'https://explorer.testnet.x1.xyz' },
            { icon: '📡', label: 'RPC',      href: 'https://rpc.testnet.x1.xyz' },
          ].map(l => (
            <a
              key={l.label}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 16px',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                color: 'var(--text)',
                textDecoration: 'none',
                fontSize: '0.85rem',
                fontWeight: 600,
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--success)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <span>{l.icon}</span>
              <span style={{ color: 'var(--text-3)', minWidth: 70 }}>{l.label}</span>
              <span style={{ color: 'var(--success)', fontFamily: 'monospace', fontSize: '0.78rem' }}>{l.href}</span>
            </a>
          ))}
        </div>
      </Section>

      <Section num="10" title="Đội Ngũ">
        <Table
          headers={['Vai trò', 'Người']}
          rows={[
            ['Protocol Design',     'CMO XEN X1 🐾🐾🐾 (@Prxenx1)'],
            ['Smart Contract v2.0', 'Theo (@xxen_bot)'],
            ['Frontend',            'Theo (@xxen_bot)'],
            ['Infrastructure',      'Cyberdyne Unlimited LLC'],
          ]}
        />
      </Section>

      {/* Footer */}
      <div style={{
        marginTop: 48,
        padding: '20px 24px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        textAlign: 'center',
        fontSize: '0.8rem',
        color: 'var(--text-3)',
      }}>
        <strong style={{ color: 'var(--text-2)' }}>X1SAFU</strong> — Secure your value. Trust the chain.
        <br />
        <span style={{ fontSize: '0.7rem', marginTop: 4, display: 'block' }}>
          Private — Cyberdyne Unlimited LLC
        </span>
      </div>
    </div>
  )
}

/* ── Sub-components ── */

function Section({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{
          fontSize: '0.65rem', fontWeight: 800, color: 'var(--success)',
          background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
          borderRadius: 6, padding: '2px 7px', letterSpacing: '0.06em',
        }}>{num}</span>
        <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)' }}>{title}</h2>
      </div>
      <div style={{ paddingLeft: 2 }}>{children}</div>
    </div>
  )
}

function Table({ headers, rows, monoLast, monoSecond }: {
  headers: string[];
  rows: string[][];
  monoLast?: boolean;
  monoSecond?: boolean;
}) {
  return (
    <div style={{ overflowX: 'auto', marginBottom: 16 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
        <thead>
          <tr>
            {headers.map(h => (
              <th key={h} style={{
                textAlign: 'left', padding: '8px 12px',
                background: 'var(--bg-elevated)',
                borderBottom: '1px solid var(--border)',
                color: 'var(--text-3)', fontWeight: 700,
                fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em',
                whiteSpace: 'nowrap',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
              {row.map((cell, j) => (
                <td key={j} style={{
                  padding: '9px 12px',
                  color: j === 0 ? 'var(--text)' : 'var(--text-2)',
                  fontWeight: j === 0 ? 600 : 400,
                  fontFamily: (monoLast && j === row.length - 1) || (monoSecond && j === 1) ? 'monospace' : 'inherit',
                  fontSize: (monoLast && j === row.length - 1) || (monoSecond && j === 1) ? '0.73rem' : '0.82rem',
                  wordBreak: 'break-all',
                }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CodeBlock({ label, children }: { label: string; children: string }) {
  return (
    <div style={{ marginTop: 16, marginBottom: 8 }}>
      {label && <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>}
      <pre style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '12px 16px',
        fontFamily: 'monospace',
        fontSize: '0.78rem',
        color: 'var(--success)',
        whiteSpace: 'pre-wrap',
        margin: 0,
        lineHeight: 1.6,
      }}>{children}</pre>
    </div>
  )
}

function VersionBadges() {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
      {[
        { label: 'v1 — x1safu', desc: 'Vault cơ bản: deposit / exit / sell', done: true },
        { label: 'v2.0 — x1safe_put_staking', desc: 'Multi-asset staking + dual rewards', done: true, active: true },
      ].map(v => (
        <div key={v.label} style={{
          padding: '10px 14px',
          background: v.active ? 'rgba(34,197,94,0.06)' : 'var(--bg-elevated)',
          border: `1px solid ${v.active ? 'rgba(34,197,94,0.25)' : 'var(--border)'}`,
          borderRadius: 'var(--radius)',
          fontSize: '0.78rem',
          flex: 1, minWidth: 200,
        }}>
          <div style={{ fontWeight: 700, color: v.active ? 'var(--success)' : 'var(--text)' }}>
            {v.done ? '✅' : '🔲'} {v.label} {v.active ? '← hiện tại' : ''}
          </div>
          <div style={{ color: 'var(--text-3)', marginTop: 3, fontSize: '0.75rem' }}>{v.desc}</div>
        </div>
      ))}
    </div>
  )
}

function FlowGrid() {
  const flows = [
    { step: '4.1', title: 'Deposit → Nhận PUT',      icon: '↓', color: '#22c55e',
      lines: ['Gửi Asset vào Vault', 'Oracle định giá USD', 'Mint X1SAFE_PUT cho user', 'Asset giữ trong reserve'] },
    { step: '4.2', title: 'Withdraw → Tự do hóa',    icon: '↑', color: '#3b82f6',
      lines: ['Đốt X1SAFE_PUT', 'Mint X1SAFE_FREE (1:1)', 'Token lưu thông trên xDEX'] },
    { step: '4.3', title: 'Exit → Lấy tài sản gốc',  icon: '✕', color: '#ef4444',
      lines: ['Đốt X1SAFE_FREE', 'Nhận tài sản thế chấp', 'Proportional từ tất cả reserves'] },
    { step: '4.4', title: 'Redeposit → Lock lại',    icon: '⟳', color: '#f59e0b',
      lines: ['Đốt X1SAFE_FREE', 'Mint X1SAFE_PUT (1:1)', 'Tiếp tục tích lũy phần thưởng'] },
    { step: '4.5', title: 'Stake → Kiếm lợi nhuận', icon: '⬡', color: '#a855f7',
      lines: ['Gửi X1SAFE_FREE', 'Nhận sX1SAFE (1:1)', 'Tích lũy rewards', 'Claim bất kỳ lúc nào'] },
    { step: '4.6', title: 'Unstake',                  icon: '◈', color: '#64748b',
      lines: ['Đốt sX1SAFE', 'Nhận X1SAFE_FREE gốc', 'Nhận rewards tích lũy'] },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
      {flows.map(f => (
        <div key={f.step} style={{
          padding: '14px 16px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          borderLeft: `3px solid ${f.color}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
            <span style={{ fontSize: '0.6rem', fontWeight: 800, color: 'var(--text-3)', background: 'var(--bg-hover)', borderRadius: 4, padding: '1px 5px' }}>{f.step}</span>
            <span style={{ fontWeight: 700, fontSize: '0.83rem', color: 'var(--text)' }}>{f.title}</span>
          </div>
          {f.lines.map((line, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 5, fontSize: '0.77rem', color: 'var(--text-2)' }}>
              <span style={{ color: f.color, flexShrink: 0, marginTop: 1 }}>→</span>
              {line}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function FeeBar() {
  return (
    <div>
      <div style={{ display: 'flex', height: 28, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
        <div style={{ width: '60%', background: 'rgba(34,197,94,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800, color: 'var(--success)' }}>60% Stakers</div>
        <div style={{ width: '20%', background: 'rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800, color: '#60a5fa' }}>20% Buyback</div>
        <div style={{ width: '20%', background: 'rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 800, color: '#fbbf24' }}>20% Treasury</div>
      </div>
    </div>
  )
}

function SecurityList() {
  const items = [
    { title: 'Vault Pause',    desc: 'Authority tạm dừng toàn vault trong khẩn cấp' },
    { title: 'Oracle gating',  desc: 'Chỉ authority/keeper cập nhật giá, không public' },
    { title: 'Math safety',    desc: 'Toàn bộ dùng checked_* & saturating_* — không overflow' },
    { title: 'CEI pattern',    desc: 'State changes trước CPI calls — chống re-entrancy' },
    { title: 'PDA authority',  desc: 'Vault authority là PDA, không phải ví cá nhân' },
    { title: 'Keeper role',    desc: 'Tách biệt keeper vs authority — keeper không rút được fund' },
    { title: 'Lock period',    desc: '1–360 ngày — unstake sau khi hết lock' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map(item => (
        <div key={item.title} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 14px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
        }}>
          <span style={{ fontSize: '1rem', flexShrink: 0 }}>✅</span>
          <div>
            <span style={{ fontWeight: 700, fontSize: '0.83rem', color: 'var(--text)' }}>{item.title}</span>
            <span style={{ color: 'var(--text-3)', fontSize: '0.78rem', marginLeft: 8 }}>{item.desc}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function Roadmap() {
  const phases = [
    { phase: 'Phase 1', title: 'V1 vault: deposit / exit / sell',                  done: true  },
    { phase: 'Phase 2', title: 'V2 multi-asset staking + dual rewards',             done: true  },
    { phase: 'Phase 3', title: 'Deploy mainnet X1',                                 active: true },
    { phase: 'Phase 4', title: 'Tích hợp oracle phi tập trung (Pyth/Switchboard)',  done: false },
    { phase: 'Phase 5', title: 'Governance — cộng đồng vote phí & assets mới',      done: false },
    { phase: 'Phase 6', title: 'Mobile app + xDEX deep liquidity',                  done: false },
  ]
  return (
    <div style={{ position: 'relative', paddingLeft: 20 }}>
      <div style={{ position: 'absolute', left: 8, top: 0, bottom: 0, width: 2, background: 'var(--border)' }} />
      {phases.map((p, i) => (
        <div key={i} style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
          <div style={{
            position: 'absolute', left: -16, top: 3,
            width: 14, height: 14, borderRadius: '50%',
            background: p.done ? 'var(--success)' : p.active ? '#f59e0b' : 'var(--border)',
            border: `2px solid ${p.done ? 'var(--success)' : p.active ? '#f59e0b' : 'var(--bg)'}`,
            flexShrink: 0,
            zIndex: 1,
          }} />
          <div>
            <span style={{
              fontSize: '0.68rem', fontWeight: 800, color: p.done ? 'var(--success)' : p.active ? '#f59e0b' : 'var(--text-3)',
              background: p.done ? 'rgba(34,197,94,0.08)' : p.active ? 'rgba(245,158,11,0.08)' : 'var(--bg-elevated)',
              border: `1px solid ${p.done ? 'rgba(34,197,94,0.2)' : p.active ? 'rgba(245,158,11,0.2)' : 'var(--border)'}`,
              borderRadius: 10, padding: '1px 7px', marginRight: 8,
            }}>{p.phase}</span>
            <span style={{ fontSize: '0.85rem', color: p.done ? 'var(--text)' : p.active ? 'var(--text)' : 'var(--text-3)', fontWeight: p.done || p.active ? 600 : 400 }}>
              {p.done ? '✅' : p.active ? '🔄' : '🔲'} {p.title}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
