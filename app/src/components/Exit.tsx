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
const SUPPORTED_TOKEN_SEED = Buffer.from('supported_token')

function getUserPositionPDA(user: PublicKey, tokenMint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [USER_POSITION_SEED, user.toBuffer(), tokenMint.toBuffer()],
    STAKING_PROGRAM_ID
  )[0]
}

function getSupportedTokenPDA(tokenMint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SUPPORTED_TOKEN_SEED, tokenMint.toBuffer()],
    STAKING_PROGRAM_ID
  )[0]
}


// Token vaults created during add_supported_token
const TOKEN_VAULTS: Record<string, PublicKey> = {
  [MINTS.USDCX.toBase58()]: new PublicKey('ApSj1xNGYjEqxSyP4RncrR7FkXwja5dSzGRQW4gvgSRi'),
  [MINTS.XNT.toBase58()]:   new PublicKey('FUHno7PbvQbqoXSektfRBfjuPDiN75SdX2R2Hgncaqjf'),
}

const DEPOSIT_MINTS = [MINTS.XNT, MINTS.USDCX]

export function Exit() {
  const { connection } = useConnection()
  const wallet = useWallet()

  const [amount,      setAmount]      = useState('')
  const [loading,     setLoading]     = useState(false)
  const [txSig,       setTxSig]       = useState('')
  const [error,       setError]       = useState('')
  const [putBalance,  setPutBalance]  = useState(0)
  const [showConfirm, setShowConfirm] = useState(false)
  const [depositMint, setDepositMint] = useState<PublicKey>(MINTS.XNT)

  const numAmt = parseFloat(amount) || 0

  const load = async () => {
    if (!wallet.publicKey) return
    const put = await getTokenBalance(connection, wallet.publicKey, STAKING_X1SAFE_PUT_MINT)
    setPutBalance(put)
    // Find active user_position
    for (const mint of DEPOSIT_MINTS) {
      const pda = getUserPositionPDA(wallet.publicKey, mint)
      const info = await connection.getAccountInfo(pda)
      if (info) { setDepositMint(mint); break }
    }
  }

  useEffect(() => { load() }, [wallet.publicKey, connection, txSig])

  const handleExit = async () => {
    if (!wallet.publicKey || !wallet.signTransaction || !amount) return
    setLoading(true); setError(''); setTxSig('')
    try {
      const vaultState     = STAKING_VAULT_STATE
      const putMint        = STAKING_X1SAFE_PUT_MINT
      const safeMint       = STAKING_X1SAFE_MINT
      const userPosition   = getUserPositionPDA(wallet.publicKey, depositMint)
      const supportedToken = getSupportedTokenPDA(depositMint)
      const tokenVault     = TOKEN_VAULTS[depositMint.toBase58()]

      if (!tokenVault) throw new Error('Token vault not configured')

      const userPutAta    = getAssociatedTokenAddressSync(putMint,      wallet.publicKey, false, TOKEN_PROGRAM_ID)
      const userTokenAta  = getAssociatedTokenAddressSync(depositMint,  wallet.publicKey, false, TOKEN_PROGRAM_ID)
      const rewardPoolAta = getAssociatedTokenAddressSync(safeMint,     vaultState,       true,  TOKEN_PROGRAM_ID)

      const tx = new Transaction()

      // Ensure user collateral ATA exists
      try { await getAccount(connection, userTokenAta, undefined, TOKEN_PROGRAM_ID) } catch {
        tx.add(createATAInstruction(wallet.publicKey, userTokenAta, wallet.publicKey, depositMint))
      }
      // Ensure reward pool ATA exists (X1SAFE minted here)
      try { await getAccount(connection, rewardPoolAta, undefined, TOKEN_PROGRAM_ID) } catch {
        tx.add(createATAInstruction(wallet.publicKey, rewardPoolAta, vaultState, safeMint))
      }

      // Build exit_vault instruction
      // Args: x1safe_put_amount: u64 (8 bytes)
      const discBuf = disc('exit_vault')
      const amtBuf  = Buffer.allocUnsafe(8)
      amtBuf.writeBigUInt64LE(BigInt(toBaseUnits(numAmt, 6).toString()))
      const data = Buffer.concat([discBuf, amtBuf])

      // Account order matches ExitVault<'info> struct:
      // user, vault_state, user_position, supported_token, token_mint,
      // user_x1safe_put_account, x1safe_put_mint,
      // vault_token_account, user_token_account,
      // x1safe_mint, reward_pool_x1safe, token_program
      tx.add(new TransactionInstruction({
        programId: STAKING_PROGRAM_ID,
        keys: [
          { pubkey: wallet.publicKey, isSigner: true,  isWritable: true  }, // user
          { pubkey: vaultState,       isSigner: false, isWritable: true  }, // vault_state
          { pubkey: userPosition,     isSigner: false, isWritable: true  }, // user_position
          { pubkey: supportedToken,   isSigner: false, isWritable: false }, // supported_token
          { pubkey: depositMint,      isSigner: false, isWritable: false }, // token_mint
          { pubkey: userPutAta,       isSigner: false, isWritable: true  }, // user_x1safe_put_account
          { pubkey: putMint,          isSigner: false, isWritable: true  }, // x1safe_put_mint
          { pubkey: tokenVault,       isSigner: false, isWritable: true  }, // vault_token_account
          { pubkey: userTokenAta,     isSigner: false, isWritable: true  }, // user_token_account
          { pubkey: safeMint,         isSigner: false, isWritable: true  }, // x1safe_mint
          { pubkey: rewardPoolAta,    isSigner: false, isWritable: true  }, // reward_pool_x1safe
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
        <div className="page-subtitle">Burn X1SAFE_PUT → nhận collateral gốc + mint X1SAFE vào reward pool</div>
      </div>

      {/* ── How it works ── */}
      <div style={{
        marginBottom: 14, padding: '12px 14px',
        background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.15)',
        borderRadius: 'var(--radius)', fontSize: '0.78rem', color: 'var(--text-2)', lineHeight: 1.6,
      }}>
        <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--success)' }}>⏏ Exit — cách tốt nhất</div>
        <div>1. 🔥 Burn X1SAFE_PUT</div>
        <div>2. 💰 Nhận lại collateral gốc (XNT hoặc USDC.X)</div>
        <div>3. ⬡ X1SAFE mint 1:1 → reward pool → nuôi APR cho stakers</div>
      </div>

      {/* ── PUT balance ── */}
      <div style={{
        background: putBalance > 0
          ? 'linear-gradient(135deg,rgba(168,85,247,.07),rgba(168,85,247,.02))'
          : 'var(--bg-elevated)',
        border: `1px solid ${putBalance > 0 ? 'rgba(168,85,247,.25)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)', padding: '16px 20px', marginBottom: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: '0.65rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 4 }}>
            X1SAFE_PUT Balance
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: putBalance > 0 ? 'var(--xnt-color)' : 'var(--text-3)' }}>
            {putBalance > 0 ? putBalance.toFixed(4) : 'None'}
          </div>
        </div>
        {putBalance > 0 && (
          <button className="btn btn-sm"
            style={{ background: 'rgba(168,85,247,.08)', color: 'var(--xnt-color)', border: '1px solid rgba(168,85,247,.2)' }}
            onClick={() => { setAmount(putBalance.toFixed(6)); setShowConfirm(false) }}>
            Exit All
          </button>
        )}
      </div>

      {/* ── Amount input ── */}
      <div className="amount-input-block" style={{ marginBottom: 14 }}>
        <div className="amount-input-row">
          <input type="number" className="amount-input-big" placeholder="0.00"
            value={amount} min="0" step="any"
            disabled={putBalance === 0}
            onChange={e => { setAmount(e.target.value); setError(''); setTxSig(''); setShowConfirm(false) }}
            style={{ color: numAmt > 0 ? 'var(--xnt-color)' : undefined }}
          />
          <div className="amount-input-asset" style={{ color: 'var(--xnt-color)' }}>PUT</div>
        </div>
        <div className="amount-input-footer">
          <span className="amount-usd">{numAmt > 0 ? `→ collateral + ${numAmt.toFixed(4)} X1SAFE → pool` : 'Enter PUT amount'}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="amount-max-btn" onClick={() => { setAmount((putBalance / 2).toFixed(6)); setShowConfirm(false) }} disabled={putBalance === 0}>HALF</button>
            <button className="amount-max-btn" onClick={() => { setAmount(putBalance.toFixed(6)); setShowConfirm(false) }} disabled={putBalance === 0}>MAX</button>
          </div>
        </div>
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-3)' }}>
          <span>PUT Balance</span>
          <span style={{ color: putBalance > 0 ? 'var(--xnt-color)' : undefined, fontWeight: 600 }}>{putBalance.toFixed(4)} PUT</span>
        </div>
      </div>

      {/* ── Conversion card ── */}
      {numAmt > 0 && (
        <div className="conversion-card" style={{ marginBottom: 14 }}>
          <div className="conversion-row">
            <span className="label">🔥 Burn</span>
            <span className="value" style={{ color: 'var(--xnt-color)' }}>{numAmt.toFixed(4)} X1SAFE_PUT</span>
          </div>
          <div className="conversion-divider" />
          <div className="conversion-row">
            <span className="label">💰 Collateral về</span>
            <span className="value" style={{ color: 'var(--success)' }}>Proportional {depositMint.equals(MINTS.USDCX) ? 'USDC.X' : 'XNT'}</span>
          </div>
          <div className="conversion-row">
            <span className="label">⬡ Mint vào reward pool</span>
            <span className="value" style={{ color: 'var(--success)' }}>{numAmt.toFixed(4)} X1SAFE</span>
          </div>
          <div style={{ marginTop: 8, fontSize: '0.68rem', color: 'var(--text-3)' }}>
            X1SAFE vào pool → stakers earn · Càng nhiều Exit → APR càng cao
          </div>
        </div>
      )}

      {/* ── Warnings ── */}
      {putBalance === 0 && (
        <div className="info-box warning" style={{ marginBottom: 14 }}>
          ⚠️ Không có X1SAFE_PUT — deposit collateral trước ở tab Deposit.
        </div>
      )}
      {numAmt > putBalance && putBalance > 0 && (
        <div className="info-box warning" style={{ marginBottom: 14 }}>
          ⚠️ Vượt quá balance ({putBalance.toFixed(4)} PUT)
        </div>
      )}

      {error && <div className="info-box danger" style={{ marginBottom: 14 }}>❌ {error}</div>}
      {txSig && (
        <div className="tx-status success" style={{ marginBottom: 14 }}>
          <span>✅ Exit thành công — collateral về + X1SAFE vào reward pool</span>
          <a href={`${EXPLORER}/tx/${txSig}`} target="_blank" rel="noopener noreferrer"
            style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--success)', textDecoration: 'none' }}>View ↗</a>
        </div>
      )}

      {showConfirm && numAmt > 0 && !error && (
        <div style={{ padding: '12px 14px', background: 'rgba(239,68,68,.05)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: 'var(--danger)', fontWeight: 500, marginBottom: 10 }}>
          ⚠️ Burn {numAmt.toFixed(4)} PUT → nhận collateral + mint X1SAFE vào pool. Không thể hoàn tác.
        </div>
      )}

      {!showConfirm ? (
        <button className="btn btn-primary btn-full btn-lg"
          onClick={() => setShowConfirm(true)}
          disabled={!numAmt || numAmt > putBalance || putBalance === 0}
          style={{ fontWeight: 700 }}>
          Exit {numAmt > 0 ? `${numAmt.toFixed(4)} PUT` : ''}
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="btn btn-danger btn-full btn-lg" onClick={handleExit} disabled={loading} style={{ fontWeight: 700 }}>
            {loading
              ? <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>Processing…</span>
              : '✓ Confirm Exit'}
          </button>
          <button className="btn btn-secondary btn-full" onClick={() => setShowConfirm(false)} disabled={loading}>Cancel</button>
        </div>
      )}

      <div style={{ marginTop: 12, textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-3)' }}>
        {IS_TESTNET ? '🔶 Testnet' : '🟢 Mainnet'} · exit_vault · PUT → Collateral + X1SAFE → reward pool
      </div>

    </div>
  )
}
