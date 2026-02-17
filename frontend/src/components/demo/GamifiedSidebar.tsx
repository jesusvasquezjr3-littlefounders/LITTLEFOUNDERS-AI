import { NavLink, useLocation } from "react-router-dom";
import {
    Home,
    BookOpen,
    Lightbulb,
    PiggyBank,
    Store,
    Trophy,
    TrendingUp,
    ChevronsLeftRight,
    Lock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { useSound } from "@/contexts/SoundContext";

interface GamifiedSidebarProps {
    collapsed: boolean;
    onToggle: () => void;
    className?: string;
}

export function GamifiedSidebar({ collapsed, onToggle, className }: GamifiedSidebarProps) {
    const location = useLocation();
    const currentPath = location.pathname;
    const [isHovered, setIsHovered] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();
    const { playSound } = useSound();
    const { t } = useTranslation('demo');

    const isExpanded = isHovered || !collapsed;

    const isActive = (path: string) => {
        if (path === "#") return false;
        if (path === "/demo") return currentPath === "/demo";
        return currentPath.startsWith(path);
    };

    const handleItemClick = (e: React.MouseEvent, item: any) => {
        playSound('nav_slide');
        if (item.locked) {
            e.preventDefault();
            toast({
                title: t('sidebar.locked_title'),
                description: t('sidebar.locked_desc'),
                variant: "default",
            });
        }
    };

    const menuItems = [
        { title: t('sidebar.home'), url: "/demo", icon: Home, color: "from-blue-400 to-blue-600", shadow: "shadow-blue-500/40", id: "demo-nav-home" },
        { title: t('sidebar.lessons'), url: "/demo/lecciones", icon: BookOpen, color: "from-indigo-400 to-indigo-600", shadow: "shadow-indigo-500/40", id: "demo-nav-lessons" },
        { title: t('sidebar.entrepreneurship'), url: "/demo/investment-games", icon: Lightbulb, color: "from-orange-400 to-red-500", shadow: "shadow-orange-500/40", id: "demo-nav-games" },
        // Locked Items
        { title: t('sidebar.tasks'), url: "#", icon: Trophy, color: "from-slate-300 to-slate-400", shadow: "", id: "demo-nav-tasks", locked: true },
        { title: t('sidebar.savings'), url: "#", icon: PiggyBank, color: "from-slate-300 to-slate-400", shadow: "", id: "demo-nav-savings", locked: true },
        { title: t('sidebar.banking'), url: "#", icon: TrendingUp, color: "from-slate-300 to-slate-400", shadow: "", id: "demo-nav-banking", locked: true },
        { title: t('sidebar.store'), url: "#", icon: Store, color: "from-slate-300 to-slate-400", shadow: "", id: "demo-nav-store", locked: true },
    ];

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
                    isExpanded ? "w-60" : "w-24",
                    className
                )}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <div ref={containerRef} className="flex flex-col gap-2 w-full py-2">
                    {menuItems.map((item) => {
                        const active = isActive(item.url);
                        return (
                            <NavLink
                                key={item.title}
                                to={item.url}
                                id={item.id}
                                end={item.url === "/demo"}
                                onClick={(e) => handleItemClick(e, item)}
                                className={cn(
                                    "group flex items-center gap-3 p-2 rounded-2xl transition-all duration-200",
                                    active
                                        ? "bg-white/90 dark:bg-slate-800/90 shadow-md"
                                        : "hover:bg-white/60 dark:hover:bg-slate-800/60",
                                    !isExpanded && "justify-center",
                                    item.locked && "opacity-60 cursor-not-allowed hover:bg-transparent"
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
                {menuItems.map((item) => {
                    const active = isActive(item.url);
                    return (
                        <NavLink
                            key={item.id}
                            to={item.url}
                            id={`mobile-${item.id}`}
                            end={item.url === "/demo"}
                            onClick={(e) => handleItemClick(e, item)}
                            className={cn(
                                "flex-shrink-0 flex items-center justify-center p-1.5 rounded-xl transition-all duration-200",
                                active ? "scale-110" : "hover:scale-105",
                                item.locked && "opacity-60 cursor-not-allowed"
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
