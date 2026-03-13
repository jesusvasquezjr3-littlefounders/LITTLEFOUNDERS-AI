import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AvatarDisplay } from "@/components/avatar/AvatarDisplay";
import { Trophy, Star, Flame, MapPin, Loader2, Users, ArrowLeft } from "lucide-react";
import { socialApi, UserPublicProfile } from "@/lib/api/social";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "react-i18next";

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
        <Button onClick={handleFollowAction} disabled={isActionLoading} variant="outline" className="rounded-full px-8 font-bold border-orange-200 text-orange-600 hover:bg-orange-50 bg-white">
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

        {/* Header Profile Card */}
        <div className="relative bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden text-center md:text-left flex flex-col md:flex-row items-center gap-8 group">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          
          <div className="relative flex-shrink-0 z-10">
             <div className="absolute -inset-4 bg-blue-100 dark:bg-blue-900/30 rounded-full blur-xl opacity-50"></div>
             <AvatarDisplay config={profile.avatar_config} size={140} showCTA={false} />
          </div>

          <div className="flex-1 space-y-4 z-10 w-full">
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
                {profile.name || `@${profile.username}`}
              </h1>
              <p className="text-lg text-slate-500 dark:text-slate-400 font-medium mt-1">
                @{profile.username}
              </p>
            </div>

            <div className="flex justify-center md:justify-start items-center gap-6 text-sm font-semibold text-slate-600 dark:text-slate-300">
              <div className="flex flex-col items-center">
                <span className="text-xl font-bold text-slate-900 dark:text-white">{profile.following_count}</span>
                <span className="opacity-70">{t('profile:social.following')}</span>
              </div>
              <div className="w-px h-8 bg-slate-200 dark:bg-slate-700"></div>
              <div className="flex flex-col items-center">
                <span className="text-xl font-bold text-slate-900 dark:text-white">{profile.followers_count}</span>
                <span className="opacity-70">{t('profile:social.followers')}</span>
              </div>
            </div>

            <div className="pt-2 flex justify-center md:justify-start">
               {renderFollowButton()}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <h3 className="text-xl font-bold text-slate-800 dark:text-white px-2 mt-8 mb-4">{t('profile:sections.learning_stats')}</h3>
        <div className="grid grid-cols-3 gap-4">
          <Card className="border-0 shadow-lg bg-orange-50 dark:bg-orange-950/20">
            <CardContent className="p-6 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/50 rounded-2xl flex items-center justify-center mb-3 text-orange-600">
                <Flame className="w-6 h-6" />
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-white">{profile.current_streak}</p>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-widest mt-1">{t('common:dashboard.stats.streak')}</p>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-lg bg-yellow-50 dark:bg-yellow-950/20">
            <CardContent className="p-6 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/50 rounded-2xl flex items-center justify-center mb-3 text-yellow-600">
                <Star className="w-6 h-6" />
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-white">{profile.points_earned}</p>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-widest mt-1">{t('common:dashboard.stats.points')}</p>
            </CardContent>
          </Card>
          
          <Card className="border-0 shadow-lg bg-emerald-50 dark:bg-emerald-950/20">
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
