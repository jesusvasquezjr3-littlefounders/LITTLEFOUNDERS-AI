import { useState, ReactNode } from "react";
import { useTranslation } from 'react-i18next';
import { AdminSidebar } from "./AdminSidebar";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { cn } from "@/lib/utils";

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
    <div className="h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <div className="flex h-full">
        <AdminSidebar
          collapsed={sidebarCollapsed}
          onToggle={handleToggleSidebar}
        />

        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="px-6 py-4 flex items-center justify-between">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {t('layout.panelTitle')}
              </h1>
              <div className="flex items-center gap-4">
                <ThemeToggle />
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
              !sidebarCollapsed ? "md:ml-0" : "md:ml-0"
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
