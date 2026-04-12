const {
  Connection, Transaction, PublicKey, Keypair,
  TransactionInstruction, SystemProgram, SYSVAR_RENT_PUBKEY
} = require('@solana/web3.js')
const {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID
} = require('@solana/spl-token')
const fs = require('fs')

const RPC = 'https://rpc.testnet.x1.xyz'
const PROGRAM_ID = new PublicKey('8s8JbaAtWtCKSyPfAxEN2vJLJFc3kWokxXxgCRvtHq9u')
const XNT_MINT   = new PublicKey('CDREeqfWSxQvPa9ofxVrHFP5VZeF2xSc2EtAdXmNumuW')
const USDCX_MINT = new PublicKey('6QNPqoF6GGhCFjTTQGxkpJkrH5ueS85b5RpX3GXdUSVw')

// PDAs
const [VAULT]     = PublicKey.findProgramAddressSync([Buffer.from('vault')], PROGRAM_ID)
const [PUT_MINT]  = PublicKey.findProgramAddressSync([Buffer.from('put_mint')], PROGRAM_ID)
const [SAFE_MINT] = PublicKey.findProgramAddressSync([Buffer.from('safe_mint')], PROGRAM_ID)
const [XNT_ASSET] = PublicKey.findProgramAddressSync([Buffer.from('asset'), XNT_MINT.toBuffer()], PROGRAM_ID)
const [USDCX_ASSET] = PublicKey.findProgramAddressSync([Buffer.from('asset'), USDCX_MINT.toBuffer()], PROGRAM_ID)

// IDL discriminators
const DISC = {
  initialize:  Buffer.from([175,175,109,31,13,152,155,237]),
  create_mints: Buffer.from([71,106,121,68,208,125,224,200]),
  add_asset:   Buffer.from([81,53,134,142,243,73,42,179]),
}

function encodeAddAssetArgs(decimals, isFixedPrice, priceUsd) {
  const buf = Buffer.allocUnsafe(8 + 1 + 1 + 8)
  buf.set(DISC.add_asset, 0)
  buf.writeUInt8(decimals, 8)
  buf.writeUInt8(isFixedPrice ? 1 : 0, 9)
  buf.writeBigUInt64LE(BigInt(priceUsd), 10)
  return buf
}

async function main() {
  const conn = new Connection(RPC, 'confirmed')
  const rawKey = JSON.parse(fs.readFileSync('/home/jack/.config/solana/x1safe-deployer.json'))
  const authority = Keypair.fromSecretKey(Buffer.from(rawKey))
  console.log('Authority:', authority.publicKey.toBase58())
  console.log('Vault PDA:', VAULT.toBase58())
  console.log('PUT mint: ', PUT_MINT.toBase58())

  // Check vault
  const vaultInfo = await conn.getAccountInfo(VAULT)
  
  const tx = new Transaction()
  let needsSend = false

  // 1. Initialize vault
  if (!vaultInfo) {
    console.log('→ Adding initialize()')
    tx.add(new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: authority.publicKey, isSigner: true, isWritable: true },
        { pubkey: VAULT, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: DISC.initialize,
    }))
    needsSend = true
  } else {
    console.log('✅ Vault already initialized')
  }

  if (needsSend) {
    tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash
    tx.feePayer = authority.publicKey
    tx.sign(authority)
    const sig = await conn.sendRawTransaction(tx.serialize())
    await conn.confirmTransaction(sig, 'confirmed')
    console.log('✅ initialize tx:', sig)
    needsSend = false
    tx.instructions = []
  }

  // 2. Create mints
  const putMintInfo = await conn.getAccountInfo(PUT_MINT)
  if (!putMintInfo) {
    console.log('→ Adding create_mints()')
    const tx2 = new Transaction()
    tx2.add(new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: authority.publicKey, isSigner: true, isWritable: true },
        { pubkey: VAULT, isSigner: false, isWritable: true },
        { pubkey: PUT_MINT, isSigner: false, isWritable: true },
        { pubkey: SAFE_MINT, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      data: DISC.create_mints,
    }))
    tx2.recentBlockhash = (await conn.getLatestBlockhash()).blockhash
    tx2.feePayer = authority.publicKey
    tx2.sign(authority)
    const sig2 = await conn.sendRawTransaction(tx2.serialize())
    await conn.confirmTransaction(sig2, 'confirmed')
    console.log('✅ create_mints tx:', sig2)
  } else {
    console.log('✅ PUT mint already exists')
  }

  // 3. Add XNT asset (price $0.35 = 350_000 micro-USD, decimals=9, not fixed)
  const xntAssetInfo = await conn.getAccountInfo(XNT_ASSET)
  if (!xntAssetInfo) {
    console.log('→ Adding add_asset(XNT)')
    const tx3 = new Transaction()
    tx3.add(new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: authority.publicKey, isSigner: true, isWritable: true },
        { pubkey: VAULT, isSigner: false, isWritable: false },
        { pubkey: XNT_MINT, isSigner: false, isWritable: false },
        { pubkey: XNT_ASSET, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: encodeAddAssetArgs(9, false, 350000),
    }))
    tx3.recentBlockhash = (await conn.getLatestBlockhash()).blockhash
    tx3.feePayer = authority.publicKey
    tx3.sign(authority)
    const sig3 = await conn.sendRawTransaction(tx3.serialize())
    await conn.confirmTransaction(sig3, 'confirmed')
    console.log('✅ add_asset(XNT) tx:', sig3)
  } else {
    console.log('✅ XNT asset already configured')
  }

  // 4. Add USDCX asset (price $1.00 = 1_000_000 micro-USD, decimals=6, fixed)
  const usdcxAssetInfo = await conn.getAccountInfo(USDCX_ASSET)
  if (!usdcxAssetInfo) {
    console.log('→ Adding add_asset(USDCX)')
    const tx4 = new Transaction()
    tx4.add(new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: authority.publicKey, isSigner: true, isWritable: true },
        { pubkey: VAULT, isSigner: false, isWritable: false },
        { pubkey: USDCX_MINT, isSigner: false, isWritable: false },
        { pubkey: USDCX_ASSET, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: encodeAddAssetArgs(6, true, 1000000),
    }))
    tx4.recentBlockhash = (await conn.getLatestBlockhash()).blockhash
    tx4.feePayer = authority.publicKey
    tx4.sign(authority)
    const sig4 = await conn.sendRawTransaction(tx4.serialize())
    await conn.confirmTransaction(sig4, 'confirmed')
    console.log('✅ add_asset(USDCX) tx:', sig4)
  } else {
    console.log('✅ USDCX asset already configured')
  }

  // 5. Create reserve ATAs (vault authority = VAULT PDA)
  for (const [label, mint] of [['XNT', XNT_MINT], ['USDCX', USDCX_MINT]]) {
    const reserveAta = getAssociatedTokenAddressSync(mint, VAULT, true, TOKEN_PROGRAM_ID)
    console.log(`${label} reserve ATA: ${reserveAta.toBase58()}`)
    const reserveInfo = await conn.getAccountInfo(reserveAta)
    if (!reserveInfo) {
      console.log(`→ Creating ${label} reserve ATA`)
      const tx5 = new Transaction()
      tx5.add(createAssociatedTokenAccountInstruction(
        authority.publicKey, reserveAta, VAULT, mint, TOKEN_PROGRAM_ID
      ))
      tx5.recentBlockhash = (await conn.getLatestBlockhash()).blockhash
      tx5.feePayer = authority.publicKey
      tx5.sign(authority)
      const sig5 = await conn.sendRawTransaction(tx5.serialize())
      await conn.confirmTransaction(sig5, 'confirmed')
      console.log(`✅ ${label} reserve ATA created:`, sig5)
    } else {
      console.log(`✅ ${label} reserve ATA exists`)
    }
  }

  console.log('\n=== SETUP COMPLETE ===')
  console.log('Vault:      ', VAULT.toBase58())
  console.log('PUT Mint:   ', PUT_MINT.toBase58())
  console.log('XNT Asset:  ', XNT_ASSET.toBase58())
  console.log('USDCX Asset:', USDCX_ASSET.toBase58())
  const xntReserve = getAssociatedTokenAddressSync(XNT_MINT, VAULT, true, TOKEN_PROGRAM_ID)
  const usdcxReserve = getAssociatedTokenAddressSync(USDCX_MINT, VAULT, true, TOKEN_PROGRAM_ID)
  console.log('XNT Reserve ATA:  ', xntReserve.toBase58())
  console.log('USDCX Reserve ATA:', usdcxReserve.toBase58())
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
