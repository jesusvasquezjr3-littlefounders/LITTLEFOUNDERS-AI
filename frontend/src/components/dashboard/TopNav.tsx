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
    switch (userType) {
      case 'tutor':
        return t('user_types.tutor');
      case 'child':
        return t('user_types.child');
      case 'sponsor':
        return t('user_types.sponsor');
      default:
        return t('user_types.user');
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
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                  {user ? user.name : t('user_menu.user')}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user ? getUserTypeLabel(user.user_type) : t('user_types.user')}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user ? user.email : "email@example.com"}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/profile">
                <User className="mr-2 h-4 w-4" />
                <span>{t('user_menu.my_profile')}</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/settings">
                <Settings className="mr-2 h-4 w-4" />
                <span>{t('user_menu.settings')}</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/help">
                <HelpCircle className="mr-2 h-4 w-4" />
                <span>{t('user_menu.help')}</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>{t('user_menu.logout')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}