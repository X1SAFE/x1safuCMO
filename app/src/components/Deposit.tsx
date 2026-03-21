import { useState, useEffect } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import {
  Transaction, SystemProgram, SYSVAR_RENT_PUBKEY,
  TransactionInstruction, PublicKey,
} from '@solana/web3.js'
import {
  TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync,
  getAccount, ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { sha256 } from '@noble/hashes/sha256'
import {
  STAKING_PROGRAM_ID, STAKING_VAULT_STATE,
  STAKING_X1SAFE_PUT_MINT,
  EXPLORER, IS_TESTNET,
  toBaseUnits, getTokenBalance,
  MINTS,
} from '../lib/vault'
import { TokenLogo } from './TokenLogo'

function disc(name: string): Buffer {
  return Buffer.from(sha256(new TextEncoder().encode('global:' + name))).subarray(0, 8)
}

function createATAInstruction(payer: PublicKey, ata: PublicKey, owner: PublicKey, mint: PublicKey) {
  return new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: payer,                   isSigner: true,  isWritable: true  },
      { pubkey: ata,                     isSigner: false, isWritable: true  },
      { pubkey: owner,                   isSigner: false, isWritable: false },
      { pubkey: mint,                    isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID,        isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY,      isSigner: false, isWritable: false },
    ],
    data: Buffer.from([0]),
  })
}

interface AssetConfig {
  key: string
  label: string
  mint: PublicKey
  decimals: number
  isStable: boolean
  color: string
  priceUsd: number
}

const DEPOSIT_ASSETS: AssetConfig[] = [
  { key: 'USDCX', label: 'USDC.X', mint: MINTS.USDCX, decimals: 6, isStable: true,  color: '#2775ca', priceUsd: 1.0  },
  { key: 'XNT',   label: 'XNT',    mint: MINTS.XNT,   decimals: 9, isStable: false, color: '#9333ea', priceUsd: 0.20 },
]

const LOCK_OPTIONS = [
  { days: 7,   label: '7 days',   apy: 5  },
  { days: 30,  label: '30 days',  apy: 12 },
  { days: 90,  label: '90 days',  apy: 25 },
  { days: 180, label: '6 months', apy: 45 },
  { days: 360, label: '1 year',   apy: 80 },
]

// PDAs for x1safe_put_staking
const SUPPORTED_TOKEN_SEED = Buffer.from('supported_token')
const USER_POSITION_SEED   = Buffer.from('user_position')

function getSupportedTokenPDA(tokenMint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SUPPORTED_TOKEN_SEED, tokenMint.toBuffer()],
    STAKING_PROGRAM_ID
  )[0]
}

function getUserPositionStakingPDA(user: PublicKey, tokenMint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [USER_POSITION_SEED, user.toBuffer(), tokenMint.toBuffer()],
    STAKING_PROGRAM_ID
  )[0]
}

// Known token vault addresses (created during add_supported_token txs)
const TOKEN_VAULTS: Record<string, PublicKey> = {
  [MINTS.USDCX.toBase58()]: new PublicKey('ApSj1xNGYjEqxSyP4RncrR7FkXwja5dSzGRQW4gvgSRi'),
  [MINTS.XNT.toBase58()]:   new PublicKey('FUHno7PbvQbqoXSektfRBfjuPDiN75SdX2R2Hgncaqjf'),
}

export function Deposit() {
  const { connection } = useConnection()
  const wallet = useWallet()

  const [assetKey,    setAssetKey]    = useState('XNT')
  const [lockDays,    setLockDays]    = useState(30)
  const [amount,      setAmount]      = useState('')
  const [balances,    setBalances]    = useState<Record<string, number>>({})
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [txSig,       setTxSig]       = useState('')
  const [showConfirm, setShowConfirm] = useState(false)

  const asset    = DEPOSIT_ASSETS.find(a => a.key === assetKey)!
  const lockOpt  = LOCK_OPTIONS.find(o => o.days === lockDays)!
  const numAmt   = parseFloat(amount) || 0
  const usdValue = numAmt * asset.priceUsd
  const putAmount = asset.isStable
    ? numAmt                     // USDC.X: 1:1
    : usdValue                   // XNT: USD value = PUT amount

  useEffect(() => {
    if (!wallet.publicKey) return
    const load = async () => {
      const result: Record<string, number> = {}
      for (const a of DEPOSIT_ASSETS) {
        result[a.key] = await getTokenBalance(connection, wallet.publicKey!, a.mint)
      }
      setBalances(result)
    }
    load()
  }, [wallet.publicKey, connection, txSig])

  const handleDeposit = async () => {
    if (!wallet.publicKey || !wallet.signTransaction || !amount) return
    setLoading(true); setError(''); setTxSig('')
    try {
      const vaultState       = STAKING_VAULT_STATE
      const putMint          = STAKING_X1SAFE_PUT_MINT
      const supportedToken   = getSupportedTokenPDA(asset.mint)
      const userPosition     = getUserPositionStakingPDA(wallet.publicKey, asset.mint)
      const tokenVault       = TOKEN_VAULTS[asset.mint.toBase58()]

      if (!tokenVault) throw new Error('Token vault not configured for this asset')

      const userTokenAta = getAssociatedTokenAddressSync(asset.mint, wallet.publicKey, false, TOKEN_PROGRAM_ID)
      const userPutAta   = getAssociatedTokenAddressSync(putMint, wallet.publicKey, false, TOKEN_PROGRAM_ID)
      // Oracle = SystemProgram (mock, prices hardcoded in program)
      const oracle = SystemProgram.programId

      const tx = new Transaction()

      // Create user asset ATA if needed
      try { await getAccount(connection, userTokenAta, undefined, TOKEN_PROGRAM_ID) } catch {
        tx.add(createATAInstruction(wallet.publicKey, userTokenAta, wallet.publicKey, asset.mint))
      }
      // Create user PUT ATA if needed
      try { await getAccount(connection, userPutAta, undefined, TOKEN_PROGRAM_ID) } catch {
        tx.add(createATAInstruction(wallet.publicKey, userPutAta, wallet.publicKey, putMint))
      }

      // Build deposit instruction
      // Args: amount: u64 (8 bytes) + lock_days: u16 (2 bytes)
      const discBuf    = disc('deposit')
      const amountBuf  = Buffer.allocUnsafe(8)
      const amountBN   = BigInt(toBaseUnits(numAmt, asset.decimals).toString())
      amountBuf.writeBigUInt64LE(amountBN)
      const lockBuf    = Buffer.allocUnsafe(2)
      lockBuf.writeUInt16LE(lockDays)
      const data = Buffer.concat([discBuf, amountBuf, lockBuf])

      // Account order matches Deposit<'info> struct in deposit.rs exactly:
      // user, vault_state, supported_token, token_mint,
      // user_token_account, vault_token_account,
      // x1safe_put_mint, user_x1safe_put_account,
      // user_position (init), oracle, system_program, token_program, rent
      tx.add(new TransactionInstruction({
        programId: STAKING_PROGRAM_ID,
        keys: [
          { pubkey: wallet.publicKey,        isSigner: true,  isWritable: true  }, // user
          { pubkey: vaultState,              isSigner: false, isWritable: true  }, // vault_state
          { pubkey: supportedToken,          isSigner: false, isWritable: false }, // supported_token
          { pubkey: asset.mint,              isSigner: false, isWritable: false }, // token_mint
          { pubkey: userTokenAta,            isSigner: false, isWritable: true  }, // user_token_account
          { pubkey: tokenVault,              isSigner: false, isWritable: true  }, // vault_token_account
          { pubkey: putMint,                 isSigner: false, isWritable: true  }, // x1safe_put_mint
          { pubkey: userPutAta,              isSigner: false, isWritable: true  }, // user_x1safe_put_account
          { pubkey: userPosition,            isSigner: false, isWritable: true  }, // user_position (init)
          { pubkey: oracle,                  isSigner: false, isWritable: false }, // oracle
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
          { pubkey: TOKEN_PROGRAM_ID,        isSigner: false, isWritable: false }, // token_program
          { pubkey: SYSVAR_RENT_PUBKEY,      isSigner: false, isWritable: false }, // rent
        ],
        data,
      }))

      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
      tx.feePayer = wallet.publicKey
      const signed = await wallet.signTransaction(tx)
      const sig    = await connection.sendRawTransaction(signed.serialize())
      await connection.confirmTransaction(sig, 'confirmed')
      setTxSig(sig)
      setAmount('')
      setShowConfirm(false)
    } catch (e: any) {
      setError(e?.message || 'Transaction failed')
    } finally { setLoading(false) }
  }

  if (!wallet.connected) {
    return (
      <div className="tab-content">
        <div className="empty-state">
          <div className="empty-state-icon">🔐</div>
          <div className="empty-state-text">Connect Wallet to Deposit</div>
          <div className="empty-state-sub">Connect your wallet to deposit collateral and receive X1SAFE_PUT.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="tab-content">

      <div style={{ marginBottom: 16 }}>
        <div className="page-title" style={{ fontSize: '1.15rem', fontWeight: 800 }}>Deposit</div>
        <div className="page-subtitle">Deposit collateral → receive X1SAFE_PUT + choose lock period</div>
      </div>

      {/* ── Asset selector ── */}
      <div className="form-label" style={{ marginBottom: 8 }}>Select Asset</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
        {DEPOSIT_ASSETS.map(a => (
          <button
            key={a.key}
            onClick={() => { setAssetKey(a.key); setAmount(''); setShowConfirm(false) }}
            style={{
              padding: '12px 14px', borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'left',
              border: `1.5px solid ${assetKey === a.key ? a.color : 'var(--border)'}`,
              background: assetKey === a.key ? `${a.color}10` : 'var(--bg-elevated)',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <TokenLogo token={a.key as any} size={20} />
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: assetKey === a.key ? a.color : 'var(--text)' }}>
                {a.label}
              </span>
              {a.isStable && (
                <span style={{ fontSize: '0.55rem', fontWeight: 700, background: 'rgba(34,197,94,0.1)', color: 'var(--success)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: '1px 5px' }}>
                  STABLE
                </span>
              )}
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: assetKey === a.key ? a.color : 'var(--text-2)' }}>
              {(balances[a.key] ?? 0).toFixed(2)}
            </div>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-3)', marginTop: 2 }}>
              Balance · ${a.priceUsd.toFixed(2)}/token
            </div>
          </button>
        ))}
      </div>

      {/* ── Lock period selector ── */}
      <div className="form-label" style={{ marginBottom: 8 }}>Lock Period</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {LOCK_OPTIONS.map(opt => (
          <button
            key={opt.days}
            onClick={() => setLockDays(opt.days)}
            style={{
              padding: '7px 12px', borderRadius: 20, cursor: 'pointer',
              border: `1.5px solid ${lockDays === opt.days ? 'var(--success)' : 'var(--border)'}`,
              background: lockDays === opt.days ? 'rgba(34,197,94,0.08)' : 'var(--bg-elevated)',
              color: lockDays === opt.days ? 'var(--success)' : 'var(--text-3)',
              fontSize: '0.75rem', fontWeight: lockDays === opt.days ? 700 : 500,
              transition: 'all 0.15s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
            }}
          >
            <span>{opt.label}</span>
            <span style={{ fontSize: '0.62rem', color: lockDays === opt.days ? 'var(--success)' : 'var(--text-3)', fontWeight: 700 }}>
              ~{opt.apy}% APY
            </span>
          </button>
        ))}
      </div>

      {/* ── Amount input ── */}
      <div className="form-label" style={{ marginBottom: 8 }}>Amount</div>
      <div className="amount-input-block" style={{ marginBottom: 14 }}>
        <div className="amount-input-row">
          <input
            type="number"
            className="amount-input-big"
            placeholder="0.00"
            value={amount}
            min="0"
            step="any"
            onChange={e => { setAmount(e.target.value); setError(''); setTxSig(''); setShowConfirm(false) }}
          />
          <div className="amount-input-asset" style={{ color: asset.color }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <TokenLogo token={assetKey as any} size={16} />
              {asset.label}
            </div>
          </div>
        </div>
        <div className="amount-input-footer">
          <span className="amount-usd">
            {numAmt > 0 ? `≈ $${usdValue.toFixed(2)} USD` : 'Enter amount'}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="amount-max-btn"
              onClick={() => { setAmount(((balances[assetKey] ?? 0) / 2).toFixed(6)); setShowConfirm(false) }}
              disabled={!balances[assetKey]}>HALF</button>
            <button className="amount-max-btn"
              onClick={() => { setAmount((balances[assetKey] ?? 0).toFixed(6)); setShowConfirm(false) }}
              disabled={!balances[assetKey]}>MAX</button>
          </div>
        </div>
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-3)' }}>
          <span>Balance</span>
          <span style={{ color: asset.color, fontWeight: 600 }}>{(balances[assetKey] ?? 0).toFixed(4)} {asset.label}</span>
        </div>
      </div>

      {/* ── Conversion card ── */}
      {numAmt > 0 && (
        <div className="conversion-card" style={{ marginBottom: 14 }}>
          <div className="conversion-row">
            <span className="label">Deposit</span>
            <span className="value" style={{ color: asset.color }}>{numAmt.toFixed(4)} {asset.label}</span>
          </div>
          <div className="conversion-row">
            <span className="label">USD value</span>
            <span className="value">${usdValue.toFixed(2)}</span>
          </div>
          <div className="conversion-row">
            <span className="label">Lock period</span>
            <span className="value" style={{ color: 'var(--success)' }}>{lockOpt.label} (~{lockOpt.apy}% APY)</span>
          </div>
          <div className="conversion-divider" />
          <div className="conversion-total">
            <span className="label">→ You receive</span>
            <span className="value" style={{ color: 'var(--xnt-color)' }}>{putAmount.toFixed(4)} X1SAFE_PUT</span>
          </div>
          <div style={{ marginTop: 8, fontSize: '0.68rem', color: 'var(--text-3)', display: 'flex', gap: 10 }}>
            <span>🔒 Locked until {new Date(Date.now() + lockDays * 86400000).toLocaleDateString()}</span>
            <span>·</span>
            <span>1 X1SAFE_PUT = $0.01</span>
          </div>
        </div>
      )}

      {/* ── Info box ── */}
      <div className="info-box info" style={{ marginBottom: 14, fontSize: '0.78rem' }}>
        💡 After depositing: <strong>Exit</strong> to get collateral back + earn X1SAFE, or <strong>Stake PUT</strong> to earn from the reward pool.
      </div>

      {/* ── Warnings ── */}
      {(balances[assetKey] ?? 0) === 0 && (
        <div className="info-box warning" style={{ marginBottom: 14 }}>
          ⚠️ No {asset.label} balance. Get some {asset.label} first.
        </div>
      )}
      {numAmt > (balances[assetKey] ?? 0) && (balances[assetKey] ?? 0) > 0 && (
        <div className="info-box warning" style={{ marginBottom: 14 }}>
          ⚠️ Amount exceeds balance ({(balances[assetKey] ?? 0).toFixed(4)})
        </div>
      )}

      {/* ── Error / Success ── */}
      {error && (
        <div className="info-box danger" style={{ marginBottom: 14 }}>❌ {error}</div>
      )}
      {txSig && (
        <div className="tx-status success" style={{ marginBottom: 14 }}>
          <span>✅ Deposited! Received X1SAFE_PUT</span>
          <a href={`${EXPLORER}/tx/${txSig}`} target="_blank" rel="noopener noreferrer"
            style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--success)', textDecoration: 'none' }}>
            View ↗
          </a>
        </div>
      )}

      {/* ── Confirm step ── */}
      {showConfirm && numAmt > 0 && !error && (
        <div style={{ padding: '14px 16px', background: 'rgba(147,51,234,0.05)', border: '1px solid rgba(147,51,234,0.2)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: 'var(--xnt-color)', fontWeight: 500, marginBottom: 10 }}>
          🔒 Deposit {numAmt.toFixed(4)} {asset.label} · locked for {lockOpt.label} · receive {putAmount.toFixed(4)} X1SAFE_PUT
        </div>
      )}

      {/* ── Buttons ── */}
      {!showConfirm ? (
        <button
          className="btn btn-primary btn-full btn-lg"
          disabled={!numAmt || numAmt > (balances[assetKey] ?? 0) || (balances[assetKey] ?? 0) === 0}
          onClick={() => setShowConfirm(true)}
          style={{ fontWeight: 700 }}
        >
          Deposit {numAmt > 0 ? `${numAmt.toFixed(4)} ${asset.label}` : ''}
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            className="btn btn-primary btn-full btn-lg"
            onClick={handleDeposit}
            disabled={loading}
            style={{ fontWeight: 700 }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
                Processing…
              </span>
            ) : `✓ Confirm Deposit & Lock ${lockOpt.label}`}
          </button>
          <button className="btn btn-secondary btn-full" onClick={() => setShowConfirm(false)} disabled={loading}>
            Cancel
          </button>
        </div>
      )}

      <div style={{ marginTop: 12, textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-3)' }}>
        {IS_TESTNET ? '🔶 Testnet' : '🟢 Mainnet'} · x1safe_put_staking · Lock {lockOpt.days}d → {lockOpt.apy}% APY
      </div>

    </div>
  )
}
