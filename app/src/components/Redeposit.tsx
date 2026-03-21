import { useState, useEffect } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import {
  Transaction, TransactionInstruction,
  SystemProgram, SYSVAR_RENT_PUBKEY, PublicKey,
} from '@solana/web3.js'
import {
  TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync,
  getAccount, ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { sha256 } from '@noble/hashes/sha256'
import {
  STAKING_PROGRAM_ID, STAKING_VAULT_STATE,
  STAKING_X1SAFE_MINT, STAKING_X1SAFE_PUT_MINT,
  EXPLORER, IS_TESTNET,
  getTokenBalance, toBaseUnits,
} from '../lib/vault'

function disc(name: string): Buffer {
  return Buffer.from(sha256(new TextEncoder().encode('global:' + name))).subarray(0, 8)
}
function createATAIx(payer: PublicKey, ata: PublicKey, owner: PublicKey, mint: PublicKey) {
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

export function Redeposit() {
  const { connection } = useConnection()
  const wallet         = useWallet()

  const [amount,      setAmount]      = useState('')
  const [loading,     setLoading]     = useState(false)
  const [txSig,       setTxSig]       = useState('')
  const [error,       setError]       = useState('')
  const [safeBalance, setSafeBalance] = useState(0)
  const [putBalance,  setPutBalance]  = useState(0)
  const [showConfirm, setShowConfirm] = useState(false)

  const numAmt = parseFloat(amount) || 0

  const load = async () => {
    if (!wallet.publicKey) return
    const [safe, put] = await Promise.all([
      getTokenBalance(connection, wallet.publicKey, STAKING_X1SAFE_MINT),
      getTokenBalance(connection, wallet.publicKey, STAKING_X1SAFE_PUT_MINT),
    ])
    setSafeBalance(safe)
    setPutBalance(put)
  }

  useEffect(() => { load() }, [wallet.publicKey, connection, txSig])

  const handleRedeposit = async () => {
    if (!wallet.publicKey || !wallet.signTransaction || !amount) return
    setLoading(true); setError(''); setTxSig('')
    try {
      const vaultState  = STAKING_VAULT_STATE
      const safeMint    = STAKING_X1SAFE_MINT
      const putMint     = STAKING_X1SAFE_PUT_MINT

      const userSafeAta = getAssociatedTokenAddressSync(safeMint, wallet.publicKey, false, TOKEN_PROGRAM_ID)
      const userPutAta  = getAssociatedTokenAddressSync(putMint,  wallet.publicKey, false, TOKEN_PROGRAM_ID)

      const tx = new Transaction()

      // Ensure PUT ATA
      try { await getAccount(connection, userPutAta, undefined, TOKEN_PROGRAM_ID) }
      catch { tx.add(createATAIx(wallet.publicKey, userPutAta, wallet.publicKey, putMint)) }

      // redeposit instruction: burn X1SAFE → mint X1SAFE_PUT 1:1
      // Args: amount: u64
      const data = Buffer.concat([
        disc('redeposit'),
        (() => { const b = Buffer.allocUnsafe(8); b.writeBigUInt64LE(BigInt(toBaseUnits(numAmt, 6).toString())); return b })(),
      ])

      // Account order matches Redeposit<'info> struct:
      // user, vault_state, x1safe_mint, x1safe_put_mint,
      // user_safe_account, user_put_account, token_program
      tx.add(new TransactionInstruction({
        programId: STAKING_PROGRAM_ID,
        keys: [
          { pubkey: wallet.publicKey, isSigner: true,  isWritable: true  }, // user
          { pubkey: vaultState,       isSigner: false, isWritable: true  }, // vault_state
          { pubkey: safeMint,         isSigner: false, isWritable: true  }, // x1safe_mint
          { pubkey: putMint,          isSigner: false, isWritable: true  }, // x1safe_put_mint
          { pubkey: userSafeAta,      isSigner: false, isWritable: true  }, // user_safe_account
          { pubkey: userPutAta,       isSigner: false, isWritable: true  }, // user_put_account
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data,
      }))

      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
      tx.feePayer = wallet.publicKey
      // wallet.sendTransaction handles sign+send (avoids VersionedTx kind crash)
      const sig = await wallet.sendTransaction(tx, connection, { skipPreflight: false })
      await connection.confirmTransaction(sig, 'confirmed')
      setTxSig(sig); setAmount(''); setShowConfirm(false)
    } catch (e: any) {
      setError(e?.message || 'Transaction failed')
    } finally { setLoading(false) }
  }

  if (!wallet.connected) {
    return (
      <div className="tab-content">
        <div className="empty-state">
          <div className="empty-state-icon">🔐</div>
          <div className="empty-state-text">Connect Wallet to Re-lock</div>
          <div className="empty-state-sub">Connect to re-lock X1SAFE as PUT.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="tab-content">
      <div style={{ marginBottom: 16 }}>
        <div className="page-title" style={{ fontSize: '1.15rem', fontWeight: 800 }}>Re-lock</div>
        <div className="page-subtitle">Burn X1SAFE (free) → nhận X1SAFE_PUT 1:1 (re-assert backing)</div>
      </div>

      {/* Balances */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div style={{
          background: safeBalance > 0 ? 'linear-gradient(135deg,rgba(34,197,94,.07),rgba(34,197,94,.02))' : 'var(--bg-elevated)',
          border: `1px solid ${safeBalance > 0 ? 'rgba(34,197,94,.25)' : 'var(--border)'}`,
          borderRadius: 'var(--radius)', padding: 14,
        }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 4 }}>X1SAFE (free)</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: safeBalance > 0 ? 'var(--success)' : 'var(--text-3)' }}>{safeBalance.toFixed(2)}</div>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-3)', marginTop: 3 }}>Available to re-lock</div>
        </div>
        <div style={{
          background: putBalance > 0 ? 'linear-gradient(135deg,rgba(147,51,234,.07),rgba(147,51,234,.02))' : 'var(--bg-elevated)',
          border: `1px solid ${putBalance > 0 ? 'rgba(147,51,234,.25)' : 'var(--border)'}`,
          borderRadius: 'var(--radius)', padding: 14,
        }}>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 4 }}>X1SAFE_PUT</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: putBalance > 0 ? 'var(--xnt-color)' : 'var(--text-3)' }}>{putBalance.toFixed(2)}</div>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-3)', marginTop: 3 }}>After re-lock</div>
        </div>
      </div>

      <div className="info-box info" style={{ marginBottom: 14, fontSize: '0.78rem' }}>
        Re-lock X1SAFE free back thành PUT — giữ nguyên backing collateral trong vault, không rút collateral ra ngoài.
      </div>

      {safeBalance === 0 && (
        <div className="info-box warning" style={{ marginBottom: 14, fontSize: '0.78rem' }}>
          Không có X1SAFE để re-lock. Hãy Withdraw PUT trước.
        </div>
      )}

      {/* Amount input */}
      <div className="amount-input-block" style={{ marginBottom: 14 }}>
        <div className="amount-input-row">
          <input type="number" className="amount-input-big" placeholder="0.00"
            value={amount} min="0" step="any"
            disabled={safeBalance === 0}
            onChange={e => { setAmount(e.target.value); setError(''); setTxSig(''); setShowConfirm(false) }}
          />
          <div className="amount-input-asset" style={{ color: 'var(--success)' }}>X1SAFE</div>
        </div>
        <div className="amount-input-footer">
          <span className="amount-usd">{numAmt > 0 ? `→ ${numAmt.toFixed(4)} X1SAFE_PUT` : 'Enter X1SAFE amount'}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="amount-max-btn" onClick={() => { setAmount((safeBalance/2).toFixed(6)); setShowConfirm(false) }} disabled={safeBalance===0}>HALF</button>
            <button className="amount-max-btn" onClick={() => { setAmount(safeBalance.toFixed(6)); setShowConfirm(false) }} disabled={safeBalance===0}>MAX</button>
          </div>
        </div>
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-3)' }}>
          <span>X1SAFE Balance</span>
          <span style={{ color: safeBalance > 0 ? 'var(--success)' : undefined, fontWeight: 600 }}>{safeBalance.toFixed(4)}</span>
        </div>
      </div>

      {numAmt > 0 && (
        <div className="conversion-card" style={{ marginBottom: 14 }}>
          <div className="conversion-row">
            <span className="label">🔥 Burn</span>
            <span className="value" style={{ color: 'var(--success)' }}>{numAmt.toFixed(4)} X1SAFE (free)</span>
          </div>
          <div className="conversion-row">
            <span className="label">Tỉ lệ</span>
            <span className="value">1:1 cố định</span>
          </div>
          <div className="conversion-divider" />
          <div className="conversion-total">
            <span className="label">→ Bạn nhận</span>
            <span className="value" style={{ color: 'var(--xnt-color)' }}>{numAmt.toFixed(4)} X1SAFE_PUT</span>
          </div>
        </div>
      )}

      {numAmt > safeBalance && safeBalance > 0 && (
        <div className="info-box warning" style={{ marginBottom: 14 }}>⚠️ Vượt balance ({safeBalance.toFixed(4)})</div>
      )}

      {showConfirm && numAmt > 0 && !error && (
        <div style={{ padding: '12px 14px', background: 'rgba(34,197,94,.05)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: 'var(--success)', fontWeight: 500, marginBottom: 10 }}>
          ↩️ Re-lock {numAmt.toFixed(4)} X1SAFE → {numAmt.toFixed(4)} PUT
        </div>
      )}

      {error && <div className="info-box danger" style={{ marginBottom: 14 }}>❌ {error}</div>}
      {txSig && (
        <div className="tx-status success" style={{ marginBottom: 14 }}>
          <span>✅ Re-locked!</span>
          <a href={`${EXPLORER}/tx/${txSig}`} target="_blank" rel="noopener noreferrer"
            style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--success)', textDecoration: 'none' }}>View ↗</a>
        </div>
      )}

      {!showConfirm ? (
        <button className="btn btn-primary btn-full btn-lg"
          disabled={!numAmt || numAmt > safeBalance || safeBalance === 0}
          onClick={() => setShowConfirm(true)}
          style={{ fontWeight: 700 }}>
          Re-lock {numAmt > 0 ? `${numAmt.toFixed(4)} X1SAFE → PUT` : ''}
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="btn btn-primary btn-full btn-lg" onClick={handleRedeposit} disabled={loading} style={{ fontWeight: 700 }}>
            {loading
              ? <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>Processing…</span>
              : '✓ Confirm Re-lock'}
          </button>
          <button className="btn btn-secondary btn-full" onClick={() => setShowConfirm(false)} disabled={loading}>Cancel</button>
        </div>
      )}

      <div style={{ marginTop: 14, textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-3)' }}>
        {IS_TESTNET ? '🔶 Testnet' : '🟢 Mainnet'} · redeposit · X1SAFE → PUT (1:1)
      </div>
    </div>
  )
}
