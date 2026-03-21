/**
 * Create stake_vault token accounts for x1safe_put_staking
 * stake_vault holds staked X1SAFE_PUT tokens (authority = vault_state PDA)
 * Run from app/ dir: node --input-type=module < ../scripts/create_stake_vault.mjs
 */
import {
  Connection, Keypair, PublicKey,
} from '@solana/web3.js'
import {
  TOKEN_PROGRAM_ID, createAccount,
} from '@solana/spl-token'
import { readFileSync } from 'fs'

const RPC               = 'https://rpc.testnet.x1.xyz'
const VAULT_STATE       = new PublicKey('Cp4SrtaPCmhZhEHWPyeoirrr4uY17Qgvtj1V1gYofcDM')
const X1SAFE_PUT_MINT   = new PublicKey('2J1JrRSyj2j93toj4k89buNKN2Z9sFXUmfAWZXWow5VA')

const deployerKey = JSON.parse(readFileSync('/home/jack/.config/solana/x1safe-deployer.json', 'utf8'))
const deployer    = Keypair.fromSecretKey(new Uint8Array(deployerKey))
const connection  = new Connection(RPC, 'confirmed')

console.log('Deployer:', deployer.publicKey.toBase58())
const bal = await connection.getBalance(deployer.publicKey)
console.log('Balance:', (bal / 1e9).toFixed(4), 'SOL')

// Create stake_vault: holds staked X1SAFE_PUT, authority = vault_state PDA
const stakeVaultKp = Keypair.generate()
console.log('\nCreating stake_vault...')
console.log('  keypair:', stakeVaultKp.publicKey.toBase58())

const stakeVault = await createAccount(
  connection,
  deployer,           // payer
  X1SAFE_PUT_MINT,    // mint
  VAULT_STATE,        // authority (vault_state PDA can transfer out)
  stakeVaultKp,       // keypair
  { commitment: 'confirmed' },
  TOKEN_PROGRAM_ID
)
console.log('✅ stake_vault created:', stakeVault.toBase58())

// Also create reward_pool_x1safe (holds X1SAFE for staker rewards)
// PDA: reward_pool + vault_state → but this is an ATA-style account
// We use getAssociatedTokenAddressSync(X1SAFE_MINT, vaultState, true)
// which is already created in add_tokens.mjs as rewardPoolAta
// Just confirm it exists
console.log('\n✅ All done!')
console.log('\nAdd to vault.ts:')
console.log(`export const STAKING_STAKE_VAULT = new PublicKey('${stakeVault.toBase58()}')`)
