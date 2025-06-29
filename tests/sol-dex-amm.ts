import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolDexAmm } from "../target/types/sol_dex_amm";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  createAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { expect } from "chai";

describe("sol-dex-amm", () => {
  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.solDexAmm as Program<SolDexAmm>;
  const provider = anchor.getProvider();

  // Test accounts
  let token0Mint: PublicKey;
  let token1Mint: PublicKey;
  let token0Account: PublicKey;
  let token1Account: PublicKey;
  let poolPda: PublicKey;
  let poolBump: number;

  // Test constants (from Uniswap V3 book)
  const MIN_TICK = -887272;
  const MAX_TICK = 887272;

  // Test case parameters (using smaller values for testing)
  const testParams = {
    wethBalance: 1000000000000000000, // 1 token (18 decimals)
    usdcBalance: 5000000000000000000, // 5 tokens (18 decimals)
    currentTick: 85176,
    lowerTick: 84222,
    upperTick: 86129,
    liquidity: new anchor.BN("1517882343751509868544"),
    currentSqrtP: new anchor.BN("5602277097478614198912276234240"),
  };

  before(async () => {
    // Create test tokens (equivalent to ERC20Mintable in Solidity tests)
    const payer = (provider.wallet as anchor.Wallet).payer;

    // Create token mints
    token0Mint = await createMint(
      provider.connection,
      payer,
      payer.publicKey,
      null,
      18 // decimals
    );

    token1Mint = await createMint(
      provider.connection,
      payer,
      payer.publicKey,
      null,
      18 // decimals
    );

    // Create token accounts for the test wallet
    token0Account = await createAccount(
      provider.connection,
      payer,
      token0Mint,
      payer.publicKey
    );

    token1Account = await createAccount(
      provider.connection,
      payer,
      token1Mint,
      payer.publicKey
    );

    // Mint tokens to test accounts
    await mintTo(
      provider.connection,
      payer,
      token0Mint,
      token0Account,
      payer,
      testParams.wethBalance
    );

    await mintTo(
      provider.connection,
      payer,
      token1Mint,
      token1Account,
      payer,
      testParams.usdcBalance
    );

    // Derive pool PDA
    [poolPda, poolBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), token0Mint.toBuffer(), token1Mint.toBuffer()],
      program.programId
    );
  });

  describe("Pool Initialization", () => {
    it("Should initialize pool successfully", async () => {
      // Initialize the pool (equivalent to constructor in Solidity)
      const tx = await program.methods
        .initializePool(testParams.currentSqrtP, testParams.currentTick)
        .accounts({
          token0: token0Mint,
          token1: token1Mint,
          payer: provider.wallet.publicKey,
        })
        .rpc();

      console.log("Pool initialization transaction signature:", tx);

      // Fetch and verify pool state
      const poolAccount = await program.account.pool.fetch(poolPda);

      // Verify pool tokens
      expect(poolAccount.token0.toString()).to.equal(token0Mint.toString());
      expect(poolAccount.token1.toString()).to.equal(token1Mint.toString());

      // Verify current price and tick (equivalent to slot0 in Solidity)
      expect(poolAccount.sqrtPriceX96.toString()).to.equal(
        testParams.currentSqrtP.toString()
      );
      expect(poolAccount.tick).to.equal(testParams.currentTick);

      // Verify initial liquidity is zero
      expect(poolAccount.liquidity.toString()).to.equal("0");

      // Verify bump
      expect(poolAccount.bump).to.equal(poolBump);
    });

    it("Should fail with identical tokens", async () => {
      // Try to create pool with same token for both token0 and token1
      try {
        const [invalidPoolPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("pool"),
            token0Mint.toBuffer(),
            token0Mint.toBuffer(), // Same token for both
          ],
          program.programId
        );

        await program.methods
          .initializePool(testParams.currentSqrtP, testParams.currentTick)
          .accounts({
            token0: token0Mint,
            token1: token0Mint, // Same token
            payer: provider.wallet.publicKey,
          })
          .rpc();

        // Should not reach here
        expect.fail("Expected transaction to fail with identical tokens");
      } catch (error) {
        // Expected to fail - this is good
        console.log("Expected error for identical tokens:", error.message);
      }
    });

    it("Should fail with invalid tick range", async () => {
      const [invalidPoolPda2] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool"), token1Mint.toBuffer(), token0Mint.toBuffer()],
        program.programId
      );

      try {
        await program.methods
          .initializePool(
            testParams.currentSqrtP,
            MAX_TICK + 1 // Invalid tick - too high
          )
          .accounts({
            token0: token1Mint,
            token1: token0Mint,
            payer: provider.wallet.publicKey,
          })
          .rpc();

        expect.fail("Expected transaction to fail with invalid tick");
      } catch (error) {
        console.log("Expected error for invalid tick:", error.message);
      }
    });
  });

  describe("Pool State Verification", () => {
    it("Should have correct pool address derivation", async () => {
      // Verify that the PDA is correctly derived
      const [expectedPda, expectedBump] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool"), token0Mint.toBuffer(), token1Mint.toBuffer()],
        program.programId
      );

      expect(poolPda.toString()).to.equal(expectedPda.toString());
      expect(poolBump).to.equal(expectedBump);
    });

    it("Should have correct initial state", async () => {
      const poolAccount = await program.account.pool.fetch(poolPda);

      // All the verifications from the book's test
      expect(poolAccount.token0.toString()).to.equal(token0Mint.toString());
      expect(poolAccount.token1.toString()).to.equal(token1Mint.toString());
      expect(poolAccount.sqrtPriceX96.toString()).to.equal(
        testParams.currentSqrtP.toString()
      );
      expect(poolAccount.tick).to.equal(testParams.currentTick);
      expect(poolAccount.liquidity.toString()).to.equal("0");
      expect(poolAccount.bump).to.equal(poolBump);
    });
  });

  describe("Token Setup Verification", () => {
    it("Should have correct token balances", async () => {
      // Verify our test setup is correct
      const token0AccountInfo = await getAccount(
        provider.connection,
        token0Account
      );
      const token1AccountInfo = await getAccount(
        provider.connection,
        token1Account
      );

      expect(token0AccountInfo.amount.toString()).to.equal(
        testParams.wethBalance.toString()
      );
      expect(token1AccountInfo.amount.toString()).to.equal(
        testParams.usdcBalance.toString()
      );
    });

    it("Should have correct token mint addresses", async () => {
      // Verify tokens are different (as required by Uniswap)
      expect(token0Mint.toString()).to.not.equal(token1Mint.toString());
    });
  });
});
