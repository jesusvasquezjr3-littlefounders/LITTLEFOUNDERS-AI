import { useRef, useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
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
  Map as MapIcon,
  Menu,
  PinIcon,
  ChevronLeft,
  Lock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

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
      { title: "Lecciones", url: "/lecciones", icon: BookOpen, color: "text-indigo-600", bg: "bg-indigo-100", id: "nav-lessons" },
      { title: "Mis Tareas", url: "/tasks", icon: Trophy, color: "text-yellow-600", bg: "bg-yellow-100", id: "nav-tasks" },
      { title: "Mis Ahorros", url: "/savings", icon: PiggyBank, color: "text-green-600", bg: "bg-green-100", id: "nav-savings" },
      { title: "Emprendimiento", url: "/investment-games", icon: Lightbulb, color: "text-orange-500", bg: "bg-orange-100", id: "nav-games" },
      { title: "Banca Digital", url: "/growth", icon: TrendingUp, color: "text-red-500", bg: "bg-red-100", id: "nav-banking" },
      { title: "Tiendita", url: "/store", icon: Store, color: "text-purple-600", bg: "bg-purple-100", id: "nav-store" },
    ];
  } else if (user.user_type === 'universal') {
    // Menú para usuarios universales (acceso limitado)
    return [
      { title: "Inicio", url: "/dashboard", icon: Home, color: "text-blue-500", bg: "bg-blue-100", id: "nav-home" },
      { title: "Lecciones", url: "/lecciones", icon: BookOpen, color: "text-indigo-600", bg: "bg-indigo-100", id: "nav-lessons" },
      { title: "Emprendimiento", url: "/investment-games", icon: Lightbulb, color: "text-orange-500", bg: "bg-orange-100", id: "nav-games" },
      // Bloqueados
      { title: "Mis Tareas", url: "#", icon: Trophy, color: "text-slate-400", bg: "bg-slate-100", id: "nav-tasks", locked: true },
      { title: "Mis Ahorros", url: "#", icon: PiggyBank, color: "text-slate-400", bg: "bg-slate-100", id: "nav-savings", locked: true },
      { title: "Banca Digital", url: "#", icon: TrendingUp, color: "text-slate-400", bg: "bg-slate-100", id: "nav-banking", locked: true },
      { title: "Tiendita", url: "#", icon: Store, color: "text-slate-400", bg: "bg-slate-100", id: "nav-store", locked: true },
    ];
  } else {
    // Menú para padres (More sober but consistent structure)
    return [
      { title: "Inicio", url: "/dashboard", icon: Home, color: "text-primary", bg: "bg-primary/10", id: "nav-home" },
      { title: "Lecciones", url: "/lecciones", icon: BookOpen, color: "text-indigo-600", bg: "bg-indigo-100", id: "nav-lessons" },
      { title: "Gestión de Tareas", url: "/parent-tasks", icon: ClipboardList, color: "text-yellow-600", bg: "bg-yellow-100", id: "nav-tasks" },
      { title: "Mis Ahorros", url: "/savings", icon: PiggyBank, color: "text-green-600", bg: "bg-green-100", id: "nav-savings" },
      { title: "Emprendimiento", url: "/investment-games", icon: Lightbulb, color: "text-orange-500", bg: "bg-orange-100", id: "nav-games" },
      { title: "Banca Digital", url: "/growth", icon: TrendingUp, color: "text-red-500", bg: "bg-red-100", id: "nav-banking" },
      { title: "Tiendita", url: "/store", icon: Store, color: "text-purple-600", bg: "bg-purple-100", id: "nav-store" },
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
  const [isHovered, setIsHovered] = useState(false);
  const { toast } = useToast();

  // Derived state for expansion: Expanded if hovered OR if NOT collapsed (pinned)
  const isExpanded = isHovered || !collapsed;

  const isActive = (path: string) => {
    if (path === "#") return false;
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

  const handleItemClick = (e: React.MouseEvent, item: any) => {
    if (item.locked) {
      e.preventDefault();
      toast({
        title: "Función en Desarrollo",
        description: "Esta funcionalidad estará disponible próximamente o requiere completar tu perfil.",
        variant: "default",
      });
    }
  };

  return (
    <div
      className={cn(
        "fixed left-0 top-0 h-screen transition-all duration-300 ease-in-out z-50 flex flex-col",
        isExpanded ? "w-72" : "w-16 md:w-24", // Adjusted for mobile
        "bg-background dark:bg-slate-900 border-r-4 border-border dark:border-slate-800", // Theme-aware background
        "shadow-[4px_0_24px_rgba(0,0,0,0.05)]"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header / Map Title */}
      <div className="p-6 border-b-2 border-dashed border-border dark:border-slate-800 flex items-center justify-between bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm min-h-[88px]">
        {isExpanded && (
          <div className="flex items-center gap-2 animate-in fade-in duration-300 px-2">
            <img
              src="/logo-sized.png"
              alt="LittleFounders Logo"
              className="h-10 w-auto object-contain"
            />
          </div>
        )}

        {/* Pin Button: Only visible when expanded. Controls 'collapsed' prop (Pin state) */}
        {isExpanded ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className={cn(
              "hover:bg-orange-100 mx-auto transition-colors",
              !collapsed ? "text-orange-600 bg-orange-50" : "text-slate-400"
            )}
            title={!collapsed ? "Desanclar barra" : "Fijar barra"}
          >
            <PinIcon className={cn("w-5 h-5 transition-transform", !collapsed ? "-rotate-45 fill-current" : "rotate-0")} />
          </Button>
        ) : (
          // Collapsed state icon (centering handled by flex parent)
          <div className="mx-auto">
            <img
              src="/logo-sized.png"
              alt="LF"
              className="w-10 h-10 object-contain"
            />
          </div>
        )}
      </div>

      {/* Path Container */}
      <div ref={containerRef} className="flex-1 overflow-y-auto overflow-x-hidden relative py-4 custom-scrollbar scroll-smooth">

        {/* Menu Items */}
        <div className="space-y-2 px-3 relative z-10">
          {menuItems.map((item: any) => {
            const active = isActive(item.url);
            return (
              <NavLink
                key={item.title}
                to={item.url}
                id={item.id}
                end={item.url === "/dashboard"}
                onClick={(e) => handleItemClick(e, item)}
                className={({ isActive }) => cn(
                  "group flex items-center gap-3 p-2 rounded-xl transition-all duration-200",
                  "border-2",
                  active
                    ? "bg-blue-50/50 border-blue-200 dark:bg-slate-800 dark:border-blue-900"
                    : "border-transparent hover:bg-slate-100 dark:hover:bg-slate-800",
                  !isExpanded && "justify-center px-2",
                  item.locked && "opacity-70 cursor-not-allowed hover:bg-transparent"
                )}
              >
                {/* Icon Node - Duolingo Style Volumetric */}
                <div className={cn(
                  "relative flex items-center justify-center transition-all duration-200 rounded-xl",
                  !isExpanded ? "w-10 h-10" : "w-10 h-10",
                  // Volumetric background with gradients based on item color
                  active && item.color === "text-blue-500" && "bg-gradient-to-br from-blue-400 to-blue-600 shadow-[0_4px_0_#1e40af] active:shadow-[0_2px_0_#1e40af] active:translate-y-[2px]",
                  active && item.color === "text-indigo-600" && "bg-gradient-to-br from-indigo-400 to-indigo-600 shadow-[0_4px_0_#4338ca] active:shadow-[0_2px_0_#4338ca] active:translate-y-[2px]",
                  active && item.color === "text-yellow-600" && "bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-[0_4px_0_#ca8a04] active:shadow-[0_2px_0_#ca8a04] active:translate-y-[2px]",
                  active && item.color === "text-green-600" && "bg-gradient-to-br from-green-400 to-green-600 shadow-[0_4px_0_#16a34a] active:shadow-[0_2px_0_#16a34a] active:translate-y-[2px]",
                  active && item.color === "text-orange-500" && "bg-gradient-to-br from-orange-400 to-orange-600 shadow-[0_4px_0_#ea580c] active:shadow-[0_2px_0_#ea580c] active:translate-y-[2px]",
                  active && item.color === "text-red-500" && "bg-gradient-to-br from-red-400 to-red-600 shadow-[0_4px_0_#dc2626] active:shadow-[0_2px_0_#dc2626] active:translate-y-[2px]",
                  active && item.color === "text-purple-600" && "bg-gradient-to-br from-purple-400 to-purple-600 shadow-[0_4px_0_#9333ea] active:shadow-[0_2px_0_#9333ea] active:translate-y-[2px]",
                  active && item.color === "text-primary" && "bg-gradient-to-br from-blue-400 to-blue-600 shadow-[0_4px_0_#1e40af] active:shadow-[0_2px_0_#1e40af] active:translate-y-[2px]",
                  // Inactive state - subtle gray with hover effect
                  !active && "bg-gradient-to-br from-slate-200 to-slate-300 shadow-[0_3px_0_#94a3b8] group-hover:from-slate-300 group-hover:to-slate-400 group-hover:shadow-[0_4px_0_#64748b]",
                  // Locked state
                  item.locked && "opacity-60"
                )}>
                  <item.icon className={cn(
                    "w-5 h-5 transition-transform duration-200",
                    active ? "text-white scale-110" : "text-slate-600 group-hover:text-slate-700 group-hover:scale-105"
                  )} />
                  {/* Lock overlay if locked */}
                  {item.locked && (
                    <div className="absolute -top-1 -right-1 bg-white rounded-full p-1 shadow-md border-2 border-slate-300">
                      <Lock className="w-3 h-3 text-slate-600" />
                    </div>
                  )}
                </div>

                {/* Label */}
                {isExpanded && (
                  <div className="flex-1 flex items-center justify-between">
                    <span className={cn(
                      "font-extrabold text-xs uppercase tracking-wide transition-colors",
                      active ? "text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400 group-hover:text-slate-700"
                    )}>
                      {item.title}
                    </span>
                    {item.locked && (
                      <Lock className="w-3 h-3 text-slate-400" />
                    )}
                  </div>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Divider */}
        <div className="my-6 border-t-2 border-dashed border-border dark:border-slate-800 mx-4" />

        {/* Bottom Items (Settings, Help) - Styled consistent with Gamified items */}
        <div className="space-y-2 px-3 relative z-10">
          {bottomItems.map((item) => {
            const active = isActive(item.url);
            return (
              <NavLink
                key={item.title}
                to={item.url}
                id={item.id}
                className={({ isActive }) => cn(
                  "group flex items-center gap-3 p-2 rounded-xl transition-all duration-200",
                  "border-2",
                  isActive
                    ? "bg-blue-50/50 border-blue-200 dark:bg-slate-800 dark:border-blue-900"
                    : "border-transparent hover:bg-slate-100 dark:hover:bg-slate-800",
                  !isExpanded && "justify-center px-2"
                )}
              >
                <div className={cn(
                  "relative flex items-center justify-center transition-all duration-200 rounded-xl",
                  !isExpanded ? "w-10 h-10" : "w-10 h-10",
                  active
                    ? "bg-gradient-to-br from-slate-300 to-slate-400 shadow-[0_4px_0_#64748b]"
                    : "bg-gradient-to-br from-slate-200 to-slate-300 shadow-[0_3px_0_#94a3b8] group-hover:from-slate-300 group-hover:to-slate-400"
                )}>
                  <item.icon className={cn(
                    "w-5 h-5 transition-transform duration-200",
                    active ? "text-slate-700 scale-110" : "text-slate-600 group-hover:text-slate-700 group-hover:scale-105"
                  )} />
                </div>
                {isExpanded && (
                  <div className="flex-1 flex items-center justify-between">
                    <span className={cn(
                      "font-extrabold text-xs uppercase tracking-wide transition-colors",
                      active ? "text-slate-700 dark:text-slate-300" : "text-slate-500 dark:text-slate-400 group-hover:text-slate-700"
                    )}>
                      {item.title}
                    </span>
                  </div>
                )}
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Footer / Restart Tour - Only for Universal User */}
      {getUser().user_type === 'universal' && (
        <div className="p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-t-2 border-dashed border-border dark:border-slate-800">
          <Button
            variant="ghost"
            className={cn(
              "w-full bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white shadow-[0_4px_0_#b45309] active:shadow-[0_2px_0_#b45309] active:translate-y-[2px] transition-all rounded-xl",
              !isExpanded ? "h-10 w-10 p-0 rounded-xl" : "py-3"
            )}
            onClick={() => window.dispatchEvent(new Event('restartUserTour'))}
            title="Ver Tutorial"
          >
            {isExpanded ? (
              <div className="flex items-center gap-2 font-black tracking-wide">
                <span>VER TUTORIAL</span>
                <span className="text-lg">↺</span>
              </div>
            ) : (
              <span className="font-black text-lg">↺</span>
            )}
          </Button>
        </div>
      )}

    </div >
  );
}