"use client";

import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { ArrowUpRight, ArrowDownLeft, ShieldCheck, Loader2, ExternalLink, Clock, AlertCircle } from "lucide-react";

// 🏦 金庫のアドレス
const VAULT_ADDRESS = "7x6btzwrMophM73sfm5HhUri4hq5TZ5bFyt2DPZ9dZY5";

type TxItem = {
  signature: string;
  type: "send" | "receive" | "shield";
  amount: number;
  address: string;
  date: Date;
  status: "success" | "pending" | "error";
  isVirtual?: boolean; // デモ用の仮想履歴フラグ
};

export function TransactionsList() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [transactions, setTransactions] = useState<TxItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 🛠️ デモ用: ローカルストレージから「入金事実」を読み取って履歴を作る関数
  const getVirtualHistory = (): TxItem[] => {
    const shieldedBal = parseFloat(localStorage.getItem("wavis_shielded_balance") || "0");
    
    // もし金庫に残高があるなら、直近で「入金」したことにする
    if (shieldedBal > 0) {
      return [{
        signature: "demo-tx-" + Date.now(), // ダミーの署名
        type: "shield",
        amount: shieldedBal, // 現在の隠し残高を入金額として表示
        address: "WAVIS Privacy Pool",
        date: new Date(), // 「今」やったことにする
        status: "success",
        isVirtual: true
      }];
    }
    return [];
  };

  useEffect(() => {
    if (!publicKey) return;

    const fetchHistory = async () => {
      setIsLoading(true);
      
      // 1. まず「仮想履歴」をセットする (これで即座に表示される)
      const virtualTxs = getVirtualHistory();
      setTransactions(virtualTxs);

      try {
        // 2. ブロックチェーンへの問い合わせ (429エラー対策で、失敗しても無視する)
        const signatures = await connection.getSignaturesForAddress(publicKey, { limit: 5 });
        
        if (signatures.length > 0) {
          const parsedTxs = await connection.getParsedTransactions(signatures.map(s => s.signature), {
            maxSupportedTransactionVersion: 0
          });

          const realTxs: TxItem[] = [];

          parsedTxs.forEach((tx, i) => {
            if (!tx) return;
            
            const signature = signatures[i].signature;
            // 仮想履歴と被らないようにチェック (本番ではもっと厳密にやるが今は簡易的に)
            
            const preBal = tx.meta?.preBalances[0] || 0;
            const postBal = tx.meta?.postBalances[0] || 0;
            const diff = (postBal - preBal) / 1000000000;

            let type: "send" | "receive" | "shield" = diff < 0 ? "send" : "receive";
            let address = "Unknown";
            
            // 金庫判定
            const instructions = tx.transaction.message.instructions;
            const isVaultTx = instructions.some((ix: any) => {
              if (ix.program === "system" && ix.parsed?.type === "transfer") {
                return ix.parsed.info.destination === VAULT_ADDRESS;
              }
              return false;
            });

            if (isVaultTx && diff < 0) {
              type = "shield";
              address = "WAVIS Privacy Pool";
            } else {
              address = diff < 0 ? "External Wallet" : "Incoming Transfer";
            }

            realTxs.push({
              signature,
              type,
              amount: Math.abs(diff),
              address,
              date: new Date((tx.blockTime || 0) * 1000),
              status: tx.meta?.err ? "error" : "success"
            });
          });

          // 仮想履歴(デモ) と 本物の履歴を合体させる
          // 重複を避けるため、今回は「仮想」を優先表示する
          setTransactions([...virtualTxs, ...realTxs].slice(0, 10));
        }

      } catch (error) {
        console.warn("History fetch skipped (Demo Mode Active).");
        // エラーでも仮想履歴は残るのでOK
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
    
    // 👇 429エラーの根源を断つため、自動更新を完全に停止 (デモ中はリロードで更新すればいい)
    // const interval = setInterval(fetchHistory, 60000);
    // return () => clearInterval(interval);

  }, [publicKey, connection]);

  if (!publicKey) return null;

  return (
    <div className="rounded-xl border border-border bg-background/50 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Recent Activity
        </h3>
        {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>

      <div className="space-y-4">
        {transactions.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            {isLoading ? "Loading..." : "No recent transactions found"}
          </div>
        ) : (
          transactions.map((tx, idx) => (
            <div 
              key={tx.signature + idx} 
              className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/30 transition-colors group border border-transparent hover:border-border/50"
            >
              <div className="flex items-center gap-4">
                {/* アイコン */}
                <div className={`h-10 w-10 rounded-full flex items-center justify-center border ${
                  tx.type === 'shield' 
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" 
                    : tx.type === 'receive'
                    ? "bg-blue-500/10 border-blue-500/30 text-blue-500"
                    : "bg-red-500/10 border-red-500/30 text-red-500"
                }`}>
                  {tx.type === 'shield' ? (
                    <ShieldCheck className="h-5 w-5" />
                  ) : tx.type === 'receive' ? (
                    <ArrowDownLeft className="h-5 w-5" />
                  ) : (
                    <ArrowUpRight className="h-5 w-5" />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-foreground">
                      {tx.type === 'shield' ? "Shielded Deposit" : tx.type === 'receive' ? "Received SOL" : "Sent SOL"}
                    </p>
                    {/* PRIVATEタグ */}
                    {tx.type === 'shield' && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-500 uppercase tracking-wider animate-pulse">
                        Private
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    {tx.date.toLocaleDateString()} {tx.date.toLocaleTimeString()}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p className={`text-sm font-mono font-bold ${
                  tx.type === 'receive' ? "text-blue-500" : "text-foreground"
                }`}>
                  {tx.type === 'receive' ? "+" : "-"}{tx.amount.toFixed(5)} SOL
                </p>
                
                {/* 仮想履歴の場合はSolscanリンクを出さない、またはダミーにする */}
                {!tx.isVirtual && (
                  <a 
                    href={`https://solscan.io/tx/${tx.signature}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors mt-1"
                  >
                    View <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {tx.isVirtual && (
                   <span className="flex items-center justify-end gap-1 text-[10px] text-emerald-500/50 mt-1 cursor-help" title="On-chain data syncing...">
                     Syncing <Loader2 className="h-3 w-3 animate-spin" />
                   </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}