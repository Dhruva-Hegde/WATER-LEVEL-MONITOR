"use client";

import React, { createContext, useContext, useEffect, useRef, useCallback } from "react";
import io, { Socket } from "socket.io-client";
import { Store } from "@tanstack/store";
import { useStore } from "@tanstack/react-store";

interface TelemetryState {
    liveData: Record<string, any>;
    isInitialized: boolean;
}

export const telemetryStore = new Store<TelemetryState>({
    liveData: {},
    isInitialized: false,
});

interface TelemetryContextType {
    socket: Socket | null;
    refreshSync: () => void;
    setConnecting: (id: string) => void;
}

const TelemetryContext = createContext<TelemetryContextType>({
    socket: null,
    refreshSync: () => { },
    setConnecting: () => { },
});

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
    const [socket, setSocket] = React.useState<Socket | null>(null);
    const socketRef = useRef<Socket | null>(null);

    const setConnecting = useCallback((id: string) => {
        telemetryStore.setState((state) => ({
            ...state,
            liveData: {
                ...state.liveData,
                [id]: {
                    ...(state.liveData[id] || {}),
                    id,
                    status: "connecting",
                    isOnline: false
                }
            }
        }));
    }, []);

    const refreshSync = useCallback(async () => {
        // 1. Fetch Authoritative List from DB (API)
        try {
            const res = await fetch("/api/tanks");
            if (!res.ok) throw new Error("Failed to fetch authoritative tank list");

            const dbTanks = await res.json();
            console.log(`[Telemetry] DB Roster Fetched: ${dbTanks.length} nodes`);

            telemetryStore.setState((state) => {
                const pendingMap: Record<string, any> = { ...state.liveData };

                // Mark existing as offline momentarily or preserve? 
                // Better approach: Rebuild map from DB, preserving live data if id matches.
                const newMap: Record<string, any> = {};

                dbTanks.forEach((dbTank: any) => {
                    const existing = pendingMap[dbTank.id];
                    newMap[dbTank.id] = {
                        id: dbTank.id,
                        name: dbTank.name,
                        location: dbTank.location,
                        capacity: dbTank.capacity,
                        height: dbTank.height || 100,
                        // Preserve live state if we had it, else defaults
                        // Critical: Preserve 'connecting' state if manually set
                        level: existing?.level || 0,
                        volume: existing?.volume || 0,
                        status: existing?.status === "connecting" ? "connecting" : (existing?.status || "offline"),
                        isOnline: existing?.isOnline || (existing?.status === "connecting"), // Treat connecting as quasi-online for UI visibility
                        rssi: existing?.rssi,
                    };
                });

                return {
                    ...state,
                    liveData: newMap,
                    isInitialized: true
                };
            });

            // 2. Refresh Socket Subs
            if (socketRef.current?.connected) {
                socketRef.current.emit("join-dashboard");
            }

        } catch (e) {
            console.error("Critical: Failed to sync with DB", e);
        }
    }, []);

    useEffect(() => {
        // Initial DB Sync
        refreshSync();

        const socketInstance = io({
            path: "/api/socket/io",
            reconnectionAttempts: 20,
            timeout: 10000,
        });

        socketRef.current = socketInstance;
        setSocket(socketInstance);

        socketInstance.on("connect", () => {
            console.log("[Telemetry] Global Connection established");
            socketInstance.emit("join-dashboard");
        });

        // The socket might send "init-state" from memory. 
        // We use this ONLY to overlay live status (level/online), NOT to add new tanks.
        socketInstance.on("init-state", (states: any[]) => {
            telemetryStore.setState((state) => {
                const next = { ...state.liveData };

                states.forEach((s) => {
                    // STRICT FILTER: Only update if ID exists in our DB-sourced map
                    if (next[s.id]) {
                        next[s.id] = {
                            ...next[s.id], // Keep DB props (name, location)
                            level: s.level,
                            volume: s.volume,
                            status: s.status,
                            isOnline: s.isOnline,
                            rssi: s.rssi
                        };
                    } else {
                        console.warn(`[Telemetry] Blocked ghost node from init-state: ${s.id}`);
                    }
                });
                return { ...state, liveData: next };
            });
        });

        socketInstance.on("tank-live-update", (data: any) => {
            if (data.id) {
                telemetryStore.setState((state) => {
                    // STRICT FILTER: Only update if known
                    if (state.liveData[data.id]) {
                        console.log(`[Telemetry] Live update for ${data.id}`);
                        return {
                            ...state,
                            liveData: {
                                ...state.liveData,
                                [data.id]: {
                                    ...state.liveData[data.id],
                                    ...data,
                                    isOnline: true
                                },
                            },
                        };
                    } else {
                        // console.warn(`[Telemetry] Ignored ghost update for ${data.id}`);
                        return state;
                    }
                });
            }
        });

        socketInstance.on("tank-offline", (data: any) => {
            if (data.id) {
                telemetryStore.setState((state) => {
                    if (state.liveData[data.id]) {
                        return {
                            ...state,
                            liveData: {
                                ...state.liveData,
                                [data.id]: {
                                    ...state.liveData[data.id],
                                    isOnline: false,
                                    status: "offline"
                                },
                            },
                        };
                    }
                    return state;
                });
            }
        });

        socketInstance.on("tank-decommissioned", (data: any) => {
            if (data.id) {
                console.log(`[Telemetry] Unconditional purge: ${data.id}`);
                telemetryStore.setState((state) => {
                    const next = { ...state.liveData };
                    delete next[data.id];
                    return { ...state, liveData: next };
                });
                // Trigger a DB sync just to be safe and perfectly aligned
                refreshSync();
            }
        });

        return () => {
            socketInstance.disconnect();
        };
    }, [refreshSync]);

    return (
        <TelemetryContext.Provider value={{ socket: socket, refreshSync, setConnecting }}>
            {children}
        </TelemetryContext.Provider>
    );
}

export const useTelemetry = () => {
    const context = useContext(TelemetryContext);
    const liveData = useStore(telemetryStore, (state) => state.liveData);
    const isInitialized = useStore(telemetryStore, (state) => state.isInitialized);
    return { ...context, liveData, isInitialized };
};
