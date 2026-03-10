import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AvatarDisplay } from "@/components/avatar/AvatarDisplay";
import { Settings, User, Trophy, Flame, Star, Mail, Calendar, Shield, Palette, Check, Loader2, BookOpen, Clock, Globe, AtSign, UserCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/components/ui/use-toast";
import { API_URL } from "@/config/api";
import { cn } from "@/lib/utils";

const BANNER_COLORS = [
  'none', // Default
  '#f8fafc', '#f1f5f9', '#cbd5e1', // Slate
  '#ef4444', '#f87171', '#fca5a5', // Red
  '#f97316', '#fb923c', '#fdba74', // Orange
  '#eab308', '#facc15', '#fde047', // Yellow
  '#22c55e', '#4ade80', '#86efac', // Green
  '#06b6d4', '#22d3ee', '#67e8f9', // Cyan
  '#3b82f6', '#60a5fa', '#93c5fd', // Blue
  '#a855f7', '#c084fc', '#d8b4fe', // Purple
  '#ec4899', '#f472b6', '#fbcfe8', // Pink
];

const Profile = () => {
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();
  const { t } = useTranslation(['profile', 'common']);
  const { toast } = useToast();
  const [isUpdatingBanner, setIsUpdatingBanner] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  if (!user) return null;

  // Dashboard stats
  const lessonsCompleted = user.lessons_completed || 0;
  const minutesStudied = user.minutes_studied || 0;
  const pointsEarned = user.points_earned || 0;
  const currentStreak = user.current_streak || 0;

  // User type display mapping
  const getUserTypeLabel = (type: string) => {
    const key = `common:user_types.${type}`;
    // Fallback if translation key doesn't exist (though it should be added to common)
    return t(key, { defaultValue: type });
  };



  const handleUpdateBanner = async (color: string) => {
    if (!user) return;
    setIsUpdatingBanner(true);

    try {
      const rawToken = localStorage.getItem('token');
      if (!rawToken) throw new Error("No token");
      const token = rawToken.replace(/"/g, '');

      const newAvatarConfig = {
        ...(user.avatar_config || {}),
        bannerColor: color === 'none' ? undefined : color
      };

      const response = await fetch(`${API_URL}/auth/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ avatar_config: newAvatarConfig })
      });

      if (!response.ok) throw new Error("Failed to update");

      const updatedUser = { ...user, avatar_config: newAvatarConfig };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));

      toast({
        title: t('profile:messages.profile_updated'),
        description: t('profile:messages.changes_saved'),
        className: "bg-green-50 text-green-900 border-green-200",
        duration: 2000,
      });

    } catch (error) {
      console.error(error);
      toast({
        title: t('common:error'),
        description: t('profile:messages.upload_error_type'), // Generic error for now
        variant: "destructive"
      });
    } finally {
      setIsUpdatingBanner(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto pb-8 animate-in fade-in duration-500">

        {/* Header Section */}
        <div
          className="relative bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden transition-colors duration-500"
          style={user?.avatar_config?.bannerColor ? { backgroundColor: user.avatar_config.bannerColor } : {}}
        >
          {/* Banner Edit Button */}
          <div className="absolute top-4 right-4 z-20">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/40 text-slate-800 dark:text-white shadow-sm" disabled={isUpdatingBanner}>
                  {isUpdatingBanner ? <Loader2 className="w-4 h-4 animate-spin" /> : <Palette className="w-4 h-4" />}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-3 bg-white/95 backdrop-blur shadow-xl border-slate-100">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-center mb-2">{t('profile:tabs.banner')}</h4>
                  <div className="grid grid-cols-5 gap-2">
                    {BANNER_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => handleUpdateBanner(color)}
                        className={cn(
                          "w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary shadow-sm",
                          color === 'none' && "bg-slate-100 dark:bg-slate-800",
                          (user?.avatar_config?.bannerColor === color || (!user?.avatar_config?.bannerColor && color === 'none')) && "ring-2 ring-primary ring-offset-2 scale-110"
                        )}
                        style={color !== 'none' ? { backgroundColor: color } : {}}
                        title={color}
                      >
                        {color === 'none' && <span className="text-xs text-slate-400">❌</span>}
                      </button>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="relative flex flex-col md:flex-row items-center gap-6 z-10">
            <div className="relative group">
              <div
                className="absolute -inset-1 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"
                style={{
                  background: user.avatar_config?.backgroundColor?.[0] && user.avatar_config.backgroundColor[0] !== 'none'
                    ? `#${user.avatar_config.backgroundColor[0]}`
                    : 'linear-gradient(to right, #ec4899, #9333ea)'
                }}
              />
              <AvatarDisplay
                config={user.avatar_config}
                size={128}
                showCTA={true}
                linkToEdit={true}
              />
            </div>

            <div className="text-center md:text-left space-y-2">
              <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                {user.name}
              </h1>
              {user.user_type === 'child' && (
                <p className="text-lg text-slate-500 dark:text-slate-400 font-medium flex items-center justify-center md:justify-start gap-2">
                  <Shield className="w-5 h-5 text-blue-500" />
                  {t('common:roles.little_founder')}
                </p>
              )}
            </div>

            <div className="md:ml-auto">
              <Button
                onClick={() => navigate('/settings')}
                variant="outline"
                className="rounded-full border-2 border-slate-200 hover:border-slate-300 dark:border-slate-700 gap-2"
              >
                <Settings className="w-4 h-4" />
                {t('common:navigation.settings')}
              </Button>
            </div>
          </div>
        </div>

        {/* content grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Stats Card */}
          <Card className="border border-white/20 dark:border-white/5 shadow-xl backdrop-blur-sm bg-gradient-to-br from-blue-600/10 via-purple-500/5 to-indigo-600/10 rounded-3xl overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                {t('profile:sections.my_achievements')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 md:grid-cols-2 gap-2 md:gap-4">
                <div className="flex flex-col items-center p-2 md:p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl">
                  <div className="p-1.5 md:p-2 bg-green-100 dark:bg-green-900/30 rounded-full mb-1 md:mb-2">
                    <BookOpen className="w-4 h-4 md:w-6 md:h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-lg md:text-2xl font-bold text-slate-900 dark:text-white">{lessonsCompleted}</span>
                  <span className="text-[10px] md:text-xs text-slate-500 font-medium uppercase tracking-wide text-center leading-tight">{t('common:dashboard.stats.lessons')}</span>
                </div>
                <div className="flex flex-col items-center p-2 md:p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl">
                  <div className="p-1.5 md:p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-1 md:mb-2">
                    <Clock className="w-4 h-4 md:w-6 md:h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-lg md:text-2xl font-bold text-slate-900 dark:text-white">{minutesStudied}</span>
                  <span className="text-[10px] md:text-xs text-slate-500 font-medium uppercase tracking-wide text-center leading-tight">{t('common:dashboard.stats.minutes')}</span>
                </div>
                <div className="flex flex-col items-center p-2 md:p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl">
                  <div className="p-1.5 md:p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-full mb-1 md:mb-2">
                    <Star className="w-4 h-4 md:w-6 md:h-6 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <span className="text-lg md:text-2xl font-bold text-slate-900 dark:text-white">{pointsEarned}</span>
                  <span className="text-[10px] md:text-xs text-slate-500 font-medium uppercase tracking-wide text-center leading-tight">{t('common:dashboard.stats.points')}</span>
                </div>
                <div className="flex flex-col items-center p-2 md:p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl">
                  <div className="p-1.5 md:p-2 bg-orange-100 dark:bg-orange-900/30 rounded-full mb-1 md:mb-2">
                    <Flame className="w-4 h-4 md:w-6 md:h-6 text-orange-600 dark:text-orange-400" />
                  </div>
                  <span className="text-lg md:text-2xl font-bold text-slate-900 dark:text-white">{currentStreak}</span>
                  <span className="text-[10px] md:text-xs text-slate-500 font-medium uppercase tracking-wide text-center leading-tight">{t('common:dashboard.stats.streak')}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Details Card */}
          <Card className="border border-white/20 dark:border-white/5 shadow-xl backdrop-blur-sm bg-gradient-to-br from-blue-600/10 via-purple-500/5 to-indigo-600/10 rounded-3xl overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-purple-500" />
                {t('profile:sections.personal_info')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Name */}
              <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <UserCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('auth:fields.name.label')}</p>
                  <p className="text-base font-semibold text-slate-900 dark:text-white truncate">{user.name}</p>
                </div>
              </div>

              {/* Username */}
              <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                  <AtSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('profile:fields.nickname')}</p>
                  <p className="text-base font-semibold text-slate-900 dark:text-white truncate">
                    {user.username ? `@${user.username}` : <span className="text-slate-400 italic">{t('common:status.not_configured')}</span>}
                  </p>
                </div>
              </div>

              {/* Email */}
              <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('auth:fields.email.label')}</p>
                  <p className="text-base font-semibold text-slate-900 dark:text-white truncate" title={user.email}>
                    {user.email}
                  </p>
                </div>
              </div>

              {/* Preferred Language */}
              <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center flex-shrink-0">
                  <Globe className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('profile:fields.language')}</p>
                  <p className="text-base font-semibold text-slate-900 dark:text-white truncate">
                    {t(`common:languages.${user.preferred_language}`) || user.preferred_language}
                  </p>
                </div>
              </div>

              {/* User Type */}
              <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('profile:fields.user_type')}</p>
                  <p className="text-base font-semibold text-slate-900 dark:text-white truncate">
                    {getUserTypeLabel(user.user_type)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </DashboardLayout>
  );
};

export default Profile;
