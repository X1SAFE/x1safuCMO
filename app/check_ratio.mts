import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";

const connection = new Connection("https://rpc.testnet.x1.xyz", "confirmed");
const CMO = new PublicKey("Dfkb27UjkYuJfJD8GkZSHhKXkBqsMBQMC2Y1TdDpxE1J");
const XNT_MINT = new PublicKey("CDREeqfWSxQvPa9ofxVrHFP5VZeF2xSc2EtAdXmNumuW");

// The 3 "burn+redeem" TXs
const txids = [
  "nuMCZ1eD8DooRVnKBeeahri7RbG7XCFxDW7NUtF3jv5c2JWv15fH34oFGjY3tExJdotLjw2i42A59PZz4gWgvVeW",
  "5zu6rzFZDybgv9wr5D8pskakJE58DcWNJnwgSEkm33U8REGByZXkTPv2t8RyHC6TK6DQLBT7sFhifb4E2TdSVH7v",
  "2MNSeVmud6sRS2Txge6tzgsuZmRuySfyefZJ8Wfu8VLb8yvCnMzWt7Rps1Lqf6s9xCnKqNpqbMSqB56CgD4t6qJM",
  "3ZdQtZB26ciRQeKRRCbMJftmLCxY2AC7UzP5VBUV5XRJDbrQH6e9Wf1aTVANpyb7yRHtfD7LHxjB6HVjAGJJz5K9"
];

// Also check the deposit tx
const depositTx = "4K7jm5Hh9KZS2UTSPhtcjvED1BUAZqxjqKnSC4K8P9XLdPjAoxqzxvYvfvNq4dHWNXjbDFYhVNzm9kVkHXqj1sT";

console.log("=== DEPOSIT TX ===");
const dep = await connection.getParsedTransaction(depositTx, { maxSupportedTransactionVersion: 0 });
if (dep) {
  const inner = dep.meta?.innerInstructions || [];
  for (const g of inner) {
    for (const ix of g.instructions as any[]) {
      if (ix.parsed?.type) {
        console.log(`[${ix.parsed.type}]`, JSON.stringify(ix.parsed.info||{}).slice(0,200));
      }
    }
  }
  // All token changes
  const pre = dep.meta?.preTokenBalances || [];
  const post = dep.meta?.postTokenBalances || [];
  console.log("All token changes:");
  const seen = new Set<string>();
  for (const b of [...pre, ...post] as any[]) {
    const key = b.owner + b.mint;
    if (seen.has(key)) continue;
    seen.add(key);
    const p = (pre  as any[]).find(x => x.owner===b.owner && x.mint===b.mint);
    const q = (post as any[]).find(x => x.owner===b.owner && x.mint===b.mint);
    const pa = p?.uiTokenAmount?.uiAmount || 0;
    const qa = q?.uiTokenAmount?.uiAmount || 0;
    if (pa !== qa) console.log(`  mint=${b.mint.slice(0,16)}... owner=${b.owner.slice(0,16)}... : ${pa} → ${qa} (${qa-pa > 0 ? '+':''}${(qa-pa).toFixed(6)})`);
  }
}

console.log("\n=== BURN/REDEEM TXs ===");
const sigs = await connection.getSignaturesForAddress(
  getAssociatedTokenAddressSync(XNT_MINT, CMO, false, TOKEN_PROGRAM_ID),
  { limit: 20 }
);

for (const s of sigs) {
  if (!txids.some(t => s.signature.startsWith(t.slice(0,20)))) continue;
  const tx = await connection.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0 });
  if (!tx) continue;
  console.log(`\nTX: ${s.signature.slice(0,30)}... @ ${new Date((s.blockTime||0)*1000).toISOString()}`);

  const inner = tx.meta?.innerInstructions || [];
  let burnedAmount = 0;
  let burnedMint = '';
  let receivedXNT = 0;
  for (const g of inner) {
    for (const ix of g.instructions as any[]) {
      if (ix.parsed?.type === 'burn') {
        burnedAmount = parseInt(ix.parsed.info?.amount || '0');
        burnedMint = ix.parsed.info?.mint || '';
        console.log(`  BURN: ${burnedAmount} raw of mint ${burnedMint.slice(0,20)}...`);
      }
      if (ix.parsed?.type === 'transfer') {
        const amt = parseInt(ix.parsed.info?.amount || '0');
        const dst = ix.parsed.info?.destination || '';
        const ata = getAssociatedTokenAddressSync(XNT_MINT, CMO, false, TOKEN_PROGRAM_ID).toBase58();
        if (dst === ata) {
          receivedXNT = amt;
          console.log(`  TRANSFER to CMO: ${amt} raw XNT (= ${amt/1e9} XNT)`);
        }
      }
    }
  }
  if (burnedAmount && receivedXNT) {
    const ratio = receivedXNT / burnedAmount;
    console.log(`  RATIO: burned ${burnedAmount} → received ${receivedXNT} XNT raw | ratio=${ratio.toFixed(6)}`);
  }
}
