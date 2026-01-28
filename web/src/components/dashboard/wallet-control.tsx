"use client";

import { useState, useEffect, useRef } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { Copy, LogOut, Send, ExternalLink, ChevronDown, RefreshCw, Wallet, Check, DollarSign } from "lucide-react";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SendModal } from "@/components/dashboard/send-modal";

export type TokenBalance = {
  mint: string;
  symbol: string;
  name: string;
  balance: number;
  rawBalance: string;
  decimals: number;
  price: number;
  valueUsd: number;
  logo: string;
  coingeckoId?: string;
};

const KNOWN_TOKENS: Record<string, { symbol: string; name: string; logo: string; coingeckoId: string }> = {
  "So11111111111111111111111111111111111111112": { 
    symbol: "SOL", 
    name: "Solana", 
    logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png",
    coingeckoId: "solana"
  },
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": { 
    symbol: "USDC", 
    name: "USD Coin", 
    logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/assets/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png",
    coingeckoId: "usd-coin"
  },
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": { 
    symbol: "USDT", 
    name: "Tether USD", 
    logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/assets/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png",
    coingeckoId: "tether"
  },
};

export function WalletControl() {
  const { publicKey, disconnect, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { connection } = useConnection();
  
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [totalUsd, setTotalUsd] = useState<string>("0.00");
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchData = async () => {
    if (!publicKey) return;
    setIsLoading(true);
    try {
      const solBal = await connection.getBalance(publicKey);
      const solBalance = solBal / LAMPORTS_PER_SOL;

      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: TOKEN_PROGRAM_ID,
      });

      const tempTokens: TokenBalance[] = [];
      const coingeckoIdsToFetch: string[] = [];
      const jupiterMintsToFetch: string[] = [];

      const solInfo = KNOWN_TOKENS["So11111111111111111111111111111111111111112"];
      tempTokens.push({
        mint: "So11111111111111111111111111111111111111112",
        symbol: solInfo.symbol,
        name: solInfo.name,
        balance: solBalance,
        rawBalance: solBal.toString(),
        decimals: 9,
        price: 0,
        valueUsd: 0,
        logo: solInfo.logo,
        coingeckoId: solInfo.coingeckoId
      });
      coingeckoIdsToFetch.push(solInfo.coingeckoId);

      tokenAccounts.value.forEach((account) => {
        const info = account.account.data.parsed.info;
        const mint = info.mint;
        const amount = info.tokenAmount.uiAmount;
        const rawAmount = info.tokenAmount.amount;
        const decimals = info.tokenAmount.decimals;

        if (amount > 0) {
          if (KNOWN_TOKENS[mint]) {
            tempTokens.push({
              mint,
              symbol: KNOWN_TOKENS[mint].symbol,
              name: KNOWN_TOKENS[mint].name,
              balance: amount,
              rawBalance: rawAmount,
              decimals,
              price: 0,
              valueUsd: 0,
              logo: KNOWN_TOKENS[mint].logo,
              coingeckoId: KNOWN_TOKENS[mint].coingeckoId
            });
            coingeckoIdsToFetch.push(KNOWN_TOKENS[mint].coingeckoId);
          } else {
            tempTokens.push({
              mint,
              symbol: "UNKNOWN",
              name: "Unknown Token",
              balance: amount,
              rawBalance: rawAmount,
              decimals,
              price: 0,
              valueUsd: 0,
              logo: "" 
            });
            jupiterMintsToFetch.push(mint);
          }
        }
      });

      const prices: Record<string, number> = {};

      if (coingeckoIdsToFetch.length > 0) {
        try {
          const cgRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoIdsToFetch.join(",")}&vs_currencies=usd`);
          const cgData = await cgRes.json();
          tempTokens.forEach(t => {
            if (t.coingeckoId && cgData[t.coingeckoId]?.usd) {
              prices[t.mint] = cgData[t.coingeckoId].usd;
            }
          });
        } catch (e) { console.error(e); }
      }

      if (jupiterMintsToFetch.length > 0) {
        try {
          const jupIds = jupiterMintsToFetch.slice(0, 50).join(",");
          const jupRes = await fetch(`https://api.jup.ag/price/v2?ids=${jupIds}`);
          const jupData = await jupRes.json();
          jupiterMintsToFetch.forEach(mint => {
             const p = jupData?.data?.[mint]?.price;
             if (p) prices[mint] = parseFloat(p);
          });
        } catch (e) { console.error(e); }
      }

      let total = 0;
      const finalTokens = tempTokens.map(t => {
        const price = prices[t.mint] || 0;
        const valueUsd = t.balance * price;
        total += valueUsd;
        return { ...t, price, valueUsd };
      }).filter(t => KNOWN_TOKENS[t.mint] || t.valueUsd >= 0.01);

      finalTokens.sort((a, b) => b.valueUsd - a.valueUsd);
      setTokens(finalTokens);
      setTotalUsd(total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

    } catch (e) {
      console.error("Fetch error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [publicKey, connection]);

  const shortenAddress = (key: PublicKey) => {
    const str = key.toBase58();
    return `${str.slice(0, 4)}...${str.slice(-4)}`;
  };

  if (!connected || !publicKey) {
    return (
      <button
        onClick={() => setVisible(true)}
        className="flex h-10 items-center gap-2 bg-primary px-6 text-sm font-bold uppercase tracking-widest text-primary-foreground hover:opacity-90 transition-opacity"
      >
        <Wallet className="h-4 w-4" />
        Connect Wallet
      </button>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-10 items-center gap-3 border border-input bg-background px-4 hover:bg-secondary transition-colors min-w-[160px] justify-between"
      >
        <div className="flex items-center gap-3">
          <div className={`h-2 w-2 rounded-full ${isLoading ? "bg-yellow-400 animate-ping" : "bg-emerald-500"}`} />
          <span className="font-mono font-bold text-sm tracking-tight">{shortenAddress(publicKey)}</span>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-80 border border-border bg-background p-4 shadow-xl animate-in fade-in zoom-in-95 duration-200">
          
          <div className="mb-6 text-center">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Total Balance</div>
            <div className="text-3xl font-bold tracking-tighter text-foreground">
              ${totalUsd}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-6">
            <ActionButton 
              icon={Send} 
              label="Send" 
              onClick={() => {
                setIsOpen(false);
                setIsSendModalOpen(true);
              }} 
            />
            <CopyButton textToCopy={publicKey.toBase58()} />
            <ActionButton icon={ExternalLink} label="Scan" onClick={() => window.open(`https://solscan.io/account/${publicKey.toBase58()}`, '_blank')} />
            <ActionButton icon={LogOut} label="Exit" onClick={disconnect} danger />
          </div>

          <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
            <div className="flex items-center justify-between border-b border-border pb-2 mb-2 sticky top-0 bg-background z-10">
              <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Assets</span>
              <RefreshCw 
                className={`h-3 w-3 text-muted-foreground cursor-pointer hover:text-foreground ${isLoading ? "animate-spin" : ""}`} 
                onClick={fetchData}
              />
            </div>

            {tokens.length === 0 ? (
               <div className="text-center py-4 text-xs text-muted-foreground">No assets found</div>
            ) : (
              tokens.map((token) => (
                <div key={token.mint} className="flex items-center justify-between p-2 hover:bg-secondary/50 transition-colors rounded-sm cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center overflow-hidden border border-border">
                       {token.logo ? (
                         <img src={token.logo} alt={token.symbol} className="h-full w-full object-cover" />
                       ) : (
                         <span className="text-[10px] font-bold text-muted-foreground">?</span>
                       )}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold group-hover:text-primary transition-colors">{token.symbol}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {token.price > 0 ? `$${token.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '-'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-mono font-bold">{token.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {token.valueUsd > 0 ? `$${token.valueUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '-'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <SendModal 
        isOpen={isSendModalOpen} 
        onClose={() => setIsSendModalOpen(false)} 
        availableTokens={tokens} 
      />
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick, danger }: any) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 p-2 border border-border hover:bg-secondary transition-colors ${danger ? "hover:bg-red-50 hover:border-red-200 hover:text-red-500" : ""}`}
    >
      <Icon className="h-4 w-4" />
      <span className="text-[10px] font-bold uppercase">{label}</span>
    </button>
  );
}

function CopyButton({ textToCopy }: { textToCopy: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed", err);
    }
  };
  return (
    <button 
      onClick={handleCopy}
      className="flex flex-col items-center justify-center gap-1 p-2 border border-border hover:bg-secondary transition-colors"
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 text-emerald-500" />
          <span className="text-[10px] font-bold uppercase text-emerald-500">Copied</span>
        </>
      ) : (
        <>
          <Copy className="h-4 w-4" />
          <span className="text-[10px] font-bold uppercase">Copy</span>
        </>
      )}
    </button>
  );
}
