import { useState, ReactNode } from "react";
import { GamifiedSidebar } from "./GamifiedSidebar";
import { DemoTopNav } from "./DemoTopNav";
import { DemoTour } from "./DemoTour";
import { AnimatedBackground } from "@/components/ui/AnimatedBackground";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface DemoDashboardLayoutProps {
    children: ReactNode;
    noPadding?: boolean;
}

export function DemoDashboardLayout({ children, noPadding }: DemoDashboardLayoutProps) {
    const { t } = useTranslation('demo');
    // Initialize from localStorage or default to true (collapsed by default)
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        const stored = localStorage.getItem('demo_sidebar_collapsed');
        return stored ? JSON.parse(stored) : true; // Default: collapsed
    });

    const handleToggle = () => {
        const newState = !sidebarCollapsed;
        setSidebarCollapsed(newState);
        localStorage.setItem('demo_sidebar_collapsed', JSON.stringify(newState));
    };

    return (
        <div className="h-screen overflow-hidden bg-gradient-to-br from-cyan-50 via-blue-50 to-purple-50 dark:from-slate-950 dark:via-blue-900/20 dark:to-slate-900">
            {/* Animated Background */}
            <AnimatedBackground />

            <div className="flex h-full overflow-hidden relative">
                {/* Sidebar: always visible.
                    In noPadding (demo) mode: fixed position at z-30 so it floats above
                    the fixed player (z-10) and topnav (z-20) without pushing layout.
                    In normal mode: renders inline in the flex, pushing content right. */}
                {noPadding ? (
                    <div className="fixed left-0 top-0 h-full z-30">
                        <GamifiedSidebar
                            collapsed={sidebarCollapsed}
                            onToggle={handleToggle}
                        />
                    </div>
                ) : (
                    <GamifiedSidebar
                        collapsed={sidebarCollapsed}
                        onToggle={handleToggle}
                    />
                )}

                {/* Main Content: topnav at z-20 to appear above fixed player */}
                <div className="flex-1 flex flex-col h-full overflow-hidden relative transition-all duration-300 pb-24 md:pb-0">
                    {/* Top Nav: z-20 above fixed player (z-10), below sidebar (z-30) */}
                    <div className="relative z-20">
                        <DemoTopNav />
                    </div>

                    <main className={cn(
                        "flex-1 overflow-y-auto custom-scrollbar transition-all duration-300 relative",
                        !noPadding && "p-6",
                        // Desktop: dynamic margin for sidebar (only non-demo mode)
                        !noPadding && (!sidebarCollapsed ? "md:ml-64" : "md:ml-28")
                    )} aria-label={t('layout.main_content')}>
                        {children}
                    </main>
                </div>
            </div>
            <DemoTour />
        </div>
    );
}
