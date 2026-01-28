const accounts = [
    { name: "Current", balance: "45,230.00", currency: "USD" },
    { name: "Savings", balance: "68,350.00", currency: "USD" },
    { name: "Investment", balance: "11,002.34", currency: "USD" },
  ];
  
  export function AccountsGrid() {
    return (
      <div className="border-b border-border pb-8">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Accounts
        </p>
        <div className="mt-4 grid grid-cols-3 gap-8">
          {accounts.map((account) => (
            <div key={account.name}>
              <p className="text-xs font-bold uppercase text-foreground">
                {account.name}
              </p>
              <p className="mt-1 font-mono text-lg font-bold text-foreground">
                {account.balance}
              </p>
              <p className="text-[10px] uppercase text-muted-foreground">
                {account.currency}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }