import { Store } from '@tanstack/store'
import { db } from "@/lib/db";
import { tanks as tanksTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export interface TankState {
    id: string;
    level: number;
    volume: number;
    status: string;
    isOnline: boolean;
    lastSeen: number;
    capacity: number;
    name: string;
    location: string;
    height: number;
    rssi?: number;
}

export interface TankStoreState {
    tanks: Record<string, TankState>; // Key is secret
}

// The Core Store Instance
export const tankStore = new Store<TankStoreState>({
    tanks: {}
})

// Hydration Logic (Persistent vs Memory Sync)
let hydrationPromise: Promise<void> | null = null;
let isFullyHydrated = false;

export const hydrateStore = async (force = false) => {
    if (isFullyHydrated && !force) return;
    if (hydrationPromise && !force) return hydrationPromise;

    hydrationPromise = (async () => {
        try {
            const allTanksFromDb = await db.select().from(tanksTable);
            console.log(`[Store] Reconciling with DB. Found ${allTanksFromDb.length} authoritative rows.`);

            tankStore.setState((state) => {
                const authoritativeTanks: Record<string, TankState> = {};

                allTanksFromDb.forEach((t: any) => {
                    if (!t.secret) return;

                    const existing = state.tanks[t.secret];

                    authoritativeTanks[t.secret] = {
                        id: t.id,
                        name: t.name,
                        location: t.location || "Unknown",
                        name: t.name,
                        location: t.location || "Unknown",
                        capacity: t.capacity,
                        height: t.height || 100,
                        // Preserve live data if it exists in memory, else default to offline
                        level: existing?.level || 0,
                        volume: existing?.volume || 0,
                        status: existing?.status || "offline",
                        isOnline: existing?.isOnline || false,
                        lastSeen: existing?.lastSeen || 0,
                        rssi: existing?.rssi
                    };
                });

                return { ...state, tanks: authoritativeTanks };
            });

            console.log(`[Store] Sync complete. ${allTanksFromDb.length} nodes active.`);
            isFullyHydrated = true;
        } catch (error) {
            console.error("[Store] Reconciliation failed:", error);
            throw error;
        } finally {
            hydrationPromise = null;
        }
    })();

    return hydrationPromise;
};

// Actions
export const getSecretById = async (id: string) => {
    await hydrateStore();
    const state = tankStore.state;
    for (const [secret, tank] of Object.entries(state.tanks)) {
        if (tank.id === id) return secret;
    }
    return null;
};

export const validateSecret = async (secret: string): Promise<boolean> => {
    // 1. Fast Path: Memory
    if (tankStore.state.tanks[secret]) return true;

    // 2. Slow Path: Database (Authoritative)
    try {
        const dbTanks = await db.select().from(tanksTable).where(eq(tanksTable.secret, secret)).limit(1);
        if (dbTanks.length > 0) {
            // Found in DB but not memory? We should probably sync, but for validation simple existence is enough.
            return true;
        }
    } catch (e) {
        console.error("[Store] Validation DB Error:", e);
    }

    return false;
};

export const registerTank = async (secret: string, tank: any) => {
    // Explicitly do NOT hydrate here to avoid race with the insert that just happened
    const newState: TankState = {
        id: tank.id,
        level: 0,
        volume: 0,
        status: "online",
        isOnline: true,
        lastSeen: Date.now(),
        capacity: tank.capacity,
        height: tank.height || 100,
        name: tank.name,
        location: tank.location || "Unknown"
    };

    tankStore.setState((state) => ({
        ...state,
        tanks: { ...state.tanks, [secret]: newState }
    }));

    console.log(`[Store] Authority Granted: ${tank.name} (${tank.id})`);
    return newState;
};

export const getPublicStates = async () => {
    await hydrateStore();
    return Object.values(tankStore.state.tanks).map(s => ({
        id: s.id,
        name: s.name,
        location: s.location,
        level: s.level,
        volume: s.volume,
        capacity: s.capacity,
        status: s.status,
        isOnline: s.isOnline,
        rssi: s.rssi,
        lastUpdated: s.isOnline ? "Live" : "Offline"
    }));
};

export const updateConfig = (secret: string, config: { name?: string, capacity?: number, location?: string, height?: number }) => {
    let updated: TankState | null = null;

    tankStore.setState((state) => {
        const tank = state.tanks[secret];
        if (!tank) return state;

        const nextTank = { ...tank };
        if (config.name) nextTank.name = config.name;
        if (config.capacity) nextTank.capacity = config.capacity;
        if (config.height) nextTank.height = config.height;
        if (config.location) nextTank.location = config.location;

        nextTank.volume = Math.round((nextTank.level / 100) * nextTank.capacity);
        updated = nextTank;

        return {
            ...state,
            tanks: { ...state.tanks, [secret]: nextTank }
        };
    });

    return updated;
};

export const updateTelemetry = async (secret: string, data: { level: number, status?: string, rssi?: number }) => {
    // We expect the node to already be in memory. 
    // If it's not, we only attempt ONE DB check to see if we missed a boot-up sync.
    let tank = tankStore.state.tanks[secret];

    if (!tank) {
        console.log(`[Store] Unknown telemetry packet from ${secret.slice(0, 8)}... - Checking DB for missing sync...`);
        const dbTanks = await db.select().from(tanksTable).where(eq(tanksTable.secret, secret)).limit(1);

        if (dbTanks.length > 0) {
            const t = dbTanks[0];
            await hydrateStore(true); // Force full reconciliation
            tank = tankStore.state.tanks[secret];
        } else {
            // Strictly reject updates for decommissioned or unauthorized nodes
            return null;
        }
    }

    if (!tank) return null;

    let updated: TankState | null = null;
    tankStore.setState((state) => {
        const current = state.tanks[secret];
        if (!current) return state;

        const nextTank = {
            ...current,
            level: data.level,
            status: data.status || current.status,
            rssi: data.rssi,
            lastSeen: Date.now(),
            isOnline: true,
            volume: Math.round((data.level / 100) * current.capacity)
        };
        updated = nextTank;

        return {
            ...state,
            tanks: { ...state.tanks, [secret]: nextTank }
        };
    });

    return updated;
};

export const markOffline = (secret: string) => {
    let id: string | null = null;
    tankStore.setState(state => {
        const tank = state.tanks[secret];
        if (!tank) return state;
        id = tank.id;
        return {
            ...state,
            tanks: {
                ...state.tanks,
                [secret]: { ...tank, isOnline: false, status: "offline" }
            }
        };
    });
    return id;
};

export const removeTank = (id: string) => {
    let found = false;
    tankStore.setState(state => {
        const nextTanks = { ...state.tanks };
        for (const [secret, tank] of Object.entries(nextTanks)) {
            if (tank.id === id) {
                delete nextTanks[secret];
                found = true;
                break;
            }
        }
        return { ...state, tanks: nextTanks };
    });
    return found;
};

export const checkTimeouts = (timeoutMs = 15000) => {
    const now = Date.now();
    const offlineIds: string[] = [];

    tankStore.setState(state => {
        const nextTanks = { ...state.tanks };
        let changed = false;

        for (const [secret, tank] of Object.entries(nextTanks)) {
            if (tank.isOnline && (now - tank.lastSeen > timeoutMs)) {
                nextTanks[secret] = { ...tank, isOnline: false, status: "offline" };
                offlineIds.push(tank.id);
                changed = true;
            }
        }

        return changed ? { ...state, tanks: nextTanks } : state;
    });

    return offlineIds;
};
