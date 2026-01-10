"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, List, Droplets, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { TankCard, TankStatus } from "./TankCard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { useTanks } from "@/hooks/use-tanks";
import { LiveIndicator } from "./LiveIndicator";


export function Dashboard() {
  const router = useRouter();
  const { data: tanks, isLoading } = useTanks();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

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
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20 glow-primary">
                <Droplets className="w-4 h-4 text-primary" />
              </div>
              <h1 className="text-sm sm:text-base font-bold tracking-tight">
                Smart Tank <span className="text-primary italic">Monitor</span>
              </h1>
            </div>

            {/* Navigation Links */}
            <nav className="hidden md:flex items-center gap-1 p-1 bg-muted/30 rounded-lg border border-border/30">
              <Link href="/">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-3 text-xs font-medium"
                >
                  Dashboard
                </Button>
              </Link>
              <Link href="/about">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-3 text-xs font-medium"
                >
                  About
                </Button>
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Node Count */}
            <div className="hidden sm:flex items-center gap-2 py-1.5 px-3 rounded-full bg-muted/30 border border-border/40">
              <span className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-tighter">
                Nodes: <span className="text-foreground">{tanks.length}</span>
              </span>
            </div>

            <ThemeToggle />

            <Link href="/setup" className="hidden sm:block">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5"
              >
                <Plus className="w-3.5 h-3.5 text-primary" />
                <span className="hidden lg:inline">Add New Node</span>
                <span className="lg:hidden">Add</span>
              </Button>
            </Link>

            <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-lg border border-border/30">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 w-7 p-0 transition-all duration-200",
                  viewMode === "grid" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                )}
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 w-7 p-0 transition-all duration-200",
                  viewMode === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                )}
                onClick={() => setViewMode("list")}
              >
                <List className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="section-fade-in">
          <div
            className={cn(
              "grid gap-6 transition-all duration-300",
              viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
            )}
          >
            {tanks.length > 0 ? (
              tanks.map((tank) => (
                <TankCard
                  key={tank.id}
                  {...tank}
                  level={tank.level ?? 0}
                  volume={tank.volume ?? 0}
                  lastUpdated={tank.lastUpdated ?? "Unknown"}
                  status={tank.status as TankStatus}
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

    </div>
  );
}
