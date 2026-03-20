/**
 * fix_vault.ts — Fix vault bump and unpause vault by writing directly to account data
 * Uses fix_bump instruction (AccountInfo bypass) then unpause
 */
import {
  Connection, PublicKey, Transaction, TransactionInstruction,
  SystemProgram, Keypair, SYSVAR_RENT_PUBKEY
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

  // Read current vault state
  const vaultInfo = await conn.getAccountInfo(VAULT_PDA)
  if (!vaultInfo) throw new Error('Vault not found!')
  const data = vaultInfo.data
  console.log('Vault size:', data.length)

  // Find canonical bump
  const [, canonicalBump] = PublicKey.findProgramAddressSync([Buffer.from('vault')], PROGRAM_ID)
  console.log('Canonical bump:', canonicalBump)

  // Read current bump - need to find correct offset
  // Layout: 8 disc + 6*32 + 1 + 23 + 4*8 + 8 + 3*2 = 8+192+1+23+32+8+6 = 270
  // bump at struct offset 254 = raw offset 8+254 = 262
  // BUT we found bump at raw offset 270 (from scan above)
  const bumpAtOffset262 = data[262]
  const bumpAtOffset270 = data[270]
  const pausedAt263 = data[263]
  const pausedAt271 = data[271]
  console.log('bump at 262:', bumpAtOffset262, 'paused at 263:', pausedAt263)
  console.log('bump at 270:', bumpAtOffset270, 'paused at 271:', pausedAt271)

  // Call fix_bump instruction — uses AccountInfo (bypass anchor deserialize)
  const fixBumpData = disc('fix_bump')
  const fixBumpIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: authority.publicKey, isSigner: true,  isWritable: true  },
      { pubkey: VAULT_PDA,          isSigner: false, isWritable: true  },
    ],
    data: fixBumpData,
  })

  const tx = new Transaction()
  tx.add(fixBumpIx)
  const { blockhash } = await conn.getLatestBlockhash()
  tx.recentBlockhash = blockhash
  tx.feePayer = authority.publicKey
  tx.sign(authority)

  const sig = await conn.sendRawTransaction(tx.serialize())
  console.log('fix_bump tx:', sig)
  await conn.confirmTransaction(sig, 'confirmed')
  console.log('✅ fix_bump done!')

  // Verify
  const vaultAfter = await conn.getAccountInfo(VAULT_PDA)
  if (vaultAfter) {
    console.log('bump after fix at 262:', vaultAfter.data[262])
    console.log('bump after fix at 270:', vaultAfter.data[270])
  }
}

main().catch(console.error)
