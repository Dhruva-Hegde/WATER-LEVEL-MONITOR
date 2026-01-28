import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";
import {
    hydrateStore,
    getPublicStates,
    updateTelemetry,
    getSecretById,
    updateConfig,
    checkTimeouts,
    validateSecret,
    tankStore,
} from "./lib/store";
import { db } from "@/lib/db";
import { tanks, readings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { startMDNS } from "@/lib/discovery";
import { cleanupOldReadings } from "@/lib/db/maintenance";

const dev = process.env.NODE_ENV !== "production";
const port = 3000;
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
    // Authoritative Sync on boot
    await hydrateStore();

    // Start mDNS advertisement
    startMDNS();

    // Database Maintenance: Weekly cleanup (7 days)
    // Run once on startup
    cleanupOldReadings(7).catch(e => console.error("[Maintenance] Startup cleanup failed", e));
    // Schedule to run every 24 hours
    setInterval(() => {
        cleanupOldReadings(7).catch(e => console.error("[Maintenance] Scheduled cleanup failed", e));
    }, 24 * 60 * 60 * 1000);

    const server = createServer((req, res) => {
        if (req.url?.includes("socket.io")) {
            console.log(`[HTTP] ${req.method} ${req.url} from ${req.socket.remoteAddress}`);
        }
        const pin = process.env.DASHBOARD_PIN;
        const url = req.url || "/";

        // Simple exclusion list for authentication
        const isAuthExempt =
            url === "/login" ||
            url.startsWith("/api/auth") ||
            url.startsWith("/_next") ||
            url.includes(".") ||
            !pin;

        if (!isAuthExempt) {
            const cookies = req.headers.cookie || "";
            const authCookie = cookies.split(';').find(c => c.trim().startsWith('dashboard_auth='))?.split('=')[1];

            if (authCookie !== pin) {
                res.writeHead(302, { Location: "/login" });
                res.end();
                return;
            }
        }

        handle(req, res);
    });

    const io = new Server(server, {
        path: "/api/socket/io",
        addTrailingSlash: false,
        cors: {
            origin: "*",
        },
    });

    (global as any).io = io;

    console.log("Socket.io initialized");

    io.on("connection", (socket) => {
        console.log(`[Socket] New connection: ${socket.id} from ${socket.handshake.address}`);
        // Dashboard joins 'dashboard' room
        socket.on("join-dashboard", async () => {
            socket.join("dashboard");
            // Send current state of all tanks (Public data only)
            const states = await getPublicStates();
            socket.emit("init-state", states);
        });

        // Device Auth & Data
        socket.on("tank-identify", async (secret) => {
            // Strict Gatekeeper: Verify existence before allowing connection
            const isValid = await validateSecret(secret);
            if (!isValid) {
                console.warn(`[Server] Rejected auth for unknown secret: ${secret}`);
                socket.disconnect(true);
                return;
            }

            await hydrateStore(); // Ensure we are ready
            socket.join(`device-${secret}`);
            console.log(`[Server] Device authenticated: ${secret.slice(0, 8)}...`);

            // PUSH Configuration to ensure node has latest physics params
            // This handles the "Initial Height on Pairing" requirement implicitly, as the node connects immediately after credential exchange.
            // It ALSO robustly handles reboots/reconnects.
            const tank = tankStore.state.tanks[secret];
            if (tank?.height) {
                io.to(`device-${secret}`).emit("tank-config", { height: tank.height });
                console.log(
                    `[Server] Synced physics to device (On-Connect): Height ${tank.height}cm`
                );
            }
        });

        socket.on("tank-update", async (data) => {
            // data: { secret, level, status, rssi, signature }
            const { secret, level, status, rssi, signature } = data;

            // Strict Gatekeeper: Re-validate on every update packet
            const isValid = await validateSecret(secret);
            if (!isValid) return;

            // Integrity Check: Verify HMAC Signature
            if (!signature) {
                console.warn(`[Server] Rejected unsigned update from ${secret.slice(0, 8)}`);
                return;
            }

            const { verifyTelemetry } = await import("@/lib/crypto");
            const payload = { secret, level, status, rssi };
            if (!verifyTelemetry(payload, secret, signature)) {
                console.warn(`[Server] Rejected invalid HMAC signature from ${secret.slice(0, 8)}`);
                return;
            }

            socket.join(`device-${secret}`); // Safe to auto-join NOW because we validated.

            console.log(
                `[Server] Received update from secret ${secret.slice(
                    0,
                    8
                )}... : Level ${level}%, Status: ${status}`
            );

            const updatedState = await updateTelemetry(secret, {
                level,
                status,
                rssi,
            }) as any; // Cast to avoid TS 'never' inference issues in complex handler

            if (updatedState) {
                // 1. Alert Logic: Emit alert to dashboard if below threshold or nearly full
                if (updatedState.status === "online") {
                    if (updatedState.level < updatedState.alertThreshold) {
                        io.to("dashboard").emit("tank-alert", {
                            id: updatedState.id,
                            name: updatedState.name,
                            level: updatedState.level,
                            threshold: updatedState.alertThreshold
                        });
                    } else if (updatedState.level >= 95) {
                        io.to("dashboard").emit("tank-full", {
                            id: updatedState.id,
                            name: updatedState.name,
                            level: updatedState.level
                        });
                    }
                }

                // 2. History Persistence: Save to DB every 10 minutes (per tank)
                const lastSaveMap = (global as any).lastHistorySave || {};
                const now = Date.now();
                const lastSave = lastSaveMap[updatedState.id] || 0;

                if (process.env.NEXT_PUBLIC_ENABLE_HISTORY === "true" && now - lastSave > 10 * 60 * 1000) {
                    await db.insert(readings).values({
                        tankId: updatedState.id,
                        level: updatedState.level,
                    });
                    lastSaveMap[updatedState.id] = now;
                    (global as any).lastHistorySave = lastSaveMap;
                    console.log(`[History] Saved reading for ${updatedState.name}: ${updatedState.level}%`);
                }

                io.to("dashboard").emit("tank-live-update", updatedState);
            }
        });

        // Configuration Sync (from Dashboard)
        socket.on("client-update-config", async (data) => {
            console.log("[Server] Received config update request:", data);
            const { id, name, capacity, location, height } = data;
            const secret = await getSecretById(id);
            if (!secret) {
                console.warn("[Server] Config update ignored: Unknown ID", id);
                return;
            }

            // 1. Update In-Memory
            const updatedState = updateConfig(secret, {
                name,
                capacity,
                location,
                height,
            });

            // 2. Update Database (Async, fire & forget for performance)
            try {
                await db
                    .update(tanks)
                    .set({ name, capacity, location, height })
                    .where(eq(tanks.id, id));
                console.log("[Server] DB Config updated for", id);
            } catch (e) {
                console.error("DB Update failed", e);
            }

            // 3. Broadcast to Dashboard
            if (updatedState) {
                console.log("[Server] Broadcasting config update", updatedState);
                io.to("dashboard").emit("tank-live-update", updatedState);
            }

            // 4. PUSH to Device (Standard & Firmware Specific)
            // 'configure' is legacy/display name update. 'tank-config' is for critical sensor physics.
            io.to(`device-${secret}`).emit("configure", { capacity, name });

            if (height) {
                io.to(`device-${secret}`).emit("tank-config", { height });
                console.log(
                    `[Server] Pushed physics config to device: Height ${height}cm`
                );
            }
        });

        socket.on("disconnect", (reason) => {
            console.log(`[Server] Socket disconnected: ${reason}`);
        });
    });

    // Offline sweeper (runs every 5s)
    setInterval(async () => {
        const offlineIds = checkTimeouts();
        if (offlineIds.length > 0) {
            for (const id of offlineIds) {
                io.to("dashboard").emit("tank-offline", { id });

                // OPTIONAL: Log a final reading into history to mark the outage
                if (process.env.NEXT_PUBLIC_ENABLE_HISTORY === "true") {
                    try {
                        const secret = await getSecretById(id);
                        if (secret) {
                            const tank = tankStore.state.tanks[secret];
                            await db.insert(readings).values({
                                tankId: id,
                                level: tank.level,
                            });
                            console.log(`[History] Outage Logged for ${tank.name}: ${tank.level}%`);
                        }
                    } catch (e: any) {
                        console.error("[History] Failed to log outage", e);
                    }
                }
            }
        }
    }, 5000);

    server.listen(port, "0.0.0.0", () => {
        console.log(`> Ready on http://0.0.0.0:${port}`);
    });
});
