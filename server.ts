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
import { tanks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { startMDNS } from "@/lib/discovery";

const dev = process.env.NODE_ENV !== "production";
const port = 3000;
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
    // Authoritative Sync on boot
    await hydrateStore();

    // Start mDNS advertisement
    startMDNS();

    const server = createServer((req, res) => {
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
            // data: { secret, level, status, rssi }
            const { secret, level, status, rssi } = data;

            // Strict Gatekeeper: Re-validate on every update packet
            const isValid = await validateSecret(secret);
            if (!isValid) return;

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
            });

            if (updatedState) {
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
    setInterval(() => {
        const offlineIds = checkTimeouts();
        if (offlineIds.length > 0) {
            offlineIds.forEach((id: string) => {
                io.to("dashboard").emit("tank-offline", { id });
            });
        }
    }, 5000);

    server.listen(port, () => {
        console.log(`> Ready on http://localhost:${port}`);
    });
});
