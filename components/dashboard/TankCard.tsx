"use client";

import { MapPin, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { TankVisual } from "./TankVisual";
import { Badge } from "@/components/ui/badge";
import { NodeActions } from "./NodeActions";

export type TankStatus = "idle" | "filling" | "full" | "low" | "offline" | "draining" | "critical" | "connecting";

interface TankCardProps {
  id: string;
  name: string;
  location: string;
  level: number;
  volume: number;
  capacity: number;
  height: number;
  status: TankStatus;
  lastUpdated: string;
  isOnline?: boolean;
}

export function TankCard({
  id,
  name,
  location,
  capacity,
  height,
  level,
  volume,
  status,
  lastUpdated,
  isOnline = true,
}: TankCardProps) {
  const statusConfig: Record<string, { label: string; className: string }> = {
    idle: {
      label: "Idle",
      className: "bg-muted text-muted-foreground border-muted-foreground/20"
    },
    filling: {
      label: "Filling",
      className: "bg-primary/20 text-primary border-primary/30 animate-pulse"
    },
    draining: {
      label: "Draining",
      className: "bg-blue-500/20 text-blue-400 border-blue-500/30"
    },
    full: {
      label: "Full",
      className: "bg-success/20 text-success border-success/30 glow-success"
    },
    low: {
      label: "Low Level",
      className: "bg-warning/20 text-warning border-warning/30 glow-warning"
    },
    critical: {
      label: "Critical",
      className: "bg-destructive/20 text-destructive border-destructive/30 animate-bounce-slow"
    },
    offline: {
      label: "Offline",
      className: "bg-destructive/20 text-destructive border-destructive/30"
    },
    connecting: {
      label: "Connecting...",
      className: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30 animate-pulse"
    },
  };

  const currentStatus = statusConfig[status] || {
    label: status.charAt(0).toUpperCase() + status.slice(1),
    className: "bg-muted text-muted-foreground border-muted-foreground/20"
  };

  return (
    <div className={cn(
      "glass-card rounded-xl p-5 transition-all duration-300 hover:border-primary/30 relative group",
      !isOnline && "opacity-60"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg">{name}</h3>
            <Badge variant="outline" className={cn("text-xs", currentStatus.className)}>
              {currentStatus.label}
            </Badge>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
            <MapPin className="w-3 h-3" />
            <span>{location}</span>
          </div>
        </div>

        <NodeActions
          id={id}
          name={name}
          location={location}
          capacity={capacity}
          height={height}
        />
      </div>

      {/* Tank Visualization & Stats */}
      <div className="flex items-center gap-6">
        <TankVisual level={level} status={status} />

        <div className="flex-1 space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">Current Level</p>
            <p className={cn(
              "text-4xl font-bold",
              level <= 25 ? "text-destructive" : level <= 50 ? "text-warning" : "text-primary"
            )}>
              {level}<span className="text-lg text-muted-foreground">%</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-muted-foreground">Volume</p>
              <p className="font-medium">{volume?.toLocaleString()} L</p>
            </div>
            <div>
              <p className="text-muted-foreground">Capacity</p>
              <p className="font-medium">{capacity?.toLocaleString()} L</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
        <div className="flex items-center gap-2 text-sm">
          {isOnline ? (
            <>
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-muted-foreground">Online</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 text-destructive" />
              <span className="text-destructive">Offline</span>
            </>
          )}
        </div>
        <span className="text-xs text-muted-foreground">Updated {lastUpdated}</span>
      </div>
    </div>
  );
}
