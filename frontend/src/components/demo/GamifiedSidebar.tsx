import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
    Home,
    BookOpen,
    Lightbulb,
    PiggyBank,
    Store,
    Trophy,
    TrendingUp,
    Map as MapIcon,
    ChevronLeft,
    Menu,
    PinIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef } from "react";

interface GamifiedSidebarProps {
    collapsed: boolean;
    onToggle: () => void;
    className?: string;
}

export function GamifiedSidebar({ collapsed, onToggle, className }: GamifiedSidebarProps) {
    const location = useLocation();
    const currentPath = location.pathname;
    const [isHovered, setIsHovered] = useState(false);

    // Derived state for expansion: Expanded if hovered OR if NOT collapsed (pinned)
    const isExpanded = isHovered || !collapsed;

    const isActive = (path: string) => {
        if (path === "/demo") return currentPath === "/demo";
        return currentPath.startsWith(path);
    };

    const menuItems = [
        { title: "Inicio", url: "/demo", icon: Home, color: "text-blue-500", bg: "bg-blue-100", id: "demo-nav-home" },
        { title: "Lecciones", url: "/demo/lecciones", icon: BookOpen, color: "text-indigo-600", bg: "bg-indigo-100", id: "demo-nav-lessons" },
        { title: "Mis Tareas", url: "/demo/tasks", icon: Trophy, color: "text-yellow-600", bg: "bg-yellow-100", id: "demo-nav-tasks" },
        { title: "Mis Ahorros", url: "/demo/savings", icon: PiggyBank, color: "text-green-600", bg: "bg-green-100", id: "demo-nav-savings" },
        { title: "Emprendimiento", url: "/demo/investment-games", icon: Lightbulb, color: "text-orange-500", bg: "bg-orange-100", id: "demo-nav-games" },
        { title: "Banca Digital", url: "/demo/growth", icon: TrendingUp, color: "text-red-500", bg: "bg-red-100", id: "demo-nav-banking" },
        { title: "Tiendita", url: "/demo/store", icon: Store, color: "text-purple-600", bg: "bg-purple-100", id: "demo-nav-store" },
    ];

    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const activeItem = menuItems.find(item => isActive(item.url));
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
                "fixed left-0 top-0 h-screen transition-all duration-300 ease-in-out z-50 flex flex-col",
                isExpanded ? "w-72" : "w-20 md:w-24", // Increased thickness
                "bg-background dark:bg-slate-900 border-r-4 border-border dark:border-slate-800", // Theme-aware background
                "shadow-[4px_0_24px_rgba(0,0,0,0.05)]",
                className
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
            <div ref={containerRef} className="flex-1 overflow-y-auto overflow-x-hidden relative py-8 custom-scrollbar scroll-smooth">
                {/* Winding Path SVG Line (Only visible when expanded) */}
                {isExpanded && (
                    <svg className="absolute top-0 left-[2.25rem] w-12 h-full pointer-events-none z-0" style={{ height: `${menuItems.length * 80 + 100}px` }}>
                        <path
                            d={`M 24 20 ${menuItems.map((_, i) => `L 24 ${i * 80 + 60}`).join(' ')}`}
                            fill="none"
                            stroke="#e5e0d8"
                            strokeWidth="4"
                            strokeDasharray="8 8"
                            strokeLinecap="round"
                        />
                    </svg>
                )}

                {/* Menu Items */}
                <div className="space-y-4 px-4 relative z-10">
                    {menuItems.map((item, index) => {
                        const active = isActive(item.url);
                        return (
                            <NavLink
                                key={item.title}
                                to={item.url}
                                id={item.id}
                                className={({ isActive }) => cn(
                                    "group flex items-center gap-2 p-3 rounded-2xl transition-all duration-300",
                                    "hover:translate-x-2",
                                    isActive ? "bg-white dark:bg-slate-800 shadow-[0_8px_16px_rgba(0,0,0,0.08)] scale-105" : "hover:bg-white/60 dark:hover:bg-slate-800/60",
                                    !isExpanded && "justify-center px-1" // Center content when collapsed
                                )}
                            >
                                {/* Icon Node */}
                                <div className={cn(
                                    "relative rounded-2xl flex items-center justify-center transition-all duration-300",
                                    "shadow-[0_4px_0_rgba(0,0,0,0.1)]", // 3D bottom shadow
                                    !isExpanded ? "w-14 h-12" : "w-12 h-12", // Wider icons when collapsed
                                    active
                                        ? cn(item.bg, "translate-y-[2px] shadow-[0_2px_0_rgba(0,0,0,0.1)] ring-4 ring-white dark:ring-slate-700")
                                        : "bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 group-hover:border-orange-200 dark:group-hover:border-orange-900"
                                )}>
                                    <item.icon className={cn(
                                        "w-6 h-6 transition-transform duration-300",
                                        active ? item.color : "text-slate-400 group-hover:text-orange-400 group-hover:scale-110"
                                    )} />

                                    {/* Connector Dot (only when expanded) */}
                                    {isExpanded && (
                                        <div className={cn(
                                            "absolute -left-[22px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white",
                                            active ? "bg-orange-500 scale-125" : "bg-slate-200"
                                        )} />
                                    )}
                                </div>

                                {/* Label */}
                                {isExpanded && (
                                    <div className="flex-1">
                                        <span className={cn(
                                            "font-bold text-base block transition-colors",
                                            active ? "text-slate-800 dark:text-slate-100" : "text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300"
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
            </div>

            {/* Footer / Restart Tour */}
            <div className="p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-t-2 border-dashed border-border dark:border-slate-800">
                <Button
                    variant="ghost"
                    className={cn(
                        "w-full bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white shadow-[0_4px_0_#b45309] active:shadow-[0_2px_0_#b45309] active:translate-y-[2px] transition-all rounded-xl",
                        !isExpanded ? "h-12 w-12 p-0 rounded-2xl" : "py-6"
                    )}
                    onClick={() => window.dispatchEvent(new Event('restartDemoTour'))}
                    title="Reiniciar Tutorial"
                >
                    {isExpanded ? (
                        <div className="flex items-center gap-2 font-black tracking-wide">
                            <span>REINICIAR TUTORIAL</span>
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
