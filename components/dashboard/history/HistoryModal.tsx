"use client";

import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { Droplets, Calendar, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HistoryModalProps {
    tankId: string;
    tankName: string;
    onClose: () => void;
}

export function HistoryModal({ tankId, tankName, onClose }: HistoryModalProps) {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchHistory() {
            try {
                const res = await fetch(`/api/tanks/${tankId}/history`);
                const json = await res.json();

                // Format for Recharts
                const formatted = json.map((r: any) => ({
                    time: format(new Date(r.timestamp), "HH:mm"),
                    level: r.level,
                    fullTime: format(new Date(r.timestamp), "MMM d, HH:mm")
                })).reverse(); // Oldest first for chart

                setData(formatted);
            } catch (err) {
                console.error("Failed to load history:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchHistory();
    }, [tankId]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm section-fade-in">
            <div className="bg-card border border-border/40 w-full max-w-4xl p-6 rounded-3xl shadow-2xl space-y-6 relative overflow-hidden">
                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32 -z-10" />

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                            <Droplets className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold tracking-tight">{tankName} History</h2>
                            <p className="text-xs text-muted-foreground">Water usage statistics (Last 24 Hours)</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
                        <span className="sr-only">Close</span>
                        ✕
                    </Button>
                </div>

                <div className="bg-muted/30 rounded-2xl p-4 border border-border/40 aspect-[2/1] min-h-[300px] flex items-center justify-center">
                    {loading ? (
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                            <p className="text-sm text-muted-foreground">Analysing fleet logs...</p>
                        </div>
                    ) : data.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis
                                    dataKey="time"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                                />
                                <YAxis
                                    domain={[0, 100]}
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                                    unit="%"
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'var(--card)',
                                        borderColor: 'var(--border)',
                                        borderRadius: '12px',
                                        fontSize: '12px'
                                    }}
                                    itemStyle={{ color: 'var(--primary)' }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="level"
                                    stroke="var(--primary)"
                                    strokeWidth={3}
                                    dot={{ r: 4, fill: 'var(--primary)', strokeWidth: 0 }}
                                    activeDot={{ r: 6, strokeWidth: 0 }}
                                    animationDuration={1500}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="text-center space-y-2">
                            <Calendar className="w-10 h-10 text-muted-foreground/20 mx-auto" />
                            <p className="text-sm text-muted-foreground">No historical data recorded yet.</p>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-muted/20 p-3 rounded-xl border border-border/20">
                        <div className="flex items-center gap-2 mb-1">
                            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Interval</span>
                        </div>
                        <p className="text-sm font-semibold italic">10 Minutes</p>
                    </div>
                    <div className="bg-muted/20 p-3 rounded-xl border border-border/20">
                        <div className="flex items-center gap-2 mb-1">
                            <Droplets className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Data Points</span>
                        </div>
                        <p className="text-sm font-semibold italic">{data.length}</p>
                    </div>
                    <div className="bg-muted/20 p-3 rounded-xl border border-border/20">
                        <div className="flex items-center gap-2 mb-1">
                            <Droplets className="w-3.5 h-3.5 text-blue-400" />
                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Avg Level</span>
                        </div>
                        <p className="text-sm font-semibold italic">
                            {data.length > 0 ? Math.round(data.reduce((a, b) => a + b.level, 0) / data.length) : 0}%
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
