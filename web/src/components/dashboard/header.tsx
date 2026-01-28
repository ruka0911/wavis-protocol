"use client";

import { Bell } from "lucide-react";
// 👇 自作したコントローラーを読み込む
import { WalletControl } from "@/components/dashboard/wallet-control";

export function Header() {
  return (
    <header className="sticky top-0 z-10 flex h-20 items-center justify-between border-b border-border bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      
      {/* 左側 */}
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-bold uppercase tracking-widest text-foreground">
          Dashboard
        </h2>
        <div className="hidden h-4 w-[1px] bg-border md:block"></div>
        <span className="hidden text-xs font-mono text-muted-foreground md:block">
          Welcome back, Commander.
        </span>
      </div>

      {/* 右側 */}
      <div className="flex items-center gap-4">
        <button className="flex h-10 w-10 items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
          <Bell className="h-5 w-5" />
        </button>

        {/* 👇 ここを差し替えました */}
        <WalletControl />
      </div>
    </header>
  );
}