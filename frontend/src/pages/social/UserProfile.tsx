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
        <Button onClick={handleFollowAction} disabled={isActionLoading} className="corp-btn-secondary h-10 rounded-full px-8 text-sm font-semibold inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
          {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('profile:social.pending')}
        </Button>
      );
    }

    if (profile.is_following) {
      return (
        <Button onClick={handleFollowAction} disabled={isActionLoading} className="corp-btn-secondary h-10 rounded-full px-8 text-sm font-semibold inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
          {isActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('profile:social.following')}
        </Button>
      );
    }

    return (
      <Button onClick={handleFollowAction} disabled={isActionLoading} className="corp-btn-primary h-10 rounded-full px-8 text-sm font-semibold inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed">
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
      <div className="corp max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500 pb-10">

        <Button variant="ghost" className="mb-2 -ml-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> {t('common:buttons.back')}
        </Button>

        {/* Header Profile Card */}
        <div className="corp-card rounded-3xl p-6 md:p-10">
          <div className="flex flex-col md:flex-row items-center gap-8 w-full text-center md:text-left">
            <div className="flex-shrink-0">
               <AvatarDisplay config={profile.avatar_config} size={140} showCTA={false} />
            </div>

            <div className="flex-1 space-y-5">
              <div>
                <h1 className="corp-display text-3xl md:text-4xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
                  {profile.name || `@${profile.username}`}
                </h1>
                <p className="corp-subtitle mt-1">
                  @{profile.username}
                </p>
              </div>

              <div className="flex justify-center md:justify-start items-center gap-8 text-sm font-semibold text-slate-600 dark:text-slate-300">
                <div className="flex flex-col items-center md:items-start">
                  <span className="corp-number-lg">{profile.following_count}</span>
                  <span className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('profile:social.following')}</span>
                </div>
                <div className="w-px h-10 bg-slate-200 dark:bg-white/10"></div>
                <div className="flex flex-col items-center md:items-start">
                  <span className="corp-number-lg">{profile.followers_count}</span>
                  <span className="text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400">{t('profile:social.followers')}</span>
                </div>
              </div>

              <div className="pt-2 flex justify-center md:justify-start">
                 {renderFollowButton()}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <h3 className="corp-h4 px-2 mt-8 mb-4">{t('profile:sections.learning_stats')}</h3>
        <div className="grid grid-cols-3 gap-4">
          <Card className={cn("corp-card bg-violet-50 dark:bg-violet-950/20", profile.current_streak === 0 && "grayscale opacity-60")}>
            <CardContent className="p-6 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-violet-100 dark:bg-violet-900/50 rounded-2xl flex items-center justify-center mb-3 text-violet-600 dark:text-violet-300">
                <Flame className="w-6 h-6" />
              </div>
              <p className="corp-number-lg">{profile.current_streak}</p>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">{t('common:dashboard.stats.streak')}</p>
            </CardContent>
          </Card>

          <Card className={cn("corp-card bg-indigo-50 dark:bg-indigo-950/20", profile.points_earned === 0 && "grayscale opacity-60")}>
            <CardContent className="p-6 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/50 rounded-2xl flex items-center justify-center mb-3 text-indigo-600 dark:text-indigo-300">
                <Star className="w-6 h-6" />
              </div>
              <p className="corp-number-lg">{profile.points_earned}</p>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">{t('common:dashboard.stats.points')}</p>
            </CardContent>
          </Card>

          <Card className={cn("corp-card bg-emerald-50 dark:bg-emerald-950/20", profile.lessons_completed === 0 && "grayscale opacity-60")}>
            <CardContent className="p-6 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/50 rounded-2xl flex items-center justify-center mb-3 text-emerald-600 dark:text-emerald-300">
                <Trophy className="w-6 h-6" />
              </div>
              <p className="corp-number-lg">{profile.lessons_completed}</p>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">{t('common:dashboard.stats.lessons')}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
