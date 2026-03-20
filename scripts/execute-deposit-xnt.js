#!/usr/bin/env node
/**
 * Execute deposit of 5 XNT to X1SAFE vault
 */

const {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  Keypair,
  sendAndConfirmTransaction,
} = require('@solana/web3.js');
const {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getAccount,
} = require('@solana/spl-token');
const fs = require('fs');

// Config
const RPC_URL = 'https://rpc.testnet.x1.xyz';
const PROGRAM_ID = new PublicKey('F2JnWVnjP1h6WG7KKUHqhp23etEJ4amdJquAcE9ecCoe');
const XNT_MINT = new PublicKey('CDREeqfWSxQvPa9ofxVrHFP5VZeF2xSc2EtAdXmNumuW');

// Load keypair from Solana config
const KEYPAIR_PATH = '/home/jack/.config/solana/id.json';
const secretKey = new Uint8Array(JSON.parse(fs.readFileSync(KEYPAIR_PATH, 'utf8')));
const wallet = Keypair.fromSecretKey(secretKey);

console.log('=== X1SAFE Deposit 5 XNT ===\n');
console.log(`Wallet: ${wallet.publicKey}`);
console.log(`Program: ${PROGRAM_ID}`);
console.log();

// PDAs
const vaultPDA = PublicKey.findProgramAddressSync([Buffer.from('vault')], PROGRAM_ID)[0];
const userPositionPDA = PublicKey.findProgramAddressSync(
  [Buffer.from('position'), wallet.publicKey.toBuffer()],
  PROGRAM_ID
)[0];

// Token accounts
const userTokenAccount = getAssociatedTokenAddressSync(XNT_MINT, wallet.publicKey, false, TOKEN_PROGRAM_ID);
const vaultTokenAccount = getAssociatedTokenAddressSync(XNT_MINT, vaultPDA, true, TOKEN_PROGRAM_ID);

console.log('Accounts:');
console.log(`  Vault PDA: ${vaultPDA}`);
console.log(`  User Position PDA: ${userPositionPDA}`);
console.log(`  User Token Account: ${userTokenAccount}`);
console.log(`  Vault Token Account: ${vaultTokenAccount}`);
console.log();

// Discriminator for deposit
const { sha256 } = require('@noble/hashes/sha256');
const discriminator = Buffer.from(sha256(new TextEncoder().encode('global:deposit')).slice(0, 8));

// Amount: 5 XNT = 5 * 10^9 = 5000000000
const amount = BigInt(5 * 10 ** 9);

async function deposit() {
  const connection = new Connection(RPC_URL, 'confirmed');

  // Check balances
  console.log('Checking balances...');
  const xntBalance = await connection.getBalance(wallet.publicKey);
  console.log(`  XNT (native): ${xntBalance / 1e9} XNT`);

  let userTokenBalance = 0;
  try {
    const tokenAccount = await getAccount(connection, userTokenAccount);
    userTokenBalance = Number(tokenAccount.amount) / 1e9;
    console.log(`  User token account: ${userTokenBalance} XNT`);
  } catch {
    console.log(`  ❌ User token account not found!`);
    process.exit(1);
  }

  if (userTokenBalance < 5) {
    console.log(`  ❌ Insufficient balance! Need 5 XNT, have ${userTokenBalance} XNT`);
    process.exit(1);
  }

  // Build transaction
  console.log('\nBuilding transaction...');
  const tx = new Transaction();

  // Check if vault token account exists, if not create it
  try {
    await getAccount(connection, vaultTokenAccount);
    console.log('  Vault token account exists');
  } catch {
    console.log('  Creating vault token account...');
    tx.add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        vaultTokenAccount,
        vaultPDA,
        XNT_MINT,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
  }

  // Build deposit instruction data
  const data = Buffer.alloc(16);
  discriminator.copy(data, 0);
  data.writeBigUInt64LE(amount, 8);

  // Build account metas
  const keys = [
    { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
    { pubkey: vaultPDA, isSigner: false, isWritable: true },
    { pubkey: userPositionPDA, isSigner: false, isWritable: true },
    { pubkey: userTokenAccount, isSigner: false, isWritable: true },
    { pubkey: vaultTokenAccount, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  tx.add({
    programId: PROGRAM_ID,
    keys,
    data,
  });

  console.log('  Deposit instruction added');
  console.log(`  Amount: ${amount} lamports (${Number(amount) / 1e9} XNT)`);

  // Send transaction
  console.log('\nSending transaction...');
  try {
    const sig = await sendAndConfirmTransaction(connection, tx, [wallet], {
      commitment: 'confirmed',
    });

    console.log(`\n✅ Deposit successful!`);
    console.log(`  Signature: ${sig}`);
    console.log(`  Explorer: https://explorer.testnet.x1.xyz/tx/${sig}`);

    // Check new balances
    console.log('\nUpdated balances:');
    const newTokenBalance = await getAccount(connection, userTokenAccount);
    console.log(`  User token: ${Number(newTokenBalance.amount) / 1e9} XNT`);

    const vaultInfo = await connection.getAccountInfo(vaultPDA);
    if (vaultInfo) {
      const d = vaultInfo.data;
      let o = 8 + 32 * 6 + 24; // Skip to u64 fields
      const totalTvlUsd = d.readBigUInt64LE(o);
      const totalX1safePutSupply = d.readBigUInt64LE(o + 8);
      console.log(`  Vault TVL: ${Number(totalTvlUsd) / 1e6} USD`);
      console.log(`  Vault X1SAFE_PUT supply: ${Number(totalX1safePutSupply) / 1e6}`);
    }

  } catch (err) {
    console.error('\n❌ Transaction failed:', err.message);
    if (err.logs) {
      console.error('Logs:', err.logs);
    }
    process.exit(1);
  }
}

deposit().catch(console.error);
