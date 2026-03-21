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
  STAKING_X1SAFE_MINT, STAKING_X1SAFE_PUT_MINT,
  EXPLORER, IS_TESTNET, MINTS,
  getTokenBalance, toBaseUnits,
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

const USER_POSITION_SEED   = Buffer.from('user_position')

function getUserPositionPDA(user: PublicKey, tokenMint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [USER_POSITION_SEED, user.toBuffer(), tokenMint.toBuffer()],
    STAKING_PROGRAM_ID
  )[0]
}

// Which token_mint was used for this user's deposit?
// Try USDC.X first, then XNT
const DEPOSIT_MINTS = [MINTS.USDCX, MINTS.XNT]

export function Withdraw() {
  const { connection } = useConnection()
  const wallet = useWallet()

  const [amount,       setAmount]       = useState('')
  const [loading,      setLoading]      = useState(false)
  const [txSig,        setTxSig]        = useState('')
  const [error,        setError]        = useState('')
  const [putBalance,   setPutBalance]   = useState(0)
  const [safeBalance,  setSafeBalance]  = useState(0)
  const [showConfirm,  setShowConfirm]  = useState(false)
  // Which mint the user deposited (to find user_position PDA)
  const [depositMint,  setDepositMint]  = useState<PublicKey>(MINTS.XNT)

  const numAmt        = parseFloat(amount) || 0
  const isInsufficient = numAmt > putBalance && putBalance > 0

  const load = async () => {
    if (!wallet.publicKey) return
    const [put, safe] = await Promise.all([
      getTokenBalance(connection, wallet.publicKey, STAKING_X1SAFE_PUT_MINT),
      getTokenBalance(connection, wallet.publicKey, STAKING_X1SAFE_MINT),
    ])
    setPutBalance(put)
    setSafeBalance(safe)

    // Find which deposit mint has an active user_position
    for (const mint of DEPOSIT_MINTS) {
      const pda = getUserPositionPDA(wallet.publicKey, mint)
      const info = await connection.getAccountInfo(pda)
      if (info) { setDepositMint(mint); break }
    }
  }

  useEffect(() => { load() }, [wallet.publicKey, connection, txSig])

  const handleWithdraw = async () => {
    if (!wallet.publicKey || !wallet.signTransaction || !amount) return
    setLoading(true); setError(''); setTxSig('')
    try {
      const vaultState     = STAKING_VAULT_STATE
      const putMint        = STAKING_X1SAFE_PUT_MINT
      const safeMint       = STAKING_X1SAFE_MINT
      const userPosition   = getUserPositionPDA(wallet.publicKey, depositMint)

      const userPutAta  = getAssociatedTokenAddressSync(putMint,  wallet.publicKey, false, TOKEN_PROGRAM_ID)
      const userSafeAta = getAssociatedTokenAddressSync(safeMint, wallet.publicKey, false, TOKEN_PROGRAM_ID)

      const tx = new Transaction()

      // Create X1SAFE ATA if needed
      try { await getAccount(connection, userSafeAta, undefined, TOKEN_PROGRAM_ID) } catch {
        tx.add(createATAInstruction(wallet.publicKey, userSafeAta, wallet.publicKey, safeMint))
      }

      // Build redeem_x1safe instruction
      // Args: put_amount: u64 (8 bytes)
      const discBuf   = disc('redeem_x1safe')
      const amtBuf    = Buffer.allocUnsafe(8)
      amtBuf.writeBigUInt64LE(BigInt(toBaseUnits(numAmt, 6).toString()))
      const data = Buffer.concat([discBuf, amtBuf])

      // Account order matches RedeemX1safe<'info> struct:
      // user, vault_state, user_position, token_mint,
      // x1safe_put_mint, x1safe_mint, user_put_account, user_x1safe_account, token_program
      tx.add(new TransactionInstruction({
        programId: STAKING_PROGRAM_ID,
        keys: [
          { pubkey: wallet.publicKey, isSigner: true,  isWritable: true  }, // user
          { pubkey: vaultState,       isSigner: false, isWritable: true  }, // vault_state
          { pubkey: userPosition,     isSigner: false, isWritable: true  }, // user_position
          { pubkey: depositMint,      isSigner: false, isWritable: false }, // token_mint
          { pubkey: putMint,          isSigner: false, isWritable: true  }, // x1safe_put_mint
          { pubkey: safeMint,         isSigner: false, isWritable: true  }, // x1safe_mint
          { pubkey: userPutAta,       isSigner: false, isWritable: true  }, // user_put_account
          { pubkey: userSafeAta,      isSigner: false, isWritable: true  }, // user_x1safe_account
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data,
      }))

      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
      tx.feePayer = wallet.publicKey

      // Use sendTransaction (wallet handles sign+send, avoids VersionedTx kind crash)
      const sig = await wallet.sendTransaction(tx, connection, { skipPreflight: false })
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
          <div className="empty-state-text">Connect Wallet to Withdraw</div>
          <div className="empty-state-sub">Connect your wallet to access your vault receipts.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="tab-content">

      <div style={{ marginBottom: 16 }}>
        <div className="page-title" style={{ fontSize: '1.15rem', fontWeight: 800 }}>Withdraw</div>
        <div className="page-subtitle">Burn X1SAFE_PUT → nhận X1SAFE 1:1 (mất quyền Exit)</div>
      </div>

      {/* ── Balance cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
        <div style={{
          background: putBalance > 0 ? 'linear-gradient(135deg,rgba(147,51,234,.07),rgba(147,51,234,.02))' : 'var(--bg-elevated)',
          border: `1px solid ${putBalance > 0 ? 'rgba(147,51,234,.25)' : 'var(--border)'}`,
          borderRadius: 'var(--radius)', padding: 16,
        }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 6 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <TokenLogo token="X1SAFE" size={16} /> X1SAFE_PUT
            </span>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: putBalance > 0 ? 'var(--xnt-color)' : 'var(--text-3)' }}>
            {putBalance.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginTop: 4 }}>Locked receipt</div>
        </div>

        <div style={{
          background: safeBalance > 0 ? 'linear-gradient(135deg,rgba(34,197,94,.07),rgba(34,197,94,.02))' : 'var(--bg-elevated)',
          border: `1px solid ${safeBalance > 0 ? 'rgba(34,197,94,.25)' : 'var(--border)'}`,
          borderRadius: 'var(--radius)', padding: 16,
        }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 6 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <TokenLogo token="X1SAFE" size={16} /> X1SAFE (free)
            </span>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: safeBalance > 0 ? 'var(--success)' : 'var(--text-3)' }}>
            {safeBalance.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginTop: 4 }}>Transferable</div>
        </div>
      </div>

      {/* ── Info ── */}
      <div className="info-box info" style={{ marginBottom: 14, fontSize: '0.78rem' }}>
        ⚠️ Withdraw mất quyền Exit (không lấy lại được collateral). Chỉ dùng khi muốn X1SAFE ngay lập tức.
      </div>

      {putBalance === 0 && (
        <div className="info-box warning" style={{ marginBottom: 14, fontSize: '0.78rem' }}>
          Bạn không có X1SAFE_PUT. Hãy <strong>Deposit</strong> collateral trước.
        </div>
      )}

      {/* ── Amount input ── */}
      <div className="amount-input-block" style={{ marginBottom: 14 }}>
        <div className="amount-input-row">
          <input
            type="number"
            className="amount-input-big"
            placeholder="0.00"
            value={amount}
            min="0"
            step="any"
            disabled={putBalance === 0}
            onChange={e => { setAmount(e.target.value); setError(''); setTxSig(''); setShowConfirm(false) }}
          />
          <div className="amount-input-asset" style={{ color: 'var(--xnt-color)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <TokenLogo token="X1SAFE" size={16} /> PUT
            </span>
          </div>
        </div>
        <div className="amount-input-footer">
          <span className="amount-usd">
            {numAmt > 0 ? `→ ${numAmt.toFixed(4)} X1SAFE (free)` : 'Enter PUT amount'}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="amount-max-btn"
              onClick={() => { setAmount((putBalance / 2).toFixed(6)); setShowConfirm(false) }}
              disabled={putBalance === 0}>HALF</button>
            <button className="amount-max-btn"
              onClick={() => { setAmount(putBalance.toFixed(6)); setShowConfirm(false) }}
              disabled={putBalance === 0}>MAX</button>
          </div>
        </div>
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-3)' }}>
          <span>PUT Balance</span>
          <span style={{ color: putBalance > 0 ? 'var(--xnt-color)' : undefined, fontWeight: 600 }}>
            {putBalance.toFixed(4)} PUT
          </span>
        </div>
      </div>

      {/* ── Conversion card ── */}
      {numAmt > 0 && (
        <div className="conversion-card" style={{ marginBottom: 14 }}>
          <div className="conversion-row">
            <span className="label">🔥 Burn</span>
            <span className="value" style={{ color: 'var(--xnt-color)' }}>{numAmt.toFixed(4)} X1SAFE_PUT</span>
          </div>
          <div className="conversion-row">
            <span className="label">Tỉ lệ</span>
            <span className="value">1:1 cố định</span>
          </div>
          <div className="conversion-divider" />
          <div className="conversion-total">
            <span className="label">→ Bạn nhận</span>
            <span className="value" style={{ color: 'var(--success)' }}>{numAmt.toFixed(4)} X1SAFE (free)</span>
          </div>
          <div style={{ marginTop: 8, fontSize: '0.68rem', color: 'var(--text-3)' }}>
            ⚠️ Collateral gốc không được trả về · PUT bị hủy vĩnh viễn
          </div>
        </div>
      )}

      {isInsufficient && (
        <div className="info-box warning" style={{ marginBottom: 14 }}>
          ⚠️ Vượt quá PUT balance ({putBalance.toFixed(4)})
        </div>
      )}

      {error && <div className="info-box danger" style={{ marginBottom: 14 }}>❌ {error}</div>}
      {txSig && (
        <div className="tx-status success" style={{ marginBottom: 14 }}>
          <span>✅ Withdrawn! {numAmt.toFixed(4)} X1SAFE nhận được</span>
          <a href={`${EXPLORER}/tx/${txSig}`} target="_blank" rel="noopener noreferrer"
            style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--success)', textDecoration: 'none' }}>
            View ↗
          </a>
        </div>
      )}

      {showConfirm && numAmt > 0 && !error && (
        <div style={{ padding: '12px 14px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: 'var(--danger)', fontWeight: 500, marginBottom: 10 }}>
          ⚠️ Bạn sẽ hủy {numAmt.toFixed(4)} X1SAFE_PUT và mất quyền Exit collateral. Không thể hoàn tác.
        </div>
      )}

      {!showConfirm ? (
        <button
          className="btn btn-primary btn-full btn-lg"
          disabled={!numAmt || isInsufficient || putBalance === 0}
          onClick={() => setShowConfirm(true)}
          style={{ fontWeight: 700 }}
        >
          Withdraw {numAmt > 0 ? `${numAmt.toFixed(4)} PUT → X1SAFE` : ''}
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            className="btn btn-danger btn-full btn-lg"
            onClick={handleWithdraw}
            disabled={loading}
            style={{ fontWeight: 700 }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
                Processing…
              </span>
            ) : `✓ Confirm Withdraw & Burn PUT`}
          </button>
          <button className="btn btn-secondary btn-full" onClick={() => setShowConfirm(false)} disabled={loading}>
            Cancel
          </button>
        </div>
      )}

      <div style={{ marginTop: 12, textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-3)' }}>
        {IS_TESTNET ? '🔶 Testnet' : '🟢 Mainnet'} · redeem_x1safe · 1 PUT = 1 X1SAFE
      </div>

    </div>
  )
}
