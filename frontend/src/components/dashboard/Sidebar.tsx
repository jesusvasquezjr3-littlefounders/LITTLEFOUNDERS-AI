import { useRef, useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  BarChart3,
  Settings,
  HelpCircle,
  ChevronLeft,
  Home,
  BookOpen,
  Trophy,
  ClipboardList,
  PiggyBank,
  Store,
  Lightbulb,
  TrendingUp,
  Map as MapIcon,
  Menu
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// Obtener información del usuario
const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
};

const getMenuItems = () => {
  const user = getUser();

  if (user.user_type === 'child') {
    // Menú para niños (Gamified colors)
    return [
      { title: "Inicio", url: "/dashboard", icon: Home, color: "text-blue-500", bg: "bg-blue-100", id: "nav-home" },
      { title: "Mis Ahorros", url: "/savings", icon: PiggyBank, color: "text-green-600", bg: "bg-green-100", id: "nav-savings" },
      { title: "Tiendita", url: "/store", icon: Store, color: "text-purple-600", bg: "bg-purple-100", id: "nav-store" },
      { title: "Lecciones", url: "/lecciones", icon: BookOpen, color: "text-indigo-600", bg: "bg-indigo-100", id: "nav-lessons" },
      { title: "Mis Tareas", url: "/tasks", icon: Trophy, color: "text-yellow-600", bg: "bg-yellow-100", id: "nav-tasks" },
      { title: "Emprendimiento", url: "/investment-games", icon: Lightbulb, color: "text-orange-500", bg: "bg-orange-100", id: "nav-games" },
      { title: "Banca Digital", url: "/growth", icon: TrendingUp, color: "text-red-500", bg: "bg-red-100", id: "nav-banking" },
    ];
  } else {
    // Menú para padres (More sober but consistent structure)
    return [
      { title: "Inicio", url: "/dashboard", icon: Home, color: "text-primary", bg: "bg-primary/10", id: "nav-home" },
      { title: "Mis Ahorros", url: "/savings", icon: PiggyBank, color: "text-green-600", bg: "bg-green-100", id: "nav-savings" },
      { title: "Tiendita", url: "/store", icon: Store, color: "text-purple-600", bg: "bg-purple-100", id: "nav-store" },
      { title: "Lecciones", url: "/lecciones", icon: BookOpen, color: "text-indigo-600", bg: "bg-indigo-100", id: "nav-lessons" },
      { title: "Gestión de Tareas", url: "/parent-tasks", icon: ClipboardList, color: "text-yellow-600", bg: "bg-yellow-100", id: "nav-tasks" },
      { title: "Emprendimiento", url: "/investment-games", icon: Lightbulb, color: "text-orange-500", bg: "bg-orange-100", id: "nav-games" },
      { title: "Banca Digital", url: "/growth", icon: TrendingUp, color: "text-red-500", bg: "bg-red-100", id: "nav-banking" },
    ];
  }
};

const bottomItems = [
  { title: "Configuración", url: "/settings", icon: Settings, color: "text-slate-600", bg: "bg-slate-100", id: "nav-settings" },
  { title: "Ayuda", url: "/help", icon: HelpCircle, color: "text-slate-600", bg: "bg-slate-100", id: "nav-help" },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation();
  const currentPath = location.pathname;
  const menuItems = getMenuItems();
  const containerRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) => {
    if (path === "/dashboard") return currentPath === "/dashboard";
    return currentPath.startsWith(path);
  };

  useEffect(() => {
    const activeItem = [...menuItems, ...bottomItems].find(item => isActive(item.url));
    if (activeItem && containerRef.current) {
      const el = document.getElementById(activeItem.id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [location.pathname]);

  return (
    <div
      className={cn(
        "relative flex flex-col h-screen transition-all duration-300 ease-in-out z-20",
        collapsed ? "w-24" : "w-72",
        "bg-[#fdfbf7] border-r-4 border-[#e5e0d8]", // Paper-like background
        "shadow-[4px_0_24px_rgba(0,0,0,0.05)]"
      )}
      style={{
        backgroundImage: `radial-gradient(#e5e0d8 1px, transparent 1px)`,
        backgroundSize: '20px 20px'
      }}
    >
      {/* Header */}
      <div className="p-6 border-b-2 border-dashed border-[#e5e0d8] flex items-center justify-between bg-white/50 backdrop-blur-sm">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="p-2 bg-orange-500 rounded-xl shadow-[0_4px_0_#c2410c] transform transition-transform hover:translate-y-[2px] hover:shadow-[0_2px_0_#c2410c]">
              <MapIcon className="w-6 h-6 text-white" />
            </div>
            <span className="font-black text-xl text-slate-700 tracking-tight">
              Littlefounders
            </span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="hover:bg-orange-100 text-orange-600 mx-auto"
        >
          {collapsed ? <Menu className="w-6 h-6" /> : <ChevronLeft className="w-6 h-6" />}
        </Button>
      </div>

      {/* Path Container */}
      <div ref={containerRef} className="flex-1 overflow-y-auto overflow-x-hidden relative py-8 custom-scrollbar scroll-smooth">
        {/* Winding Path SVG Line (Only visible when expanded) */}
        {!collapsed && (
          <svg className="absolute top-0 left-[2.25rem] w-12 h-full pointer-events-none z-0" style={{ height: `${(menuItems.length + bottomItems.length) * 80 + 100}px` }}>
            <path
              d={`M 24 20 ${menuItems.map((_, i) => `L 24 ${i * 80 + 60}`).join(' ')} L 24 ${(menuItems.length) * 80 + 40} ${bottomItems.map((_, i) => `L 24 ${(menuItems.length + i) * 80 + 100}`).join(' ')}`}
              fill="none"
              stroke="#e5e0d8"
              strokeWidth="4"
              strokeDasharray="8 8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}

        {/* Menu Items */}
        <div className="space-y-4 px-4 relative z-10">
          {menuItems.map((item) => {
            const active = isActive(item.url);
            return (
              <NavLink
                key={item.title}
                to={item.url}
                id={item.id}
                className={({ isActive }) => cn(
                  "group flex items-center gap-2 p-3 rounded-2xl transition-all duration-300",
                  "hover:translate-x-2",
                  active ? "bg-white shadow-[0_8px_16px_rgba(0,0,0,0.08)] scale-105" : "hover:bg-white/60",
                  collapsed && "justify-center px-1"
                )}
              >
                {/* Icon Node */}
                <div className={cn(
                  "relative rounded-2xl flex items-center justify-center transition-all duration-300",
                  "shadow-[0_4px_0_rgba(0,0,0,0.1)]",
                  collapsed ? "w-16 h-12" : "w-12 h-12",
                  active
                    ? cn(item.bg, "translate-y-[2px] shadow-[0_2px_0_rgba(0,0,0,0.1)] ring-4 ring-white")
                    : "bg-white border-2 border-slate-100 group-hover:border-orange-200"
                )}>
                  <item.icon className={cn(
                    "w-6 h-6 transition-transform duration-300",
                    active ? item.color : "text-slate-400 group-hover:text-orange-400 group-hover:scale-110"
                  )} />

                  {/* Connector Dot */}
                  {!collapsed && (
                    <div className={cn(
                      "absolute -left-[22px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white",
                      active ? "bg-orange-500 scale-125" : "bg-slate-200"
                    )} />
                  )}
                </div>

                {/* Label */}
                {!collapsed && (
                  <div className="flex-1">
                    <span className={cn(
                      "font-bold text-base block transition-colors",
                      active ? "text-slate-800" : "text-slate-500 group-hover:text-slate-700"
                    )}>
                      {item.title}
                    </span>
                    {active && (
                      <span className="text-xs font-medium text-orange-500 animate-pulse">
                        ¡Estás aquí! 📍
                      </span>
                    )}
                  </div>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Divider */}
        <div className="my-4 border-t-2 border-dashed border-[#e5e0d8] mx-4" />

        {/* Bottom Items */}
        <div className="space-y-4 px-4 relative z-10">
          {bottomItems.map((item) => (
            <NavLink
              key={item.title}
              to={item.url}
              id={item.id}
              className={({ isActive }) => cn(
                "group flex items-center gap-2 p-3 rounded-2xl transition-all duration-300",
                "hover:translate-x-2",
                isActive ? "bg-white shadow-[0_8px_16px_rgba(0,0,0,0.08)] scale-105" : "hover:bg-white/60",
                collapsed && "justify-center px-1"
              )}
            >
              <div className={cn(
                "relative rounded-2xl flex items-center justify-center transition-all duration-300 shadow-[0_4px_0_rgba(0,0,0,0.1)]",
                collapsed ? "w-16 h-12" : "w-12 h-12",
                isActive(item.url) ? "bg-slate-100 translate-y-[2px] shadow-[0_2px_0_rgba(0,0,0,0.1)] ring-4 ring-white" : "bg-white border-2 border-slate-100 group-hover:border-orange-200"
              )}>
                <item.icon className="w-5 h-5 text-slate-500" />
                {!collapsed && (
                  <div className={cn(
                    "absolute -left-[22px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white",
                    isActive(item.url) ? "bg-orange-500 scale-125" : "bg-slate-200"
                  )} />
                )}
              </div>
              {!collapsed && <span className="font-bold text-base text-slate-500 group-hover:text-slate-700">{item.title}</span>}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Footer / Restart Tour */}
      <div className="p-4 bg-white/50 backdrop-blur-sm border-t-2 border-dashed border-[#e5e0d8]">
        <Button
          variant="ghost"
          className={cn(
            "w-full bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white shadow-[0_4px_0_#b45309] active:shadow-[0_2px_0_#b45309] active:translate-y-[2px] transition-all rounded-xl",
            collapsed ? "h-12 w-12 p-0 rounded-2xl" : "py-6"
          )}
          onClick={() => window.dispatchEvent(new Event('restartUserTour'))}
          title="Ver Tutorial"
        >
          {!collapsed ? (
            <div className="flex items-center gap-2 font-black tracking-wide">
              <span>VER TUTORIAL</span>
              <span className="text-lg">↺</span>
            </div>
          ) : (
            <span className="font-black text-lg">↺</span>
          )}
        </Button>
      </div>
    </div>
  );
}