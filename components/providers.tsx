"use client";

import { ThemeProvider } from "next-themes";
import React from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TelemetryProvider } from "./telemetry-provider";

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <TelemetryProvider>
            <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
                {children}
                <Sonner />
            </ThemeProvider>
        </TelemetryProvider>
    );
}
