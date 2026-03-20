const { Connection, PublicKey, Keypair, Transaction, TransactionInstruction, SystemProgram } = require('@solana/web3.js');
const { sha256 } = require('@noble/hashes/sha256');
const fs = require('fs');

async function main() {
  const PROGRAM_ID = new PublicKey('F2JnWVnjP1h6WG7KKUHqhp23etEJ4amdJquAcE9ecCoe');
  const RPC = 'https://rpc.testnet.x1.xyz';

  const conn = new Connection(RPC, 'confirmed');

  // Load authority keypair
  const kpData = JSON.parse(fs.readFileSync(`${process.env.HOME}/.config/solana/id.json`));
  const authority = Keypair.fromSecretKey(Uint8Array.from(kpData));
  console.log('Authority:', authority.publicKey.toBase58());

  // PDA
  const [vault] = PublicKey.findProgramAddressSync([Buffer.from('vault')], PROGRAM_ID);
  console.log('Vault:', vault.toBase58());

  // Check current bump
  const info = await conn.getAccountInfo(vault);
  const currentBump = info.data[262];
  console.log('Current bump stored:', currentBump);
  console.log('Expected bump (PDA):', 249);

  if (currentBump === 249) {
    console.log('✅ Bump already correct!');
    return;
  }

  // Anchor discriminator for fix_bump
  const discriminator = Buffer.from(sha256(new TextEncoder().encode('global:fix_bump'))).subarray(0, 8);

  const keys = [
    { pubkey: authority.publicKey, isSigner: true,  isWritable: true  },
    { pubkey: vault,               isSigner: false, isWritable: true  },
  ];

  const ix = new TransactionInstruction({ programId: PROGRAM_ID, keys, data: discriminator });

  const tx = new Transaction().add(ix);
  const { blockhash } = await conn.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = authority.publicKey;
  tx.sign(authority);

  console.log('\nSending fix_bump transaction...');
  const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false });
  console.log('Tx:', sig);
  console.log('Explorer: https://explorer.testnet.x1.xyz/tx/' + sig);

  await conn.confirmTransaction(sig, 'confirmed');

  // Verify
  const check = await conn.getAccountInfo(vault);
  const newBump = check.data[262];
  console.log('\nNew bump stored:', newBump);
  console.log(newBump === 249 ? '✅ Fix successful!' : '❌ Fix failed');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
