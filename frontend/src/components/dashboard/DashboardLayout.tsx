import { useState, ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";

interface DashboardLayoutProps {
  children: ReactNode;
}

// Layout principal del panel de Littlefounders
export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Menú lateral: aquí puedes encontrar todas las secciones divertidas para aprender sobre finanzas */}
        <Sidebar 
          collapsed={sidebarCollapsed} 
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} 
        />
        <div className="flex-1 flex flex-col">
          {/* Barra superior: ¡Bienvenido a tu panel de aprendizajes y logros! */}
          <TopNav />
          <main className="flex-1 p-6 overflow-auto" aria-label="Contenido principal">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}