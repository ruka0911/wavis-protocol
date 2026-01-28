"use client";

import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Wallet, Shield, Eye, Lock, RefreshCw } from "lucide-react";

export function BalanceCard() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  
  const [balance, setBalance] = useState<number>(0);
  const [shieldedBalance, setShieldedBalance] = useState<number>(0);
  const [usdRate, setUsdRate] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 1. 公開残高 (Public Balance) - 通信が必要
  const fetchPublicBalance = async () => {
    if (publicKey) {
      try {
        const bal = await connection.getBalance(publicKey);
        setBalance(bal / LAMPORTS_PER_SOL);
      } catch (e) {
        console.warn("Rate limit hit, skipping update.");
      }
    }
  };

  // 2. 隠し残高 (Shielded Balance) - 通信不要 (高速でOK)
  const fetchShieldedBalance = () => {
    const saved = localStorage.getItem("wavis_shielded_balance");
    const val = saved ? parseFloat(saved) : 0.00;
    
    setShieldedBalance(prev => {
      if (prev !== val) return val;
      return prev;
    });
  };

  // 3. 価格取得 (一度だけでOK)
  useEffect(() => {
    fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd")
      .then(res => res.json())
      .then(data => setUsdRate(data.solana.usd))
      .catch(() => setUsdRate(0));
  }, []);

  // 4. イベントリスナー (入出金時に即更新するためのトリガー)
  useEffect(() => {
    const handleUpdate = () => {
      // 少し待ってから更新 (RPCの反映待ち)
      setTimeout(fetchPublicBalance, 2000);
      fetchShieldedBalance();
    };
    window.addEventListener("wavis_balance_update", handleUpdate);
    return () => window.removeEventListener("wavis_balance_update", handleUpdate);
  }, [publicKey, connection]);

  // 5. 定期更新タイマー (ここを分離！)
  useEffect(() => {
    // 初回実行
    fetchPublicBalance();
    fetchShieldedBalance();

    // Shieldedはローカルなので 1秒更新でもOK
    const localInterval = setInterval(fetchShieldedBalance, 1000);

    // Publicはサーバーに負荷をかけるので 30秒更新に変更 (500ms -> 30000ms)
    const networkInterval = setInterval(fetchPublicBalance, 30000);

    return () => {
      clearInterval(localInterval);
      clearInterval(networkInterval);
    };
  }, [publicKey, connection]);

  // 手動更新ボタン用
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await fetchPublicBalance();
    fetchShieldedBalance();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
      
      {/* 🌞 PUBLIC BALANCE */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-background/50 p-6 shadow-sm group">
        <div className="flex items-center justify-between space-y-0 pb-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Public Balance
          </h3>
          <button onClick={handleManualRefresh} className={`text-muted-foreground hover:text-foreground transition-colors ${isRefreshing ? "animate-spin" : ""}`}>
             <RefreshCw className="h-3 w-3" />
          </button>
        </div>
        <div className="mt-2">
          <div className="text-2xl font-bold font-mono">
            {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 9 })} SOL
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            ≈ ${(balance * usdRate).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="absolute right-0 top-0 h-full w-1 bg-gray-500/20" />
      </div>

      {/* 🌚 SHIELDED BALANCE */}
      <div className="relative overflow-hidden rounded-xl border border-emerald-500/30 bg-black/60 p-6 shadow-md group">
        <div className="absolute inset-0 bg-emerald-500/5 group-hover:bg-emerald-500/10 transition-colors duration-500" />
        
        <div className="relative flex items-center justify-between space-y-0 pb-2">
          <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-500 flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Shielded in Vault
          </h3>
          <Lock className="h-4 w-4 text-emerald-500" />
        </div>
        <div className="relative mt-2">
          <div className="text-2xl font-bold font-mono text-white transition-all duration-300">
            {shieldedBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 9 })} SOL
          </div>
          <p className="text-xs text-emerald-500/70 mt-1 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Untraceable & Staking
          </p>
        </div>
      </div>

    </div>
  );
}