import { useState, useEffect } from 'react'
import { useConnection, useWallet, useAnchorWallet } from '@solana/wallet-adapter-react'
import { AnchorProvider } from '@coral-xyz/anchor'
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { Transaction } from '@solana/web3.js'
import {
  EXPLORER, IS_TESTNET,
  getProgram, getVaultPDA, getPutMintPDA, getSafeMintPDA, getUserPositionPDA,
  getTokenBalance, toBaseUnits,
} from '../lib/vault'
import { TokenLogo } from './TokenLogo'

export function Withdraw() {
  const { connection } = useConnection()
  const wallet         = useWallet()
  const anchorWallet   = useAnchorWallet()

  const [amount,      setAmount]      = useState('')
  const [loading,     setLoading]     = useState(false)
  const [txSig,       setTxSig]       = useState('')
  const [error,       setError]       = useState('')
  const [putBalance,  setPutBalance]  = useState(0)
  const [safeBalance, setSafeBalance] = useState(0)
  const [showConfirm, setShowConfirm] = useState(false)

  const numAmt = parseFloat(amount) || 0
  const isInsufficient = numAmt > putBalance && putBalance > 0
  const canWithdraw = !loading && numAmt > 0 && !isInsufficient && putBalance > 0 && !!anchorWallet

  const load = async () => {
    if (!wallet.publicKey) return
    const putMint  = getPutMintPDA()
    const safeMint = getSafeMintPDA()
    const [put, safe] = await Promise.all([
      getTokenBalance(connection, wallet.publicKey, putMint),
      getTokenBalance(connection, wallet.publicKey, safeMint),
    ])
    setPutBalance(put)
    setSafeBalance(safe)
  }

  useEffect(() => { load() }, [wallet.publicKey, connection, txSig])

  const handleWithdraw = async () => {
    if (!wallet.publicKey || !anchorWallet || !amount) return
    setLoading(true); setError(''); setTxSig('')
    try {
      const provider     = new AnchorProvider(connection, anchorWallet, { commitment: 'confirmed' })
      const program      = getProgram(provider)
      const vault        = getVaultPDA()
      const putMint      = getPutMintPDA()
      const safeMint     = getSafeMintPDA()
      const userPosition = getUserPositionPDA(wallet.publicKey)

      // PUT and SAFE mints are Token classic (TokenkegQ) — verified on-chain 2026-03-20
      const userPutAccount  = await getAssociatedTokenAddress(putMint,  wallet.publicKey, false, TOKEN_PROGRAM_ID)
      const userSafeAccount = await getAssociatedTokenAddress(safeMint, wallet.publicKey, false, TOKEN_PROGRAM_ID)

      // Ensure user safe ATA exists
      try { await getAccount(connection, userSafeAccount, undefined, TOKEN_PROGRAM_ID) } catch {
        const tx = new Transaction()
        tx.add(createAssociatedTokenAccountInstruction(wallet.publicKey, userSafeAccount, wallet.publicKey, safeMint, TOKEN_PROGRAM_ID))
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
        tx.feePayer = wallet.publicKey
        const signed = await wallet.signTransaction!(tx)
        await connection.confirmTransaction(
          await connection.sendRawTransaction(signed.serialize()),
          'confirmed'
        )
      }

      const tx = await program.methods
        .withdraw(toBaseUnits(numAmt, 6))
        .accounts({
          user: wallet.publicKey,
          vault,
          putMint,
          safeMint,
          userPutAccount,
          userSafeAccount,
          userPosition,
        })
        .rpc()

      setTxSig(tx)
      setAmount('')
      setShowConfirm(false)
      // Refresh balances
      await load()
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

      {/* ── Balance cards ── */}
      <div className="form-label" style={{ marginBottom: 10 }}>Your Vault Receipts</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>

        {/* PUT balance */}
        <div style={{
          background: putBalance > 0
            ? 'linear-gradient(135deg, rgba(147,51,234,0.07) 0%, rgba(147,51,234,0.02) 100%)'
            : 'var(--bg-elevated)',
          border: `1px solid ${putBalance > 0 ? 'rgba(147,51,234,0.2)' : 'var(--border)'}`,
          borderRadius: 'var(--radius)',
          padding: '16px',
        }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 6 }}>
            <span style={{display:'flex',alignItems:'center',gap:6}}><TokenLogo token="X1SAFE" size={18}/>X1SAFE_PUT</span>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.03em', color: putBalance > 0 ? 'var(--xnt-color)' : 'var(--text-3)' }}>
            {putBalance > 0 ? putBalance.toFixed(2) : '0.00'}
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginTop: 4 }}>
            Locked receipt
          </div>
        </div>

        {/* X1SAFE free balance */}
        <div style={{
          background: safeBalance > 0
            ? 'linear-gradient(135deg, rgba(34,197,94,0.07) 0%, rgba(34,197,94,0.02) 100%)'
            : 'var(--bg-elevated)',
          border: `1px solid ${safeBalance > 0 ? 'rgba(34,197,94,0.2)' : 'var(--border)'}`,
          borderRadius: 'var(--radius)',
          padding: '16px',
        }}>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 6 }}>
            <span style={{display:'flex',alignItems:'center',gap:6}}><TokenLogo token="X1SAFE" size={18}/>X1SAFE (free)</span>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.03em', color: safeBalance > 0 ? 'var(--success)' : 'var(--text-3)' }}>
            {safeBalance > 0 ? safeBalance.toFixed(2) : '0.00'}
          </div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', marginTop: 4 }}>
            Transferable
          </div>
        </div>
      </div>

      {/* ── Info box ── */}
      <div className="info-box info" style={{ marginBottom: 16 }}>
        Burn X1SAFE_PUT → nhận X1SAFE tự do (tỉ lệ 1:1). Collateral vẫn nằm trong vault.
      </div>

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
            onChange={e => { setAmount(e.target.value); setError(''); setTxSig(''); setShowConfirm(false) }}
          />
          <div className="amount-input-asset" style={{ color: 'var(--xnt-color)' }}>
            <span style={{display:'flex',alignItems:'center',gap:5}}><TokenLogo token="X1SAFE" size={16}/>PUT</span>
          </div>
        </div>
        <div className="amount-input-footer">
          <span className="amount-usd">
            {numAmt > 0 ? `→ ${numAmt.toFixed(4)} X1SAFE (free)` : 'Enter PUT amount'}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="amount-max-btn"
              onClick={() => { setAmount((putBalance / 2).toFixed(6)); setShowConfirm(false) }}
              disabled={putBalance === 0}
            >
              HALF
            </button>
            <button
              className="amount-max-btn"
              onClick={() => { setAmount(putBalance.toFixed(6)); setShowConfirm(false) }}
              disabled={putBalance === 0}
            >
              MAX
            </button>
          </div>
        </div>
        <div style={{
          marginTop: 10,
          paddingTop: 10,
          borderTop: '1px solid var(--border-soft)',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.75rem',
          color: 'var(--text-3)',
        }}>
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
            <span className="value">{numAmt.toFixed(4)} X1SAFE</span>
          </div>
          <div style={{ marginTop: 10, fontSize: '0.7rem', color: 'var(--text-3)', display: 'flex', gap: 12 }}>
            <span>PUT bị hủy vĩnh viễn</span>
            <span>·</span>
            <span>X1SAFE có thể chuyển tự do</span>
          </div>
        </div>
      )}

      {/* ── Warnings ── */}
      {putBalance === 0 && (
        <div className="info-box warning" style={{ marginBottom: 14 }}>
          ⚠️ Bạn chưa có X1SAFE_PUT. Hãy deposit tài sản vào vault trước.
        </div>
      )}
      {isInsufficient && (
        <div className="info-box warning" style={{ marginBottom: 14 }}>
          ⚠️ Số lượng vượt quá PUT balance ({putBalance.toFixed(4)} PUT)
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="info-box danger" style={{ marginBottom: 14 }}>
          ❌ {error}
        </div>
      )}

      {/* ── Success ── */}
      {txSig && (
        <div className="tx-status success" style={{ marginBottom: 14 }}>
          <span>✅ Withdraw thành công</span>
          <a
            href={`${EXPLORER}/tx/${txSig}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--success)', textDecoration: 'none' }}
          >
            View on Explorer ↗
          </a>
        </div>
      )}

      {/* ── Confirm step ── */}
      {showConfirm && numAmt > 0 && !error && (
        <div style={{
          padding: '14px 16px',
          background: 'rgba(245,158,11,0.05)',
          border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.85rem',
          color: '#d97706',
          fontWeight: 500,
          marginBottom: 10,
        }}>
          ⚠️ Xác nhận burn {numAmt.toFixed(4)} X1SAFE_PUT — thao tác không thể hoàn tác
        </div>
      )}

      {/* ── Buttons ── */}
      {!showConfirm ? (
        <button
          className="btn btn-primary btn-full btn-lg"
          onClick={() => setShowConfirm(true)}
          disabled={!canWithdraw}
          style={{ fontWeight: 700, letterSpacing: '-0.02em' }}
        >
          {numAmt > 0 && !isInsufficient
            ? `Withdraw ${numAmt.toFixed(4)} PUT → ${numAmt.toFixed(4)} X1SAFE`
            : 'Withdraw PUT'}
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            className="btn btn-primary btn-full btn-lg"
            onClick={handleWithdraw}
            disabled={loading}
            style={{ fontWeight: 700 }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
                Processing…
              </span>
            ) : '✓ Xác nhận Withdraw'}
          </button>
          <button
            className="btn btn-secondary btn-full"
            onClick={() => setShowConfirm(false)}
            disabled={loading}
          >
            Hủy
          </button>
        </div>
      )}

      <div style={{ marginTop: 12, textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-3)' }}>
        {IS_TESTNET ? '🔶 Testnet' : '🟢 Mainnet'} · PUT → X1SAFE tỉ lệ 1:1 · Collateral giữ nguyên trong vault
      </div>

    </div>
  )
}
