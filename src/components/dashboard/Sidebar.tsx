import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  BarChart3,
  Users,
  Package,
  UserCheck,
  DollarSign,
  TrendingUp,
  Settings,
  HelpCircle,
  ChevronLeft,
  Home,
  BookOpen
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const menuItems = [
  { title: "Inicio", url: "/", icon: Home, color: "text-primary" },
  { title: "Ahorros", url: "/revenue", icon: DollarSign, color: "text-revenue" },
  { title: "Amiguitos", url: "/customers", icon: Users, color: "text-customers" },
  { title: "Mis Logros", url: "/product", icon: Package, color: "text-product" },
  { title: "Mi Equipo", url: "/team", icon: UserCheck, color: "text-team" },
  { title: "Lecciones", url: "/lecciones", icon: BookOpen, color: "text-blue-600" },
  { title: "Reportes", url: "/analytics", icon: BarChart3, color: "text-primary" },
  { title: "Crecimiento", url: "/growth", icon: TrendingUp, color: "text-primary" },
];

const bottomItems = [
  { title: "Configuración", url: "/settings", icon: Settings },
  { title: "Ayuda", url: "/help", icon: HelpCircle },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => {
    if (path === "/") return currentPath === "/";
    return currentPath.startsWith(path);
  };

  return (
    <div
      className={cn(
        "relative flex flex-col bg-card border-r border-border h-screen transition-all duration-300 ease-in-out",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Encabezado */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        {!collapsed && (
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">Littlefounders</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="h-8 w-8 p-0 hover:bg-muted"
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </Button>
      </div>

      {/* Navegación Principal */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => (
          <NavLink
            key={item.title}
            to={item.url}
            className={({ isActive: linkActive }) =>
              cn(
                "flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                "hover:bg-muted hover:scale-[1.02]",
                linkActive || isActive(item.url)
                  ? "bg-primary/10 text-primary shadow-soft"
                  : "text-muted-foreground hover:text-foreground"
              )
            }
          >
            <item.icon 
              className={cn(
                "w-5 h-5 transition-colors",
                isActive(item.url) ? item.color : "text-muted-foreground"
              )} 
            />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Navegación Inferior */}
      <div className="px-3 py-4 border-t border-border space-y-1">
        {bottomItems.map((item) => (
          <NavLink
            key={item.title}
            to={item.url}
            className={({ isActive: linkActive }) =>
              cn(
                "flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                "hover:bg-muted hover:scale-[1.02]",
                linkActive
                  ? "bg-primary/10 text-primary shadow-soft"
                  : "text-muted-foreground hover:text-foreground"
              )
            }
          >
            <item.icon className="w-5 h-5" />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        ))}
      </div>
    </div>
  );
}