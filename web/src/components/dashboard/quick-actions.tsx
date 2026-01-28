const actions = ["Send", "Receive", "Exchange", "Statement"];

export function QuickActions() {
  return (
    <div className="border-b border-border pb-6">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        Quick
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {actions.map((action) => (
          <button
            key={action}
            type="button"
            className="border border-foreground px-4 py-2 text-xs font-bold uppercase text-foreground"
          >
            {action}
          </button>
        ))}
      </div>
    </div>
  );
}