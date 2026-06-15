import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminHistory, useRollback } from '@/hooks/useAdminHistory';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, ChevronUp, RotateCcw, Search, History } from 'lucide-react';

interface HistoryEntry {
  id: string;
  created_at: string;
  editor_name: string;
  editor_user_id: string;
  entity_type: string;
  entity_id: string;
  action: 'create' | 'update' | 'delete' | 'duplicate' | 'rollback';
  field_changed?: string;
  previous_value?: any;
  new_value?: any;
  metadata?: Record<string, any>;
}

interface PaginatedResponse {
  items: HistoryEntry[];
  total: number;
  page: number;
  page_size: number;
}

export const AdminHistory: React.FC = () => {
  const { t } = useTranslation('admin');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [editorFilter, setEditorFilter] = useState('');
  const [dateStartFilter, setDateStartFilter] = useState('');
  const [dateEndFilter, setDateEndFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [rollbackConfirmId, setRollbackConfirmId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const filters = useMemo(
    () => ({
      entity_type: entityTypeFilter,
      action: actionFilter,
      user_id: editorFilter,
      start_date: dateStartFilter,
      end_date: dateEndFilter,
    }),
    [entityTypeFilter, actionFilter, editorFilter, dateStartFilter, dateEndFilter]
  );

  const { data: historyData, isLoading } = useAdminHistory(filters);
  const rollback = useRollback();

  const entries = historyData ? (historyData as PaginatedResponse).items : [];

  // Filter by search term
  const filteredEntries = useMemo(() => {
    if (!searchTerm) return entries;
    const term = searchTerm.toLowerCase();
    return entries.filter(
      (entry) =>
        entry.entity_id.toLowerCase().includes(term) ||
        entry.editor_name?.toLowerCase().includes(term) ||
        entry.id.toLowerCase().includes(term) ||
        entry.field_changed?.toLowerCase().includes(term)
    );
  }, [entries, searchTerm]);

  // Paginate entries
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return filteredEntries.slice(start, end);
  }, [filteredEntries, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredEntries.length / pageSize);

  const handleRollback = async (entryId: string) => {
    try {
      await rollback.mutateAsync(entryId);
      setRollbackConfirmId(null);
    } catch (error) {
      console.error('Rollback error:', error);
    }
  };

  const ENTITY_TYPES = ['lesson', 'exercise', 'character', 'gesture', 'audio', 'user'];
  const ACTIONS = ['create', 'update', 'delete', 'duplicate', 'rollback'];

  const getActionColor = (action: string) => {
    switch (action) {
      case 'create':
        return 'corp-badge corp-badge--success';
      case 'update':
        return 'corp-badge corp-badge--info';
      case 'delete':
        return 'corp-badge corp-badge--danger';
      case 'duplicate':
        return 'corp-badge corp-badge--brand';
      case 'rollback':
        return 'corp-badge corp-badge--brand';
      default:
        return 'corp-badge';
    }
  };

  return (
    <div className="space-y-6 p-8 bg-white dark:bg-[#070b14] min-h-screen">
      {/* Header */}
      <div className="corp-panel p-6 md:p-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="corp-icon-chip w-11 h-11 shrink-0">
            <History className="w-5 h-5" />
          </div>
          <div>
            <span className="corp-eyebrow">{t('app_name', 'LittleFounders')}</span>
            <h1 className="corp-display mt-1 text-2xl md:text-3xl font-bold text-slate-900 dark:text-white leading-tight">
              {t('history.title')}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t('history.description')}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="corp-panel overflow-hidden">
        <div className="py-3 px-6 border-b border-slate-200 dark:border-white/10">
          <span className="corp-eyebrow">{t('common.filters')}</span>
        </div>
        <div className="p-4 md:p-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
            {/* Search */}
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                placeholder={t('history.searchPlaceholder')}
                className="corp-input h-11 pl-10"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            {/* Entity Type */}
            <Select value={entityTypeFilter ? entityTypeFilter : undefined} onValueChange={(value) => {
              setEntityTypeFilter(value);
              setCurrentPage(1);
            }}>
              <SelectTrigger className="corp-input h-11">
                <SelectValue placeholder={t('history.allTypes')} />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#0d1426] border-slate-200 dark:border-white/10 rounded-xl">
                {ENTITY_TYPES.map((type) => (
                  <SelectItem key={type} value={type} className="text-slate-900 dark:text-white">
                    {t(`history.entityNames.${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Action */}
            <Select value={actionFilter ? actionFilter : undefined} onValueChange={(value) => {
              setActionFilter(value);
              setCurrentPage(1);
            }}>
              <SelectTrigger className="corp-input h-11">
                <SelectValue placeholder={t('history.allActions')} />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#0d1426] border-slate-200 dark:border-white/10 rounded-xl">
                {ACTIONS.map((action) => (
                  <SelectItem key={action} value={action} className="text-slate-900 dark:text-white">
                    {t(`history.actionNames.${action}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Editor */}
            <Input
              placeholder={t('history.editorPlaceholder')}
              className="corp-input h-11"
              value={editorFilter}
              onChange={(e) => {
                setEditorFilter(e.target.value);
                setCurrentPage(1);
              }}
            />

            {/* Clear Filters */}
            <button
              type="button"
              onClick={() => {
                setEntityTypeFilter('');
                setActionFilter('');
                setEditorFilter('');
                setDateStartFilter('');
                setDateEndFilter('');
                setSearchTerm('');
                setCurrentPage(1);
              }}
              className="corp-btn-secondary h-11 rounded-xl px-5 text-sm font-semibold"
            >
              {t('common.clear')}
            </button>
          </div>

          {/* Date Filters */}
          <div className="grid gap-4 md:grid-cols-2 mt-4">
            <div className="space-y-1.5">
              <label className="corp-label">
                {t('common.fromDate')}
              </label>
              <Input
                type="date"
                value={dateStartFilter}
                onChange={(e) => {
                  setDateStartFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="corp-input h-11"
              />
            </div>
            <div className="space-y-1.5">
              <label className="corp-label">
                {t('common.toDate')}
              </label>
              <Input
                type="date"
                value={dateEndFilter}
                onChange={(e) => {
                  setDateEndFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="corp-input h-11"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Results Info */}
      <div className="text-sm text-slate-600 dark:text-slate-400">
        {t('common.showing')} {paginatedEntries.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} {t('common.to')}{' '}
        {Math.min(currentPage * pageSize, filteredEntries.length)} {t('common.of')} {filteredEntries.length}{' '}
        {t('history.entries')}
      </div>

      {/* History Table */}
      <div className="corp-panel overflow-hidden">
        <div className="p-4 md:p-6">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full bg-slate-200 dark:bg-white/10" />
              ))}
            </div>
          ) : paginatedEntries.length > 0 ? (
            <div className="overflow-x-auto">
              <Table className="corp-table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>{t('common.date')}</TableHead>
                    <TableHead>{t('history.editor')}</TableHead>
                    <TableHead>{t('history.entityType')}</TableHead>
                    <TableHead>{t('history.entityId')}</TableHead>
                    <TableHead>{t('common.action')}</TableHead>
                    <TableHead>{t('history.fieldsChanged')}</TableHead>
                    <TableHead className="text-center">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedEntries.map((entry) => (
                    <React.Fragment key={entry.id}>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() =>
                          setExpandedEntryId(
                            expandedEntryId === entry.id ? null : entry.id
                          )
                        }
                      >
                        <TableCell>
                          <div>
                            {expandedEntryId === entry.id ? (
                              <ChevronUp className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div className="text-slate-900 dark:text-white">
                            {new Date(entry.created_at).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {new Date(entry.created_at).toLocaleTimeString()}
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-900 dark:text-white">
                          {entry.editor_name}
                        </TableCell>
                        <TableCell>
                          <span className="corp-badge capitalize">
                            {entry.entity_type}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-slate-500 dark:text-slate-400">
                          <div>{entry.entity_id}</div>
                        </TableCell>
                        <TableCell>
                          <span className={getActionColor(entry.action)}>
                            {entry.action}
                          </span>
                        </TableCell>
                        <TableCell className="text-slate-600 dark:text-slate-400">
                          {entry.field_changed ? (
                            <span>{entry.field_changed}</span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {entry.action !== 'delete' && (
                            <Dialog
                              open={rollbackConfirmId === entry.id}
                              onOpenChange={(open) => {
                                if (!open) setRollbackConfirmId(null);
                              }}
                            >
                              <DialogTrigger asChild>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRollbackConfirmId(entry.id);
                                  }}
                                  className="corp-btn-ghost h-9 w-9 rounded-lg inline-flex items-center justify-center"
                                  title={t('history.rollback')}
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </button>
                              </DialogTrigger>
                              <DialogContent className="corp corp-dialog rounded-3xl sm:max-w-lg p-6">
                                <DialogHeader>
                                  <DialogTitle className="text-slate-900 dark:text-white">
                                    {t('history.rollbackTitle')}
                                  </DialogTitle>
                                  <DialogDescription className="text-slate-600 dark:text-slate-400">
                                    {t('history.rollbackDescription')} {entry.entity_type} "{entry.entity_id}".
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="flex justify-end gap-2 pt-4">
                                  <button
                                    type="button"
                                    onClick={() => setRollbackConfirmId(null)}
                                    className="corp-btn-secondary h-10 rounded-xl px-5 text-sm font-semibold"
                                  >
                                    {t('common.cancel')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRollback(entry.id)}
                                    disabled={rollback.isPending}
                                    className="corp-btn-primary h-10 rounded-xl px-5 text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {rollback.isPending ? t('common.rollingBack') : t('history.rollback')}
                                  </button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                        </TableCell>
                      </TableRow>

                      {/* Expanded Row - Details */}
                      {expandedEntryId === entry.id && entry.field_changed && (
                        <TableRow className="bg-slate-50 dark:bg-white/[0.03]">
                          <TableCell colSpan={8} className="p-4">
                            <div className="space-y-4">
                              <div>
                                <h4 className="corp-display font-semibold text-sm mb-3 text-slate-900 dark:text-white">
                                  {t('history.changes')}
                                </h4>
                                <ScrollArea className="corp-panel-subtle h-auto rounded-lg p-4">
                                  <div className="border-l-4 border-indigo-400 dark:border-indigo-500 pl-3">
                                    <p className="font-medium text-sm mb-2 text-slate-900 dark:text-white">
                                      {entry.field_changed}
                                    </p>
                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                      <div className="bg-red-50 dark:bg-red-950/40 p-2 rounded border border-red-200 dark:border-red-900/50">
                                        <p className="font-semibold text-red-700 dark:text-red-300 mb-1">
                                          {t('history.oldValue')}
                                        </p>
                                        <p className="text-red-600 dark:text-red-300 font-mono break-words">
                                          {entry.previous_value !== undefined ? JSON.stringify(entry.previous_value, null, 2) : '-'}
                                        </p>
                                      </div>
                                      <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded border border-emerald-200 dark:border-emerald-900/50">
                                        <p className="font-semibold text-emerald-700 dark:text-emerald-300 mb-1">
                                          {t('history.newValue')}
                                        </p>
                                        <p className="text-emerald-600 dark:text-emerald-300 font-mono break-words">
                                          {entry.new_value !== undefined ? JSON.stringify(entry.new_value, null, 2) : '-'}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </ScrollArea>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="corp-empty py-12">
              <p>{t('history.noFound')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t('common.page')} {currentPage} {t('common.of')} {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="corp-btn-secondary h-10 rounded-xl px-5 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('common.previous')}
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="corp-btn-secondary h-10 rounded-xl px-5 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('common.next')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminHistory;
