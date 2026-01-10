import { Bonjour } from "bonjour-service";
import os from "os";

export function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]!) {
            if (iface.family === "IPv4" && !iface.internal) {
                return iface.address;
            }
        }
    }
    return "127.0.0.1";
}

// Singleton instance
let bonjour: Bonjour | null = null;
let advertisement: any = null;

export function getBonjour() {
    if (!bonjour) {
        bonjour = new Bonjour();
    }
    return bonjour;
}

export function startMDNS() {
    if (advertisement) return;

    const b = getBonjour();
    const hostname = os.hostname();
    const uniqueSuffix = Math.random().toString(36).substring(2, 6);

    // Advertise the server with a unique name to avoid conflicts
    advertisement = b.publish({
        name: `Smart Tank Server (${hostname}-${uniqueSuffix})`,
        type: "smart-tank-srv",
        port: 3000,
        protocol: "tcp",
    });

    advertisement.on('error', (err: any) => {
        console.error("mDNS Advertisement Error:", err);
    });

    console.log(`mDNS: Advertising _smart-tank-srv._tcp.local as "${advertisement.name}"`);
}

export interface DiscoveredDevice {
    name: string;
    ip: string;
    port: number;
    id?: string; // Device MAC/ID from TXT record
}

export async function scanDevices(timeoutMs = 6000): Promise<DiscoveredDevice[]> {
    const b = getBonjour();
    const devices: DiscoveredDevice[] = [];

    return new Promise((resolve) => {
        console.log("mDNS: Scanning for _smart-tank-node._tcp.local...");

        // Start multiple browsers to increase hit rate
        const browser1 = b.find({ type: "smart-tank-node", protocol: "tcp" });
        const browser2 = b.find({ type: "smart-tank-node" }); // Some libs don't want protocol specified separate

        const onUp = (service: any) => {
            console.log(`mDNS: [UP] "${service.name}" - Type: ${service.type} - IP: ${service.addresses?.[0]}`);

            if (service.addresses && service.addresses.length > 0) {
                const ip = service.addresses.find((a: string) => a.includes('.') && !a.startsWith('127.')) || service.addresses[0];
                const id = service.txt?.id || service.name.split('-').pop();

                if (!devices.find(d => d.ip === ip || (id && d.id === id))) {
                    devices.push({
                        name: service.name,
                        ip: ip,
                        port: service.port,
                        id: id
                    });
                    console.log(`mDNS: [+] Result Added: ${service.name} (${ip})`);
                }
            }
        };

        browser1.on('up', onUp);
        browser2.on('up', onUp);

        setTimeout(() => {
            browser1.stop();
            browser2.stop();
            console.log(`mDNS: Scan finished. Found ${devices.length} devices.`);
            resolve(devices);
        }, timeoutMs);
    });
}
