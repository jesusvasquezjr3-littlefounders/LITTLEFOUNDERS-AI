import { useState, ReactNode } from "react";
import { GamifiedSidebar } from "./GamifiedSidebar";
import { DemoTopNav } from "./DemoTopNav";
import { DemoTour } from "./DemoTour";

interface DemoDashboardLayoutProps {
    children: ReactNode;
}

export function DemoDashboardLayout({ children }: DemoDashboardLayoutProps) {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    return (
        <div className="min-h-screen bg-[#fdfbf7]" style={{
            backgroundImage: `radial-gradient(#e5e0d8 1px, transparent 1px)`,
            backgroundSize: '20px 20px'
        }}>
            <div className="flex h-screen overflow-hidden">
                <GamifiedSidebar
                    collapsed={sidebarCollapsed}
                    onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
                />
                <div className="flex-1 flex flex-col overflow-hidden relative">
                    {/* Top Nav with glassmorphism */}
                    <div className="sticky top-0 z-10 bg-white/40 backdrop-blur-md border-b border-white/20">
                        <DemoTopNav />
                    </div>

                    <main className="flex-1 p-6 overflow-auto custom-scrollbar" aria-label="Contenido principal">
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
