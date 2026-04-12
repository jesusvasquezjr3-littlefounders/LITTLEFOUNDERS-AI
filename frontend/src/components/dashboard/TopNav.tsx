import { useTranslation } from 'react-i18next';
import {
  Bell, User, Settings, LogOut, HelpCircle,
  UserPlus, UserCheck, Flame, Trophy, BookOpen, Megaphone, Clock, Sparkles,
  Check, CheckCheck, X,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { cn } from "@/lib/utils";

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
import { useEffect, useState, useCallback, useRef } from "react";
import { useSound } from "@/contexts/SoundContext";
import { notificationsApi, type NotificationItem } from "@/lib/api/notifications";
import { isGuest, getGuestProfile } from "@/lib/guestProfile";

const NOTIFICATION_TYPE_CONFIG: Record<string, { icon: any; bgClass: string }> = {
  follow_request: { icon: UserPlus, bgClass: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" },
  follow_accepted: { icon: UserCheck, bgClass: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" },
  new_follower: { icon: UserPlus, bgClass: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" },
  streak: { icon: Flame, bgClass: "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400" },
  achievement: { icon: Trophy, bgClass: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400" },
  lesson: { icon: BookOpen, bgClass: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" },
  admin_broadcast: { icon: Megaphone, bgClass: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400" },
  reminder: { icon: Clock, bgClass: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" },
  system: { icon: Sparkles, bgClass: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400" },
};

function getTimeAgo(dateStr: string, t: (key: string, opts?: any) => string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffMin < 1) return t('notifications.just_now');
  if (diffMin < 60) return t('notifications.minutes_ago', { count: diffMin });
  if (diffHrs < 24) return t('notifications.hours_ago', { count: diffHrs });
  if (diffDays < 7) return t('notifications.days_ago', { count: diffDays });
  return date.toLocaleDateString();
}

export function TopNav() {
  const { t } = useTranslation('dashboard');
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();
  const { playSound } = useSound();
  const guestMode = isGuest() && !localStorage.getItem('user');
  const guestProfile = guestMode ? getGuestProfile() : null;

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const count = await notificationsApi.getUnreadCount();
      setUnreadCount(count);
    } catch {
      // silently fail
    }
  }, []);

  // Fetch notifications list
  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const items = await notificationsApi.getNotifications(20);
      setNotifications(items);
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Poll unread count every 30 seconds
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    fetchUnreadCount();
    pollRef.current = setInterval(fetchUnreadCount, 30000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchUnreadCount]);

  // Load notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);

  const handleNotificationClick = async (notif: NotificationItem) => {
    // Mark as read
    if (!notif.read_at) {
      await notificationsApi.markAsRead(notif.public_id);
      setUnreadCount(prev => Math.max(0, prev - 1));
      setNotifications(prev =>
        prev.map(n => n.public_id === notif.public_id ? { ...n, read_at: new Date().toISOString() } : n)
      );
    }
    // If the notification has a body, show detail modal; otherwise navigate directly
    if (notif.body) {
      setIsOpen(false);
      setSelectedNotification(notif);
    } else if (notif.action_url) {
      setIsOpen(false);
      navigate(notif.action_url);
    }
  };

  const handleDetailNavigate = () => {
    if (selectedNotification?.action_url) {
      navigate(selectedNotification.action_url);
    }
    setSelectedNotification(null);
  };

  const handleMarkAllRead = async () => {
    await notificationsApi.markAllAsRead();
    setUnreadCount(0);
    setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
  };

  const handleDismiss = async (e: React.MouseEvent, publicId: string) => {
    e.stopPropagation();
    await notificationsApi.dismiss(publicId);
    setNotifications(prev => prev.filter(n => n.public_id !== publicId));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

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
        return userType.charAt(0).toUpperCase() + userType.slice(1);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <>
    <header className="relative flex items-center justify-between px-4 md:px-6 py-3 bg-card border-b border-border">
      {/* Left Section: Stats */}
      <div className="flex items-center gap-2 md:gap-4 shrink-0">
        {/* Points Stat */}
        <div className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-2xl liquid-glass-subtle border transition-all",
          (user?.points_earned > 0 || (guestMode && (guestProfile?.xp ?? 0) > 0))
            ? "border-amber-500/20 shadow-sm shadow-amber-500/5 group hover:scale-105"
            : "border-slate-300 dark:border-slate-700 opacity-60 grayscale"
        )}>
          <div className="w-8 h-8 flex items-center justify-center">
            {/* @ts-ignore */}
            <dotlottie-wc src="https://lottie.host/670784f8-65c7-4b8b-a506-3da5403c7a3f/bpw4bs7R0M.lottie" autoplay loop style={{ width: '100%', height: '100%' }} />
          </div>
          <span className={cn(
            "text-base font-black leading-none",
            (user?.points_earned > 0 || (guestMode && (guestProfile?.xp ?? 0) > 0)) ? "text-amber-600 dark:text-amber-400" : "text-slate-500 dark:text-slate-400"
          )}>
            {guestMode ? (guestProfile?.xp ?? 0) : (user?.points_earned?.toLocaleString() || 0)}
          </span>
        </div>

        {/* Streak Stat */}
        <div className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-2xl liquid-glass-subtle border transition-all",
          (user?.current_streak > 0 || (guestMode && (guestProfile?.current_streak ?? 0) > 0))
            ? "border-rose-500/20 shadow-sm shadow-rose-500/5 group hover:scale-105"
            : "border-slate-300 dark:border-slate-700 opacity-60 grayscale"
        )}>
          <div className="w-8 h-8 flex items-center justify-center">
            {/* @ts-ignore */}
            <dotlottie-wc src="https://lottie.host/3edaf8fb-44e9-43da-b623-1836120273cf/9pmK4xn6MU.lottie" autoplay loop style={{ width: '105%', height: '105%' }} />
          </div>
          <span className={cn(
            "text-base font-black leading-none",
            (user?.current_streak > 0 || (guestMode && (guestProfile?.current_streak ?? 0) > 0)) ? "text-rose-500 dark:text-rose-400" : "text-slate-500 dark:text-slate-400"
          )}>
            {guestMode ? (guestProfile?.current_streak ?? 0) : (user?.current_streak || 0)}
          </span>
        </div>
      </div>

      {/* Centered Logo - Hidden on smaller screens to prevent overlap */}
      <div className="hidden lg:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform pointer-events-none">
        <img
          src="/logo-sized.png"
          alt="LittleFounders"
          className="h-7 w-auto object-contain opacity-80"
        />
      </div>

      {/* Right Section */}
      <div className="flex items-center space-x-4">
        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Guest CTA — shown instead of bell + avatar */}
        {guestMode && (
          <Button asChild size="sm" className="rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold shadow-lg shadow-purple-500/20 text-xs h-9 px-3">
            <Link to="/register">{t('guest.create_account')}</Link>
          </Button>
        )}

        {/* Notifications — only for authenticated users */}
        {!guestMode && <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="relative">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-5 min-w-5 rounded-full p-0 text-xs flex items-center justify-center"
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-96 max-h-[480px] p-0 rounded-xl shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="font-semibold text-sm">{t('notifications.title')}</h3>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7 px-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
                  onClick={handleMarkAllRead}
                >
                  <CheckCheck className="h-3.5 w-3.5 mr-1" />
                  {t('notifications.mark_all_read')}
                </Button>
              )}
            </div>

            {/* Notification list */}
            <div className="overflow-y-auto max-h-[380px]">
              {isLoading && notifications.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
                  <div className="animate-spin h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full mr-2" />
                  {t('notifications.loading')}
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                  <Bell className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">{t('notifications.empty')}</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">{t('notifications.empty_desc')}</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {notifications.map(notif => {
                    const config = NOTIFICATION_TYPE_CONFIG[notif.type] || NOTIFICATION_TYPE_CONFIG.system;
                    const Icon = config.icon;
                    const isUnread = !notif.read_at;

                    return (
                      <div
                        key={notif.public_id}
                        className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 group ${
                          isUnread ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : ''
                        }`}
                        onClick={() => handleNotificationClick(notif)}
                      >
                        <div className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 mt-0.5 ${config.bgClass}`}>
                          <Icon className="h-4.5 w-4.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm leading-snug ${isUnread ? 'font-semibold text-slate-900 dark:text-slate-100' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
                              {notif.title}
                            </p>
                            <button
                              onClick={(e) => handleDismiss(e, notif.public_id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 shrink-0"
                              title={t('notifications.dismiss')}
                            >
                              <X className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          </div>
                          {notif.body && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.body}</p>
                          )}
                          {notif.media_url && (
                            <img
                              src={notif.media_url}
                              alt=""
                              className="mt-2 rounded-lg max-h-32 object-cover w-full"
                            />
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11px] text-muted-foreground/70">
                              {getTimeAgo(notif.created_at, t)}
                            </span>
                            {isUnread && (
                              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>}

        {/* User Menu — only for authenticated users */}
        {!guestMode && <>{/* User Menu */}
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
        </DropdownMenu></>}
      </div>
    </header>

      {/* Notification Detail Modal */}
      {selectedNotification && (() => {
        const notif = selectedNotification;
        const config = NOTIFICATION_TYPE_CONFIG[notif.type] || NOTIFICATION_TYPE_CONFIG.system;
        const Icon = config.icon;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setSelectedNotification(null)}
          >
            <div
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className={`flex items-center justify-center w-9 h-9 rounded-xl shrink-0 ${config.bgClass}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {notif.type.replace(/_/g, ' ')}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedNotification(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="h-4 w-4 text-slate-500" />
                </button>
              </div>

              {/* Modal body */}
              <div className="px-5 py-5 space-y-3">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-snug">
                  {notif.title}
                </h2>
                {notif.body && (
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {notif.body}
                  </p>
                )}
                {notif.media_url && (
                  <img
                    src={notif.media_url}
                    alt=""
                    className="w-full rounded-xl object-cover max-h-56 mt-2"
                    onError={e => (e.currentTarget.style.display = 'none')}
                  />
                )}
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {getTimeAgo(notif.created_at, t)}
                </p>
              </div>

              {/* Modal footer */}
              <div className="px-5 pb-5 flex items-center justify-end gap-3">
                <button
                  onClick={() => setSelectedNotification(null)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  {t('notifications.dismiss')}
                </button>
                {notif.action_url && (
                  <button
                    onClick={handleDetailNavigate}
                    className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
                  >
                    {t('notifications.go_to_action') || 'Ver más'}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
