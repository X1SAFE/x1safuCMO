// Initialize X1SAFE mints - run this once from authority wallet
import {
  Connection, Transaction, PublicKey, TransactionInstruction,
  SystemProgram, SYSVAR_RENT_PUBKEY
} from '@solana/web3.js'
import {
  TOKEN_2022_PROGRAM_ID,
  createInitializeMintInstruction,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction
} from '@solana/spl-token'
import { sha256 } from '@noble/hashes/sha256'

// Config
const PROGRAM_ID = new PublicKey('F2JnWVnjP1h6WG7KKUHqhp23etEJ4amdJquAcE9ecCoe')
const RPC_URL = 'https://rpc.testnet.x1.xyz'

// PDAs
const getVaultPDA = () =>
  PublicKey.findProgramAddressSync([Buffer.from('vault')], PROGRAM_ID)[0]

const getPutMintPDA = () =>
  PublicKey.findProgramAddressSync([Buffer.from('put_mint')], PROGRAM_ID)[0]

const getSafeMintPDA = () =>
  PublicKey.findProgramAddressSync([Buffer.from('safe_mint')], PROGRAM_ID)[0]

// Discriminator
function disc(name) {
  return Buffer.from(sha256(new TextEncoder().encode('global:' + name))).subarray(0, 8)
}

async function main() {
  const connection = new Connection(RPC_URL, 'confirmed')
  
  // Get authority wallet from env or prompt
  const authorityStr = process.env.AUTHORITY_WALLET
  if (!authorityStr) {
    console.log('Usage: AUTHORITY_WALLET=<base58-secret> node scripts/init-mints.js')
    console.log('Or set AUTHORITY_WALLET in .env file')
    process.exit(1)
  }
  
  // Import wallet
  const { Keypair } = await import('@solana/web3.js')
  const authority = Keypair.fromSecretKey(Buffer.from(authorityStr, 'base64'))
  
  console.log('Authority:', authority.publicKey.toBase58())
  
  const vault = getVaultPDA()
  const putMint = getPutMintPDA()
  const safeMint = getSafeMintPDA()
  
  console.log('Vault PDA:', vault.toBase58())
  console.log('PUT Mint PDA:', putMint.toBase58())
  console.log('SAFE Mint PDA:', safeMint.toBase58())
  
  // Check if mints already exist
  const putInfo = await connection.getAccountInfo(putMint)
  if (putInfo) {
    console.log('PUT mint already exists! Skipping creation.')
    return
  }
  
  const tx = new Transaction()
  
  // Create mint accounts using system program
  // PUT Mint (2022 token)
  const createPutMintIx = SystemProgram.createAccount({
    fromPubkey: authority.publicKey,
    newAccountPubkey: putMint,
    lamports: await connection.getMinimumBalanceForRentExemption(82),
    space: 82,
    programId: TOKEN_2022_PROGRAM_ID
  })
  
  // Initialize PUT mint (9 decimals, vault as authority)
  const initPutMintIx = createInitializeMintInstruction(
    putMint,
    9, // decimals
    vault, // mint authority
    vault, // freeze authority
    TOKEN_2022_PROGRAM_ID
  )
  
  // SAFE Mint (2022 token)
  const createSafeMintIx = SystemProgram.createAccount({
    fromPubkey: authority.publicKey,
    newAccountPubkey: safeMint,
    lamports: await connection.getMinimumBalanceForRentExemption(82),
    space: 82,
    programId: TOKEN_2022_PROGRAM_ID
  })
  
  // Initialize SAFE mint (9 decimals, vault as authority)
  const initSafeMintIx = createInitializeMintInstruction(
    safeMint,
    9, // decimals
    vault, // mint authority
    vault, // freeze authority
    TOKEN_2022_PROGRAM_ID
  )
  
  // Call create_mints instruction
  const createMintsData = disc('create_mints')
  const keys = [
    { pubkey: authority.publicKey, isSigner: true, isWritable: true },
    { pubkey: vault, isSigner: false, isWritable: true },
    { pubkey: putMint, isSigner: false, isWritable: false },
    { pubkey: safeMint, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ]
  
  const createMintsIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data: createMintsData
  })
  
  tx.add(createPutMintIx, initPutMintIx, createSafeMintIx, initSafeMintIx, createMintsIx)
  
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
  tx.feePayer = authority.publicKey
  
  const sig = await connection.sendTransaction(tx, [authority], {
    skipPreflight: false,
    preflightCommitment: 'confirmed'
  })
  
  console.log('Transaction sent:', sig)
  console.log('Explorer:', `https://explorer.testnet.x1.xyz/tx/${sig}`)
  
  await connection.confirmTransaction(sig, 'confirmed')
  console.log('✅ Mints initialized successfully!')
}

main().catch(console.error)
