import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminLessons, useDeleteLesson, useDuplicateLesson } from '@/hooks/useAdminLessons';
import { Input } from '@/components/ui/input';
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
      className="cursor-pointer select-none"
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
      <div className="corp-panel p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex flex-row items-center gap-4 md:gap-5 w-full md:w-auto">
              <div className="corp-icon-chip w-12 h-12 md:w-14 md:h-14 shrink-0">
                  <BookOpen className="w-5 h-5 md:w-7 md:h-7" />
              </div>
              <div className="text-left">
                  <span className="corp-eyebrow">{t('lessons.subtitle')}</span>
                  <h1 className="corp-display mt-1 text-xl md:text-3xl font-bold text-slate-900 dark:text-white leading-tight">
                      {t('lessons.title')}
                  </h1>
              </div>
          </div>

          <Link to="/admin/lessons/new" className="w-full md:w-auto">
            <button className="corp-btn-primary w-full md:w-auto h-11 px-6 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2">
                <Plus className="h-4 w-4" />
                {t('lessons.createNew')}
            </button>
          </Link>
      </div>

      {/* Filters Card */}
      <div className="corp-panel overflow-hidden">
        <div className="py-3 px-6 border-b border-slate-200 dark:border-white/10">
          <span className="corp-eyebrow">{t('lessons.filters')}</span>
        </div>
        <div className="p-4 md:p-6">
          <div className="grid gap-4 md:grid-cols-5">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                placeholder={t('lessons.searchPlaceholder')}
                className="corp-input h-11 pl-10"
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
              <SelectTrigger className="corp-input h-11">
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
              <SelectTrigger className="corp-input h-11">
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
              <SelectTrigger className="corp-input h-11">
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
            <button
              className="corp-btn-secondary h-11 rounded-xl px-5 text-sm font-semibold"
              onClick={() => {
                setSearchTerm('');
                setAdventureFilter('');
                setSagaFilter('');
                setTopicFilter('');
                setCurrentPage(1);
              }}
            >
              {t('lessons.clearFilters')}
            </button>
          </div>
        </div>
      </div>

      {/* Results Info */}
      <div className="text-sm text-slate-600 dark:text-slate-400">
        {paginatedLessons.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}-{Math.min(currentPage * pageSize, totalLessons)} {t('lessons.of')} {totalLessons}
      </div>

      {/* Lessons Table */}
      <div className="corp-panel overflow-hidden">
        <div className="p-4 md:p-6">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : paginatedLessons.length > 0 ? (
            <div className="overflow-x-auto">
              <Table className="corp-table">
                <TableHeader>
                  <TableRow>
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
                    <TableRow key={lesson.public_id}>
                      <TableCell className="font-mono font-medium text-sm text-slate-900 dark:text-white">
                        {lesson.lesson_code}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-slate-900 dark:text-white">
                        <span title={lesson.title_es}>{lesson.title_es}</span>
                      </TableCell>
                      <TableCell>
                        <span className="corp-badge corp-badge--brand">{lesson.adventure_level}</span>
                      </TableCell>
                      <TableCell>
                        <span className="corp-badge">{lesson.saga_level}</span>
                      </TableCell>
                      <TableCell>
                        <span className="corp-badge">{lesson.topic_level}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="corp-badge corp-badge--info">
                          ES: {lesson.exercise_count_es} / EN: {lesson.exercise_count_en}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                        {new Date(lesson.updated_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <Link to={`/admin/lessons/${lesson.public_id}/edit`}>
                            <button
                              className="corp-btn-ghost h-9 w-9 rounded-lg inline-flex items-center justify-center"
                              title={t('lessons.edit')}
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                          </Link>
                          <button
                            className="corp-btn-ghost h-9 w-9 rounded-lg inline-flex items-center justify-center"
                            onClick={() => handleDuplicate(lesson.public_id)}
                            disabled={duplicateLesson.isPending}
                            title={t('lessons.duplicate')}
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <Dialog
                            open={deleteConfirmId === lesson.public_id}
                            onOpenChange={(open) => {
                              if (!open) setDeleteConfirmId(null);
                            }}
                          >
                            <DialogTrigger asChild>
                              <button
                                className="corp-btn-danger h-9 w-9 rounded-lg inline-flex items-center justify-center"
                                onClick={() => setDeleteConfirmId(lesson.public_id)}
                                title={t('lessons.delete')}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </DialogTrigger>
                            <DialogContent className="corp corp-dialog rounded-3xl sm:max-w-lg p-6">
                              <DialogHeader>
                                <DialogTitle className="text-slate-900 dark:text-white">
                                  {t('lessons.deleteLesson')}
                                </DialogTitle>
                                <DialogDescription className="text-slate-600 dark:text-slate-400">
                                  {t('lessons.deleteConfirm', { title: lesson.title_es })}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="flex justify-end gap-3 pt-4">
                                <button
                                  className="corp-btn-secondary h-11 rounded-xl px-5 text-sm font-semibold"
                                  onClick={() => setDeleteConfirmId(null)}
                                >
                                  {t('lessons.cancel')}
                                </button>
                                <button
                                  className="corp-btn-danger h-11 rounded-xl px-5 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                                  onClick={() => handleDelete(lesson.public_id)}
                                  disabled={deleteLesson.isPending}
                                >
                                  {deleteLesson.isPending ? t('lessons.deleting') : t('lessons.delete')}
                                </button>
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
            <div className="corp-empty py-12">
              <p className="mb-4">{t('lessons.noLessons')}</p>
              <Link to="/admin/lessons/new">
                <button className="corp-btn-primary h-11 rounded-xl px-5 text-sm font-semibold inline-flex items-center justify-center gap-2">
                  <Plus className="h-4 w-4" />
                  {t('lessons.createFirst')}
                </button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t('lessons.page')} {currentPage} {t('lessons.of')} {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              className="corp-btn-secondary h-10 rounded-xl px-5 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              {t('lessons.previous')}
            </button>
            <button
              className="corp-btn-secondary h-10 rounded-xl px-5 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              {t('lessons.next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLessons;
