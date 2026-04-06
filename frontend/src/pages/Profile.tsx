import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AvatarDisplay } from "@/components/avatar/AvatarDisplay";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Settings, Trophy, Flame, Star, Mail, Shield, Palette, Loader2, Globe, AtSign, UserCircle, ArrowLeft, Users, UserPlus, Search, X } from "lucide-react";
import { socialApi, UserPublicProfile, FollowRequest } from "../lib/api/social";
import { UserConnectionsList } from "@/components/social/UserConnectionsList";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
  const { t } = useTranslation(['profile', 'common', 'auth']);
  const { toast } = useToast();
  const [isUpdatingBanner, setIsUpdatingBanner] = useState(false);
  const [activeSocialTab, setActiveSocialTab] = useState("following");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<UserPublicProfile[]>([]);
  const [following, setFollowing] = useState<UserPublicProfile[]>([]);
  const [followers, setFollowers] = useState<UserPublicProfile[]>([]);
  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [isSocialLoading, setIsSocialLoading] = useState(false);
  const [socialStats, setSocialStats] = useState({ followers: 0, following: 0 });

  const loadSocialData = async () => {
    try {
      const [followingData, followersData, requestsData] = await Promise.all([
        socialApi.getFollowing(),
        socialApi.getFollowers(),
        socialApi.getPendingRequests()
      ]);
      setFollowing(followingData);
      setFollowers(followersData);
      setRequests(requestsData);
      setSocialStats({
        followers: followersData.length,
        following: followingData.length
      });
    } catch (error) {
      console.error("Error loading social data:", error);
    }
  };

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
    loadSocialData();
  }, []);

  if (!user) return null;

  // View Helpers
  const lessonsCompleted = user.lessons_completed || 0;
  const minutesStudied = user.minutes_studied || 0;
  const pointsEarned = user.points_earned || 0;
  const currentStreak = user.current_streak || 0;

  const getUserTypeLabel = (type: string) => {
    return t(`common:user_types.${type}`, { defaultValue: type });
  };

  const hasCustomBanner = !!user?.avatar_config?.bannerColor && user?.avatar_config?.bannerColor !== 'none';



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
    } finally {
      setIsUpdatingBanner(false);
    }
  };

  const handleShare = async () => {
    if (!user?.username) return;
    const shareUrl = `https://littlefounders.ai/u/${user.username}`;
    const message = `${t('profile:messages.share_message')} ${shareUrl}`;
    
    try {
      await navigator.clipboard.writeText(message);
      toast({
        title: t('profile:messages.share_success'),
        className: "bg-blue-50 text-blue-900 border-blue-200",
        duration: 2000,
      });
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery || searchQuery.length < 3) return;

    setIsSocialLoading(true);
    try {
      const results = await socialApi.searchUsers(searchQuery);
      setSearchResults(results);
    } catch (error) {
      toast({
        title: t('common:status.error'),
        description: t('profile:messages.search_error'),
        variant: "destructive"
      });
    } finally {
      setIsSocialLoading(false);
    }
  };

  const handleAccept = async (username: string) => {
    try {
      await socialApi.acceptRequest(username);
      toast({ title: t('profile:messages.accept_success') });
      loadSocialData();
    } catch (error) {
      toast({ title: t('common:status.error'), variant: "destructive" });
    }
  };

  const handleReject = async (username: string) => {
    try {
      await socialApi.rejectRequest(username);
      toast({ title: t('profile:messages.reject_success') });
      loadSocialData();
    } catch (error) {
      toast({ title: t('common:status.error'), variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 pb-8 animate-in fade-in duration-500">
        
        {/* Profile Header Card */}
        <div
          className={cn(
            "relative rounded-3xl p-6 md:p-10 liquid-glass-strong overflow-hidden transition-all duration-700 border border-white/20 dark:border-white/10 shadow-2xl",
            !hasCustomBanner && "bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl"
          )}
          style={hasCustomBanner ? { backgroundColor: user.avatar_config.bannerColor } : {}}
        >
          {/* Ambient Glows Layered - only if no banner */}
          {!hasCustomBanner && (
            <>
              <div className="absolute -top-16 -right-16 w-80 h-80 bg-gradient-to-br from-indigo-500/20 to-purple-600/20 rounded-full blur-[100px] pointer-events-none animate-pulse duration-[10s]" />
              <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-gradient-to-tr from-blue-500/15 to-cyan-500/15 rounded-full blur-[80px] pointer-events-none" />
            </>
          )}

          {/* Subtle Overlay - only if has banner to protect text contrast */}
          {hasCustomBanner && (
            <div className="absolute inset-0 bg-black/10 dark:bg-black/20 backdrop-blur-[2px] pointer-events-none" />
          )}

          {/* Banner Edit Button */}
          <div className="absolute top-6 right-6 z-40">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full bg-white/20 dark:bg-black/20 backdrop-blur-md border border-white/30 dark:border-white/10 hover:bg-white/40 dark:hover:bg-black/40 text-slate-800 dark:text-white shadow-lg transition-all active:scale-90" disabled={isUpdatingBanner}>
                  {isUpdatingBanner ? <Loader2 className="w-5 h-5 animate-spin" /> : <Palette className="w-5 h-5" />}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl border-white/20 dark:border-slate-800 rounded-3xl">
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-black text-xs uppercase tracking-widest text-slate-500">{t('profile:tabs.banner')}</h4>
                    {user?.avatar_config?.bannerColor && (
                      <Button variant="ghost" size="sm" onClick={() => handleUpdateBanner('none')} className="h-7 text-[10px] font-bold text-red-500">{t('profile:actions.reset')}</Button>
                    )}
                  </div>
                  <div className="grid grid-cols-5 gap-2.5">
                    {BANNER_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => handleUpdateBanner(color)}
                        className={cn(
                          "w-10 h-10 rounded-xl border-2 transition-all hover:scale-110 active:scale-95 shadow-sm",
                          color === 'none' 
                            ? "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 flex items-center justify-center" 
                            : "border-white/50 dark:border-black/20",
                          (user?.avatar_config?.bannerColor === color || (!user?.avatar_config?.bannerColor && color === 'none')) && "ring-2 ring-indigo-500 ring-offset-2 scale-110 border-indigo-500"
                        )}
                        style={color !== 'none' ? { backgroundColor: color } : {}}
                      >
                        {color === 'none' && <X className="w-4 h-4 text-slate-400" />}
                      </button>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="relative flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-8 z-30">
            {/* Avatar Section */}
            <div className="relative group">
              <div
                className="absolute -inset-2 rounded-full blur-xl opacity-40 group-hover:opacity-70 transition duration-1000 group-hover:duration-200"
                style={{
                  background: user.avatar_config?.backgroundColor?.[0] && user.avatar_config.backgroundColor[0] !== 'none'
                    ? `#${user.avatar_config.backgroundColor[0]}`
                    : 'linear-gradient(to right, #6366f1, #a855f7)'
                }}
              />
              <div className="relative p-1 bg-white/20 dark:bg-black/20 backdrop-blur-md rounded-full border border-white/30 dark:border-white/10 shadow-2xl">
                <AvatarDisplay config={user.avatar_config} size={150} showCTA={true} linkToEdit={true} />
              </div>
            </div>

            {/* User Details */}
            <div className="text-center md:text-left flex-1 space-y-4 pb-2">
              <div>
                <h1 className={cn(
                  "text-4xl md:text-5xl font-black tracking-tighter mb-2 flex flex-col md:flex-row items-center gap-3",
                  hasCustomBanner ? "text-white drop-shadow-2xl" : "text-slate-900 dark:text-white"
                )}>
                  {user.name}
                </h1>
                <p className={cn(
                  "text-base font-bold flex items-center justify-center md:justify-start gap-2",
                  hasCustomBanner ? "text-white/90 drop-shadow-lg" : "text-slate-500 dark:text-slate-400"
                )}>
                  <AtSign className="w-4 h-4" />
                  {user.username || 'little_founder'}
                </p>
              </div>

                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                  <div className={cn(
                    "px-5 py-2.5 rounded-2xl backdrop-blur-md border flex items-center gap-3 shadow-xl transition-all duration-300",
                    hasCustomBanner 
                      ? "bg-white/20 border-white/30" 
                      : "bg-indigo-500/10 dark:bg-indigo-900/30 border-white/20 dark:border-white/5"
                  )}>
                    <Shield className={cn(
                      "w-5 h-5",
                      hasCustomBanner ? "text-indigo-300" : "text-indigo-500 dark:text-indigo-400"
                    )} />
                    <div>
                      <p className={cn(
                        "text-[9px] font-black uppercase tracking-widest leading-none mb-1",
                        hasCustomBanner ? "text-white/60" : "text-slate-500 dark:text-slate-400"
                      )}>{t('profile:fields.user_type')}</p>
                      <p className={cn(
                        "text-sm font-black",
                        hasCustomBanner ? "text-white" : "text-slate-900 dark:text-white"
                      )}>{getUserTypeLabel(user.user_type)}</p>
                    </div>
                  </div>

                <Button
                  onClick={handleShare}
                  variant="ghost"
                  className={cn(
                    "h-[52px] px-6 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 group overflow-hidden relative border-none",
                    hasCustomBanner 
                      ? "bg-white/20 text-white hover:bg-white/30 backdrop-blur-md border-white/30" 
                      : "bg-indigo-500 text-white hover:bg-indigo-600 shadow-indigo-500/25"
                  )}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                  <Globe className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                  <span>{t('profile:actions.share_profile')}</span>
                </Button>
              </div>
            </div>

            {/* Desktop Stats Summary */}
            <div className={cn(
              "hidden xl:flex items-center gap-10 px-8 py-6 rounded-[2rem] backdrop-blur-md border transition-all duration-300 ml-auto self-stretch",
              hasCustomBanner 
                ? "bg-black/10 dark:bg-black/20 border-white/20 shadow-xl" 
                : "bg-white/20 dark:bg-black/20 border-black/5 dark:border-white/10 shadow-lg"
            )}>
              <div className="text-center group cursor-default">
                <p className={cn(
                  "text-3xl font-black leading-none transition-transform group-hover:scale-110",
                  hasCustomBanner ? "text-white drop-shadow-lg" : "text-slate-900 dark:text-white"
                )}>{socialStats.followers}</p>
                <p className={cn(
                  "text-[10px] font-black uppercase tracking-[0.2em] mt-2 transition-colors",
                  hasCustomBanner 
                    ? "text-white/60 group-hover:text-blue-300" 
                    : "text-slate-500 dark:text-slate-400 group-hover:text-blue-500"
                )}>{t('profile:social.followers')}</p>
              </div>
              <div className={cn(
                "w-px h-12 transition-colors",
                hasCustomBanner ? "bg-white/20" : "bg-slate-300 dark:bg-slate-700 opacity-50"
              )} />
              <div className="text-center group cursor-default">
                <p className={cn(
                  "text-3xl font-black leading-none transition-transform group-hover:scale-110",
                  hasCustomBanner ? "text-white drop-shadow-lg" : "text-slate-900 dark:text-white"
                )}>{socialStats.following}</p>
                <p className={cn(
                  "text-[10px] font-black uppercase tracking-[0.2em] mt-2 transition-colors",
                  hasCustomBanner 
                    ? "text-white/60 group-hover:text-blue-300" 
                    : "text-slate-500 dark:text-slate-400 group-hover:text-blue-500"
                )}>{t('profile:social.following')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile/Tablet Social Stats — hidden on xl (where the inline panel shows) */}
        <div className={cn(
          "xl:hidden flex items-center justify-center gap-8 px-6 py-4 rounded-2xl border transition-all duration-300",
          hasCustomBanner
            ? "bg-black/10 dark:bg-black/20 border-white/20"
            : "bg-white/20 dark:bg-black/20 border-black/5 dark:border-white/10"
        )}>
          <div className="text-center">
            <p className={cn("text-2xl font-black leading-none", hasCustomBanner ? "text-white" : "text-slate-900 dark:text-white")}>{socialStats.followers}</p>
            <p className={cn("text-[10px] font-black uppercase tracking-widest mt-1", hasCustomBanner ? "text-white/60" : "text-slate-500 dark:text-slate-400")}>{t('profile:social.followers')}</p>
          </div>
          <div className={cn("w-px h-8", hasCustomBanner ? "bg-white/20" : "bg-slate-300 dark:bg-slate-700 opacity-50")} />
          <div className="text-center">
            <p className={cn("text-2xl font-black leading-none", hasCustomBanner ? "text-white" : "text-slate-900 dark:text-white")}>{socialStats.following}</p>
            <p className={cn("text-[10px] font-black uppercase tracking-widest mt-1", hasCustomBanner ? "text-white/60" : "text-slate-500 dark:text-slate-400")}>{t('profile:social.following')}</p>
          </div>
        </div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Learning & Info */}
          <div className="lg:col-span-8 space-y-8 order-1 lg:order-1">
            <section className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <div className="w-1 h-5 rounded-full bg-gradient-to-b from-yellow-400 to-orange-500" />
                <h3 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em]">{t('profile:sections.my_achievements')}</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { title: t('common:dashboard.stats.lessons'), value: lessonsCompleted, lottieSrc: "https://lottie.host/fd6ae247-34b4-4c56-9b11-f2f3687210a5/ydEAxkmQs0.lottie", accent: "from-blue-500/20 to-indigo-500/10 border-blue-500/20 shadow-blue-500/10", size: "70px" },
                  { title: t('common:dashboard.stats.minutes'), value: minutesStudied, lottieSrc: "https://lottie.host/1452b96d-4f8d-4b34-b1ed-88a5e16ff3c3/oM0u7NQXQy.lottie", accent: "from-emerald-500/20 to-teal-500/10 border-emerald-500/20 shadow-emerald-500/10", size: "70px" },
                  { title: t('common:dashboard.stats.points'), value: pointsEarned, lottieSrc: "https://lottie.host/670784f8-65c7-4b8b-a506-3da5403c7a3f/bpw4bs7R0M.lottie", accent: "from-amber-500/20 to-yellow-500/10 border-amber-500/20 shadow-amber-500/10", size: "70px" },
                  { title: t('common:dashboard.stats.streak'), value: currentStreak, lottieSrc: "https://lottie.host/3edaf8fb-44e9-43da-b623-1836120273cf/9pmK4xn6MU.lottie", accent: "from-rose-500/20 to-orange-500/10 border-rose-500/20 shadow-rose-500/10", size: "60px" }
                ].map((stat, idx) => (
                  <GlassPanel key={idx} variant="subtle" className={cn("hover:scale-[1.05] hover:shadow-2xl transition-all duration-300 overflow-hidden border-2 group", `bg-gradient-to-br ${stat.accent}`, stat.value === 0 && "grayscale-[0.5] opacity-70")}>
                    <div className="p-5 flex flex-col items-center text-center relative">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 dark:bg-black/10 rounded-bl-full translate-x-4 -translate-y-4 group-hover:translate-x-2 group-hover:-translate-y-2 transition-transform" />
                      <div className="h-16 flex items-center justify-center mb-2 drop-shadow-xl transform group-hover:scale-110 transition-transform">
                        {/* @ts-ignore */}
                        <dotlottie-wc src={stat.lottieSrc} style={{ width: stat.size, height: stat.size }} autoplay loop />
                      </div>
                      <span className="text-3xl font-black text-slate-900 dark:text-white leading-none tracking-tight">{stat.value}</span>
                      <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-2">{stat.title}</span>
                    </div>
                  </GlassPanel>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <div className="w-1 h-5 rounded-full bg-gradient-to-b from-purple-500 to-pink-500" />
                <h3 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em]">{t('profile:sections.personal_info')}</h3>
              </div>
              <GlassPanel variant="default" className="liquid-glass-subtle overflow-hidden">
                <CardContent className="p-6 md:p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[
                      { icon: UserCircle, label: t('auth:fields.name.label'), value: user.name, color: "blue" },
                      { icon: AtSign, label: t('profile:fields.nickname'), value: user.username ? `@${user.username}` : t('common:status.not_configured'), color: "green" },
                      { icon: Mail, label: t('auth:fields.email.label'), value: user.email, color: "purple" },
                      { icon: Shield, label: t('profile:fields.user_type'), value: getUserTypeLabel(user.user_type), color: "amber" }
                    ].map((item, i) => (
                      <div key={i} className="group relative">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl blur opacity-0 group-hover:opacity-10 transition duration-500" />
                        <div className="relative flex items-center gap-5 p-5 rounded-3xl bg-white/40 dark:bg-black/20 border border-white/50 dark:border-white/5 transition-all hover:translate-x-1">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg transition-transform group-hover:rotate-6",
                            item.color === 'blue' && "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400",
                            item.color === 'green' && "bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400",
                            item.color === 'purple' && "bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400",
                            item.color === 'amber' && "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400"
                          )}>
                            <item.icon className="w-6 h-6" />
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
                            <p className="text-lg font-black text-slate-900 dark:text-white truncate" title={item.value}>{item.value}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </GlassPanel>
            </section>

            <section className="lg:hidden">
              <GlassPanel variant="subtle" className="relative overflow-hidden p-7 flex flex-col items-center text-center gap-5 cursor-pointer hover:scale-[1.01] transition-all duration-300 active:scale-95 border border-blue-500/10 shadow-xl" onClick={() => setIsSearchDialogOpen(true)}>
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br from-blue-500/15 to-cyan-500/15 rounded-full blur-2xl pointer-events-none" />
                <div className="relative w-16 h-16 rounded-[1.5rem] bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-xl shadow-blue-500/25">
                  <UserPlus className="w-8 h-8 text-white" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight uppercase">{t('profile:actions.add_friends')}</h3>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('profile:actions.add_friends_desc')}</p>
                </div>
              </GlassPanel>
            </section>
          </div>

          {/* Right Column: Social Hub */}
          <div className="hidden lg:block lg:col-span-4 space-y-6 order-2 lg:order-2">
            <div className="space-y-4 lg:sticky lg:top-8">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 rounded-full bg-gradient-to-b from-blue-500 to-cyan-500" />
                  <h3 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em]">{t('profile:sections.social')}</h3>
                </div>
                <Button variant="ghost" size="sm" className="text-blue-600 dark:text-blue-400 font-bold hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl gap-2 h-8 px-3 text-xs" onClick={() => setActiveSocialTab("search")}>
                  <UserPlus className="w-3.5 h-3.5" />
                  {t('profile:social.search')}
                </Button>
              </div>

              <GlassPanel variant="subtle" className="overflow-hidden flex flex-col h-full min-h-[600px] lg:min-h-[700px] shadow-2xl border-2 border-white/30 dark:border-white/5 bg-white/10 dark:bg-slate-900/20 backdrop-blur-3xl rounded-[2.5rem] liquid-glass">
                <div className="flex border-b border-black/5 dark:border-white/5 shrink-0 overflow-hidden bg-white/5 dark:bg-black/20">
                  {[
                    { id: "following", label: t('profile:tabs.friends'), icon: Users },
                    { id: "followers", label: t('profile:social.followers'), icon: UserCircle }
                  ].map((tab) => (
                    <button key={tab.id} onClick={() => setActiveSocialTab(tab.id)} className={cn("flex-1 px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative flex items-center justify-center gap-2", activeSocialTab === tab.id ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 hover:text-slate-600 hover:bg-white/10 dark:hover:bg-white/5")}>
                      <tab.icon className={cn("w-3.5 h-3.5", activeSocialTab === tab.id ? "animate-pulse" : "")} />
                      {tab.label}
                      {activeSocialTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-t-full shadow-[0_-2px_10px_rgba(99,102,241,0.5)]" />}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
                  {requests.length > 0 && activeSocialTab !== "search" && (
                    <div className="mb-6 p-5 rounded-[2rem] bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/20 animate-in slide-in-from-top duration-500 shadow-lg shadow-indigo-500/5">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-1.5 h-4 bg-indigo-500 rounded-full" />
                        <h4 className="text-[10px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest leading-none">{t('profile:tabs.requests')} ({requests.length})</h4>
                      </div>
                      <div className="space-y-3">
                        {requests.map(req => (
                          <div key={req.public_id} className="flex items-center justify-between p-4 rounded-2xl bg-white/80 dark:bg-slate-800/80 shadow-md border border-white dark:border-white/5 group transform hover:scale-[1.02] transition-all">
                            <div className="flex items-center gap-3">
                              <div className="p-0.5 rounded-full ring-2 ring-indigo-500/20">
                                <AvatarDisplay config={req.avatar_config} size={36} showCTA={false} />
                              </div>
                              <div>
                                <h4 className="font-black text-slate-800 dark:text-white truncate text-xs">{req.name || `@${req.username}`}</h4>
                                <p className="text-[9px] font-bold text-slate-400">{t('profile:social.want_to_connect')}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button size="sm" className="h-8 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-black px-3 text-[10px] shadow-lg shadow-indigo-500/20" onClick={() => handleAccept(req.username)}>{t('profile:social.accept')}</Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors" onClick={() => handleReject(req.username)}><X className="w-4 h-4" /></Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeSocialTab === "following" && <div className="animate-in fade-in slide-in-from-bottom-2 duration-500"><UserConnectionsList users={following} emptyMessage={t('profile:social.empty_following')} /></div>}
                  {activeSocialTab === "followers" && <div className="animate-in fade-in slide-in-from-bottom-2 duration-500"><UserConnectionsList users={followers} emptyMessage={t('profile:social.empty_followers')} /></div>}
                  {activeSocialTab === "search" && (
                    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500 h-full flex flex-col">
                      <div className="flex items-center justify-between px-2">
                        <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">{t('profile:tabs.search')}</h2>
                        <Button variant="ghost" size="icon" onClick={() => setActiveSocialTab("following")} className="rounded-full h-10 w-10"><ArrowLeft className="w-5 h-5 text-slate-400" /></Button>
                      </div>
                      <form onSubmit={handleSearch} className="relative group shrink-0 flex gap-2 px-1">
                        <div className="relative flex-1">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t('profile:sections.search_placeholder')} className="pl-12 h-14 rounded-[1.25rem] bg-white/40 dark:bg-black/20 border-2 border-transparent focus-visible:ring-0 focus-visible:border-indigo-500/50 font-bold text-slate-900 dark:text-white" autoFocus />
                        </div>
                        <Button type="submit" disabled={isSocialLoading || !searchQuery} className="h-14 px-6 rounded-[1.25rem] bg-indigo-500 hover:bg-indigo-600 text-white font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 active:scale-95">{isSocialLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}</Button>
                      </form>
                      <div className="flex-1 mt-2">
                        {searchResults.length > 0 ? (
                          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500"><UserConnectionsList users={searchResults} /></div>
                        ) : searchQuery && !isSocialLoading ? (
                          <div className="text-center py-20 space-y-4 animate-in zoom-in-95 duration-500">
                            <div className="w-20 h-20 bg-white/20 dark:bg-black/10 rounded-[2rem] flex items-center justify-center mx-auto ring-4 ring-white/10"><Search className="w-8 h-8 text-slate-300" /></div>
                            <p className="text-slate-500 font-bold">{t('profile:sections.no_results')}</p>
                          </div>
                        ) : !searchQuery && !isSocialLoading && (
                          <div className="text-center py-20 opacity-30 select-none grayscale group-hover:grayscale-0 transition-all duration-1000">
                            <UserPlus className="w-16 h-16 mx-auto mb-4 text-indigo-500/50 transform group-hover:scale-110 group-hover:rotate-6 transition-transform" />
                            <p className="text-[10px] font-black uppercase tracking-[0.3em]">{t('profile:sections.find_friends')}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </GlassPanel>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isSearchDialogOpen} onOpenChange={setIsSearchDialogOpen}>
        <DialogContent className="liquid-glass-strong border-white/20 dark:border-white/10 p-0 overflow-hidden rounded-[3rem] max-w-sm mx-auto shadow-2xl backdrop-blur-3xl bg-white/40 dark:bg-slate-900/60">
          <div className="p-10 space-y-8 relative">
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
            <DialogHeader className="relative z-10">
              <DialogTitle className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter text-center">{t('profile:actions.add_friends')}</DialogTitle>
              <DialogDescription className="text-center font-bold text-slate-500 dark:text-slate-400">{t('profile:actions.add_friends_desc')}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSearch} className="flex gap-2 relative z-10">
              <div className="relative flex-1 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t('profile:sections.search_placeholder')} className="pl-11 h-14 rounded-2xl bg-white/60 dark:bg-black/40 border-2 border-transparent focus:border-indigo-500 font-black" />
              </div>
              <Button type="submit" disabled={isSocialLoading || !searchQuery} className="h-14 w-14 rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-white font-black shadow-xl shadow-indigo-500/20 active:scale-95 p-0">{isSocialLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-6 h-6" />}</Button>
            </form>
            <div className="min-h-[300px] max-h-[400px] overflow-y-auto scrollbar-hide pr-1 relative z-10">
              {isSocialLoading ? <div className="flex justify-center items-center h-[200px]"><Loader2 className="w-10 h-10 animate-spin text-indigo-500" /></div> : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500"><UserConnectionsList users={searchResults} emptyMessage={t('profile:sections.no_results')} /></div>
              )}
            </div>
            <div className="pt-6 border-t border-black/5 dark:border-white/5 relative z-10">
              <Button onClick={handleShare} variant="ghost" className="w-full flex items-center justify-center gap-3 h-16 rounded-[1.5rem] bg-gradient-to-r from-indigo-500 to-indigo-600 text-white font-black uppercase tracking-[0.2em] text-[10px] shadow-xl shadow-indigo-500/25 transition-all border-none">
                <div className="p-1.5 bg-white/20 rounded-lg"><Globe className="w-4 h-4 text-white" /></div>
                {t('profile:actions.share_profile')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Profile;
