import { Connection, PublicKey } from '@solana/web3.js'

async function main() {
  const conn = new Connection('https://rpc.testnet.x1.xyz', 'confirmed')
  const prog = new PublicKey('F2JnWVnjP1h6WG7KKUHqhp23etEJ4amdJquAcE9ecCoe')
  const vault = PublicKey.findProgramAddressSync([Buffer.from('vault')], prog)[0]
  const put = PublicKey.findProgramAddressSync([Buffer.from('put_mint')], prog)[0]
  const safe = PublicKey.findProgramAddressSync([Buffer.from('safe_mint')], prog)[0]

  console.log('Program:', prog.toBase58())
  console.log('Vault:', vault.toBase58())
  console.log('PUT Mint:', put.toBase58())
  console.log('SAFE Mint:', safe.toBase58())

  const [vInfo, pInfo, sInfo] = await Promise.all([
    conn.getAccountInfo(vault),
    conn.getAccountInfo(put),
    conn.getAccountInfo(safe)
  ])

  console.log('\n=== On-chain Status ===')
  console.log('Vault exists:', !!vInfo, vInfo ? `(${vInfo.data.length} bytes)` : '')
  console.log('PUT Mint exists:', !!pInfo)
  console.log('SAFE Mint exists:', !!sInfo)

  if (vInfo) {
    const d = vInfo.data
    // Skip discriminator (8 bytes), then read user_wallet (32 bytes)
    const userWallet = new PublicKey(d.slice(8, 40))
    console.log('\nVault user_wallet (authority):', userWallet.toBase58())
  }

  if (!pInfo) {
    console.log('\n⚠️  PUT mint chưa được khởi tạo!')
    console.log('   Cần gọi create_mints từ authority wallet')
  }
}

main().catch(console.error)
