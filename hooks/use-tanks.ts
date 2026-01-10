"use client";

import { useState, useEffect } from "react";
import { useTelemetry } from "@/components/telemetry-provider";
import { toast } from "sonner";

export interface Tank {
    id: string;
    name: string;
    location: string;
    capacity: number;
    height: number;
    // Live data (optional in DB, mandatory in UI state)
    level?: number;
    volume?: number;
    status?: "idle" | "filling" | "low" | "full" | "offline" | "online" | "draining" | "connecting";
    lastUpdated?: string;
    isOnline?: boolean;
    rssi?: number;
}

export function useTanks() {
    const { liveData, socket, isInitialized, refreshSync } = useTelemetry();
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Self-Correction: If we mount and have 0 tanks but are "initialized", 
    // it might be a stale state from before a pairing. Request a fresh sync.
    useEffect(() => {
        if (isInitialized && Object.keys(liveData).length === 0) {
            refreshSync();
        }
    }, [isInitialized, refreshSync, liveData]);

    const mergedTanks: Tank[] = Object.values(liveData).map(live => ({
        id: live.id,
        name: live.name,
        location: live.location || "Central Fleet",
        capacity: live.capacity,
        height: live.height ?? 100,
        level: live.level ?? 0,
        volume: live.volume ?? 0,
        status: (live.status as any) ?? "offline",
        isOnline: live.isOnline ?? false,
        rssi: live.rssi,
        lastUpdated: live.isOnline ? "Live" : "Offline",
    }));

    const updateTank = async (tank: Partial<Tank>) => {
        if (!tank.id || !socket) return;
        setIsUpdating(true);
        try {
            socket.emit("client-update-config", {
                id: tank.id,
                name: tank.name,
                capacity: tank.capacity,
                height: tank.height,
                location: tank.location
            });
            toast.success("Updating configuration...");
        } catch (error) {
            toast.error("Failed to update tank configuration");
        } finally {
            setIsUpdating(false);
        }
    };

    const deleteTank = async (id: string) => {
        if (!confirm("Are you sure you want to decommission this node?")) return;
        setIsDeleting(true);
        try {
            const response = await fetch(`/api/tanks?id=${id}`, { method: "DELETE" });
            if (!response.ok) throw new Error("Delete failed");
            toast.success("Node decommissioned successfully");
        } catch (error) {
            console.error("Delete failed:", error);
            toast.error("Failed to decommission node");
        } finally {
            setIsDeleting(false);
        }
    };

    return {
        data: mergedTanks,
        isLoading: !isInitialized,
        isUpdating,
        isDeleting,
        updateTank,
        deleteTank,
    };
}
