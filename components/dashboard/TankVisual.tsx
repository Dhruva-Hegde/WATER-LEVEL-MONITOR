import { cn } from "@/lib/utils";
import { TankStatus } from "./TankCard";

interface TankVisualProps {
  level: number; // 0-100
  status: TankStatus;
  size?: "sm" | "md" | "lg";
}

export function TankVisual({ level, status, size = "md" }: TankVisualProps) {
  const sizeClasses = {
    sm: "w-20 h-28",
    md: "w-24 h-36",
    lg: "w-28 h-44",
  };

  const getLevelColor = () => {
    if (level <= 10) return "from-destructive/90 to-destructive";
    if (level <= 25) return "from-warning/90 to-warning";
    return "from-water-light to-water";
  };

  const isAgitated = status === "filling" || status === "draining";

  return (
    <div className={cn("relative flex flex-col items-center", sizeClasses[size])}>
      {/* Top Valve/Inlet */}
      <div className="w-6 h-3 metal-reflect rounded-t-sm border border-black/20 z-20 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-1 bg-black/30 rounded-full" />
      </div>

      {/* Main Tank Body */}
      <div className="relative w-full flex-1 group">
        <div className="absolute inset-0 rounded-[2rem] rounded-b-[1.5rem] tank-glass border-2 border-white/10 overflow-hidden shadow-2xl">
          {/* Glass Reflection Highlight */}
          <div className="absolute top-0 left-[20%] w-[1px] h-full bg-white/20 z-30" />

          {/* Side Gauge/Scale */}
          <div className="absolute right-3 inset-y-6 w-3 flex flex-col justify-between items-end z-20 opacity-40 group-hover:opacity-100 transition-opacity">
            {[100, 75, 50, 25, 0].map((mark) => (
              <div key={mark} className="flex items-center gap-1">
                <span className="text-[7px] font-bold text-white leading-none">{mark}</span>
                <div className="w-1.5 h-[1px] bg-white" />
              </div>
            ))}
          </div>

          {/* Realistic High-Speed Inflow Stream */}
          {status === "filling" && level < 100 && (
            <>
              {/* Vertical Stream */}
              <div className="absolute inset-x-0 top-0 h-full pointer-events-none z-10 flex justify-center">
                <div className="w-1.5 h-full relative overflow-hidden">
                  <div className="absolute inset-0 bg-primary/40 blur-[1px] animate-water-flow" />
                  <div className="absolute inset-x-0 top-0 h-full bg-gradient-to-b from-primary/60 to-transparent opacity-50" />
                </div>
              </div>

              {/* Surface Splash/Impact Effect */}
              <div
                className="absolute left-1/2 -translate-x-1/2 w-8 h-4 z-20 pointer-events-none"
                style={{ bottom: `${level}%`, transform: 'translate(-50%, 50%)' }}
              >
                <div className="absolute inset-0 bg-white/40 blur-md rounded-full animate-surface-splash" />
                <div className="absolute inset-0 border-2 border-white/20 rounded-full animate-ping opacity-30" />
              </div>
            </>
          )}

          {/* Water Fill */}
          <div
            className={cn(
              "absolute bottom-0 left-0 right-0 transition-all duration-1000 ease-in-out",
              "bg-gradient-to-t",
              getLevelColor()
            )}
            style={{ height: `${level}%` }}
          >
            {/* Water surface with realistic curve */}
            <div className="absolute top-0 left-0 right-0 h-4 -translate-y-1/2 overflow-visible">
              <div className={cn(
                "absolute inset-0 w-[200%] h-full opacity-40",
                isAgitated && "water-wave-agitated"
              )}>
                <div className="absolute inset-0 bg-white/40" style={{ borderRadius: '50% 50% 0 0' }} />
              </div>
            </div>

            {/* Bubble details */}
            <div className="absolute inset-0 overflow-hidden opacity-30">
              {[...Array(isAgitated ? 6 : 3)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-1 h-1 rounded-full bg-white/60 animate-float"
                  style={{
                    left: `${Math.random() * 80 + 10}%`,
                    bottom: `${Math.random() * 80}%`,
                    animationDelay: `${Math.random() * 3}s`,
                    opacity: Math.random() * 0.5 + 0.3
                  }}
                />
              ))}
            </div>

            {/* Internal shadow for depth */}
            <div className="absolute inset-0 bg-black/10 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Tank Base/Support Legs */}
      <div className="w-full h-4 flex justify-between px-2 -mt-1 z-0">
        <div className="w-3 h-full metal-reflect rounded-b-sm border-x border-b border-black/20 shadow-lg" />
        <div className="w-3 h-full metal-reflect rounded-b-sm border-x border-b border-black/20 shadow-lg" />
      </div>
    </div>
  );
}
