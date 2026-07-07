import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AvatarDisplay } from "@/components/avatar/AvatarDisplay";
import { Mail, Shield, Palette, Loader2, Globe, AtSign, UserCircle, ArrowLeft, Users, UserPlus, Search, X, Trophy, Clock, Zap, Star, Camera } from "lucide-react";
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
import { useCountUp } from "@/hooks/useCountUp";

const STATS = [
  { key: 'lessons_completed', labelKey: 'common:dashboard.stats.lessons', lottieSrc: "https://lottie.host/fd6ae247-34b4-4c56-9b11-f2f3687210a5/ydEAxkmQs0.lottie" },
  { key: 'minutes_studied', labelKey: 'common:dashboard.stats.minutes', lottieSrc: "https://lottie.host/1452b96d-4f8d-4b34-b1ed-88a5e16ff3c3/oM0u7NQXQy.lottie" },
  { key: 'points_earned', labelKey: 'common:dashboard.stats.points', lottieSrc: "https://lottie.host/670784f8-65c7-4b8b-a506-3da5403c7a3f/bpw4bs7R0M.lottie" },
  { key: 'current_streak', labelKey: 'common:dashboard.stats.streak', lottieSrc: "https://lottie.host/3edaf8fb-44e9-43da-b623-1836120273cf/9pmK4xn6MU.lottie" },
];

const BANNER_COLORS = [
  'none',
  '#f8fafc', '#f1f5f9', '#cbd5e1',
  '#ef4444', '#f87171', '#fca5a5',
  '#f97316', '#fb923c', '#fdba74',
  '#eab308', '#facc15', '#fde047',
  '#22c55e', '#4ade80', '#86efac',
  '#06b6d4', '#22d3ee', '#67e8f9',
  '#3b82f6', '#60a5fa', '#93c5fd',
  '#a855f7', '#c084fc', '#d8b4fe',
  '#ec4899', '#f472b6', '#fbcfe8',
];

function ProfileStatCard({ value, labelKey, lottieSrc, t }: { value: number; labelKey: string; lottieSrc: string; t: (key: string) => string }) {
  const animatedValue = useCountUp(value, { duration: 1000, delay: 300 });

  return (
    <div className={cn("corp-card rounded-2xl p-5 flex flex-col items-center text-center gap-2", value === 0 && "opacity-40")}>
      {/* @ts-ignore */}
      <dotlottie-wc src={lottieSrc} style={{ width: "48px", height: "48px" }} autoplay loop />
      <div>
        <p className="corp-number-lg">{animatedValue}</p>
        <p className="corp-eyebrow mt-1">{t(labelKey)}</p>
      </div>
    </div>
  );
}

function SocialStatCount({ value, className }: { value: number; className?: string }) {
  const animatedValue = useCountUp(value, { duration: 800, delay: 200 });
  return <p className={cn("corp-number-lg", className)}>{animatedValue}</p>;
}

const Profile = () => {
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();
  const { t } = useTranslation(['profile', 'common', 'auth']);
  const { toast } = useToast();
  const [isUpdatingBanner, setIsUpdatingBanner] = useState(false);
  const [activeSocialTab, setActiveSocialTab] = useState<"following" | "followers" | "search">("following");
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
        socialApi.getFollowing(), socialApi.getFollowers(), socialApi.getPendingRequests()
      ]);
      setFollowing(followingData);
      setFollowers(followersData);
      setRequests(requestsData);
      setSocialStats({ followers: followersData.length, following: followingData.length });
    } catch (error) { console.error("Error loading social data:", error); }
  };

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) setUser(JSON.parse(userData));
    loadSocialData();
  }, []);

  if (!user) return null;

  const bannerColor = user?.avatar_config?.bannerColor;
  const hasCustomBanner = !!bannerColor && bannerColor !== 'none';

  const handleUpdateBanner = async (color: string) => {
    if (!user) return;
    setIsUpdatingBanner(true);
    try {
      const rawToken = localStorage.getItem('token');
      if (!rawToken) throw new Error("No token");
      const token = rawToken.replace(/"/g, '');
      const newAvatarConfig = { ...(user.avatar_config || {}), bannerColor: color === 'none' ? undefined : color };
      const response = await fetch(`${API_URL}/auth/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ avatar_config: newAvatarConfig })
      });
      if (!response.ok) throw new Error("Failed to update");
      const updatedUser = { ...user, avatar_config: newAvatarConfig };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
      toast({ title: t('profile:messages.profile_updated'), description: t('profile:messages.changes_saved') });
    } catch (error) { console.error(error); } finally { setIsUpdatingBanner(false); }
  };

  const handleShare = async () => {
    if (!user?.username) return;
    const shareUrl = `https://littlefounders.ai/u/${user.username}`;
    try {
      await navigator.clipboard.writeText(`${t('profile:messages.share_message')} ${shareUrl}`);
      toast({ title: t('profile:messages.share_success') });
    } catch (err) { console.error('Failed to copy: ', err); }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery || searchQuery.length < 3) return;
    setIsSocialLoading(true);
    try { setSearchResults(await socialApi.searchUsers(searchQuery)); } catch (error) { toast({ title: t('common:status.error'), description: t('profile:messages.search_error'), variant: "destructive" }); } finally { setIsSocialLoading(false); }
  };

  const handleAccept = async (username: string) => {
    try { await socialApi.acceptRequest(username); toast({ title: t('profile:messages.accept_success') }); loadSocialData(); } catch (error) { toast({ title: t('common:status.error'), variant: "destructive" }); }
  };

  const handleReject = async (username: string) => {
    try { await socialApi.rejectRequest(username); toast({ title: t('profile:messages.reject_success') }); loadSocialData(); } catch (error) { toast({ title: t('common:status.error'), variant: "destructive" }); }
  };

  return (
    <>
    <div className="corp max-w-6xl mx-auto pb-16 px-4 pt-8 animate-in fade-in duration-300">

      {/* ── Page header ────────────────────────────────────────────── */}
      <div className="mb-8 flex items-center justify-between">
        <h1 className="corp-h1">
          {t('common:navigation.profile')}
        </h1>
      </div>

      {/* ── Layout ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* ── Left Panel ───────────────────────────────────────────── */}
        <div className="lg:col-span-4 space-y-6">

          {/* Profile card */}
          <div
            className={cn(
              "rounded-[2.5rem] p-8 flex flex-col items-center text-center gap-5 relative overflow-hidden",
              hasCustomBanner
                ? "shadow-[0_1px_3px_-1px_rgba(0,0,0,0.03)] border border-white/20"
                : "corp-panel"
            )}
            style={hasCustomBanner ? { backgroundColor: bannerColor } : undefined}
          >
            {hasCustomBanner && <div className="absolute inset-0 bg-black/10 dark:bg-black/20 pointer-events-none" />}

            <div className={cn("relative z-10", hasCustomBanner && "text-white")}>
              <div className="relative">
              <AvatarDisplay config={user.avatar_config} size={112} showCTA={false} linkToEdit={true} />
              <button
                onClick={() => navigate('/avatar/edit')}
                className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-white dark:bg-[#0d1426] border border-slate-200 dark:border-white/10 shadow-sm flex items-center justify-center hover:bg-slate-50 dark:hover:bg-white/5 transition-colors duration-150"
                aria-label="Edit avatar"
              >
                <Camera className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              </button>
              </div>
            </div>

            <div className={cn("relative z-10", hasCustomBanner && "text-white")}>
              <h2 className={cn("corp-h4", hasCustomBanner ? "text-white" : "text-slate-900 dark:text-white")}>{user.name}</h2>
              <p className={cn("corp-body-sm mt-0.5", hasCustomBanner ? "text-white/70" : "text-slate-500 dark:text-slate-400")}>
                @{user.username || 'little_founder'}
              </p>
            </div>

            {/* Social counts */}
            <div className={cn("relative z-10 w-full pt-4 border-t", hasCustomBanner ? "border-white/20" : "border-slate-200 dark:border-white/10")}>
              <div className="flex items-center justify-center gap-10">
                <div className="text-center">
                  <SocialStatCount value={socialStats.followers} className={hasCustomBanner ? "text-white" : "text-slate-900 dark:text-white"} />
                  <p className={cn("corp-eyebrow mt-1", hasCustomBanner && "text-white/60")}>{t('profile:social.followers')}</p>
                </div>
                <div className={cn("w-px h-10", hasCustomBanner ? "bg-white/20" : "bg-slate-200 dark:bg-white/10")} />
                <div className="text-center">
                  <SocialStatCount value={socialStats.following} className={hasCustomBanner ? "text-white" : "text-slate-900 dark:text-white"} />
                  <p className={cn("corp-eyebrow mt-1", hasCustomBanner && "text-white/60")}>{t('profile:social.following')}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className={cn("relative z-10 w-full pt-4 border-t flex flex-col gap-2.5", hasCustomBanner ? "border-white/20" : "border-slate-200 dark:border-white/10")}>
              <button onClick={handleShare} className={cn(
                "w-full h-11 rounded-full text-sm font-semibold inline-flex items-center justify-center gap-2",
                hasCustomBanner ? "bg-white/20 text-white border border-white/30 hover:bg-white/30" : "corp-btn-primary"
              )}>
                <Globe className="w-4 h-4" />
                {t('profile:actions.share_profile')}
              </button>

              <Popover>
                <PopoverTrigger asChild>
                  <button className={cn(
                    "w-full h-11 rounded-full text-sm font-semibold inline-flex items-center justify-center gap-2",
                    hasCustomBanner ? "bg-white/10 text-white border border-white/30 hover:bg-white/20" : "corp-btn-secondary"
                  )}>
                    <Palette className="w-4 h-4" />
                    {t('profile:tabs.banner')}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="center" className="corp w-64 p-4 corp-panel rounded-2xl">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="corp-eyebrow">{t('profile:tabs.banner')}</span>
                      {user?.avatar_config?.bannerColor && (
                        <Button variant="ghost" size="sm" onClick={() => handleUpdateBanner('none')} className="h-6 text-[10px] font-bold text-red-500 dark:text-red-400 px-2">{t('profile:actions.reset')}</Button>
                      )}
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {BANNER_COLORS.map((color) => (
                        <button key={color} onClick={() => handleUpdateBanner(color)} className={cn(
                          "w-9 h-9 rounded-lg border-2 transition-[transform,box-shadow] duration-150 active:scale-[0.96] shadow-sm",
                          color === 'none' ? "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 flex items-center justify-center" : "border-white/50 dark:border-black/20",
                          (user?.avatar_config?.bannerColor === color || (!user?.avatar_config?.bannerColor && color === 'none')) && "ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-[#0d1426] border-indigo-500"
                        )} style={color !== 'none' ? { backgroundColor: color } : {}}>
                          {color === 'none' && <X className="w-3.5 h-3.5 text-slate-400" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* ── Right Content ────────────────────────────────────────── */}
        <div className="lg:col-span-8 space-y-6">

          {/* Achievements */}
          <div className="corp-panel rounded-[2.5rem] p-6 md:p-8">
            <span className="corp-eyebrow">{t('profile:sections.my_achievements')}</span>
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              {STATS.map((stat) => {
                const value = user[stat.key] || 0;
                return (
                  <ProfileStatCard key={stat.key} value={value} labelKey={stat.labelKey} lottieSrc={stat.lottieSrc} t={t} />
                );
              })}
            </div>
          </div>

          {/* Personal info */}
          <div className="corp-panel rounded-[2.5rem] p-6 md:p-8">
            <span className="corp-eyebrow">{t('profile:sections.personal_info')}</span>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { icon: UserCircle, label: t('auth:fields.name.label'), value: user.name },
                { icon: AtSign, label: t('profile:fields.nickname'), value: user.username ? `@${user.username}` : t('common:status.not_configured') },
                { icon: Mail, label: t('auth:fields.email.label'), value: user.email },
                { icon: Shield, label: t('profile:fields.user_type'), value: t(`common:user_types.${user.user_type}`, { defaultValue: user.user_type }) },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                  <div className="corp-icon-chip w-10 h-10 shrink-0">
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div className="overflow-hidden min-w-0">
                    <p className="corp-label mb-0.5">{item.label}</p>
                    <p className="corp-h4 truncate">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Social Hub */}
          <div className="corp-panel rounded-[2.5rem] overflow-hidden flex flex-col min-h-[500px]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10">
              <span className="corp-eyebrow">{t('profile:sections.social')}</span>
              <div className="flex items-center gap-2">
                {requests.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                )}
                <button
                  onClick={() => { setIsSearchDialogOpen(true); setActiveSocialTab("search"); }}
                  className="corp-btn-primary h-8 px-4 rounded-full text-[11px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  {t('profile:social.search')}
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-white/10 shrink-0">
              {[
                { id: "following" as const, label: t('profile:tabs.friends'), icon: Users },
                { id: "followers" as const, label: t('profile:social.followers'), icon: UserCircle },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSocialTab(tab.id)}
                  className={cn(
                    "flex-1 px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider transition-[background-color,color] duration-150 relative flex items-center justify-center gap-1.5 active:scale-[0.97]",
                    activeSocialTab === tab.id
                      ? "text-indigo-600 dark:text-indigo-300"
                      : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
                  )}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                  {activeSocialTab === tab.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full animate-content-enter" />
                  )}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Requests */}
              {requests.length > 0 && (
                <div className="mb-5 p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 animate-in fade-in slide-in-from-top-3 duration-300">
                  <span className="corp-eyebrow mb-3 block">{t('profile:tabs.requests')} ({requests.length})</span>
                  <div className="space-y-2.5">
                    {requests.map(req => (
                      <div key={req.public_id} className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-[#0d1426] border border-slate-200 dark:border-white/10">
                        <div className="flex items-center gap-3 min-w-0">
                          <AvatarDisplay config={req.avatar_config} size={32} showCTA={false} />
                          <div className="min-w-0">
                            <p className="corp-caption truncate font-semibold">{req.name || `@${req.username}`}</p>
                            <p className="corp-caption">{t('profile:social.want_to_connect')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button size="sm" className="corp-btn-primary h-7 rounded-full font-semibold px-3 text-[10px]" onClick={() => handleAccept(req.username)}>{t('profile:social.accept')}</Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10" onClick={() => handleReject(req.username)}><X className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeSocialTab === "following" && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <UserConnectionsList users={following} emptyMessage={t('profile:social.empty_following')} />
                </div>
              )}
              {activeSocialTab === "followers" && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <UserConnectionsList users={followers} emptyMessage={t('profile:social.empty_followers')} />
                </div>
              )}
              {activeSocialTab === "search" && (
                <div className="space-y-5 animate-in fade-in zoom-in-95 duration-300 h-full flex flex-col">
                  <div className="flex items-center justify-between">
                    <h2 className="corp-h4">{t('profile:tabs.search')}</h2>
                    <Button variant="ghost" size="icon" onClick={() => setActiveSocialTab("following")} className="rounded-full h-8 w-8"><ArrowLeft className="w-4 h-4 text-slate-400" /></Button>
                  </div>
                  <form onSubmit={handleSearch} className="relative shrink-0 flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t('profile:sections.search_placeholder')} className="corp-input h-10 pl-10 text-sm rounded-xl" autoFocus />
                    </div>
                    <Button type="submit" disabled={isSocialLoading || !searchQuery} className="corp-btn-primary h-10 w-10 rounded-xl p-0 inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
                      {isSocialLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    </Button>
                  </form>
                  <div className="flex-1">
                    {searchResults.length > 0 ? (
                      <div className="animate-in fade-in slide-in-from-bottom-3 duration-300"><UserConnectionsList users={searchResults} /></div>
                    ) : searchQuery && !isSocialLoading ? (
                      <div className="corp-empty py-16 animate-in zoom-in-95 duration-300">
                        <p className="corp-body-sm">{t('profile:sections.no_results')}</p>
                      </div>
                    ) : !searchQuery && !isSocialLoading && (
                      <div className="flex flex-col items-center py-16 text-center">
                        <Search className="w-10 h-10 mb-3 text-slate-300 dark:text-white/10" />
                        <p className="corp-eyebrow">{t('profile:sections.find_friends')}</p>
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

    {/* Mobile Search Dialog */}
    <Dialog open={isSearchDialogOpen} onOpenChange={setIsSearchDialogOpen}>
      <DialogContent className="corp-dialog rounded-3xl p-0 overflow-hidden max-w-sm mx-auto">
        <div className="p-8 space-y-6">
          <DialogHeader>
            <DialogTitle className="corp-h3 text-center">{t('profile:actions.add_friends')}</DialogTitle>
            <DialogDescription className="text-center corp-body-sm">{t('profile:actions.add_friends_desc')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t('profile:sections.search_placeholder')} className="corp-input h-10 pl-10 text-sm rounded-xl" />
            </div>
            <Button type="submit" disabled={isSocialLoading || !searchQuery} className="corp-btn-primary h-10 w-10 rounded-xl p-0 inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">{isSocialLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-5 h-5" />}</Button>
          </form>
          <div className="min-h-[250px] max-h-[350px] overflow-y-auto">
            {isSocialLoading ? <div className="flex justify-center items-center h-[200px]"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div> : <div className="animate-in fade-in slide-in-from-bottom-3 duration-300"><UserConnectionsList users={searchResults} emptyMessage={t('profile:sections.no_results')} /></div>}
          </div>
          <div className="pt-5 border-t border-slate-200 dark:border-white/10">
            <button onClick={handleShare} className="corp-btn-primary w-full h-11 rounded-full text-sm font-semibold uppercase tracking-wider inline-flex items-center justify-center gap-2">
              <Globe className="w-4 h-4" />
              {t('profile:actions.share_profile')}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default Profile;
