"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";

export default function LoginPage() {
    const [pin, setPin] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pin }),
            });

            if (res.ok) {
                toast.success("Access Granted");
                router.push("/");
                router.refresh();
            } else {
                toast.error("Invalid PIN");
            }
        } catch (err) {
            toast.error("Authentication failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
            <div className="max-w-md w-full space-y-8 bg-card p-8 rounded-3xl border border-border shadow-xl">
                <div className="text-center space-y-2">
                    <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                        <ShieldAlert className="w-8 h-8 text-primary" />
                    </div>
                    <h1 className="text-3xl font-bold">Secure Access</h1>
                    <p className="text-muted-foreground">Enter your system PIN to continue</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="pin">System PIN</Label>
                        <Input
                            id="pin"
                            type="password"
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            placeholder="••••"
                            className="text-center text-2xl tracking-[1em] h-14"
                            maxLength={8}
                        />
                    </div>
                    <Button type="submit" className="w-full h-12 text-lg shadow-lg shadow-primary/20" disabled={loading}>
                        {loading ? "Verifying..." : "Unlock Dashboard"}
                    </Button>
                </form>
            </div>
        </div>
    );
}
