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
            <div ref={containerRef} className="flex-1 overflow-y-auto overflow-x-hidden relative py-4 custom-scrollbar scroll-smooth">
                {/* Menu Items */}
                <div className="space-y-2 px-3 relative z-10">
                    {menuItems.map((item, index) => {
                        const active = isActive(item.url);
                        return (
                            <NavLink
                                key={item.title}
                                to={item.url}
                                id={item.id}
                                end={item.url === "/demo"}
                                className={({ isActive }) => cn(
                                    "group flex items-center gap-3 p-3 rounded-xl transition-all duration-200",
                                    "border-2",
                                    isActive
                                        ? "bg-blue-50/50 border-blue-200 dark:bg-slate-800 dark:border-blue-900"
                                        : "border-transparent hover:bg-slate-100 dark:hover:bg-slate-800",
                                    !isExpanded && "justify-center px-2"
                                )}
                            >
                                {/* Icon Node */}
                                <div className={cn(
                                    "relative flex items-center justify-center transition-all duration-200",
                                    !isExpanded ? "w-10 h-10" : "w-10 h-10"
                                )}>
                                    <item.icon className={cn(
                                        "w-7 h-7 transition-transform duration-200",
                                        active ? item.color : "text-slate-400 group-hover:text-slate-600"
                                    )} />
                                </div>

                                {/* Label */}
                                {isExpanded && (
                                    <div className="flex-1 flex items-center justify-between">
                                        <span className={cn(
                                            "font-extrabold text-sm uppercase tracking-wide transition-colors",
                                            active ? "text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400 group-hover:text-slate-700"
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
