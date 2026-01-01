import { useState, ReactNode } from "react";
import { GamifiedSidebar } from "./GamifiedSidebar";
import { DemoTopNav } from "./DemoTopNav";
import { DemoTour } from "./DemoTour";
import { cn } from "@/lib/utils";

interface DemoDashboardLayoutProps {
    children: ReactNode;
}

export function DemoDashboardLayout({ children }: DemoDashboardLayoutProps) {
    // Initialize from localStorage or default to false (expanded/pinned)
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        const stored = localStorage.getItem('demo_sidebar_collapsed');
        return stored ? JSON.parse(stored) : false;
    });

    const handleToggle = () => {
        const newState = !sidebarCollapsed;
        setSidebarCollapsed(newState);
        localStorage.setItem('demo_sidebar_collapsed', JSON.stringify(newState));
    };

    return (
        <div className="h-screen overflow-hidden bg-gradient-to-b from-blue-50/50 to-white dark:from-slate-950 dark:to-slate-900">


            <div className="flex h-full overflow-hidden relative">
                {/* Sidebar is now autonomous/floating in its expansion, but occupies 16 (4rem) of space in the grid implicitly or via padding */}
                <GamifiedSidebar
                    collapsed={sidebarCollapsed}
                    onToggle={handleToggle}
                />

                {/* Main Content - Shifts when Pinned (collapsed=false), otherwise 16/20 for icon bar */}
                <div
                    className={cn(
                        "flex-1 flex flex-col h-full overflow-hidden relative transition-all duration-300",
                        !sidebarCollapsed ? "ml-72" : "ml-20 md:ml-24"
                    )}
                >
                    {/* Top Nav with glassmorphism */}
                    <div className="sticky top-0 z-10 bg-white/40 backdrop-blur-md border-b border-white/20">
                        <DemoTopNav />
                    </div>

                    <main className="flex-1 p-6 overflow-y-auto custom-scrollbar" aria-label="Contenido principal">
                        <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {children}
                        </div>
                    </main>
                </div>
            </div>
            <DemoTour />
        </div>
    );
}
