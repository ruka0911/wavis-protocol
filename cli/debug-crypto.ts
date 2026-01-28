import * as dotenv from "dotenv";
dotenv.config();
import * as fs from "fs";
import * as path from "path";
import * as anchor from "@coral-xyz/anchor";
import * as nacl from "tweetnacl";
import * as ed2curve from "ed2curve";
import { PublicKey } from "@solana/web3.js";

// ウォレット読み込み
const anchorTomlPath = path.join(process.cwd(), "Anchor.toml");
const content = fs.readFileSync(anchorTomlPath, "utf-8");
const walletPath = content.match(/wallet\s*=\s*"(.+)"/)[1];
const walletKeypair = anchor.web3.Keypair.fromSecretKey(
  Buffer.from(JSON.parse(fs.readFileSync(path.resolve(walletPath), "utf-8")))
);

console.log("🏥 WAVIS Crypto Doctor 🏥");
console.log("---------------------------------------------------");
console.log(`Wallet PubKey (Ed25519): ${walletKeypair.publicKey.toBase58()}`);

// 1. 鍵変換テスト
console.log("\n[Test 1] Key Conversion...");
const secretRaw = new Uint8Array(walletKeypair.secretKey); // 64 bytes
const secretX = ed2curve.convertSecretKey(secretRaw);
const pubRaw = walletKeypair.publicKey.toBytes();
const pubX = ed2curve.convertPublicKey(pubRaw);

console.log(`Secret Key (Ed25519): ${secretRaw.length} bytes`);
if (secretX) {
    console.log(`Secret Key (X25519) : ${secretX.length} bytes (Converted ✅)`);
} else {
    console.error(`Secret Key (X25519) : FAILED ❌`);
}

if (pubX) {
    console.log(`Public Key (X25519) : ${pubX.length} bytes (Converted ✅)`);
} else {
    console.error(`Public Key (X25519) : FAILED ❌`);
}

if (!secretX || !pubX) {
    console.error("\n💀 FATAL: Key conversion failed. Aborting.");
    process.exit(1);
}

// 2. 暗号化テスト (自分 -> 自分)
console.log("\n[Test 2] Local Encryption (Self -> Self)...");
const message = "WAVIS_TEST_MESSAGE";
const nonce = nacl.randomBytes(24);
const msgBytes = Buffer.from(message);

console.log(`Message: "${message}"`);
console.log(`Nonce  : ${Buffer.from(nonce).toString('hex').substring(0,10)}...`);

try {
    const cipher = nacl.box(msgBytes, nonce, pubX, secretX);
    console.log(`Cipher : ${cipher.length} bytes generated ✅`);

    // 3. 復号テスト
    console.log("\n[Test 3] Local Decryption...");
    const decrypted = nacl.box.open(cipher, nonce, pubX, secretX); // SenderPub=PubX, RecipientSec=SecretX

    if (decrypted) {
        const text = Buffer.from(decrypted).toString('utf8');
        console.log(`Result : "${text}"`);
        if (text === message) {
            console.log("Status : SUCCESS 🎉 (Logic is correct)");
        } else {
            console.log("Status : CONTENT MISMATCH ⚠️");
        }
    } else {
        console.error("Status : FAILED 💀 (nacl.box.open returned null)");
    }

} catch (e) {
    console.error("Status : EXCEPTION 💀", e);
}
console.log("---------------------------------------------------");