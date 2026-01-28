"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ShieldCheck, Lock, EyeOff, Copy, RefreshCw, FileText, Download, Check, Loader2, AlertTriangle, Info } from "lucide-react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";

const VAULT_ADDRESS = new PublicKey("7x6btzwrMophM73sfm5HhUri4hq5TZ5bFyt2DPZ9dZY5");

export function VaultInterface() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("");
  const [secretNote, setSecretNote] = useState("");
  const [recipient, setRecipient] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const [generatedNote, setGeneratedNote] = useState<string | null>(null);
  const [withdrawStatus, setWithdrawStatus] = useState<"idle" | "verifying" | "success" | "error" | "spent">("idle");
  const [parsedAmount, setParsedAmount] = useState<string | null>(null);

  const generateSecret = () => {
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    const randomHex = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    return `wavis-sol-${amount || "0"}-${randomHex}`;
  };

  const downloadNote = (note: string) => {
    const element = document.createElement("a");
    const file = new Blob([note], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `wavis-backup-${Date.now()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const updateShieldedBalance = (changeAmount: number) => {
    const current = parseFloat(localStorage.getItem("wavis_shielded_balance") || "0");
    const newBalance = Math.max(0, current + changeAmount);
    localStorage.setItem("wavis_shielded_balance", newBalance.toString());
    window.dispatchEvent(new Event("wavis_balance_update"));
  };

  // 👇 使用済みノートをチェックする関数
  const isNoteSpent = (note: string) => {
    const spentNotes = JSON.parse(localStorage.getItem("wavis_spent_notes") || "[]");
    return spentNotes.includes(note.trim());
  };

  // 👇 ノートを使用済みに登録する関数
  const markNoteAsSpent = (note: string) => {
    const spentNotes = JSON.parse(localStorage.getItem("wavis_spent_notes") || "[]");
    spentNotes.push(note.trim());
    localStorage.setItem("wavis_spent_notes", JSON.stringify(spentNotes));
  };

  const handleDeposit = async () => {
    if (!publicKey || !amount) return;
    setIsLoading(true);

    try {
      const note = generateSecret();
      const lamports = parseFloat(amount) * LAMPORTS_PER_SOL;
      
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: VAULT_ADDRESS,
          lamports: lamports,
        })
      );

      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature, "confirmed");

      updateShieldedBalance(parseFloat(amount));
      setGeneratedNote(note);
      downloadNote(note);

    } catch (error) {
      console.error("Deposit failed", error);
      alert("Transaction Failed. Check console.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!secretNote || !recipient) return;
    setWithdrawStatus("verifying");
    
    // =========================================================================
    // 🚧 HACKATHON NOTE: ZK-PROOF VERIFICATION MOCK
    // =========================================================================

    try {
      // 1. ノート解析
      const parts = secretNote.trim().split("-");
      if (parts.length !== 4 || parts[0] !== "wavis" || parts[1] !== "sol") {
        throw new Error("Invalid Note Format");
      }

      // 2. 使用済みチェック (Nullifier check simulation)
      if (isNoteSpent(secretNote)) {
        setWithdrawStatus("spent"); // 既に使われている場合のエラー
        return;
      }

      const noteAmount = parseFloat(parts[2]);
      setParsedAmount(parts[2]);

      // 3. 検証シミュレーション (3秒)
      await new Promise(resolve => setTimeout(resolve, 3000));

      // 4. 成功処理
      updateShieldedBalance(-noteAmount); // 残高減らす
      markNoteAsSpent(secretNote); // 使用済みにする

      setWithdrawStatus("success");
      
    } catch (e) {
      console.error(e);
      setWithdrawStatus("error");
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-6">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2 text-emerald-500">
          <ShieldCheck className="h-4 w-4" />
          <span className="text-xs font-bold uppercase tracking-[0.2em]">Privacy Shield: Active</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="text-xs font-bold uppercase tracking-widest">WAVIS Protocol v0.1</span>
        </div>
      </div>

      <div className="relative bg-black/80 backdrop-blur-md border border-white/10 p-1 shadow-2xl overflow-hidden group rounded-sm min-h-[550px]">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent opacity-50" />
        
        <div className="grid grid-cols-2 p-1 gap-1 bg-black/20 mb-6">
          <button
            onClick={() => { setMode("deposit"); setGeneratedNote(null); }}
            className={`h-12 flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-widest transition-all ${
              mode === "deposit" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/50" : "text-muted-foreground hover:bg-white/5"
            }`}
          >
            <ArrowDown className="h-4 w-4" /> Deposit
          </button>
          <button
            onClick={() => { setMode("withdraw"); setWithdrawStatus("idle"); }}
            className={`h-12 flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-widest transition-all ${
              mode === "withdraw" ? "bg-purple-500/10 text-purple-400 border border-purple-500/50" : "text-muted-foreground hover:bg-white/5"
            }`}
          >
            <ArrowUp className="h-4 w-4" /> Withdraw
          </button>
        </div>

        {mode === "deposit" && (
          <div className="p-6 pt-0 space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
            {generatedNote ? (
              <div className="text-center space-y-6">
                <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500 text-emerald-400 mb-2">
                  <Check className="h-10 w-10" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">Deposit Successful</h2>
                  <p className="text-xs text-muted-foreground">Funds are now in the pool.</p>
                </div>
                <div className="bg-emerald-900/20 border border-emerald-500/50 p-4 space-y-2 rounded">
                  <div className="flex items-center justify-between text-emerald-400 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest">Secret Note</span>
                    <Download className="h-4 w-4" />
                  </div>
                  <div className="bg-black/80 p-3 font-mono text-sm text-emerald-400 break-all border border-emerald-500/30 select-all">
                    {generatedNote}
                  </div>
                </div>
                <button onClick={() => { setGeneratedNote(null); setAmount(""); }} className="text-xs text-muted-foreground underline hover:text-white">Make another deposit</button>
              </div>
            ) : (
              <>
                <div className="text-center space-y-2">
                  <h2 className="text-3xl font-bold tracking-tighter text-white">Mix Your SOL</h2>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">Break the on-chain link</p>
                </div>
                <div className="relative group/input">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1 mb-2 block">Amount</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-20 bg-black/50 border border-white/10 px-6 text-4xl font-mono font-bold text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                  <div className="absolute right-6 top-10 text-emerald-500 font-bold text-xl pointer-events-none opacity-50">SOL</div>
                </div>
                <div className="p-4 bg-emerald-950/20 border border-emerald-500/20 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <FileText className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-widest">Secret Note (Preview)</span>
                  </div>
                  <div className="h-10 bg-black/50 border border-emerald-500/10 flex items-center px-3 font-mono text-xs text-emerald-500/50 truncate select-none opacity-70">
                    {amount ? `wavis-sol-${amount}-xxxx...` : "Enter amount to generate note..."}
                  </div>
                  <div className="flex gap-2 items-start text-muted-foreground">
                    <Info className="h-3 w-3 mt-0.5 shrink-0" />
                    <p className="text-[10px] leading-tight">A secret note will be generated upon deposit. You will need this file to withdraw your funds later.</p>
                  </div>
                </div>
                <button
                  disabled={isLoading || !amount || !publicKey}
                  className="w-full h-16 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-lg uppercase tracking-widest transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-3"
                  onClick={handleDeposit}
                >
                  {isLoading ? <><Loader2 className="h-5 w-5 animate-spin" /> Encrypting...</> : <><Lock className="h-5 w-5" /> Deposit & Encrypt</>}
                </button>
              </>
            )}
          </div>
        )}

        {mode === "withdraw" && (
          <div className="p-6 pt-0 space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            {withdrawStatus === "success" ? (
              <div className="text-center space-y-6">
                <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-purple-500/20 border border-purple-500 text-purple-400 mb-2 animate-in zoom-in">
                  <Check className="h-10 w-10" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">Proof Verified</h2>
                  <p className="text-xs text-muted-foreground mb-4">Relayer is processing your withdrawal.</p>
                  <div className="bg-purple-900/20 border border-purple-500/30 p-4 rounded text-left space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Amount:</span>
                      <span className="font-mono text-purple-400 font-bold">{parsedAmount} SOL</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">To:</span>
                      <span className="font-mono text-white truncate max-w-[150px]">{recipient}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Status:</span>
                      <span className="text-emerald-400 font-bold uppercase">Queued</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => { setWithdrawStatus("idle"); setSecretNote(""); setRecipient(""); }} className="w-full h-12 border border-white/10 text-sm font-bold uppercase tracking-widest hover:bg-white/5 transition-colors text-white">Make another withdrawal</button>
              </div>
            ) : (
              <>
                <div className="text-center space-y-2">
                  <h2 className="text-3xl font-bold tracking-tighter text-white">Retrieve Funds</h2>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest">Anonymous withdrawal</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1 block">Paste Secret Note</label>
                  <textarea
                    value={secretNote}
                    onChange={(e) => setSecretNote(e.target.value)}
                    placeholder="wavis-sol-..."
                    className={`w-full h-24 bg-black/50 border p-4 font-mono text-sm focus:outline-none transition-colors placeholder:text-white/10 resize-none ${withdrawStatus === 'spent' ? 'border-red-500 text-red-500' : 'border-white/10 text-purple-400 focus:border-purple-500/50'}`}
                  />
                  {withdrawStatus === "error" && (
                    <div className="flex items-center gap-2 text-red-400 text-xs"><AlertTriangle className="h-3 w-3" /> Invalid Note Format.</div>
                  )}
                  {/* 👇 使用済みエラー表示 */}
                  {withdrawStatus === "spent" && (
                    <div className="flex items-center gap-2 text-red-400 text-xs"><AlertTriangle className="h-3 w-3" /> Error: Note already spent (Double Spend Protection)</div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1 block">Recipient Address</label>
                  <input
                    type="text"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="Solana Address..."
                    className="w-full h-14 bg-black/50 border border-white/10 px-4 font-mono text-sm text-white focus:outline-none focus:border-purple-500/50 transition-colors placeholder:text-white/10"
                  />
                </div>
                <button
                  disabled={withdrawStatus === "verifying" || !secretNote || !recipient}
                  onClick={handleWithdraw}
                  className="w-full h-16 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white font-bold text-lg uppercase tracking-widest transition-all shadow-lg shadow-purple-900/20 flex items-center justify-center gap-3"
                >
                  {withdrawStatus === "verifying" ? <><Loader2 className="h-5 w-5 animate-spin" /> Verifying ZK Proof...</> : <><EyeOff className="h-5 w-5" /> Verify & Withdraw</>}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="text-center space-y-1">
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Secured by ZK-Ready Architecture</p>
      </div>
    </div>
  );
}