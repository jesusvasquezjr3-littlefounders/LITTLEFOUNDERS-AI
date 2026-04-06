import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminHistory, useRollback } from '@/hooks/useAdminHistory';
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
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, ChevronUp, RotateCcw, Search, History } from 'lucide-react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { cn } from '@/lib/utils';

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
        return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100';
      case 'update':
        return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100';
      case 'delete':
        return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100';
      case 'duplicate':
        return 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-100';
      case 'rollback':
        return 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-100';
      default:
        return 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100';
    }
  };

  return (
    <div className="space-y-6 p-8 bg-white dark:bg-slate-900 min-h-screen">
      {/* Header */}
      {/* Premium Admin Header */}
      <div className="relative rounded-3xl overflow-hidden liquid-glass-strong px-5 py-5 md:px-7 md:py-6 flex flex-col md:flex-row items-center justify-between gap-5 border border-amber-500/10 dark:border-amber-500/5 shadow-2xl">
          {/* Ambient Glows */}
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-gradient-to-br from-amber-500/15 to-orange-600/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-gradient-to-tr from-yellow-500/10 to-amber-600/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-row items-center gap-4 md:gap-5 relative z-10 w-full md:w-auto">
              <div className="p-2 md:p-3 bg-gradient-to-br from-amber-500 via-orange-500 to-yellow-600 rounded-xl md:rounded-[1.25rem] shadow-xl shadow-amber-500/25 transform -rotate-3 transition-transform hover:rotate-0 duration-300 shrink-0">
                  <History className="w-5 h-5 md:w-7 md:h-7 text-white" />
              </div>
              <div className="text-left">
                  <div className="flex items-center gap-2 mb-0.5">
                      {/* Branding removed as per user request */}
                  </div>
                  <h1 className="text-xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase md:normal-case leading-tight mb-1">
                      {t('history.title')}
                  </h1>
                  <p className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400 font-bold md:font-medium leading-tight">
                      {t('history.description')}
                  </p>
              </div>
          </div>
      </div>

      {/* Filters */}
      <GlassPanel variant="subtle" className="p-0 border-slate-200/50 dark:border-slate-700/50 shadow-sm overflow-hidden">
        <CardHeader className="py-3 px-6 border-b border-slate-100 dark:border-slate-800/50">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-500">{t('common.filters')}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
            {/* Search */}
            <div className="relative lg:col-span-2 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 group-hover:text-amber-500 transition-colors" />
              <Input
                placeholder={t('history.searchPlaceholder')}
                className="pl-10 h-11 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-100 dark:border-slate-700 focus:border-amber-500/50 transition-all rounded-xl text-slate-900 dark:text-white"
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
              <SelectTrigger className="h-11 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-100 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white">
                <SelectValue placeholder={t('history.allTypes')} />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl">
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
              <SelectTrigger className="h-11 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-100 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white">
                <SelectValue placeholder={t('history.allActions')} />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl">
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
              className="h-11 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-100 dark:border-slate-700 focus:border-amber-500/50 rounded-xl text-slate-900 dark:text-white"
              value={editorFilter}
              onChange={(e) => {
                setEditorFilter(e.target.value);
                setCurrentPage(1);
              }}
            />

            {/* Clear Filters */}
            <Button
              variant="outline"
              onClick={() => {
                setEntityTypeFilter('');
                setActionFilter('');
                setEditorFilter('');
                setDateStartFilter('');
                setDateEndFilter('');
                setSearchTerm('');
                setCurrentPage(1);
              }}
              className="h-11 rounded-xl font-bold bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {t('common.clear')}
            </Button>
          </div>

          {/* Date Filters */}
          <div className="grid gap-4 md:grid-cols-2 mt-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block ml-1">
                {t('common.fromDate')}
              </label>
              <Input
                type="date"
                value={dateStartFilter}
                onChange={(e) => {
                  setDateStartFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-11 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-100 dark:border-slate-700 focus:border-amber-500/50 rounded-xl text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block ml-1">
                {t('common.toDate')}
              </label>
              <Input
                type="date"
                value={dateEndFilter}
                onChange={(e) => {
                  setDateEndFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-11 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-100 dark:border-slate-700 focus:border-amber-500/50 rounded-xl text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </CardContent>
      </GlassPanel>

      {/* Results Info */}
      <div className="text-sm text-slate-600 dark:text-slate-400">
        {t('common.showing')} {paginatedEntries.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} {t('common.to')}{' '}
        {Math.min(currentPage * pageSize, filteredEntries.length)} {t('common.of')} {filteredEntries.length}{' '}
        {t('history.entries')}
      </div>

      {/* History Table */}
      <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full bg-slate-200 dark:bg-slate-700" />
              ))}
            </div>
          ) : paginatedEntries.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200 dark:border-slate-700">
                    <TableHead className="w-12 text-slate-900 dark:text-white"></TableHead>
                    <TableHead className="text-slate-900 dark:text-white">{t('common.date')}</TableHead>
                    <TableHead className="text-slate-900 dark:text-white">{t('history.editor')}</TableHead>
                    <TableHead className="text-slate-900 dark:text-white">{t('history.entityType')}</TableHead>
                    <TableHead className="text-slate-900 dark:text-white">{t('history.entityId')}</TableHead>
                    <TableHead className="text-slate-900 dark:text-white">{t('common.action')}</TableHead>
                    <TableHead className="text-slate-900 dark:text-white">{t('history.fieldsChanged')}</TableHead>
                    <TableHead className="text-slate-900 dark:text-white text-center">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedEntries.map((entry) => (
                    <React.Fragment key={entry.id}>
                      <TableRow
                        className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700"
                        onClick={() =>
                          setExpandedEntryId(
                            expandedEntryId === entry.id ? null : entry.id
                          )
                        }
                      >
                        <TableCell>
                          <div>
                            {expandedEntryId === entry.id ? (
                              <ChevronUp className="h-4 w-4 text-slate-900 dark:text-white" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-slate-900 dark:text-white" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          <div className="text-slate-900 dark:text-white">
                            {new Date(entry.created_at).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-slate-600 dark:text-slate-400">
                            {new Date(entry.created_at).toLocaleTimeString()}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-slate-900 dark:text-white">
                          {entry.editor_name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white">
                            {entry.entity_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-400">
                          <div>{entry.entity_id}</div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getActionColor(entry.action)} variant="secondary">
                            {entry.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600 dark:text-slate-400">
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
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRollbackConfirmId(entry.id);
                                  }}
                                  className="text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700"
                                  title={t('history.rollback')}
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                                <DialogHeader>
                                  <DialogTitle className="text-slate-900 dark:text-white">
                                    {t('history.rollbackTitle')}
                                  </DialogTitle>
                                  <DialogDescription className="text-slate-600 dark:text-slate-400">
                                    {t('history.rollbackDescription')} {entry.entity_type} "{entry.entity_id}".
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="flex justify-end gap-2 pt-4">
                                  <Button
                                    variant="outline"
                                    onClick={() => setRollbackConfirmId(null)}
                                    className="border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white"
                                  >
                                    {t('common.cancel')}
                                  </Button>
                                  <Button
                                    onClick={() => handleRollback(entry.id)}
                                    disabled={rollback.isPending}
                                  >
                                    {rollback.isPending ? t('common.rollingBack') : t('history.rollback')}
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                        </TableCell>
                      </TableRow>

                      {/* Expanded Row - Details */}
                      {expandedEntryId === entry.id && entry.field_changed && (
                        <TableRow className="bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                          <TableCell colSpan={8} className="p-4">
                            <div className="space-y-4">
                              <div>
                                <h4 className="font-semibold text-sm mb-3 text-slate-900 dark:text-white">
                                  {t('history.changes')}
                                </h4>
                                <ScrollArea className="h-auto border rounded-lg p-4 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600">
                                  <div className="border-l-4 border-blue-400 pl-3">
                                    <p className="font-medium text-sm mb-2 text-slate-900 dark:text-white">
                                      {entry.field_changed}
                                    </p>
                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                      <div className="bg-red-50 dark:bg-red-900 p-2 rounded border border-red-200 dark:border-red-700">
                                        <p className="font-semibold text-red-700 dark:text-red-100 mb-1">
                                          {t('history.oldValue')}
                                        </p>
                                        <p className="text-red-600 dark:text-red-200 font-mono break-words">
                                          {entry.previous_value !== undefined ? JSON.stringify(entry.previous_value, null, 2) : '-'}
                                        </p>
                                      </div>
                                      <div className="bg-green-50 dark:bg-green-900 p-2 rounded border border-green-200 dark:border-green-700">
                                        <p className="font-semibold text-green-700 dark:text-green-100 mb-1">
                                          {t('history.newValue')}
                                        </p>
                                        <p className="text-green-600 dark:text-green-200 font-mono break-words">
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
            <div className="text-center py-12">
              <p className="text-slate-500 dark:text-slate-400">
                {t('history.noFound')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t('common.page')} {currentPage} {t('common.of')} {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white"
            >
              {t('common.previous')}
            </Button>
            <Button
              variant="outline"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white"
            >
              {t('common.next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminHistory;
