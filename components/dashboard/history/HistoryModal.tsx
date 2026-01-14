"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { format, subDays } from "date-fns";
import { Droplets, Calendar, Clock, Loader2, X, Activity, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useTelemetry } from "@/components/telemetry-provider";
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart";

interface HistoryModalProps {
    tankId: string;
    tankName: string;
    onClose: () => void;
}

export function HistoryModal({ tankId, tankName, onClose }: HistoryModalProps) {
    const { socket } = useTelemetry();
    const [historicalData, setHistoricalData] = useState<any[]>([]);
    const [liveData, setLiveData] = useState<Record<number, any>>({}); // bucket -> level
    const [loading, setLoading] = useState(true);
    const [isLive, setIsLive] = useState(false);

    useEffect(() => {
        async function fetchHistory() {
            setLoading(true);
            try {
                const res = await fetch(`/api/tanks/${tankId}/history?range=10080`);
                const json = await res.json();

                // Historical bucket alignment (10 mins)
                const timeMap = new Map<number, number>();
                json.forEach((r: any) => {
                    const t = Math.floor(r.timestamp / 600) * 600 * 1000;
                    timeMap.set(t, r.level);
                });

                const formatted = Array.from(timeMap.entries())
                    .map(([ts, lvl]) => ({ timestamp: ts, level: lvl }))
                    .sort((a, b) => a.timestamp - b.timestamp);

                setHistoricalData(formatted);
            } catch (err) {
                console.error("Failed to load history:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchHistory();
    }, [tankId]);

    // Live Socket Listener
    useEffect(() => {
        if (!socket || !isLive) return;

        const handleUpdate = (update: any) => {
            if (update.id === tankId) {
                const now = Date.now();
                const bucket = Math.floor(now / 2000) * 2000;

                setLiveData(prev => {
                    const next = { ...prev };
                    next[bucket] = update.level;
                    const keys = Object.keys(next).map(Number).sort((a, b) => a - b);
                    if (keys.length > 150) delete next[keys[0]];
                    return next;
                });
            }
        };

        socket.on("tank-live-update", handleUpdate);
        return () => {
            socket.off("tank-live-update", handleUpdate);
        };
    }, [socket, isLive, tankId]);

    const activeData = useMemo(() => {
        if (isLive) {
            return Object.entries(liveData)
                .map(([ts, lvl]) => ({ timestamp: Number(ts), level: lvl }))
                .sort((a, b) => a.timestamp - b.timestamp);
        }
        return historicalData;
    }, [historicalData, liveData, isLive]);

    // Domain calculation for X-Axis to ensure correct viewport
    const xDomain = useMemo(() => {
        if (isLive) return ['dataMin', 'dataMax'];
        const now = Date.now();
        const start = subDays(now, 7).getTime();
        return [start, now];
    }, [isLive]);

    const latestLevel = activeData.length > 0 ? activeData[activeData.length - 1].level : 0;
    const chartColor = useMemo(() => {
        if (latestLevel <= 10) return "oklch(0.6 0.2 25)";
        if (latestLevel <= 25) return "oklch(0.75 0.15 65)";
        return "oklch(0.65 0.18 245)";
    }, [latestLevel]);

    const xAxisFormatter = (val: number) => {
        if (!val || isNaN(val)) return "";
        try {
            const date = new Date(val);
            if (isLive) return format(date, "HH:mm:ss");
            // Show date only on midnight or start
            return format(date, "MMM d");
        } catch (e) {
            return "";
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm section-fade-in">
            <div className="bg-card border border-border/40 w-full max-w-4xl p-6 rounded-3xl shadow-2xl space-y-6 relative overflow-hidden">
                <div
                    className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl -mr-32 -mt-32 -z-10 opacity-20 transition-colors duration-500"
                    style={{ backgroundColor: chartColor }}
                />

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-500"
                            style={{ backgroundColor: `${chartColor}20`, borderColor: `${chartColor}40` }}
                        >
                            <Droplets className="w-5 h-5 transition-colors duration-500" style={{ color: chartColor }} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold tracking-tight">{tankName} History</h2>
                            <p className="text-xs text-muted-foreground">{isLive ? "High-resolution real-time stream" : "Historical usage data (Last 7 Days)"}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center space-x-2 bg-muted/30 px-3 py-1.5 rounded-full border border-border/40 transition-all hover:bg-muted/40">
                            <Switch
                                id="live-mode"
                                checked={isLive}
                                onCheckedChange={(val) => {
                                    setIsLive(val);
                                    if (val) setLiveData({});
                                }}
                            />
                            <Label htmlFor="live-mode" className="text-[10px] font-bold uppercase tracking-wider cursor-pointer">Live Mode</Label>
                        </div>
                        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
                            <X className="w-5 h-5" />
                        </Button>
                    </div>
                </div>

                <div className="bg-muted/30 rounded-2xl p-4 border border-border/40 aspect-[2/1] min-h-[300px] flex items-center justify-center relative overflow-hidden">
                    {isLive && (
                        <div
                            className="absolute top-4 right-4 flex items-center gap-1.5 px-2 py-1 border rounded-md animate-pulse z-20 transition-all duration-500"
                            style={{ backgroundColor: `${chartColor}10`, borderColor: `${chartColor}20` }}
                        >
                            <div className="w-1.5 h-1.5 rounded-full shadow-[0_0_8px]" style={{ backgroundColor: chartColor }} />
                            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: chartColor }}>Live</span>
                        </div>
                    )}

                    {loading ? (
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                            <p className="text-sm text-muted-foreground font-bold animate-pulse uppercase tracking-widest italic">Retrieving History...</p>
                        </div>
                    ) : activeData.length > 0 ? (
                        <ChartContainer config={{ level: { label: "Water Level", color: chartColor } }} className="w-full h-full">
                            <AreaChart data={activeData} margin={{ left: 12, right: 12, top: 12, bottom: 12 }}>
                                <defs>
                                    <linearGradient id="fillLevel" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={chartColor} stopOpacity={0.4} />
                                        <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                                    </linearGradient>
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
                                    cursor={{ stroke: chartColor, strokeDasharray: '4 4' }}
                                    content={
                                        <ChartTooltipContent
                                            hideLabel
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
                                <Area
                                    dataKey="level"
                                    type="monotone"
                                    fill="url(#fillLevel)"
                                    fillOpacity={0.4}
                                    stroke={chartColor}
                                    strokeWidth={3}
                                    activeDot={{ r: 6, strokeWidth: 0, fill: chartColor }}
                                    animationDuration={isLive ? 300 : 800}
                                    connectNulls
                                />
                            </AreaChart>
                        </ChartContainer>
                    ) : (
                        <div className="text-center space-y-2">
                            <Calendar className="w-10 h-10 text-muted-foreground/20 mx-auto" />
                            <p className="text-sm text-muted-foreground italic font-medium">No 7-day data recorded yet.</p>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-muted/20 p-3 rounded-xl border border-border/20 group transition-all hover:bg-muted/30">
                        <div className="flex items-center gap-2 mb-1">
                            <Clock className="w-3.5 h-3.5 text-muted-foreground group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{isLive ? "Status" : "Context"}</span>
                        </div>
                        <p className="text-sm font-semibold italic uppercase">{isLive ? "Real-time" : "7 Day History"}</p>
                    </div>
                    <div className="bg-muted/20 p-3 rounded-xl border border-border/20 group transition-all hover:bg-muted/30">
                        <div className="flex items-center gap-2 mb-1">
                            <Activity className="w-3.5 h-3.5 text-muted-foreground group-hover:scale-110 transition-transform" />
                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Data Nodes</span>
                        </div>
                        <p className="text-sm font-semibold italic">{activeData.length}</p>
                    </div>
                    <div className="bg-muted/20 p-3 rounded-xl border border-border/20 group transition-all hover:bg-muted/30">
                        <div className="flex items-center gap-2 mb-1">
                            <History className="w-3.5 h-3.5 transition-all duration-500 group-hover:scale-110" style={{ color: chartColor }} />
                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">7d Avg Level</span>
                        </div>
                        <p className="text-sm font-semibold italic">
                            {activeData.length > 0 ? Math.round(activeData.reduce((a, b) => a + b.level, 0) / activeData.length) : 0}%
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
