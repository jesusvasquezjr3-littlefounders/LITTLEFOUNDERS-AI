import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation } from "react-router-dom";
import {
  Settings,
  HelpCircle,
  Home,
  BookOpen,
  Trophy,
  ClipboardList,
  PiggyBank,
  Store,
  TrendingUp,
  ChevronsLeftRight,
  Lock,
  Gamepad2,
  Bot
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useSound } from "@/contexts/SoundContext";
import { isGuest } from "@/lib/guestProfile";

const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
};

// Menu items with translation keys
const getMenuItems = (t: (key: string) => string) => {
  const user = getUser();
  // Guests (no auth but completed onboarding) get the universal menu
  const effectiveType = user.user_type || (isGuest() ? 'universal' : 'tutor');

  if (effectiveType === 'child') {
    return [
      { title: t('dashboard:sidebar.lessons'), url: "/learn", icon: BookOpen, id: "nav-lessons" },
      { title: t('dashboard:sidebar.ai'), url: "/ai", icon: Bot, id: "nav-ai" },
      { title: t('dashboard:sidebar.my_tasks'), url: "/tasks", icon: Trophy, id: "nav-tasks" },
      { title: t('dashboard:sidebar.my_savings'), url: "/savings", icon: PiggyBank, id: "nav-savings" },
      { title: t('dashboard:sidebar.entrepreneurship'), url: "/games", icon: Gamepad2, id: "nav-games" },
      { title: t('dashboard:sidebar.digital_banking'), url: "/growth", icon: TrendingUp, id: "nav-banking" },
      { title: t('dashboard:sidebar.store'), url: "/store", icon: Store, id: "nav-store" },
    ];
  } else if (effectiveType === 'universal') {
    return [
      { title: t('dashboard:sidebar.lessons'), url: "/learn", icon: BookOpen, id: "nav-lessons" },
      // AI is locked for guests — flagged with requiresAuth, handled in handleItemClick
      { title: t('dashboard:sidebar.ai'), url: "/ai", icon: Bot, id: "nav-ai", requiresAuth: !localStorage.getItem('user') },
      { title: t('dashboard:sidebar.entrepreneurship'), url: "/games", icon: Gamepad2, id: "nav-games" },
      { title: t('dashboard:sidebar.my_tasks'), url: "#", icon: Trophy, id: "nav-tasks", locked: true },
      { title: t('dashboard:sidebar.my_savings'), url: "#", icon: PiggyBank, id: "nav-savings", locked: true },
      { title: t('dashboard:sidebar.digital_banking'), url: "#", icon: TrendingUp, id: "nav-banking", locked: true },
      { title: t('dashboard:sidebar.store'), url: "#", icon: Store, id: "nav-store", locked: true },
    ];
  } else {
    return [
      { title: t('dashboard:sidebar.home'), url: "/dashboard", icon: Home, id: "nav-home" },
      { title: t('dashboard:sidebar.lessons'), url: "/learn", icon: BookOpen, id: "nav-lessons" },
      { title: t('dashboard:sidebar.ai'), url: "/ai", icon: Bot, id: "nav-ai" },
      { title: t('dashboard:sidebar.task_management'), url: "/parent-tasks", icon: ClipboardList, id: "nav-tasks" },
      { title: t('dashboard:sidebar.my_savings'), url: "/savings", icon: PiggyBank, id: "nav-savings" },
      { title: t('dashboard:sidebar.entrepreneurship'), url: "/games", icon: Gamepad2, id: "nav-games" },
      { title: t('dashboard:sidebar.digital_banking'), url: "/growth", icon: TrendingUp, id: "nav-banking" },
      { title: t('dashboard:sidebar.store'), url: "/store", icon: Store, id: "nav-store" },
    ];
  }
};

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { t } = useTranslation('dashboard');
  const location = useLocation();
  const currentPath = location.pathname;
  const menuItems = getMenuItems(t);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const { toast } = useToast();
  const { playSound } = useSound();

  const isExpanded = isHovered || !collapsed;

  const isActive = (path: string) => {
    if (path === "#") return false;
    if (path === "/dashboard") return currentPath === "/dashboard";
    if (path === "/learn") return currentPath === "/learn" || currentPath === "/lessons";
    return currentPath.startsWith(path);
  };

  const handleItemClick = (e: React.MouseEvent, item: any) => {
    playSound('nav_slide');
    if (item.locked) {
      e.preventDefault();
      toast({
        title: t('sidebar.locked_title'),
        description: t('sidebar.locked_description'),
        variant: "default",
      });
      return;
    }
    if (item.requiresAuth) {
      e.preventDefault();
      toast({
        title: t('guest.feature_requires_account_title'),
        description: t('guest.create_account'),
        variant: "default",
      });
    }
  };

  return (
    <>
      {/* Desktop Sidebar - Left vertical dock */}
      <div
        className={cn(
          "hidden md:flex fixed left-4 top-1/2 -translate-y-1/2 z-50",
          "flex-col items-center gap-1 p-3",
          "rounded-3xl bg-white dark:bg-[#0d1426] border border-slate-200 dark:border-white/10",
          "shadow-xl shadow-black/5 dark:shadow-black/40",
          "transition-all duration-300 ease-out",
          isExpanded ? "w-60" : "w-24",
          "view-transition-sidebar"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Menu Items */}
        <div ref={containerRef} className="flex flex-col gap-2 w-full py-2">
          {menuItems.map((item: any) => {
            const active = isActive(item.url);
            return (
              <NavLink
                key={item.title}
                to={item.url}
                id={item.id}
              end={item.url === "/dashboard" || item.url === "/learn"}
                onClick={(e) => handleItemClick(e, item)}
                className={cn(
                  "group flex items-center gap-3 p-2 rounded-2xl transition-all duration-200",
                  active
                    ? "bg-indigo-50 dark:bg-indigo-500/10"
                    : "hover:bg-slate-100 dark:hover:bg-white/5",
                  !isExpanded && "justify-center",
                  item.locked && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className={cn(
                  "relative flex items-center justify-center w-12 h-12 rounded-2xl transition-colors duration-200",
                  active
                    ? "bg-gradient-to-br from-indigo-500 to-blue-500 text-white shadow-md shadow-indigo-500/30"
                    : "bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-white"
                )}>
                  <item.icon className="w-6 h-6" />
                  {item.locked && (
                    <div className="absolute -top-1 -right-1 bg-white dark:bg-slate-800 rounded-full p-1 shadow">
                      <Lock className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                    </div>
                  )}
                </div>
                {isExpanded && (
                  <span className={cn(
                    "text-xs font-semibold tracking-tight truncate transition-colors",
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
            "hover:bg-slate-100 dark:hover:bg-white/5",
            !collapsed && "bg-indigo-50 dark:bg-indigo-500/10"
          )}
          title={!collapsed ? t('sidebar.collapse') : t('sidebar.expand')}
        >
          <ChevronsLeftRight className={cn(
            "w-5 h-5 text-slate-500 dark:text-slate-400 transition-transform duration-300",
            !collapsed && "text-indigo-500 rotate-90"
          )} />
        </Button>
      </div>

      {/* Mobile Bottom Dock - Horizontal */}
      <div className="md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 p-2 rounded-2xl bg-white dark:bg-[#0d1426] border border-slate-200 dark:border-white/10 shadow-xl shadow-black/5 dark:shadow-black/40 overflow-x-auto max-w-[95vw]">
        {menuItems.slice(0, 7).map((item: any) => {
          const active = isActive(item.url);
          return (
            <NavLink
              key={item.id}
              to={item.url}
              id={`mobile-${item.id}`}
              end={item.url === "/dashboard" || item.url === "/learn"}
              onClick={(e) => handleItemClick(e, item)}
              className={cn(
                "flex-shrink-0 flex items-center justify-center p-1.5 rounded-xl transition-colors duration-200",
                item.locked && "opacity-50"
              )}
            >
              <div className={cn(
                "relative flex items-center justify-center w-11 h-11 rounded-xl transition-colors duration-200",
                active
                  ? "bg-gradient-to-br from-indigo-500 to-blue-500 text-white shadow-md shadow-indigo-500/30"
                  : "bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-300"
              )}>
                <item.icon className="w-5 h-5" />
                {item.locked && (
                  <div className="absolute -top-1 -right-1 bg-white dark:bg-slate-800 rounded-full p-0.5 shadow">
                    <Lock className="w-2.5 h-2.5 text-slate-500 dark:text-slate-400" />
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