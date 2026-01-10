
import { io } from "socket.io-client";
import http from "http";
import { Bonjour } from "bonjour-service";

const bonjour = new Bonjour();

// --- CONFIGURATION ---
// These match the 'tanks' schema: id, secret, deviceId
// To use this: Insert these values into your SQLite DB manually, or Pair them once via UI.
// The script will use these secrets to authenticate.
const SIMULATED_NODES = [
    {
        name: "Simulated Tank Alpha",
        deviceId: "SIM_NODE_001",
        secret: "secret-alpha-001",
        configPort: 8005,
        // Initial defaults
        tankHeightCM: 200,
        level: 50 // %
    },
    {
        name: "Simulated Tank Beta",
        deviceId: "SIM_NODE_002",
        secret: "secret-beta-002",
        configPort: 8006,
        tankHeightCM: 150,
        level: 75
    },
    {
        name: "Simulated Tank Gamma",
        deviceId: "SIM_NODE_003",
        secret: "secret-gamma-003",
        configPort: 8008,
        tankHeightCM: 300,
        level: 25
    }
];

const PROMPT_SQL = true;

// --- SIMULATOR ---

console.log("----------------------------------------------------------------");
console.log("   SMART TANK MONITOR - FIRMWARE SIMULATOR (MULTI-NODE)   ");
console.log("----------------------------------------------------------------");

if (PROMPT_SQL) {
    console.log("\n[SETUP] Ensure these rows exist in your DB for persistence:");
    console.log("----------------------------------------------------------------");
    SIMULATED_NODES.forEach(node => {
        // Simple SQL generator for convenience
        const id = `tank_sim_${node.deviceId.split('_').pop()}`;
        console.log(`INSERT OR IGNORE INTO tanks (id, name, location, capacity, height, secret, device_id, ip_address) VALUES ('${id}', '${node.name}', 'Simulator Lab', 5000, ${node.tankHeightCM}, '${node.secret}', '${node.deviceId}', '127.0.0.1');`);
    });
    console.log("----------------------------------------------------------------\n");
}

class SimulatedNode {
    private config: any;
    private socket: any;
    private httpServer: any;
    private isConnected: boolean = false;
    private isHandshaked: boolean = false;
    private tankHeightCM: number;
    private currentLevel: number;
    private loopInterval: any;

    constructor(nodeConfig: any) {
        this.config = nodeConfig;
        this.tankHeightCM = nodeConfig.tankHeightCM;
        this.currentLevel = nodeConfig.level;

        this.startHttpServer();
        this.connectSocket();
        this.startLoop();
        this.startMDNS();
    }

    log(tag: string, msg: string) {
        console.log(`[${this.config.deviceId}] [${tag}] ${msg}`);
    }

    startMDNS() {
        const name = `smart-tank-${this.config.deviceId}`;
        this.log("mDNS", `Advertising service: ${name}._smart-tank-node._tcp.local`);

        bonjour.publish({
            name: name,
            type: 'smart-tank-node',
            port: this.config.configPort,
            txt: {
                id: this.config.deviceId,
                paired: 'false' // Advertise as discoverable initially
            }
        });
    }

    startHttpServer() {
        // Simulate the Setup/Pairing Interface (HTTP POST /config)
        this.httpServer = http.createServer((req, res) => {
            // CORS headers for browser fetch
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

            if (req.method === 'OPTIONS') {
                res.writeHead(204);
                res.end();
                return;
            }

            if (req.method === 'POST' && req.url === '/config') {
                let body = '';
                req.on('data', chunk => {
                    body += chunk.toString();
                });
                req.on('end', () => {
                    try {
                        const data = JSON.parse(body);
                        this.log("HTTP", `Received pairing config! Secret: ${data.secret}, TankID: ${data.tankId}`);

                        // In a real device, we'd save to EEPROM here.
                        // For Simulator, we just update memory and reconnect.
                        this.config.secret = data.secret;

                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ status: 'ok' }));

                        this.log("SYSTEM", "Rebooting with new credentials...");
                        // Simulate restart
                        setTimeout(() => {
                            if (this.socket) this.socket.disconnect();
                            this.connectSocket();
                        }, 1000);

                    } catch (e) {
                        res.writeHead(400);
                        res.end();
                    }
                });
            } else {
                res.writeHead(404);
                res.end();
            }
        });

        this.httpServer.listen(this.config.configPort, () => {
            // In real life this would be port 80
            this.log("HTTP", `Config Server listening on port ${this.config.configPort}`);
        });
    }

    connectSocket() {
        const SERVER_URL = "http://localhost:3000"; // Assuming local dev

        // EIO=4 and transport=websocket mimics the Arduino client exactly
        this.socket = io(SERVER_URL, {
            path: "/api/socket/io",
            transports: ["websocket"],
            reconnection: true,
            reconnectionDelay: 5000
        });

        this.socket.on("connect", () => {
            this.log("SOCKET", "Connected to Server!");
            this.isConnected = true;

            // Allow a small delay for handshake simulation 
            setTimeout(() => {
                this.identify();
            }, 500);
        });

        this.socket.on("disconnect", () => {
            this.log("SOCKET", "Disconnected.");
            this.isConnected = false;
        });

        this.socket.on("configure", (data: any) => {
            this.log("CONFIG", `Received display config: ${JSON.stringify(data)}`);
            // Update local name if needed
        });

        this.socket.on("tank-config", (data: any) => {
            if (data.height) {
                this.tankHeightCM = data.height;
                this.log("CONFIG", `Physical Tank Height updated to: ${this.tankHeightCM}cm`);
            }
        });
    }

    identify() {
        // "42" is Socket.IO protocol, handled by the client lib automatically, 
        // but the event name and payload must match.
        this.log("SOCKET", `Identifying with secret: ${this.config.secret}`);
        this.socket.emit("tank-identify", this.config.secret);
        this.isHandshaked = true;
    }

    startLoop() {
        setInterval(() => {
            if (this.isConnected && this.isHandshaked) {
                this.telemetry();
            }
        }, 2000); // 2s Interval
    }

    telemetry() {
        // Simulate some sensor fluctuation
        const noise = (Math.random() - 0.5) * 5; // +/- 2.5% noise
        let reading = this.currentLevel + noise;
        if (reading > 100) reading = 100;
        if (reading < 0) reading = 0;

        // Random fill/drain events
        if (Math.random() > 0.95) {
            // 5% chance to change base level slightly
            this.currentLevel += (Math.random() - 0.5) * 10;
            if (this.currentLevel > 100) this.currentLevel = 100;
            if (this.currentLevel < 0) this.currentLevel = 0;
        }

        const payload = {
            secret: this.config.secret,
            level: Math.round(reading),
            status: "online",
            rssi: -50 + Math.round(Math.random() * -10) // -50 to -60 dBm
        };

        this.socket.emit("tank-update", payload);
        // this.log("SENSOR", `Telemetry Sent: Level ${payload.level}% (Height: ${this.tankHeightCM}cm)`); 
    }
}

// Start Simulator
SIMULATED_NODES.forEach((config, index) => {
    // Stagger start to prevent race conditions in logs/socket
    setTimeout(() => {
        new SimulatedNode(config);
    }, index * 500);
});

// Keep process alive
process.stdin.resume();
