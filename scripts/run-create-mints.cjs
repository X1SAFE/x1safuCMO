const { Connection, PublicKey, Keypair, Transaction, TransactionInstruction, SystemProgram, SYSVAR_RENT_PUBKEY } = require('@solana/web3.js');
const { sha256 } = require('@noble/hashes/sha256');
const fs = require('fs');

async function main() {
  const PROGRAM_ID = new PublicKey('F2JnWVnjP1h6WG7KKUHqhp23etEJ4amdJquAcE9ecCoe');
  const TOKEN_PROGRAM = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
  const RPC = 'https://rpc.testnet.x1.xyz';

  const conn = new Connection(RPC, 'confirmed');

  // Load authority keypair
  const kpData = JSON.parse(fs.readFileSync(`${process.env.HOME}/.config/solana/id.json`));
  const authority = Keypair.fromSecretKey(Uint8Array.from(kpData));
  console.log('Authority:', authority.publicKey.toBase58());

  // PDAs
  const [vault]    = PublicKey.findProgramAddressSync([Buffer.from('vault')],     PROGRAM_ID);
  const [putMint]  = PublicKey.findProgramAddressSync([Buffer.from('put_mint')],  PROGRAM_ID);
  const [safeMint] = PublicKey.findProgramAddressSync([Buffer.from('safe_mint')], PROGRAM_ID);

  console.log('Vault:    ', vault.toBase58());
  console.log('PUT Mint: ', putMint.toBase58());
  console.log('SAFE Mint:', safeMint.toBase58());

  // Check if already initialized
  const putInfo = await conn.getAccountInfo(putMint);
  if (putInfo) {
    console.log('✅ PUT mint already initialized!');
    return;
  }

  // Anchor discriminator for create_mints
  const discriminator = Buffer.from(sha256(new TextEncoder().encode('global:create_mints'))).subarray(0, 8);

  const keys = [
    { pubkey: authority.publicKey, isSigner: true,  isWritable: true  },
    { pubkey: vault,               isSigner: false, isWritable: true  },
    { pubkey: putMint,             isSigner: false, isWritable: true  },
    { pubkey: safeMint,            isSigner: false, isWritable: true  },
    { pubkey: TOKEN_PROGRAM,       isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY,  isSigner: false, isWritable: false },
  ];

  const ix = new TransactionInstruction({ programId: PROGRAM_ID, keys, data: discriminator });

  const tx = new Transaction().add(ix);
  const { blockhash } = await conn.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = authority.publicKey;
  tx.sign(authority);

  console.log('\nSending create_mints transaction...');
  const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false });
  console.log('Tx:', sig);
  console.log('Explorer: https://explorer.testnet.x1.xyz/tx/' + sig);

  await conn.confirmTransaction(sig, 'confirmed');

  // Verify
  const checkPut  = await conn.getAccountInfo(putMint);
  const checkSafe = await conn.getAccountInfo(safeMint);
  console.log('\nPUT Mint created: ', !!checkPut);
  console.log('SAFE Mint created:', !!checkSafe);
  console.log('\n✅ create_mints done! Deposit should work now.');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
