import { Sidebar } from "@/components/dashboard/sidebar";
import { VaultInterface } from "@/components/dashboard/vault-interface";
import { BalanceCard } from "@/components/dashboard/balance-card";
import { AccountsGrid } from "@/components/dashboard/accounts-grid";
import { SpendingChart } from "@/components/dashboard/spending-chart";
import { TransactionsList } from "@/components/dashboard/transactions-list";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { SecurityPanel } from "@/components/dashboard/security-panel";
import { Header } from "@/components/dashboard/header";

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* サイドバー（左側の黒い柱） */}
      <Sidebar />

      {/* メインコンテンツエリア */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />
        
        <div className="flex-1 overflow-auto p-6 md:p-8 space-y-8">
          {/* 送金入力エリア */}
          <div className="w-full max-w-2xl animate-in fade-in zoom-in-95 duration-500 slide-in-from-bottom-4">
           <VaultInterface />
          </div>

          {/* グリッドレイアウトエリア */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
            <div className="md:col-span-4 space-y-6">
              <BalanceCard />
              <SpendingChart />
              <TransactionsList />
            </div>
            <div className="md:col-span-3 space-y-6">
              <QuickActions />
              <SecurityPanel />
              <AccountsGrid />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}