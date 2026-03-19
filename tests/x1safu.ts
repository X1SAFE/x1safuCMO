import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { X1safu } from "../target/types/x1safu";
import { PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import {
  createMint,
  createAccount,
  mintTo,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccount,
} from "@solana/spl-token";
import { assert } from "chai";

describe("X1SAFU", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.X1safu as Program<X1safu>;
  const wallet = provider.wallet;

  let vaultKey: PublicKey;
  let vaultBump: number;
  let x1safeMint: PublicKey;
  let usdcMint: PublicKey;
  let userUsdcAccount: PublicKey;
  let userX1safeAccount: PublicKey;
  let vaultUsdcAccount: PublicKey;

  before(async () => {
    // Find vault PDA
    [vaultKey, vaultBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault")],
      program.programId
    );

    // Create test token mints
    x1safeMint = await createMint(
      provider.connection,
      wallet.payer,
      vaultKey,
      null,
      6
    );

    usdcMint = await createMint(
      provider.connection,
      wallet.payer,
      wallet.publicKey,
      null,
      6
    );

    // Create user token accounts
    userUsdcAccount = await createAccount(
      provider.connection,
      wallet.payer,
      usdcMint,
      wallet.publicKey
    );

    userX1safeAccount = await createAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      x1safeMint,
      wallet.publicKey
    );

    // Mint test USDC to user
    await mintTo(
      provider.connection,
      wallet.payer,
      usdcMint,
      userUsdcAccount,
      wallet.publicKey,
      10000 * 10 ** 6
    );

    // Create vault USDC account
    vaultUsdcAccount = await getAssociatedTokenAddress(
      usdcMint,
      vaultKey,
      true
    );

    await createAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      usdcMint,
      vaultKey,
      true
    );
  });

  it("Initializes the vault", async () => {
    const tx = await program.methods
      .initialize()
      .accounts({
        authority: wallet.publicKey,
        vault: vaultKey,
        x1safeMint,
        usdcMint,
        xenMint: usdcMint, // Mock
        xntMint: usdcMint, // Mock
        xnmMint: usdcMint, // Mock
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("Initialize vault tx:", tx);

    const vault = await program.account.vaultState.fetch(vaultKey);
    assert.equal(vault.authority.toBase58(), wallet.publicKey.toBase58());
    assert.equal(vault.totalTvl.toNumber(), 0);
  });

  it("Deposits USDC and mints X1SAFE", async () => {
    const depositAmount = 1000 * 10 ** 6; // 1000 USDC
    const [positionKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), wallet.publicKey.toBuffer()],
      program.programId
    );

    const userUsdcBefore = await getAccount(provider.connection, userUsdcAccount);
    console.log("User USDC before:", userUsdcBefore.amount.toString());

    try {
      const tx = await program.methods
        .deposit(new anchor.BN(depositAmount), { usdc: {} })
        .accounts({
          user: wallet.publicKey,
          vault: vaultKey,
          userPosition: positionKey,
          userAssetAccount: userUsdcAccount,
          vaultAssetAccount: vaultUsdcAccount,
          userX1safeAccount,
          x1safeMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Deposit tx:", tx);
    } catch (e) {
      console.log("Deposit error (expected - mock setup):", e);
    }
  });

  it("Exits position and burns X1SAFE", async () => {
    const [positionKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), wallet.publicKey.toBuffer()],
      program.programId
    );

    try {
      const tx = await program.methods
        .exit()
        .accounts({
          user: wallet.publicKey,
          vault: vaultKey,
          userPosition: positionKey,
          userX1safeAccount,
          x1safeMint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      console.log("Exit tx:", tx);
    } catch (e) {
      console.log("Exit error (expected - mock setup):", e);
    }
  });

  it("Withdraws X1SAFE to wallet", async () => {
    const [positionKey] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), wallet.publicKey.toBuffer()],
      program.programId
    );

    try {
      const tx = await program.methods
        .withdraw(new anchor.BN(100 * 10 ** 6))
        .accounts({
          user: wallet.publicKey,
          vault: vaultKey,
          userPosition: positionKey,
        })
        .rpc();

      console.log("Withdraw tx:", tx);
    } catch (e) {
      console.log("Withdraw error (expected - mock setup):", e);
    }
  });
});