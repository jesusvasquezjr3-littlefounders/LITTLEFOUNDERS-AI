import { useState } from "react";
import { useTranslation } from 'react-i18next';
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  BarChart3,
  BookOpen,
  Users,
  UserCog,
  Headphones,
  History,
  HelpCircle,
  Menu,
  X,
  LogOut,
  Flag,
  Bell,
  Settings,
  LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { apiLogout } from "@/lib/apiClient";

interface AdminSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface MenuItem {
  titleKey: string;
  url: string;
  icon: LucideIcon;
  id: string;
}

interface MenuGroup {
  labelKey: string;
  items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
  {
    labelKey: "sidebar.groupOverview",
    items: [
      { titleKey: "sidebar.dashboard", url: "/admin", icon: LayoutDashboard, id: "nav-dashboard" },
      { titleKey: "sidebar.analytics", url: "/admin/analytics", icon: BarChart3, id: "nav-analytics" },
    ],
  },
  {
    labelKey: "sidebar.groupContent",
    items: [
      { titleKey: "sidebar.lessons", url: "/admin/lessons", icon: BookOpen, id: "nav-lessons" },
      { titleKey: "sidebar.characters", url: "/admin/characters", icon: Users, id: "nav-characters" },
      { titleKey: "sidebar.audio", url: "/admin/audio", icon: Headphones, id: "nav-audio" },
    ],
  },
  {
    labelKey: "sidebar.groupCommunity",
    items: [
      { titleKey: "sidebar.users", url: "/admin/users", icon: UserCog, id: "nav-users" },
      { titleKey: "sidebar.reports", url: "/admin/reports", icon: Flag, id: "nav-reports" },
      { titleKey: "sidebar.notifications", url: "/admin/notifications", icon: Bell, id: "nav-notifications" },
    ],
  },
  {
    labelKey: "sidebar.groupSystem",
    items: [
      { titleKey: "sidebar.history", url: "/admin/history", icon: History, id: "nav-history" },
      { titleKey: "sidebar.help", url: "/admin/help", icon: HelpCircle, id: "nav-help" },
      { titleKey: "sidebar.settings", url: "/admin/settings", icon: Settings, id: "nav-settings" },
    ],
  },
];

export function AdminSidebar({ collapsed, onToggle }: AdminSidebarProps) {
  const { t } = useTranslation('admin');
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const handleLogout = () => {
    apiLogout().catch(() => {});
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
        className="hidden md:flex fixed top-4 left-4 z-50 items-center justify-center w-10 h-10 rounded-lg bg-white dark:bg-[#0d1426] border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        aria-label={t('sidebar.toggleSidebar', 'Toggle sidebar')}
      >
        <Menu className="w-5 h-5 text-slate-600 dark:text-slate-400" />
      </button>

      <button
        onClick={() => setShowMobileMenu(!showMobileMenu)}
        className="md:hidden fixed top-4 left-4 z-40 flex items-center justify-center w-10 h-10 rounded-lg bg-white dark:bg-[#0d1426] border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        aria-label={t('sidebar.toggleMobileMenu', 'Toggle mobile menu')}
      >
        {showMobileMenu ? (
          <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        ) : (
          <Menu className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        )}
      </button>

      <aside
        className={cn(
          "fixed md:relative h-screen corp-panel border-r border-slate-200 dark:border-slate-800 flex flex-col transition-[width,transform] duration-300 z-30",
          collapsed ? "w-20 md:w-20" : "w-64 md:w-64",
          !showMobileMenu && "md:translate-x-0 -translate-x-full",
          "view-transition-sidebar"
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

        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-4">
          {menuGroups.map((group) => (
            <div key={group.labelKey} className="space-y-1">
              {!collapsed ? (
                <p className="corp-eyebrow px-3 pb-1">
                  {t(group.labelKey)}
                </p>
              ) : (
                <div className="mx-3 mb-1 h-px bg-slate-200 dark:bg-slate-800" />
              )}

              {group.items.map((item) => {
                const Icon = item.icon;
                const title = t(item.titleKey);
                return (
                  <NavLink
                    key={item.id}
                    to={item.url}
                    onClick={handleMobileNavigate}
                    title={collapsed ? title : undefined}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-[background-color,color] duration-200",
                        "corp-body-sm whitespace-nowrap",
                        isActive
                          ? "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-200"
                          : "hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200",
                        collapsed && "md:justify-center md:px-2"
                      )
                    }
                    end={item.url === '/admin'}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && <span>{title}</span>}
                  </NavLink>
                );
              })}
            </div>
          ))}
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
            title={collapsed ? t('sidebar.logout') : undefined}
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
