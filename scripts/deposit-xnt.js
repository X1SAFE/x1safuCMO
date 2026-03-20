#!/usr/bin/env node
/**
 * deposit-xnt.js — Deposit XNT into X1SAFE vault
 * Usage: node scripts/deposit-xnt.js [amount_xnt]
 */

const {
  Connection, PublicKey, Transaction, TransactionInstruction,
  SystemProgram, Keypair, sendAndConfirmTransaction,
} = require('@solana/web3.js');
const {
  TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getAccount,
} = require('@solana/spl-token');
const crypto = require('crypto');
const fs = require('fs');

// ── Config ────────────────────────────────────────────────────────────────────
const RPC        = 'https://rpc.testnet.x1.xyz';
const PROGRAM_ID = new PublicKey('F2JnWVnjP1h6WG7KKUHqhp23etEJ4amdJquAcE9ecCoe');
const XNT_MINT   = new PublicKey('CDREeqfWSxQvPa9ofxVrHFP5VZeF2xSc2EtAdXmNumuW');

const KEYPAIR_PATH = `${process.env.HOME}/.config/solana/id.json`;
const wallet = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(fs.readFileSync(KEYPAIR_PATH, 'utf8')))
);

const XNT_AMOUNT = parseFloat(process.argv[2] || '1');   // default 1 XNT
const AMOUNT     = BigInt(Math.round(XNT_AMOUNT * 1e9)); // 9 decimals

// ── PDAs ──────────────────────────────────────────────────────────────────────
function pda(seeds) {
  return PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];
}

const vaultPDA       = pda([Buffer.from('vault')]);
const assetConfigPDA = pda([Buffer.from('asset'), XNT_MINT.toBuffer()]);
const putMintPDA     = pda([Buffer.from('put_mint')]);
const userPositionPDA= pda([Buffer.from('position'), wallet.publicKey.toBuffer()]);

// Token accounts
const reserveATA     = getAssociatedTokenAddressSync(XNT_MINT,  vaultPDA, true,              TOKEN_PROGRAM_ID);
const userAssetATA   = getAssociatedTokenAddressSync(XNT_MINT,  wallet.publicKey, false,      TOKEN_PROGRAM_ID);
const userPutATA     = getAssociatedTokenAddressSync(putMintPDA, wallet.publicKey, false,     TOKEN_PROGRAM_ID);

// Instruction discriminator
function disc(name) {
  return Buffer.from(crypto.createHash('sha256').update('global:' + name).digest()).slice(0, 8);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const conn = new Connection(RPC, 'confirmed');

  console.log('═══════════════════════════════════════');
  console.log('   X1SAFE Deposit — XNT');
  console.log('═══════════════════════════════════════');
  console.log(`  Wallet:          ${wallet.publicKey}`);
  console.log(`  XNT amount:      ${XNT_AMOUNT} XNT`);
  console.log(`  Lamports:        ${AMOUNT}`);
  console.log();
  console.log('  PDAs:');
  console.log(`    vault:         ${vaultPDA}`);
  console.log(`    asset_config:  ${assetConfigPDA}`);
  console.log(`    put_mint:      ${putMintPDA}`);
  console.log(`    user_position: ${userPositionPDA}`);
  console.log();
  console.log('  Token Accounts:');
  console.log(`    reserve_ata:   ${reserveATA}`);
  console.log(`    user_xnt_ata:  ${userAssetATA}`);
  console.log(`    user_put_ata:  ${userPutATA}`);
  console.log();

  // Check XNT balance
  let xntBalance = 0n;
  try {
    const acct = await getAccount(conn, userAssetATA);
    xntBalance = acct.amount;
    console.log(`  XNT balance:     ${Number(xntBalance) / 1e9} XNT`);
  } catch {
    console.error('❌ XNT token account not found. Do you have XNT?');
    process.exit(1);
  }

  if (xntBalance < AMOUNT) {
    console.error(`❌ Insufficient balance: have ${Number(xntBalance)/1e9}, need ${XNT_AMOUNT}`);
    process.exit(1);
  }

  const tx = new Transaction();

  // Create reserve ATA if needed
  try {
    await getAccount(conn, reserveATA);
    console.log('  ✓ Reserve ATA exists');
  } catch {
    console.log('  + Creating reserve ATA...');
    tx.add(createAssociatedTokenAccountInstruction(
      wallet.publicKey, reserveATA, vaultPDA, XNT_MINT,
      TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
    ));
  }

  // Create user PUT ATA if needed
  try {
    await getAccount(conn, userPutATA);
    console.log('  ✓ User PUT ATA exists');
  } catch {
    console.log('  + Creating user PUT ATA...');
    tx.add(createAssociatedTokenAccountInstruction(
      wallet.publicKey, userPutATA, wallet.publicKey, putMintPDA,
      TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
    ));
  }

  // Build deposit instruction
  // Args: amount (u64 LE)
  const data = Buffer.alloc(8 + 8);
  disc('deposit').copy(data, 0);
  data.writeBigUInt64LE(AMOUNT, 8);

  tx.add(new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: wallet.publicKey,   isSigner: true,  isWritable: true  }, // user
      { pubkey: vaultPDA,           isSigner: false, isWritable: true  }, // vault
      { pubkey: assetConfigPDA,     isSigner: false, isWritable: true  }, // asset_config
      { pubkey: reserveATA,         isSigner: false, isWritable: true  }, // reserve_account
      { pubkey: userAssetATA,       isSigner: false, isWritable: true  }, // user_asset_account
      { pubkey: putMintPDA,         isSigner: false, isWritable: true  }, // put_mint
      { pubkey: userPutATA,         isSigner: false, isWritable: true  }, // user_put_ata
      { pubkey: userPositionPDA,    isSigner: false, isWritable: true  }, // user_position
      { pubkey: TOKEN_PROGRAM_ID,   isSigner: false, isWritable: false }, // token_program
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
    ],
    data,
  }));

  console.log('\n  Sending transaction...');

  try {
    const sig = await sendAndConfirmTransaction(conn, tx, [wallet], { commitment: 'confirmed' });

    console.log('\n═══════════════════════════════════════');
    console.log('   ✅ DEPOSIT SUCCESSFUL!');
    console.log('═══════════════════════════════════════');
    console.log(`  Signature: ${sig}`);
    console.log(`  Explorer:  https://explorer.testnet.x1.xyz/tx/${sig}`);

    // Post-deposit state
    console.log('\n  Updated balances:');
    try {
      const newXnt = await getAccount(conn, userAssetATA);
      console.log(`    XNT remaining:   ${Number(newXnt.amount) / 1e9} XNT`);
    } catch {}
    try {
      const newPut = await getAccount(conn, userPutATA);
      console.log(`    PUT received:    ${Number(newPut.amount) / 1e2} X1SAFE-PUT`);
    } catch {}

    // Read vault TVL
    const vaultInfo = await conn.getAccountInfo(vaultPDA);
    if (vaultInfo) {
      const d = vaultInfo.data;
      // offset 8(disc) + 192(6 pubkeys) + 24(u8+pad) = 224
      const tvl    = Number(d.readBigUInt64LE(224)) / 1e6;
      const supply = Number(d.readBigUInt64LE(232)) / 1e2;
      console.log(`    Vault TVL:       $${tvl.toFixed(2)}`);
      console.log(`    PUT supply:      ${supply.toFixed(0)}`);
    }

  } catch (err) {
    console.error('\n❌ Transaction failed:', err.message);
    if (err.logs) {
      console.error('\nLogs:');
      err.logs.forEach(l => console.error(' ', l));
    }
    process.exit(1);
  }
}

main().catch(console.error);
