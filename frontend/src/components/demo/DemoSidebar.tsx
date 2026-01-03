import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
    Home,
    BookOpen,
    Lightbulb,
    ChevronLeft,
    PiggyBank,
    Store,
    Trophy,
    TrendingUp,
    BarChart3,
    PinIcon
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface DemoSidebarProps {
    collapsed: boolean;
    onToggle: () => void;
}

export function DemoSidebar({ collapsed, onToggle }: DemoSidebarProps) {
    const location = useLocation();
    const currentPath = location.pathname;
    const [isHovered, setIsHovered] = useState(false);
    // Persist pinned state if needed, or just link it to 'collapsed' prop 
    // Actually, 'collapsed' prop now acts as 'isPinned' (false = pinned open, true = unpinned/collapsed)
    // BUT user wants default collapsed. So 'collapsed' (true) is default.
    // Hover overrides collapsed.
    // Click pin toggles 'collapsed'.

    // Derived state for expansion
    const isExpanded = isHovered || !collapsed;

    const isActive = (path: string) => {
        if (path === "/demo") return currentPath === "/demo";
        return currentPath.startsWith(path);
    };

    const menuItems = [
        { title: "Inicio", url: "/demo", icon: Home, color: "text-primary", id: "demo-nav-home" },
        { title: "Lecciones", url: "/demo/lecciones", icon: BookOpen, color: "text-purple-600", id: "demo-nav-lessons" },
        { title: "Mis Tareas", url: "/demo/tasks", icon: Trophy, color: "text-yellow-600", id: "demo-nav-tasks" },
        { title: "Mis Ahorros", url: "/demo/savings", icon: PiggyBank, color: "text-green-600", id: "demo-nav-savings" },
        { title: "Emprendimiento", url: "/demo/investment-games", icon: Lightbulb, color: "text-orange-500", id: "demo-nav-games" },
        { title: "Banca Digital", url: "/demo/growth", icon: TrendingUp, color: "text-primary", id: "demo-nav-banking" },
        { title: "Tiendita", url: "/demo/store", icon: Store, color: "text-product", id: "demo-nav-store" },
    ];

    return (
        <div
            className={cn(
                "fixed left-0 top-0 h-screen z-50 flex flex-col transition-all duration-300 ease-in-out",
                "bg-gradient-to-b from-background to-background/95 dark:from-slate-900 dark:to-slate-950",
                "border-r-4 border-primary/10 dark:border-primary/20 shadow-xl",
                isExpanded ? "w-64" : "w-16 md:w-20"
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Encabezado */}
            <div className="flex items-center justify-between p-4 border-b-2 border-dashed border-primary/20 dark:border-primary/30 bg-gradient-to-r from-primary/5 to-transparent dark:from-primary/10 dark:to-transparent min-h-[70px]">
                {isExpanded ? (
                    <div className="flex items-center space-x-2 animate-in fade-in duration-300">
                        <img
                            src="/logo-sized.png"
                            alt="LittleFounders Logo"
                            className="h-10 w-auto object-contain"
                        />
                    </div>
                ) : (
                    <div className="mx-auto">
                        <img
                            src="/logo-sized.png"
                            alt="LF"
                            className="w-10 h-10 object-contain"
                        />
                    </div>
                )}

                {/* Pin Button - Only visible when expanded/hovered */}
                {isExpanded && (
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onToggle}
                            className={cn(
                                "h-8 w-8 rounded-full hover:bg-warning/20 hover:scale-110 transition-all duration-300",
                                !collapsed ? "text-warning bg-warning/10 scale-110" : "text-muted-foreground"
                            )}
                            title={collapsed ? "Fijar barra lateral" : "Desanclar barra lateral"}
                        >
                            {/* Pin Icon Logic */}
                            <PinIcon className={cn("h-4 w-4 transition-transform duration-300", !collapsed ? "-rotate-45 fill-current" : "rotate-0")} />
                        </Button>
                    </div>
                )}
            </div>

            {/* Navegación Principal */}
            <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto custom-scrollbar">
                {menuItems.map((item) => {
                    const active = isActive(item.url);
                    return (
                        <NavLink
                            key={item.title}
                            to={item.url}
                            id={item.id}
                            className={({ isActive: linkActive }) =>
                                cn(
                                    "flex items-center gap-4 px-3 py-3 rounded-2xl text-sm font-bold transition-all duration-300 group relative overflow-hidden",
                                    "hover:bg-white/80 dark:hover:bg-slate-800/80 hover:shadow-md hover:scale-105 hover:translate-x-2",
                                    (linkActive || active)
                                        ? "bg-white dark:bg-slate-800 shadow-lg scale-105 ring-2 ring-primary/20"
                                        : "text-muted-foreground hover:text-foreground"
                                )
                            }
                        >
                            <div className={cn(
                                "relative z-10 flex items-center justify-center transition-all duration-300 rounded-2xl shadow-button group-hover:shadow-button-hover",
                                isExpanded ? "w-14 h-14" : "w-full h-14",
                                active
                                    ? "bg-primary/10 ring-4 ring-white/50 dark:ring-primary/30 scale-110 translate-y-[2px] shadow-button-active"
                                    : "bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 group-hover:border-primary/30 dark:group-hover:border-primary/40 group-hover:scale-110"
                            )}>
                                <item.icon
                                    className={cn(
                                        "w-7 h-7 transition-all duration-300",
                                        active ? cn(item.color, "scale-110") : "text-slate-400 dark:text-slate-500 group-hover:text-primary group-hover:scale-125"
                                    )}
                                />
                            </div>

                            {isExpanded && (
                                <span className="animate-in fade-in slide-in-from-left-2 duration-300 whitespace-nowrap">
                                    {item.title}
                                </span>
                            )}

                            {/* Active Indicator Line */}
                            {active && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 h-10 w-1 bg-primary rounded-r-full shadow-lg" />
                            )}
                        </NavLink>
                    );
                })}
            </nav>

            {/* Demo Badge / Restart Tour */}
            <div className="p-4 border-t-2 border-dashed border-primary/20 dark:border-primary/30 bg-gradient-to-r from-primary/5 to-transparent dark:from-primary/10 dark:to-transparent">
                <Button
                    variant="ghost"
                    className={cn(
                        "w-full transition-all duration-300 group relative overflow-hidden shadow-button hover:shadow-button-hover active:shadow-button-active active:translate-y-1 hover:scale-105",
                        isExpanded
                            ? "bg-gradient-to-r from-warning to-team hover:from-warning/90 hover:to-team/90 text-white font-black px-4 py-6 rounded-2xl"
                            : "h-14 w-14 rounded-2xl p-0 bg-warning/20 text-warning hover:bg-warning/30"
                    )}
                    onClick={() => window.dispatchEvent(new Event('restartDemoTour'))}
                    title="Reiniciar Tutorial"
                >
                    {isExpanded ? (
                        <div className="flex items-center justify-between w-full">
                            <div className="flex flex-col items-start gap-1">
                                <span className="text-xs font-bold uppercase tracking-widest">Tutorial</span>
                                <span className="text-sm font-bold">Reiniciar</span>
                            </div>
                            <span className="text-xl p-2 rounded-xl group-hover:rotate-180 transition-transform duration-500">↺</span>
                        </div>
                    ) : (
                        <span className="text-lg font-bold">↺</span>
                    )}
                </Button>
            </div>
        </div>
    );
}
