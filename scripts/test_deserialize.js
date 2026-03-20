const { Connection, PublicKey } = require('@solana/web3.js');
const { AnchorProvider, Program } = require('@coral-xyz/anchor');
const idl = require('../target/idl/x1safu.json');

const RPC = 'https://rpc.testnet.x1.xyz';
const PROGRAM_ID = new PublicKey('F2JnWVnjP1h6WG7KKUHqhp23etEJ4amdJquAcE9ecCoe');
const VAULT_PDA  = new PublicKey('A5HWWiKBmzM1wibshEoL4653qPrnHpnJ7yw74pW49ZNf');

async function main() {
  const conn = new Connection(RPC, 'confirmed');
  
  // Try raw decode using coder
  const coder = new (require('@coral-xyz/anchor').BorshAccountsCoder)(idl);
  
  const vaultInfo = await conn.getAccountInfo(VAULT_PDA);
  console.log('Vault data length:', vaultInfo.data.length);
  console.log('First 8 bytes (disc):', vaultInfo.data.slice(0,8).toString('hex'));
  
  try {
    const decoded = coder.decode('VaultState', vaultInfo.data);
    console.log('✅ Decoded successfully!');
    console.log('bump:', decoded.bump);
    console.log('paused:', decoded.paused);
    console.log('userWallet:', decoded.userWallet?.toBase58());
  } catch (e) {
    console.log('❌ Decode failed:', e.message);
  }
}

main().catch(console.error);
