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
  // Initialize from localStorage or default to false (expanded/pinned)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    // Check if running in browser
    if (typeof window !== 'undefined') {
      const isMobile = window.innerWidth < 768; // md breakpoint
      if (isMobile) return true;
    }
    const stored = localStorage.getItem('main_sidebar_collapsed');
    return stored ? JSON.parse(stored) : false;
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
        <div className={cn(
          "flex-1 flex flex-col h-full overflow-hidden transition-all duration-300",
          !sidebarCollapsed ? "ml-72" : "ml-16 md:ml-24"
        )}>
          {/* Barra superior: ¡Bienvenido a tu panel de aprendizajes y logros! */}
          <TopNav />
          <main className="flex-1 p-6 overflow-y-auto" aria-label="Contenido principal">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}