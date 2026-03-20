#!/usr/bin/env node
/**
 * Initialize X1SAFE mints (create_mints instruction)
 * Must be run ONCE from authority wallet (vault.user_wallet)
 * 
 * Usage:
 *   cd /home/jack/.openclaw/workspace-cyberdyne/x1safuCMO/app
 *   npx tsx ../scripts/init-mints-simple.ts
 */

import {
  Connection, Transaction, PublicKey, Keypair,
  TransactionInstruction, SystemProgram, SYSVAR_RENT_PUBKEY
} from '@solana/web3.js'
import { sha256 } from '@noble/hashes/sha256'

// === Config ===
const PROGRAM_ID = new PublicKey('F2JnWVnjP1h6WG7KKUHqhp23etEJ4amdJquAcE9ecCoe')
const RPC_URL = 'https://rpc.testnet.x1.xyz'

// === PDAs ===
const VAULT = PublicKey.findProgramAddressSync([Buffer.from('vault')], PROGRAM_ID)[0]
const PUT_MINT = PublicKey.findProgramAddressSync([Buffer.from('put_mint')], PROGRAM_ID)[0]
const SAFE_MINT = PublicKey.findProgramAddressSync([Buffer.from('safe_mint')], PROGRAM_ID)[0]

// Token-2022 program
const TOKEN_2022 = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb')

function disc(name) {
  return Buffer.from(sha256(new TextEncoder().encode('global:' + name))).subarray(0, 8)
}

async function main() {
  const connection = new Connection(RPC_URL, 'confirmed')
  
  // Get authority from env (base64 encoded secret key)
  const authB64 = process.env.AUTHORITY_KEY
  if (!authB64) {
    console.error('❌ Set AUTHORITY_KEY=<base64-secret>')
    console.error('   Get from: cat ~/.config/solana/id.json | base64 -w0')
    process.exit(1)
  }
  
  const authority = Keypair.fromSecretKey(Buffer.from(authB64, 'base64'))
  console.log('Authority:', authority.publicKey.toBase58())
  console.log('Vault PDA:', VAULT.toBase58())
  console.log('PUT Mint:', PUT_MINT.toBase58())
  console.log('SAFE Mint:', SAFE_MINT.toBase58())
  
  // Check if already initialized
  const putInfo = await connection.getAccountInfo(PUT_MINT)
  if (putInfo) {
    console.log('\n✅ Mints already initialized!')
    return
  }
  
  // Build create_mints instruction
  const keys = [
    { pubkey: authority.publicKey, isSigner: true, isWritable: true },
    { pubkey: VAULT, isSigner: false, isWritable: true },
    { pubkey: PUT_MINT, isSigner: false, isWritable: true },
    { pubkey: SAFE_MINT, isSigner: false, isWritable: true },
    { pubkey: TOKEN_2022, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
  ]
  
  const data = disc('create_mints')
  
  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data,
  })
  
  const tx = new Transaction().add(ix)
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
  tx.feePayer = authority.publicKey
  
  console.log('\nSending transaction...')
  const sig = await connection.sendTransaction(tx, [authority], {
    preflightCommitment: 'confirmed'
  })
  
  console.log('Tx:', sig)
  console.log('Explorer: https://explorer.testnet.x1.xyz/tx/' + sig)
  
  await connection.confirmTransaction(sig, 'confirmed')
  console.log('\n✅ Mints initialized! Deposit should work now.')
}

main().catch(e => {
  console.error('❌ Failed:', e.message)
  process.exit(1)
})
