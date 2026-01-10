import { useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Settings,
  HelpCircle,
  Home,
  BookOpen,
  Trophy,
  ClipboardList,
  PiggyBank,
  Store,
  Lightbulb,
  TrendingUp,
  ChevronsLeftRight,
  Lock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

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
    return [
      { title: "Inicio", url: "/dashboard", icon: Home, color: "from-blue-400 to-blue-600", shadow: "shadow-blue-500/40", id: "nav-home" },
      { title: "Lecciones", url: "/lecciones", icon: BookOpen, color: "from-indigo-400 to-indigo-600", shadow: "shadow-indigo-500/40", id: "nav-lessons" },
      { title: "Mis Tareas", url: "/tasks", icon: Trophy, color: "from-yellow-400 to-orange-500", shadow: "shadow-yellow-500/40", id: "nav-tasks" },
      { title: "Mis Ahorros", url: "/savings", icon: PiggyBank, color: "from-green-400 to-emerald-600", shadow: "shadow-green-500/40", id: "nav-savings" },
      { title: "Emprendimiento", url: "/investment-games", icon: Lightbulb, color: "from-orange-400 to-red-500", shadow: "shadow-orange-500/40", id: "nav-games" },
      { title: "Banca Digital", url: "/growth", icon: TrendingUp, color: "from-pink-400 to-rose-600", shadow: "shadow-pink-500/40", id: "nav-banking" },
      { title: "Tiendita", url: "/store", icon: Store, color: "from-purple-400 to-violet-600", shadow: "shadow-purple-500/40", id: "nav-store" },
    ];
  } else if (user.user_type === 'universal') {
    return [
      { title: "Inicio", url: "/dashboard", icon: Home, color: "from-blue-400 to-blue-600", shadow: "shadow-blue-500/40", id: "nav-home" },
      { title: "Lecciones", url: "/lecciones", icon: BookOpen, color: "from-indigo-400 to-indigo-600", shadow: "shadow-indigo-500/40", id: "nav-lessons" },
      { title: "Emprendimiento", url: "/investment-games", icon: Lightbulb, color: "from-orange-400 to-red-500", shadow: "shadow-orange-500/40", id: "nav-games" },
      { title: "Mis Tareas", url: "#", icon: Trophy, color: "from-slate-300 to-slate-400", shadow: "", id: "nav-tasks", locked: true },
      { title: "Mis Ahorros", url: "#", icon: PiggyBank, color: "from-slate-300 to-slate-400", shadow: "", id: "nav-savings", locked: true },
      { title: "Banca Digital", url: "#", icon: TrendingUp, color: "from-slate-300 to-slate-400", shadow: "", id: "nav-banking", locked: true },
      { title: "Tiendita", url: "#", icon: Store, color: "from-slate-300 to-slate-400", shadow: "", id: "nav-store", locked: true },
    ];
  } else {
    return [
      { title: "Inicio", url: "/dashboard", icon: Home, color: "from-blue-400 to-blue-600", shadow: "shadow-blue-500/40", id: "nav-home" },
      { title: "Lecciones", url: "/lecciones", icon: BookOpen, color: "from-indigo-400 to-indigo-600", shadow: "shadow-indigo-500/40", id: "nav-lessons" },
      { title: "Gestión de Tareas", url: "/parent-tasks", icon: ClipboardList, color: "from-yellow-400 to-orange-500", shadow: "shadow-yellow-500/40", id: "nav-tasks" },
      { title: "Mis Ahorros", url: "/savings", icon: PiggyBank, color: "from-green-400 to-emerald-600", shadow: "shadow-green-500/40", id: "nav-savings" },
      { title: "Emprendimiento", url: "/investment-games", icon: Lightbulb, color: "from-orange-400 to-red-500", shadow: "shadow-orange-500/40", id: "nav-games" },
      { title: "Banca Digital", url: "/growth", icon: TrendingUp, color: "from-pink-400 to-rose-600", shadow: "shadow-pink-500/40", id: "nav-banking" },
      { title: "Tiendita", url: "/store", icon: Store, color: "from-purple-400 to-violet-600", shadow: "shadow-purple-500/40", id: "nav-store" },
    ];
  }
};

const bottomItems = [
  { title: "Configuración", url: "/settings", icon: Settings, color: "from-slate-400 to-slate-500", shadow: "shadow-slate-500/30", id: "nav-settings" },
  { title: "Ayuda", url: "/help", icon: HelpCircle, color: "from-cyan-400 to-teal-500", shadow: "shadow-cyan-500/30", id: "nav-help" },
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
  const [isHovered, setIsHovered] = useState(false);
  const { toast } = useToast();

  const isExpanded = isHovered || !collapsed;

  const isActive = (path: string) => {
    if (path === "#") return false;
    if (path === "/dashboard") return currentPath === "/dashboard";
    return currentPath.startsWith(path);
  };

  const handleItemClick = (e: React.MouseEvent, item: any) => {
    if (item.locked) {
      e.preventDefault();
      toast({
        title: "Función en Desarrollo",
        description: "Esta funcionalidad estará disponible próximamente.",
        variant: "default",
      });
    }
  };

  // Combine main items and bottom items for mobile horizontal view
  const allItems = [...menuItems, ...bottomItems];

  return (
    <>
      {/* Desktop Sidebar - Left vertical dock */}
      <div
        className={cn(
          "hidden md:flex fixed left-4 top-1/2 -translate-y-1/2 z-50",
          "flex-col items-center gap-1 p-3",
          "rounded-3xl backdrop-blur-xl",
          "bg-white/70 dark:bg-slate-900/70",
          "border border-white/50 dark:border-slate-700/50",
          "shadow-2xl shadow-black/10",
          "transition-all duration-300 ease-out",
          isExpanded ? "w-60" : "w-24"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Menu Items */}
        <div ref={containerRef} className="flex flex-col gap-2 w-full py-2">
          {menuItems.map((item: any) => {
            const active = isActive(item.url);
            return (
              <NavLink
                key={item.title}
                to={item.url}
                id={item.id}
                end={item.url === "/dashboard"}
                onClick={(e) => handleItemClick(e, item)}
                className={cn(
                  "group flex items-center gap-3 p-2 rounded-2xl transition-all duration-200",
                  active
                    ? "bg-white/90 dark:bg-slate-800/90 shadow-md"
                    : "hover:bg-white/60 dark:hover:bg-slate-800/60",
                  !isExpanded && "justify-center",
                  item.locked && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className={cn(
                  "relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-200",
                  `bg-gradient-to-br ${item.color}`,
                  active ? `shadow-lg ${item.shadow}` : "shadow-md",
                  "group-hover:scale-105 group-hover:shadow-lg"
                )}>
                  <item.icon className="w-6 h-6 text-white" />
                  {item.locked && (
                    <div className="absolute -top-1 -right-1 bg-white dark:bg-slate-800 rounded-full p-1 shadow">
                      <Lock className="w-3 h-3 text-slate-500" />
                    </div>
                  )}
                </div>
                {isExpanded && (
                  <span className={cn(
                    "text-xs font-bold uppercase tracking-wide truncate transition-colors",
                    active ? "text-slate-800 dark:text-white" : "text-slate-600 dark:text-slate-300"
                  )}>
                    {item.title}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>

        <div className="w-12 h-px bg-slate-200 dark:bg-slate-700 my-1" />

        <div className="flex flex-col gap-2 w-full">
          {bottomItems.map((item) => {
            const active = isActive(item.url);
            return (
              <NavLink
                key={item.title}
                to={item.url}
                id={item.id}
                className={cn(
                  "group flex items-center gap-3 p-2 rounded-2xl transition-all duration-200",
                  active
                    ? "bg-white/90 dark:bg-slate-800/90 shadow-md"
                    : "hover:bg-white/60 dark:hover:bg-slate-800/60",
                  !isExpanded && "justify-center"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-200",
                  `bg-gradient-to-br ${item.color}`,
                  active ? `shadow-lg ${item.shadow}` : "shadow-md",
                  "group-hover:scale-105"
                )}>
                  <item.icon className="w-6 h-6 text-white" />
                </div>
                {isExpanded && (
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 truncate">
                    {item.title}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className={cn(
            "mt-2 p-3 rounded-2xl w-full transition-all duration-200",
            "hover:bg-white/60 dark:hover:bg-slate-800/60",
            !collapsed && "bg-blue-50/80 dark:bg-blue-900/40"
          )}
          title={!collapsed ? "Contraer barra" : "Expandir barra"}
        >
          <ChevronsLeftRight className={cn(
            "w-5 h-5 text-slate-500 transition-transform duration-300",
            !collapsed && "text-blue-500 rotate-90"
          )} />
        </Button>
      </div>

      {/* Mobile Bottom Dock - Horizontal */}
      <div className="md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 p-2 rounded-2xl backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border border-white/50 dark:border-slate-700/50 shadow-2xl overflow-x-auto max-w-[95vw]">
        {allItems.slice(0, 7).map((item: any) => {
          const active = isActive(item.url);
          return (
            <NavLink
              key={item.id}
              to={item.url}
              id={`mobile-${item.id}`}
              end={item.url === "/dashboard"}
              onClick={(e) => handleItemClick(e, item)}
              className={cn(
                "flex-shrink-0 flex items-center justify-center p-1.5 rounded-xl transition-all duration-200",
                active ? "scale-110" : "hover:scale-105",
                item.locked && "opacity-50"
              )}
            >
              <div className={cn(
                "relative flex items-center justify-center w-11 h-11 rounded-xl",
                `bg-gradient-to-br ${item.color}`,
                active ? `shadow-lg ${item.shadow}` : "shadow-md"
              )}>
                <item.icon className="w-5 h-5 text-white" />
                {item.locked && (
                  <div className="absolute -top-1 -right-1 bg-white dark:bg-slate-800 rounded-full p-0.5 shadow">
                    <Lock className="w-2.5 h-2.5 text-slate-500" />
                  </div>
                )}
              </div>
            </NavLink>
          );
        })}
      </div>
    </>
  );
}