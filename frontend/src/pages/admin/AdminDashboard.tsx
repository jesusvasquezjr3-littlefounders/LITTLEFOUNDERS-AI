import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminStats } from '@/hooks/useAdminStats';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BookOpen, Zap, Users, Volume2, TrendingUp, RefreshCw, Shield, Plus, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
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

// Static class map for quick-link accents (avoids dynamic Tailwind that breaks JIT scan)
const QUICK_LINK_STYLES: Record<string, { chip: string }> = {
  blue: { chip: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  indigo: { chip: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' },
  green: { chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  purple: { chip: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' },
  amber: { chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  rose: { chip: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
};

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
        <div className="rounded-xl bg-red-50 p-4 text-red-800 dark:bg-red-900 dark:text-red-100">
          <p className="font-semibold">{t('dashboard.errorLoading')}</p>
          <p className="text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  const typedStats = stats as DashboardStats | undefined;

  return (
    <div className="space-y-8 p-8">
      {/* Admin Header */}
      <div className="corp-panel p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-5">
        <div className="flex flex-row items-center gap-4 md:gap-5">
          <div className="corp-icon-chip w-12 h-12 shrink-0">
            <Shield className="w-6 h-6" />
          </div>
          <div className="text-left">
            <span className="corp-eyebrow">{t('dashboard.subtitle')}</span>
            <h1 className="corp-display mt-1 text-2xl md:text-3xl font-bold text-slate-900 dark:text-white leading-tight">
              {t('dashboard.title')}
            </h1>
          </div>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="corp-btn-secondary w-full md:w-auto h-11 px-6 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          {refreshing ? t('dashboard.refreshing') : t('dashboard.refresh')}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Lessons */}
        <div className="corp-card p-6">
          <div className="flex flex-row items-center justify-between gap-2">
            <p className="corp-eyebrow">{t('dashboard.totalLessons')}</p>
            <div className="corp-icon-chip w-9 h-9 shrink-0">
              <BookOpen className="h-4 w-4" />
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="mt-4 h-8 w-16" />
          ) : (
            <>
              <div className="mt-4 text-3xl font-bold text-slate-900 dark:text-white mb-1">
                {typedStats?.total_lessons || 0}
              </div>
              <Link to="/admin/lessons">
                <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 hover:underline cursor-pointer flex items-center gap-1">
                  {t('dashboard.viewAll')} <TrendingUp className="w-3 h-3" />
                </p>
              </Link>
            </>
          )}
        </div>

        {/* Total Exercises */}
        <div className="corp-card p-6">
          <div className="flex flex-row items-center justify-between gap-2">
            <p className="corp-eyebrow">{t('dashboard.totalExercises')}</p>
            <div className="corp-icon-chip w-9 h-9 shrink-0">
              <Zap className="h-4 w-4" />
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="mt-4 h-8 w-16" />
          ) : (
            <div className="mt-4 text-3xl font-bold text-slate-900 dark:text-white">
              {typedStats?.total_exercises || 0}
            </div>
          )}
        </div>

        {/* Total Characters */}
        <div className="corp-card p-6">
          <div className="flex flex-row items-center justify-between gap-2">
            <p className="corp-eyebrow">{t('dashboard.totalCharacters')}</p>
            <div className="corp-icon-chip w-9 h-9 shrink-0">
              <Users className="h-4 w-4" />
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="mt-4 h-8 w-16" />
          ) : (
            <Link to="/admin/characters">
              <div className="mt-4 text-3xl font-bold text-slate-900 dark:text-white cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors">
                {typedStats?.total_characters || 0}
              </div>
            </Link>
          )}
        </div>

        {/* Total Audio Segments */}
        <div className="corp-card p-6">
          <div className="flex flex-row items-center justify-between gap-2">
            <p className="corp-eyebrow">{t('dashboard.audioSegments')}</p>
            <div className="corp-icon-chip w-9 h-9 shrink-0">
              <Volume2 className="h-4 w-4" />
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="mt-4 h-8 w-16" />
          ) : (
            <Link to="/admin/audio">
              <div className="mt-4 text-3xl font-bold text-slate-900 dark:text-white cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors">
                {typedStats?.total_audio_segments || 0}
              </div>
            </Link>
          )}
        </div>
      </div>



      {/* Activity Charts */}
      {typedStats?.daily_activity && (
        <div className="space-y-6">
          <AdminActivityChart data={typedStats.daily_activity} />
          <AdminContributionGraph data={typedStats.daily_activity} />
        </div>
      )}

      {/* Lessons by Adventure Level */}
      <div className="corp-panel p-7">
        <div className="flex items-center gap-3 mb-6">
          <div className="corp-icon-chip w-10 h-10 shrink-0">
            <TrendingUp className="h-5 w-5" />
          </div>
          <h2 className="corp-display text-xl font-bold text-slate-900 dark:text-white">
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
                <div key={level} className="flex items-center gap-4">
                  <div className="w-1/3 min-w-[120px] text-xs font-semibold text-slate-600 dark:text-slate-400 truncate" title={t(`adventures:list.${level}.title`)}>
                    {t(`adventures:list.${level}.title`)}
                  </div>
                  <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-800/50 rounded-full overflow-hidden relative">
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full transition-all duration-1000 ease-out"
                      style={{
                        width: `${Math.max(4, (count / (typedStats.total_lessons || 1)) * 100)}%`,
                      }}
                    />
                  </div>
                  <div className="w-10 text-right text-sm font-bold text-slate-900 dark:text-white">{count}</div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Recent Edits Table */}
      <div className="corp-panel overflow-hidden">
        <div className="p-7 flex items-center justify-between border-b border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="corp-icon-chip w-10 h-10 shrink-0">
              <RefreshCw className="h-5 w-5" />
            </div>
            <h2 className="corp-display text-xl font-bold text-slate-900 dark:text-white">
              {t('dashboard.recentEdits')}
            </h2>
          </div>
          <Link to="/admin/history">
            <button className="corp-btn-ghost h-9 px-4 rounded-xl text-xs font-semibold">
              {t('dashboard.viewAllHistory')}
            </button>
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
              <Table className="corp-table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">{t('dashboard.date')}</TableHead>
                    <TableHead>{t('dashboard.editor')}</TableHead>
                    <TableHead>{t('dashboard.entityType')}</TableHead>
                    <TableHead>{t('dashboard.entityId')}</TableHead>
                    <TableHead className="text-right pr-6">{t('dashboard.action')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {typedStats.recent_edits.slice(0, 10).map((edit) => (
                    <TableRow key={edit.id}>
                      <TableCell className="text-xs font-medium text-slate-500 dark:text-slate-400 pl-6">
                        {new Date(edit.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-sm font-semibold text-slate-900 dark:text-white">
                        {edit.editor_name}
                      </TableCell>
                      <TableCell>
                        <span className="corp-badge corp-badge--brand">
                          {edit.entity_type}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-[10px] text-slate-400">
                        {edit.entity_id}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <span
                          className={cn(
                            'corp-badge',
                            edit.action === 'create' && 'corp-badge--success',
                            edit.action === 'update' && 'corp-badge--info',
                            edit.action === 'delete' && 'corp-badge--danger'
                          )}
                        >
                          {t(`admin:dashboard.actions.${edit.action}`)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="corp-empty py-16">
              <RefreshCw className="w-12 h-12 mx-auto mb-4" />
              <p>{t('dashboard.noRecentEdits')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Links */}
      <div className="corp-panel p-7">
        <div className="flex items-center gap-3 mb-6">
          <div className="corp-icon-chip w-10 h-10 shrink-0">
            <Zap className="h-5 w-5" />
          </div>
          <h2 className="corp-display text-xl font-bold text-slate-900 dark:text-white">
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
            <Link key={idx} to={link.to} className="corp-card group flex items-center justify-between gap-4 h-16 px-5">
              <div className="flex items-center gap-4">
                <div className={cn('p-2 rounded-xl transition-colors', QUICK_LINK_STYLES[link.color]?.chip)}>
                  <link.icon className="h-4 w-4" />
                </div>
                <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">
                  {link.label}
                </span>
              </div>
              <ArrowLeft className="w-4 h-4 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 rotate-180 transition-all translate-x-2 group-hover:translate-x-0" />
            </Link>
          ))}
        </div>
      </div>
    </div >
  );
};

export default AdminDashboard;
