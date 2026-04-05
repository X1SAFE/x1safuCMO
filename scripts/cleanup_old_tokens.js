/**
 * X1SAFE Cleanup Script
 * Burns old staking tokens + closes empty accounts to reclaim rent
 * 
 * Usage: node cleanup_old_tokens.js <YOUR_WALLET_KEYPAIR.json>
 */

const { Connection, PublicKey, Keypair, Transaction } = require('@solana/web3.js')
const {
  getAssociatedTokenAddressSync,
  createBurnInstruction,
  createCloseAccountInstruction,
  TOKEN_PROGRAM_ID,
} = require('@solana/spl-token')
const fs = require('fs')

const RPC = 'https://rpc.testnet.x1.xyz'

// Old mints to clean up
const OLD_MINTS = [
  '75HZTezD1w2XBeoGJJzQxekayojEXeTgvJks8zWXWtda', // STAKING_X1SAFE_MINT (old)
  '2J1JrRSyj2j93toj4k89buNKN2Z9sFXUmfAWZXWow5VA', // X1SAFE_PUT_MINT (old staking)
]

async function main() {
  const keypairFile = process.argv[2]
  if (!keypairFile) {
    console.error('Usage: node cleanup_old_tokens.js <keypair.json>')
    process.exit(1)
  }

  const raw = JSON.parse(fs.readFileSync(keypairFile, 'utf8'))
  const payer = Keypair.fromSecretKey(Uint8Array.from(raw))
  const connection = new Connection(RPC, 'confirmed')

  console.log('Wallet:', payer.publicKey.toBase58())
  console.log('')

  for (const mintStr of OLD_MINTS) {
    const mint = new PublicKey(mintStr)
    const ata = getAssociatedTokenAddressSync(mint, payer.publicKey, false, TOKEN_PROGRAM_ID)

    console.log('Checking mint:', mintStr)

    let balance
    try {
      const info = await connection.getTokenAccountBalance(ata)
      balance = BigInt(info.value.amount)
      console.log('  Balance:', info.value.uiAmount)
    } catch {
      console.log('  No account found, skipping')
      continue
    }

    const tx = new Transaction()

    if (balance > 0n) {
      console.log('  Burning', balance.toString(), 'tokens...')
      tx.add(createBurnInstruction(ata, mint, payer.publicKey, balance, [], TOKEN_PROGRAM_ID))
    }

    tx.add(createCloseAccountInstruction(ata, payer.publicKey, payer.publicKey, [], TOKEN_PROGRAM_ID))

    try {
      const sig = await connection.sendTransaction(tx, [payer])
      await connection.confirmTransaction(sig, 'confirmed')
      console.log('  Closed! Tx:', sig)
    } catch (e) {
      console.error('  Failed:', e.message)
    }
  }

  console.log('\nDone!')
}

main().catch(console.error)
