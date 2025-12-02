import { useState, ReactNode } from "react";
import { DemoSidebar } from "./DemoSidebar";
import { DemoTopNav } from "./DemoTopNav";
import { DemoTour } from "./DemoTour";

interface DemoDashboardLayoutProps {
    children: ReactNode;
}

export function DemoDashboardLayout({ children }: DemoDashboardLayoutProps) {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    return (
        <div className="min-h-screen bg-background">
            <div className="flex">
                <DemoSidebar
                    collapsed={sidebarCollapsed}
                    onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
                />
                <div className="flex-1 flex flex-col">
                    <DemoTopNav />
                    <main className="flex-1 p-6 overflow-auto" aria-label="Contenido principal">
                        {children}
                    </main>
                </div>
            </div>
            <DemoTour />
        </div>
    );
}
