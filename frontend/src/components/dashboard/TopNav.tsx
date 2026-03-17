import { useTranslation } from 'react-i18next';
import { Bell, User, Settings, LogOut, HelpCircle } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarDisplay } from "@/components/avatar/AvatarDisplay";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { useSound } from "@/contexts/SoundContext";


export function TopNav() {
  const { t } = useTranslation('dashboard');
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();
  const { playSound } = useSound();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleLogout = () => {
    playSound('auth_bye');
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    navigate('/bye');
  };

  const getUserTypeLabel = (userType: string) => {
    if (!userType) return t('user_types.user');

    switch (userType.toLowerCase()) {
      case 'tutor':
        return t('user_types.tutor');
      case 'child':
        return t('user_types.child');
      case 'universal':
        return t('user_types.universal');
      case 'admin':
        return t('user_types.admin');
      default:
        // Fallback gracefully without assuming all unrecognized users should literally be just labeled "Usuario"
        return userType.charAt(0).toUpperCase() + userType.slice(1);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };



  return (
    <header className="relative flex items-center justify-end px-6 py-3 bg-card border-b border-border">
      {/* Centered Logo - Hidden on mobile to prevent overlap */}
      <div className="hidden md:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform">
        <img
          src="/logo-sized.png"
          alt="LittleFounders"
          className="h-8 w-auto object-contain"
        />
      </div>

      {/* Right Section */}
      <div className="flex items-center space-x-4">
        {/* Language Selector */}


        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="relative">
              <Bell className="h-5 w-5" />
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center"
              >
                3
              </Badge>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>{t('notifications.title')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="space-y-2 p-2">
              <div className="p-3 bg-revenue-light rounded-lg">
                <p className="font-medium text-sm">{t('notifications.goal_achieved')}</p>
                <p className="text-xs text-muted-foreground">{t('notifications.goal_achieved_desc')}</p>
              </div>
              <div className="p-3 bg-customers-light rounded-lg">
                <p className="font-medium text-sm">{t('notifications.reminder')}</p>
                <p className="text-xs text-muted-foreground">{t('notifications.reminder_desc')}</p>
              </div>
              <div className="p-3 bg-product-light rounded-lg">
                <p className="font-medium text-sm">{t('notifications.new_skill')}</p>
                <p className="text-xs text-muted-foreground">{t('notifications.new_skill_desc')}</p>
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 overflow-hidden border-2 border-white dark:border-slate-800 shadow-sm transition-transform hover:scale-105 ring-2 ring-indigo-500/70 ring-offset-2 dark:ring-offset-slate-900">
              {user?.avatar_config ? (
                <AvatarDisplay
                  config={user.avatar_config}
                  size={40}
                  className="w-full h-full scale-125"
                  showCTA={false}
                  linkToEdit={false}
                  includeBorder={false}
                />
              ) : (
                <Avatar className="h-full w-full">
                  <AvatarImage src="/placeholder-avatar.jpg" className="object-cover" alt={t('user_menu.user')} />
                  <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold">
                    {user ? getInitials(user.name) : "U"}
                  </AvatarFallback>
                </Avatar>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-72 p-2 rounded-2xl border border-indigo-100/50 dark:border-slate-800/50 shadow-2xl liquid-glass-strong"
            align="end"
            forceMount
          >
            <DropdownMenuLabel className="font-normal p-0 mb-2">
              <div className="flex items-center space-x-3 p-3 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl">
                <div className="h-12 w-12 rounded-full overflow-hidden border-2 border-white dark:border-slate-800 shadow-sm bg-white dark:bg-slate-800 shrink-0">
                  {user?.avatar_config ? (
                    <AvatarDisplay
                      config={user.avatar_config}
                      size={48}
                      className="w-full h-full scale-125"
                      showCTA={false}
                      linkToEdit={false}
                      includeBorder={false}
                    />
                  ) : (
                    <Avatar className="h-full w-full">
                      <AvatarImage src="/placeholder-avatar.jpg" className="object-cover" alt={t('user_menu.user')} />
                      <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold">
                        {user ? getInitials(user.name) : "U"}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
                <div className="flex flex-col space-y-1 overflow-hidden min-w-0 flex-1">
                  <p className="text-base font-semibold leading-none text-slate-900 dark:text-slate-100 truncate">
                    {user ? user.name : t('user_menu.user')}
                  </p>
                  {user?.username && (
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                      @{user.username}
                    </p>
                  )}
                  <div className="pt-1">
                    <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60 border-none px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider w-fit">
                      {user ? getUserTypeLabel(user.user_type) : t('user_types.user')}
                    </Badge>
                  </div>
                </div>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800 my-2" />

            <div className="space-y-1">
              <DropdownMenuItem asChild className="cursor-pointer rounded-xl p-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 focus:bg-slate-50 dark:focus:bg-slate-800/50 outline-none">
                <Link to="/profile" className="flex items-center w-full">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 mr-3">
                    <User className="h-4 w-4" />
                  </div>
                  <span className="font-medium text-slate-700 dark:text-slate-200">{t('user_menu.my_profile')}</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer rounded-xl p-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 focus:bg-slate-50 dark:focus:bg-slate-800/50 outline-none">
                <Link to="/settings" className="flex items-center w-full">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 mr-3">
                    <Settings className="h-4 w-4" />
                  </div>
                  <span className="font-medium text-slate-700 dark:text-slate-200">{t('user_menu.settings')}</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer rounded-xl p-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 focus:bg-slate-50 dark:focus:bg-slate-800/50 outline-none">
                <Link to="/help" className="flex items-center w-full">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 mr-3">
                    <HelpCircle className="h-4 w-4" />
                  </div>
                  <span className="font-medium text-slate-700 dark:text-slate-200">{t('user_menu.help')}</span>
                </Link>
              </DropdownMenuItem>
            </div>

            <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800 my-2" />

            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer rounded-xl p-3 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 focus:bg-red-50 dark:focus:bg-red-900/20 text-red-600 dark:text-red-400 outline-none">
              <div className="flex items-center w-full">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/40 mr-3">
                  <LogOut className="h-4 w-4" />
                </div>
                <span className="font-medium">{t('user_menu.logout')}</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}