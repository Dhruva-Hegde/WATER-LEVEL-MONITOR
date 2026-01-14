"use client";

import { useState, useEffect } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Legend } from "recharts";
import { format } from "date-fns";
import { LayoutGrid, Calendar, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart";

interface AllTanksHistoryModalProps {
    onClose: () => void;
}

const COLORS = [
    "hsl(var(--primary))",
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
];

export function AllTanksHistoryModal({ onClose }: AllTanksHistoryModalProps) {
    const [data, setData] = useState<any[]>([]);
    const [tankConfig, setTankConfig] = useState<ChartConfig>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchFleetHistory() {
            try {
                const res = await fetch("/api/history");
                const { history, tanks } = await res.json();

                // 1. Build Chart Config
                const config: ChartConfig = {};
                tanks.forEach((tank: any, index: number) => {
                    config[tank.id] = {
                        label: tank.name,
                        color: COLORS[index % COLORS.length],
                    };
                });
                setTankConfig(config);

                // 2. Group by Time for AreaChart
                // We need to merge all readings into time buckets
                // Simplified: use a map of timestamp -> readings
                const timeMap: Record<number, any> = {};

                history.forEach((r: any) => {
                    // Round to nearest 10 mins for better alignment
                    const bucket = Math.floor(r.timestamp / 600) * 600;
                    if (!timeMap[bucket]) {
                        timeMap[bucket] = {
                            timestamp: bucket,
                            time: format(new Date(bucket * 1000), "HH:mm"),
                        };
                    }
                    timeMap[bucket][r.tankId] = r.level;
                });

                const sortedData = Object.values(timeMap).sort((a, b) => a.timestamp - b.timestamp);
                setData(sortedData);
            } catch (err) {
                console.error("Failed to load fleet history:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchFleetHistory();
    }, []);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm section-fade-in">
            <div className="bg-card border border-border/40 w-full max-w-5xl p-6 rounded-3xl shadow-2xl space-y-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32 -z-10" />

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                            <LayoutGrid className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold tracking-tight">Fleet History</h2>
                            <p className="text-xs text-muted-foreground">All tanks performance (Last 24 Hours)</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
                        <X className="w-5 h-5" />
                        <span className="sr-only">Close</span>
                    </Button>
                </div>

                <div className="bg-muted/30 rounded-2xl p-4 border border-border/40 aspect-[2.5/1] min-h-[450px] flex items-center justify-center relative">
                    {loading ? (
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                            <p className="text-sm text-muted-foreground">Compiling fleet metrics...</p>
                        </div>
                    ) : data.length > 0 ? (
                        <ChartContainer config={tankConfig} className="w-full h-full p-2">
                            <AreaChart
                                data={data}
                                margin={{ left: 12, right: 12, top: 12, bottom: 12 }}
                            >
                                <defs>
                                    {Object.entries(tankConfig).map(([id, config]) => (
                                        <linearGradient key={`fill-${id}`} id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={config.color as string} stopOpacity={0.2} />
                                            <stop offset="95%" stopColor={config.color as string} stopOpacity={0.02} />
                                        </linearGradient>
                                    ))}
                                </defs>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted-foreground/10" />
                                <XAxis
                                    dataKey="time"
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={8}
                                    minTickGap={40}
                                    tick={{ fontSize: 10 }}
                                />
                                <YAxis
                                    domain={[0, 100]}
                                    axisLine={false}
                                    tickLine={false}
                                    tickMargin={8}
                                    tick={{ fontSize: 10 }}
                                    unit="%"
                                />
                                <ChartTooltip
                                    cursor={false}
                                    content={<ChartTooltipContent />}
                                />
                                {Object.keys(tankConfig).map((id) => (
                                    <Area
                                        key={id}
                                        dataKey={id}
                                        name={id}
                                        type="monotone"
                                        stroke={tankConfig[id].color as string}
                                        strokeWidth={2}
                                        fill={`url(#fill-${id})`}
                                        dot={false}
                                        activeDot={{ r: 4, strokeWidth: 0 }}
                                    />
                                ))}
                                <Legend
                                    verticalAlign="top"
                                    height={36}
                                    formatter={(value) => (
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-4">
                                            {tankConfig[value]?.label || value}
                                        </span>
                                    )}
                                />
                            </AreaChart>
                        </ChartContainer>
                    ) : (
                        <div className="text-center space-y-2">
                            <Calendar className="w-10 h-10 text-muted-foreground/20 mx-auto" />
                            <p className="text-sm text-muted-foreground">No historical data recorded for the fleet yet.</p>
                        </div>
                    )}
                </div>

                <div className="flex justify-between items-center text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-2">
                    <span>Last 24 Hours Performance</span>
                    <span>{data.length} Data Points / Tank (Avg)</span>
                </div>
            </div>
        </div>
    );
}
