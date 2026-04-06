import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminStats } from '@/hooks/useAdminStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BookOpen, Zap, Users, Volume2, TrendingUp, RefreshCw, Shield, Plus, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { AdminContributionGraph } from '@/components/admin/AdminContributionGraph';
import { AdminActivityChart } from '@/components/admin/AdminActivityChart';

interface RecentEdit {
  id: string;
  editor_user_id: string;
  editor_name: string;
  entity_type: string;
  entity_id: string;
  action: string;
  field_changed: string;
  created_at: string;
  metadata: Record<string, unknown>;
}

interface DashboardStats {
  total_lessons: number;
  total_exercises: number;
  total_characters: number;
  total_audio_segments: number;
  lessons_by_adventure: Record<string, number>;
  recent_edits: RecentEdit[];
  daily_activity: any[];
}

export const AdminDashboard: React.FC = () => {
  const { t } = useTranslation(['admin', 'adventures']);
  const { data: stats, isLoading, error, refetch } = useAdminStats();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900 dark:text-red-100">
          <p className="font-semibold">{t('dashboard.errorLoading')}</p>
          <p className="text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  const typedStats = stats as DashboardStats | undefined;

  return (
    <div className="space-y-8 p-8">
      {/* Premium Admin Header */}
      <div className="relative rounded-3xl overflow-hidden liquid-glass-strong px-5 py-5 md:px-7 md:py-6 flex flex-col md:flex-row items-center justify-between gap-5 border border-indigo-500/10 dark:border-indigo-500/5 shadow-2xl">
          {/* Ambient Glows */}
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-gradient-to-br from-indigo-500/15 to-purple-600/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-gradient-to-tr from-blue-500/10 to-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-row items-center gap-4 md:gap-5 relative z-10">
              <div className="p-2 md:p-3 bg-gradient-to-br from-indigo-500 via-purple-500 to-blue-600 rounded-xl md:rounded-[1.25rem] shadow-xl shadow-indigo-500/25 transform -rotate-3 transition-transform hover:rotate-0 duration-300 shrink-0">
                  <Shield className="w-5 h-5 md:w-7 md:h-7 text-white" />
              </div>
              <div className="text-left">
                  <div className="flex items-center gap-2 mb-0.5">
                      {/* Branding removed as per user request */}
                  </div>
                  <h1 className="text-xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase md:normal-case leading-tight mb-1">
                      {t('dashboard.title')}
                  </h1>
                  <p className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400 font-bold md:font-medium leading-tight">
                      {t('dashboard.subtitle')}
                  </p>
              </div>
          </div>

          <Button
              onClick={handleRefresh}
              disabled={refreshing}
              variant="outline"
              size="sm"
              className="relative z-10 w-full md:w-auto h-11 px-6 rounded-xl md:rounded-full bg-white/50 dark:bg-black/20 backdrop-blur-md border hover:bg-white/80 dark:hover:bg-black/40 transition-all shadow-sm font-bold text-slate-700 dark:text-slate-200 gap-2"
          >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              {refreshing ? t('dashboard.refreshing') : t('dashboard.refresh')}
          </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Lessons */}
        <GlassPanel variant="subtle" className="p-0 border-blue-500/10 hover:border-blue-500/30 transition-all group/card overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover/card:bg-blue-500/10 transition-colors" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('dashboard.totalLessons')}</CardTitle>
            <div className="p-2 bg-blue-500/10 rounded-lg group-hover/card:scale-110 transition-transform">
              <BookOpen className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-3xl font-black text-slate-900 dark:text-white mb-1">
                  {typedStats?.total_lessons || 0}
                </div>
                <Link to="/admin/lessons">
                  <p className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1">
                    {t('dashboard.viewAll')} <TrendingUp className="w-3 h-3" />
                  </p>
                </Link>
              </>
            )}
          </CardContent>
        </GlassPanel>

        {/* Total Exercises */}
        <GlassPanel variant="subtle" className="p-0 border-amber-500/10 hover:border-amber-500/30 transition-all group/card overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover/card:bg-amber-500/10 transition-colors" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('dashboard.totalExercises')}</CardTitle>
            <div className="p-2 bg-amber-500/10 rounded-lg group-hover/card:scale-110 transition-transform">
              <Zap className="h-4 w-4 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-3xl font-black text-slate-900 dark:text-white">
                {typedStats?.total_exercises || 0}
              </div>
            )}
          </CardContent>
        </GlassPanel>

        {/* Total Characters */}
        <GlassPanel variant="subtle" className="p-0 border-green-500/10 hover:border-green-500/30 transition-all group/card overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover/card:bg-green-500/10 transition-colors" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('dashboard.totalCharacters')}</CardTitle>
            <div className="p-2 bg-green-500/10 rounded-lg group-hover/card:scale-110 transition-transform">
              <Users className="h-4 w-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <Link to="/admin/characters">
                <div className="text-3xl font-black text-slate-900 dark:text-white cursor-pointer hover:text-green-600 dark:hover:text-green-400 transition-colors">
                  {typedStats?.total_characters || 0}
                </div>
              </Link>
            )}
          </CardContent>
        </GlassPanel>

        {/* Total Audio Segments */}
        <GlassPanel variant="subtle" className="p-0 border-purple-500/10 hover:border-purple-500/30 transition-all group/card overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover/card:bg-purple-500/10 transition-colors" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('dashboard.audioSegments')}</CardTitle>
            <div className="p-2 bg-purple-500/10 rounded-lg group-hover/card:scale-110 transition-transform">
              <Volume2 className="h-4 w-4 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <Link to="/admin/audio">
                <div className="text-3xl font-black text-slate-900 dark:text-white cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
                  {typedStats?.total_audio_segments || 0}
                </div>
              </Link>
            )}
          </CardContent>
        </GlassPanel>
      </div>



      {/* Activity Charts */}
      {typedStats?.daily_activity && (
        <div className="space-y-6">
          <AdminActivityChart data={typedStats.daily_activity} />
          <AdminContributionGraph data={typedStats.daily_activity} />
        </div>
      )}

      {/* Lessons by Adventure Level */}
      <GlassPanel variant="subtle" className="p-7">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-indigo-500/10 rounded-lg">
            <TrendingUp className="h-5 w-5 text-indigo-500" />
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
            {t('dashboard.lessonsByAdventure')}
          </h2>
        </div>
        
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {typedStats?.lessons_by_adventure && Object.entries(typedStats.lessons_by_adventure)
              .sort(([a], [b]) => parseInt(a) - parseInt(b))
              .map(([level, count]) => (
                <div key={level} className="flex items-center gap-4 group/item">
                  <div className="w-1/3 min-w-[120px] text-xs font-black text-slate-600 dark:text-slate-400 truncate uppercase tracking-wider" title={t(`adventures:list.${level}.title`)}>
                    {t(`adventures:list.${level}.title`)}
                  </div>
                  <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-800/50 rounded-full overflow-hidden relative">
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-1000 ease-out flex items-center justify-end pr-2 group-hover/item:shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                      style={{
                        width: `${Math.max(4, (count / (typedStats.total_lessons || 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  <div className="w-10 text-right text-sm font-black text-slate-900 dark:text-white">{count}</div>
                </div>
              ))}
          </div>
        )}
      </GlassPanel>

      {/* Recent Edits Table */}
      <GlassPanel variant="subtle" className="p-0 overflow-hidden">
        <div className="p-7 flex items-center justify-between border-b border-black/5 dark:border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <RefreshCw className="h-5 w-5 text-purple-500" />
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
              {t('dashboard.recentEdits')}
            </h2>
          </div>
          <Link to="/admin/history">
            <Button variant="ghost" size="sm" className="font-bold text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-xl px-4 h-9">
              {t('dashboard.viewAllHistory')}
            </Button>
          </Link>
        </div>
        <div className="p-2 pt-0">
          {isLoading ? (
            <div className="space-y-3 p-5">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-2xl" />
              ))}
            </div>
          ) : typedStats?.recent_edits && typedStats.recent_edits.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-none hover:bg-transparent">
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-6">{t('dashboard.date')}</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('dashboard.editor')}</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('dashboard.entityType')}</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('dashboard.entityId')}</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-right pr-6">{t('dashboard.action')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {typedStats.recent_edits.slice(0, 10).map((edit) => (
                    <TableRow key={edit.id} className="border-black/5 dark:border-white/5 group/row hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <TableCell className="text-xs font-medium text-slate-500 dark:text-slate-400 pl-6">
                        {new Date(edit.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-sm font-black text-slate-900 dark:text-white">
                        {edit.editor_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-bold uppercase border-indigo-500/20 text-indigo-600 dark:text-indigo-400 bg-indigo-500/5">
                          {edit.entity_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-[10px] text-slate-400 group-hover/row:text-slate-600 dark:group-hover/row:text-slate-200 transition-colors">
                        {edit.entity_id}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Badge
                          variant={
                            edit.action === 'create'
                              ? 'default'
                              : edit.action === 'update'
                                ? 'secondary'
                                : 'destructive'
                          }
                          className={cn(
                            "text-[10px] font-black uppercase tracking-tighter rounded-lg",
                            edit.action === 'create' && "bg-green-500 hover:bg-green-600",
                            edit.action === 'update' && "bg-amber-500 hover:bg-amber-600 text-white border-none",
                            edit.action === 'delete' && "bg-red-500 hover:bg-red-600"
                          )}
                        >
                          {t(`admin:dashboard.actions.${edit.action}`)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-16 opacity-30 select-none grayscale">
              <RefreshCw className="w-12 h-12 mx-auto mb-4 text-slate-400" />
              <p className="text-xs font-black uppercase tracking-widest">{t('dashboard.noRecentEdits')}</p>
            </div>
          )}
        </div>
      </GlassPanel>

      {/* Quick Links */}
      <GlassPanel variant="subtle" className="p-7">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <Zap className="h-5 w-5 text-blue-500" />
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
            {t('dashboard.quickLinks')}
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { to: "/admin/lessons", icon: BookOpen, label: t('dashboard.manageLessons'), color: "blue" },
            { to: "/admin/lessons/new", icon: Plus, label: t('dashboard.createLesson'), color: "indigo" },
            { to: "/admin/characters", icon: Users, label: t('dashboard.manageCharacters'), color: "green" },
            { to: "/admin/audio", icon: Volume2, label: t('dashboard.audioLibrary'), color: "purple" },
            { to: "/admin/history", icon: RefreshCw, label: t('dashboard.editHistory'), color: "amber" },
            { to: "/admin/users", icon: Shield, label: t('dashboard.userManagement'), color: "rose" },
          ].map((link, idx) => (
            <Link key={idx} to={link.to}>
              <Button 
                variant="outline" 
                className={cn(
                  "w-full h-16 justify-between px-5 rounded-2xl border-black/5 dark:border-white/5 bg-white/40 dark:bg-black/20 hover:scale-[1.02] transition-all group active:scale-95",
                  `hover:border-${link.color}-500/30 hover:bg-${link.color}-50/50 dark:hover:bg-${link.color}-900/10`
                )}
              >
                <div className="flex items-center gap-4">
                  <div className={cn("p-2 rounded-xl transition-colors", `bg-${link.color}-500/10 text-${link.color}-500 group-hover:bg-${link.color}-500 group-hover:text-white shadow-sm`)}>
                    <link.icon className="h-4 w-4" />
                  </div>
                  <span className="font-black text-[10px] uppercase tracking-widest text-slate-700 dark:text-slate-200">
                    {link.label}
                  </span>
                </div>
                <ArrowLeft className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100 rotate-180 transition-all translate-x-2 group-hover:translate-x-0" />
              </Button>
            </Link>
          ))}
        </div>
      </GlassPanel>
    </div >
  );
};

export default AdminDashboard;
