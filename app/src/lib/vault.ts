import { Connection, PublicKey } from '@solana/web3.js'
import { AnchorProvider, Program, BN } from '@coral-xyz/anchor'
import { getAssociatedTokenAddress } from '@solana/spl-token'

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
export const getVaultPDA = () =>
  PublicKey.findProgramAddressSync([Buffer.from('vault')], PROGRAM_ID)[0]

export const getUserPositionPDA = (user: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from('position'), user.toBuffer()],
    PROGRAM_ID
  )[0]

// Vault token account — PDA that holds each asset type
// seeds = ["vault_token", asset_mint]
export const getVaultTokenAccountPDA = (mint: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from('vault_token'), mint.toBuffer()],
    PROGRAM_ID
  )[0]

// ── IDL — matches lib.rs exactly ─────────────────────────────────────────────
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
        { name: 'user',               isMut: true,  isSigner: true  },
        { name: 'vault',              isMut: true,  isSigner: false },
        { name: 'userPosition',       isMut: true,  isSigner: false },
        { name: 'userTokenAccount',   isMut: true,  isSigner: false },
        { name: 'vaultTokenAccount',  isMut: true,  isSigner: false },
        { name: 'tokenProgram',       isMut: false, isSigner: false },
        { name: 'systemProgram',      isMut: false, isSigner: false },
      ],
      args: [{ name: 'amount', type: 'u64' }],
    },
    {
      name: 'withdraw',
      accounts: [
        { name: 'user',               isMut: true,  isSigner: true  },
        { name: 'vault',              isMut: true,  isSigner: false },
        { name: 'userPosition',       isMut: true,  isSigner: false },
        { name: 'userTokenAccount',   isMut: true,  isSigner: false },
        { name: 'vaultTokenAccount',  isMut: true,  isSigner: false },
        { name: 'tokenProgram',       isMut: false, isSigner: false },
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
    { code: 6000, name: 'InvalidAmount',      msg: 'Invalid amount' },
    { code: 6001, name: 'MathOverflow',       msg: 'Math overflow' },
    { code: 6002, name: 'InsufficientFunds',  msg: 'Insufficient funds in position' },
    { code: 6003, name: 'Unauthorized',       msg: 'Unauthorized' },
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
    const data = info.data
    let offset = 8 // skip discriminator
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

// ── Fetch XNT/XEN price from xDEX ─────────────────────────────────────────────
export async function fetchAssetPrices(): Promise<Record<string, number>> {
  try {
    const res = await fetch('https://api.xdex.xyz/v1/prices?tokens=XNT,XEN')
    if (!res.ok) return {}
    const data = await res.json()
    return {
      XNT: data?.XNT?.usd ?? 0,
      XEN: data?.XEN?.usd ?? 0,
      USDCX: 1.0,
    }
  } catch { return { USDCX: 1.0 } }
}

export function toBaseUnits(amount: number, decimals: number): BN {
  return new BN(Math.floor(amount * 10 ** decimals))
}
