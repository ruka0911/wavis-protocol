const items = [
    { label: "2FA", status: "On" },
    { label: "Biometric", status: "On" },
    { label: "PIN", status: "On" },
    { label: "Timeout", status: "5m" },
  ];
  
  export function SecurityPanel() {
    return (
      <div className="border-b border-border pb-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Security
        </p>
        <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2">
          {items.map((item) => (
            <div key={item.label} className="flex items-center justify-between py-1">
              <span className="text-xs uppercase text-foreground">{item.label}</span>
              <span className="text-xs font-bold text-foreground">{item.status}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }