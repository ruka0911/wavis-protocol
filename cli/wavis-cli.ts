#!/usr/bin/env node

import * as dotenv from "dotenv";
dotenv.config();

import { Command } from "commander";
import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { WavisSuccess } from "../target/types/wavis_success";
import {
  getOrCreateAssociatedTokenAccount,
  getAccount,
  createMint,
  mintTo,
  TOKEN_PROGRAM_ID,
  createTransferInstruction,
} from "@solana/spl-token";
import { createMemoInstruction } from "@solana/spl-memo";
import * as nacl from "tweetnacl";
import * as ed2curve from "ed2curve";
import { TextEncoder, TextDecoder } from "util";
import * as fs from "fs";
import * as path from "path";

// 定数
const PROGRAM_ID = "GjWUevQsr5QLWxRzXNpVCZKkQmjEdjijEA65JujZ2HXS";
const FEE_AMOUNT = 500_000; // 0.5 USDC
const USDC_DECIMALS = 6;

// USDC Mint（ローカルテスト環境用）
// 実際のテストで生成されたMintアドレスを使用するか、環境変数で設定
let USDC_MINT: anchor.web3.PublicKey | null = null;

// Anchor設定を読み込み
function loadAnchorConfig(): { cluster: string; wallet: string } {
  const anchorTomlPath = path.join(process.cwd(), "Anchor.toml");
  const content = fs.readFileSync(anchorTomlPath, "utf-8");

  const clusterMatch = content.match(/cluster\s*=\s*"(.+)"/);
  const walletMatch = content.match(/wallet\s*=\s*"(.+)"/);

  return {
    cluster: clusterMatch ? clusterMatch[1] : "localnet",
    wallet: walletMatch ? walletMatch[1] : "",
  };
}

// クラスターURLを取得
function getClusterUrl(cluster: string): string {
  const lowerCluster = cluster.toLowerCase();
  if (lowerCluster === "localnet") {
    return "http://127.0.0.1:8899";
  } else if (lowerCluster === "devnet") {
    return "https://api.devnet.solana.com";
  } else if (lowerCluster === "mainnet") {
    return "https://api.mainnet-beta.solana.com";
  }
  return "http://127.0.0.1:8899";
}

// Provider初期化
function initializeProvider(): {
  provider: anchor.AnchorProvider;
  program: Program<WavisSuccess>;
  wallet: anchor.Wallet;
} {
  const config = loadAnchorConfig();
  const clusterUrl = getClusterUrl(config.cluster);

  const connection = new anchor.web3.Connection(clusterUrl, "confirmed");

  // Walletを読み込み
  const walletKeypair = anchor.web3.Keypair.fromSecretKey(
    Buffer.from(
      JSON.parse(fs.readFileSync(path.resolve(config.wallet), "utf-8"))
    )
  );

  const wallet = new anchor.Wallet(walletKeypair);

  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  anchor.setProvider(provider);

  const programId = new anchor.web3.PublicKey(PROGRAM_ID);
  const idl = JSON.parse(
    fs.readFileSync(
      path.join(process.cwd(), "target/idl/wavis_success.json"),
      "utf-8"
    )
  );

  const program = new anchor.Program(
    idl,
    programId,
    provider
  ) as Program<WavisSuccess>;

  return { provider, program, wallet };
}

// USDC Mintアドレスを環境変数から取得またはプロンプト
function getUsdcMint(required: boolean = true): anchor.web3.PublicKey | null {
  if (USDC_MINT) {
    return USDC_MINT;
  }

  const mintEnv = process.env.USDC_MINT;
  if (mintEnv) {
    USDC_MINT = new anchor.web3.PublicKey(mintEnv);
    return USDC_MINT;
  }

  if (required) {
    console.error(
      "Error: USDC_MINT environment variable not set. Please set it before running commands."
    );
    console.error("Example: export USDC_MINT=<your_usdc_mint_address>");
    console.error("Or run 'npm run cli setup' to create a new test environment.");
    process.exit(1);
  }

  return null;
}

// PDA導出
function deriveStatePda(program: Program<WavisSuccess>): anchor.web3.PublicKey {
  const [pda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    program.programId
  );
  return pda;
}

function deriveUserVaultPda(
  program: Program<WavisSuccess>,
  user: anchor.web3.PublicKey
): anchor.web3.PublicKey {
  const [pda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("user_vault"), user.toBuffer()],
    program.programId
  );
  return pda;
}

// 金額フォーマット
function formatUsdc(amount: number): string {
  return (amount / Math.pow(10, USDC_DECIMALS)).toFixed(USDC_DECIMALS);
}

// ========== ECIES暗号化/復号ロジック（完全版） ==========

/**
 * メッセージを暗号化してBase64文字列として返す
 * 
 * パイプライン:
 * 1. 鍵変換: Ed25519 -> X25519 (ed2curve)
 * 2. Nonce生成: ランダム24バイト
 * 3. 暗号化: nacl.box(message, nonce, recipientPub, senderSecret)
 * 4. パッキング: [Nonce(24) + CipherText(variable)]
 * 5. Base64エンコード
 */
function encryptMessage(
  message: string,
  senderSecretKey: Uint8Array,
  recipientPublicKey: Uint8Array
): string {
  console.log("🔐 Starting encryption...");
  
  // Step 1: Ed25519 -> X25519 鍵変換
  console.log("   Step 1: Converting Ed25519 keys to X25519...");
  const secretKey = ed2curve.convertSecretKey(senderSecretKey);
  const publicKey = ed2curve.convertPublicKey(recipientPublicKey);
  
  if (!secretKey || !publicKey) {
    console.error("   ❌ Key conversion failed!");
    throw new Error("Failed to convert Ed25519 keys to X25519");
  }
  console.log("   ✅ Key conversion successful");
  
  // Step 2: メッセージをバイト配列に変換
  console.log("   Step 2: Encoding message to bytes...");
  const encoder = new TextEncoder();
  const messageBytes = encoder.encode(message);
  console.log(`   ✅ Message encoded (${messageBytes.length} bytes)`);
  
  // Step 3: ランダムNonce生成（24バイト）
  console.log("   Step 3: Generating random nonce (24 bytes)...");
  const nonce = nacl.randomBytes(24);
  console.log(`   ✅ Nonce generated: ${Buffer.from(nonce).toString("hex").substring(0, 16)}...`);
  
  // Step 4: nacl.boxで暗号化
  console.log("   Step 4: Encrypting with nacl.box...");
  const ciphertext = nacl.box(messageBytes, nonce, publicKey, secretKey);
  console.log(`   ✅ Encryption successful (ciphertext: ${ciphertext.length} bytes)`);
  
  // Step 5: パッキング [Nonce(24) + CipherText]
  console.log("   Step 5: Packing [Nonce + CipherText]...");
  const packed = new Uint8Array(24 + ciphertext.length);
  packed.set(nonce, 0);           // 最初の24バイト = nonce
  packed.set(ciphertext, 24);     // 残り = ciphertext
  console.log(`   ✅ Packed data (total: ${packed.length} bytes)`);
  
  // Step 6: Base64エンコード
  console.log("   Step 6: Base64 encoding...");
  const base64 = Buffer.from(packed).toString("base64");
  console.log(`   ✅ Base64 encoded (${base64.length} chars)`);
  console.log(`   Result: ${base64.substring(0, 50)}...`);
  
  return base64;
}

/**
 * Base64文字列を復号してメッセージを返す
 * 
 * パイプライン:
 * 1. Base64デコード
 * 2. 長さチェック（最低24バイト）
 * 3. アンパッキング: nonce = data[0:24], cipher = data[24:]
 * 4. 鍵変換: Ed25519 -> X25519 (ed2curve)
 * 5. 復号: nacl.box.open(cipher, nonce, senderPub, recipientSecret)
 * 6. UTF-8デコード
 */
function decryptMessage(
  encryptedBase64: string,
  recipientSecretKey: Uint8Array,
  senderPublicKey: Uint8Array
): { success: boolean; message?: string; error?: string } {
  try {
    // Step 1: Base64デコード
    const data = new Uint8Array(Buffer.from(encryptedBase64, "base64"));
    
    // Step 2: 長さチェック
    if (data.length < 24) {
      return {
        success: false,
        error: `Data too short (${data.length} bytes, minimum 24 required)`
      };
    }
    
    // Step 3: アンパッキング [Nonce(24) + CipherText]
    const nonce = data.slice(0, 24);
    const cipher = data.slice(24);
    
    // Step 4: Ed25519 -> X25519 鍵変換
    const mySecret = ed2curve.convertSecretKey(recipientSecretKey);
    const senderPublic = ed2curve.convertPublicKey(senderPublicKey);
    
    if (!mySecret || !senderPublic) {
      return {
        success: false,
        error: "Key conversion failed (Ed25519 -> X25519)"
      };
    }
    
    // Step 5: nacl.box.openで復号
    const decrypted = nacl.box.open(cipher, nonce, senderPublic, mySecret);
    
    if (!decrypted) {
      return {
        success: false,
        error: "nacl.box.open failed (invalid ciphertext or wrong keys)"
      };
    }
    
    // Step 6: UTF-8デコード
    const decoder = new TextDecoder();
    const message = decoder.decode(decrypted);
    
    return {
      success: true,
      message: message
    };
  } catch (error) {
    return {
      success: false,
      error: `Exception: ${error.message || error}`
    };
  }
}

// balance コマンド
async function balanceCommand() {
  try {
    console.log("📊 Fetching balance...\n");

    const { provider, program, wallet } = initializeProvider();
    const usdcMint = getUsdcMint()!; // required=true なので non-null

    // ユーザーのUSDC ATAを取得
    const userTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      usdcMint,
      wallet.publicKey
    );

    const userBalance = await getAccount(
      provider.connection,
      userTokenAccount.address
    );

    console.log("💰 Wallet USDC Balance:");
    console.log(`   ${formatUsdc(Number(userBalance.amount))} USDC`);
    console.log(`   (${userBalance.amount} raw)\n`);

    // Vault内の持分を取得
    const statePda = deriveStatePda(program);
    const userVaultPda = deriveUserVaultPda(program, wallet.publicKey);

    try {
      const state = await program.account.state.fetch(statePda);
      const userVault = await program.account.userVault.fetch(userVaultPda);

      const userShares = userVault.shares;
      const totalShares = state.totalShares;
      const totalDeposited = state.totalDeposited;

      console.log("🏦 Vault Holdings:");
      console.log(`   Shares: ${userShares.toString()}`);

      if (totalShares.gt(new BN(0))) {
        // 持分をUSDC換算: (userShares * totalDeposited) / totalShares
        const userValue =
          (Number(userShares) * Number(totalDeposited)) / Number(totalShares);
        console.log(`   Value: ${formatUsdc(userValue)} USDC`);
        console.log(`   (${Math.floor(userValue)} raw)\n`);
      } else {
        console.log(`   Value: 0 USDC (no deposits in vault)\n`);
      }

      console.log("📈 Global Vault Stats:");
      console.log(`   Total Deposited: ${formatUsdc(Number(totalDeposited))} USDC`);
      console.log(`   Total Shares: ${totalShares.toString()}`);
    } catch (error) {
      console.log("🏦 Vault Holdings:");
      console.log("   No deposits yet (UserVault not initialized)\n");
    }
  } catch (error) {
    console.error("❌ Error fetching balance:", error.message);
    process.exit(1);
  }
}

// deposit コマンド
async function depositCommand(amountStr: string) {
  try {
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      console.error("❌ Invalid amount. Please provide a positive number.");
      process.exit(1);
    }

    const rawAmount = Math.floor(amount * Math.pow(10, USDC_DECIMALS));

    console.log(`💵 Depositing ${amount} USDC (${rawAmount} raw)...\n`);

    const { provider, program, wallet } = initializeProvider();
    const usdcMint = getUsdcMint()!; // required=true なので non-null

    // PDA導出
    const statePda = deriveStatePda(program);
    const userVaultPda = deriveUserVaultPda(program, wallet.publicKey);

    // Token Accounts
    const userTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      usdcMint,
      wallet.publicKey
    );

    const vaultTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      usdcMint,
      statePda,
      true // allowOwnerOffCurve
    );

    // Deposit実行
    const tx = await program.methods
      .deposit(new BN(rawAmount))
      .accounts({
        user: wallet.publicKey,
        userTokenAccount: userTokenAccount.address,
        state: statePda,
        userVault: userVaultPda,
        vaultTokenAccount: vaultTokenAccount.address,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Deposit successful!");
    console.log(`   Transaction: ${tx}\n`);

    // 更新後の状態を表示
    const userVault = await program.account.userVault.fetch(userVaultPda);
    console.log(`📊 Your shares: ${userVault.shares.toString()}`);
  } catch (error) {
    console.error("❌ Deposit failed:", error.message);
    if (error.logs) {
      console.error("Logs:", error.logs);
    }
    process.exit(1);
  }
}

// withdraw コマンド
async function withdrawCommand(amountStr: string) {
  try {
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      console.error("❌ Invalid amount. Please provide a positive number.");
      process.exit(1);
    }

    console.log(`💸 Withdrawing ${amount} USDC...\n`);

    const { provider, program, wallet } = initializeProvider();
    const usdcMint = getUsdcMint()!; // required=true なので non-null

    // PDA導出
    const statePda = deriveStatePda(program);
    const userVaultPda = deriveUserVaultPda(program, wallet.publicKey);

    // 現在の状態を取得
    const state = await program.account.state.fetch(statePda);
    const userVault = await program.account.userVault.fetch(userVaultPda);

    const totalShares = state.totalShares;
    const totalDeposited = state.totalDeposited;
    const userShares = userVault.shares;

    // 出金したいUSDC額に対応するシェア数を計算
    // shares = (amount * totalShares) / totalDeposited
    const rawAmount = Math.floor(amount * Math.pow(10, USDC_DECIMALS));
    const sharesToWithdraw =
      (BigInt(rawAmount) * BigInt(totalShares.toString())) /
      BigInt(totalDeposited.toString());

    // 手数料をUSDC単位に変換
    const feeUsdc = FEE_AMOUNT / Math.pow(10, USDC_DECIMALS); // 0.5 USDC

    console.log(`   Amount: ${amount} USDC`);
    console.log(`   Shares to burn: ${sharesToWithdraw.toString()}`);
    console.log(`   Fee: ${feeUsdc} USDC`);
    console.log(`   Expected to receive: ${amount - feeUsdc} USDC\n`);

    // シェア不足チェック
    if (BigInt(userShares.toString()) < sharesToWithdraw) {
      console.error("❌ Insufficient shares!");
      console.error(`   You have: ${userShares.toString()} shares`);
      console.error(`   Required: ${sharesToWithdraw.toString()} shares`);
      process.exit(1);
    }

    // Token Accounts
    const userTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      usdcMint,
      wallet.publicKey
    );

    const vaultTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      usdcMint,
      statePda,
      true // allowOwnerOffCurve
    );

    // 残高確認（出金前）
    const balanceBefore = await getAccount(
      provider.connection,
      userTokenAccount.address
    );

    // Withdraw実行
    const tx = await program.methods
      .withdraw(new BN(sharesToWithdraw.toString()))
      .accounts({
        user: wallet.publicKey,
        userTokenAccount: userTokenAccount.address,
        state: statePda,
        userVault: userVaultPda,
        vaultTokenAccount: vaultTokenAccount.address,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log("✅ Withdrawal successful!");
    console.log(`   Transaction: ${tx}\n`);

    // 残高確認（出金後）
    const balanceAfter = await getAccount(
      provider.connection,
      userTokenAccount.address
    );

    const received = Number(balanceAfter.amount) - Number(balanceBefore.amount);
    console.log(`📊 Received: ${formatUsdc(received)} USDC`);
    console.log(`   (${received} raw)`);
  } catch (error) {
    console.error("❌ Withdrawal failed:", error.message);
    if (error.logs) {
      console.error("Logs:", error.logs);
    }
    process.exit(1);
  }
}

// blacklist-add コマンド
async function blacklistAddCommand(pubkeyStr: string) {
  try {
    console.log(`🚫 Adding ${pubkeyStr} to blacklist...\n`);

    const { program, wallet } = initializeProvider();

    // 公開鍵をパース
    const targetPubkey = new anchor.web3.PublicKey(pubkeyStr);

    // PDA導出
    const statePda = deriveStatePda(program);

    // Blacklist追加実行
    const tx = await program.methods
      .adminUpdateBlacklist(targetPubkey, true)
      .accounts({
        admin: wallet.publicKey,
        state: statePda,
      })
      .rpc();

    console.log("✅ Blacklist updated!");
    console.log(`   Transaction: ${tx}\n`);

    // 更新後のブラックリストを表示
    const state = await program.account.state.fetch(statePda);
    console.log(`📋 Current blacklist (${state.blacklist.length} entries):`);
    state.blacklist.forEach((addr, idx) => {
      console.log(`   ${idx + 1}. ${addr.toBase58()}`);
    });
  } catch (error) {
    console.error("❌ Blacklist operation failed:", error.message);
    if (error.logs) {
      console.error("Logs:", error.logs);
    }
    process.exit(1);
  }
}

// setup コマンド - 開発環境を一発で構築
async function setupCommand() {
  try {
    console.log("🚀 Setting up WAVIS development environment...\n");

    const { provider, program, wallet } = initializeProvider();

    // 1. Airdrop SOL
    console.log("💰 Step 1: Airdropping 2 SOL to your wallet...");
    const airdropAmount = 2 * anchor.web3.LAMPORTS_PER_SOL;
    try {
      const airdropSig = await provider.connection.requestAirdrop(
        wallet.publicKey,
        airdropAmount
      );
      await provider.connection.confirmTransaction(airdropSig);
      console.log("   ✅ Airdrop successful\n");
    } catch (error) {
      console.log("   ⚠️  Airdrop failed (may already have enough SOL)\n");
    }

    // 2. Create Mint
    console.log("🪙 Step 2: Creating test USDC Mint...");
    const mint = await createMint(
      provider.connection,
      wallet.payer,
      wallet.publicKey, // mint authority
      null, // freeze authority
      USDC_DECIMALS
    );
    console.log(`   ✅ Mint created: ${mint.toBase58()}\n`);

    // USDCMINTをグローバルに設定
    USDC_MINT = mint;

    // 3. Create ATA and MintTo
    console.log("💵 Step 3: Creating your token account and minting 10,000 USDC...");
    const userTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      mint,
      wallet.publicKey
    );

    await mintTo(
      provider.connection,
      wallet.payer,
      mint,
      userTokenAccount.address,
      wallet.payer,
      10_000_000_000 // 10,000 USDC
    );
    console.log("   ✅ Minted 10,000 USDC to your wallet\n");

    // 4. Initialize WAVIS program
    console.log("🏦 Step 4: Initializing WAVIS vault...");
    const statePda = deriveStatePda(program);

    try {
      // Stateが既に存在するかチェック
      await program.account.state.fetch(statePda);
      console.log("   ⚠️  Vault already initialized (skipping)\n");
    } catch (error) {
      // Stateが存在しない場合は初期化
      const tx = await program.methods
        .initialize()
        .accounts({
          admin: wallet.publicKey,
          state: statePda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      console.log("   ✅ Vault initialized successfully");
      console.log(`   Transaction: ${tx}\n`);
    }

    // 5. Create Vault Token Account
    console.log("🔐 Step 5: Creating vault token account...");
    const vaultTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      mint,
      statePda,
      true // allowOwnerOffCurve
    );
    console.log(`   ✅ Vault token account: ${vaultTokenAccount.address.toBase58()}\n`);

    // 6. Save to .env file
    console.log("💾 Step 6: Saving configuration...");
    const envPath = path.join(process.cwd(), ".env");
    const envContent = `USDC_MINT=${mint.toBase58()}\n`;

    try {
      // .envファイルが既に存在する場合は追記、なければ作成
      let existingContent = "";
      if (fs.existsSync(envPath)) {
        existingContent = fs.readFileSync(envPath, "utf-8");
        // 既存のUSDC_MINTエントリを削除
        existingContent = existingContent
          .split("\n")
          .filter((line) => !line.startsWith("USDC_MINT="))
          .join("\n");
      }

      fs.writeFileSync(envPath, existingContent + envContent);
      console.log(`   ✅ Saved to .env file\n`);
    } catch (error) {
      console.log(`   ⚠️  Could not write to .env file\n`);
    }

    // 完了メッセージ
    console.log("🎉 Setup complete!\n");
    console.log("📋 Summary:");
    console.log(`   Wallet: ${wallet.publicKey.toBase58()}`);
    console.log(`   USDC Mint: ${mint.toBase58()}`);
    console.log(`   Your USDC Balance: 10,000 USDC`);
    console.log(`   Vault State PDA: ${statePda.toBase58()}\n`);
    console.log("✨ You can now use the following commands:");
    console.log("   npm run cli balance");
    console.log("   npm run cli deposit 100");
    console.log("   npm run cli withdraw 50\n");
    console.log("💡 Tip: USDC_MINT has been saved to .env file.");
    console.log("   The CLI will automatically load it on startup - no export needed!");
  } catch (error) {
    console.error("\n❌ Setup failed:", error.message);
    if (error.logs) {
      console.error("Logs:", error.logs);
    }
    process.exit(1);
  }
}

// send コマンド - 暗号化メッセージ付き送金
async function sendCommand(recipientStr: string, amountStr: string, options: { memo?: string }) {
  try {
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      console.error("❌ Invalid amount. Please provide a positive number.");
      process.exit(1);
    }

    const rawAmount = Math.floor(amount * Math.pow(10, USDC_DECIMALS));

    console.log(`💸 Sending ${amount} USDC to ${recipientStr}...\n`);

    const { provider, wallet } = initializeProvider();
    const usdcMint = getUsdcMint()!;

    // 受信者の公開鍵をパース
    const recipient = new anchor.web3.PublicKey(recipientStr);

    // Token Accounts
    const senderTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      usdcMint,
      wallet.publicKey
    );

    const recipientTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      wallet.payer,
      usdcMint,
      recipient
    );

    // トランザクションを作成
    const transaction = new anchor.web3.Transaction();

    // USDC転送命令を追加
    const transferInstruction = createTransferInstruction(
      senderTokenAccount.address,
      recipientTokenAccount.address,
      wallet.publicKey,
      rawAmount,
      [],
      TOKEN_PROGRAM_ID
    );
    transaction.add(transferInstruction);

    // メモがあれば暗号化して追加
    if (options.memo) {
      console.log(`🔐 Encrypting message: "${options.memo}"`);
      
      // メッセージを暗号化
      const encryptedMessage = encryptMessage(
        options.memo,
        wallet.payer.secretKey,
        recipient.toBytes()
      );

      console.log(`   Encrypted (Base64): ${encryptedMessage.substring(0, 50)}...`);

      // Memo命令を追加
      const memoInstruction = createMemoInstruction(encryptedMessage, [wallet.publicKey]);
      transaction.add(memoInstruction);
    }

    // トランザクションを送信
    const signature = await provider.connection.sendTransaction(transaction, [wallet.payer]);
    await provider.connection.confirmTransaction(signature);

    console.log("\n✅ Transfer successful!");
    console.log(`   Transaction: ${signature}`);
    console.log(`   Amount: ${amount} USDC`);
    console.log(`   Recipient: ${recipient.toBase58()}`);
    if (options.memo) {
      console.log(`   📝 Encrypted memo attached`);
    }
  } catch (error) {
    console.error("❌ Send failed:", error.message);
    process.exit(1);
  }
}

// inbox コマンド - 受信メッセージの復号
async function inboxCommand() {
  console.log("\n📬 Fetching your encrypted messages...\n");
  
  const { provider, wallet } = initializeProvider();
  const myKeypair = wallet.payer;
  const connection = provider.connection;

  try {
    const signatures = await connection.getSignaturesForAddress(myKeypair.publicKey, { limit: 20 });
    let foundCount = 0;

    console.log(`Found ${signatures.length} recent transactions.`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    for (const sigInfo of signatures) {
      const tx = await connection.getTransaction(sigInfo.signature, {
        maxSupportedTransactionVersion: 0,
      });

      if (!tx || !tx.meta || !tx.meta.logMessages) continue;

      // Memoを探す
      const memoLog = tx.meta.logMessages.find((log) => log.startsWith("Program log: Memo "));
      
      if (memoLog) {
        // ★決定打: 正規表現で Base64っぽい部分だけを無理やり引き抜く
        // (英数字+/が20文字以上続き、末尾に=が0~2個あるパターン)
        const match = memoLog.match(/([A-Za-z0-9+/]{20,}={0,2})/);
        
        if (!match) continue; // Base64が見つからなければスキップ
        
        const memoClean = match[1]; // 抽出された純粋なBase64文字列

        foundCount++;
        const senderAddr = tx.transaction.message.staticAccountKeys[0].toBase58();
        const isMe = senderAddr === myKeypair.publicKey.toBase58();

        console.log(`📨 Message #${foundCount}`);
        console.log(`   From: ${senderAddr}`);
        if (isMe) console.log(`   📤 Sent by you`);
        
        // --- 復号プロセス ---
        try {
          // 1. Base64デコード
          const buffer = Buffer.from(memoClean, 'base64');
          const encryptedBytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

          if (encryptedBytes.length < 24) {
               // 短すぎる場合は無視
               continue;
          }

          // 2. アンパッキング
          const nonce = encryptedBytes.slice(0, 24);
          const ciphertext = encryptedBytes.slice(24);

          // 3. 鍵変換
          const mySecretRaw = new Uint8Array(myKeypair.secretKey);
          const mySecretX = ed2curve.convertSecretKey(mySecretRaw);
          
          const senderPubRaw = new Uint8Array(new PublicKey(senderAddr).toBytes());
          const senderPublicX = ed2curve.convertPublicKey(senderPubRaw);

          if (!mySecretX || !senderPublicX) throw new Error("Key conversion failed");

          // 4. 復号
          const decrypted = nacl.box.open(ciphertext, nonce, senderPublicX, mySecretX);

          if (!decrypted) {
             // 復号失敗
             // console.log(`Debug: Nonce=${Buffer.from(nonce).toString('hex').slice(0,10)}...`);
             throw new Error("nacl.box.open returned null (Wrong key or nonce)");
          }

          // 5. 文字列化
          const messageText = Buffer.from(decrypted).toString('utf8');
          console.log(`   🔓 Message: \x1b[32m${messageText}\x1b[0m`); 

        } catch (e: any) {
          // 復号できなかった場合
          console.log(`   🔒 Encrypted: ${memoClean.substring(0, 20)}...`);
          // console.log(`   ⚠️ Status: ${e.message}`);
        }
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      }
    }

    if (foundCount === 0) console.log("No encrypted messages found.");

  } catch (error) {
    console.error("Error fetching inbox:", error);
  }
}

// CLI設定
const program = new Command();

program
  .name("wavis-cli")
  .description("WAVIS Privacy Vault CLI Tool")
  .version("1.0.0");

program
  .command("setup")
  .description("Setup development environment (create mint, airdrop SOL, initialize vault)")
  .action(setupCommand);

program
  .command("balance")
  .description("Show USDC balance in wallet and vault holdings")
  .action(balanceCommand);

program
  .command("deposit <amount>")
  .description("Deposit USDC into the vault (e.g., deposit 100)")
  .action(depositCommand);

program
  .command("withdraw <amount>")
  .description("Withdraw USDC from the vault (e.g., withdraw 50)")
  .action(withdrawCommand);

program
  .command("blacklist-add <pubkey>")
  .description("Add an address to the blacklist (admin only)")
  .action(blacklistAddCommand);

program
  .command("send <recipient> <amount>")
  .description("Send USDC to recipient with optional encrypted memo")
  .option("-m, --memo <message>", "Encrypted message to attach")
  .action(sendCommand);

program
  .command("inbox")
  .description("View encrypted messages from recent transactions")
  .action(inboxCommand);

// CLIを実行
program.parse(process.argv);
