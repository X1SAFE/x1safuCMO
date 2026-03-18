import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";

const connection = new Connection("https://rpc.testnet.x1.xyz", "confirmed");
const CMO = new PublicKey("Dfkb27UjkYuJfJD8GkZSHhKXkBqsMBQMC2Y1TdDpxE1J");
const XNT_MINT = new PublicKey("CDREeqfWSxQvPa9ofxVrHFP5VZeF2xSc2EtAdXmNumuW");
const PROGRAM_ID = new PublicKey("F2JnWVnjP1h6WG7KKUHqhp23etEJ4amdJquAcE9ecCoe");

const ata = getAssociatedTokenAddressSync(XNT_MINT, CMO, false, TOKEN_PROGRAM_ID);
const sigs = await connection.getSignaturesForAddress(ata, { limit: 20 });

// Focus on the 3 "reward" txs
const targets = [
  "nuMCZ1eD8DooRVnKBeeahri7RbG7",
  "5zu6rzFZDybgv9wr5D8pskakJE58",
  "2MNSeVmud6sRS2Txge6tzgsuZmRu",
  "3ZdQtZB26ciRQeKRRCbMJftmLCxY",
  "4K7jm5Hh9KZS2UTSPhtcjvED1BUA",
];

for (const s of sigs) {
  const short = s.signature.slice(0, 28);
  if (!targets.some(t => s.signature.startsWith(t))) continue;

  const tx = await connection.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0 });
  if (!tx) continue;

  console.log(`\n=== TX: ${s.signature.slice(0,40)}... ===`);
  console.log("Time:", new Date((s.blockTime||0)*1000).toISOString());

  // All instructions including inner
  const ixs = tx.transaction.message.instructions as any[];
  console.log("Top-level instructions:");
  for (const ix of ixs) {
    if (ix.parsed?.type) {
      console.log(`  [${ix.parsed.type}]`, JSON.stringify(ix.parsed.info || {}).slice(0,120));
    } else if (ix.programId) {
      console.log(`  [raw program] ${ix.programId}`);
    }
  }

  const inner = tx.meta?.innerInstructions || [];
  if (inner.length > 0) {
    console.log("Inner instructions:");
    for (const group of inner) {
      for (const ix of group.instructions as any[]) {
        if (ix.parsed?.type) {
          console.log(`  [${ix.parsed.type}]`, JSON.stringify(ix.parsed.info || {}).slice(0,150));
        }
      }
    }
  }

  // All token balance changes
  console.log("Token balance changes:");
  const pre  = tx.meta?.preTokenBalances  || [];
  const post = tx.meta?.postTokenBalances || [];
  const allOwners = new Set([...pre, ...post].map((b:any) => b.owner));
  for (const owner of allOwners) {
    const preB  = (pre  as any[]).find(b => b.owner === owner && b.mint === XNT_MINT.toBase58());
    const postB = (post as any[]).find(b => b.owner === owner && b.mint === XNT_MINT.toBase58());
    const pAmt  = preB?.uiTokenAmount?.uiAmount  || 0;
    const qAmt  = postB?.uiTokenAmount?.uiAmount || 0;
    const d     = qAmt - pAmt;
    if (d !== 0) console.log(`  ${owner.slice(0,20)}... : ${d > 0 ? '+' : ''}${d.toFixed(6)} XNT`);
  }
}
