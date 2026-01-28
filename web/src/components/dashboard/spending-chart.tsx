const data = [
    { month: "J", value: 42 },
    { month: "F", value: 31 },
    { month: "M", value: 58 },
    { month: "A", value: 39 },
    { month: "M", value: 48 },
    { month: "J", value: 38 },
    { month: "J", value: 43 },
    { month: "A", value: 51 },
    { month: "S", value: 46 },
    { month: "O", value: 32 },
    { month: "N", value: 41 },
    { month: "D", value: 54 },
  ];
  
  const maxValue = Math.max(...data.map((d) => d.value));
  
  export function SpendingChart() {
    return (
      <div className="border-b border-border pb-8">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Activity 2025
        </p>
        <div className="mt-4 flex items-end gap-2">
          {data.map((item, index) => (
            <div key={`${item.month}-${index}`} className="flex flex-1 flex-col items-center gap-2">
              <div
                className={index === data.length - 1 ? "w-full bg-primary" : "w-full bg-foreground"}
                style={{ height: `${(item.value / maxValue) * 80}px` }}
              />
              <span className="text-[10px] font-bold uppercase text-muted-foreground">
                {item.month}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }