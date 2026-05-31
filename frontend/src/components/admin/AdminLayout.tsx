import { useState, useEffect, ReactNode } from "react";
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from "react-router-dom";
import { AdminSidebar } from "./AdminSidebar";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { cn } from "@/lib/utils";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notificationsAdminApi } from "@/lib/api/notifications";

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { t } = useTranslation('admin');
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const isMobile = window.innerWidth < 768;
      if (isMobile) return true;
    }
    const stored = localStorage.getItem('admin_sidebar_collapsed');
    return stored ? JSON.parse(stored) : false;
  });
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    notificationsAdminApi.list({ status: 'active' })
      .then(items => setNotifCount(items.length))
      .catch(() => {});
  }, [location.pathname]);

  const handleToggleSidebar = () => {
    const newState = !sidebarCollapsed;
    setSidebarCollapsed(newState);
    localStorage.setItem('admin_sidebar_collapsed', JSON.stringify(newState));
  };

  const getAdminName = () => {
    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) return 'Admin';
      const user = JSON.parse(userStr);
      return user.name || 'Admin';
    } catch {
      return 'Admin';
    }
  };

  const isOnNotificationsPage = location.pathname === '/admin/notifications';

  return (
    <div className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <div className="flex h-full">
        <AdminSidebar
          collapsed={sidebarCollapsed}
          onToggle={handleToggleSidebar}
        />

        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm view-transition-header">
            <div className="px-6 py-4 flex items-center justify-between">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {t('layout.panelTitle')}
              </h1>
              <div className="flex items-center gap-4">
                <ThemeToggle />

                {/* Notifications management button */}
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className={cn(
                    "relative",
                    isOnNotificationsPage && "bg-slate-100 dark:bg-slate-800"
                  )}
                >
                  <Link to="/admin/notifications">
                    <Bell className="h-5 w-5" />
                    {notifCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-4 min-w-4 rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                        {notifCount > 99 ? '99+' : notifCount}
                      </span>
                    )}
                  </Link>
                </Button>

                <div className="text-right">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {getAdminName()}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t('layout.role')}
                  </p>
                </div>
              </div>
            </div>
          </header>

          <main
            className={cn(
              "flex-1 overflow-y-auto transition-all duration-300 p-6",
              !sidebarCollapsed ? "md:ml-0" : "md:ml-0",
              "view-transition-content"
            )}
            aria-label={t('layout.mainContent')}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
