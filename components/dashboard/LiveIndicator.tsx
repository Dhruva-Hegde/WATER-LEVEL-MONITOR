interface LiveIndicatorProps {
  isLive?: boolean;
}

export function LiveIndicator({ isLive = true }: LiveIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex h-2 w-2">
        {isLive && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
        )}
        <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
      </div>
      <span className="text-[10px] font-extrabold uppercase tracking-tighter text-muted-foreground">
        Live Updates: <span className={isLive ? "text-success" : "text-destructive"}>{isLive ? "On" : "Off"}</span>
      </span>
    </div>
  );
}
