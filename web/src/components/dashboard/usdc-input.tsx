"use client";

import { useState } from "react";
import { Shield, ArrowRight } from "lucide-react";

export function UsdcInput() {
  const [amount, setAmount] = useState("");

  return (
    <div className="w-full pt-12 pb-20">
      {/* ラベルエリア */}
      <div className="flex justify-between items-end mb-8 border-b border-border pb-2">
        <label htmlFor="amount-input" className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Transfer Amount
        </label>
        <div className="text-xs font-mono text-muted-foreground">
          AVAIL: <span className="text-foreground font-bold">124,582.34 USDC</span>
        </div>
      </div>
      
      {/* 巨大入力エリア */}
      <div className="relative flex flex-col items-center justify-center py-12">
        <div className="flex items-baseline justify-center w-full">
          {/* 通貨記号 */}
          <span className="text-4xl md:text-6xl font-light text-muted-foreground mr-2 md:mr-4 select-none">
            $
          </span>
          
          {/* 入力フィールド本体：ここがデザインの肝 */}
          <input
            id="amount-input"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="w-full max-w-[800px] bg-transparent text-center font-mono text-[80px] md:text-[120px] leading-none font-bold tracking-tighter text-foreground placeholder:text-muted-foreground/10 focus:outline-none focus:ring-0 border-none p-0 m-0"
            autoComplete="off"
            autoFocus
          />
        </div>
        
        {/* 通貨単位 */}
        <div className="mt-4 text-sm font-bold uppercase tracking-widest text-muted-foreground">
          USD Coin (Solana)
        </div>
      </div>

      {/* アクションボタンエリア */}
      <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          type="button"
          className="group relative flex items-center justify-center gap-3 bg-primary h-[72px] text-primary-foreground text-sm font-bold uppercase tracking-widest hover:opacity-90 transition-all active:scale-[0.98]"
        >
          <Shield className="h-5 w-5" />
          <span>Shield Assets</span>
        </button>

        <button
          type="button"
          className="group flex items-center justify-center gap-3 border border-input bg-background h-[72px] text-foreground text-sm font-bold uppercase tracking-widest hover:bg-foreground hover:text-background transition-all active:scale-[0.98]"
        >
          <span>Transfer Funds</span>
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </button>
      </div>
    </div>
  );
}