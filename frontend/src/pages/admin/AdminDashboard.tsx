import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminStats } from '@/hooks/useAdminStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BookOpen, Zap, Users, Volume2, TrendingUp, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';

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
  lessons_by_adventure: Record<number, number>;
  recent_edits: RecentEdit[];
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t('dashboard.title')}
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            {t('dashboard.subtitle')}
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          variant="outline"
          size="sm"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          {refreshing ? t('dashboard.refreshing') : t('dashboard.refresh')}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Lessons */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.totalLessons')}</CardTitle>
            <BookOpen className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  {typedStats?.total_lessons || 0}
                </div>
                <Link to="/admin/lessons">
                  <p className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                    {t('dashboard.viewAll')}
                  </p>
                </Link>
              </>
            )}
          </CardContent>
        </Card>

        {/* Total Exercises */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.totalExercises')}</CardTitle>
            <Zap className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {typedStats?.total_exercises || 0}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Total Characters */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.totalCharacters')}</CardTitle>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <Link to="/admin/characters">
                <div className="text-2xl font-bold text-slate-900 dark:text-white cursor-pointer hover:text-green-600 dark:hover:text-green-400">
                  {typedStats?.total_characters || 0}
                </div>
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Total Audio Segments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.audioSegments')}</CardTitle>
            <Volume2 className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <Link to="/admin/audio">
                <div className="text-2xl font-bold text-slate-900 dark:text-white cursor-pointer hover:text-purple-600 dark:hover:text-purple-400">
                  {typedStats?.total_audio_segments || 0}
                </div>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lessons by Adventure Level */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t('dashboard.lessonsByAdventure')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {typedStats?.lessons_by_adventure && Object.entries(typedStats.lessons_by_adventure)
                .sort(([a], [b]) => parseInt(a) - parseInt(b))
                .map(([level, count]) => (
                  <div key={level} className="flex items-center gap-3">
                    <div className="w-64 text-sm font-medium text-slate-900 dark:text-white truncate" title={t(`adventures:list.${level}.title`)}>
                      {t(`adventures:list.${level}.title`)}
                    </div>
                    <div className="flex-1 h-6 bg-blue-100 dark:bg-blue-900 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 dark:bg-blue-600 transition-all duration-300 flex items-center justify-end pr-2"
                        style={{
                          width: `${Math.min(100, (count / (typedStats.total_lessons || 1)) * 100)}%`,
                        }}
                      >
                        {count > 0 && <span className="text-xs font-semibold text-white">{count}</span>}
                      </div>
                    </div>
                    <div className="w-8 text-right text-sm text-slate-600 dark:text-slate-400">{count}</div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Edits Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t('dashboard.recentEdits')}</CardTitle>
            <Link to="/admin/history">
              <Button variant="outline" size="sm">
                {t('dashboard.viewAllHistory')}
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : typedStats?.recent_edits && typedStats.recent_edits.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('dashboard.date')}</TableHead>
                    <TableHead>{t('dashboard.editor')}</TableHead>
                    <TableHead>{t('dashboard.entityType')}</TableHead>
                    <TableHead>{t('dashboard.entityId')}</TableHead>
                    <TableHead>{t('dashboard.action')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {typedStats.recent_edits.slice(0, 10).map((edit) => (
                    <TableRow key={edit.id}>
                      <TableCell className="text-sm text-slate-900 dark:text-white">
                        {new Date(edit.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm font-medium text-slate-900 dark:text-white">
                        {edit.editor_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {edit.entity_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-slate-600 dark:text-slate-400">
                        {edit.entity_id}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            edit.action === 'create'
                              ? 'default'
                              : edit.action === 'update'
                                ? 'secondary'
                                : 'destructive'
                          }
                          className="capitalize"
                        >
                          {edit.action}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center text-sm text-slate-500 dark:text-slate-400 py-8">
              {t('dashboard.noRecentEdits')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.quickLinks')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link to="/admin/lessons">
              <Button variant="outline" className="w-full justify-start">
                <BookOpen className="mr-2 h-4 w-4" />
                {t('dashboard.manageLessons')}
              </Button>
            </Link>
            <Link to="/admin/lessons/new">
              <Button variant="outline" className="w-full justify-start">
                <BookOpen className="mr-2 h-4 w-4" />
                {t('dashboard.createLesson')}
              </Button>
            </Link>
            <Link to="/admin/characters">
              <Button variant="outline" className="w-full justify-start">
                <Users className="mr-2 h-4 w-4" />
                {t('dashboard.manageCharacters')}
              </Button>
            </Link>
            <Link to="/admin/audio">
              <Button variant="outline" className="w-full justify-start">
                <Volume2 className="mr-2 h-4 w-4" />
                {t('dashboard.audioLibrary')}
              </Button>
            </Link>
            <Link to="/admin/history">
              <Button variant="outline" className="w-full justify-start">
                <RefreshCw className="mr-2 h-4 w-4" />
                {t('dashboard.editHistory')}
              </Button>
            </Link>
            <Link to="/admin/users">
              <Button variant="outline" className="w-full justify-start">
                <Users className="mr-2 h-4 w-4" />
                {t('dashboard.userManagement')}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div >
  );
};

export default AdminDashboard;
