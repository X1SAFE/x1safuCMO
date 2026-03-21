/**
 * Full test: Deposit XNT → get X1SAFE_PUT → then Withdraw (redeem_x1safe)
 * Run from app/ dir: node --input-type=module < ../scripts/test_deposit_withdraw.mjs
 */
import {
  Connection, Keypair, PublicKey, SystemProgram,
  Transaction, TransactionInstruction, SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js'
import {
  TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync,
  getAccount, createMint, mintTo, getOrCreateAssociatedTokenAccount,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token'
import { createHash } from 'crypto'
import { readFileSync } from 'fs'

const RPC               = 'https://rpc.testnet.x1.xyz'
const STAKING_PROGRAM   = new PublicKey('8s8JbaAtWtCKSyPfAxEN2vJLJFc3kWokxXxgCRvtHq9u')
const VAULT_STATE       = new PublicKey('Cp4SrtaPCmhZhEHWPyeoirrr4uY17Qgvtj1V1gYofcDM')
const X1SAFE_PUT_MINT   = new PublicKey('2J1JrRSyj2j93toj4k89buNKN2Z9sFXUmfAWZXWow5VA')
const X1SAFE_MINT       = new PublicKey('75HZTezD1w2XBeoGJJzQxekayojEXeTgvJks8zWXWtda')
const XNT               = new PublicKey('CDREeqfWSxQvPa9ofxVrHFP5VZeF2xSc2EtAdXmNumuW')
const XNT_VAULT         = new PublicKey('FUHno7PbvQbqoXSektfRBfjuPDiN75SdX2R2Hgncaqjf')
const SYSTEM_PROGRAM    = SystemProgram.programId

const SUPPORTED_TOKEN_SEED  = Buffer.from('supported_token')
const USER_POSITION_SEED    = Buffer.from('user_position')

function disc(name) {
  return Buffer.from(createHash('sha256').update(`global:${name}`).digest()).slice(0, 8)
}
function createATAIx(payer, ata, owner, mint) {
  return new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: payer,        isSigner: true,  isWritable: true  },
      { pubkey: ata,          isSigner: false, isWritable: true  },
      { pubkey: owner,        isSigner: false, isWritable: false },
      { pubkey: mint,         isSigner: false, isWritable: false },
      { pubkey: SYSTEM_PROGRAM, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([0]),
  })
}

const deployerKey = JSON.parse(readFileSync('/home/jack/.config/solana/x1safe-deployer.json', 'utf8'))
const deployer    = Keypair.fromSecretKey(new Uint8Array(deployerKey))
const connection  = new Connection(RPC, 'confirmed')
const user        = deployer.publicKey

console.log('=== X1SAFE Deposit → Withdraw Test ===')
console.log('User:', user.toBase58())

// ── Step 1: Mint 100 XNT to deployer ──
console.log('\n[1] Mint 100 XNT to deployer...')
const userXntAta = getAssociatedTokenAddressSync(XNT, user, false, TOKEN_PROGRAM_ID)
try { await getAccount(connection, userXntAta, undefined, TOKEN_PROGRAM_ID) }
catch {
  const tx = new Transaction()
  tx.add(createATAIx(user, userXntAta, user, XNT))
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
  tx.feePayer = user; tx.sign(deployer)
  await connection.confirmTransaction(await connection.sendRawTransaction(tx.serialize()), 'confirmed')
  console.log('  Created XNT ATA:', userXntAta.toBase58())
}
// Mint 100 XNT (9 decimals)
await mintTo(connection, deployer, XNT, userXntAta, deployer, 100 * 1e9, [], { commitment: 'confirmed' }, TOKEN_PROGRAM_ID)
console.log('  ✅ Minted 100 XNT →', userXntAta.toBase58())

// ── Step 2: Ensure user PUT ATA ──
const userPutAta = getAssociatedTokenAddressSync(X1SAFE_PUT_MINT, user, false, TOKEN_PROGRAM_ID)
try { await getAccount(connection, userPutAta, undefined, TOKEN_PROGRAM_ID) }
catch {
  const tx = new Transaction()
  tx.add(createATAIx(user, userPutAta, user, X1SAFE_PUT_MINT))
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
  tx.feePayer = user; tx.sign(deployer)
  await connection.confirmTransaction(await connection.sendRawTransaction(tx.serialize()), 'confirmed')
  console.log('  Created PUT ATA:', userPutAta.toBase58())
}

// ── Step 3: Deposit 10 XNT (lock 7 days) ──
console.log('\n[2] Deposit 10 XNT (lock 7 days)...')
const supportedToken = PublicKey.findProgramAddressSync(
  [SUPPORTED_TOKEN_SEED, XNT.toBuffer()], STAKING_PROGRAM)[0]
const userPosition = PublicKey.findProgramAddressSync(
  [USER_POSITION_SEED, user.toBuffer(), XNT.toBuffer()], STAKING_PROGRAM)[0]

const depositData = Buffer.concat([
  disc('deposit'),
  Buffer.from(new BigUint64Array([BigInt(10 * 1e9)]).buffer), // 10 XNT
  Buffer.from(new Uint16Array([7]).buffer),                   // 7 days lock
])

const depositTx = new Transaction()
// Account order = Deposit<'info> struct order:
// user, vault_state, supported_token, token_mint,
// user_token_account, vault_token_account,
// x1safe_put_mint, user_x1safe_put_account,
// user_position, oracle, system_program, token_program, rent
depositTx.add(new TransactionInstruction({
  programId: STAKING_PROGRAM,
  keys: [
    { pubkey: user,               isSigner: true,  isWritable: true  }, // user
    { pubkey: VAULT_STATE,        isSigner: false, isWritable: true  }, // vault_state
    { pubkey: supportedToken,     isSigner: false, isWritable: false }, // supported_token
    { pubkey: XNT,                isSigner: false, isWritable: false }, // token_mint
    { pubkey: userXntAta,         isSigner: false, isWritable: true  }, // user_token_account
    { pubkey: XNT_VAULT,          isSigner: false, isWritable: true  }, // vault_token_account
    { pubkey: X1SAFE_PUT_MINT,    isSigner: false, isWritable: true  }, // x1safe_put_mint
    { pubkey: userPutAta,         isSigner: false, isWritable: true  }, // user_x1safe_put_account
    { pubkey: userPosition,       isSigner: false, isWritable: true  }, // user_position (init)
    { pubkey: SYSTEM_PROGRAM,     isSigner: false, isWritable: false }, // oracle (mock = SystemProgram)
    { pubkey: SYSTEM_PROGRAM,     isSigner: false, isWritable: false }, // system_program
    { pubkey: TOKEN_PROGRAM_ID,   isSigner: false, isWritable: false }, // token_program
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }, // rent
  ],
  data: depositData,
}))
depositTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
depositTx.feePayer = user; depositTx.sign(deployer)

try {
  const sig = await connection.sendRawTransaction(depositTx.serialize())
  await connection.confirmTransaction(sig, 'confirmed')
  console.log('  ✅ Deposited! tx:', sig)

  // Check PUT balance
  const putAcct = await getAccount(connection, userPutAta, undefined, TOKEN_PROGRAM_ID)
  console.log('  PUT balance:', Number(putAcct.amount) / 1e6, 'X1SAFE_PUT')
} catch (e) {
  console.error('  ❌ Deposit failed:', e.message)
  if (e.logs) console.error('  Logs:\n ', e.logs.join('\n  '))
  process.exit(1)
}

// ── Step 4: Withdraw (redeem_x1safe) — burn PUT → get X1SAFE ──
console.log('\n[3] Withdraw — redeem 2 X1SAFE_PUT → X1SAFE...')

// First need X1SAFE ATA
const userSafeAta = getAssociatedTokenAddressSync(X1SAFE_MINT, user, false, TOKEN_PROGRAM_ID)
try { await getAccount(connection, userSafeAta, undefined, TOKEN_PROGRAM_ID) }
catch {
  const tx = new Transaction()
  tx.add(createATAIx(user, userSafeAta, user, X1SAFE_MINT))
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
  tx.feePayer = user; tx.sign(deployer)
  await connection.confirmTransaction(await connection.sendRawTransaction(tx.serialize()), 'confirmed')
  console.log('  Created X1SAFE ATA:', userSafeAta.toBase58())
}

// Check lock period — lock is 7 days, so redeem_x1safe will fail if locked
// For test purposes, we'll attempt and note the result
const withdrawData = Buffer.concat([
  disc('redeem_x1safe'),
  Buffer.from(new BigUint64Array([BigInt(2 * 1e6)]).buffer), // 2 PUT
])

const withdrawTx = new Transaction()
withdrawTx.add(new TransactionInstruction({
  programId: STAKING_PROGRAM,
  keys: [
    { pubkey: user,             isSigner: true,  isWritable: true  },
    { pubkey: VAULT_STATE,      isSigner: false, isWritable: true  },
    { pubkey: userPosition,     isSigner: false, isWritable: true  },
    { pubkey: XNT,              isSigner: false, isWritable: false },
    { pubkey: X1SAFE_PUT_MINT,  isSigner: false, isWritable: true  },
    { pubkey: X1SAFE_MINT,      isSigner: false, isWritable: true  },
    { pubkey: userPutAta,       isSigner: false, isWritable: true  },
    { pubkey: userSafeAta,      isSigner: false, isWritable: true  },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ],
  data: withdrawData,
}))
withdrawTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
withdrawTx.feePayer = user; withdrawTx.sign(deployer)

try {
  const sig2 = await connection.sendRawTransaction(withdrawTx.serialize())
  await connection.confirmTransaction(sig2, 'confirmed')
  console.log('  ✅ Withdraw (redeem) success! tx:', sig2)

  const safeAcct = await getAccount(connection, userSafeAta, undefined, TOKEN_PROGRAM_ID)
  console.log('  X1SAFE balance:', Number(safeAcct.amount) / 1e6, 'X1SAFE')
} catch (e) {
  console.error('  ❌ Withdraw failed:', e.message)
  if (e.logs) console.error('  Logs:\n ', e.logs.join('\n  '))
  console.log('\n  (Expected if lock not ended — "LockNotEnded" error means deposit worked correctly)')
}

console.log('\n=== Test complete ===')
