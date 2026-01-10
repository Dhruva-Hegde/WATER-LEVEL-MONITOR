import { cn } from "@/lib/utils";
import { TankStatus } from "./TankCard";

interface TankVisualProps {
  level: number; // 0-100
  status: TankStatus;
  size?: "sm" | "md" | "lg";
}

export function TankVisual({ level, status, size = "md" }: TankVisualProps) {
  const sizeClasses = {
    sm: "w-24 h-32",
    md: "w-28 h-40",
    lg: "w-32 h-44",
  };

  const getLevelColor = () => {
    if (level <= 10) return "from-destructive/90 to-destructive";
    if (level <= 25) return "from-warning/90 to-warning";
    return "from-water-light to-water";
  };

  const isAgitated = status === "filling" || status === "draining";

  return (
    <div className={cn("relative flex flex-col items-center", sizeClasses[size])}>
      {/* Premium Top Lid - Visible in white theme */}
      <div className="w-14 h-4 bg-gradient-to-b from-white to-zinc-200 rounded-t-xl border-x border-t border-black/10 z-30 relative shadow-sm flex flex-col items-center">
        <div className="w-10 h-1 bg-black/5 rounded-full mt-1.5 blur-[1px]" />
      </div>

      {/* Main Tank Body (Polished Ridged Cylinder) */}
      <div className="relative w-full flex-1 -mt-1 group">
        <div className="absolute inset-0 rounded-[1.75rem] rounded-b-[1rem] tank-glass border-2 border-white/20 overflow-hidden shadow-2xl">
          {/* Vertical Specular Highlight */}
          <div className="absolute top-0 left-[10%] w-[15%] h-full tank-specular z-30 opacity-60" />

          {/* 3D Ridges Effect */}
          <div className="absolute inset-0 tank-ridges opacity-60 z-10" />

          {/* Glass Reflection Highlight */}
          <div className="absolute top-0 left-[18%] w-[1.5px] h-full bg-white/20 z-40 shadow-[0_0_10px_white/30]" />

          {/* Gauge Marking Area (Reference for labels) */}
          <div className="absolute inset-x-0 top-6 bottom-6 z-50 pointer-events-none">
            {/* Side Gauge/Scale - Perfectly Aligned */}
            <div className="absolute right-3 inset-y-0 w-4 flex flex-col justify-between items-end">
              {[100, 75, 50, 25, 0].map((mark) => (
                <div key={mark} className="flex items-center gap-2">
                  <span className="text-[8px] font-black text-white leading-none [text-shadow:0_1px_4px_rgba(0,0,0,1)] drop-shadow-lg">{mark}</span>
                  <div className="w-2 h-[1.5px] bg-white/80 shadow-[0_1px_2px_rgba(0,0,0,0.5)] rounded-full" />
                </div>
              ))}
            </div>
          </div>

          {/* Water Fill - Starting from physical bottom, top edge matching labels */}
          <div
            className={cn(
              "absolute bottom-0 left-0 right-0 transition-all duration-1000 ease-in-out z-20",
              "bg-gradient-to-t",
              getLevelColor()
            )}
            style={{
              height: `calc(1.5rem + (${level} * (100% - 3rem) / 100))`
            }}
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

          {/* Realistic Inflow Stream */}
          {status === "filling" && level < 100 && (
            <>
              {/* Vertical Stream */}
              <div className="absolute inset-x-0 top-0 h-full pointer-events-none z-10 flex justify-center">
                <div className="w-1.5 h-full relative overflow-hidden">
                  <div className="absolute inset-0 bg-primary/40 blur-[1px] animate-water-flow" />
                  <div className="absolute inset-x-0 top-0 h-full bg-gradient-to-b from-primary/60 to-transparent opacity-50" />
                </div>
              </div>

              {/* Surface Splash/Impact Effect - Perfectly Aligned with Surface */}
              <div
                className="absolute left-1/2 -translate-x-1/2 w-8 h-4 z-20 pointer-events-none"
                style={{ bottom: `calc(1.5rem + (${level} * (100% - 3rem) / 100))`, transform: 'translate(-50%, 50%)' }}
              >
                <div className="absolute inset-0 bg-white/40 blur-md rounded-full animate-surface-splash" />
                <div className="absolute inset-0 border-2 border-white/20 rounded-full animate-ping opacity-30" />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Solid Base Rim (Reno Style) */}
      <div className="w-[98%] h-2 bg-white/5 rounded-b-lg border-x border-b border-white/10 z-0 shadow-xl" />
    </div>
  );
}
