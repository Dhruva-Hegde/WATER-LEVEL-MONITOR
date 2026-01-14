"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Droplets, Plus } from "lucide-react";
import Link from "next/link";
import { TankCard, TankStatus } from "./TankCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { useTanks } from "@/hooks/use-tanks";
import { LiveIndicator } from "./LiveIndicator";
import { toast } from "sonner";
import { HistoryModal } from "./history/HistoryModal";
import { useTelemetry } from "@/components/telemetry-provider";

export function Dashboard() {
  const router = useRouter();
  const { data: tanks, isLoading } = useTanks();
  const { socket } = useTelemetry();

  const [historyTarget, setHistoryTarget] = useState<{ id: string, name: string } | null>(null);

  // Real-time Low Water Alerts
  useEffect(() => {
    if (!socket) return;

    socket.on("tank-alert", (data: { name: string, level: number, threshold: number }) => {
      toast.error(`Low Water Alert: ${data.name}`, {
        description: `Level dropped to ${data.level}% (Threshold: ${data.threshold}%)`,
        duration: 10000,
      });
    });

    return () => {
      socket.off("tank-alert");
    };
  }, [socket]);

  // Calculate average tank level for logo glow
  const averageLevel = tanks.length > 0
    ? tanks.reduce((sum, tank) => sum + (tank.level ?? 0), 0) / tanks.length
    : 0;

  const getLogoGlowClass = () => {
    if (averageLevel <= 10) return "glow-destructive";
    if (averageLevel <= 25) return "glow-warning";
    if (averageLevel >= 90) return "glow-success";
    return "glow-primary";
  };

  const getLogoBackgroundClass = () => {
    if (averageLevel <= 10) return "bg-red-500/20 border-red-500/40";
    if (averageLevel <= 25) return "bg-orange-500/20 border-orange-500/40";
    if (averageLevel >= 90) return "bg-green-500/20 border-green-500/40";
    return "bg-primary/10 border-primary/20";
  };

  const getLogoIconClass = () => {
    if (averageLevel <= 10) return "text-red-500";
    if (averageLevel <= 25) return "text-orange-500";
    if (averageLevel >= 90) return "text-green-500";
    return "text-primary";
  };

  // Redirect to setup if no tanks are found (Only on initial load)
  useEffect(() => {
    if (!isLoading && tanks && tanks.length === 0) {
      const hasCheckedSetup = sessionStorage.getItem("dashboard-initial-setup-checked");
      if (!hasCheckedSetup) {
        sessionStorage.setItem("dashboard-initial-setup-checked", "true");
        router.push("/setup");
      }
    }
  }, [tanks, isLoading, router]);

  // Removed manual add logic to enforce discovery workflow

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground animate-pulse text-lg font-medium">Synchronizing Fleet Telemetry...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background selection:bg-primary/20">
      {/* Simple Compact Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center border relative overflow-hidden", getLogoBackgroundClass(), getLogoGlowClass())}>
              {/* Water fill effect from bottom */}
              <div
                className={cn(
                  "absolute inset-x-0 bottom-0 transition-all duration-1000 ease-in-out -z-10 water-fill-animated",
                  averageLevel <= 10 ? "bg-gradient-to-t from-red-500/40 to-red-500/20" :
                    averageLevel <= 25 ? "bg-gradient-to-t from-orange-500/40 to-orange-500/20" :
                      averageLevel >= 90 ? "bg-gradient-to-t from-green-500/40 to-green-500/20" :
                        "bg-gradient-to-t from-primary/40 to-primary/20"
                )}
                style={{ height: `${averageLevel}%` }}
              />
              <Droplets className={cn("w-4 h-4 relative z-10 glow-pulse", getLogoIconClass())} />
            </div>
            <h1 className="text-sm sm:text-base font-bold tracking-tight">
              Smart Tank <span className="text-primary italic">Monitor</span>
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Node Count */}
            <div className="hidden sm:flex items-center gap-2 py-1.5 px-3 rounded-full bg-muted/30 border border-border/40">
              <span className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-tighter">
                Nodes: <span className="text-foreground">{tanks.length}</span>
              </span>
            </div>

            <ThemeToggle />

            <Link href="/setup">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5"
              >
                <Plus className="w-3.5 h-3.5 text-primary" />
                <span className="hidden sm:inline lg:hidden">Add</span>
                <span className="hidden lg:inline">Add New Node</span>
              </Button>
            </Link>

            {/* About Link */}
            <Link href="/about">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-xs font-medium hover:bg-primary/5"
              >
                About
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="section-fade-in">
          <div className="grid gap-4 sm:gap-6 grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] justify-items-center transition-all duration-300">
            {tanks.length > 0 ? (
              tanks.map((tank) => (
                <TankCard
                  key={tank.id}
                  {...tank}
                  level={tank.level ?? 0}
                  volume={tank.volume ?? 0}
                  lastUpdated={tank.lastUpdated ?? "Unknown"}
                  status={tank.status as TankStatus}
                  onViewHistory={(id, name) => setHistoryTarget({ id, name })}
                />
              ))
            ) : (
              <div className="col-span-full py-20 flex flex-col items-center justify-center text-center space-y-4 border-2 border-dashed border-border/40 rounded-3xl bg-muted/5">
                <div className="w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center">
                  <Droplets className="w-8 h-8 text-muted-foreground/40" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-semibold tracking-tight">No Monitoring Nodes</h3>
                  <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                    Your dashboard is currently empty. Start by adding a new sensor node to your fleet.
                  </p>
                </div>
                <Link href="/setup">
                  <Button variant="outline" className="gap-2 border-primary/20">
                    <Plus className="w-4 h-4" />
                    Go to Discovery
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>

      {historyTarget && (
        <HistoryModal
          tankId={historyTarget.id}
          tankName={historyTarget.name}
          onClose={() => setHistoryTarget(null)}
        />
      )}
    </div>
  );
}
