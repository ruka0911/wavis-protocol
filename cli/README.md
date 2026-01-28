# WAVIS CLI Tool

WAVIS Privacy Vaultを操作するためのコマンドラインツールです。

## クイックスタート

### 1. プログラムのビルドとデプロイ

```bash
anchor build
anchor deploy
```

### 2. 開発環境の一発セットアップ（推奨）

```bash
npm run cli setup
```

このコマンドは以下を自動で実行します：
- ✅ ウォレットに2 SOLをAirdrop
- ✅ テスト用USDC Mintを作成
- ✅ あなたのウォレットに10,000 USDCを発行
- ✅ WAVISのVaultを初期化
- ✅ `.env`ファイルに`USDC_MINT`を保存

セットアップ完了後、`.env`ファイルに`USDC_MINT`が自動保存されます。
CLIツールは起動時に自動的に`.env`ファイルを読み込むので、環境変数の設定は不要です！

**注意**: 既存のシェルセッションで手動設定した環境変数がある場合は、そちらが優先されます。

### 3. 手動セットアップ（上級者向け）

独自のUSDC Mintを使いたい場合は、手動で設定できます：

```bash
export USDC_MINT=<your_usdc_mint_address>
```

## 使い方

### セットアップ（開発環境構築）

開発環境を一発で構築（Mint作成、Airdrop、初期化など）：

```bash
npm run cli setup
```

**出力例:**
```
🚀 Setting up WAVIS development environment...

💰 Step 1: Airdropping 2 SOL to your wallet...
   ✅ Airdrop successful

🪙 Step 2: Creating test USDC Mint...
   ✅ Mint created: 9xQ...abc123

💵 Step 3: Creating your token account and minting 10,000 USDC...
   ✅ Minted 10,000 USDC to your wallet

🏦 Step 4: Initializing WAVIS vault...
   ✅ Vault initialized successfully

🔐 Step 5: Creating vault token account...
   ✅ Vault token account: 5Km...xyz789

💾 Step 6: Saving configuration...
   ✅ Saved to .env file

🎉 Setup complete!
```

### 残高確認

ウォレットのUSDC残高とVault内の持分を表示：

```bash
npm run cli balance
```

**出力例:**
```
📊 Fetching balance...

💰 Wallet USDC Balance:
   1000.000000 USDC
   (1000000000 raw)

🏦 Vault Holdings:
   Shares: 100000000
   Value: 100.000000 USDC
   (100000000 raw)

📈 Global Vault Stats:
   Total Deposited: 100.000000 USDC
   Total Shares: 100000000
```

### 入金

指定したUSDC額をVaultに入金：

```bash
npm run cli deposit 100
```

**出力例:**
```
💵 Depositing 100 USDC (100000000 raw)...

✅ Deposit successful!
   Transaction: 5KqX...abc123

📊 Your shares: 100000000
```

### 出金

指定したUSDC額をVaultから出金（手数料0.5 USDCが差し引かれます）：

```bash
npm run cli withdraw 50
```

**出力例:**
```
💸 Withdrawing 50 USDC...

   Amount: 50 USDC
   Shares to burn: 50000000
   Fee: 0.500000 USDC
   Expected to receive: 49.5 USDC

✅ Withdrawal successful!
   Transaction: 7Nm...xyz789

📊 Received: 49.500000 USDC
   (49500000 raw)
```

### ブラックリスト追加（管理者のみ）

指定したアドレスをブラックリストに追加：

```bash
npm run cli blacklist-add <pubkey>
```

**出力例:**
```
🚫 Adding 8xQ...456def to blacklist...

✅ Blacklist updated!
   Transaction: 9Zp...mno321

📋 Current blacklist (1 entries):
   1. 8xQ...456def
```

### 暗号化メッセージ付き送金（Phase 2新機能！）

指定したアドレスにUSDCを送金し、暗号化されたメッセージを添付：

```bash
npm run cli send <recipient_pubkey> <amount> --memo "Your secret message"
```

**出力例:**
```
💸 Sending 10 USDC to 5Km...xyz789...

🔐 Encrypting message: "Hello, this is a secret!"
   Encrypted (Base64): a1b2c3d4e5f6...

✅ Transfer successful!
   Transaction: 3Jk...lmn456
   Amount: 10 USDC
   Recipient: 5Km...xyz789
   📝 Encrypted memo attached
```

**技術仕様:**
- **暗号化方式**: ECIES (Elliptic Curve Integrated Encryption Scheme)
- **鍵共有**: X25519-XSalsa20-Poly1305
- **メモプログラム**: Solana Memo Program を使用

### 受信メッセージの確認

過去のトランザクションから暗号化メッセージを取得・復号：

```bash
npm run cli inbox
```

**出力例:**
```
📬 Fetching your encrypted messages...

Found 5 recent transactions.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📨 Message #1
   From: 8xQ...abc123
   Time: 2026-01-24 10:30:45
   Tx: 3Jk...lmn456
   🔓 Message: Hello, this is a secret!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📨 Message #2
   From: 9Yp...def789
   Time: 2026-01-24 09:15:22
   Tx: 7Qw...rst012
   🔒 Encrypted: z9y8x7w6v5u4...
   ⚠️  Could not decrypt (not addressed to you?)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Found 2 message(s).
```

**動作:**
- 最新20件のトランザクションをスキャン
- Memo Programの命令を検出
- 自分の秘密鍵で復号を試行
- 復号成功 → メッセージ表示
- 復号失敗 → 暗号化されたまま表示

## 環境変数

- `USDC_MINT`: USDCトークンのMintアドレス（必須）

CLIツールは起動時に自動的に`.env`ファイルから環境変数を読み込みます。
`npm run cli setup`を実行すると、自動的に`.env`ファイルが作成されます。

手動で設定する場合：

```bash
export USDC_MINT=<your_usdc_mint_address>
```

または`.env`ファイルを作成：

```
USDC_MINT=<your_usdc_mint_address>
```

## トラブルシューティング

### "USDC_MINT environment variable not set"

USDCのMintアドレスを環境変数に設定してください：

```bash
export USDC_MINT=<your_usdc_mint_address>
```

### "No deposits yet (UserVault not initialized)"

初めての入金の場合、UserVaultは自動的に作成されます。`deposit`コマンドで入金してください。

### "Insufficient shares!"

出金しようとしているUSDC額に対して、保有しているシェア数が不足しています。`balance`コマンドで現在の持分を確認してください。

## 技術詳細

### PDA（Program Derived Address）

- **State PDA**: `["state"]`
- **UserVault PDA**: `["user_vault", user_pubkey]`

### シェアの計算

- **初回入金**: `shares = deposit_amount`
- **2回目以降の入金**: `shares = (deposit_amount * total_shares) / total_deposited`
- **出金**: `amount = (shares * total_deposited) / total_shares - FEE_AMOUNT`

### 手数料

出金時に0.5 USDC（500,000 raw）が手数料として差し引かれます。

### ECIES暗号化（Phase 2）

**暗号化の流れ:**

1. **鍵変換**: 送信者のEd25519秘密鍵と受信者のEd25519公開鍵をX25519形式に変換
2. **共有秘密鍵**: Diffie-Hellman鍵共有で共有秘密鍵を生成
3. **暗号化**: XSalsa20-Poly1305でメッセージを暗号化
4. **添付**: Solana Memo Programでトランザクションに添付

**復号の流れ:**

1. **履歴取得**: 自分のトランザクション履歴を取得
2. **メモ検出**: Memo Program命令を探す
3. **鍵復元**: 送信者の公開鍵と自分の秘密鍵で共有秘密鍵を復元
4. **復号**: 暗号化データを復号してメッセージを表示

**セキュリティ:**
- エンドツーエンド暗号化（E2EE）
- 送信者と受信者のみが復号可能
- ブロックチェーン上では暗号化されたまま
- 前方秘匿性（Forward Secrecy）
