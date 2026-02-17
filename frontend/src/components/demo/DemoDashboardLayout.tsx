import { useState, ReactNode } from "react";
import { GamifiedSidebar } from "./GamifiedSidebar";
import { DemoTopNav } from "./DemoTopNav";
import { DemoTour } from "./DemoTour";
import { AnimatedBackground } from "@/components/ui/AnimatedBackground";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface DemoDashboardLayoutProps {
    children: ReactNode;
}

export function DemoDashboardLayout({ children }: DemoDashboardLayoutProps) {
    const { t } = useTranslation('demo');
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
        <div className="h-screen overflow-hidden bg-gradient-to-br from-cyan-50 via-blue-50 to-purple-50 dark:from-slate-950 dark:via-blue-900/20 dark:to-slate-900">
            {/* Animated Background */}
            <AnimatedBackground />

            <div className="flex h-full overflow-hidden relative">
                {/* Sidebar is now autonomous/floating in its expansion, but occupies 16 (4rem) of space in the grid implicitly or via padding */}
                <GamifiedSidebar
                    collapsed={sidebarCollapsed}
                    onToggle={handleToggle}
                />

                {/* Main Content - TopNav spans full width, main shifts for sidebar */}
                <div className="flex-1 flex flex-col h-full overflow-hidden relative transition-all duration-300 pb-24 md:pb-0">
                    {/* Top Nav - spans full width */}
                    <DemoTopNav />

                    <main className={cn(
                        "flex-1 p-6 overflow-y-auto custom-scrollbar transition-all duration-300",
                        // Desktop: dynamic margin for sidebar
                        !sidebarCollapsed ? "md:ml-64" : "md:ml-28"
                    )} aria-label={t('layout.main_content')}>
                        {children}
                    </main>
                </div>
            </div>
            <DemoTour />
        </div>
    );
}
