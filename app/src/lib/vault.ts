import { Connection, PublicKey } from '@solana/web3.js'
import { AnchorProvider, Program, BN } from '@coral-xyz/anchor'
import { getAssociatedTokenAddress, getAssociatedTokenAddressSync } from '@solana/spl-token'

// ── Config ────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const _env = (import.meta as any).env || {}
export const PROGRAM_ID = new PublicKey(
  _env.VITE_PROGRAM_ID || 'F2JnWVnjP1h6WG7KKUHqhp23etEJ4amdJquAcE9ecCoe'
)
export const RPC_URL    = _env.VITE_RPC_URL  || 'https://rpc.testnet.x1.xyz'
export const IS_TESTNET = (_env.VITE_NETWORK || 'testnet') === 'testnet'
export const EXPLORER   = IS_TESTNET
  ? 'https://explorer.testnet.x1.xyz'
  : 'https://explorer.mainnet.x1.xyz'

// ── X1SAFE Token Rate ─────────────────────────────────────────────────────────
export const X1SAFE_PER_USD = 1

// ── Supported Assets ─────────────────────────────────────────────────────────
export const MINTS = {
  USDCX: new PublicKey('3VAPVRUV25jVm2EzuQpQpJWugLH4AzBPWJK5sQyZJuct'),
  XNT:   new PublicKey('AuK65QqWmPTsvfKS4FAdJ6idWiw8zvzM68tXnEYGRMTC'),
  XEN:   new PublicKey('HcCMidf2rU8wy5jQ9doNC5tnRancRAJdhhD8oFbYZpxj'),
}

export const ASSETS = [
  { key: 'USDCX', label: 'USDC.X', icon: '💵', mint: MINTS.USDCX, decimals: 6, price: 1.0 },
  { key: 'XNT',   label: 'XNT',    icon: '🪙', mint: MINTS.XNT,   decimals: 6, price: 0.0 },
  { key: 'XEN',   label: 'XEN',    icon: '⚡', mint: MINTS.XEN,   decimals: 6, price: 0.0 },
]

// ── PDAs ──────────────────────────────────────────────────────────────────────
// Vault state PDA: seeds = [b"vault"]
export const getVaultPDA = () =>
  PublicKey.findProgramAddressSync([Buffer.from('vault')], PROGRAM_ID)[0]

// User position PDA: seeds = [b"position", user]
export const getUserPositionPDA = (user: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from('position'), user.toBuffer()],
    PROGRAM_ID
  )[0]

// Vault token account: ATA owned by the vault PDA
// The on-chain program uses vault PDA as token authority (signs with [b"vault", bump])
// So vault_token_account = getAssociatedTokenAddress(mint, vaultPDA, allowOwnerOffCurve=true)
export const getVaultTokenAccount = (mint: PublicKey): PublicKey => {
  const vault = getVaultPDA()
  return getAssociatedTokenAddressSync(mint, vault, true)
}

// ── IDL — exact match to deployed program (F2JnWVnjP1h6...) ──────────────────
export const IDL: any = {
  version: '0.1.0',
  name: 'x1safu',
  instructions: [
    {
      name: 'initialize',
      accounts: [
        { name: 'authority',     isMut: true,  isSigner: true  },
        { name: 'vault',         isMut: true,  isSigner: false },
        { name: 'systemProgram', isMut: false, isSigner: false },
      ],
      args: [],
    },
    {
      name: 'deposit',
      accounts: [
        { name: 'user',              isMut: true,  isSigner: true  },
        { name: 'vault',             isMut: true,  isSigner: false },
        { name: 'userPosition',      isMut: true,  isSigner: false },
        { name: 'userTokenAccount',  isMut: true,  isSigner: false },
        { name: 'vaultTokenAccount', isMut: true,  isSigner: false },
        { name: 'tokenProgram',      isMut: false, isSigner: false },
        { name: 'systemProgram',     isMut: false, isSigner: false },
      ],
      args: [{ name: 'amount', type: 'u64' }],
    },
    {
      name: 'withdraw',
      accounts: [
        { name: 'user',              isMut: true,  isSigner: true  },
        { name: 'vault',             isMut: true,  isSigner: false },
        { name: 'userPosition',      isMut: true,  isSigner: false },
        { name: 'userTokenAccount',  isMut: true,  isSigner: false },
        { name: 'vaultTokenAccount', isMut: true,  isSigner: false },
        { name: 'tokenProgram',      isMut: false, isSigner: false },
      ],
      args: [{ name: 'amount', type: 'u64' }],
    },
  ],
  accounts: [
    {
      name: 'VaultState',
      type: {
        kind: 'struct',
        fields: [
          { name: 'authority', type: 'publicKey' },
          { name: 'totalTvl',  type: 'u64' },
          { name: 'bump',      type: 'u8' },
        ],
      },
    },
    {
      name: 'UserPosition',
      type: {
        kind: 'struct',
        fields: [
          { name: 'owner',  type: 'publicKey' },
          { name: 'amount', type: 'u64' },
        ],
      },
    },
  ],
  errors: [
    { code: 6000, name: 'InvalidAmount',     msg: 'Invalid amount' },
    { code: 6001, name: 'MathOverflow',      msg: 'Math overflow' },
    { code: 6002, name: 'InsufficientFunds', msg: 'Insufficient funds in position' },
    { code: 6003, name: 'Unauthorized',      msg: 'Unauthorized' },
  ],
}

// ── Program helper ────────────────────────────────────────────────────────────
export function getProgram(provider: AnchorProvider) {
  return new Program(IDL, PROGRAM_ID, provider)
}

// ── Vault state ───────────────────────────────────────────────────────────────
export async function fetchVaultState(connection: Connection) {
  try {
    const vault = getVaultPDA()
    const info  = await connection.getAccountInfo(vault)
    if (!info) return null
    const data   = info.data
    let offset   = 8
    const authority = new PublicKey(data.slice(offset, offset + 32)); offset += 32
    const totalTvl  = Number(data.readBigUInt64LE(offset));           offset += 8
    const bump      = data[offset]
    return { authority, totalTvl, bump }
  } catch { return null }
}

// ── User position ─────────────────────────────────────────────────────────────
export async function fetchUserPosition(connection: Connection, user: PublicKey) {
  try {
    const pda  = getUserPositionPDA(user)
    const info = await connection.getAccountInfo(pda)
    if (!info) return null
    const data = info.data
    let offset = 8
    const owner  = new PublicKey(data.slice(offset, offset + 32)); offset += 32
    const amount = Number(data.readBigUInt64LE(offset))
    return { owner, amount }
  } catch { return null }
}

// ── Token balance ─────────────────────────────────────────────────────────────
export async function getTokenBalance(
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey
): Promise<number> {
  try {
    const ata  = await getAssociatedTokenAddress(mint, owner)
    const info = await connection.getTokenAccountBalance(ata)
    return info.value.uiAmount ?? 0
  } catch { return 0 }
}

// ── Oracle: xDEX pool list → real-time prices ─────────────────────────────────
export async function fetchAssetPrices(): Promise<Record<string, number>> {
  const fallback = { USDCX: 1.0, XNT: 0.35, XEN: 0.00000000005 }
  try {
    const res = await fetch(
      'https://api.xdex.xyz/api/xendex/pool/list?network=X1%20Mainnet',
      { signal: AbortSignal.timeout(6000) }
    )
    if (!res.ok) return fallback
    const data  = await res.json()
    const pools: any[] = data?.data ?? data ?? []

    let xntPrice = 0
    let xntTvl   = 0
    let xenPrice = 0
    let xenTvl   = 0

    for (const p of pools) {
      const t1   = p.token1_symbol ?? ''
      const t2   = p.token2_symbol ?? ''
      const tvl  = p.tvl ?? 0

      if (t1 === 'WXNT' && tvl > xntTvl && p.token1_price > 0) {
        xntPrice = p.token1_price; xntTvl = tvl
      } else if (t2 === 'WXNT' && tvl > xntTvl && p.token2_price > 0) {
        xntPrice = p.token2_price; xntTvl = tvl
      }
      if (t2 === 'XEN' && tvl > xenTvl && p.token2_price > 0) {
        xenPrice = p.token2_price; xenTvl = tvl
      } else if (t1 === 'XEN' && tvl > xenTvl && p.token1_price > 0) {
        xenPrice = p.token1_price; xenTvl = tvl
      }
    }

    return {
      USDCX: 1.0,
      XNT:   xntPrice > 0 ? xntPrice : fallback.XNT,
      XEN:   xenPrice > 0 ? xenPrice : fallback.XEN,
    }
  } catch {
    return fallback
  }
}

// ── X1SAFE calculation ────────────────────────────────────────────────────────
export function calcX1SAFE(assetAmount: number, priceUsd: number): number {
  return assetAmount * priceUsd * X1SAFE_PER_USD
}

export function toBaseUnits(amount: number, decimals: number): BN {
  return new BN(Math.floor(amount * 10 ** decimals))
}
