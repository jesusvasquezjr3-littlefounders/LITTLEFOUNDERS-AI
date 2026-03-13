import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AvatarDisplay } from "@/components/avatar/AvatarDisplay";
import { Settings, User, Trophy, Flame, Star, Mail, Calendar, Shield, Palette, Check, Loader2, BookOpen, Clock, Globe, AtSign, UserCircle, ArrowLeft, Users, UserPlus, Search, X } from "lucide-react";
import { socialApi, UserPublicProfile, FollowRequest } from "@/lib/api/social";
import { UserConnectionsList } from "@/components/social/UserConnectionsList";
import { Input } from "@/components/ui/input";
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
  const [activeSocialTab, setActiveSocialTab] = useState("following");
  const [searchQuery, setSearchQuery] = useState("");
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

  // Dashboard stats
  const lessonsCompleted = user.lessons_completed || 0;
  const minutesStudied = user.minutes_studied || 0;
  const pointsEarned = user.points_earned || 0;
  const currentStreak = user.current_streak || 0;

  // User type display mapping
  const getUserTypeLabel = (type: string) => {
    const key = `common:user_types.${type}`;
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
    } finally {
      setIsUpdatingBanner(false);
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

        {/* Header Section - Full Width */}
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
              <div className="flex items-center justify-center md:justify-start gap-4">
                {user.user_type === 'child' && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-500" />
                    {t('common:roles.little_founder')}
                  </p>
                )}
                <div className="hidden md:flex items-center gap-3 text-sm font-bold text-slate-600 dark:text-slate-300">
                  {/* Stats removed from header as per request, but kept hidden optionally if needed later */}
                </div>
              </div>
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

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Learning & Info (Desktop: 7/12) */}
          <div className="lg:col-span-7 space-y-8 order-1 lg:order-1">
            
            {/* Learning Stats */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 px-2">
                 <Trophy className="w-5 h-5 text-yellow-500" />
                 <h3 className="text-xl font-bold text-slate-800 dark:text-white uppercase tracking-wider text-sm">{t('profile:sections.my_achievements')}</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="flex flex-col items-center p-4 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm transition-transform hover:scale-[1.02]">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mb-2">
                    <BookOpen className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-2xl font-black text-slate-900 dark:text-white">{lessonsCompleted}</span>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider text-center">{t('common:dashboard.stats.lessons')}</span>
                </div>
                
                <div className="flex flex-col items-center p-4 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm transition-transform hover:scale-[1.02]">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mb-2">
                    <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-2xl font-black text-slate-900 dark:text-white">{minutesStudied}</span>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider text-center">{t('common:dashboard.stats.minutes')}</span>
                </div>

                <div className="flex flex-col items-center p-4 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm transition-transform hover:scale-[1.02]">
                  <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-2xl flex items-center justify-center mb-2">
                    <Star className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                  </div>
                  <span className="text-2xl font-black text-slate-900 dark:text-white">{pointsEarned}</span>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider text-center">{t('common:dashboard.stats.points')}</span>
                </div>

                <div className="flex flex-col items-center p-4 bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm transition-transform hover:scale-[1.02]">
                  <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-2xl flex items-center justify-center mb-2">
                    <Flame className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <span className="text-2xl font-black text-slate-900 dark:text-white">{currentStreak}</span>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider text-center">{t('common:dashboard.stats.streak')}</span>
                </div>
              </div>
            </section>

            {/* Account Info */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 px-2">
                 <User className="w-5 h-5 text-purple-500" />
                 <h3 className="text-xl font-bold text-slate-800 dark:text-white uppercase tracking-wider text-sm">{t('profile:sections.personal_info')}</h3>
              </div>
              <Card className="border border-slate-100 dark:border-slate-700 shadow-sm bg-white dark:bg-slate-800 rounded-3xl overflow-hidden">
                <CardContent className="p-2 space-y-1">
                  <div className="flex items-center gap-4 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                      <UserCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t('auth:fields.name.label')}</p>
                      <p className="text-base font-bold text-slate-900 dark:text-white truncate">{user.name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                      <AtSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t('profile:fields.nickname')}</p>
                      <p className="text-base font-bold text-slate-900 dark:text-white truncate">
                        {user.username ? `@${user.username}` : <span className="text-slate-400 italic">{t('common:status.not_configured')}</span>}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                      <Mail className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t('auth:fields.email.label')}</p>
                      <p className="text-base font-bold text-slate-900 dark:text-white truncate" title={user.email}>
                        {user.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                      <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t('profile:fields.user_type')}</p>
                      <p className="text-base font-bold text-slate-900 dark:text-white truncate">
                        {getUserTypeLabel(user.user_type)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
          </div>

          {/* Right Column: Social Hub (Desktop: 5/12) */}
          <div className="lg:col-span-5 space-y-6 order-2 lg:order-2">
            <div className="space-y-6 lg:sticky lg:top-8">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  <h3 className="text-xl font-bold text-slate-800 dark:text-white uppercase tracking-wider text-sm">{t('profile:sections.social')}</h3>
                </div>
                
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-blue-600 font-bold hover:bg-blue-50 rounded-xl gap-2 h-8 px-3"
                  onClick={() => setActiveSocialTab("search")}
                >
                  <UserPlus className="w-4 h-4" />
                  {t('profile:social.search')}
                </Button>
              </div>
              
              <div className="bg-white dark:bg-slate-800/50 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden min-h-[300px] lg:min-h-[500px] flex flex-col">
                {/* Custom Tab Switcher */}
                <div className="flex border-b border-slate-100 dark:border-slate-700 px-6 shrink-0">
                  {[
                    { id: "following", label: t('profile:tabs.friends') },
                    { id: "followers", label: t('profile:social.followers') },
                    { id: "search", label: t('profile:social.search'), hide: true }
                  ].filter(t => !t.hide).map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveSocialTab(tab.id)}
                      className={cn(
                        "px-4 py-4 text-xs font-black uppercase tracking-widest transition-all relative",
                        activeSocialTab === tab.id 
                          ? "text-blue-600" 
                          : "text-slate-400 hover:text-slate-600"
                      )}
                    >
                      {tab.label}
                      {activeSocialTab === tab.id && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t-full" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
                  {/* Pending Requests Notification */}
                  {requests.length > 0 && activeSocialTab !== "search" && (
                    <div className="m-2 p-4 rounded-2xl bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/20 animate-in slide-in-from-top duration-500">
                      <h4 className="text-[10px] font-black text-orange-700 dark:text-orange-400 uppercase tracking-widest mb-3">
                        {t('profile:tabs.requests')} ({requests.length})
                      </h4>
                      <div className="space-y-2">
                        {requests.map(req => (
                          <div key={req.public_id} className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-orange-50 dark:border-orange-900/20 group">
                            <div className="flex items-center gap-3">
                              <AvatarDisplay config={req.avatar_config} size={32} />
                              <h4 className="font-bold text-slate-800 dark:text-white truncate text-xs">
                                {req.name || `@${req.username}`}
                              </h4>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="ghost" className="h-7 rounded-lg text-green-600 hover:bg-green-50 font-bold px-2 text-[10px]" onClick={() => handleAccept(req.username)}>
                                 {t('profile:social.accept')}
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg text-slate-300 hover:bg-slate-50 transition-colors" onClick={() => handleReject(req.username)}>
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Views */}
                  {activeSocialTab === "following" && (
                    <UserConnectionsList users={following} emptyMessage={t('profile:social.empty_following')} />
                  )}

                  {activeSocialTab === "followers" && (
                    <UserConnectionsList users={followers} emptyMessage={t('profile:social.empty_followers')} />
                  )}

                  {activeSocialTab === "search" && (
                    <div className="p-4 space-y-6 animate-in fade-in zoom-in-95 duration-300 h-full flex flex-col">
                      <div className="flex items-center justify-between">
                        <h2 className="text-xl font-black text-slate-900 dark:text-white">{t('profile:tabs.search')}</h2>
                        <Button variant="ghost" size="icon" onClick={() => setActiveSocialTab("following")} className="rounded-full h-8 w-8 hover:bg-slate-100">
                          <ArrowLeft className="w-4 h-4 text-slate-400" />
                        </Button>
                      </div>

                      <form onSubmit={handleSearch} className="relative group shrink-0 flex gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                          <Input 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t('profile:sections.search_placeholder')}
                            className="pl-12 h-14 rounded-2xl bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus-visible:ring-0 focus-visible:border-blue-500 transition-all font-bold placeholder:font-medium"
                            autoFocus
                          />
                        </div>
                        <Button 
                          type="submit" 
                          disabled={isSocialLoading || !searchQuery} 
                          className="h-14 px-8 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
                        >
                          {isSocialLoading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            t('profile:social.search')
                          )}
                        </Button>
                      </form>

                      <div className="flex-1 mt-2">
                        {searchResults.length > 0 ? (
                          <UserConnectionsList users={searchResults} />
                        ) : searchQuery && !isSocialLoading && (
                          <div className="text-center py-20 space-y-4">
                            <div className="w-20 h-20 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto ring-4 ring-slate-100 dark:ring-slate-800">
                              <Search className="w-8 h-8 text-slate-300" />
                            </div>
                            <p className="text-slate-500 font-bold">{t('profile:sections.no_results')}</p>
                          </div>
                        )}
                        {!searchQuery && !isSocialLoading && (
                           <div className="text-center py-20 opacity-30 select-none grayscale">
                             <UserPlus className="w-16 h-16 mx-auto mb-4" />
                             <p className="text-sm font-black uppercase tracking-widest">Encuentra a tus amigos</p>
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
    </DashboardLayout>
  );
};

export default Profile;
