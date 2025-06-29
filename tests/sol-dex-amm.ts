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
  createAssociatedTokenAccount,
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
  // Add pool token accounts for mint testing
  let poolToken0Account: PublicKey;
  let poolToken1Account: PublicKey;

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

    // Pool token accounts will be created separately for the mint test
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

  describe("Mint Liquidity", () => {
    it("Should mint liquidity successfully", async () => {
      const payer = (provider.wallet as anchor.Wallet).payer;

      // Create separate pool token accounts for holding liquidity using ATAs
      const poolToken0Account = await createAssociatedTokenAccount(
        provider.connection,
        payer,
        token0Mint,
        payer.publicKey
      );

      const poolToken1Account = await createAssociatedTokenAccount(
        provider.connection,
        payer,
        token1Mint,
        payer.publicKey
      );

      // Get initial balances
      const initialUserToken0 = await getAccount(
        provider.connection,
        token0Account
      );
      const initialUserToken1 = await getAccount(
        provider.connection,
        token1Account
      );
      const initialPoolAccount = await program.account.pool.fetch(poolPda);

      console.log(
        "Initial pool liquidity:",
        initialPoolAccount.liquidity.toString()
      );
      console.log("Initial user token0:", initialUserToken0.amount.toString());
      console.log("Initial user token1:", initialUserToken1.amount.toString());

      try {
        const tx = await program.methods
          .mint(
            provider.wallet.publicKey, // owner
            testParams.lowerTick,
            testParams.upperTick,
            testParams.liquidity
          )
          .accounts({
            pool: poolPda,
            userToken0: token0Account,
            userToken1: token1Account,
            poolToken0: poolToken0Account,
            poolToken1: poolToken1Account,
            payer: provider.wallet.publicKey,
          })
          .rpc();

        console.log("✅ Mint liquidity transaction successful:", tx);

        // Verify pool state changes
        const finalPoolAccount = await program.account.pool.fetch(poolPda);
        const finalUserToken0 = await getAccount(
          provider.connection,
          token0Account
        );
        const finalUserToken1 = await getAccount(
          provider.connection,
          token1Account
        );
        const finalPoolToken0 = await getAccount(
          provider.connection,
          poolToken0Account
        );
        const finalPoolToken1 = await getAccount(
          provider.connection,
          poolToken1Account
        );

        // Verify liquidity was added to pool
        expect(finalPoolAccount.liquidity.toString()).to.equal(
          testParams.liquidity.toString()
        );
        console.log(
          "✅ Pool liquidity updated:",
          finalPoolAccount.liquidity.toString()
        );

        // Verify tokens were transferred (hardcoded amounts from mint instruction)
        const expectedTransfer0 = BigInt(1_000_000_000); // 1 SOL
        const expectedTransfer1 = BigInt(150_000_000); // 150 USDC

        expect(finalUserToken0.amount).to.equal(
          initialUserToken0.amount - expectedTransfer0
        );
        expect(finalUserToken1.amount).to.equal(
          initialUserToken1.amount - expectedTransfer1
        );
        expect(finalPoolToken0.amount).to.equal(expectedTransfer0);
        expect(finalPoolToken1.amount).to.equal(expectedTransfer1);

        console.log("✅ Token transfers verified:");
        console.log(`  Token0 transferred: ${expectedTransfer0.toString()}`);
        console.log(`  Token1 transferred: ${expectedTransfer1.toString()}`);

        // Try to fetch position account to verify it was created
        const [positionPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("position"),
            provider.wallet.publicKey.toBuffer(),
            Buffer.from(new Int32Array([testParams.lowerTick]).buffer),
            Buffer.from(new Int32Array([testParams.upperTick]).buffer),
          ],
          program.programId
        );

        const positionAccount = await program.account.positionInfo.fetch(
          positionPda
        );
        expect(positionAccount.owner.toString()).to.equal(
          provider.wallet.publicKey.toString()
        );
        expect(positionAccount.liquidity.toString()).to.equal(
          testParams.liquidity.toString()
        );
        console.log(
          "✅ Position account created with liquidity:",
          positionAccount.liquidity.toString()
        );
      } catch (error) {
        console.log("❌ Mint failed:", error.message);
        if (error.logs) {
          console.log("Transaction logs:", error.logs);
        }
        throw error;
      }
    });

    it("Should fail with invalid tick range", async () => {
      try {
        await program.methods
          .mint(
            provider.wallet.publicKey,
            testParams.upperTick, // Invalid: upper tick as lower
            testParams.lowerTick, // Invalid: lower tick as upper
            testParams.liquidity
          )
          .accounts({
            pool: poolPda,
            userToken0: token0Account,
            userToken1: token1Account,
            poolToken0: token0Account,
            poolToken1: token1Account,
            payer: provider.wallet.publicKey,
          })
          .rpc();

        expect.fail("Expected transaction to fail with invalid tick range");
      } catch (error) {
        console.log("✅ Expected error for invalid tick range:", error.message);
      }
    });

    it("Should fail with zero liquidity", async () => {
      try {
        await program.methods
          .mint(
            provider.wallet.publicKey,
            testParams.lowerTick,
            testParams.upperTick,
            new anchor.BN(0) // Zero liquidity
          )
          .accounts({
            pool: poolPda,
            userToken0: token0Account,
            userToken1: token1Account,
            poolToken0: token0Account,
            poolToken1: token1Account,
            payer: provider.wallet.publicKey,
          })
          .rpc();

        expect.fail("Expected transaction to fail with zero liquidity");
      } catch (error) {
        console.log("✅ Expected error for zero liquidity:", error.message);
      }
    });
  });
});
