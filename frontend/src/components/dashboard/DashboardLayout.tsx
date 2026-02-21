import { useState, ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";
import { UserTour } from "./UserTour";
import { AnimatedBackground } from "@/components/ui/AnimatedBackground";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
}

// Layout principal del panel de Littlefounders
export function DashboardLayout({ children }: DashboardLayoutProps) {
  // Initialize from localStorage or default to true (collapsed by default)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    // Check if running in browser
    if (typeof window !== 'undefined') {
      const isMobile = window.innerWidth < 768; // md breakpoint
      if (isMobile) return true;
    }
    const stored = localStorage.getItem('main_sidebar_collapsed');
    return stored ? JSON.parse(stored) : true; // Default: collapsed
  });

  const handleToggle = () => {
    const newState = !sidebarCollapsed;
    setSidebarCollapsed(newState);
    localStorage.setItem('main_sidebar_collapsed', JSON.stringify(newState));
  };

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-slate-950 dark:via-purple-900/20 dark:to-slate-900">
      {/* Animated Background */}
      <AnimatedBackground />

      <UserTour />
      <div className="flex h-full relative">
        {/* Menú lateral: Flotante y responsivo */}
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={handleToggle}
        />
        <div className="flex-1 flex flex-col h-full overflow-hidden transition-all duration-300 pb-24 md:pb-0">
          {/* Barra superior - spans full width */}
          <TopNav />
          <main className={cn(
            "flex-1 p-6 overflow-y-auto transition-all duration-300",
            // Desktop: dynamic margin for sidebar
            !sidebarCollapsed ? "md:ml-64" : "md:ml-28"
          )} aria-label="Contenido principal">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}