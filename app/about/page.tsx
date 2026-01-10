"use client";

import Link from "next/link";
import { ArrowLeft, Users, Award } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AboutPage() {
    const teamMembers = [
        { name: "Team Member 1", role: "Full Stack Developer" },
        { name: "Team Member 2", role: "IoT Engineer" },
        { name: "Team Member 3", role: "Frontend Developer" },
        { name: "Team Member 4", role: "Backend Developer" },
        { name: "Team Member 5", role: "UI/UX Designer" },
        { name: "Team Member 6", role: "Hardware Engineer" },
    ];

    const guide = {
        name: "Dr. Guide Name",
        role: "Project Supervisor",
        title: "Professor, Department of Engineering"
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center">
                    <Link href="/">
                        <Button variant="ghost" size="sm" className="gap-2">
                            <ArrowLeft className="w-4 h-4" />
                            Back to Dashboard
                        </Button>
                    </Link>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
                <div className="space-y-12">
                    {/* Hero Section */}
                    <div className="text-center space-y-4">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border border-primary/20 mb-4">
                            <Users className="w-8 h-8 text-primary" />
                        </div>
                        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">About Smart Tank Monitor</h1>
                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                            An intelligent IoT-based water level monitoring system designed to provide real-time insights
                            and automated control for efficient water management.
                        </p>
                    </div>

                    {/* Project Description */}
                    <div className="prose prose-neutral dark:prose-invert max-w-none">
                        <div className="rounded-2xl border border-border/40 bg-muted/30 p-6 sm:p-8">
                            <h2 className="text-2xl font-semibold mb-4">Project Overview</h2>
                            <p className="text-muted-foreground leading-relaxed">
                                Smart Tank Monitor is a comprehensive solution that combines IoT sensors, real-time data processing,
                                and an intuitive web interface to monitor water levels across multiple tanks. The system enables
                                automated alerts, historical data analysis, and remote monitoring capabilities, making water
                                management more efficient and reliable.
                            </p>
                        </div>
                    </div>

                    {/* Team Section */}
                    <div className="space-y-6">
                        <div className="text-center">
                            <h2 className="text-3xl font-bold tracking-tight mb-2">Our Team</h2>
                            <p className="text-muted-foreground">The brilliant minds behind this project</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                            {teamMembers.map((member, index) => (
                                <div
                                    key={index}
                                    className="group relative rounded-xl border border-border/40 bg-card p-6 hover:border-primary/40 hover:shadow-lg transition-all duration-300"
                                >
                                    <div className="flex flex-col items-center text-center space-y-3">
                                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20 group-hover:border-primary/40 transition-colors">
                                            <span className="text-2xl font-bold text-primary">{member.name.charAt(0)}</span>
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-lg">{member.name}</h3>
                                            <p className="text-sm text-muted-foreground">{member.role}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Guide Section */}
                    <div className="space-y-6">
                        <div className="text-center">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 mb-3">
                                <Award className="w-6 h-6 text-amber-500" />
                            </div>
                            <h2 className="text-2xl font-bold tracking-tight mb-2">Under the Guidance of</h2>
                        </div>

                        <div className="max-w-md mx-auto">
                            <div className="rounded-xl border-2 border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent p-8 text-center space-y-3">
                                <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center border-2 border-amber-500/30 mx-auto">
                                    <span className="text-3xl font-bold text-amber-500">{guide.name.charAt(0)}</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-xl">{guide.name}</h3>
                                    <p className="text-sm text-muted-foreground">{guide.title}</p>
                                    <p className="text-sm font-medium text-amber-600 dark:text-amber-400 mt-1">{guide.role}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="text-center pt-8 border-t border-border/40">
                        <p className="text-sm text-muted-foreground">
                            Built with passion using Next.js, TypeScript, and IoT technologies
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}
