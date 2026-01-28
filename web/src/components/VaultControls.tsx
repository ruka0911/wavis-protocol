"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, ArrowUpRight, ArrowDownLeft, Send } from "lucide-react";

export default function VaultControls() {
  const [activeTab, setActiveTab] = useState("deposit");

  return (
    <div className="w-full max-w-2xl mx-auto mt-12">
      <div className="flex flex-col gap-8">
        
        {/* --- タブ切り替えエリア (大きく、分かりやすく) --- */}
        <div className="grid grid-cols-3 gap-4 bg-white/5 p-2 rounded-xl border border-white/10">
          {["deposit", "withdraw", "transfer"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`
                relative px-4 py-4 rounded-lg text-sm md:text-base font-bold tracking-widest uppercase transition-all duration-300
                ${activeTab === tab ? "text-black" : "text-gray-400 hover:text-white hover:bg-white/5"}
              `}
            >
              {activeTab === tab && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-[#C9A24D] rounded-lg"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative z-10 flex items-center justify-center gap-2">
                {tab === "deposit" && <ArrowDownLeft className="w-4 h-4" />}
                {tab === "withdraw" && <ArrowUpRight className="w-4 h-4" />}
                {tab === "transfer" && <Send className="w-4 h-4" />}
                {tab}
              </span>
            </button>
          ))}
        </div>

        {/* --- コンテンツエリア --- */}
        <div className="bg-[#0B1220] border border-white/10 p-8 md:p-12 rounded-2xl shadow-2xl relative overflow-hidden">
          
          <AnimatePresence mode="wait">
            
            {/* DEPOSIT TAB */}
            {activeTab === "deposit" && (
              <motion.div
                key="deposit"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-8"
              >
                <div className="flex flex-col gap-3">
                  <label className="text-[#C9A24D] text-sm font-bold tracking-widest uppercase">
                    Deposit Amount
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="0.00"
                      className="w-full bg-transparent border-b-2 border-white/20 text-5xl md:text-6xl text-white font-light py-4 focus:outline-none focus:border-[#C9A24D] transition-colors placeholder:text-white/10"
                    />
                    <span className="absolute right-0 bottom-6 text-xl text-gray-500 font-medium">USDC</span>
                  </div>
                </div>

                <button className="w-full bg-[#C9A24D] text-black text-xl font-bold py-6 rounded-xl hover:bg-white transition-colors shadow-lg mt-4">
                  DEPOSIT TO VAULT
                </button>
              </motion.div>
            )}

            {/* WITHDRAW TAB */}
            {activeTab === "withdraw" && (
              <motion.div
                key="withdraw"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-8"
              >
                <div className="flex flex-col gap-3">
                  <label className="text-[#C9A24D] text-sm font-bold tracking-widest uppercase">
                    Withdraw Amount
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="0.00"
                      className="w-full bg-transparent border-b-2 border-white/20 text-5xl md:text-6xl text-white font-light py-4 focus:outline-none focus:border-[#C9A24D] transition-colors placeholder:text-white/10"
                    />
                    <span className="absolute right-0 bottom-6 text-xl text-gray-500 font-medium">USDC</span>
                  </div>
                </div>

                <button className="w-full border-2 border-[#C9A24D] text-[#C9A24D] text-xl font-bold py-6 rounded-xl hover:bg-[#C9A24D]/10 transition-colors mt-4">
                  WITHDRAW FUNDS
                </button>
              </motion.div>
            )}

            {/* TRANSFER TAB */}
            {activeTab === "transfer" && (
              <motion.div
                key="transfer"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-8"
              >
                {/* 宛先入力 */}
                <div className="flex flex-col gap-3">
                  <label className="text-gray-400 text-xs font-bold tracking-widest uppercase">Recipient Address</label>
                  <input
                    type="text"
                    placeholder="Enter Solana Address"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-4 text-lg text-white focus:outline-none focus:border-[#C9A24D] transition-colors"
                  />
                </div>

                {/* 金額入力 */}
                <div className="flex flex-col gap-3">
                  <label className="text-[#C9A24D] text-sm font-bold tracking-widest uppercase">Amount</label>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="0.00"
                      className="w-full bg-transparent border-b-2 border-white/20 text-4xl md:text-5xl text-white font-light py-2 focus:outline-none focus:border-[#C9A24D] transition-colors placeholder:text-white/10"
                    />
                    <span className="absolute right-0 bottom-4 text-lg text-gray-500">USDC</span>
                  </div>
                </div>

                {/* メモ入力 (錠前アイコンのサイズを修正) */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-gray-400">
                    {/* ここがバグの原因でした。サイズを w-4 h-4 に固定します */}
                    <Lock className="w-4 h-4" />
                    <label className="text-xs font-bold tracking-widest uppercase">Encrypted Memo</label>
                  </div>
                  <textarea
                    placeholder="Message is automatically encrypted..."
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-base text-white focus:outline-none focus:border-[#C9A24D] transition-colors resize-none"
                  />
                </div>

                <button className="w-full bg-red-900/50 border border-red-500/50 text-red-200 text-xl font-bold py-6 rounded-xl hover:bg-red-900/80 transition-colors shadow-lg mt-2 flex items-center justify-center gap-3">
                  <Lock className="w-5 h-5" />
                  SEND SECRETLY
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}