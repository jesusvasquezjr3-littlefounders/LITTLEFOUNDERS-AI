import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminLessons, useDeleteLesson, useDuplicateLesson } from '@/hooks/useAdminLessons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Edit, Trash2, Copy, Plus, Search, ChevronUp, ChevronDown, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { GlassPanel } from '@/components/ui/GlassPanel';

interface Lesson {
  public_id: string;
  lesson_code: string;
  title_es: string;
  title_en: string;
  adventure_level: number;
  saga_level: number;
  topic_level: number;
  lesson_number: number;
  points_reward: number;
  duration: number;
  exercise_count_es: number;
  exercise_count_en: number;
  updated_at: string;
}

interface LessonsResponse {
  items: Lesson[];
  total: number;
  page: number;
  page_size: number;
}

type SortField = 'code' | 'title' | 'adventure' | 'saga' | 'topic' | 'exercises' | 'updated';
type SortDirection = 'asc' | 'desc';

export const AdminLessons: React.FC = () => {
  const { t } = useTranslation('admin');
  const [searchTerm, setSearchTerm] = useState('');
  const [adventureFilter, setAdventureFilter] = useState<string>('');
  const [sagaFilter, setSagaFilter] = useState<string>('');
  const [topicFilter, setTopicFilter] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('updated');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const pageSize = 10;

  const filters = useMemo(
    () => ({
      search: searchTerm,
      adventure_level: adventureFilter ? parseInt(adventureFilter) : undefined,
      saga_level: sagaFilter ? parseInt(sagaFilter) : undefined,
      topic_level: topicFilter ? parseInt(topicFilter) : undefined,
    }),
    [searchTerm, adventureFilter, sagaFilter, topicFilter]
  );

  const { data: lessonsData, isLoading } = useAdminLessons(filters);
  const deleteLesson = useDeleteLesson();
  const duplicateLesson = useDuplicateLesson();

  const lessons = lessonsData?.items || [];
  const totalLessons = lessonsData?.total || 0;

  // Sort lessons
  const sortedLessons = useMemo(() => {
    const sorted = [...lessons].sort((a, b) => {
      let compareValue = 0;

      switch (sortField) {
        case 'code':
          compareValue = a.lesson_code.localeCompare(b.lesson_code, undefined, { numeric: true });
          break;
        case 'title':
          compareValue = a.title_es.localeCompare(b.title_es);
          break;
        case 'adventure':
          compareValue = a.adventure_level - b.adventure_level;
          break;
        case 'saga':
          compareValue = a.saga_level - b.saga_level;
          break;
        case 'topic':
          compareValue = a.topic_level - b.topic_level;
          break;
        case 'exercises':
          compareValue = a.exercise_count_es - b.exercise_count_es;
          break;
        case 'updated':
          compareValue = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
          break;
        default:
          compareValue = 0;
      }

      return sortDirection === 'asc' ? compareValue : -compareValue;
    });

    return sorted;
  }, [lessons, sortField, sortDirection]);

  // Paginate lessons
  const paginatedLessons = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return sortedLessons.slice(start, end);
  }, [sortedLessons, currentPage, pageSize]);

  const totalPages = Math.ceil(totalLessons / pageSize);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteLesson.mutateAsync(id);
      setDeleteConfirmId(null);
    } catch (error) {
      console.error('Failed to delete lesson:', error);
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateLesson.mutateAsync(id);
    } catch (error) {
      console.error('Failed to duplicate lesson:', error);
    }
  };

  const SortHeader: React.FC<{
    field: SortField;
    children: React.ReactNode;
  }> = ({ field, children }) => (
    <TableHead
      className="cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-800"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-2">
        {children}
        {sortField === field &&
          (sortDirection === 'asc' ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          ))}
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-6 p-8">
      {/* Premium Admin Header */}
      <div className="relative rounded-3xl overflow-hidden liquid-glass-strong px-5 py-5 md:px-7 md:py-6 flex flex-col md:flex-row items-center justify-between gap-5 border border-indigo-500/10 dark:border-indigo-500/5 shadow-2xl">
          {/* Ambient Glows */}
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-gradient-to-br from-indigo-500/15 to-purple-600/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-gradient-to-tr from-blue-500/10 to-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-row items-center gap-4 md:gap-5 relative z-10 w-full md:w-auto">
              <div className="p-2 md:p-3 bg-gradient-to-br from-indigo-500 via-purple-500 to-blue-600 rounded-xl md:rounded-[1.25rem] shadow-xl shadow-indigo-500/25 transform -rotate-3 transition-transform hover:rotate-0 duration-300 shrink-0">
                  <BookOpen className="w-5 h-5 md:w-7 md:h-7 text-white" />
              </div>
              <div className="text-left">
                  <div className="flex items-center gap-2 mb-0.5">
                      {/* Branding removed as per user request */}
                  </div>
                  <h1 className="text-xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase md:normal-case leading-tight mb-1">
                      {t('lessons.title')}
                  </h1>
                  <p className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400 font-bold md:font-medium leading-tight">
                      {t('lessons.subtitle')}
                  </p>
              </div>
          </div>

          <Link to="/admin/lessons/new" className="relative z-10 w-full md:w-auto">
            <Button className="w-full md:w-auto h-11 px-6 rounded-xl md:rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold shadow-lg shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95 gap-2">
                <Plus className="h-4 w-4" />
                {t('lessons.createNew')}
            </Button>
          </Link>
      </div>

      {/* Filters Card */}
      <GlassPanel variant="subtle" className="p-0 border-slate-200/50 dark:border-slate-700/50 shadow-sm overflow-hidden">
        <CardHeader className="py-3 px-6 border-b border-slate-100 dark:border-slate-800/50">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-500">{t('lessons.filters')}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <div className="grid gap-4 md:grid-cols-5">
            {/* Search */}
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 transition-colors" />
              <Input
                placeholder={t('lessons.searchPlaceholder')}
                className="pl-10 h-11 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700 focus:border-indigo-500/50 transition-all rounded-xl text-slate-900 dark:text-white"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            {/* Adventure Level */}
            <Select value={adventureFilter ? adventureFilter : undefined} onValueChange={(value) => {
              setAdventureFilter(value);
              setCurrentPage(1);
            }}>
              <SelectTrigger className="h-11 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-xl">
                <SelectValue placeholder={t('lessons.allAdventures')} />
              </SelectTrigger>
              <SelectContent className="dark:bg-slate-900 dark:border-slate-700 rounded-xl overflow-hidden">
                {[1, 2, 3, 4, 5, 6].map((level) => (
                  <SelectItem key={level} value={level.toString()}>
                    {t('lessons.adventure')} {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Saga Level */}
            <Select value={sagaFilter ? sagaFilter : undefined} onValueChange={(value) => {
              setSagaFilter(value);
              setCurrentPage(1);
            }}>
              <SelectTrigger className="h-11 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-xl">
                <SelectValue placeholder={t('lessons.allSagas')} />
              </SelectTrigger>
              <SelectContent className="dark:bg-slate-900 dark:border-slate-700 rounded-xl overflow-hidden">
                {[1, 2, 3, 4, 5].map((level) => (
                  <SelectItem key={level} value={level.toString()}>
                    {t('lessons.saga')} {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Topic Level */}
            <Select value={topicFilter ? topicFilter : undefined} onValueChange={(value) => {
              setTopicFilter(value);
              setCurrentPage(1);
            }}>
              <SelectTrigger className="h-11 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-xl">
                <SelectValue placeholder={t('lessons.allTopics')} />
              </SelectTrigger>
              <SelectContent className="dark:bg-slate-900 dark:border-slate-700 rounded-xl overflow-hidden">
                {[1, 2, 3, 4].map((level) => (
                  <SelectItem key={level} value={level.toString()}>
                    {t('lessons.topic')} {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Clear Filters */}
            <Button
              variant="outline"
              className="h-11 rounded-xl font-bold bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              onClick={() => {
                setSearchTerm('');
                setAdventureFilter('');
                setSagaFilter('');
                setTopicFilter('');
                setCurrentPage(1);
              }}
            >
              {t('lessons.clearFilters')}
            </Button>
          </div>
        </CardContent>
      </GlassPanel>

      {/* Results Info */}
      <div className="text-sm text-slate-600 dark:text-slate-400">
        {paginatedLessons.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}-{Math.min(currentPage * pageSize, totalLessons)} {t('lessons.of')} {totalLessons}
      </div>

      {/* Lessons Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : paginatedLessons.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200 dark:border-slate-700">
                    <SortHeader field="code">{t('lessons.code')}</SortHeader>
                    <SortHeader field="title">{t('lessons.titleEs')}</SortHeader>
                    <SortHeader field="adventure">{t('lessons.adventure')}</SortHeader>
                    <SortHeader field="saga">{t('lessons.saga')}</SortHeader>
                    <SortHeader field="topic">{t('lessons.topic')}</SortHeader>
                    <SortHeader field="exercises">{t('lessons.exercises')}</SortHeader>
                    <SortHeader field="updated">{t('lessons.lastUpdated')}</SortHeader>
                    <TableHead className="text-center">{t('lessons.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLessons.map((lesson) => (
                    <TableRow key={lesson.public_id} className="border-slate-200 dark:border-slate-700">
                      <TableCell className="font-mono font-medium text-sm text-slate-900 dark:text-white">
                        {lesson.lesson_code}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-slate-900 dark:text-white">
                        <span title={lesson.title_es}>{lesson.title_es}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{lesson.adventure_level}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{lesson.saga_level}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{lesson.topic_level}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-block bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 px-2 py-1 rounded text-xs font-semibold">
                          ES: {lesson.exercise_count_es} / EN: {lesson.exercise_count_en}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                        {new Date(lesson.updated_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Link to={`/admin/lessons/${lesson.public_id}/edit`}>
                            <Button variant="ghost" size="sm" title={t('lessons.edit')}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDuplicate(lesson.public_id)}
                            disabled={duplicateLesson.isPending}
                            title={t('lessons.duplicate')}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Dialog
                            open={deleteConfirmId === lesson.public_id}
                            onOpenChange={(open) => {
                              if (!open) setDeleteConfirmId(null);
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteConfirmId(lesson.public_id)}
                                title={t('lessons.delete')}
                                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="dark:bg-slate-900 dark:border-slate-700">
                              <DialogHeader>
                                <DialogTitle className="dark:text-white">
                                  {t('lessons.deleteLesson')}
                                </DialogTitle>
                                <DialogDescription className="dark:text-slate-400">
                                  {t('lessons.deleteConfirm', { title: lesson.title_es })}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="flex justify-end gap-3 pt-4">
                                <Button
                                  variant="outline"
                                  onClick={() => setDeleteConfirmId(null)}
                                >
                                  {t('lessons.cancel')}
                                </Button>
                                <Button
                                  variant="destructive"
                                  onClick={() => handleDelete(lesson.public_id)}
                                  disabled={deleteLesson.isPending}
                                >
                                  {deleteLesson.isPending ? t('lessons.deleting') : t('lessons.delete')}
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-500 dark:text-slate-400 mb-4">{t('lessons.noLessons')}</p>
              <Link to="/admin/lessons/new">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('lessons.createFirst')}
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t('lessons.page')} {currentPage} {t('lessons.of')} {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              {t('lessons.previous')}
            </Button>
            <Button
              variant="outline"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              {t('lessons.next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLessons;
