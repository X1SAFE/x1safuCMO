import { useState, useEffect } from 'react'
import { useConnection, useWallet, useAnchorWallet } from '@solana/wallet-adapter-react'
import { AnchorProvider } from '@coral-xyz/anchor'
import {
  getAssociatedTokenAddress, createAssociatedTokenAccountInstruction,
  getAccount, TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { Transaction } from '@solana/web3.js'
import {
  ASSETS, EXPLORER, IS_TESTNET,
  getProgram, getVaultPDA, getPutMintPDA, getSafeMintPDA,
  getReserveAccount, getUserPositionPDA, getStakePoolPDA, getStakeReservePDA,
  fetchVaultState, getTokenBalance, toBaseUnits,
} from '../lib/vault'

export function Exit() {
  const { connection } = useConnection()
  const wallet         = useWallet()
  const anchorWallet   = useAnchorWallet()

  const [amount,      setAmount]      = useState('')
  const [loading,     setLoading]     = useState(false)
  const [txSig,       setTxSig]       = useState('')
  const [error,       setError]       = useState('')
  const [putBalance,  setPutBalance]  = useState(0)
  const [totalPut,    setTotalPut]    = useState(0)
  const [showConfirm, setShowConfirm] = useState(false)

  const numAmt = parseFloat(amount) || 0

  const load = async () => {
    if (!wallet.publicKey) return
    const putMint = getPutMintPDA()
    const [put, state] = await Promise.all([
      getTokenBalance(connection, wallet.publicKey, putMint),
      fetchVaultState(connection),
    ])
    setPutBalance(put)
    if (state) setTotalPut(state.totalX1safePutSupply / 1e9)
  }

  useEffect(() => { load() }, [wallet.publicKey, connection, txSig])

  const estPct = totalPut > 0 && numAmt > 0
    ? ((numAmt / totalPut) * 100).toFixed(2)
    : '0'

  const handleExit = async () => {
    if (!wallet.publicKey || !wallet.signTransaction || !anchorWallet || !amount) return
    setLoading(true); setError(''); setTxSig('')
    try {
      const provider     = new AnchorProvider(connection, anchorWallet, { commitment: 'confirmed' })
      const program      = getProgram(provider)
      const vault        = getVaultPDA()
      const putMint      = getPutMintPDA()
      const safeMint     = getSafeMintPDA()
      const stakePool    = getStakePoolPDA()
      const stakeReserve = getStakeReservePDA()
      const userPos      = getUserPositionPDA(wallet.publicKey)
      const userPutAta   = await getAssociatedTokenAddress(putMint, wallet.publicKey, false, TOKEN_PROGRAM_ID)
      const amountBN     = toBaseUnits(numAmt, 9)

      // Build remaining accounts: [reserve_0, user_ata_0, ...] per asset
      // Create any missing user ATAs first
      const preTx = new Transaction()
      let needPreTx = false
      const remaining: { pubkey: import('@solana/web3.js').PublicKey; isWritable: boolean; isSigner: boolean }[] = []

      for (const a of ASSETS) {
        const reserveAcct = getReserveAccount(a.mint)
        const userAta     = await getAssociatedTokenAddress(a.mint, wallet.publicKey, false, TOKEN_PROGRAM_ID)
        try { await getAccount(connection, userAta, undefined, TOKEN_PROGRAM_ID) } catch {
          preTx.add(createAssociatedTokenAccountInstruction(
            wallet.publicKey, userAta, wallet.publicKey, a.mint, TOKEN_PROGRAM_ID
          ))
          needPreTx = true
        }
        remaining.push({ pubkey: reserveAcct, isWritable: true, isSigner: false })
        remaining.push({ pubkey: userAta,     isWritable: true, isSigner: false })
      }

      // Also ensure stake_reserve ATA exists (for minted X1SAFE)
      try { await getAccount(connection, stakeReserve, undefined, TOKEN_PROGRAM_ID) } catch {
        preTx.add(createAssociatedTokenAccountInstruction(
          wallet.publicKey, stakeReserve, stakePool, safeMint, TOKEN_PROGRAM_ID
        ))
        needPreTx = true
      }

      if (needPreTx) {
        preTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
        preTx.feePayer = wallet.publicKey
        const signed = await wallet.signTransaction(preTx)
        await connection.confirmTransaction(
          await connection.sendRawTransaction(signed.serialize()), 'confirmed'
        )
      }

      // Main exit tx
      const sig = await program.methods
        .exit(amountBN)
        .accounts({
          user:           wallet.publicKey,
          vault,
          putMint,
          safeMint,
          userPutAccount: userPutAta,
          stakePool,
          stakeReserve,
          userPosition:   userPos,
        })
        .remainingAccounts(remaining)
        .rpc()

      setTxSig(sig); setAmount(''); setShowConfirm(false)
      await load()
    } catch (e: any) {
      setError(e?.message || 'Transaction failed')
    } finally { setLoading(false) }
  }

  if (!wallet.connected) {
    return (
      <div className="tab-content">
        <div className="empty-state">
          <div className="empty-state-icon">⏏</div>
          <div className="empty-state-text">Connect Wallet to Exit</div>
          <div className="empty-state-sub">Connect your wallet to exit the vault.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="tab-content">

      <div style={{ marginBottom: 16 }}>
        <div className="page-title" style={{ fontSize: '1.15rem', fontWeight: 800 }}>Exit Vault</div>
        <div className="page-subtitle">Burn X1SAFE_PUT → get collateral back + X1SAFE auto-staked</div>
      </div>

      {/* ── How it works ── */}
      <div style={{
        marginBottom: 14, padding: '12px 14px',
        background: 'rgba(34,197,94,0.04)',
        border: '1px solid rgba(34,197,94,0.15)',
        borderRadius: 'var(--radius)',
        fontSize: '0.78rem', color: 'var(--text-2)', lineHeight: 1.6,
      }}>
        <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--success)' }}>⏏ Exit = Best of both worlds</div>
        <div>1. 🔓 Burn X1SAFE_PUT</div>
        <div>2. 💰 Receive proportional collateral (XNT/USDC.X) back to wallet</div>
        <div>3. ⬡ X1SAFE minted 1:1 → auto-deposited into staking pool (earn yield)</div>
      </div>

      {/* ── Warning ── */}
      <div className="info-box danger" style={{ marginBottom: 14, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ flexShrink: 0 }}>⚠️</span>
        <div style={{ fontSize: '0.78rem' }}>
          <strong>Irreversible.</strong> Once exited, PUT is burned. Collateral returns to your wallet. X1SAFE goes to staking.
        </div>
      </div>

      {/* ── PUT balance card ── */}
      <div style={{
        background: putBalance > 0
          ? 'linear-gradient(135deg, rgba(168,85,247,0.07) 0%, rgba(168,85,247,0.02) 100%)'
          : 'var(--bg-elevated)',
        border: `1px solid ${putBalance > 0 ? 'rgba(168,85,247,0.25)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        padding: '16px 20px',
        marginBottom: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 4 }}>
            X1SAFE_PUT Balance
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.03em', color: putBalance > 0 ? 'var(--xnt-color)' : 'var(--text-3)' }}>
            {putBalance > 0 ? putBalance.toFixed(4) : 'None'}
          </div>
        </div>
        {putBalance > 0 && (
          <button
            className="btn btn-sm"
            style={{ background: 'rgba(168,85,247,0.08)', color: 'var(--xnt-color)', border: '1px solid rgba(168,85,247,0.2)' }}
            onClick={() => { setAmount(putBalance.toFixed(6)); setShowConfirm(false) }}
          >Exit All</button>
        )}
      </div>

      {/* ── Amount input ── */}
      <div className="amount-input-block" style={{ marginBottom: 14, borderColor: numAmt > 0 ? 'rgba(168,85,247,0.25)' : 'var(--border)' }}>
        <div className="amount-input-row">
          <input
            type="number"
            className="amount-input-big"
            placeholder="0.00"
            value={amount}
            min="0"
            step="any"
            onChange={e => { setAmount(e.target.value); setError(''); setTxSig(''); setShowConfirm(false) }}
            style={{ color: numAmt > 0 ? 'var(--xnt-color)' : undefined }}
          />
          <div className="amount-input-asset" style={{ color: 'var(--xnt-color)' }}>PUT</div>
        </div>
        <div className="amount-input-footer">
          <span className="amount-usd">{numAmt > 0 ? `~${estPct}% of vault reserves` : 'Enter PUT amount'}</span>
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
            <span className="label">📊 Share of vault</span>
            <span className="value">{estPct}%</span>
          </div>
          <div className="conversion-divider" />
          <div className="conversion-row">
            <span className="label">💰 Collateral back</span>
            <span className="value" style={{ color: 'var(--success)' }}>Proportional XNT + USDC.X</span>
          </div>
          <div className="conversion-row">
            <span className="label">⬡ Auto-staked</span>
            <span className="value" style={{ color: 'var(--success)' }}>{numAmt.toFixed(4)} X1SAFE → staking pool</span>
          </div>
          <div style={{ marginTop: 10, fontSize: '0.7rem', color: 'var(--text-3)' }}>
            X1SAFE goes directly to staking pool — earns yield immediately
          </div>
        </div>
      )}

      {/* ── Warnings ── */}
      {putBalance === 0 && (
        <div className="info-box warning" style={{ marginBottom: 14 }}>
          ⚠️ No X1SAFE_PUT — deposit collateral first on the Deposit tab.
        </div>
      )}
      {numAmt > putBalance && putBalance > 0 && (
        <div className="info-box warning" style={{ marginBottom: 14 }}>
          ⚠️ Amount exceeds balance ({putBalance.toFixed(4)} PUT)
        </div>
      )}

      {/* ── Error / Success ── */}
      {error && <div className="info-box danger" style={{ marginBottom: 14 }}>❌ {error}</div>}
      {txSig && (
        <div className="tx-status success" style={{ marginBottom: 14 }}>
          <span>✅ Exit confirmed — collateral returned + X1SAFE staked</span>
          <a href={`${EXPLORER}/tx/${txSig}`} target="_blank" rel="noopener noreferrer"
            style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--success)', textDecoration: 'none' }}>
            View ↗
          </a>
        </div>
      )}

      {/* ── Confirm ── */}
      {showConfirm && numAmt > 0 && !error && (
        <div style={{ padding: '14px 16px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: 'var(--danger)', fontWeight: 500, marginBottom: 10 }}>
          ⚠️ Confirm burn {numAmt.toFixed(4)} PUT — you receive collateral + X1SAFE is staked. Cannot undo.
        </div>
      )}

      {!showConfirm ? (
        <button
          className="btn btn-primary btn-full btn-lg"
          onClick={() => setShowConfirm(true)}
          disabled={!numAmt || numAmt > putBalance || putBalance === 0}
          style={{ fontWeight: 700, letterSpacing: '-0.02em' }}
        >
          Exit {numAmt > 0 ? `${numAmt.toFixed(4)} PUT` : ''}
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="btn btn-danger btn-full btn-lg" onClick={handleExit} disabled={loading} style={{ fontWeight: 700 }}>
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
                Processing…
              </span>
            ) : '✓ Confirm Exit'}
          </button>
          <button className="btn btn-secondary btn-full" onClick={() => setShowConfirm(false)} disabled={loading}>Cancel</button>
        </div>
      )}

      <div style={{ marginTop: 12, textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-3)' }}>
        {IS_TESTNET ? '🔶 Testnet' : '🟢 Mainnet'} · PUT → Collateral + Auto-stake X1SAFE
      </div>

    </div>
  )
}
