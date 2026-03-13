import { useState } from "react";
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  Users,
  Headphones,
  History,
  Zap,
  HelpCircle,
  Menu,
  X,
  LogOut,
  Flag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface AdminSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const adminMenuItems = [
  {
    title: "Dashboard",
    url: "/admin",
    icon: LayoutDashboard,
    id: "nav-dashboard",
  },
  {
    title: "Lecciones",
    url: "/admin/lessons",
    icon: BookOpen,
    id: "nav-lessons",
  },
  {
    title: "Personajes",
    url: "/admin/characters",
    icon: Users,
    id: "nav-characters",
  },
  {
    title: "Audio",
    url: "/admin/audio",
    icon: Headphones,
    id: "nav-audio",
  },
  {
    title: "Historial",
    url: "/admin/history",
    icon: History,
    id: "nav-history",
  },
  {
    title: "Usuarios",
    url: "/admin/users",
    icon: Zap,
    id: "nav-users",
  },
  {
    title: "Preguntas",
    url: "/admin/help",
    icon: HelpCircle,
    id: "nav-help",
  },
  {
    title: "Reportes",
    url: "/admin/reports",
    icon: Flag,
    id: "nav-reports",
  },
];

export function AdminSidebar({ collapsed, onToggle }: AdminSidebarProps) {
  const { t } = useTranslation('admin');
  const location = useLocation();
  const currentPath = location.pathname;
  const { toast } = useToast();
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const menuItems = [
    { ...adminMenuItems[0], title: t('sidebar.dashboard') },
    { ...adminMenuItems[1], title: t('sidebar.lessons') },
    { ...adminMenuItems[2], title: t('sidebar.characters') },
    { ...adminMenuItems[3], title: t('sidebar.audio') },
    { ...adminMenuItems[4], title: t('sidebar.history') },
    { ...adminMenuItems[5], title: t('sidebar.users') },
    { ...adminMenuItems[6], title: t('sidebar.help') },
    { ...adminMenuItems[7], title: 'Reportes' },
  ];

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  const handleMobileNavigate = () => {
    setShowMobileMenu(false);
  };

  return (
    <>
      <button
        onClick={onToggle}
        className="hidden md:flex fixed top-4 left-4 z-50 items-center justify-center w-10 h-10 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        aria-label="Toggle sidebar"
      >
        <Menu className="w-5 h-5 text-slate-600 dark:text-slate-400" />
      </button>

      <button
        onClick={() => setShowMobileMenu(!showMobileMenu)}
        className="md:hidden fixed top-4 left-4 z-40 flex items-center justify-center w-10 h-10 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        aria-label="Toggle mobile menu"
      >
        {showMobileMenu ? (
          <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        ) : (
          <Menu className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        )}
      </button>

      <aside
        className={cn(
          "fixed md:relative h-screen bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-300 z-30",
          collapsed ? "w-20 md:w-20" : "w-64 md:w-64",
          !showMobileMenu && "md:translate-x-0 -translate-x-full"
        )}
      >
        <div className={cn(
          "flex items-center justify-center p-4 h-16 border-b border-slate-200 dark:border-slate-800",
          collapsed && "md:justify-center"
        )}>
          {!collapsed ? (
            <img src="/logo-main.png" alt="LittleFounders" className="h-8 w-auto" />
          ) : (
            <img src="/logo-sized.png" alt="LF" className="h-8 w-8 object-contain" />
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.url;

            return (
              <NavLink
                key={item.id}
                to={item.url}
                onClick={handleMobileNavigate}
                className={({ isActive: routeIsActive }) =>
                  cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                    "text-sm font-medium whitespace-nowrap",
                    routeIsActive
                      ? "bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200",
                    collapsed && "md:justify-center md:px-2"
                  )
                }
                end={item.url === '/admin'}
              >
                <Icon className={cn("w-5 h-5 flex-shrink-0")} />
                {!collapsed && <span>{item.title}</span>}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 dark:border-slate-800 p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className={cn(
              "w-full justify-start gap-3 text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors",
              collapsed && "md:justify-center md:px-2"
            )}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>{t('sidebar.logout')}</span>}
          </Button>
        </div>
      </aside>

      {showMobileMenu && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setShowMobileMenu(false)}
        />
      )}
    </>
  );
}
