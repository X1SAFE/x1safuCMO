import { Connection, PublicKey } from "@solana/web3.js";

const connection = new Connection("https://rpc.testnet.x1.xyz", "confirmed");
const UNKNOWN_MINT = new PublicKey("A7Aqrmvxxqi9u3tE3Qb8HFnjZWHYpQweBkJsC2GjYGRH");
const CMO = new PublicKey("Dfkb27UjkYuJfJD8GkZSHhKXkBqsMBQMC2Y1TdDpxE1J");

// Find all token accounts for CMO
const accounts = await connection.getParsedTokenAccountsByOwner(CMO, { programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") });
console.log("All token accounts for CMO:");
for (const acc of accounts.value) {
  const info = acc.account.data.parsed.info;
  console.log(`  mint: ${info.mint}`);
  console.log(`  balance: ${info.tokenAmount.uiAmountString}`);
  console.log(`  ATA: ${acc.pubkey.toBase58()}`);
  console.log();
}

// Also check the CdQ7 account (burn source)
const burnSrc = new PublicKey("CdQ7EGuMJigGxK7LhoRcgn3yQS3GhE6ni6zEa2GXeGPy");
const burnInfo = await connection.getParsedAccountInfo(burnSrc);
console.log("Burn source account:", JSON.stringify((burnInfo.value?.data as any)?.parsed || {}, null, 2).slice(0,400));
