import { useState, useEffect } from 'react'
import { useConnection, useWallet, useAnchorWallet } from '@solana/wallet-adapter-react'
import { AnchorProvider } from '@coral-xyz/anchor'
import {
  getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getAccount,
  TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import { Transaction, PublicKey } from '@solana/web3.js'
import {
  ASSETS, EXPLORER, IS_TESTNET,
  getProgram, getVaultPDA, getSafeMintPDA, getReserveAccount,
  fetchVaultState, getTokenBalance, toBaseUnits,
} from '../lib/vault'

// Detect which token program owns a given mint
async function getMintTokenProgram(
  connection: import('@solana/web3.js').Connection,
  mint: PublicKey
): Promise<PublicKey> {
  try {
    const info = await connection.getAccountInfo(mint)
    if (!info) return TOKEN_PROGRAM_ID
    return info.owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID
  } catch {
    return TOKEN_PROGRAM_ID
  }
}

export function Exit() {
  const { connection } = useConnection()
  const wallet         = useWallet()
  const anchorWallet   = useAnchorWallet()

  const [amount,      setAmount]      = useState('')
  const [loading,     setLoading]     = useState(false)
  const [txSig,       setTxSig]       = useState('')
  const [error,       setError]       = useState('')
  const [safeBalance, setSafeBalance] = useState(0)
  const [totalFree,   setTotalFree]   = useState(0)
  const [showConfirm, setShowConfirm] = useState(false)

  const numAmt = parseFloat(amount) || 0

  const load = async () => {
    if (!wallet.publicKey) return
    const safeMint = getSafeMintPDA()
    const [bal, state] = await Promise.all([
      getTokenBalance(connection, wallet.publicKey, safeMint),
      fetchVaultState(connection),
    ])
    setSafeBalance(bal)
    if (state) setTotalFree(state.totalFreeSupply / 1e6)
  }

  useEffect(() => { load() }, [wallet.publicKey, connection, txSig])

  const handleExit = async () => {
    if (!wallet.publicKey || !anchorWallet || !amount) return
    setLoading(true); setError(''); setTxSig('')
    try {
      const provider = new AnchorProvider(connection, anchorWallet, { commitment: 'confirmed' })
      const program  = getProgram(provider)
      const vault    = getVaultPDA()
      const safeMint = getSafeMintPDA()

      const userSafeAccount = await getAssociatedTokenAddress(safeMint, wallet.publicKey)

      // Build remaining accounts: [reserve_0, user_ata_0, ...] for each asset
      const remainingAccounts: { pubkey: import('@solana/web3.js').PublicKey; isWritable: boolean; isSigner: boolean }[] = []
      for (const a of ASSETS) {
        // Detect correct token program (Token vs Token-2022) per mint
        const tokenProgram = await getMintTokenProgram(connection, a.mint)
        const reserveAcct  = getReserveAccount(a.mint)
        const userAta      = getAssociatedTokenAddressSync(a.mint, wallet.publicKey, false, tokenProgram)

        // Create user ATA if needed — using correct token program
        try { await getAccount(connection, userAta, 'confirmed', tokenProgram) } catch {
          const tx = new Transaction()
          tx.add(createAssociatedTokenAccountInstruction(
            wallet.publicKey, userAta, wallet.publicKey, a.mint,
            tokenProgram
          ))
          tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
          tx.feePayer = wallet.publicKey
          const signed = await wallet.signTransaction!(tx)
          await connection.confirmTransaction(
            await connection.sendRawTransaction(signed.serialize()),
            'confirmed'
          )
        }

        remainingAccounts.push({ pubkey: reserveAcct, isWritable: true, isSigner: false })
        remainingAccounts.push({ pubkey: userAta,     isWritable: true, isSigner: false })
      }

      const tx = await program.methods
        .exit(toBaseUnits(numAmt, 6))
        .accounts({
          user: wallet.publicKey,
          vault,
          safeMint,
          userSafeAccount,
        })
        .remainingAccounts(remainingAccounts)
        .rpc()

      setTxSig(tx); setAmount(''); setShowConfirm(false)
    } catch (e: any) {
      setError(e?.message || 'Transaction failed')
    } finally { setLoading(false) }
  }

  // Estimate proportional payout per asset
  const estPayout = totalFree > 0 && numAmt > 0
    ? ASSETS.map(a => ({ ...a, est: (numAmt / totalFree) * 100 })) // % of reserves
    : []

  if (!wallet.connected) {
    return (
      <div style={{ maxWidth: 480, margin: '24px auto' }}>
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🔐</div>
            <div className="empty-state-title">Wallet not connected</div>
            <div className="empty-state-sub">Connect to exit the vault.</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      <div style={{ marginBottom: 18 }}>
        <div className="page-title">Exit Vault</div>
        <div className="page-subtitle">Burn X1SAFE (free) → receive proportional collateral</div>
      </div>

      <div className="info-box danger" style={{ marginBottom: 14, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ fontSize: '1rem', flexShrink: 0 }}>⚠️</span>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 2 }}>Exits the vault — releases collateral</div>
          <div>You will receive a proportional share of all vault reserves across USDC.X, XNT, and XEN.</div>
        </div>
      </div>

      <div style={{
        background: safeBalance > 0 ? 'var(--danger-dim)' : 'var(--bg-elevated)',
        border: `1px solid ${safeBalance > 0 ? 'rgba(239,68,68,0.18)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: '18px 20px',
        marginBottom: 14,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 4 }}>
            X1SAFE (Free) Balance
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.03em', color: safeBalance > 0 ? 'var(--danger)' : 'var(--text-3)' }}>
            {safeBalance > 0 ? safeBalance.toFixed(2) : 'No X1SAFE'}
          </div>
        </div>
        {safeBalance > 0 && (
          <button className="btn btn-sm"
            style={{ background: 'var(--danger-dim)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,0.2)' }}
            onClick={() => setAmount(safeBalance.toFixed(6))}>
            Exit All
          </button>
        )}
      </div>

      <div className="section-header">
        <span className="section-title">Amount to Exit</span>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
          Free X1SAFE: <strong style={{ color: 'var(--danger)' }}>{safeBalance.toFixed(2)}</strong>
        </span>
      </div>

      <div className="amount-input-block" style={{ borderColor: numAmt > 0 ? 'rgba(239,68,68,0.25)' : 'var(--border)' }}>
        <div className="amount-input-row">
          <input
            type="number"
            className="amount-input-big"
            placeholder="0.00"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            style={{ color: numAmt > 0 ? 'var(--danger)' : 'var(--text)' }}
          />
          <div className="amount-input-asset">X1SAFE</div>
        </div>
        <div className="amount-input-footer">
          <span className="amount-usd">{numAmt > 0 ? `Burning ${numAmt.toFixed(4)} X1SAFE` : 'Enter amount'}</span>
          <button className="amount-max-btn" style={{ color: 'var(--danger)' }}
            onClick={() => setAmount(safeBalance.toFixed(6))}>MAX</button>
        </div>
      </div>

      {estPayout.length > 0 && (
        <div className="conversion-card">
          <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginBottom: 8 }}>
            Estimated payout ({numAmt > 0 && totalFree > 0 ? ((numAmt / totalFree) * 100).toFixed(2) : 0}% of reserves):
          </div>
          {estPayout.map(a => (
            <div key={a.key} className="conversion-row">
              <span className="label">{a.label}</span>
              <span className="value">proportional share</span>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="tx-status error" style={{ marginBottom: 12 }}>
          <span>⚠</span> {error}
        </div>
      )}

      {!showConfirm ? (
        <button
          className="btn btn-danger btn-full btn-lg"
          onClick={() => setShowConfirm(true)}
          disabled={!amount || numAmt <= 0 || safeBalance <= 0}
        >
          Exit {numAmt > 0 ? `${numAmt.toFixed(4)} X1SAFE` : ''}
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ padding: '14px 16px', background: 'var(--danger-dim)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: 'var(--danger)', fontWeight: 500 }}>
            ⚠ Burn {numAmt.toFixed(4)} X1SAFE and release proportional collateral?
          </div>
          <button className="btn btn-danger btn-full" onClick={handleExit} disabled={loading}>
            {loading ? <><span className="loading" style={{ borderTopColor: '#fff' }} /> Processing…</> : '✓ Confirm Exit'}
          </button>
          <button className="btn btn-secondary btn-full" onClick={() => setShowConfirm(false)} disabled={loading}>Cancel</button>
        </div>
      )}

      {txSig && (
        <div className="tx-status success" style={{ marginTop: 12 }}>
          <span>✓</span>
          <span>Exit successful!{' '}
            <a href={`${EXPLORER}/tx/${txSig}`} target="_blank" rel="noopener" style={{ color: 'var(--success)', fontWeight: 700 }}>View tx ↗</a>
          </span>
        </div>
      )}

      <div className="program-footer" style={{ marginTop: 16 }}>
        <span>{IS_TESTNET ? '🔶 Testnet' : '🟢 Mainnet'}</span>
        <span>Proportional exit</span>
      </div>
    </div>
  )
}
