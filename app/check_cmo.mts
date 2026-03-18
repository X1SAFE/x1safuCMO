import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";

const connection = new Connection("https://rpc.testnet.x1.xyz", "confirmed");
const CMO = new PublicKey("Dfkb27UjkYuJfJD8GkZSHhKXkBqsMBQMC2Y1TdDpxE1J");
const XNT_MINT = new PublicKey("CDREeqfWSxQvPa9ofxVrHFP5VZeF2xSc2EtAdXmNumuW");

const xntAccounts = await connection.getParsedTokenAccountsByOwner(CMO, { mint: XNT_MINT });
let totalXNT = 0;
for (const acc of xntAccounts.value) {
  const info = acc.account.data.parsed.info;
  totalXNT += info.tokenAmount.uiAmount || 0;
  console.log("ATA:", acc.pubkey.toBase58());
  console.log("Balance:", info.tokenAmount.uiAmountString, "XNT");
}
console.log("TOTAL XNT:", totalXNT);

const ata = getAssociatedTokenAddressSync(XNT_MINT, CMO, false, TOKEN_PROGRAM_ID);
console.log("\nXNT ATA:", ata.toBase58());
const sigs = await connection.getSignaturesForAddress(ata, { limit: 20 });
console.log("TX count:", sigs.length);

for (const s of sigs) {
  const tx = await connection.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0 });
  if (!tx) continue;

  const time = s.blockTime ? new Date(s.blockTime * 1000).toISOString() : "unknown";
  const pre  = tx.meta?.preTokenBalances  || [];
  const post = tx.meta?.postTokenBalances || [];

  const preBal  = pre.find((b: any) => b.mint === XNT_MINT.toBase58() && b.owner === CMO.toBase58());
  const postBal = post.find((b: any) => b.mint === XNT_MINT.toBase58() && b.owner === CMO.toBase58());

  const preAmt  = (preBal as any)?.uiTokenAmount?.uiAmount  || 0;
  const postAmt = (postBal as any)?.uiTokenAmount?.uiAmount || 0;
  const delta   = postAmt - preAmt;

  const signers = tx.transaction.message.accountKeys
    .filter((k: any) => k.signer)
    .map((k: any) => k.pubkey.toBase58());

  const deltaStr = delta >= 0 ? `+${delta}` : `${delta}`;
  console.log(`\n[${time}] TX: ${s.signature.slice(0,28)}...`);
  console.log(`  XNT: ${deltaStr} (${preAmt} → ${postAmt})`);
  console.log(`  Signers: ${signers.join(", ")}`);

  const ixs = tx.transaction.message.instructions || [];
  for (const ix of ixs as any[]) {
    if (ix.parsed?.type) {
      const info = ix.parsed.info || {};
      console.log(`  IX: ${ix.parsed.type} | amount=${info.amount||""} authority=${(info.mintAuthority||info.authority||"").slice(0,20)}`);
    }
  }
}
