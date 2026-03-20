/**
 * add_assets.ts — Initialize AssetConfig for USDC.X and XNT
 * Run: ts-node scripts/add_assets.ts
 */
import {
  Connection, PublicKey, Transaction, TransactionInstruction,
  SystemProgram, Keypair
} from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import * as fs from 'fs'
import * as crypto from 'crypto'

const RPC = 'https://rpc.testnet.x1.xyz'
const PROGRAM_ID  = new PublicKey('F2JnWVnjP1h6WG7KKUHqhp23etEJ4amdJquAcE9ecCoe')
const USDC_MINT   = new PublicKey('6QNPqoF6GGhCFjTTQGxkpJkrH5ueS85b5RpX3GXdUSVw')
const XNT_MINT    = new PublicKey('CDREeqfWSxQvPa9ofxVrHFP5VZeF2xSc2EtAdXmNumuW')

// Discriminator for add_asset instruction
function disc(name: string): Buffer {
  return Buffer.from(
    crypto.createHash('sha256').update(`global:${name}`).digest()
  ).slice(0, 8)
}

function getVaultPDA(): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from('vault')], PROGRAM_ID)[0]
}

function getAssetConfigPDA(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('asset'), mint.toBuffer()],
    PROGRAM_ID
  )[0]
}

function buildAddAssetIx(
  authority: PublicKey,
  assetMint: PublicKey,
  decimals: number,
  isFixedPrice: boolean,
  priceUsd: bigint, // × 10^6
): TransactionInstruction {
  const vault = getVaultPDA()
  const assetConfig = getAssetConfigPDA(assetMint)

  // discriminator (8) + decimals (1) + is_fixed_price (1) + price_usd (8) = 18 bytes
  const data = Buffer.alloc(18)
  disc('add_asset').copy(data, 0)
  data.writeUInt8(decimals, 8)
  data.writeUInt8(isFixedPrice ? 1 : 0, 9)
  data.writeBigUInt64LE(priceUsd, 10)

  const keys = [
    { pubkey: authority,          isSigner: true,  isWritable: true  },
    { pubkey: vault,              isSigner: false, isWritable: false },
    { pubkey: assetMint,          isSigner: false, isWritable: false },
    { pubkey: assetConfig,        isSigner: false, isWritable: true  },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ]

  return new TransactionInstruction({ programId: PROGRAM_ID, keys, data })
}

async function main() {
  const conn = new Connection(RPC, 'confirmed')

  // Load deployer keypair
  const keypairPath = process.env.HOME + '/.config/solana/id.json'
  const raw = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'))
  const authority = Keypair.fromSecretKey(Uint8Array.from(raw))
  console.log('Authority:', authority.publicKey.toBase58())

  const vault = getVaultPDA()
  console.log('Vault PDA:', vault.toBase58())

  // Check existing
  const usdcCfgPDA = getAssetConfigPDA(USDC_MINT)
  const xntCfgPDA  = getAssetConfigPDA(XNT_MINT)
  console.log('USDC AssetConfig PDA:', usdcCfgPDA.toBase58())
  console.log('XNT  AssetConfig PDA:', xntCfgPDA.toBase58())

  const [usdcInfo, xntInfo] = await Promise.all([
    conn.getAccountInfo(usdcCfgPDA),
    conn.getAccountInfo(xntCfgPDA),
  ])

  const tx = new Transaction()
  const { blockhash } = await conn.getLatestBlockhash()
  tx.recentBlockhash = blockhash
  tx.feePayer = authority.publicKey

  if (!usdcInfo) {
    console.log('Adding USDC.X (6 decimals, fixed $1.00)...')
    tx.add(buildAddAssetIx(
      authority.publicKey, USDC_MINT,
      6, true, 1_000_000n // $1.00 × 10^6
    ))
  } else {
    console.log('USDC.X already initialized ✓')
  }

  if (!xntInfo) {
    console.log('Adding XNT (9 decimals, oracle $0.35)...')
    tx.add(buildAddAssetIx(
      authority.publicKey, XNT_MINT,
      9, false, 350_000n // $0.35 × 10^6
    ))
  } else {
    console.log('XNT already initialized ✓')
  }

  if (tx.instructions.length === 0) {
    console.log('Both assets already configured!')
    return
  }

  tx.sign(authority)
  const sig = await conn.sendRawTransaction(tx.serialize())
  console.log('Sent tx:', sig)
  await conn.confirmTransaction(sig, 'confirmed')
  console.log('✅ Assets initialized!')
  console.log('Explorer:', `https://explorer.testnet.x1.xyz/tx/${sig}`)
}

main().catch(console.error)
