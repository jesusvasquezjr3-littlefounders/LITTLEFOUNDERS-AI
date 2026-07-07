import { useState, ReactNode } from "react";
import { useTranslation } from 'react-i18next';
import { Link } from "react-router-dom";
import { AdminSidebar } from "./AdminSidebar";
import { AdminNotificationBell } from "./AdminNotificationBell";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { t } = useTranslation('admin');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const isMobile = window.innerWidth < 768;
      if (isMobile) return true;
    }
    const stored = localStorage.getItem('admin_sidebar_collapsed');
    return stored ? JSON.parse(stored) : false;
  });

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

  return (
    <div className="corp h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <div className="flex h-full">
        <AdminSidebar
          collapsed={sidebarCollapsed}
          onToggle={handleToggleSidebar}
        />

        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm view-transition-header">
            <div className="px-6 py-4 flex items-center justify-between">
              <h1 className="corp-h2">
                {t('layout.panelTitle')}
              </h1>
              <div className="flex items-center gap-2 md:gap-3">
                <ThemeToggle />

                {/* Admin alert center (bell inbox) */}
                <AdminNotificationBell />

                {/* Settings shortcut */}
                <Button variant="ghost" size="sm" asChild title={t('layout.settingsTooltip')}>
                  <Link to="/admin/settings" aria-label={t('layout.settingsTooltip')}>
                    <Settings className="h-5 w-5" />
                  </Link>
                </Button>

                <div className="hidden sm:block text-right pl-1">
                  <p className="corp-subtitle-sm">
                    {getAdminName()}
                  </p>
                  <p className="corp-caption">
                    {t('layout.role')}
                  </p>
                </div>
              </div>
            </div>
          </header>

          <main
            className="flex-1 overflow-y-auto transition-[margin-left] duration-300 p-6 view-transition-content"
            aria-label={t('layout.mainContent')}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
