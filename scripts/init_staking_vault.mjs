/**
 * Initialize x1safe_put_staking vault state on X1 testnet
 * Run: node scripts/init_staking_vault.mjs
 */
import { Connection, Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor'
import { TOKEN_PROGRAM_ID, createMint, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const RPC = 'https://rpc.testnet.x1.xyz'
const STAKING_PROGRAM_ID = new PublicKey('8s8JbaAtWtCKSyPfAxEN2vJLJFc3kWokxXxgCRvtHq9u')
// Treasury hardcoded in program — must match or tx fails
const TREASURY = new PublicKey('2u6H7CjFLGVezjSWDy1Rt6cPo23h89vRqUhocw67RD8R')
const USDC_X   = new PublicKey('6QNPqoF6GGhCFjTTQGxkpJkrH5ueS85b5RpX3GXdUSVw')

// Load deployer keypair
const deployerKey = JSON.parse(readFileSync('/home/jack/.config/solana/x1safe-deployer.json', 'utf8'))
const deployer    = Keypair.fromSecretKey(new Uint8Array(deployerKey))
console.log('Deployer:', deployer.publicKey.toBase58())

const connection = new Connection(RPC, 'confirmed')
const balance    = await connection.getBalance(deployer.publicKey)
console.log('Balance:', (balance / 1e9).toFixed(4), 'SOL')

const provider = new AnchorProvider(connection, new Wallet(deployer), { commitment: 'confirmed' })

// Load IDL
const idl = JSON.parse(readFileSync(
  join(__dirname, '../target/idl/x1safe_put_staking.json'), 'utf8'
))

const program = new Program(idl, STAKING_PROGRAM_ID, provider)

// Compute vault_state PDA
const [vaultState, vaultBump] = PublicKey.findProgramAddressSync(
  [Buffer.from('vault_state')], STAKING_PROGRAM_ID
)
console.log('\nvault_state PDA:', vaultState.toBase58(), '(bump:', vaultBump + ')')

// Check if already initialized
const existing = await connection.getAccountInfo(vaultState)
if (existing) {
  console.log('✅ vault_state already initialized! (size:', existing.data.length, 'bytes)')
  process.exit(0)
}

console.log('\n=== Creating X1SAFE and X1SAFE_PUT mints ===')

// Create X1SAFE mint (6 decimals, authority = vault_state PDA)
console.log('Creating X1SAFE mint...')
const x1safeMint = await createMint(
  connection,
  deployer,           // payer
  vaultState,         // mint authority = vault PDA
  vaultState,         // freeze authority
  6,                  // decimals
  undefined,
  { commitment: 'confirmed' },
  TOKEN_PROGRAM_ID
)
console.log('X1SAFE mint:', x1safeMint.toBase58())

// Create X1SAFE_PUT mint (6 decimals, authority = vault_state PDA)
console.log('Creating X1SAFE_PUT mint...')
const x1safePutMint = await createMint(
  connection,
  deployer,
  vaultState,
  vaultState,
  6,
  undefined,
  { commitment: 'confirmed' },
  TOKEN_PROGRAM_ID
)
console.log('X1SAFE_PUT mint:', x1safePutMint.toBase58())

// fee_pool = deployer wallet for now
const feePool = deployer.publicKey

console.log('\n=== Initializing vault_state ===')
try {
  const tx = await program.methods
    .initializeVault(6, 6)   // x1safe_decimals, x1safe_put_decimals
    .accounts({
      authority:    deployer.publicKey,
      vaultState,
      x1safeMint,
      x1safePutMint,
      usdcMint:     USDC_X,
      treasury:     TREASURY,
      feePool,
      systemProgram: SystemProgram.programId,
      tokenProgram:  TOKEN_PROGRAM_ID,
      rent:          SYSVAR_RENT_PUBKEY,
    })
    .signers([deployer])
    .rpc()

  console.log('✅ vault_state initialized!')
  console.log('  Tx:', tx)
  console.log('  X1SAFE mint:    ', x1safeMint.toBase58())
  console.log('  X1SAFE_PUT mint:', x1safePutMint.toBase58())
  console.log('  vault_state:    ', vaultState.toBase58())
  console.log('  Treasury:       ', TREASURY.toBase58())
  console.log('  Fee pool:       ', feePool.toBase58())
} catch (e) {
  console.error('❌ Init failed:', e.message)
  if (e.logs) console.error('Logs:\n', e.logs.join('\n'))
}
