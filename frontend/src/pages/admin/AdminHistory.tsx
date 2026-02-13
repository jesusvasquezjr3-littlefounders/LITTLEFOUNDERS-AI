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
import { ChevronDown, ChevronUp, RotateCcw, Search } from 'lucide-react';

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
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          {t('history.title')}
        </h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          {t('history.description')}
        </p>
      </div>

      {/* Filters */}
      <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="text-base text-slate-900 dark:text-white">
            {t('common.filters')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
            {/* Search */}
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
              <Input
                placeholder={t('history.searchPlaceholder')}
                className="pl-10 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white"
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
              <SelectTrigger className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white">
                <SelectValue placeholder={t('history.allTypes')} />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                {ENTITY_TYPES.map((type) => (
                  <SelectItem key={type} value={type} className="text-slate-900 dark:text-white">
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Action */}
            <Select value={actionFilter ? actionFilter : undefined} onValueChange={(value) => {
              setActionFilter(value);
              setCurrentPage(1);
            }}>
              <SelectTrigger className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white">
                <SelectValue placeholder={t('history.allActions')} />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                {ACTIONS.map((action) => (
                  <SelectItem key={action} value={action} className="text-slate-900 dark:text-white">
                    {action.charAt(0).toUpperCase() + action.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Editor */}
            <Input
              placeholder={t('history.editorPlaceholder')}
              className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white"
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
              className="lg:col-span-1 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white"
            >
              {t('common.clear')}
            </Button>
          </div>

          {/* Date Filters */}
          <div className="grid gap-4 md:grid-cols-2 mt-4">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('common.fromDate')}
              </label>
              <Input
                type="date"
                value={dateStartFilter}
                onChange={(e) => {
                  setDateStartFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="mt-1 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('common.toDate')}
              </label>
              <Input
                type="date"
                value={dateEndFilter}
                onChange={(e) => {
                  setDateEndFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="mt-1 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </CardContent>
      </Card>

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
