const { Connection, PublicKey, Transaction, TransactionInstruction, Keypair } = require('@solana/web3.js');
const { readFileSync } = require('fs');
const { createHash } = require('crypto');

const RPC = 'https://rpc.testnet.x1.xyz';
const PROGRAM_ID = new PublicKey('F2JnWVnjP1h6WG7KKUHqhp23etEJ4amdJquAcE9ecCoe');
const VAULT_PDA  = new PublicKey('A5HWWiKBmzM1wibshEoL4653qPrnHpnJ7yw74pW49ZNf');

const disc = name => Buffer.from(createHash('sha256').update('global:'+name).digest()).slice(0,8);

async function main() {
  const conn = new Connection(RPC, 'confirmed');
  const raw = JSON.parse(readFileSync(process.env.HOME+'/.config/solana/id.json','utf-8'));
  const authority = Keypair.fromSecretKey(Uint8Array.from(raw));
  console.log('Authority:', authority.publicKey.toBase58());

  const vaultBefore = await conn.getAccountInfo(VAULT_PDA);
  console.log('Before - bump@262:', vaultBefore.data[262], 'paused@263:', vaultBefore.data[263]);

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: authority.publicKey, isSigner: true, isWritable: true },
      { pubkey: VAULT_PDA, isSigner: false, isWritable: true },
    ],
    data: disc('fix_vault_raw'),
  });

  const tx = new Transaction();
  tx.add(ix);
  const { blockhash } = await conn.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = authority.publicKey;
  tx.sign(authority);

  const sig = await conn.sendRawTransaction(tx.serialize());
  console.log('fix_vault_raw tx:', sig);
  await conn.confirmTransaction(sig, 'confirmed');

  const vaultAfter = await conn.getAccountInfo(VAULT_PDA);
  console.log('After - bump@262:', vaultAfter.data[262], 'paused@263:', vaultAfter.data[263]);
  console.log('✅ Vault fixed!');
}

main().catch(console.error);
