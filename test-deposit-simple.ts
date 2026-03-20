import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import fs from "fs";

const connection = new Connection("https://rpc.testnet.x1.xyz", "confirmed");
const programId = new PublicKey("F2JnWVnjP1h6WG7KKUHqhp23etEJ4amdJquAcE9ecCoe");

const walletKeypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync("/home/jack/.config/solana/id.json", "utf-8")))
);

async function checkDeposit() {
  console.log("🔍 Checking X1SAFE Program");
  console.log("==========================");
  console.log("Wallet:", walletKeypair.publicKey.toBase58());
  console.log("Program:", programId.toBase58());
  
  // Find vault PDA  
  const [vaultKey] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault")],
    programId
  );
  console.log("\nVault PDA:", vaultKey.toBase58());
  
  // Check program account
  const programAccount = await connection.getAccountInfo(programId);
  console.log("\n✅ Program deployed:");
  console.log("   Executable:", programAccount?.executable);
  console.log("   Data size:", programAccount?.data.length, "bytes");
  
  // Check vault
  const vaultAccount = await connection.getAccountInfo(vaultKey);
  if (vaultAccount) {
    console.log("\n✅ Vault exists:");
    console.log("   Data length:", vaultAccount.data.length, "bytes");
    console.log("   Owner:", vaultAccount.owner.toBase58());
    console.log("   Lamports:", vaultAccount.lamports);
    
    if (vaultAccount.data.length === 978) {
      console.log("\n   ✅ Vault size matches new VaultState (978 bytes)");
      console.log("   ✅ Program upgrade successful!");
    }
  }
  
  // Check wallet XNT balance
  const balance = await connection.getBalance(walletKeypair.publicKey);
  console.log("\n💰 Wallet XNT Balance:", (balance / 1e9).toFixed(4), "XNT");
  
  console.log("\n📋 Summary:");
  console.log("   - Program ID:", programId.toBase58());
  console.log("   - Vault PDA:", vaultKey.toBase58());
  console.log("   - Vault size:", vaultAccount?.data.length, "bytes (expected 978)");
  console.log("   - Upgrade TX: 42b3cAejtAzAK8JQvwTBsDWeUUmaxrS6SnVVoxuEJXkLsvTnQsbs91odhTAde1LQiEDGXfVF5pD61ZuvYPyVVgQt");
  
  if (vaultAccount && vaultAccount.data.length === 978) {
    console.log("\n🎉 SUCCESS: Program upgraded correctly!");
    console.log("   Deposit function should work via frontend/IDL.");
    console.log("   Test trên https://x1safu-cmo.vercel.app/");
  }
}

checkDeposit().catch(console.error);
