"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, CreditCard, Activity, Settings, LogOut, Shield, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWallet } from "@solana/wallet-adapter-react"; // 👈 フックを追加

const menuItems = [
  { icon: LayoutGrid, label: "Overview", href: "/dashboard" },
  { icon: CreditCard, label: "Accounts", href: "/dashboard/accounts" },
  { icon: Activity, label: "Activity", href: "/dashboard/activity" },
  { icon: Settings, label: "Settings", href: "/dashboard/settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  // 👇 ウォレットの状態と切断関数を取得
  const { disconnect, connected, connecting, wallet } = useWallet();

  // 切断処理
  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (error) {
      console.error("Failed to disconnect:", error);
    }
  };

  return (
    <div className="hidden w-64 flex-col border-r border-border bg-primary text-primary-foreground p-6 md:flex h-screen sticky top-0">
      {/* Logo Area */}
      <div className="mb-12 flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 items-center justify-center bg-primary-foreground text-primary rounded-none">
          <Shield className="h-6 w-6" strokeWidth={3} />
        </div>
        <div className="flex flex-col">
          <span className="text-xl font-bold tracking-tighter text-primary-foreground leading-none">
            WAVIS
          </span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-primary-foreground/60">
            Secure Vault
          </span>
        </div>
      </div>

      {/* Menu Area */}
      <nav className="flex-1 space-y-2">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 px-4 py-3 text-sm font-bold uppercase tracking-wider transition-all",
                isActive
                  ? "bg-primary-foreground text-primary shadow-sm"
                  : "text-primary-foreground/60 hover:bg-primary-foreground/10 hover:text-primary-foreground"
              )}
            >
              <item.icon className={cn("h-4 w-4", isActive ? "stroke-[3px]" : "stroke-[2px]")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer Area (機能化) */}
      <div className="mt-auto pt-8 border-t border-primary-foreground/20">
        <div className="px-4 mb-4">
          <div className="text-[10px] uppercase tracking-widest text-primary-foreground/40 mb-1">
            Status
          </div>
          
          {/* 状態によって表示を切り替え */}
          {connected ? (
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              System Operational
            </div>
          ) : connecting ? (
            <div className="flex items-center gap-2 text-xs font-bold text-yellow-400">
              <Wifi className="h-3 w-3 animate-pulse" />
              Establishing Link...
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs font-bold text-red-400">
              <WifiOff className="h-3 w-3" />
              Offline / Disconnected
            </div>
          )}
        </div>
        
        {/* 接続中のみログアウトボタンを表示、または無効化状態で表示 */}
        <button 
          onClick={handleDisconnect}
          disabled={!connected}
          className={cn(
            "flex w-full items-center gap-3 px-4 py-3 text-sm font-bold uppercase tracking-wider transition-colors rounded-none",
            connected 
              ? "text-red-400 hover:bg-red-950/30 hover:text-red-300 cursor-pointer" 
              : "text-primary-foreground/20 cursor-not-allowed"
          )}
        >
          <LogOut className="h-4 w-4" />
          Disconnect
        </button>
      </div>
    </div>
  );
}