/**
 * Add USDC.X and XNT as supported tokens in x1safe_put_staking
 * Run from app/ dir: node --input-type=module < ../scripts/add_tokens.mjs
 */
import {
  Connection, Keypair, PublicKey, SystemProgram,
  Transaction, TransactionInstruction, SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js'
import {
  TOKEN_PROGRAM_ID, createAccount, getMinimumBalanceForRentExemptAccount,
  ACCOUNT_SIZE,
} from '@solana/spl-token'
import { createHash } from 'crypto'
import { readFileSync } from 'fs'

const RPC             = 'https://rpc.testnet.x1.xyz'
const STAKING_PROGRAM = new PublicKey('8s8JbaAtWtCKSyPfAxEN2vJLJFc3kWokxXxgCRvtHq9u')
const USDC_X          = new PublicKey('6QNPqoF6GGhCFjTTQGxkpJkrH5ueS85b5RpX3GXdUSVw')
const XNT             = new PublicKey('CDREeqfWSxQvPa9ofxVrHFP5VZeF2xSc2EtAdXmNumuW')
const VAULT_STATE     = new PublicKey('Cp4SrtaPCmhZhEHWPyeoirrr4uY17Qgvtj1V1gYofcDM')

const deployerKey = JSON.parse(readFileSync('/home/jack/.config/solana/x1safe-deployer.json', 'utf8'))
const deployer    = Keypair.fromSecretKey(new Uint8Array(deployerKey))
const connection  = new Connection(RPC, 'confirmed')

console.log('Deployer:', deployer.publicKey.toBase58())
const bal = await connection.getBalance(deployer.publicKey)
console.log('Balance:', (bal / 1e9).toFixed(4), 'SOL')

function disc(name) {
  return Buffer.from(createHash('sha256').update(`global:${name}`).digest()).slice(0, 8)
}

// Seeds from utils.rs
const SUPPORTED_TOKEN_SEED = Buffer.from('supported_token')

async function addSupportedToken(tokenMint, isStable, oraclePubkey) {
  const label = tokenMint.toBase58().slice(0, 8) + '...'
  console.log(`\nAdding ${label} (stable=${isStable})...`)

  // supported_token PDA
  const [supportedTokenPDA] = PublicKey.findProgramAddressSync(
    [SUPPORTED_TOKEN_SEED, tokenMint.toBuffer()],
    STAKING_PROGRAM
  )
  console.log('  supported_token PDA:', supportedTokenPDA.toBase58())

  // Check if already added
  const existing = await connection.getAccountInfo(supportedTokenPDA)
  if (existing) {
    console.log('  ✅ Already added!')
    return
  }

  // Create token vault keypair (ATA-style init by program)
  const tokenVaultKeypair = Keypair.generate()
  console.log('  token_vault:', tokenVaultKeypair.publicKey.toBase58())

  // Encode args: token_mint (32 bytes) + is_stable (1 byte) + oracle (32 bytes)
  const discBuf   = disc('add_supported_token')
  const mintBuf   = tokenMint.toBuffer()
  const stableBuf = Buffer.from([isStable ? 1 : 0])
  const oracleBuf = oraclePubkey.toBuffer()
  const data = Buffer.concat([discBuf, mintBuf, stableBuf, oracleBuf])

  const ix = new TransactionInstruction({
    programId: STAKING_PROGRAM,
    keys: [
      { pubkey: deployer.publicKey,          isSigner: true,  isWritable: true  }, // authority
      { pubkey: VAULT_STATE,                  isSigner: false, isWritable: true  }, // vault_state
      { pubkey: tokenMint,                    isSigner: false, isWritable: false }, // token_mint
      { pubkey: supportedTokenPDA,            isSigner: false, isWritable: true  }, // supported_token
      { pubkey: tokenVaultKeypair.publicKey,  isSigner: true,  isWritable: true  }, // token_vault
      { pubkey: oraclePubkey,                 isSigner: false, isWritable: false }, // oracle
      { pubkey: SystemProgram.programId,      isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID,             isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY,           isSigner: false, isWritable: false },
    ],
    data,
  })

  const tx = new Transaction()
  tx.add(ix)
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
  tx.feePayer = deployer.publicKey
  tx.sign(deployer, tokenVaultKeypair)

  try {
    const sig = await connection.sendRawTransaction(tx.serialize())
    await connection.confirmTransaction(sig, 'confirmed')
    console.log('  ✅ Added! tx:', sig)
    console.log('  token_vault:', tokenVaultKeypair.publicKey.toBase58())
  } catch (e) {
    console.error('  ❌ Failed:', e.message)
    if (e.logs) console.error('  Logs:\n ', e.logs.join('\n  '))
  }
}

// Use SystemProgram as placeholder oracle (program reads hardcoded prices for known mints)
const MOCK_ORACLE = SystemProgram.programId

// Add USDC.X (stable, 6 decimals)
await addSupportedToken(USDC_X, true, MOCK_ORACLE)

// Add XNT (non-stable, 9 decimals, priced via oracle)
await addSupportedToken(XNT, false, MOCK_ORACLE)

console.log('\n✅ All done!')
