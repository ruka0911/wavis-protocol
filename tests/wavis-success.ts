import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { WavisSuccess } from "../target/types/wavis_success";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { assert } from "chai";

describe("wavis-success", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.WavisSuccess as Program<WavisSuccess>;
  const connection = provider.connection;

  // Keypairs
  let admin: anchor.web3.Keypair;
  let userA: anchor.web3.Keypair;
  let userB: anchor.web3.Keypair;

  // USDC Mint
  let usdcMint: anchor.web3.PublicKey;

  // Token Accounts
  let adminTokenAccount: anchor.web3.PublicKey;
  let userATokenAccount: anchor.web3.PublicKey;
  let userBTokenAccount: anchor.web3.PublicKey;
  let vaultTokenAccount: anchor.web3.PublicKey;

  // PDAs
  let statePda: anchor.web3.PublicKey;
  let userAVaultPda: anchor.web3.PublicKey;
  let userBVaultPda: anchor.web3.PublicKey;

  const FEE_AMOUNT = 500_000; // 0.5 USDC

  before(async () => {
    // 1. Keypairを作成
    admin = anchor.web3.Keypair.generate();
    userA = anchor.web3.Keypair.generate();
    userB = anchor.web3.Keypair.generate();

    console.log("Admin:", admin.publicKey.toBase58());
    console.log("UserA:", userA.publicKey.toBase58());
    console.log("UserB:", userB.publicKey.toBase58());

    // 2. Airdrop SOL
    const airdropAmount = 10 * anchor.web3.LAMPORTS_PER_SOL;
    await connection.confirmTransaction(
      await connection.requestAirdrop(admin.publicKey, airdropAmount)
    );
    await connection.confirmTransaction(
      await connection.requestAirdrop(userA.publicKey, airdropAmount)
    );
    await connection.confirmTransaction(
      await connection.requestAirdrop(userB.publicKey, airdropAmount)
    );

    console.log("✓ Airdropped SOL to all users");

    // 3. USDC Mint作成（decimals=6）
    usdcMint = await createMint(
      connection,
      admin,
      admin.publicKey,
      null,
      6 // USDC decimals
    );

    console.log("✓ Created USDC Mint:", usdcMint.toBase58());

    // 4. ATAを作成してUSDCを配布
    const adminAta = await getOrCreateAssociatedTokenAccount(
      connection,
      admin,
      usdcMint,
      admin.publicKey
    );
    adminTokenAccount = adminAta.address;

    const userAAta = await getOrCreateAssociatedTokenAccount(
      connection,
      userA,
      usdcMint,
      userA.publicKey
    );
    userATokenAccount = userAAta.address;

    const userBAta = await getOrCreateAssociatedTokenAccount(
      connection,
      userB,
      usdcMint,
      userB.publicKey
    );
    userBTokenAccount = userBAta.address;

    // USDCをMint（各1000 USDC = 1,000,000,000）
    await mintTo(
      connection,
      admin,
      usdcMint,
      adminTokenAccount,
      admin,
      1_000_000_000
    );
    await mintTo(
      connection,
      admin,
      usdcMint,
      userATokenAccount,
      admin,
      1_000_000_000
    );
    await mintTo(
      connection,
      admin,
      usdcMint,
      userBTokenAccount,
      admin,
      1_000_000_000
    );

    console.log("✓ Minted USDC to all users");

    // 5. State PDAを導出
    [statePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("state")],
      program.programId
    );

    console.log("State PDA:", statePda.toBase58());

    // 6. Vault Token Account（State PDAがauthority）
    const vaultAta = await getOrCreateAssociatedTokenAccount(
      connection,
      admin,
      usdcMint,
      statePda,
      true // allowOwnerOffCurve
    );
    vaultTokenAccount = vaultAta.address;

    console.log("Vault Token Account:", vaultTokenAccount.toBase58());

    // 7. User Vault PDAsを導出
    [userAVaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("user_vault"), userA.publicKey.toBuffer()],
      program.programId
    );

    [userBVaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("user_vault"), userB.publicKey.toBuffer()],
      program.programId
    );

    console.log("UserA Vault PDA:", userAVaultPda.toBase58());
    console.log("UserB Vault PDA:", userBVaultPda.toBase58());
  });

  it("Initialize: Global State作成", async () => {
    const tx = await program.methods
      .initialize()
      .accounts({
        admin: admin.publicKey,
        state: statePda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    console.log("Initialize tx:", tx);

    // Stateアカウントを取得して確認
    const stateAccount = await program.account.state.fetch(statePda);
    assert.equal(
      stateAccount.admin.toBase58(),
      admin.publicKey.toBase58(),
      "Admin mismatch"
    );
    assert.equal(
      stateAccount.totalDeposited.toNumber(),
      0,
      "Total deposited should be 0"
    );
    assert.equal(
      stateAccount.totalShares.toString(),
      "0",
      "Total shares should be 0"
    );
    assert.equal(stateAccount.blacklist.length, 0, "Blacklist should be empty");

    console.log("✓ State initialized successfully");
  });

  it("Deposit (正常系): UserAが100 USDCをDeposit", async () => {
    const depositAmount = new BN(100_000_000); // 100 USDC

    // Deposit前の残高
    const userABalanceBefore = await connection.getTokenAccountBalance(
      userATokenAccount
    );
    console.log(
      "UserA balance before:",
      userABalanceBefore.value.uiAmountString
    );

    const tx = await program.methods
      .deposit(depositAmount)
      .accounts({
        user: userA.publicKey,
        userTokenAccount: userATokenAccount,
        state: statePda,
        userVault: userAVaultPda,
        vaultTokenAccount: vaultTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([userA])
      .rpc();

    console.log("Deposit tx:", tx);

    // Deposit後の残高確認
    const userABalanceAfter = await connection.getTokenAccountBalance(
      userATokenAccount
    );
    console.log(
      "UserA balance after:",
      userABalanceAfter.value.uiAmountString
    );

    // State確認
    const stateAccount = await program.account.state.fetch(statePda);
    assert.equal(
      stateAccount.totalDeposited.toNumber(),
      depositAmount.toNumber(),
      "Total deposited mismatch"
    );
    assert.equal(
      stateAccount.totalShares.toString(),
      depositAmount.toString(),
      "Total shares mismatch (first deposit)"
    );

    // UserVault確認
    const userAVault = await program.account.userVault.fetch(userAVaultPda);
    assert.equal(
      userAVault.shares.toString(),
      depositAmount.toString(),
      "UserA shares mismatch"
    );

    console.log("✓ UserA deposited successfully");
    console.log("  Total deposited:", stateAccount.totalDeposited.toString());
    console.log("  Total shares:", stateAccount.totalShares.toString());
    console.log("  UserA shares:", userAVault.shares.toString());
  });

  it("Blacklist (異常系): UserBをブラックリストに追加してDeposit拒否", async () => {
    // UserBをブラックリストに追加
    const tx = await program.methods
      .adminUpdateBlacklist(userB.publicKey, true)
      .accounts({
        admin: admin.publicKey,
        state: statePda,
      })
      .signers([admin])
      .rpc();

    console.log("Blacklist add tx:", tx);

    // State確認
    const stateAccount = await program.account.state.fetch(statePda);
    assert.equal(stateAccount.blacklist.length, 1, "Blacklist should have 1 entry");
    assert.equal(
      stateAccount.blacklist[0].toBase58(),
      userB.publicKey.toBase58(),
      "UserB should be in blacklist"
    );

    console.log("✓ UserB added to blacklist");

    // UserBがDepositを試みる（エラーを期待）
    const depositAmount = new BN(50_000_000); // 50 USDC

    try {
      await program.methods
        .deposit(depositAmount)
        .accounts({
          user: userB.publicKey,
          userTokenAccount: userBTokenAccount,
          state: statePda,
          userVault: userBVaultPda,
          vaultTokenAccount: vaultTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([userB])
        .rpc();

      assert.fail("UserB should not be able to deposit (blacklisted)");
    } catch (error) {
      // エラーメッセージにBlacklistedが含まれているか確認
      assert.include(
        error.toString(),
        "Blacklisted",
        "Expected Blacklisted error"
      );
      console.log("✓ UserB deposit rejected (Blacklisted)");
    }
  });

  it("Withdraw (手数料確認): UserAが全額Withdraw", async () => {
    // UserAの現在のシェア数を取得
    const userAVaultBefore = await program.account.userVault.fetch(
      userAVaultPda
    );
    const sharesToWithdraw = userAVaultBefore.shares;

    console.log("UserA shares to withdraw:", sharesToWithdraw.toString());

    // Withdraw前の残高
    const userABalanceBefore = await connection.getTokenAccountBalance(
      userATokenAccount
    );
    console.log(
      "UserA balance before withdraw:",
      userABalanceBefore.value.uiAmountString
    );

    const tx = await program.methods
      .withdraw(sharesToWithdraw)
      .accounts({
        user: userA.publicKey,
        userTokenAccount: userATokenAccount,
        state: statePda,
        userVault: userAVaultPda,
        vaultTokenAccount: vaultTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([userA])
      .rpc();

    console.log("Withdraw tx:", tx);

    // Withdraw後の残高
    const userABalanceAfter = await connection.getTokenAccountBalance(
      userATokenAccount
    );
    console.log(
      "UserA balance after withdraw:",
      userABalanceAfter.value.uiAmountString
    );

    // 受け取った額を計算
    const receivedAmount =
      parseInt(userABalanceAfter.value.amount) -
      parseInt(userABalanceBefore.value.amount);

    // 期待値：100 USDC - 0.5 USDC (手数料) = 99.5 USDC
    const expectedAmount = 100_000_000 - FEE_AMOUNT;

    assert.equal(
      receivedAmount,
      expectedAmount,
      "Received amount should be deposit - fee"
    );

    console.log("✓ UserA withdrew successfully");
    console.log("  Received amount:", receivedAmount);
    console.log("  Expected amount:", expectedAmount);
    console.log("  Fee deducted:", FEE_AMOUNT);

    // State確認（残高が0に戻っているはず）
    const stateAccount = await program.account.state.fetch(statePda);
    assert.equal(
      stateAccount.totalDeposited.toNumber(),
      0,
      "Total deposited should be 0 after full withdrawal"
    );
    assert.equal(
      stateAccount.totalShares.toString(),
      "0",
      "Total shares should be 0 after full withdrawal"
    );

    // UserVault確認（シェアが0に戻っているはず）
    const userAVaultAfter = await program.account.userVault.fetch(
      userAVaultPda
    );
    assert.equal(
      userAVaultAfter.shares.toString(),
      "0",
      "UserA shares should be 0 after full withdrawal"
    );

    console.log("✓ All balances reset to 0");
  });
});
