import { useState, ReactNode, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";
import { UserTour } from "./UserTour";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { GuestBanner } from "@/components/auth/GuestBanner";
import { GuestNudgeModal } from "@/components/auth/GuestNudgeModal";
import { isGuest } from "@/lib/guestProfile";
import { initSession, apiFetch } from "@/lib/apiClient";

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:8000');

interface DashboardLayoutProps {
  children?: ReactNode;
}

// Layout principal del panel de Littlefounders
export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { t } = useTranslation('dashboard');
  const showGuestBanner = isGuest() && !localStorage.getItem('user');

  // On mount: refresh user stats from /auth/me so streak/points are always fresh.
  // If access token is missing (page reload), try silent refresh via httpOnly cookie first.
  useEffect(() => {
    const doFetch = async () => {
      // On page refresh, the in-memory access token is gone.
      // Try a silent refresh via the httpOnly cookie — this is the Duolingo pattern.
      await initSession();

      const userStr = localStorage.getItem('user');
      const token = localStorage.getItem('token');
      if (!token || !userStr) return;

      const res = await apiFetch('/auth/me');
      if (!res.ok) return;

      const freshUser = await res.json().catch(() => null);
      if (!freshUser) return;

      const stored = JSON.parse(userStr);
      const merged = {
        ...stored,
        current_streak: freshUser.current_streak ?? stored.current_streak ?? 0,
        max_streak: freshUser.max_streak ?? stored.max_streak ?? 0,
        lessons_completed: freshUser.lessons_completed ?? stored.lessons_completed ?? 0,
        minutes_studied: freshUser.minutes_studied ?? stored.minutes_studied ?? 0,
        points_earned: freshUser.points_earned ?? stored.points_earned ?? 0,
        avatar_config: freshUser.avatar_config ?? stored.avatar_config,
        username: freshUser.username ?? stored.username,
        preferred_language: freshUser.preferred_language ?? stored.preferred_language,
        last_activity_date: freshUser.last_activity_date ?? stored.last_activity_date ?? null,
      };
      localStorage.setItem('user', JSON.stringify(merged));
      window.dispatchEvent(new CustomEvent('lf:user-updated'));
    };
    doFetch();
  }, []);

  // Initialize from localStorage or default to true (collapsed by default)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    // Check if running in browser
    if (typeof window !== 'undefined') {
      const isMobile = window.innerWidth < 768; // md breakpoint
      if (isMobile) return true;
    }
    const stored = localStorage.getItem('main_sidebar_collapsed');
    return stored ? JSON.parse(stored) : true; // Default: collapsed
  });

  const handleToggle = () => {
    const newState = !sidebarCollapsed;
    setSidebarCollapsed(newState);
    localStorage.setItem('main_sidebar_collapsed', JSON.stringify(newState));
  };

  return (
    <div className="corp h-screen overflow-hidden bg-slate-50 dark:bg-[#070b14]">
      <UserTour />
      <GuestNudgeModal />
      <div className="flex h-full relative">
        {/* Menú lateral: Flotante y responsivo */}
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={handleToggle}
        />
        <div className="flex-1 flex flex-col h-full overflow-hidden transition-all duration-300 pb-24 md:pb-0">
          {/* Barra superior - spans full width */}
          <TopNav />
          <main className={cn(
            "flex-1 p-6 overflow-y-auto transition-all duration-300",
            // Desktop: dynamic margin for sidebar
            !sidebarCollapsed ? "md:ml-64" : "md:ml-28",
            "view-transition-content"
          )} aria-label={t('layout.main_content_aria')}>
            {/* Guest banner — appears on every page for non-authenticated guests */}
            {showGuestBanner && <GuestBanner />}
            {children ?? <Outlet />}
          </main>
        </div>
      </div>
    </div>
  );
}
