import { Connection, PublicKey, TransactionInstruction } from '@solana/web3.js'
import { AnchorProvider, Program, BN } from '@coral-xyz/anchor'
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token'

// ── X1 Testnet Specific Program IDs ───────────────────────────────────────────
// X1 Testnet uses the standard Solana program addresses
export const X1_TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
export const X1_TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkASEGJ5gGs84Su1VDjPW9S47')
export const X1_ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')

// ── Config ────────────────────────────────────────────────────────────────────
// X1SAFE Vault Program (x1safu)
export const PROGRAM_ID = new PublicKey('F2JnWVnjP1h6WG7KKUHqhp23etEJ4amdJquAcE9ecCoe')
// X1SAFE PUT Staking Program
export const STAKING_PROGRAM_ID = new PublicKey('5zvbhhakw9Fh5socoTdm3jqn5LdrZzSWb2KaCmCW8GHe')

// ── Verified X1 Testnet Mint Addresses ─────────────────────────────────────
export const USDC_X_MINT = new PublicKey('6QNPqoF6GGhCFjTTQGxkpJkrH5ueS85b5RpX3GXdUSVw') // USDC.X 6 decimals
export const XNT_MINT    = new PublicKey('CDREeqfWSxQvPa9ofxVrHFP5VZeF2xSc2EtAdXmNumuW') // XNT 9 decimals
export const SUPPORTED_ASSETS = [
  { label: 'USDC.X', mint: USDC_X_MINT, decimals: 6, isFixed: true,  priceUsd: 1.00 },
  { label: 'XNT',    mint: XNT_MINT,    decimals: 9, isFixed: false, priceUsd: 0.20 },
]

export const RPC_URL    = 'https://rpc.testnet.x1.xyz'
export const IS_TESTNET = true
export const EXPLORER   = IS_TESTNET
  ? 'https://explorer.testnet.x1.xyz'
  : 'https://explorer.mainnet.x1.xyz'

// ── Rate ──────────────────────────────────────────────────────────────────────
export const X1SAFE_PER_USD = 100  // 1 USD = 100 X1SAFE (1 X1SAFE = $0.01)
export const PRICE_SCALE    = 1_000_000 // price_usd stored × 10^6

// ── Supported Assets ─────────────────────────────────────────────────────────
export const MINTS = {
  USDCX: new PublicKey('6QNPqoF6GGhCFjTTQGxkpJkrH5ueS85b5RpX3GXdUSVw'),
  XNT:   new PublicKey('CDREeqfWSxQvPa9ofxVrHFP5VZeF2xSc2EtAdXmNumuW'),
  XEN:   new PublicKey('HcCMidf2rU8wy5jQ9doNC5tnRancRAJdhhD8oFbYZpxj'),
  XNM:   new PublicKey('XNMbEwZFFBKQhqyW3taa8cAUp1xBUHfyzRFJQvZET4m'),
}

export interface AssetInfo {
  key: string
  label: string
  icon: string
  logoUrl?: string
  mint: PublicKey
  decimals: number
  price: number
}

export const ASSETS: AssetInfo[] = [
  { key: 'USDCX', label: 'USDC.X', icon: '💵', logoUrl: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png', mint: MINTS.USDCX, decimals: 6, price: 1.0 },
  { key: 'XNT',   label: 'XNT',    icon: '🪙', logoUrl: 'https://app.xdex.xyz/assets/images/tokens/x1.webp', mint: MINTS.XNT,   decimals: 9, price: 0.0 },
  { key: 'XEN',   label: 'XEN',    icon: '⚡', logoUrl: 'https://app.xdex.xyz/assets/images/tokens/xen.webp', mint: MINTS.XEN,   decimals: 9, price: 0.0 },
  { key: 'XNM',   label: 'XNM',    icon: '🔷', logoUrl: 'https://app.xdex.xyz/assets/images/tokens/xnm.webp', mint: MINTS.XNM,   decimals: 9, price: 0.0 },
]

// ── PDAs ──────────────────────────────────────────────────────────────────────
export const getVaultPDA = () =>
  PublicKey.findProgramAddressSync([Buffer.from('vault')], PROGRAM_ID)[0]

export const getPutMintPDA = () =>
  PublicKey.findProgramAddressSync([Buffer.from('put_mint')], PROGRAM_ID)[0]

export const getSafeMintPDA = () =>
  PublicKey.findProgramAddressSync([Buffer.from('safe_mint')], PROGRAM_ID)[0]

// ── Staking PDAs (use STAKING_PROGRAM_ID) ────────────────────────────────────
export const getStakingVaultPDA = () =>
  PublicKey.findProgramAddressSync([Buffer.from('vault')], STAKING_PROGRAM_ID)[0]

export const getStakePoolPDA = () =>
  PublicKey.findProgramAddressSync([Buffer.from('stake_pool')], STAKING_PROGRAM_ID)[0]

export const getSx1safeMintPDA = () =>
  PublicKey.findProgramAddressSync([Buffer.from('sx1safe_mint')], STAKING_PROGRAM_ID)[0]

export const getStakeReservePDA = () =>
  PublicKey.findProgramAddressSync([Buffer.from('stake_reserve')], STAKING_PROGRAM_ID)[0]

export const getRewardReservePDA = () =>
  PublicKey.findProgramAddressSync([Buffer.from('reward_reserve')], STAKING_PROGRAM_ID)[0]

export const getUserStakePDA = (user: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from('user_stake'), user.toBuffer()],
    STAKING_PROGRAM_ID
  )[0]

export const getAssetConfigPDA = (mint: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from('asset'), mint.toBuffer()],
    PROGRAM_ID
  )[0]

export const getUserPositionPDA = (user: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from('position'), user.toBuffer()],
    PROGRAM_ID
  )[0]

// Reserve ATA: ATA(assetMint, vaultPDA)
export const getReserveAccount = (mint: PublicKey): PublicKey =>
  getAssociatedTokenAddressSync(mint, getVaultPDA(), true)

// ── IDL ───────────────────────────────────────────────────────────────────────
// IDL matching on-chain program F2JnWVnjP1h6WG7KKUHqhp23etEJ4amdJquAcE9ecCoe
// VaultState size: 978 bytes
export const IDL: any = {
  version: '1.0.0',
  name: 'x1safu',
  address: 'F2JnWVnjP1h6WG7KKUHqhp23etEJ4amdJquAcE9ecCoe',
  instructions: [
    {
      name: 'initialize',
      discriminator: [175, 117, 65, 226, 22, 209, 160, 186],
      accounts: [
        { name: 'authority',     isMut: true,  isSigner: true  },
        { name: 'vault',         isMut: true,  isSigner: false },
        { name: 'systemProgram', isMut: false, isSigner: false },
      ],
      args: [],
    },
    {
      name: 'deposit',
      discriminator: [242, 35, 198, 137, 82, 225, 242, 182],
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
      discriminator: [183, 18, 70, 156, 148, 109, 161, 34],
      accounts: [
        { name: 'user',             isMut: true,  isSigner: true  },
        { name: 'vault',            isMut: true,  isSigner: false },
        { name: 'userPosition',     isMut: true,  isSigner: false },
        { name: 'userTokenAccount', isMut: true,  isSigner: false },
        { name: 'vaultTokenAccount',isMut: true,  isSigner: false },
        { name: 'tokenProgram',     isMut: false, isSigner: false },
      ],
      args: [{ name: 'amount', type: 'u64' }],
    },
  ],
  accounts: [
    {
      name: 'VaultState',
      discriminator: [228, 196, 82, 165, 98, 210, 235, 152],
      type: { kind: 'struct', fields: [
        { name: 'userWallet',            type: 'publicKey' },
        { name: 'treasury',              type: 'publicKey' },
        { name: 'feePool',               type: 'publicKey' },
        { name: 'x1safeMint',            type: 'publicKey' },
        { name: 'x1safePutMint',         type: 'publicKey' },
        { name: 'usdcMint',              type: 'publicKey' },
        { name: 'supportedTokensCount',  type: 'u8'        },
        { name: 'padding1',              type: { array: ['u8', 23] } },
        { name: 'totalTvlUsd',           type: 'u64'       },
        { name: 'totalX1safePutSupply',  type: 'u64'       },
        { name: 'totalStaked',           type: 'u64'       },
        { name: 'stakerFeeShare',        type: 'u16'       },
        { name: 'buybackFeeShare',       type: 'u16'       },
        { name: 'treasuryFeeShare',      type: 'u16'       },
        { name: 'x1safePriceUsd',        type: 'u64'       },
        { name: 'bump',                  type: 'u8'        },
        { name: 'paused',                type: 'bool'      },
        { name: 'reserved',              type: { array: ['u8', 754] } },
      ]},
    },
    {
      name: 'UserPosition',
      discriminator: [91, 160, 34, 44, 148, 39, 74, 105],
      type: { kind: 'struct', fields: [
        { name: 'owner',  type: 'publicKey' },
        { name: 'amount', type: 'u64'       },
      ]},
    },
  ],
  errors: [
    { code: 6000, name: 'InvalidAmount',     msg: 'Invalid amount'         },
    { code: 6001, name: 'MathOverflow',      msg: 'Math overflow'          },
    { code: 6002, name: 'InsufficientFunds', msg: 'Insufficient funds'     },
    { code: 6003, name: 'Unauthorized',      msg: 'Unauthorized'           },
  ],
}

// ── Program helper ────────────────────────────────────────────────────────────
export function getProgram(provider: AnchorProvider) {
  return new Program(IDL, PROGRAM_ID, provider)
}

// ── Staking Program helper ──────────────────────────────────────────────────
// Load staking IDL from public folder (will be fetched at runtime)
let stakingIDL: any = null

export async function loadStakingIDL(): Promise<any> {
  if (stakingIDL) return stakingIDL
  try {
    const response = await fetch('/x1safe_put_staking.json')
    stakingIDL = await response.json()
    return stakingIDL
  } catch (e) {
    console.error('Failed to load staking IDL:', e)
    return null
  }
}

export function getStakingProgram(provider: AnchorProvider) {
  // Use a minimal IDL for staking if fetch hasn't completed
  // The actual IDL will be loaded at runtime
  return new Program(stakingIDL || IDL, STAKING_PROGRAM_ID, provider)
}

// ── Vault state ───────────────────────────────────────────────────────────────
// Parse VaultState (978 bytes) matching on-chain program
export async function fetchVaultState(connection: Connection) {
  try {
    const info = await connection.getAccountInfo(getVaultPDA())
    if (!info) return null
    const d = info.data; let o = 8  // Skip discriminator
    
    // 6 pubkeys (32 bytes each)
    const userWallet      = new PublicKey(d.slice(o, o+32)); o += 32
    const treasury        = new PublicKey(d.slice(o, o+32)); o += 32
    const feePool         = new PublicKey(d.slice(o, o+32)); o += 32
    const x1safeMint      = new PublicKey(d.slice(o, o+32)); o += 32
    const x1safePutMint   = new PublicKey(d.slice(o, o+32)); o += 32
    const usdcMint        = new PublicKey(d.slice(o, o+32)); o += 32
    
    // u8 + padding[23]
    const supportedTokensCount = d[o++]
    o += 23  // Skip padding
    
    // u64 values
    const totalTvlUsd         = Number(d.readBigUInt64LE(o)); o += 8
    const totalX1safePutSupply = Number(d.readBigUInt64LE(o)); o += 8
    const totalStaked         = Number(d.readBigUInt64LE(o)); o += 8
    
    // u16 values
    const stakerFeeShare  = d.readUInt16LE(o); o += 2
    const buybackFeeShare = d.readUInt16LE(o); o += 2
    const treasuryFeeShare = d.readUInt16LE(o); o += 2
    
    // u64 + u8 + bool
    const x1safePriceUsd  = Number(d.readBigUInt64LE(o)); o += 8
    const bump            = d[o++]
    const paused          = !!d[o++]
    
    return { 
      userWallet, treasury, feePool, x1safeMint, x1safePutMint, usdcMint,
      supportedTokensCount, totalTvlUsd, totalX1safePutSupply, totalStaked,
      stakerFeeShare, buybackFeeShare, treasuryFeeShare, x1safePriceUsd,
      bump, paused 
    }
  } catch (e) { 
    console.error('Error fetching vault state:', e)
    return null 
  }
}

// ── Asset config ──────────────────────────────────────────────────────────────
export async function fetchAssetConfig(connection: Connection, mint: PublicKey) {
  try {
    const info = await connection.getAccountInfo(getAssetConfigPDA(mint))
    if (!info) return null
    const d = info.data; let o = 8
    const mintKey        = new PublicKey(d.slice(o, o+32)); o += 32
    const decimals       = d[o++]
    const isFixedPrice   = !!d[o++]
    const priceUsd       = Number(d.readBigUInt64LE(o)); o += 8
    const reserveBalance = Number(d.readBigUInt64LE(o))
    return { mint: mintKey, decimals, isFixedPrice, priceUsd, reserveBalance }
  } catch { return null }
}

// ── User position ─────────────────────────────────────────────────────────────
// Parse UserPosition (owner: pubkey, amount: u64)
export async function fetchUserPosition(connection: Connection, user: PublicKey) {
  try {
    const info = await connection.getAccountInfo(getUserPositionPDA(user))
    if (!info) return null
    const d = info.data; let o = 8  // Skip discriminator
    const owner  = new PublicKey(d.slice(o, o+32)); o += 32
    const amount = Number(d.readBigUInt64LE(o))
    return { owner, amount }
  } catch { return null }
}

// ── Stake pool ────────────────────────────────────────────────────────────────
export async function fetchStakePool(connection: Connection) {
  try {
    const info = await connection.getAccountInfo(getStakePoolPDA())
    if (!info) return null
    const d = info.data; let o = 8
    const authority     = new PublicKey(d.slice(o, o+32)); o += 32
    const bump          = d[o++]
    const sx1safeMint   = new PublicKey(d.slice(o, o+32)); o += 32
    const sx1safeMintBump = d[o++]
    const totalStaked   = Number(d.readBigUInt64LE(o)); o += 8
    // u128 = 16 bytes
    const rptLo = d.readBigUInt64LE(o); o += 16
    const undistributedRewards = Number(d.readBigUInt64LE(o)); o += 8
    const apyBps = d.readUInt16LE(o)
    return { authority, bump, sx1safeMint, sx1safeMintBump, totalStaked, rewardPerTokenStored: Number(rptLo), undistributedRewards, apyBps }

  } catch (e) { 
    console.error('Error fetching stake pool:', e)
    return null 
  }
}

// ── User stake ────────────────────────────────────────────────────────────────
export async function fetchUserStake(connection: Connection, user: PublicKey) {
  try {
    const info = await connection.getAccountInfo(getUserStakePDA(user))
    if (!info) return null
    const d = info.data; let o = 8
    const userKey    = new PublicKey(d.slice(o, o+32)); o += 32
    const bump       = d[o++]
    const stakedAmount = Number(d.readBigUInt64LE(o)); o += 8
    o += 16 // skip u128 rewardPerTokenPaid
    const rewardsPending = Number(d.readBigUInt64LE(o)); o += 8
    const rewardsClaimed = Number(d.readBigUInt64LE(o))
    return { user: userKey, bump, stakedAmount, rewardsPending, rewardsClaimed }
  } catch { return null }
}

// ── Token balance ─────────────────────────────────────────────────────────────
export async function getTokenBalance(
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey
): Promise<number> {
  try {
    // Try Token-2022 first (X1 Testnet uses Token-2022)
    const ata2022  = getAssociatedTokenAddressSync(mint, owner, false, TOKEN_2022_PROGRAM_ID)
    const info2022 = await connection.getTokenAccountBalance(ata2022)
    return info2022.value.uiAmount ?? 0
  } catch {
    // Fallback: try SPL Token program
    try {
      const ata  = getAssociatedTokenAddressSync(mint, owner, false, TOKEN_PROGRAM_ID)
      const info = await connection.getTokenAccountBalance(ata)
      return info.value.uiAmount ?? 0
    } catch {
      // Final fallback: scan all token accounts for this mint
      try {
        const accounts = await connection.getParsedTokenAccountsByOwner(owner, { mint }, 'confirmed')
        if (!accounts.value.length) return 0
        return accounts.value.reduce((sum, a) => sum + (a.account.data.parsed?.info?.tokenAmount?.uiAmount ?? 0), 0)
      } catch { return 0 }
    }
  }
}

// ── Native XNT balance (SOL-style balance) ────────────────────────────────────
export async function getNativeBalance(
  connection: Connection,
  owner: PublicKey
): Promise<number> {
  try {
    const balance = await connection.getBalance(owner)
    // XNT has 9 decimals (same as SOL)
    return balance / 1e9
  } catch { return 0 }
}

// ── Oracle: xDEX pool list → real-time prices ─────────────────────────────────
export async function fetchAssetPrices(): Promise<Record<string, number>> {
  const fallback = { USDCX: 1.0, XNT: 0.35, XEN: 0.00000000005, XNM: 0.001 }
  try {
    const res = await fetch(
      'https://api.xdex.xyz/api/xendex/pool/list?network=X1%20Mainnet',
      { signal: AbortSignal.timeout(6000) }
    )
    if (!res.ok) return fallback
    const data  = await res.json()
    const pools: any[] = data?.data ?? data ?? []

    let xntPrice = 0, xntTvl = 0, xenPrice = 0, xenTvl = 0, xnmPrice = 0, xnmTvl = 0

    for (const p of pools) {
      const t1  = p.token1_symbol ?? ''
      const t2  = p.token2_symbol ?? ''
      const tvl = p.tvl ?? 0
      if (t1 === 'WXNT' && tvl > xntTvl && p.token1_price > 0) { xntPrice = p.token1_price; xntTvl = tvl }
      else if (t2 === 'WXNT' && tvl > xntTvl && p.token2_price > 0) { xntPrice = p.token2_price; xntTvl = tvl }
      if (t2 === 'XEN' && tvl > xenTvl && p.token2_price > 0) { xenPrice = p.token2_price; xenTvl = tvl }
      else if (t1 === 'XEN' && tvl > xenTvl && p.token1_price > 0) { xenPrice = p.token1_price; xenTvl = tvl }
      if (t2 === 'XNM' && tvl > xnmTvl && p.token2_price > 0) { xnmPrice = p.token2_price; xnmTvl = tvl }
      else if (t1 === 'XNM' && tvl > xnmTvl && p.token1_price > 0) { xnmPrice = p.token1_price; xnmTvl = tvl }
    }

    return {
      USDCX: 1.0,
      XNT:   xntPrice > 0 ? xntPrice : fallback.XNT,
      XEN:   xenPrice > 0 ? xenPrice : fallback.XEN,
      XNM:   xnmPrice > 0 ? xnmPrice : fallback.XNM,
    }
  } catch { return fallback }
}

// ── Calculation helpers ───────────────────────────────────────────────────────
export function calcX1SAFE(assetAmount: number, priceUsd: number): number {
  return assetAmount * priceUsd * X1SAFE_PER_USD
}

export function toBaseUnits(amount: number, decimals: number): BN {
  return new BN(Math.floor(amount * 10 ** decimals))
}

// Price to on-chain format (× 10^6)
export function toPriceOnChain(priceUsd: number): BN {
  return new BN(Math.round(priceUsd * 1_000_000))
}

// ── X1 Testnet ATA Creation Helper ───────────────────────────────────────────
// The standard createAssociatedTokenAccountInstruction uses hardcoded Solana mainnet addresses
// This helper creates the instruction with explicit X1 Testnet program IDs
export function createX1AssociatedTokenAccountInstruction(
  payer: PublicKey,
  associatedToken: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
  tokenProgramId: PublicKey = TOKEN_2022_PROGRAM_ID,
  associatedTokenProgramId: PublicKey = X1_ASSOCIATED_TOKEN_PROGRAM_ID
): TransactionInstruction {
  const keys = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: associatedToken, isSigner: false, isWritable: true },
    { pubkey: owner, isSigner: false, isWritable: false },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: tokenProgramId, isSigner: false, isWritable: false },
  ]

  // ATA program discriminator for 'Create' instruction
  const data = Buffer.from([0])

  return new TransactionInstruction({
    programId: associatedTokenProgramId,
    keys,
    data,
  })
}
