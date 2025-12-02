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
        { title: "Inicio", url: "/demo", icon: Home, color: "text-primary" },
        { title: "Mis Ahorros", url: "/demo/savings", icon: PiggyBank, color: "text-green-600" },
        { title: "Tiendita", url: "/demo/store", icon: Store, color: "text-product" },
        { title: "Lecciones", url: "/demo/lecciones", icon: BookOpen, color: "text-purple-600" },
        { title: "Mis Tareas", url: "/demo/tasks", icon: Trophy, color: "text-yellow-600" },
        { title: "Emprendimiento", url: "/demo/investment-games", icon: Lightbulb, color: "text-orange-500" },
        { title: "Banca Digital", url: "/demo/growth", icon: TrendingUp, color: "text-primary" },
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
                {!collapsed ? (
                    <div className="bg-yellow-100 text-yellow-800 px-3 py-2 rounded-md text-center text-sm font-bold">
                        MODO DEMO
                    </div>
                ) : (
                    <div className="bg-yellow-100 text-yellow-800 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mx-auto">
                        D
                    </div>
                )}
            </div>
        </div>
    );
}
