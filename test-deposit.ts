import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey, Connection, Keypair, SystemProgram } from "@solana/web3.js";
import fs from "fs";
import path from "path";

// Load IDL
const idlPath = path.resolve("./target/idl/x1safu.json");
const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

// X1 Testnet connection
const connection = new Connection("https://rpc.testnet.x1.xyz", "confirmed");
const programId = new PublicKey("F2JnWVnjP1h6WG7KKUHqhp23etEJ4amdJquAcE9ecCoe");

// Load wallet from id.json
const walletKeypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync("/home/jack/.config/solana/id.json", "utf-8")))
);

const wallet = new anchor.Wallet(walletKeypair);
const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
anchor.setProvider(provider);

const program = new Program(idl as any, provider);

async function testDeposit() {
  console.log("🧪 Testing X1SAFE Deposit on X1 Testnet");
  console.log("=========================================");
  console.log("Wallet:", wallet.publicKey.toBase58());
  console.log("Program:", programId.toBase58());
  
  // Find vault PDA
  const [vaultKey] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault")],
    programId
  );
  console.log("\nVault PDA:", vaultKey.toBase58());
  
  // Check if vault exists
  const vaultAccount = await connection.getAccountInfo(vaultKey);
  if (vaultAccount) {
    console.log("\n📦 Vault account exists");
    console.log("  - Data length:", vaultAccount.data.length, "bytes");
    console.log("  - Owner:", vaultAccount.owner.toBase58());
    
    if (vaultAccount.data.length !== 978) {
      console.log("\n⚠️  WARNING: Vault data size (", vaultAccount.data.length, ") != Expected (978)");
      console.log("   Vault was created with old program version.");
      console.log("   Need to reinitialize with new structure.");
      
      // Check if wallet is upgrade authority
      console.log("\n🔑 Checking if we can reinitialize...");
      console.log("   Wallet:", wallet.publicKey.toBase58());
    }
  }
  
  // Try to fetch parsed data anyway
  try {
    const vault = await (program.account as any).vaultState.fetch(vaultKey);
    console.log("\n✅ Vault state fetch successful!");
    console.log("   User Wallet:", vault.userWallet?.toBase58());
    console.log("   Treasury:", vault.treasury?.toBase58());
    console.log("   Total TVL:", vault.totalTvlUsd?.toString());
  } catch (e: any) {
    console.log("\n❌ Fetch failed (expected):", e.message.slice(0, 100));
    
    // Check raw account
    const rawAccount = await connection.getAccountInfo(vaultKey);
    if (rawAccount) {
      console.log("\n📊 Raw account data:");
      console.log("   Size:", rawAccount.data.length, "bytes");
      console.log("   First 16 bytes:", rawAccount.data.slice(0, 16).toString('hex'));
    }
  }
}

testDeposit().catch(console.error);
