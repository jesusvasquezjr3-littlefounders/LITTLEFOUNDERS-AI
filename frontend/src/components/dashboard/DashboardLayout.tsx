import { useState, ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";
import { UserTour } from "./UserTour";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
}

// Layout principal del panel de Littlefounders
export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="h-screen overflow-hidden bg-background">
      <UserTour />
      <div className="flex h-full relative">
        {/* Menú lateral: Flotante y responsivo */}
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <div className={cn(
          "flex-1 flex flex-col h-full overflow-hidden transition-all duration-300",
          !sidebarCollapsed ? "ml-72" : "ml-20 md:ml-24"
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