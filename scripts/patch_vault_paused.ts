/**
 * patch_vault_paused.ts — Use admin_unpause instruction to fix paused=159
 * OR write directly via a custom patch instruction
 */
import {
  Connection, PublicKey, Transaction, TransactionInstruction,
  Keypair
} from '@solana/web3.js'
import * as fs from 'fs'
import * as crypto from 'crypto'

const RPC = 'https://rpc.testnet.x1.xyz'
const PROGRAM_ID = new PublicKey('F2JnWVnjP1h6WG7KKUHqhp23etEJ4amdJquAcE9ecCoe')
const VAULT_PDA  = new PublicKey('A5HWWiKBmzM1wibshEoL4653qPrnHpnJ7yw74pW49ZNf')

function disc(name: string): Buffer {
  return Buffer.from(
    crypto.createHash('sha256').update(`global:${name}`).digest()
  ).slice(0, 8)
}

async function main() {
  const conn = new Connection(RPC, 'confirmed')
  const raw = JSON.parse(fs.readFileSync(process.env.HOME + '/.config/solana/id.json', 'utf-8'))
  const authority = Keypair.fromSecretKey(Uint8Array.from(raw))
  console.log('Authority:', authority.publicKey.toBase58())

  // Check current state
  const vaultInfo = await conn.getAccountInfo(VAULT_PDA)!
  const data = vaultInfo!.data
  console.log('paused byte at 263:', data[263])
  console.log('bump at 262:', data[262])

  // Try: set_paused(false) via AdminVault instruction
  // AdminVault uses AccountInfo for vault (bypass deserialize)
  // set_paused instruction: disc("set_paused") + bool(false)
  const pausedData = Buffer.alloc(9)
  disc('set_paused').copy(pausedData, 0)
  pausedData.writeUInt8(0, 8) // false

  const setPausedIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: authority.publicKey, isSigner: true,  isWritable: false },
      { pubkey: VAULT_PDA,          isSigner: false, isWritable: true  },
    ],
    data: pausedData,
  })

  const tx = new Transaction()
  tx.add(setPausedIx)
  const { blockhash } = await conn.getLatestBlockhash()
  tx.recentBlockhash = blockhash
  tx.feePayer = authority.publicKey
  tx.sign(authority)

  try {
    const sig = await conn.sendRawTransaction(tx.serialize())
    console.log('set_paused tx:', sig)
    await conn.confirmTransaction(sig, 'confirmed')
    console.log('✅ set_paused done!')
    const vaultAfter = await conn.getAccountInfo(VAULT_PDA)
    console.log('paused byte after:', vaultAfter!.data[263])
  } catch (e: any) {
    console.log('set_paused failed:', e.message)
    console.log('Logs:', e.transactionLogs)
  }
}

main().catch(console.error)
