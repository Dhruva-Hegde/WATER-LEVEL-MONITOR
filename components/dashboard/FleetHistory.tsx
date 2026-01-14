"use client";

import { useState, useEffect, useMemo } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Legend } from "recharts";
import { format } from "date-fns";
import { Activity, History, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    ChartLegend,
    ChartLegendContent,
} from "@/components/ui/chart";

const COLORS = [
    "oklch(0.65 0.15 240)",   // Water Blue
    "oklch(0.75 0.1 220)",    // Soft Cyan
    "oklch(0.55 0.12 250)",   // Deep Navy
    "oklch(0.8 0.05 200)",    // Mist Teal
    "oklch(0.6 0.08 230)",    // Steel Blue
];

export function FleetHistory() {
    const [data, setData] = useState<{ history: any[], tanks: any[] }>({ history: [], tanks: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchFleetHistory() {
            try {
                const res = await fetch("/api/history?range=1440");
                const json = await res.json();
                setData(json);
            } catch (err) {
                console.error("Failed to load fleet history:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchFleetHistory();
    }, []);

    const chartConfig = useMemo(() => {
        const config: ChartConfig = {};
        data.tanks.forEach((tank, index) => {
            config[tank.id] = {
                label: tank.name,
                color: COLORS[index % COLORS.length],
            };
        });
        return config;
    }, [data.tanks]);

    const processedData = useMemo(() => {
        if (!data.history.length) return [];

        // Pivot readings to group by timestamp
        // We round to nearest 5 minutes to align data points from different tanks
        const timeMap = new Map<number, any>();

        data.history.forEach(r => {
            const t = Math.floor(r.timestamp / 300) * 300 * 1000;
            if (!timeMap.has(t)) {
                timeMap.set(t, { timestamp: t });
            }
            // If multiple readings in same bucket, we could average, but here we just take the last one
            timeMap.get(t)[r.tankId] = r.level;
        });

        return Array.from(timeMap.values()).sort((a, b) => a.timestamp - b.timestamp);
    }, [data.history]);

    if (loading) {
        return (
            <Card className="p-6 h-[400px] flex items-center justify-center bg-card/50 backdrop-blur border-border/40">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    <p className="text-sm text-muted-foreground italic">Compiling fleet analytics...</p>
                </div>
            </Card>
        );
    }

    if (!processedData.length) {
        return null;
    }

    return (
        <Card className="p-6 bg-card/50 backdrop-blur border-border/40 space-y-4 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32 -z-10" />

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                        <History className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold tracking-tight">Fleet Overview</h2>
                        <p className="text-xs text-muted-foreground">Water level history across all active nodes (24h)</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/30 border border-border/40">
                    <Activity className="w-3.5 h-3.5 text-primary animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Fleet Active</span>
                </div>
            </div>

            <div className="h-[300px] w-full mt-4">
                <ChartContainer config={chartConfig} className="w-full h-full">
                    <AreaChart
                        data={processedData}
                        margin={{
                            left: 12,
                            right: 12,
                            top: 12,
                            bottom: 12,
                        }}
                    >
                        <defs>
                            {data.tanks.map((tank, index) => (
                                <linearGradient key={tank.id} id={`fill-${tank.id}`} x1="0" y1="0" x2="0" y2="1">
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
                            tickMargin={8}
                            tick={{ fontSize: 10 }}
                            tickFormatter={(val) => {
                                if (!val || isNaN(val)) return "";
                                try {
                                    return format(new Date(val), "HH:mm");
                                } catch (e) {
                                    return "";
                                }
                            }}
                            type="number"
                            domain={['dataMin', 'dataMax']}
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
                        {data.tanks.map((tank, index) => (
                            <Area
                                key={tank.id}
                                dataKey={tank.id}
                                name={tank.name}
                                type="monotone"
                                fill={`url(#fill-${tank.id})`}
                                stroke={COLORS[index % COLORS.length]}
                                strokeWidth={2}
                                // Removed stackId for overlapping style
                                animationDuration={1500}
                                connectNulls
                                fillOpacity={0.2}
                            />
                        ))}
                    </AreaChart>
                </ChartContainer>
            </div>
        </Card>
    );
}
