export function Whitepaper() {
  return (
    <div style={{ padding: '28px 20px 60px', maxWidth: 780, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(16,185,129,0.04) 100%)',
        border: '1px solid rgba(34,197,94,0.2)',
        borderRadius: 'var(--radius-lg)',
        padding: '28px 32px',
        marginBottom: 32,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
              White Paper
            </div>
            <h1 style={{ margin: 0, fontSize: '1.9rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
              X1SAFE Protocol
            </h1>
            <div style={{ marginTop: 10, fontSize: '1rem', color: 'var(--text-2)', fontWeight: 500 }}>
              Multi-Asset Collateralized Vault on X1
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-3)', lineHeight: 1.7 }}>
            <div><span style={{ color: 'var(--text-2)', fontWeight: 600 }}>Version</span> v1.0</div>
            <div><span style={{ color: 'var(--text-2)', fontWeight: 600 }}>Date</span> March 2026</div>
            <div><span style={{ color: 'var(--text-2)', fontWeight: 600 }}>Network</span> X1 Blockchain</div>
          </div>
        </div>

        <div style={{ marginTop: 20, padding: '14px 18px', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius)', fontSize: '0.82rem', color: 'var(--text-2)', lineHeight: 1.7, fontStyle: 'italic' }}>
          X1SAFE is a multi-asset collateralized vault protocol native to the X1 blockchain. Users deposit supported tokens and receive <strong style={{ color: 'var(--text)' }}>X1SAFE-PUT</strong> — a synthetic USD-pegged receipt token. PUT tokens can be staked for yield, redeemed 1:1 for X1SAFE, or burned to reclaim original collateral.
        </div>
      </div>

      {/* Section helper */}
      {[
        {
          num: '01', title: 'Introduction',
          body: (
            <p style={p}>
              The X1 blockchain hosts a growing ecosystem of DeFi protocols, validators, and native tokens. There is currently no unified stable-value instrument that allows users to hold cross-asset exposure in a single, dollar-denominated wrapper.
              <br/><br/>
              X1SAFE addresses this gap with a <strong>non-custodial vault</strong> that accepts multiple collateral types, a <strong>synthetic USD token</strong> (X1SAFE-PUT) priced at $0.01 per unit, a <strong>staking module</strong> generating yield from protocol fees, and a <strong>two-exit system</strong>: redeem for X1SAFE tokens, or exit back to original collateral.
            </p>
          ),
        },
        {
          num: '02', title: 'Token Design',
          body: (
            <>
              <div style={grid2}>
                <TokenCard
                  name="X1SAFE-PUT"
                  ticker="PUT"
                  peg="$0.01 USD"
                  color="var(--success)"
                  desc="Synthetic USD receipt. Minted on deposit, burned on exit or redeem. Proof of collateral."
                />
                <TokenCard
                  name="X1SAFE"
                  ticker="X1SAFE"
                  peg="$0.01 USD"
                  color="#60a5fa"
                  desc="Liquid, transferable USD-equivalent token. Received via redeem_x1safe at 1:1 parity with PUT."
                />
              </div>
              <div style={{ ...callout, marginTop: 16 }}>
                <strong>1 X1SAFE-PUT = 1 X1SAFE = $0.01 USD</strong>
              </div>
            </>
          ),
        },
        {
          num: '03', title: 'Supported Collateral',
          body: (
            <table style={tbl}>
              <thead>
                <tr>
                  {['Asset','Decimals','Pricing','Notes'].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['USDC.X', '6', 'Fixed $1.00','Bridged USDC on X1'],
                  ['XNT',    '9', 'Oracle (xDEX)','Native X1 token'],
                  ['XEN',    '9', 'Oracle (xDEX)','XEN on X1'],
                ].map(row => (
                  <tr key={row[0]}>
                    {row.map((cell, i) => (
                      <td key={i} style={td}>
                        {i === 0 ? <strong style={{ color: 'var(--success)' }}>{cell}</strong> : cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ),
        },
        {
          num: '04', title: 'Deposit Mechanics',
          body: (
            <>
              <div style={codeBlock}>
                <div style={codeLine}><span style={{ color: '#94a3b8' }}>// Formula</span></div>
                <div style={codeLine}><span style={{ color: '#60a5fa' }}>deposit_usd</span>  = token_amount × oracle_price</div>
                <div style={codeLine}><span style={{ color: '#60a5fa' }}>put_minted</span>   = deposit_usd × <span style={{ color: 'var(--success)' }}>100</span></div>
              </div>
              <div style={{ ...callout, marginTop: 12, background: 'rgba(96,165,250,0.06)', borderColor: 'rgba(96,165,250,0.2)' }}>
                <strong>Example:</strong> Deposit 10 XNT @ $0.35/XNT → USD value = $3.50 → <strong style={{ color: 'var(--success)' }}>350 X1SAFE-PUT minted</strong>
              </div>
            </>
          ),
        },
        {
          num: '05', title: 'Exit Paths',
          body: (
            <>
              <table style={tbl}>
                <thead>
                  <tr>
                    {['Path','Input','Output','When to use'].map(h => <th key={h} style={th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={td}><code style={code}>exit_vault</code></td>
                    <td style={td}>Burn PUT</td>
                    <td style={td}><span style={{ color: '#fbbf24' }}>Original token (USDC.X / XNT / XEN)</span></td>
                    <td style={td}>Cash out after lock period</td>
                  </tr>
                  <tr>
                    <td style={td}><code style={code}>redeem_x1safe</code></td>
                    <td style={td}>Burn PUT</td>
                    <td style={td}><span style={{ color: 'var(--success)' }}>X1SAFE (1:1)</span></td>
                    <td style={td}>Stay in X1 ecosystem anytime</td>
                  </tr>
                </tbody>
              </table>
              <p style={{ ...p, marginTop: 12, fontSize: '0.82rem' }}>
                ⚠️ The two paths are <strong>mutually exclusive</strong> per position. After redeeming for X1SAFE, exit_vault is no longer available for that deposit.
              </p>
            </>
          ),
        },
        {
          num: '06', title: 'Staking Module',
          body: (
            <>
              <p style={p}>
                X1SAFE-PUT holders can stake PUT to earn protocol yield. Stakers receive <strong>sX1SAFE</strong> receipt tokens tracking their proportional share of the reward pool.
              </p>
              <table style={tbl}>
                <thead>
                  <tr>{['Recipient','Share'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {[
                    ['Stakers Pool','Configurable (staker_fee_share bps)'],
                    ['Buyback & Burn','Configurable (buyback_fee_share bps)'],
                    ['Treasury','Configurable (treasury_fee_share bps)'],
                  ].map(r => (
                    <tr key={r[0]}>
                      <td style={td}><strong>{r[0]}</strong></td>
                      <td style={td}>{r[1]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ),
        },
        {
          num: '07', title: 'Protocol Architecture',
          body: (
            <>
              <div style={codeBlock}>
                {[
                  'User',
                  ' ├─ deposit(amount, asset) ──→ Vault PDA',
                  ' │      ├─ validates AssetConfig (oracle price)',
                  ' │      ├─ transfers tokens → Reserve ATA',
                  ' │      └─ mints X1SAFE-PUT → user wallet',
                  ' ├─ stake(put_amount) ──────→ StakePool',
                  ' │      └─ mints sX1SAFE, tracks rewards',
                  ' ├─ exit_vault() ───────────→ Vault PDA',
                  ' │      ├─ burns PUT',
                  ' │      └─ returns collateral from Reserve',
                  ' └─ redeem_x1safe() ────────→ Vault PDA',
                  '        ├─ burns PUT',
                  '        └─ mints X1SAFE 1:1',
                ].map((line, i) => (
                  <div key={i} style={codeLine}>{line}</div>
                ))}
              </div>
              <table style={{ ...tbl, marginTop: 16 }}>
                <thead>
                  <tr>{['PDA Account','Seeds','Purpose'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {[
                    ['Vault',       '["vault"]',              'Global state, fee config, TVL'],
                    ['Asset Config','["asset", mint]',        'Per-token price + reserves'],
                    ['User Position','["position", user, mint]','Per-user deposit tracking'],
                    ['PUT Mint',    '["put_mint"]',           'X1SAFE-PUT mint authority'],
                    ['SAFE Mint',   '["safe_mint"]',          'X1SAFE mint authority'],
                    ['Stake Pool',  '["stake_pool"]',         'Staking reward state'],
                    ['Reserve ATA', 'vault-owned ATAs',       'Collateral custody'],
                  ].map(r => (
                    <tr key={r[0]}>
                      <td style={td}><strong>{r[0]}</strong></td>
                      <td style={td}><code style={code}>{r[1]}</code></td>
                      <td style={td}>{r[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ),
        },
        {
          num: '08', title: 'Security Model',
          body: (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                ['Non-custodial',     'Vault PDA is program-controlled. No admin can withdraw user funds unilaterally.'],
                ['Oracle validation', 'Price staleness checks and confidence thresholds prevent stale-price exploits.'],
                ['Pause mechanism',   'pause_vault / unpause_vault allow emergency response by vault authority.'],
                ['Authority gating',  'add_asset, update_price, and pause_vault require vault authority signature.'],
                ['PDA verification',  'All accounts use canonical Anchor PDA derivation with bump verification.'],
                ['Upgradeable',       'Program uses BPFLoaderUpgradeab1e. Upgrade authority: B5gEjqV… (deployer wallet).'],
              ].map(([title, desc]) => (
                <div key={title} style={{
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  padding: '10px 14px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                }}>
                  <span style={{ color: 'var(--success)', fontSize: '0.9rem', marginTop: 1, flexShrink: 0 }}>✓</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text)', marginBottom: 2 }}>{title}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', lineHeight: 1.5 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          ),
        },
        {
          num: '09', title: 'Tokenomics',
          body: (
            <table style={tbl}>
              <thead>
                <tr>{['Parameter','Value'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {[
                  ['1 X1SAFE-PUT peg',    '$0.01 USD'],
                  ['1 X1SAFE peg',         '$0.01 USD'],
                  ['Mint ratio',           '100 PUT per $1.00 deposited'],
                  ['Redeem ratio',         '1 PUT → 1 X1SAFE (1:1)'],
                  ['Oracle source',        'xDEX API (api.xdex.xyz)'],
                  ['Staking APY',          'Configurable via apy_bps'],
                  ['Fee distribution',     'Stakers / Buyback / Treasury (bps)'],
                ].map(r => (
                  <tr key={r[0]}>
                    <td style={td}>{r[0]}</td>
                    <td style={td}><strong style={{ color: 'var(--success)' }}>{r[1]}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ),
        },
        {
          num: '10', title: 'Roadmap',
          body: (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { done: true,  label: 'Vault deploy — USDC.X + XNT deposit, PUT minting, exit' },
                { done: true,  label: 'Staking module — sX1SAFE, fee distribution' },
                { done: true,  label: 'Redeem X1SAFE instruction (PUT → X1SAFE 1:1)' },
                { done: false, label: 'XEN collateral support' },
                { done: false, label: 'Time-locked positions with yield bonus' },
                { done: false, label: 'On-chain oracle integration (RANDAO+VDF)' },
                { done: false, label: 'Cross-protocol yield routing' },
                { done: false, label: 'Governance via X1SAFE token' },
              ].map(({ done, label }, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 14px',
                  background: done ? 'rgba(34,197,94,0.04)' : 'var(--bg-elevated)',
                  border: `1px solid ${done ? 'rgba(34,197,94,0.15)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)',
                  opacity: done ? 1 : 0.7,
                }}>
                  <span style={{ fontSize: '0.85rem', flexShrink: 0 }}>{done ? '✅' : '🔜'}</span>
                  <span style={{ fontSize: '0.82rem', color: done ? 'var(--text)' : 'var(--text-2)' }}>{label}</span>
                </div>
              ))}
            </div>
          ),
        },
        {
          num: '11', title: 'Deployed Contracts',
          body: (
            <>
              <table style={tbl}>
                <thead>
                  <tr>{['Account','Address'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {[
                    ['Program (Vault)',    'F2JnWVnjP1h6WG7KKUHqhp23etEJ4amdJquAcE9ecCoe'],
                    ['Vault PDA',          'A5HWWiKBmzM1wibshEoL4653qPrnHpnJ7yw74pW49ZNf'],
                    ['PUT Mint',           '2o9zhcEuzvW8uw9Bo4s72AsTkN8xk7aUaoSdRtkSQGcd'],
                    ['USDC.X AssetConfig', 'Bgz3Bpvusju6xgdVNQwaJUn265kbVi3uGKhWvxN8yd1c'],
                    ['XNT AssetConfig',    'H7q2TKsUHexUKoLNd3jWpUMYRMwzm2zNMUYHoGviygKx'],
                    ['Treasury',           'Hnp1JiTb8YfFuEiP8w6vYTd16khXCiQRbYmJcujNbQAi'],
                  ].map(r => (
                    <tr key={r[0]}>
                      <td style={td}><strong>{r[0]}</strong></td>
                      <td style={td}><code style={{ ...code, fontSize: '0.7rem', wordBreak: 'break-all' }}>{r[1]}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
                <a href="https://github.com/X1SAFE/x1safuCMO" target="_blank" rel="noreferrer" style={linkBtn}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z"/></svg>
                  GitHub
                </a>
                <a href="https://explorer.testnet.x1.xyz/address/F2JnWVnjP1h6WG7KKUHqhp23etEJ4amdJquAcE9ecCoe" target="_blank" rel="noreferrer" style={linkBtn}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M10 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4M14 4h6m0 0v6m0-6L10 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Explorer
                </a>
              </div>
            </>
          ),
        },
      ].map(({ num, title, body }) => (
        <Section key={num} num={num} title={title}>
          {body}
        </Section>
      ))}

      {/* Disclaimer */}
      <div style={{
        marginTop: 32,
        padding: '14px 18px',
        background: 'rgba(251,191,36,0.04)',
        border: '1px solid rgba(251,191,36,0.15)',
        borderRadius: 'var(--radius)',
        fontSize: '0.75rem',
        color: 'var(--text-3)',
        lineHeight: 1.6,
      }}>
        ⚠️ <strong style={{ color: 'var(--text-2)' }}>Disclaimer:</strong> X1SAFE is experimental software deployed on X1 Testnet. Smart contracts have not undergone a formal third-party audit. This white paper describes v1 protocol mechanics and is subject to change. Use at your own risk.
      </div>
    </div>
  )
}

/* ── Sub-components ── */

function Section({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10,
          background: 'rgba(34,197,94,0.1)',
          border: '1px solid rgba(34,197,94,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.65rem', fontWeight: 800, color: 'var(--success)',
          letterSpacing: '0.05em', flexShrink: 0,
        }}>
          {num}
        </div>
        <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)' }}>{title}</h2>
      </div>
      {children}
    </div>
  )
}

function TokenCard({ name, ticker, peg, color, desc }: {
  name: string; ticker: string; peg: string; color: string; desc: string
}) {
  return (
    <div style={{
      padding: '16px 18px',
      background: 'var(--bg-elevated)',
      border: `1px solid ${color}33`,
      borderRadius: 'var(--radius-lg)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontWeight: 800, fontSize: '0.95rem', color }}>{ticker}</span>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color, background: `${color}18`, border: `1px solid ${color}33`, borderRadius: 10, padding: '2px 8px' }}>{peg}</span>
      </div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-2)', fontWeight: 500, marginBottom: 6 }}>{name}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', lineHeight: 1.5 }}>{desc}</div>
    </div>
  )
}

/* ── Shared styles ── */
const p: React.CSSProperties = { margin: 0, fontSize: '0.84rem', color: 'var(--text-2)', lineHeight: 1.75 }
const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }
const callout: React.CSSProperties = {
  padding: '12px 16px',
  background: 'rgba(34,197,94,0.06)',
  border: '1px solid rgba(34,197,94,0.2)',
  borderRadius: 'var(--radius)',
  fontSize: '0.83rem',
  color: 'var(--text-2)',
  lineHeight: 1.6,
}
const codeBlock: React.CSSProperties = {
  background: '#0d1117',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '14px 16px',
  overflowX: 'auto',
}
const codeLine: React.CSSProperties = {
  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
  fontSize: '0.78rem',
  color: '#e2e8f0',
  lineHeight: 1.8,
  whiteSpace: 'pre',
}
const code: React.CSSProperties = {
  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
  fontSize: '0.75rem',
  background: 'rgba(255,255,255,0.06)',
  padding: '1px 6px',
  borderRadius: 5,
  color: 'var(--success)',
}
const tbl: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.8rem',
}
const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  borderBottom: '1px solid var(--border)',
  color: 'var(--text-3)',
  fontWeight: 700,
  fontSize: '0.7rem',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  background: 'var(--bg-elevated)',
}
const td: React.CSSProperties = {
  padding: '9px 12px',
  borderBottom: '1px solid var(--border)',
  color: 'var(--text-2)',
  verticalAlign: 'top',
}
const linkBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '7px 14px',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  color: 'var(--text-2)',
  textDecoration: 'none',
  fontSize: '0.78rem',
  fontWeight: 600,
  transition: 'border-color 0.15s',
}
