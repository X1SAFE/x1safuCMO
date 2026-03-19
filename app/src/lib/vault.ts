import { Connection, PublicKey } from '@solana/web3.js'
import { AnchorProvider, Program, BN } from '@coral-xyz/anchor'
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token'

// ── Config ────────────────────────────────────────────────────────────────────
// X1SAFE Vault Program
export const PROGRAM_ID = new PublicKey('9qu7VvWkuCW5xwpdxroQjsjAouKBV9xqrNccFNwNF13')
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
export const IDL: any = {
  version: '0.2.0',
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
      name: 'createMints',
      accounts: [
        { name: 'authority',     isMut: true,  isSigner: true  },
        { name: 'vault',         isMut: true,  isSigner: false },
        { name: 'putMint',       isMut: true,  isSigner: false },
        { name: 'safeMint',      isMut: true,  isSigner: false },
        { name: 'tokenProgram',  isMut: false, isSigner: false },
        { name: 'systemProgram', isMut: false, isSigner: false },
        { name: 'rent',          isMut: false, isSigner: false },
      ],
      args: [],
    },
    {
      name: 'initStakePool',
      accounts: [
        { name: 'authority',     isMut: true,  isSigner: true  },
        { name: 'vault',         isMut: false, isSigner: false },
        { name: 'stakePool',     isMut: true,  isSigner: false },
        { name: 'safeMint',      isMut: false, isSigner: false },
        { name: 'sx1safeMint',   isMut: true,  isSigner: false },
        { name: 'stakeReserve',  isMut: true,  isSigner: false },
        { name: 'rewardReserve', isMut: true,  isSigner: false },
        { name: 'tokenProgram',  isMut: false, isSigner: false },
        { name: 'systemProgram', isMut: false, isSigner: false },
        { name: 'rent',          isMut: false, isSigner: false },
      ],
      args: [{ name: 'apyBps', type: 'u16' }],
    },
    {
      name: 'addAsset',
      accounts: [
        { name: 'authority',    isMut: true,  isSigner: true  },
        { name: 'vault',        isMut: false, isSigner: false },
        { name: 'assetMint',    isMut: false, isSigner: false },
        { name: 'assetConfig',  isMut: true,  isSigner: false },
        { name: 'systemProgram',isMut: false, isSigner: false },
      ],
      args: [
        { name: 'decimals',     type: 'u8'   },
        { name: 'isFixedPrice', type: 'bool' },
        { name: 'priceUsd',     type: 'u64'  },
      ],
    },
    {
      name: 'updatePrice',
      accounts: [
        { name: 'caller',      isMut: false, isSigner: true  },
        { name: 'vault',       isMut: false, isSigner: false },
        { name: 'assetConfig', isMut: true,  isSigner: false },
      ],
      args: [{ name: 'priceUsd', type: 'u64' }],
    },
    {
      name: 'deposit',
      accounts: [
        { name: 'user',              isMut: true,  isSigner: true  },
        { name: 'vault',             isMut: true,  isSigner: false },
        { name: 'assetConfig',       isMut: true,  isSigner: false },
        { name: 'reserveAccount',    isMut: true,  isSigner: false },
        { name: 'userAssetAccount',  isMut: true,  isSigner: false },
        { name: 'putMint',           isMut: true,  isSigner: false },
        { name: 'userPutAta',        isMut: true,  isSigner: false },
        { name: 'userPosition',      isMut: true,  isSigner: false },
        { name: 'tokenProgram',      isMut: false, isSigner: false },
        { name: 'systemProgram',     isMut: false, isSigner: false },
      ],
      args: [{ name: 'amount', type: 'u64' }],
    },
    {
      name: 'withdraw',
      accounts: [
        { name: 'user',             isMut: true,  isSigner: true  },
        { name: 'vault',            isMut: true,  isSigner: false },
        { name: 'putMint',          isMut: true,  isSigner: false },
        { name: 'safeMint',         isMut: true,  isSigner: false },
        { name: 'userPutAccount',   isMut: true,  isSigner: false },
        { name: 'userSafeAccount',  isMut: true,  isSigner: false },
        { name: 'userPosition',     isMut: true,  isSigner: false },
        { name: 'tokenProgram',     isMut: false, isSigner: false },
        { name: 'systemProgram',    isMut: false, isSigner: false },
      ],
      args: [{ name: 'putAmount', type: 'u64' }],
    },
    {
      name: 'exit',
      accounts: [
        { name: 'user',            isMut: true,  isSigner: true  },
        { name: 'vault',           isMut: true,  isSigner: false },
        { name: 'safeMint',        isMut: true,  isSigner: false },
        { name: 'userSafeAccount', isMut: true,  isSigner: false },
        { name: 'tokenProgram',    isMut: false, isSigner: false },
      ],
      args: [{ name: 'safeBurnAmount', type: 'u64' }],
    },
    {
      name: 'redeposit',
      accounts: [
        { name: 'user',            isMut: true,  isSigner: true  },
        { name: 'vault',           isMut: true,  isSigner: false },
        { name: 'safeMint',        isMut: true,  isSigner: false },
        { name: 'putMint',         isMut: true,  isSigner: false },
        { name: 'userSafeAccount', isMut: true,  isSigner: false },
        { name: 'userPutAta',      isMut: true,  isSigner: false },
        { name: 'tokenProgram',    isMut: false, isSigner: false },
      ],
      args: [{ name: 'safeAmount', type: 'u64' }],
    },
    {
      name: 'stake',
      accounts: [
        { name: 'user',          isMut: true,  isSigner: true  },
        { name: 'stakePool',     isMut: true,  isSigner: false },
        { name: 'userStake',     isMut: true,  isSigner: false },
        { name: 'sx1safeMint',   isMut: true,  isSigner: false },
        { name: 'userX1safe',    isMut: true,  isSigner: false },
        { name: 'userSx1safe',   isMut: true,  isSigner: false },
        { name: 'stakeReserve',  isMut: true,  isSigner: false },
        { name: 'tokenProgram',  isMut: false, isSigner: false },
        { name: 'systemProgram', isMut: false, isSigner: false },
      ],
      args: [{ name: 'amount', type: 'u64' }],
    },
    {
      name: 'unstake',
      accounts: [
        { name: 'user',          isMut: true,  isSigner: true  },
        { name: 'stakePool',     isMut: true,  isSigner: false },
        { name: 'userStake',     isMut: true,  isSigner: false },
        { name: 'sx1safeMint',   isMut: true,  isSigner: false },
        { name: 'userX1safe',    isMut: true,  isSigner: false },
        { name: 'userSx1safe',   isMut: true,  isSigner: false },
        { name: 'stakeReserve',  isMut: true,  isSigner: false },
        { name: 'rewardReserve', isMut: true,  isSigner: false },
        { name: 'tokenProgram',  isMut: false, isSigner: false },
      ],
      args: [{ name: 'amount', type: 'u64' }],
    },
    {
      name: 'claimRewards',
      accounts: [
        { name: 'user',          isMut: true,  isSigner: true  },
        { name: 'stakePool',     isMut: true,  isSigner: false },
        { name: 'userStake',     isMut: true,  isSigner: false },
        { name: 'userX1safe',    isMut: true,  isSigner: false },
        { name: 'rewardReserve', isMut: true,  isSigner: false },
        { name: 'tokenProgram',  isMut: false, isSigner: false },
      ],
      args: [],
    },
    {
      name: 'depositRewards',
      accounts: [
        { name: 'caller',        isMut: false, isSigner: true  },
        { name: 'vault',         isMut: false, isSigner: false },
        { name: 'stakePool',     isMut: true,  isSigner: false },
        { name: 'source',        isMut: true,  isSigner: false },
        { name: 'rewardReserve', isMut: true,  isSigner: false },
        { name: 'tokenProgram',  isMut: false, isSigner: false },
      ],
      args: [{ name: 'amount', type: 'u64' }],
    },
    {
      name: 'pauseVault',
      accounts: [
        { name: 'authority', isMut: false, isSigner: true  },
        { name: 'vault',     isMut: true,  isSigner: false },
      ],
      args: [],
    },
    {
      name: 'unpauseVault',
      accounts: [
        { name: 'authority', isMut: false, isSigner: true  },
        { name: 'vault',     isMut: true,  isSigner: false },
      ],
      args: [],
    },
  ],
  accounts: [
    {
      name: 'VaultState',
      type: { kind: 'struct', fields: [
        { name: 'authority',        type: 'publicKey' },
        { name: 'bump',             type: 'u8'        },
        { name: 'paused',           type: 'bool'      },
        { name: 'x1safePutMint',    type: 'publicKey' },
        { name: 'putMintBump',      type: 'u8'        },
        { name: 'x1safeSafeMint',   type: 'publicKey' },
        { name: 'safeMintBump',     type: 'u8'        },
        { name: 'totalPutSupply',   type: 'u64'       },
        { name: 'totalFreeSupply',  type: 'u64'       },
        { name: 'keeper',           type: 'publicKey' },
      ]},
    },
    {
      name: 'AssetConfig',
      type: { kind: 'struct', fields: [
        { name: 'mint',           type: 'publicKey' },
        { name: 'decimals',       type: 'u8'        },
        { name: 'isFixedPrice',   type: 'bool'      },
        { name: 'priceUsd',       type: 'u64'       },
        { name: 'reserveBalance', type: 'u64'       },
      ]},
    },
    {
      name: 'UserPosition',
      type: { kind: 'struct', fields: [
        { name: 'user',       type: 'publicKey' },
        { name: 'bump',       type: 'u8'        },
        { name: 'putBalance', type: 'u64'        },
      ]},
    },
    {
      name: 'StakePool',
      type: { kind: 'struct', fields: [
        { name: 'authority',              type: 'publicKey' },
        { name: 'bump',                   type: 'u8'        },
        { name: 'sx1safeMint',            type: 'publicKey' },
        { name: 'sx1safeMintBump',        type: 'u8'        },
        { name: 'totalStaked',            type: 'u64'       },
        { name: 'rewardPerTokenStored',   type: 'u128'      },
        { name: 'undistributedRewards',   type: 'u64'       },
        { name: 'apyBps',                 type: 'u16'       },
      ]},
    },
    {
      name: 'UserStake',
      type: { kind: 'struct', fields: [
        { name: 'user',                type: 'publicKey' },
        { name: 'bump',                type: 'u8'        },
        { name: 'stakedAmount',        type: 'u64'       },
        { name: 'rewardPerTokenPaid',  type: 'u128'      },
        { name: 'rewardsPending',      type: 'u64'       },
        { name: 'rewardsClaimed',      type: 'u64'       },
      ]},
    },
  ],
  errors: [
    { code: 6000, name: 'InvalidAmount',     msg: 'Invalid amount'         },
    { code: 6001, name: 'MathOverflow',      msg: 'Math overflow'          },
    { code: 6002, name: 'InsufficientFunds', msg: 'Insufficient funds'     },
    { code: 6003, name: 'Unauthorized',      msg: 'Unauthorized'           },
    { code: 6004, name: 'VaultPaused',       msg: 'Vault is paused'        },
    { code: 6005, name: 'InvalidOraclePrice',msg: 'Invalid oracle price'   },
    { code: 6006, name: 'FixedPriceAsset',   msg: 'Asset uses fixed price' },
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
export async function fetchVaultState(connection: Connection) {
  try {
    const info = await connection.getAccountInfo(getVaultPDA())
    if (!info) return null
    const d = info.data; let o = 8
    const authority       = new PublicKey(d.slice(o, o+32)); o += 32
    const bump            = d[o++]
    const paused          = !!d[o++]
    const x1safePutMint   = new PublicKey(d.slice(o, o+32)); o += 32
    const putMintBump     = d[o++]
    const x1safeSafeMint  = new PublicKey(d.slice(o, o+32)); o += 32
    const safeMintBump    = d[o++]
    const totalPutSupply  = Number(d.readBigUInt64LE(o)); o += 8
    const totalFreeSupply = Number(d.readBigUInt64LE(o)); o += 8
    const keeper          = new PublicKey(d.slice(o, o+32))
    return { authority, bump, paused, x1safePutMint, putMintBump, x1safeSafeMint, safeMintBump, totalPutSupply, totalFreeSupply, keeper }
  } catch { return null }
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
export async function fetchUserPosition(connection: Connection, user: PublicKey) {
  try {
    const info = await connection.getAccountInfo(getUserPositionPDA(user))
    if (!info) return null
    const d = info.data; let o = 8
    const userKey    = new PublicKey(d.slice(o, o+32)); o += 32
    const bump       = d[o++]
    const putBalance = Number(d.readBigUInt64LE(o))
    return { user: userKey, bump, putBalance }
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
