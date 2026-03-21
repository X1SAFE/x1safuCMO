import { Connection, PublicKey, TransactionInstruction } from '@solana/web3.js'
// Anchor removed — all tx built as raw TransactionInstruction
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
// x1safe_put_staking program — deployed + initialized 2026-03-20
export const STAKING_PROGRAM_ID  = new PublicKey('8s8JbaAtWtCKSyPfAxEN2vJLJFc3kWokxXxgCRvtHq9u')
// Staking vault mints (created during initialize_vault tx 4EsxZr...)
export const STAKING_X1SAFE_MINT     = new PublicKey('75HZTezD1w2XBeoGJJzQxekayojEXeTgvJks8zWXWtda')
export const STAKING_X1SAFE_PUT_MINT = new PublicKey('2J1JrRSyj2j93toj4k89buNKN2Z9sFXUmfAWZXWow5VA')
export const STAKING_VAULT_STATE     = new PublicKey('Cp4SrtaPCmhZhEHWPyeoirrr4uY17Qgvtj1V1gYofcDM')
// stake_vault: holds staked X1SAFE_PUT (authority=vault_state, created 2026-03-20)
export const STAKING_STAKE_VAULT     = new PublicKey('GpXMwcFCCkMxM8WEiqPZA5KjBsm9jvKxQvueXfPtTbCV')

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

// ── x1safe_put_staking PDAs ────────────────────────────────────────────────
// Seeds from programs/x1safe_put_staking/src/utils.rs (verified 2026-03-20)
// VAULT_STATE = b"vault_state"
// USER_POSITION = b"user_position"
// STAKE_ACCOUNT = b"stake_account"
// REWARD_POOL = b"reward_pool"
export const getStakingVaultPDA = () =>
  PublicKey.findProgramAddressSync([Buffer.from('vault_state')], STAKING_PROGRAM_ID)[0]

export const getStakeAccountPDA = (user: PublicKey, tokenMint: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from('stake_account'), user.toBuffer(), tokenMint.toBuffer()],
    STAKING_PROGRAM_ID
  )[0]

export const getStakingUserPositionPDA = (user: PublicKey, tokenMint: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from('user_position'), user.toBuffer(), tokenMint.toBuffer()],
    STAKING_PROGRAM_ID
  )[0]

export const getRewardPoolPDA = (vaultState: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from('reward_pool'), vaultState.toBuffer()],
    STAKING_PROGRAM_ID
  )[0]

// Keep legacy aliases for backward compat with old Stake.tsx
export const getStakePoolPDA = () => getStakingVaultPDA()
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

// On-chain verified token programs per mint (2026-03-20):
// USDC.X, XNT, XEN → Token classic (TokenkegQ)
// XNM              → Token-2022    (TokenzQdB)
export const MINT_TOKEN_PROGRAM_MAP: Record<string, PublicKey> = {
  [MINTS.USDCX.toBase58()]: TOKEN_PROGRAM_ID,
  [MINTS.XNT.toBase58()]:   TOKEN_PROGRAM_ID,
  [MINTS.XEN.toBase58()]:   TOKEN_PROGRAM_ID,
  [MINTS.XNM.toBase58()]:   TOKEN_2022_PROGRAM_ID,
}

// Reserve ATA: ATA(assetMint, vaultPDA) — uses correct token program per mint
export const getReserveAccount = (mint: PublicKey): PublicKey => {
  const tokenProgram = MINT_TOKEN_PROGRAM_MAP[mint.toBase58()] ?? TOKEN_PROGRAM_ID
  return getAssociatedTokenAddressSync(mint, getVaultPDA(), true, tokenProgram)
}

// ── IDL ───────────────────────────────────────────────────────────────────────
// IDL matching on-chain program F2JnWVnjP1h6WG7KKUHqhp23etEJ4amdJquAcE9ecCoe
// VaultState size: 978 bytes
export const IDL: any = {
  "address": "F2JnWVnjP1h6WG7KKUHqhp23etEJ4amdJquAcE9ecCoe",
  "metadata": {
    "name": "x1safu",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "X1SAFU - Secure Savings Protocol on X1 Blockchain"
  },
  "instructions": [
    {
      "name": "add_asset",
      "discriminator": [
        81,
        53,
        134,
        142,
        243,
        73,
        42,
        179
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "asset_mint"
        },
        {
          "name": "asset_config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  115,
                  115,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "asset_mint"
              }
            ]
          }
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "decimals",
          "type": "u8"
        },
        {
          "name": "is_fixed_price",
          "type": "bool"
        },
        {
          "name": "price_usd",
          "type": "u64"
        }
      ]
    },
    {
      "name": "claim_rewards",
      "discriminator": [
        4,
        144,
        132,
        71,
        116,
        23,
        151,
        80
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "stake_pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  107,
                  101,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "user_stake",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  115,
                  116,
                  97,
                  107,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user_x1safe",
          "writable": true
        },
        {
          "name": "reward_reserve",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  119,
                  97,
                  114,
                  100,
                  95,
                  114,
                  101,
                  115,
                  101,
                  114,
                  118,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "create_mints",
      "discriminator": [
        71,
        106,
        121,
        68,
        208,
        125,
        224,
        200
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "put_mint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  117,
                  116,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "safe_mint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  97,
                  102,
                  101,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "deposit",
      "discriminator": [
        242,
        35,
        198,
        137,
        82,
        225,
        242,
        182
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "asset_config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  115,
                  115,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "asset_config.mint",
                "account": "AssetConfig"
              }
            ]
          }
        },
        {
          "name": "reserve_account",
          "docs": [
            "Reserve ATA: ATA(assetMint, vault) \u2014 created by client before first deposit"
          ],
          "writable": true
        },
        {
          "name": "user_asset_account",
          "writable": true
        },
        {
          "name": "put_mint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  117,
                  116,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "user_put_ata",
          "writable": true
        },
        {
          "name": "user_position",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "deposit_rewards",
      "discriminator": [
        52,
        249,
        112,
        72,
        206,
        161,
        196,
        1
      ],
      "accounts": [
        {
          "name": "caller",
          "signer": true
        },
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "stake_pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  107,
                  101,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "source",
          "writable": true
        },
        {
          "name": "reward_reserve",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  119,
                  97,
                  114,
                  100,
                  95,
                  114,
                  101,
                  115,
                  101,
                  114,
                  118,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "exit",
      "discriminator": [
        234,
        32,
        12,
        71,
        126,
        5,
        219,
        160
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "safe_mint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  97,
                  102,
                  101,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "user_safe_account",
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "safe_burn_amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "fix_bump",
      "discriminator": [
        55,
        162,
        45,
        211,
        135,
        185,
        66,
        103
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "fix_vault_raw",
      "docs": [
        "Emergency patch: fix invalid bytes in vault (paused byte, etc.)",
        "Uses raw AccountInfo to bypass Anchor deserialization"
      ],
      "discriminator": [
        41,
        88,
        225,
        49,
        6,
        130,
        198,
        24
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "writable": true
        }
      ],
      "args": []
    },
    {
      "name": "init_stake_pool",
      "discriminator": [
        145,
        69,
        167,
        211,
        154,
        130,
        73,
        50
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "stake_pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  107,
                  101,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "safe_mint",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  97,
                  102,
                  101,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "sx1safe_mint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  120,
                  49,
                  115,
                  97,
                  102,
                  101,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "stake_reserve",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  107,
                  101,
                  95,
                  114,
                  101,
                  115,
                  101,
                  114,
                  118,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "reward_reserve",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  119,
                  97,
                  114,
                  100,
                  95,
                  114,
                  101,
                  115,
                  101,
                  114,
                  118,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "apy_bps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "pause_vault",
      "discriminator": [
        250,
        6,
        228,
        57,
        6,
        104,
        19,
        210
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "redeposit",
      "discriminator": [
        138,
        81,
        125,
        61,
        150,
        216,
        237,
        246
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "safe_mint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  97,
                  102,
                  101,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "put_mint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  117,
                  116,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "user_safe_account",
          "writable": true
        },
        {
          "name": "user_put_ata",
          "writable": true
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "safe_amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "stake",
      "discriminator": [
        206,
        176,
        202,
        18,
        200,
        209,
        179,
        108
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "stake_pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  107,
                  101,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "user_stake",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  115,
                  116,
                  97,
                  107,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "sx1safe_mint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  120,
                  49,
                  115,
                  97,
                  102,
                  101,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "user_x1safe",
          "docs": [
            "User's X1SAFE (free) token account \u2014 tokens being staked"
          ],
          "writable": true
        },
        {
          "name": "user_sx1safe",
          "docs": [
            "User's sX1SAFE ATA \u2014 receives receipt tokens"
          ],
          "writable": true
        },
        {
          "name": "stake_reserve",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  107,
                  101,
                  95,
                  114,
                  101,
                  115,
                  101,
                  114,
                  118,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "unpause_vault",
      "discriminator": [
        125,
        29,
        213,
        213,
        114,
        155,
        125,
        63
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "unstake",
      "discriminator": [
        90,
        95,
        107,
        42,
        205,
        124,
        50,
        225
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "stake_pool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  107,
                  101,
                  95,
                  112,
                  111,
                  111,
                  108
                ]
              }
            ]
          }
        },
        {
          "name": "user_stake",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  115,
                  116,
                  97,
                  107,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "sx1safe_mint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  120,
                  49,
                  115,
                  97,
                  102,
                  101,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "user_x1safe",
          "docs": [
            "User's X1SAFE (free) \u2014 receives returned principal + rewards"
          ],
          "writable": true
        },
        {
          "name": "user_sx1safe",
          "writable": true
        },
        {
          "name": "stake_reserve",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  97,
                  107,
                  101,
                  95,
                  114,
                  101,
                  115,
                  101,
                  114,
                  118,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "reward_reserve",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  119,
                  97,
                  114,
                  100,
                  95,
                  114,
                  101,
                  115,
                  101,
                  114,
                  118,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "update_price",
      "discriminator": [
        61,
        34,
        117,
        155,
        75,
        34,
        123,
        208
      ],
      "accounts": [
        {
          "name": "caller",
          "signer": true
        },
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "asset_config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  115,
                  115,
                  101,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "asset_config.mint",
                "account": "AssetConfig"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "price_usd",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdraw",
      "discriminator": [
        183,
        18,
        70,
        156,
        148,
        109,
        161,
        34
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "put_mint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  117,
                  116,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "safe_mint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  97,
                  102,
                  101,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "user_put_account",
          "writable": true
        },
        {
          "name": "user_safe_account",
          "writable": true
        },
        {
          "name": "user_position",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  115,
                  105,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "token_program",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "system_program",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "put_amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "AssetConfig",
      "discriminator": [
        57,
        112,
        247,
        166,
        247,
        64,
        140,
        23
      ]
    },
    {
      "name": "StakePool",
      "discriminator": [
        121,
        34,
        206,
        21,
        79,
        127,
        255,
        28
      ]
    },
    {
      "name": "UserPosition",
      "discriminator": [
        251,
        248,
        209,
        245,
        83,
        234,
        17,
        27
      ]
    },
    {
      "name": "UserStake",
      "discriminator": [
        102,
        53,
        163,
        107,
        9,
        138,
        87,
        153
      ]
    },
    {
      "name": "VaultState",
      "discriminator": [
        228,
        196,
        82,
        165,
        98,
        210,
        235,
        152
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "InvalidAmount",
      "msg": "Invalid amount"
    },
    {
      "code": 6001,
      "name": "MathOverflow",
      "msg": "Math overflow"
    },
    {
      "code": 6002,
      "name": "InsufficientFunds",
      "msg": "Insufficient funds"
    },
    {
      "code": 6003,
      "name": "Unauthorized",
      "msg": "Unauthorized"
    },
    {
      "code": 6004,
      "name": "VaultPaused",
      "msg": "Vault is paused"
    },
    {
      "code": 6005,
      "name": "InvalidOraclePrice",
      "msg": "Invalid oracle price"
    },
    {
      "code": 6006,
      "name": "FixedPriceAsset",
      "msg": "Asset uses fixed price"
    }
  ],
  "types": [
    {
      "name": "AssetConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "decimals",
            "type": "u8"
          },
          {
            "name": "is_fixed_price",
            "type": "bool"
          },
          {
            "name": "price_usd",
            "type": "u64"
          },
          {
            "name": "reserve_balance",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "StakePool",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "sx1safe_mint",
            "type": "pubkey"
          },
          {
            "name": "sx1safe_mint_bump",
            "type": "u8"
          },
          {
            "name": "total_staked",
            "type": "u64"
          },
          {
            "name": "reward_per_token_stored",
            "type": "u128"
          },
          {
            "name": "undistributed_rewards",
            "type": "u64"
          },
          {
            "name": "apy_bps",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "UserPosition",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "put_balance",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "UserStake",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "staked_amount",
            "type": "u64"
          },
          {
            "name": "reward_per_token_paid",
            "type": "u128"
          },
          {
            "name": "rewards_pending",
            "type": "u64"
          },
          {
            "name": "rewards_claimed",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "VaultState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user_wallet",
            "type": "pubkey"
          },
          {
            "name": "treasury",
            "type": "pubkey"
          },
          {
            "name": "fee_pool",
            "type": "pubkey"
          },
          {
            "name": "x1safe_mint",
            "type": "pubkey"
          },
          {
            "name": "x1safe_put_mint",
            "type": "pubkey"
          },
          {
            "name": "usdc_mint",
            "type": "pubkey"
          },
          {
            "name": "supported_tokens_count",
            "type": "u8"
          },
          {
            "name": "padding_1",
            "type": {
              "array": [
                "u8",
                23
              ]
            }
          },
          {
            "name": "total_tvl_usd",
            "type": "u64"
          },
          {
            "name": "total_x1safe_put_supply",
            "type": "u64"
          },
          {
            "name": "total_staked",
            "type": "u64"
          },
          {
            "name": "staker_fee_share",
            "type": "u16"
          },
          {
            "name": "buyback_fee_share",
            "type": "u16"
          },
          {
            "name": "treasury_fee_share",
            "type": "u16"
          },
          {
            "name": "x1safe_price_usd",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "paused",
            "type": "bool"
          },
          {
            "name": "reserved",
            "type": {
              "array": [
                "u8",
                714
              ]
            }
          }
        ]
      }
    }
  ]
}

// ── Program helpers removed — all tx are raw TransactionInstruction ──────────
// getProgram / getStakingProgram deleted (Anchor@0.29 IDL format mismatch crash)

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
  // Use the known program for this mint (defaults to Token classic if unknown)
  const tokenProgram = MINT_TOKEN_PROGRAM_MAP[mint.toBase58()] ?? TOKEN_PROGRAM_ID
  try {
    const ata  = getAssociatedTokenAddressSync(mint, owner, false, tokenProgram)
    const info = await connection.getTokenAccountBalance(ata)
    return info.value.uiAmount ?? 0
  } catch {
    // Fallback: scan all token accounts for this mint (handles non-ATA accounts)
    try {
      const accounts = await connection.getParsedTokenAccountsByOwner(owner, { mint }, 'confirmed')
      if (!accounts.value.length) return 0
      return accounts.value.reduce((sum, a) => sum + (a.account.data.parsed?.info?.tokenAmount?.uiAmount ?? 0), 0)
    } catch { return 0 }
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

export function toBaseUnits(amount: number, decimals: number): bigint {
  return BigInt(Math.floor(amount * 10 ** decimals))
}

// Price to on-chain format (× 10^6)
export function toPriceOnChain(priceUsd: number): bigint {
  return BigInt(Math.round(priceUsd * 1_000_000))
}

// ── X1 Testnet ATA Creation Helper ───────────────────────────────────────────
// The standard createAssociatedTokenAccountInstruction uses hardcoded Solana mainnet addresses
// This helper creates the instruction with explicit X1 Testnet program IDs
import { SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'

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
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: tokenProgramId, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ]

  // ATA program discriminator for 'Create' instruction
  const data = Buffer.from([0])

  return new TransactionInstruction({
    programId: associatedTokenProgramId,
    keys,
    data,
  })
}
