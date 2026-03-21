/**
 * Initialize x1safe_put_staking vault state — raw tx (no Anchor dependency)
 * Run from app/ dir: node --input-type=module < ../scripts/init_staking_raw.mjs
 */
import {
  Connection, Keypair, PublicKey, SystemProgram, Transaction,
  TransactionInstruction, SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js'
import {
  TOKEN_PROGRAM_ID, createMint,
} from '@solana/spl-token'
import { createHash } from 'crypto'
import { readFileSync } from 'fs'

const RPC               = 'https://rpc.testnet.x1.xyz'
const STAKING_PROGRAM   = new PublicKey('8s8JbaAtWtCKSyPfAxEN2vJLJFc3kWokxXxgCRvtHq9u')
const TREASURY          = new PublicKey('2u6H7CjFLGVezjSWDy1Rt6cPo23h89vRqUhocw67RD8R')
const USDC_X            = new PublicKey('6QNPqoF6GGhCFjTTQGxkpJkrH5ueS85b5RpX3GXdUSVw')

// Load deployer
const deployerKey = JSON.parse(readFileSync('/home/jack/.config/solana/x1safe-deployer.json', 'utf8'))
const deployer    = Keypair.fromSecretKey(new Uint8Array(deployerKey))
console.log('Deployer:', deployer.publicKey.toBase58())

const connection = new Connection(RPC, 'confirmed')
const bal = await connection.getBalance(deployer.publicKey)
console.log('Balance:', (bal / 1e9).toFixed(4), 'SOL')

// Compute PDAs
const [vaultState, vaultBump] = PublicKey.findProgramAddressSync(
  [Buffer.from('vault_state')], STAKING_PROGRAM
)
console.log('vault_state PDA:', vaultState.toBase58())

// Check if already init
const existing = await connection.getAccountInfo(vaultState)
if (existing) {
  console.log('✅ Already initialized! size:', existing.data.length)
  process.exit(0)
}

// Anchor discriminator = sha256("global:initialize_vault")[0..8]
function disc(name) {
  return createHash('sha256')
    .update(`global:${name}`)
    .digest()
    .slice(0, 8)
}

// Create X1SAFE mint (authority = vault_state PDA, 6 decimals)
console.log('\nCreating X1SAFE mint (6 dec, authority=vaultState)...')
const x1safeMint = await createMint(
  connection, deployer, vaultState, null, 6,
  undefined, { commitment: 'confirmed' }, TOKEN_PROGRAM_ID
)
console.log('X1SAFE mint:', x1safeMint.toBase58())

// Create X1SAFE_PUT mint (authority = vault_state PDA, 6 decimals)
console.log('Creating X1SAFE_PUT mint (6 dec, authority=vaultState)...')
const x1safePutMint = await createMint(
  connection, deployer, vaultState, null, 6,
  undefined, { commitment: 'confirmed' }, TOKEN_PROGRAM_ID
)
console.log('X1SAFE_PUT mint:', x1safePutMint.toBase58())

// Build initialize_vault instruction
// Args: x1safe_decimals: u8, x1safe_put_decimals: u8
const discBuf = disc('initialize_vault')
const argsBuf = Buffer.alloc(2)
argsBuf[0] = 6  // x1safe_decimals
argsBuf[1] = 6  // x1safe_put_decimals
const data = Buffer.concat([discBuf, argsBuf])

const feePool = deployer.publicKey  // fee_pool = deployer for now

const initIx = new TransactionInstruction({
  programId: STAKING_PROGRAM,
  keys: [
    { pubkey: deployer.publicKey, isSigner: true,  isWritable: true  }, // authority
    { pubkey: vaultState,         isSigner: false, isWritable: true  }, // vault_state
    { pubkey: x1safeMint,         isSigner: false, isWritable: true  }, // x1safe_mint
    { pubkey: x1safePutMint,      isSigner: false, isWritable: true  }, // x1safe_put_mint
    { pubkey: USDC_X,             isSigner: false, isWritable: false }, // usdc_mint
    { pubkey: TREASURY,           isSigner: false, isWritable: true  }, // treasury
    { pubkey: feePool,            isSigner: false, isWritable: true  }, // fee_pool
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID,        isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY,      isSigner: false, isWritable: false },
  ],
  data,
})

console.log('\nSending initialize_vault tx...')
const tx = new Transaction()
tx.add(initIx)
tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
tx.feePayer = deployer.publicKey
tx.sign(deployer)

try {
  const sig = await connection.sendRawTransaction(tx.serialize())
  await connection.confirmTransaction(sig, 'confirmed')
  console.log('\n✅ Vault initialized!')
  console.log('  Tx:          ', sig)
  console.log('  vault_state: ', vaultState.toBase58())
  console.log('  X1SAFE:      ', x1safeMint.toBase58())
  console.log('  X1SAFE_PUT:  ', x1safePutMint.toBase58())
  console.log('  Treasury:    ', TREASURY.toBase58())
  console.log('  Fee pool:    ', feePool.toBase58())
} catch (e) {
  console.error('\n❌ Failed:', e.message)
  if (e.logs) console.error('Program logs:\n', e.logs.join('\n'))
}
