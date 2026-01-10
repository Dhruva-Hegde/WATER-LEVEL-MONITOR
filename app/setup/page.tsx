"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, RefreshCw, Wifi, ArrowLeft, CheckCircle2, Server, Search } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useTelemetry } from "@/components/telemetry-provider";

interface DiscoveredDevice {
    name: string;
    ip: string;
    port: number;
    id?: string;
    isPaired?: boolean;
}

export default function SetupPage() {
    const router = useRouter();
    const { setConnecting } = useTelemetry();
    const [autoScan, setAutoScan] = useState(true);
    const [pairingDevice, setPairingDevice] = useState<DiscoveredDevice | null>(null);
    const [tankName, setTankName] = useState("");
    const [tankHeight, setTankHeight] = useState("100");
    const [pairingDialogOpen, setPairingDialogOpen] = useState(false);

    // Manual State management for Discovery
    const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [isPairing, setIsPairing] = useState(false);

    const scanDevices = useCallback(async (isAuto = false) => {
        setIsScanning(true);
        try {
            const res = await fetch("/api/setup/scan", { cache: 'no-store' });
            if (!res.ok) throw new Error("Scan failed");
            const data = await res.json() as { devices: DiscoveredDevice[] };

            setDevices(data.devices || []);

            if (!isAuto) {
                if (data.devices?.length === 0) {
                    toast.info("No devices found nearby");
                } else {
                    toast.success(`Found ${data.devices.length} devices`);
                }
            }
        } catch (err) {
            if (!isAuto) toast.error("Failed to scan network");
            console.error(err);
        } finally {
            setIsScanning(false);
        }
    }, []);

    // Initial Scan and Auto-Scan interval
    useEffect(() => {
        scanDevices(true);

        let interval: NodeJS.Timeout;
        if (autoScan && !pairingDialogOpen) {
            interval = setInterval(() => scanDevices(true), 15000);
        }

        return () => clearInterval(interval);
    }, [autoScan, pairingDialogOpen, scanDevices]);

    const handlePair = async () => {
        if (!pairingDevice || !tankName) return;

        setIsPairing(true);
        try {
            const res = await fetch("/api/setup/pair", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    targetIp: pairingDevice.ip,
                    tankName: tankName,
                    height: Number(tankHeight),
                    deviceId: pairingDevice.id
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Pairing failed");

            toast.success(`Connected to ${tankName}`);
            setConnecting(data.id);
            setPairingDialogOpen(false);
            setTankName("");
            router.push("/");
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsPairing(false);
        }
    };

    const openPairingDialog = (device: DiscoveredDevice) => {
        setPairingDevice(device);
        setPairingDevice(device);
        setTankName(device.name);
        setTankHeight("100");
        setPairingDialogOpen(true);
    };

    return (
        <div className="min-h-screen bg-background selection:bg-primary/20 p-6 md:p-12">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 section-fade-in">
                    <div className="space-y-2">
                        <Link href="/" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-2">
                            <ArrowLeft className="w-4 h-4 mr-1" />
                            Back to Dashboard
                        </Link>
                        <h1 className="text-4xl font-bold tracking-tight">System Discovery</h1>
                        <p className="text-muted-foreground text-lg">Scan local network for Smart Tank Monitor nodes</p>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border shadow-sm">
                            <Label htmlFor="auto-scan" className="text-sm font-medium cursor-pointer">Auto Scan</Label>
                            <Switch
                                id="auto-scan"
                                checked={autoScan}
                                onCheckedChange={setAutoScan}
                            />
                        </div>

                        <Button
                            onClick={() => scanDevices()}
                            disabled={isScanning}
                            size="lg"
                            className={cn("min-w-[160px] shadow-lg hover:shadow-primary/20", isScanning && "bg-muted text-muted-foreground")}
                        >
                            {isScanning ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Scanning...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="mr-2 h-5 w-5" />
                                    Start Scan
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                {/* Radar / Content Area */}
                <div className="relative min-h-[400px] rounded-3xl border border-border/50 bg-card/50 backdrop-blur-sm p-8 shadow-inner overflow-hidden">
                    {/* Live Indicator */}
                    {autoScan && (
                        <div className="absolute top-4 right-4 z-30 flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 animate-in fade-in slide-in-from-top-2">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Live Discovery</span>
                        </div>
                    )}

                    {/* Background Grid Pattern */}
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

                    {/* Empty State / Loading State */}
                    {devices.length === 0 && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                            {isScanning ? (
                                <>
                                    {/* Pinging Circles */}
                                    <div className="absolute w-[600px] h-[600px] rounded-full border border-primary/10 animate-radar-ping" />
                                    <div className="absolute w-[450px] h-[450px] rounded-full border border-primary/20 animate-radar-ping [animation-delay:0.5s]" />
                                    <div className="absolute w-[300px] h-[300px] rounded-full border border-primary/30 animate-radar-ping [animation-delay:1s]" />

                                    {/* Rotating Sweep Line */}
                                    <div className="absolute w-[600px] h-[600px] rounded-full border border-white/5 overflow-hidden">
                                        <div className="absolute top-1/2 left-1/2 w-[300px] h-[300px] origin-top-left bg-gradient-to-br from-primary/20 to-transparent animate-scanning-sweep"
                                            style={{ clipPath: "polygon(0 0, 100% 0, 100% 10%, 0 0)" }}
                                        />
                                    </div>

                                    <div className="absolute w-24 h-24 rounded-full bg-primary/10 border border-primary/40 flex items-center justify-center glow-primary z-10">
                                        <Wifi className="w-10 h-10 text-primary animate-pulse" />
                                    </div>

                                    <div className="mt-48 z-10 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
                                        <h3 className="text-xl font-bold text-primary tracking-tight">Active Scan In Progress</h3>
                                        <p className="text-sm opacity-60 max-w-[200px] mx-auto">Analyzing local network for available telemetry nodes...</p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mb-6">
                                        <Search className="w-10 h-10 opacity-50" />
                                    </div>
                                    <h3 className="text-xl font-semibold mb-2">No Devices Found</h3>
                                    <p className="max-w-md text-center text-sm opacity-70">
                                        Make sure your Smart Tank device is powered on and connected to the same Wi-Fi network.
                                    </p>
                                    <Button variant="outline" onClick={() => scanDevices()} className="mt-4">
                                        Try Again
                                    </Button>
                                </>
                            )}
                        </div>
                    )}

                    {devices.length > 0 && (
                        <div className={cn("grid gap-4 relative z-20",
                            isScanning ? "opacity-50 pointer-events-none filter blur-sm transition-all" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                        )}>
                            {devices.map((device: DiscoveredDevice) => (
                                <div
                                    key={device.ip + device.port}
                                    className="group relative overflow-hidden rounded-2xl border border-border/50 bg-background/60 hover:bg-background/80 hover:border-primary/30 transition-all duration-300 p-5 shadow-sm hover:shadow-md cursor-default"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                            <Server className="w-5 h-5" />
                                        </div>
                                        {device.isPaired ? (
                                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 text-xs font-medium border border-green-500/20">
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                Paired
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 text-xs font-medium border border-blue-500/20">
                                                <Wifi className="w-3.5 h-3.5" />
                                                Ready
                                            </span>
                                        )}
                                    </div>

                                    <h3 className="font-semibold text-lg mb-1">{device.name}</h3>
                                    <div className="space-y-1 mb-4">
                                        <div className="flex items-center text-xs text-muted-foreground font-mono bg-muted/50 w-fit px-2 py-0.5 rounded">
                                            {device.ip}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground truncate uppercase tracking-wider">
                                            ID: {device.id || "UNKNOWN"}
                                        </div>
                                    </div>

                                    <Button
                                        onClick={() => openPairingDialog(device)}
                                        disabled={device.isPaired}
                                        className={cn("w-full gap-2", device.isPaired ? "bg-muted text-muted-foreground opacity-50" : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20")}
                                        variant={device.isPaired ? "outline" : "default"}
                                    >
                                        {device.isPaired ? "System Installed" : (
                                            <>
                                                <Plus className="w-4 h-4" />
                                                Install Node
                                            </>
                                        )}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Pairing Dialog */}
            <Dialog open={pairingDialogOpen} onOpenChange={setPairingDialogOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Configure Node</DialogTitle>
                        <DialogDescription>
                            Setup <strong>{pairingDevice?.name}</strong> to join your monitoring fleet.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-6 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Tank / Location Name</Label>
                            <Input
                                id="name"
                                value={tankName}
                                onChange={(e) => setTankName(e.target.value)}
                                placeholder="e.g. Roof - Main Water Tank"
                                className="h-11"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="height">Tank Height (cm)</Label>
                            <Input
                                id="height"
                                type="number"
                                value={tankHeight}
                                onChange={(e) => setTankHeight(e.target.value)}
                                placeholder="100"
                                className="h-11"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setPairingDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handlePair} disabled={isPairing} className="shadow-lg shadow-primary/20">
                            {isPairing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Initialize Connection
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
