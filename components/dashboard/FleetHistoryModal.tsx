"use client";

import { useState, useEffect, useMemo } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { format, subDays } from "date-fns";
import { Droplets, Calendar, Clock, Loader2, X, Activity, History, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useTelemetry } from "@/components/telemetry-provider";
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    ChartLegend,
    ChartLegendContent,
} from "@/components/ui/chart";

interface FleetHistoryModalProps {
    onClose: () => void;
}

const COLORS = [
    "oklch(0.75 0.15 65)",   // Premium Gold/Amber
    "oklch(0.65 0.18 245)",  // Electric Water Blue
    "oklch(0.7 0.15 160)",   // Emerald Teal
    "oklch(0.6 0.15 300)",   // Royal Purple
    "oklch(0.8 0.1 200)",    // Frost Cyan
];

export function FleetHistoryModal({ onClose }: FleetHistoryModalProps) {
    const { socket } = useTelemetry();
    const [rawHistory, setRawHistory] = useState<any[]>([]);
    const [tanks, setTanks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isLive, setIsLive] = useState(false);
    const [liveData, setLiveData] = useState<Record<number, any>>({});

    useEffect(() => {
        async function fetchFleetHistory() {
            setLoading(true);
            try {
                const res = await fetch("/api/history?range=10080");
                const json = await res.json();
                setRawHistory(json.history || []);
                setTanks(json.tanks || []);
            } catch (err) {
                console.error("Failed to load fleet history:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchFleetHistory();
    }, []);

    // Live Socket Listener for Fleet
    useEffect(() => {
        if (!socket || !isLive) return;

        const handleUpdate = (update: any) => {
            const now = Date.now();
            const bucket = Math.floor(now / 5000) * 5000;

            setLiveData(prev => {
                const updated = { ...prev };
                if (!updated[bucket]) {
                    updated[bucket] = { timestamp: bucket };
                }
                updated[bucket][update.id] = update.level;
                const keys = Object.keys(updated).map(Number).sort((a, b) => a - b);
                if (keys.length > 100) delete updated[keys[0]];
                return updated;
            });
        };

        socket.on("tank-live-update", handleUpdate);
        return () => {
            socket.off("tank-live-update", handleUpdate);
        };
    }, [socket, isLive]);

    const chartConfig = useMemo(() => {
        const config: ChartConfig = {};
        tanks.forEach((tank, index) => {
            config[tank.id] = {
                label: tank.name,
                color: COLORS[index % COLORS.length],
            };
        });
        return config;
    }, [tanks]);

    const processedData = useMemo(() => {
        if (isLive) {
            return Object.values(liveData).sort((a, b) => a.timestamp - b.timestamp);
        }
        if (!rawHistory.length) return [];
        const timeMap = new Map<number, any>();
        rawHistory.forEach(r => {
            // Align to 10-minute buckets to match server save frequency
            const t = Math.floor(r.timestamp / 600) * 600 * 1000;
            if (!timeMap.has(t)) {
                timeMap.set(t, { timestamp: t });
            }
            timeMap.get(t)[r.tankId] = r.level;
        });
        return Array.from(timeMap.values()).sort((a, b) => a.timestamp - b.timestamp);
    }, [rawHistory, isLive, liveData]);

    const xDomain = useMemo(() => {
        if (isLive) return ['dataMin', 'dataMax'];
        const now = Date.now();
        const start = subDays(now, 7).getTime();
        return [start, now];
    }, [isLive]);

    const xAxisFormatter = (val: number) => {
        if (!val || isNaN(val)) return "";
        try {
            const date = new Date(val);
            if (isLive) return format(date, "HH:mm:ss");
            return format(date, "MMM d");
        } catch (e) {
            return "";
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm section-fade-in">
            <div className="bg-card border border-border/40 w-full max-w-5xl p-6 rounded-3xl shadow-2xl space-y-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-primary/10 rounded-full blur-[80px] -mr-40 -mt-40 -z-10 opacity-30" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-water/5 rounded-full blur-[60px] -ml-32 -mb-32 -z-10 opacity-20" />

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 transition-all duration-500">
                            <History className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold tracking-tight uppercase">Fleet History</h2>
                            <p className="text-xs text-muted-foreground">Historical water level synchronization (Last 7 Days)</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center space-x-2 bg-muted/30 px-3 py-1.5 rounded-full border border-border/40 transition-all hover:bg-muted/40">
                            <Switch
                                id="fleet-live-mode"
                                checked={isLive}
                                onCheckedChange={(val) => {
                                    setIsLive(val);
                                    if (val) setLiveData({});
                                }}
                            />
                            <Label htmlFor="fleet-live-mode" className="text-[10px] font-bold uppercase tracking-wider cursor-pointer">Live Mode</Label>
                        </div>
                        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
                            <X className="w-5 h-5" />
                        </Button>
                    </div>
                </div>

                <div className="bg-muted/30 rounded-2xl p-4 border border-border/40 aspect-[2/1] min-h-[300px] flex items-center justify-center relative overflow-hidden">
                    {isLive && (
                        <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2 py-1 bg-destructive/10 border border-destructive/20 rounded-md animate-pulse z-20">
                            <div className="w-1.5 h-1.5 rounded-full bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                            <span className="text-[10px] font-bold text-destructive uppercase tracking-widest">Fleet Live</span>
                        </div>
                    )}

                    {loading ? (
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                            <p className="text-sm text-muted-foreground uppercase tracking-widest font-bold animate-pulse italic">Aligning Fleet History...</p>
                        </div>
                    ) : processedData.length > 0 ? (
                        <ChartContainer config={chartConfig} className="w-full h-full">
                            <AreaChart data={processedData} margin={{ left: 12, right: 12, top: 12, bottom: 12 }}>
                                <defs>
                                    {tanks.map((tank, index) => (
                                        <linearGradient key={tank.id} id={`fillFleet-${tank.id}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={COLORS[index % COLORS.length]} stopOpacity={0.3} />
                                            <stop offset="95%" stopColor={COLORS[index % COLORS.length]} stopOpacity={0} />
                                        </linearGradient>
                                    ))}
                                </defs>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted-foreground/10" />
                                <XAxis
                                    dataKey="timestamp"
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={12}
                                    tick={{ fontSize: 10, fontWeight: 600, fill: "var(--muted-foreground)" }}
                                    tickFormatter={xAxisFormatter}
                                    type="number"
                                    domain={xDomain}
                                    ticks={isLive ? undefined : Array.from({ length: 8 }).map((_, i) => subDays(Date.now(), 7 - i).getTime())}
                                />
                                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tickMargin={8} tick={{ fontSize: 10, fontWeight: 600 }} unit="%" />
                                <ChartTooltip
                                    cursor={{ stroke: 'var(--primary)', strokeDasharray: '4 4' }}
                                    content={
                                        <ChartTooltipContent
                                            labelFormatter={(value) => {
                                                if (!value || isNaN(value)) return "Unknown";
                                                try {
                                                    return format(new Date(value), "MMM d, HH:mm");
                                                } catch (e) {
                                                    return "Invalid Date";
                                                }
                                            }}
                                        />
                                    }
                                />
                                <ChartLegend content={<ChartLegendContent />} />
                                {tanks.map((tank, index) => (
                                    <Area
                                        key={tank.id}
                                        dataKey={tank.id}
                                        name={tank.name.charAt(0).toUpperCase() + tank.name.slice(1)}
                                        type="monotone"
                                        fill={`url(#fillFleet-${tank.id})`}
                                        stroke={COLORS[index % COLORS.length]}
                                        strokeWidth={3}
                                        animationDuration={isLive ? 300 : 800}
                                        connectNulls
                                        fillOpacity={0.15}
                                        activeDot={{ r: 6, strokeWidth: 0, fill: COLORS[index % COLORS.length] }}
                                    />
                                ))}
                            </AreaChart>
                        </ChartContainer>
                    ) : (
                        <div className="text-center space-y-2">
                            <Calendar className="w-10 h-10 text-muted-foreground/20 mx-auto" />
                            <p className="text-sm text-muted-foreground italic font-medium">No 7-day fleet history available.</p>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-4 gap-4">
                    <div className="bg-muted/20 p-3 rounded-xl border border-border/20">
                        <div className="flex items-center gap-2 mb-1">
                            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{isLive ? "Status" : "Context"}</span>
                        </div>
                        <p className="text-sm font-semibold italic uppercase">{isLive ? "Live Stream" : "7 Day History"}</p>
                    </div>
                    <div className="bg-muted/20 p-3 rounded-xl border border-border/20">
                        <div className="flex items-center gap-2 mb-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Active Nodes</span>
                        </div>
                        <p className="text-sm font-semibold italic">{tanks.length}</p>
                    </div>
                    <div className="bg-muted/20 p-3 rounded-xl border border-border/20">
                        <div className="flex items-center gap-2 mb-1">
                            <Activity className="w-3.5 h-3.5 text-amber-400" />
                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Historical Span</span>
                        </div>
                        <p className="text-sm font-semibold italic">{isLive ? "Real-time" : "1 Week"}</p>
                    </div>
                    <div className="bg-muted/20 p-3 rounded-xl border border-border/20">
                        <div className="flex items-center gap-2 mb-1">
                            <History className="w-3.5 h-3.5 text-primary" />
                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Aggregate Avg</span>
                        </div>
                        <p className="text-sm font-semibold italic">
                            {processedData.length > 0 ? Math.round(tanks.reduce((acc, t) => {
                                const lastPoint = processedData[processedData.length - 1];
                                return acc + (lastPoint[t.id] || 0);
                            }, 0) / (tanks.length || 1)) : 0}%
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
