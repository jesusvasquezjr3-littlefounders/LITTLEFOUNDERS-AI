import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AvatarDisplay } from "@/components/avatar/AvatarDisplay";
import { Mail, Shield, Palette, Loader2, Globe, AtSign, UserCircle, ArrowLeft, Users, UserPlus, Search, X } from "lucide-react";
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
    <>
    <div className="corp max-w-6xl mx-auto space-y-6 pb-8 animate-in fade-in duration-500">
        
        {/* Profile Header Card */}
        <div
          className={cn(
            "corp relative rounded-[2.5rem] p-6 md:p-10 overflow-hidden shadow-[0_4px_25px_-4px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-white/5",
            !hasCustomBanner && "corp-panel"
          )}
          style={hasCustomBanner ? { backgroundColor: user.avatar_config.bannerColor } : {}}
        >
          {/* Subtle Overlay - only if has banner to protect text contrast */}
          {hasCustomBanner && (
            <div className="absolute inset-0 bg-black/10 dark:bg-black/20 pointer-events-none" />
          )}

          {/* Banner Edit Button */}
          <div className="absolute top-6 right-6 z-40">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full bg-white/70 dark:bg-[#0d1426]/70 border border-slate-200 dark:border-white/10 hover:bg-white dark:hover:bg-[#0d1426] text-slate-800 dark:text-white shadow-sm transition-colors" disabled={isUpdatingBanner}>
                  {isUpdatingBanner ? <Loader2 className="w-5 h-5 animate-spin" /> : <Palette className="w-5 h-5" />}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="corp w-72 p-4 corp-panel rounded-2xl">
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="corp-eyebrow">{t('profile:tabs.banner')}</h4>
                    {user?.avatar_config?.bannerColor && (
                      <Button variant="ghost" size="sm" onClick={() => handleUpdateBanner('none')} className="h-7 text-[10px] font-bold text-red-500 dark:text-red-400">{t('profile:actions.reset')}</Button>
                    )}
                  </div>
                  <div className="grid grid-cols-5 gap-2.5">
                    {BANNER_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => handleUpdateBanner(color)}
                        className={cn(
                          "w-10 h-10 rounded-xl border-2 transition-all active:scale-95 shadow-sm",
                          color === 'none'
                            ? "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 flex items-center justify-center"
                            : "border-white/50 dark:border-black/20",
                          (user?.avatar_config?.bannerColor === color || (!user?.avatar_config?.bannerColor && color === 'none')) && "ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-[#0d1426] border-indigo-500"
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
            <div className="relative">
              <div className="relative p-1 bg-white/60 dark:bg-[#0d1426]/60 rounded-full border border-slate-200 dark:border-white/10 shadow-sm">
                <AvatarDisplay config={user.avatar_config} size={150} showCTA={true} linkToEdit={true} />
              </div>
            </div>

            {/* User Details */}
            <div className="text-center md:text-left flex-1 space-y-4 pb-2">
              <div>
                <h1 className={cn(
                  "corp-display text-4xl md:text-5xl font-bold tracking-tight mb-2 flex flex-col md:flex-row items-center gap-3",
                  hasCustomBanner ? "text-white drop-shadow-2xl" : "text-slate-900 dark:text-white"
                )}>
                  {hasCustomBanner ? user.name : <span className="corp-gradient-text">{user.name}</span>}
                </h1>
                <p className={cn(
                  "text-base font-semibold flex items-center justify-center md:justify-start gap-2",
                  hasCustomBanner ? "text-white/90 drop-shadow-lg" : "text-slate-500 dark:text-slate-400"
                )}>
                  <AtSign className="w-4 h-4" />
                  {user.username || 'little_founder'}
                </p>
              </div>

                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                  <div className={cn(
                    "px-5 py-2.5 rounded-full border flex items-center gap-3 transition-colors",
                    hasCustomBanner
                      ? "bg-white/20 border-white/30"
                      : "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-100 dark:border-white/10"
                  )}>
                    <Shield className={cn(
                      "w-5 h-5",
                      hasCustomBanner ? "text-indigo-200" : "text-indigo-500 dark:text-indigo-300"
                    )} />
                    <div>
                      <p className={cn(
                        "text-[9px] font-semibold uppercase tracking-widest leading-none mb-1",
                        hasCustomBanner ? "text-white/60" : "text-slate-500 dark:text-slate-400"
                      )}>{t('profile:fields.user_type')}</p>
                      <p className={cn(
                        "text-sm font-bold",
                        hasCustomBanner ? "text-white" : "text-slate-900 dark:text-white"
                      )}>{getUserTypeLabel(user.user_type)}</p>
                    </div>
                  </div>

                {hasCustomBanner ? (
                  <Button
                    onClick={handleShare}
                    variant="ghost"
                    className="h-[52px] px-6 rounded-full font-semibold text-xs uppercase tracking-widest transition-colors inline-flex items-center gap-2 bg-white/20 text-white hover:bg-white/30 border border-white/30"
                  >
                    <Globe className="w-4 h-4" />
                    <span>{t('profile:actions.share_profile')}</span>
                  </Button>
                ) : (
                  <Button
                    onClick={handleShare}
                    className="corp-btn-primary h-[52px] px-6 rounded-full font-semibold text-xs uppercase tracking-widest inline-flex items-center gap-2"
                  >
                    <Globe className="w-4 h-4" />
                    <span>{t('profile:actions.share_profile')}</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Desktop Stats Summary */}
            <div className={cn(
              "hidden xl:flex items-center gap-10 px-8 py-6 rounded-[2.5rem] border transition-colors ml-auto self-stretch",
              hasCustomBanner
                ? "bg-black/10 dark:bg-black/20 border-white/20"
                : "bg-slate-50 dark:bg-[#0d1426] border-slate-200 dark:border-white/10"
            )}>
              <div className="text-center cursor-default">
                <p className={cn(
                  "text-3xl font-bold leading-none",
                  hasCustomBanner ? "text-white drop-shadow-lg" : "text-slate-900 dark:text-white"
                )}>{socialStats.followers}</p>
                <p className={cn(
                  "text-[10px] font-semibold uppercase tracking-[0.2em] mt-2",
                  hasCustomBanner
                    ? "text-white/60"
                    : "text-slate-500 dark:text-slate-400"
                )}>{t('profile:social.followers')}</p>
              </div>
              <div className={cn(
                "w-px h-12",
                hasCustomBanner ? "bg-white/20" : "bg-slate-200 dark:bg-white/10"
              )} />
              <div className="text-center cursor-default">
                <p className={cn(
                  "text-3xl font-bold leading-none",
                  hasCustomBanner ? "text-white drop-shadow-lg" : "text-slate-900 dark:text-white"
                )}>{socialStats.following}</p>
                <p className={cn(
                  "text-[10px] font-semibold uppercase tracking-[0.2em] mt-2",
                  hasCustomBanner
                    ? "text-white/60"
                    : "text-slate-500 dark:text-slate-400"
                )}>{t('profile:social.following')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile/Tablet Social Stats — hidden on xl (where the inline panel shows) */}
        <div className="xl:hidden bg-white dark:bg-[#0d1426] border border-slate-100 dark:border-white/5 rounded-[2.5rem] shadow-sm flex items-center justify-center gap-8 px-6 py-4">
          <div className="text-center">
            <p className="text-2xl font-bold leading-none text-slate-900 dark:text-white">{socialStats.followers}</p>
            <p className="text-[10px] font-semibold uppercase tracking-widest mt-1 text-slate-500 dark:text-slate-400">{t('profile:social.followers')}</p>
          </div>
          <div className="w-px h-8 bg-slate-200 dark:bg-white/10" />
          <div className="text-center">
            <p className="text-2xl font-bold leading-none text-slate-900 dark:text-white">{socialStats.following}</p>
            <p className="text-[10px] font-semibold uppercase tracking-widest mt-1 text-slate-500 dark:text-slate-400">{t('profile:social.following')}</p>
          </div>
        </div>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Learning & Info */}
          <div className="lg:col-span-8 space-y-8 order-1 lg:order-1">
            <section className="space-y-4">
              <div className="px-1">
                <h3 className="corp-eyebrow">{t('profile:sections.my_achievements')}</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { title: t('common:dashboard.stats.lessons'), value: lessonsCompleted, lottieSrc: "https://lottie.host/fd6ae247-34b4-4c56-9b11-f2f3687210a5/ydEAxkmQs0.lottie", size: "70px" },
                  { title: t('common:dashboard.stats.minutes'), value: minutesStudied, lottieSrc: "https://lottie.host/1452b96d-4f8d-4b34-b1ed-88a5e16ff3c3/oM0u7NQXQy.lottie", size: "70px" },
                  { title: t('common:dashboard.stats.points'), value: pointsEarned, lottieSrc: "https://lottie.host/670784f8-65c7-4b8b-a506-3da5403c7a3f/bpw4bs7R0M.lottie", size: "70px" },
                  { title: t('common:dashboard.stats.streak'), value: currentStreak, lottieSrc: "https://lottie.host/3edaf8fb-44e9-43da-b623-1836120273cf/9pmK4xn6MU.lottie", size: "60px" }
                ].map((stat, idx) => (
                  <div key={idx} className={cn("bg-white dark:bg-[#0d1426] rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-[0_4px_25px_-4px_rgba(0,0,0,0.05)]", stat.value === 0 && "grayscale-[0.5] opacity-70")}>
                    <div className="p-5 flex flex-col items-center text-center">
                      <div className="h-16 flex items-center justify-center mb-2">
                        {/* @ts-ignore */}
                        <dotlottie-wc src={stat.lottieSrc} style={{ width: stat.size, height: stat.size }} autoplay loop />
                      </div>
                      <span className="text-3xl font-bold text-slate-900 dark:text-white leading-none tracking-tight">{stat.value}</span>
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-2">{stat.title}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <div className="px-1">
                <h3 className="corp-eyebrow">{t('profile:sections.personal_info')}</h3>
              </div>
              <div className="bg-white dark:bg-[#0d1426] rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-[0_4px_25px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
                <div className="p-6 md:p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[
                      { icon: UserCircle, label: t('auth:fields.name.label'), value: user.name },
                      { icon: AtSign, label: t('profile:fields.nickname'), value: user.username ? `@${user.username}` : t('common:status.not_configured') },
                      { icon: Mail, label: t('auth:fields.email.label'), value: user.email },
                      { icon: Shield, label: t('profile:fields.user_type'), value: getUserTypeLabel(user.user_type) }
                    ].map((item, i) => (
                      <div key={i} className="bg-slate-50 dark:bg-white/5 rounded-2xl flex items-center gap-5 p-5">
                        <div className="corp-icon-chip w-12 h-12 flex-shrink-0">
                          <item.icon className="w-6 h-6" />
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
                          <p className="text-lg font-bold text-slate-900 dark:text-white truncate" title={item.value}>{item.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="lg:hidden">
              <div className="corp-card p-7 flex flex-col items-center text-center gap-5 cursor-pointer" onClick={() => setIsSearchDialogOpen(true)}>
                <div className="corp-icon-chip w-16 h-16 rounded-2xl">
                  <UserPlus className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="corp-display text-lg font-bold text-slate-900 dark:text-white tracking-tight">{t('profile:actions.add_friends')}</h3>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('profile:actions.add_friends_desc')}</p>
                </div>
              </div>
            </section>
          </div>

          {/* Right Column: Social Hub */}
          <div className="hidden lg:block lg:col-span-4 space-y-6 order-2 lg:order-2">
            <div className="space-y-4 lg:sticky lg:top-8">
              <div className="flex items-center justify-between px-1">
                <h3 className="corp-eyebrow">{t('profile:sections.social')}</h3>
                <Button variant="ghost" size="sm" className="text-indigo-600 dark:text-indigo-300 font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-xl gap-2 h-8 px-3 text-xs" onClick={() => setActiveSocialTab("search")}>
                  <UserPlus className="w-3.5 h-3.5" />
                  {t('profile:social.search')}
                </Button>
              </div>

              <div className="bg-white dark:bg-[#0d1426] rounded-[2.5rem] border border-slate-100 dark:border-white/5 shadow-[0_4px_25px_-4px_rgba(0,0,0,0.05)] overflow-hidden flex flex-col h-full min-h-[600px] lg:min-h-[700px]">
                <div className="flex border-b border-slate-200 dark:border-white/10 shrink-0 overflow-hidden">
                  {[
                    { id: "following", label: t('profile:tabs.friends'), icon: Users },
                    { id: "followers", label: t('profile:social.followers'), icon: UserCircle }
                  ].map((tab) => (
                    <button key={tab.id} onClick={() => setActiveSocialTab(tab.id)} className={cn("flex-1 px-4 py-5 text-[10px] font-semibold uppercase tracking-[0.2em] transition-colors relative flex items-center justify-center gap-2", activeSocialTab === tab.id ? "text-indigo-600 dark:text-indigo-300" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300")}>
                      <tab.icon className="w-3.5 h-3.5" />
                      {tab.label}
                      {activeSocialTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
                  {requests.length > 0 && activeSocialTab !== "search" && (
                    <div className="mb-6 corp-panel-subtle p-5 animate-in slide-in-from-top duration-500">
                      <div className="mb-4">
                        <h4 className="corp-eyebrow">{t('profile:tabs.requests')} ({requests.length})</h4>
                      </div>
                      <div className="space-y-3">
                        {requests.map(req => (
                          <div key={req.public_id} className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-[#0d1426] border border-slate-200 dark:border-white/10">
                            <div className="flex items-center gap-3">
                              <div className="p-0.5 rounded-full ring-2 ring-indigo-500/20">
                                <AvatarDisplay config={req.avatar_config} size={36} showCTA={false} />
                              </div>
                              <div>
                                <h4 className="font-bold text-slate-800 dark:text-white truncate text-xs">{req.name || `@${req.username}`}</h4>
                                <p className="text-[9px] font-semibold text-slate-400 dark:text-slate-500">{t('profile:social.want_to_connect')}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button size="sm" className="corp-btn-primary h-8 rounded-xl font-semibold px-3 text-[10px]" onClick={() => handleAccept(req.username)}>{t('profile:social.accept')}</Button>
                              <Button size="icon" variant="ghost" className="corp-btn-ghost h-8 w-8 rounded-xl text-slate-400 dark:text-slate-500" onClick={() => handleReject(req.username)}><X className="w-4 h-4" /></Button>
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
                        <h2 className="corp-display text-xl font-bold text-slate-900 dark:text-white tracking-tight">{t('profile:tabs.search')}</h2>
                        <Button variant="ghost" size="icon" onClick={() => setActiveSocialTab("following")} className="rounded-full h-10 w-10"><ArrowLeft className="w-5 h-5 text-slate-400" /></Button>
                      </div>
                      <form onSubmit={handleSearch} className="relative shrink-0 flex gap-2 px-1">
                        <div className="relative flex-1">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t('profile:sections.search_placeholder')} className="corp-input h-14 pl-12 font-semibold" autoFocus />
                        </div>
                        <Button type="submit" disabled={isSocialLoading || !searchQuery} className="corp-btn-primary h-14 px-6 rounded-xl font-semibold inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">{isSocialLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}</Button>
                      </form>
                      <div className="flex-1 mt-2">
                        {searchResults.length > 0 ? (
                          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500"><UserConnectionsList users={searchResults} /></div>
                        ) : searchQuery && !isSocialLoading ? (
                          <div className="corp-empty py-20 animate-in zoom-in-95 duration-500">
                            <div className="corp-icon-chip w-20 h-20 rounded-2xl mb-2"><Search className="w-8 h-8" /></div>
                            <p className="text-slate-500 dark:text-slate-400 font-semibold">{t('profile:sections.no_results')}</p>
                          </div>
                        ) : !searchQuery && !isSocialLoading && (
                          <div className="corp-empty py-20">
                            <UserPlus className="w-16 h-16 mx-auto mb-4 text-indigo-500/40 dark:text-indigo-300/40" />
                            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">{t('profile:sections.find_friends')}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isSearchDialogOpen} onOpenChange={setIsSearchDialogOpen}>
        <DialogContent className="corp corp-dialog rounded-3xl p-0 overflow-hidden max-w-sm mx-auto">
          <div className="p-8 space-y-8">
            <DialogHeader>
              <DialogTitle className="corp-display text-2xl font-bold text-slate-900 dark:text-white tracking-tight text-center">{t('profile:actions.add_friends')}</DialogTitle>
              <DialogDescription className="text-center font-medium text-slate-500 dark:text-slate-400">{t('profile:actions.add_friends_desc')}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t('profile:sections.search_placeholder')} className="corp-input h-14 pl-11 font-semibold" />
              </div>
              <Button type="submit" disabled={isSocialLoading || !searchQuery} className="corp-btn-primary h-14 w-14 rounded-xl p-0 inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">{isSocialLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-6 h-6" />}</Button>
            </form>
            <div className="min-h-[300px] max-h-[400px] overflow-y-auto scrollbar-hide pr-1">
              {isSocialLoading ? <div className="flex justify-center items-center h-[200px]"><Loader2 className="w-10 h-10 animate-spin text-indigo-500 dark:text-indigo-300" /></div> : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500"><UserConnectionsList users={searchResults} emptyMessage={t('profile:sections.no_results')} /></div>
              )}
            </div>
            <div className="pt-6 border-t border-slate-200 dark:border-white/10">
              <Button onClick={handleShare} className="corp-btn-primary w-full flex items-center justify-center gap-3 h-12 rounded-xl font-semibold uppercase tracking-[0.2em] text-[10px]">
                <Globe className="w-4 h-4" />
                {t('profile:actions.share_profile')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Profile;
