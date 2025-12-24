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
                "fixed left-0 top-0 h-screen z-50 bg-white border-r border-indigo-100 shadow-2xl transition-all duration-300 ease-in-out flex flex-col",
                isExpanded ? "w-64" : "w-16 md:w-20"
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Encabezado */}
            <div className="flex items-center justify-between p-4 border-b border-indigo-50 min-h-[70px]">
                {isExpanded ? (
                    <div className="flex items-center space-x-2 animate-in fade-in duration-300">
                        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                            <span className="font-bold text-white text-xs">LF</span>
                        </div>
                        <span className="font-extrabold text-lg text-slate-800 tracking-tight">LittleFounders</span>
                    </div>
                ) : (
                    <div className="w-8 h-8 mx-auto bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
                        <span className="font-bold text-white text-xs">LF</span>
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
                                "h-8 w-8 rounded-full hover:bg-slate-100 transition-colors",
                                !collapsed ? "text-indigo-600 bg-indigo-50" : "text-slate-400"
                            )}
                            title={collapsed ? "Fijar barra lateral" : "Desanclar barra lateral"}
                        >
                            {/* Pin Icon Logic */}
                            <PinIcon className={cn("h-4 w-4 transition-transform", !collapsed ? "-rotate-45 fill-current" : "rotate-0")} />
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
                                    "flex items-center gap-4 px-3 py-3 rounded-2xl text-sm font-medium transition-all duration-200 group relative overflow-hidden",
                                    "hover:bg-slate-50 hover:shadow-sm",
                                    (linkActive || active)
                                        ? "bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200"
                                        : "text-slate-500 hover:text-slate-900"
                                )
                            }
                        >
                            <div className={cn(
                                "relative z-10 flex items-center justify-center transition-all duration-300",
                                isExpanded ? "" : "w-full"
                            )}>
                                <item.icon
                                    className={cn(
                                        "w-6 h-6 transition-all duration-300",
                                        active ? "fill-indigo-200 text-indigo-600 scale-110" : "text-slate-400 group-hover:text-indigo-500 group-hover:scale-110"
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
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 bg-indigo-500 rounded-r-full" />
                            )}
                        </NavLink>
                    );
                })}
            </nav>

            {/* Demo Badge / Restart Tour */}
            <div className="p-4 border-t border-indigo-50 bg-slate-50/50">
                <Button
                    variant="ghost"
                    className={cn(
                        "w-full transition-all duration-200 group relative overflow-hidden ring-1 ring-slate-200",
                        isExpanded
                            ? "bg-white hover:bg-yellow-50 hover:ring-yellow-300 text-slate-600 px-4 py-6 rounded-2xl shadow-sm"
                            : "h-10 w-10 rounded-full p-0 bg-yellow-100 text-yellow-700 hover:scale-110"
                    )}
                    onClick={() => window.dispatchEvent(new Event('restartDemoTour'))}
                    title="Reiniciar Tutorial"
                >
                    {isExpanded ? (
                        <div className="flex items-center justify-between w-full">
                            <div className="flex flex-col items-start gap-1">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Tutorial</span>
                                <span className="text-sm font-bold text-slate-800 group-hover:text-yellow-700">Reiniciar</span>
                            </div>
                            <span className="text-xl bg-yellow-100 p-2 rounded-xl group-hover:rotate-180 transition-transform duration-500">↺</span>
                        </div>
                    ) : (
                        <span className="text-lg font-bold">D</span>
                    )}
                </Button>
            </div>
        </div>
    );
}
