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

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:8000');

interface DashboardLayoutProps {
  children?: ReactNode;
}

// Layout principal del panel de Littlefounders
export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { t } = useTranslation('dashboard');
  const showGuestBanner = isGuest() && !localStorage.getItem('user');

  // On mount: refresh user stats from /auth/me so streak/points are always fresh
  // This ensures cross-device consistency — stats stored in DB are fetched on each session
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (!token || !userStr) return;

    fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => (res.ok ? res.json() : null))
      .then(freshUser => {
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
          // last_activity_date drives the 3-state streak display (zero / inactive / active).
          // /auth/me also resets stale streaks in DB when user missed 2+ days.
          last_activity_date: freshUser.last_activity_date ?? stored.last_activity_date ?? null,
        };
        localStorage.setItem('user', JSON.stringify(merged));
        window.dispatchEvent(new CustomEvent('lf:user-updated'));
      })
      .catch(() => {/* silently fail — user keeps cached data */});
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
