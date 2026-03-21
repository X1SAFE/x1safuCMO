import { Connection, PublicKey, Keypair, Transaction, TransactionInstruction, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, getAccount, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { readFileSync } from 'fs'
import { sha256 } from '@noble/hashes/sha256'

const RPC = 'https://rpc.testnet.x1.xyz'
const connection = new Connection(RPC, 'confirmed')

const keypair = Keypair.fromSecretKey(
  Buffer.from(JSON.parse(readFileSync('/home/jack/.config/solana/x1safe-deployer.json', 'utf8')))
)

const PROGRAM_ID       = new PublicKey('8s8JbaAtWtCKSyPfAxEN2vJLJFc3kWokxXxgCRvtHq9u')
const VAULT_STATE      = new PublicKey('Cp4SrtaPCmhZhEHWPyeoirrr4uY17Qgvtj1V1gYofcDM')
const X1SAFE_MINT      = new PublicKey('75HZTezD1w2XBeoGJJzQxekayojEXeTgvJks8zWXWtda')
const X1SAFE_PUT_MINT  = new PublicKey('2J1JrRSyj2j93toj4k89buNKN2Z9sFXUmfAWZXWow5VA')
const XNT_MINT         = new PublicKey('CDREeqfWSxQvPa9ofxVrHFP5VZeF2xSc2EtAdXmNumuW')

function disc(name) {
  return Buffer.from(sha256(new TextEncoder().encode('global:' + name))).subarray(0, 8)
}

const USER_POSITION_SEED = Buffer.from('user_position')
function getUserPositionPDA(user, mint) {
  return PublicKey.findProgramAddressSync([USER_POSITION_SEED, user.toBuffer(), mint.toBuffer()], PROGRAM_ID)[0]
}

async function main() {
  const user = keypair.publicKey
  console.log('=== Withdraw Debug ===')
  console.log('User:', user.toBase58())

  const userPutAta  = getAssociatedTokenAddressSync(X1SAFE_PUT_MINT, user, false, TOKEN_PROGRAM_ID)
  const userSafeAta = getAssociatedTokenAddressSync(X1SAFE_MINT, user, false, TOKEN_PROGRAM_ID)
  const userPosition = getUserPositionPDA(user, XNT_MINT)

  // Check all accounts
  const [putBal, safeBal, posInfo] = await Promise.all([
    connection.getTokenAccountBalance(userPutAta).catch(() => null),
    connection.getTokenAccountBalance(userSafeAta).catch(() => null),
    connection.getAccountInfo(userPosition),
  ])

  console.log('\n[Balances]')
  console.log('PUT balance:', putBal?.value.uiAmount ?? 'ATA not found')
  console.log('X1SAFE balance:', safeBal?.value.uiAmount ?? 'ATA not found')
  console.log('user_position exists:', !!posInfo)

  if (!putBal || putBal.value.uiAmount === 0) {
    console.log('\n⚠️  No PUT to withdraw. Depositing 5 XNT first...')
    // deposit 5 XNT
    const XNT_ATA = getAssociatedTokenAddressSync(XNT_MINT, user, false, TOKEN_PROGRAM_ID)
    const xntBal = await connection.getTokenAccountBalance(XNT_ATA).catch(() => null)
    console.log('XNT balance:', xntBal?.value.uiAmount ?? 'no ATA')

    if (!xntBal || xntBal.value.uiAmount < 5) {
      console.log('❌ Not enough XNT for deposit test. Run test_deposit_withdraw.mjs first.')
      return
    }
    // deposit instruction
    const depData = Buffer.concat([
      disc('deposit'),
      (() => { const b = Buffer.allocUnsafe(8); b.writeBigUInt64LE(5_000_000n); return b })(), // 5 XNT (6 dec)
      (() => { const b = Buffer.allocUnsafe(8); b.writeBigUInt64LE(7n); return b })(),           // 7 days
    ])
    const XNTS_VAULT = PublicKey.findProgramAddressSync([Buffer.from('token_vault'), XNT_MINT.toBuffer()], PROGRAM_ID)[0]
    const depTx = new Transaction()
    depTx.add(new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: user,               isSigner: true,  isWritable: true  },
        { pubkey: VAULT_STATE,        isSigner: false, isWritable: true  },
        { pubkey: userPosition,       isSigner: false, isWritable: true  },
        { pubkey: XNT_MINT,           isSigner: false, isWritable: false },
        { pubkey: XNT_ATA,            isSigner: false, isWritable: true  },
        { pubkey: XNTS_VAULT,         isSigner: false, isWritable: true  },
        { pubkey: X1SAFE_PUT_MINT,    isSigner: false, isWritable: true  },
        { pubkey: userPutAta,         isSigner: false, isWritable: true  },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID,   isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      data: depData,
    }))
    depTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
    depTx.feePayer = user
    depTx.sign(keypair)
    const ds = await connection.sendRawTransaction(depTx.serialize())
    await connection.confirmTransaction(ds, 'confirmed')
    console.log('  Deposit tx:', ds)
    const newPut = await connection.getTokenAccountBalance(userPutAta)
    console.log('  New PUT balance:', newPut.value.uiAmount)
  }

  // Now attempt withdraw of 1 PUT
  const currentPut = await connection.getTokenAccountBalance(userPutAta)
  const withdrawAmt = 1_000_000n // 1 PUT
  console.log('\n[Withdraw test] Redeem 1 PUT → 1 X1SAFE')
  console.log('Current PUT:', currentPut.value.uiAmount)

  const data = Buffer.concat([
    disc('redeem_x1safe'),
    (() => { const b = Buffer.allocUnsafe(8); b.writeBigUInt64LE(withdrawAmt); return b })(),
  ])

  const tx = new Transaction()

  // Ensure X1SAFE ATA
  const safeInfo = await connection.getAccountInfo(userSafeAta)
  if (!safeInfo) {
    console.log('  Creating X1SAFE ATA...')
    tx.add(new TransactionInstruction({
      programId: ASSOCIATED_TOKEN_PROGRAM_ID,
      keys: [
        { pubkey: user,                    isSigner: true,  isWritable: true  },
        { pubkey: userSafeAta,             isSigner: false, isWritable: true  },
        { pubkey: user,                    isSigner: false, isWritable: false },
        { pubkey: X1SAFE_MINT,             isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID,        isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY,      isSigner: false, isWritable: false },
      ],
      data: Buffer.from([0]),
    }))
  }

  tx.add(new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: user,            isSigner: true,  isWritable: true  }, // user
      { pubkey: VAULT_STATE,     isSigner: false, isWritable: true  }, // vault_state
      { pubkey: userPosition,    isSigner: false, isWritable: true  }, // user_position
      { pubkey: XNT_MINT,        isSigner: false, isWritable: false }, // token_mint
      { pubkey: X1SAFE_PUT_MINT, isSigner: false, isWritable: true  }, // x1safe_put_mint
      { pubkey: X1SAFE_MINT,     isSigner: false, isWritable: true  }, // x1safe_mint
      { pubkey: userPutAta,      isSigner: false, isWritable: true  }, // user_put_account
      { pubkey: userSafeAta,     isSigner: false, isWritable: true  }, // user_x1safe_account
      { pubkey: TOKEN_PROGRAM_ID,isSigner: false, isWritable: false },
    ],
    data,
  }))

  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
  tx.feePayer = user
  tx.sign(keypair)

  try {
    const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false })
    await connection.confirmTransaction(sig, 'confirmed')
    console.log('  ✅ Withdraw success! tx:', sig)
    const after = await connection.getTokenAccountBalance(userSafeAta)
    console.log('  X1SAFE balance after:', after.value.uiAmount)
  } catch (e) {
    console.log('  ❌ Error:', e.message)
    // Get simulation logs
    try {
      const sim = await connection.simulateTransaction(tx)
      console.log('\n  Simulation logs:')
      sim.value.logs?.forEach(l => console.log(' ', l))
      if (sim.value.err) console.log('  Sim error:', JSON.stringify(sim.value.err))
    } catch (se) {
      console.log('  Sim error:', se.message)
    }
  }
}

main()
