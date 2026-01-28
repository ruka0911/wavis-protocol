"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createTransferInstruction, getAssociatedTokenAddress } from "@solana/spl-token";
import { X, ArrowRight, ShieldCheck, Loader2, AlertCircle, ChevronDown, Check, DollarSign } from "lucide-react";
import { TokenBalance } from "./wallet-control";

const TREASURY_WALLET = new PublicKey("7x6btzwrMophM73sfm5HhUri4hq5TZ5bFyt2DPZ9dZY5");

// 整数（Lamports）で定義します
const WAVIS_FEE_LAMPORT = 10000; // 0.00001 SOL
const WAVIS_FEE_SOL = WAVIS_FEE_LAMPORT / LAMPORTS_PER_SOL; // 表示用のSOL単位
// 安全マージン = Rent-exempt minimum + ネットワーク手数料
// - Rent-exempt: 約890,880 lamports (0.00089088 SOL) - アカウント維持に必須
// - Network fee: 約10,000 lamports (0.00001 SOL) - トランザクション署名手数料
// - 合計: 約900,000 lamports (0.0009 SOL)
const SAFETY_BUFFER_LAMPORT = 900000; 

type SendModalProps = {
  isOpen: boolean;
  onClose: () => void;
  availableTokens?: TokenBalance[];
};

export function SendModal({ isOpen, onClose, availableTokens = [] }: SendModalProps) {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState<TokenBalance | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [txHash, setTxHash] = useState("");
  const [mounted, setMounted] = useState(false);

  // ... (useEffect系は変更なし) ...
  useEffect(() => { setMounted(true); if (isOpen) document.body.style.overflow = "hidden"; else document.body.style.overflow = "unset"; return () => { document.body.style.overflow = "unset"; }; }, [isOpen]);
  useEffect(() => { if (isOpen && availableTokens && availableTokens.length > 0 && !selectedToken) { const sol = availableTokens.find(t => t.symbol === "SOL"); setSelectedToken(sol || availableTokens[0]); } }, [isOpen, availableTokens, selectedToken]);
  useEffect(() => { const handleClickOutside = (event: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) { setIsDropdownOpen(false); } }; document.addEventListener("mousedown", handleClickOutside); return () => document.removeEventListener("mousedown", handleClickOutside); }, []);
  if (!mounted || !isOpen) return null;
  const handleBackdropClick = (e: React.MouseEvent) => { if (e.target === e.currentTarget) onClose(); };

  // 👇 【重要】Maxボタンの完全修正版
  const handleMaxClick = () => {
    if (!selectedToken) return;

    if (selectedToken.symbol === "SOL") {
      // 1. 生の残高（整数）を取得
      const currentLamports = parseInt(selectedToken.rawBalance || "0");
      
      // 2. 整数で引き算 (残高 - (WAVIS手数料 + 安全マージン))
      const maxLamports = currentLamports - (WAVIS_FEE_LAMPORT + SAFETY_BUFFER_LAMPORT);
      
      // 3. 0未満にならないように調整
      const safeLamports = Math.max(0, maxLamports);

      // 4. 表示用の小数に戻す（小数点9桁まで）
      const safeSol = safeLamports / LAMPORTS_PER_SOL;
      setAmount(safeSol.toFixed(9)); // 文字列としてセット
    } else {
      // トークンなら全額
      setAmount(selectedToken.balance.toString());
    }
  };

  // 👇 残高不足チェック（これも整数で行う）
  const isInsufficientBalance = () => {
    if (!selectedToken || !amount) return false;
    const inputAmount = parseFloat(amount);
    if (isNaN(inputAmount)) return false;

    if (selectedToken.symbol === "SOL") {
      const inputLamports = inputAmount * LAMPORTS_PER_SOL;
      const currentLamports = parseInt(selectedToken.rawBalance || "0");
      // 送金額 + WAVIS手数料 + 安全マージン（Rent-exempt + Network fee）
      const totalRequired = inputLamports + WAVIS_FEE_LAMPORT + SAFETY_BUFFER_LAMPORT;
      return totalRequired > currentLamports;
    } else {
      return inputAmount > selectedToken.balance;
    }
  };

  const handleSend = async () => {
    if (!publicKey || !amount || !recipient || !selectedToken) return;
    setIsLoading(true);
    setStatus("idle");

    try {
      const recipientPubkey = new PublicKey(recipient);
      const transaction = new Transaction();
      
      // 【デバッグ】現在の残高を確認
      const currentBalance = await connection.getBalance(publicKey);
      console.log("📊 Current Balance:", currentBalance / LAMPORTS_PER_SOL, "SOL");

      if (selectedToken.symbol === "SOL") {
        // SOL送金
        const sendLamports = Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL);
        
        console.log("💰 Transfer Details:");
        console.log("  - Amount to send:", sendLamports / LAMPORTS_PER_SOL, "SOL");
        console.log("  - WAVIS Fee:", WAVIS_FEE_LAMPORT / LAMPORTS_PER_SOL, "SOL");
        console.log("  - Total required:", (sendLamports + WAVIS_FEE_LAMPORT) / LAMPORTS_PER_SOL, "SOL");
        console.log("  - Remaining after TX:", (currentBalance - sendLamports - WAVIS_FEE_LAMPORT) / LAMPORTS_PER_SOL, "SOL");
        
        // WAVIS Fee (整数指定)
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: TREASURY_WALLET,
            lamports: WAVIS_FEE_LAMPORT,
          })
        );
        
        // 実際の送金
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: recipientPubkey,
            lamports: sendLamports,
          })
        );
      } else {
        // トークン送金（変更なし）
        const mintPubkey = new PublicKey(selectedToken.mint);
        const tokenAmount = BigInt(Math.floor(parseFloat(amount) * Math.pow(10, selectedToken.decimals)));
        const fromAta = await getAssociatedTokenAddress(mintPubkey, publicKey);
        const toAta = await getAssociatedTokenAddress(mintPubkey, recipientPubkey);
        
        transaction.add(
          createTransferInstruction(fromAta, toAta, publicKey, tokenAmount)
        );
        
        // トークン送金の場合もWAVIS手数料（SOL）を追加
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: TREASURY_WALLET,
            lamports: WAVIS_FEE_LAMPORT,
          })
        );
      }

      console.log("📤 Sending transaction...");
      const signature = await sendTransaction(transaction, connection);
      console.log("⏳ Confirming...");
      await connection.confirmTransaction(signature, "confirmed");

      console.log("Transaction Success:", signature);
      setTxHash(signature);
      setStatus("success");
      
      setTimeout(() => {
        onClose();
        setStatus("idle");
        setAmount("");
        setRecipient("");
      }, 3000);

    } catch (error) {
      console.error("Transfer failed:", error);
      setStatus("error");
    } finally {
      setIsLoading(false);
    }
  };
  
  const isBalanceError = isInsufficientBalance();

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] overflow-y-auto bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      <div className="flex min-h-full items-center justify-center p-4 py-10">
        <div 
          className="w-full max-w-md bg-background border border-border shadow-2xl relative animate-in zoom-in-95 duration-200 flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-background border-b border-border p-4 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-bold uppercase tracking-widest">Wavis Transfer</span>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-secondary transition-colors rounded-sm">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {status === "success" ? (
              <div className="text-center py-10">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 mb-4">
                  <ArrowRight className="h-8 w-8 text-emerald-600 -rotate-45" />
                </div>
                <h3 className="text-xl font-bold text-emerald-600 mb-2">Sent Successfully</h3>
                <p className="text-xs font-mono text-muted-foreground break-all bg-secondary/30 p-2 rounded">
                  {txHash}
                </p>
              </div>
            ) : (
              <>
                {/* Select Asset */}
                <div className="space-y-2 relative" ref={dropdownRef}>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Select Asset</label>
                  
                  <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="w-full h-14 bg-secondary/20 border border-border px-4 flex items-center justify-between hover:bg-secondary/30 transition-colors"
                  >
                    {selectedToken ? (
                      <div className="flex items-center gap-3">
                        <div className="h-6 w-6 rounded-full bg-background border border-border overflow-hidden flex items-center justify-center">
                          {selectedToken.logo ? (
                            <img src={selectedToken.logo} alt={selectedToken.symbol} className="h-full w-full object-cover" />
                          ) : (
                            <DollarSign className="h-3 w-3" />
                          )}
                        </div>
                        <div className="flex flex-col items-start">
                          <span className="text-sm font-bold leading-none">{selectedToken.symbol}</span>
                          <span className="text-[10px] text-muted-foreground leading-none mt-1">
                            Bal: {selectedToken.balance.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm font-bold text-muted-foreground">Select Token...</span>
                    )}
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
                  </button>

                  {isDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 z-20 bg-background border border-border shadow-xl max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
                      {(availableTokens || []).map((token) => (
                        <button
                          key={token.mint}
                          onClick={() => {
                            setSelectedToken(token);
                            setIsDropdownOpen(false);
                            setAmount("");
                          }}
                          className="w-full flex items-center justify-between p-3 hover:bg-secondary/50 transition-colors border-b border-border/50 last:border-0"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-secondary overflow-hidden border border-border flex items-center justify-center">
                              {token.logo ? <img src={token.logo} alt={token.symbol} className="h-full w-full object-cover" /> : <span className="text-[10px] font-bold">{token.symbol.slice(0, 2)}</span>}
                            </div>
                            <div className="flex flex-col items-start">
                              <span className="text-sm font-bold">{token.symbol}</span>
                              <span className="text-[10px] text-muted-foreground">{token.name}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-mono font-bold">{token.balance.toLocaleString()}</div>
                            {selectedToken?.mint === token.mint && <Check className="h-3 w-3 text-emerald-500 inline-block ml-1" />}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Amount Input */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Amount</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className={`w-full h-16 bg-background border-2 px-4 text-2xl font-mono font-bold focus:outline-none transition-colors placeholder:text-muted-foreground/30 ${isBalanceError ? "border-red-500 text-red-500" : "border-border focus:border-foreground"}`}
                    />
                    <div className="absolute right-3 top-3 flex flex-col items-end gap-1">
                      <button 
                        onClick={handleMaxClick}
                        className="text-[10px] font-bold uppercase bg-secondary hover:bg-foreground hover:text-background px-2 py-1 transition-colors"
                      >
                        Max
                      </button>
                      <span className={`text-[10px] font-mono ${isBalanceError ? "text-red-500 font-bold" : "text-muted-foreground"}`}>
                        {isBalanceError ? "Insufficient Balance" : `Avail: ${selectedToken?.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Recipient Input */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">To Address</label>
                  <input
                    type="text"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="Solana Address..."
                    className="w-full h-12 bg-secondary/20 border border-border px-4 font-mono text-xs focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                {/* Fee Info */}
                <div className="bg-secondary/10 p-4 border border-border/50 space-y-2">
                   <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">Network Fee</span>
                    <span className="text-[10px] font-mono">~0.000005 SOL</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase text-emerald-600">Wavis Fee</span>
                    <span className="text-[10px] font-mono text-emerald-600">{WAVIS_FEE_SOL} SOL</span>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="p-4 border-t border-border bg-secondary/10 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 h-12 border border-border bg-background text-sm font-bold uppercase tracking-widest hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            
            {status !== "success" && (
              <button
                onClick={handleSend}
                disabled={isLoading || !amount || !recipient || !selectedToken || isBalanceError}
                className={`flex-[2] h-12 text-sm font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                  isBalanceError 
                    ? "bg-red-500/10 text-red-500 cursor-not-allowed" 
                    : "bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    {isBalanceError ? "Low Balance" : "Confirm"}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            )}
          </div>

        </div>
      </div>
    </div>,
    document.body
  );
}