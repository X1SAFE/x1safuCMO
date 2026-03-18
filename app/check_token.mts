import { Connection, PublicKey } from "@solana/web3.js";

const connection = new Connection("https://rpc.testnet.x1.xyz", "confirmed");
const UNKNOWN_MINT = new PublicKey("A7Aqrmvxxqi9u3tE3Qb8HFnjZWHYpQweBkJsC2GjYGRH");

// Get mint info
const mintInfo = await connection.getParsedAccountInfo(UNKNOWN_MINT);
console.log("Mint info:", JSON.stringify((mintInfo.value?.data as any)?.parsed?.info || {}, null, 2));

// Check what program owns it
console.log("Owner program:", mintInfo.value?.owner?.toBase58());
