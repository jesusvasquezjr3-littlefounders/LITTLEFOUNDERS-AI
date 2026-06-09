import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AvatarDisplay } from "@/components/avatar/AvatarDisplay";
import { Trophy, Star, Flame, Loader2, ArrowLeft } from "lucide-react";
import { socialApi, UserPublicProfile } from "../../lib/api/social";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export default function UserProfile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation(['profile', 'common']);
  
  const [profile, setProfile] = useState<UserPublicProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    if (username) {
      loadProfile(username);
    }
  }, [username]);

  const loadProfile = async (user_name: string) => {
    setIsLoading(true);
    try {
      const data = await socialApi.getUserProfile(user_name);
      setProfile(data);
    } catch (error) {
      toast({ 
        title: t('common:status.error'), 
        description: t('profile:messages.user_not_found'), 
        variant: "destructive" 
      });
      navigate("/dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFollowAction = async () => {
    if (!profile) return;
    setIsActionLoading(true);
    try {
      if (profile.follow_status === "accepted" || profile.follow_status === "pending") {
        await socialApi.unfollowUser(profile.username);
        toast({ title: t('profile:messages.unfollow_success', { name: profile.name || profile.username }) });
        setProfile({ ...profile, follow_status: "none", is_following: false });
      } else {
        const response = await socialApi.followUser(profile.username);
        toast({ title: response.message });
        setProfile({ 
          ...profile, 
          follow_status: response.status, 
          is_following: response.status === "accepted" 
        });
      }
    } catch (error) {
      toast({ 
        title: t('common:status.error'), 
        description: t('profile:messages.action_error'), 
        variant: "destructive" 
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  const renderFollowButton = () => {
    if (!profile) return null;
    
    const currentUserRaw = localStorage.getItem('user');
    if (currentUserRaw) {
      try {
        const cu = JSON.parse(currentUserRaw);
        if (cu.username === profile.username) return null;
      } catch(e) {}
    }

    if (profile.follow_status === "pending") {
      return (
        <Button onClick={handleFollowAction} disabled={isActionLoading} variant="outline" className="rounded-full px-8 font-bold border-violet-200 text-violet-600 hover:bg-violet-50 bg-white">
          {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('profile:social.pending')}
        </Button>
      );
    }
    
    if (profile.is_following) {
      return (
        <Button onClick={handleFollowAction} disabled={isActionLoading} variant="outline" className="rounded-full px-8 font-bold border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 bg-white shadow-sm">
          {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('profile:social.following')}
        </Button>
      );
    }

    return (
      <Button onClick={handleFollowAction} disabled={isActionLoading} className="rounded-full px-8 font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/30">
        {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('profile:social.follow')}
      </Button>
    );
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-[50vh]">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
        </div>
      </DashboardLayout>
    );
  }

  if (!profile) return null;

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500 pb-10">
        
        <Button variant="ghost" className="mb-2 -ml-2 text-slate-500 hover:text-slate-800" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> {t('common:buttons.back')}
        </Button>

        {/* Premium Header Profile Card */}
        <div className="relative rounded-3xl p-6 md:p-10 liquid-glass-strong overflow-hidden border border-blue-500/10 dark:border-blue-500/5 shadow-2xl transition-all duration-500 group">
          {/* Ambient Glows */}
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-gradient-to-br from-blue-500/15 to-purple-600/15 rounded-full blur-3xl pointer-events-none group-hover:scale-110 transition-transform duration-1000" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-gradient-to-tr from-cyan-500/10 to-blue-600/10 rounded-full blur-3xl pointer-events-none group-hover:scale-110 transition-transform duration-1000" />
          
          <div className="relative flex flex-col md:flex-row items-center gap-8 z-10 w-full text-center md:text-left">
            <div className="relative flex-shrink-0">
               <div className="absolute -inset-4 bg-blue-400/20 dark:bg-blue-600/20 rounded-full blur-2xl opacity-40 group-hover:opacity-60 transition-opacity"></div>
               <AvatarDisplay config={profile.avatar_config} size={140} showCTA={false} />
            </div>

            <div className="flex-1 space-y-5">
              <div>
                <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                  <span className="text-[10px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-widest leading-none">{t('common:app_name')}</span>
                </div>
                <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight uppercase md:normal-case leading-tight">
                  {profile.name || `@${profile.username}`}
                </h1>
                <p className="text-lg text-slate-500 dark:text-slate-400 font-bold md:font-medium mt-1">
                  @{profile.username}
                </p>
              </div>

              <div className="flex justify-center md:justify-start items-center gap-8 text-sm font-black md:font-semibold text-slate-600 dark:text-slate-300">
                <div className="flex flex-col items-center md:items-start group/stat">
                  <span className="text-2xl font-black text-slate-900 dark:text-white leading-none mb-1 group-hover/stat:text-blue-500 transition-colors">{profile.following_count}</span>
                  <span className="text-[10px] uppercase tracking-widest opacity-60">{t('profile:social.following')}</span>
                </div>
                <div className="w-px h-10 bg-slate-200 dark:bg-slate-700/50"></div>
                <div className="flex flex-col items-center md:items-start group/stat">
                  <span className="text-2xl font-black text-slate-900 dark:text-white leading-none mb-1 group-hover/stat:text-blue-500 transition-colors">{profile.followers_count}</span>
                  <span className="text-[10px] uppercase tracking-widest opacity-60">{t('profile:social.followers')}</span>
                </div>
              </div>

              <div className="pt-2 flex justify-center md:justify-start">
                 {renderFollowButton()}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <h3 className="text-xl font-bold text-slate-800 dark:text-white px-2 mt-8 mb-4">{t('profile:sections.learning_stats')}</h3>
        <div className="grid grid-cols-3 gap-4">
          <Card className={cn("border-0 shadow-lg bg-violet-50 dark:bg-violet-950/20 transition-all", profile.current_streak === 0 && "grayscale opacity-60")}>
            <CardContent className="p-6 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-violet-100 dark:bg-violet-900/50 rounded-2xl flex items-center justify-center mb-3 text-violet-600">
                <Flame className="w-6 h-6" />
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-white">{profile.current_streak}</p>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-widest mt-1">{t('common:dashboard.stats.streak')}</p>
            </CardContent>
          </Card>
          
          <Card className={cn("border-0 shadow-lg bg-indigo-50 dark:bg-indigo-950/20 transition-all", profile.points_earned === 0 && "grayscale opacity-60")}>
            <CardContent className="p-6 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/50 rounded-2xl flex items-center justify-center mb-3 text-indigo-600">
                <Star className="w-6 h-6" />
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-white">{profile.points_earned}</p>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-widest mt-1">{t('common:dashboard.stats.points')}</p>
            </CardContent>
          </Card>
          
          <Card className={cn("border-0 shadow-lg bg-emerald-50 dark:bg-emerald-950/20 transition-all", profile.lessons_completed === 0 && "grayscale opacity-60")}>
            <CardContent className="p-6 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/50 rounded-2xl flex items-center justify-center mb-3 text-emerald-600">
                <Trophy className="w-6 h-6" />
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-white">{profile.lessons_completed}</p>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-widest mt-1">{t('common:dashboard.stats.lessons')}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
