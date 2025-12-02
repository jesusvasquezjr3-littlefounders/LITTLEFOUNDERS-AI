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
    BarChart3
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface DemoSidebarProps {
    collapsed: boolean;
    onToggle: () => void;
}

export function DemoSidebar({ collapsed, onToggle }: DemoSidebarProps) {
    const location = useLocation();
    const currentPath = location.pathname;
    const navigate = useNavigate();

    const isActive = (path: string) => {
        if (path === "/demo") return currentPath === "/demo";
        return currentPath.startsWith(path);
    };

    const menuItems = [
        { title: "Inicio", url: "/demo", icon: Home, color: "text-primary", id: "demo-nav-home" },
        { title: "Mis Ahorros", url: "/demo/savings", icon: PiggyBank, color: "text-green-600", id: "demo-nav-savings" },
        { title: "Tiendita", url: "/demo/store", icon: Store, color: "text-product", id: "demo-nav-store" },
        { title: "Lecciones", url: "/demo/lecciones", icon: BookOpen, color: "text-purple-600", id: "demo-nav-lessons" },
        { title: "Mis Tareas", url: "/demo/tasks", icon: Trophy, color: "text-yellow-600", id: "demo-nav-tasks" },
        { title: "Emprendimiento", url: "/demo/investment-games", icon: Lightbulb, color: "text-orange-500", id: "demo-nav-games" },
        { title: "Banca Digital", url: "/demo/growth", icon: TrendingUp, color: "text-primary", id: "demo-nav-banking" },
    ];

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
                            <span className="font-bold text-white">LF</span>
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
                        id={item.id}
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

            {/* Demo Badge */}
            <div className="p-4 border-t border-border">
                <Button
                    variant="ghost"
                    className={cn(
                        "w-full bg-yellow-100 hover:bg-yellow-200 text-yellow-800 transition-all duration-200 group relative overflow-hidden",
                        collapsed ? "h-10 w-10 rounded-full p-0" : "px-3 py-2"
                    )}
                    onClick={() => window.dispatchEvent(new Event('restartDemoTour'))}
                    title="Reiniciar Tutorial"
                >
                    {!collapsed ? (
                        <div className="flex items-center justify-center gap-2">
                            <span className="text-sm font-bold">VER TUTORIAL</span>
                            <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity absolute right-2">
                                ↺
                            </span>
                        </div>
                    ) : (
                        <span className="text-xs font-bold">D</span>
                    )}
                </Button>
            </div>
        </div>
    );
}
