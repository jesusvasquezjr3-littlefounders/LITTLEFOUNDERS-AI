import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminAudio, useUploadAudio, useGenerateAudio, useDeleteAudio } from '@/hooks/useAdminAudio';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Trash2, Upload, Zap, Volume2, Search } from 'lucide-react';

interface AudioSegment {
  public_id: string;
  lesson_id?: string;
  character_id?: string;
  emotion: string;
  language_code: string;
  source: 'uploaded' | 'generated' | 'library';
  audio_url: string;
  duration_ms?: number;
  created_at: string;
  tags?: string[];
  is_active: boolean;
  transcript?: string;
  exercise_id?: string;
}

interface PaginatedResponse {
  items: AudioSegment[];
  total: number;
  page: number;
  page_size: number;
}

export const AdminAudio: React.FC = () => {
  const { t } = useTranslation('admin');
  const [lessonFilter, setLessonFilter] = useState('');
  const [characterFilter, setCharacterFilter] = useState('');
  const [languageFilter, setLanguageFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [uploadForm, setUploadForm] = useState({
    lesson_id: '',
    character_id: '',
    emotion: 'neutral',
    language_code: 'es',
    file: null as File | null,
  });

  const [generateForm, setGenerateForm] = useState({
    text: '',
    character_id: '',
    emotion: 'neutral',
    language_code: 'es',
  });

  const { data: audioData, isLoading } = useAdminAudio({
    lesson_id: lessonFilter,
    character_id: characterFilter,
    language_code: languageFilter,
  });

  const uploadMutation = useUploadAudio();
  const generateMutation = useGenerateAudio();
  const deleteMutation = useDeleteAudio();

  const audioSegments = audioData ? (audioData as unknown as PaginatedResponse).items : [];

  // Filter by search term
  const filteredAudio = useMemo(() => {
    if (!searchTerm) return audioSegments;
    const term = searchTerm.toLowerCase();
    return audioSegments.filter(
      (seg) =>
        seg.public_id.toLowerCase().includes(term) ||
        seg.lesson_id?.toLowerCase().includes(term) ||
        seg.character_id?.toLowerCase().includes(term) ||
        seg.emotion.toLowerCase().includes(term) ||
        seg.transcript?.toLowerCase().includes(term)
    );
  }, [audioSegments, searchTerm]);

  const handleUpload = async () => {
    if (!uploadForm.file) return;

    const formData = new FormData();
    formData.append('file', uploadForm.file);
    if (uploadForm.lesson_id) {
      formData.append('lesson_id', uploadForm.lesson_id);
    }
    if (uploadForm.character_id) {
      formData.append('character_id', uploadForm.character_id);
    }
    formData.append('emotion', uploadForm.emotion);
    formData.append('language_code', uploadForm.language_code);

    try {
      await uploadMutation.mutateAsync(formData);
      setUploadDialogOpen(false);
      setUploadForm({
        lesson_id: '',
        character_id: '',
        emotion: 'neutral',
        language_code: 'es',
        file: null,
      });
    } catch (error) {
      console.error('Upload error:', error);
    }
  };

  const handleGenerate = async () => {
    if (!generateForm.text || !generateForm.character_id) return;

    try {
      await generateMutation.mutateAsync({
        text: generateForm.text,
        character_id: generateForm.character_id,
        voice: generateForm.emotion,
        speed: 1.0,
      });
      setGenerateDialogOpen(false);
      setGenerateForm({
        text: '',
        character_id: '',
        emotion: 'neutral',
        language_code: 'es',
      });
    } catch (error) {
      console.error('Generate error:', error);
    }
  };

  const handleDelete = async (publicId: string) => {
    try {
      await deleteMutation.mutateAsync(publicId);
      setDeleteConfirmId(null);
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const EMOTIONS = [
    'neutral',
    'happy',
    'sad',
    'excited',
    'curious',
    'confused',
    'thoughtful',
    'surprised',
  ];
  const LANGUAGES = [
    { code: 'es', labelKey: 'common:languages.spanish' },
    { code: 'en', labelKey: 'common:languages.english' },
    { code: 'pt', labelKey: 'common:languages.portuguese' },
    { code: 'fr', labelKey: 'common:languages.french' },
  ];

  return (
    <div className="space-y-6 p-8 bg-white dark:bg-[#070b14] min-h-screen">
      {/* Admin Header */}
      <div className="corp-panel p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="flex flex-row items-center gap-4 md:gap-5 w-full md:w-auto">
              <div className="corp-icon-chip w-11 h-11 md:w-14 md:h-14 shrink-0">
                  <Volume2 className="w-5 h-5 md:w-7 md:h-7" />
              </div>
              <div className="text-left">
                  <h1 className="corp-display mt-1 text-2xl md:text-3xl font-bold text-slate-900 dark:text-white leading-tight">
                      {t('audio.title')}
                  </h1>
                  <p className="mt-1 corp-body-sm">
                      {t('audio.description')}
                  </p>
              </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button className="corp-btn-secondary h-11 px-6 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2">
                  <Upload className="h-4 w-4" />
                  {t('audio.uploadAudio')}
                </Button>
              </DialogTrigger>
              <DialogContent className="corp corp-dialog rounded-3xl max-w-md p-6">
                {/* ... existing content ... */}
              </DialogContent>
            </Dialog>

            <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="corp-btn-primary h-11 px-6 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2">
                  <Zap className="h-4 w-4" />
                  {t('audio.generateAudio')}
                </Button>
              </DialogTrigger>
              <DialogContent className="corp corp-dialog rounded-3xl max-w-md p-6">
                {/* ... existing content ... */}
              </DialogContent>
            </Dialog>
          </div>
      </div>

      {/* Filters */}
      <div className="corp-panel overflow-hidden">
        <div className="py-3 px-6 border-b border-slate-200 dark:border-white/10">
          <span className="corp-eyebrow">{t('common.filters')}</span>
        </div>
        <div className="p-4 md:p-6">
          <div className="grid gap-4 md:grid-cols-5">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <Input
                placeholder={t('audio.searchPlaceholder')}
                className="corp-input h-11 pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Lesson Filter */}
            <div className="relative">
              <Input
                placeholder={t('audio.lessonPlaceholder')}
                className="corp-input h-11"
                value={lessonFilter}
                onChange={(e) => setLessonFilter(e.target.value)}
              />
            </div>

            {/* Character Filter */}
            <div className="relative">
              <Input
                placeholder={t('audio.characterPlaceholder')}
                className="corp-input h-11"
                value={characterFilter}
                onChange={(e) => setCharacterFilter(e.target.value)}
              />
            </div>

            {/* Language Filter */}
            <Select value={languageFilter ? languageFilter : undefined} onValueChange={(value) => setLanguageFilter(value)}>
              <SelectTrigger className="corp-input h-11">
                <SelectValue placeholder={t('audio.allLanguages')} />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#0d1426] border-slate-200 dark:border-white/10 rounded-xl overflow-hidden">
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code} className="text-slate-900 dark:text-white">
                    {t(lang.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Clear Filters */}
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm('');
                setLessonFilter('');
                setCharacterFilter('');
                setLanguageFilter('');
              }}
              className="corp-btn-secondary h-11 rounded-xl px-5 text-sm font-semibold"
            >
              {t('common.clear')}
            </Button>
          </div>
        </div>
      </div>

      {/* Results Info */}
      <div className="corp-body-sm">
        {t('common.showing')} {filteredAudio.length} {t('audio.audioSegments')}
      </div>

      {/* Audio Table */}
      <div className="corp-panel overflow-hidden p-6">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full bg-slate-200 dark:bg-white/10" />
              ))}
            </div>
          ) : filteredAudio.length > 0 ? (
            <div className="overflow-x-auto">
              <Table className="corp-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.id')}</TableHead>
                    <TableHead>{t('audio.lesson')}</TableHead>
                    <TableHead>{t('audio.character')}</TableHead>
                    <TableHead>{t('audio.emotion')}</TableHead>
                    <TableHead>{t('audio.language')}</TableHead>
                    <TableHead>{t('audio.source')}</TableHead>
                    <TableHead>{t('common.created')}</TableHead>
                    <TableHead className="text-center">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAudio.map((segment) => (
                    <TableRow key={segment.public_id}>
                      <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-400 max-w-xs truncate">
                        {segment.public_id}
                      </TableCell>
                      <TableCell>
                        {segment.lesson_id ? (
                          <span className="corp-badge">{segment.lesson_id}</span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {segment.character_id ? (
                          <span className="corp-badge">{segment.character_id}</span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="corp-badge capitalize">{segment.emotion}</span>
                      </TableCell>
                      <TableCell>
                        <span className="corp-badge corp-badge--info">
                          {(() => {
                            const lang = LANGUAGES.find((l) => l.code === segment.language_code);
                            return lang ? t(lang.labelKey) : segment.language_code;
                          })()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            segment.source === 'uploaded'
                              ? 'corp-badge corp-badge--brand capitalize'
                              : 'corp-badge capitalize'
                          }
                        >
                          {segment.source}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                        {new Date(segment.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-2">
                          <audio
                            key={segment.public_id}
                            controls
                            className="hidden"
                            src={segment.audio_url}
                            onPlay={() => setPlayingId(segment.public_id)}
                            onEnded={() => setPlayingId(null)}
                          />
                          <Dialog
                            open={deleteConfirmId === segment.public_id}
                            onOpenChange={(open) => {
                              if (!open) setDeleteConfirmId(null);
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteConfirmId(segment.public_id)}
                                className="corp-btn-danger h-9 w-9 rounded-lg inline-flex items-center justify-center"
                                title={t('common.delete')}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="corp corp-dialog rounded-3xl p-6">
                              <DialogHeader>
                                <DialogTitle className="text-slate-900 dark:text-white">
                                  {t('audio.deleteTitle')}
                                </DialogTitle>
                                <DialogDescription className="text-slate-600 dark:text-slate-400">
                                  {t('audio.deleteDescription')}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="flex justify-end gap-2 pt-4">
                                <Button
                                  variant="outline"
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="corp-btn-secondary h-10 rounded-xl px-5 text-sm font-semibold"
                                >
                                  {t('common.cancel')}
                                </Button>
                                <Button
                                  variant="destructive"
                                  onClick={() => handleDelete(segment.public_id)}
                                  disabled={deleteMutation.isPending}
                                  className="corp-btn-danger h-10 rounded-xl px-5 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {deleteMutation.isPending ? t('common.deleting') : t('common.delete')}
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
            <div className="corp-empty">
              <Volume2 className="mx-auto h-12 w-12 mb-4" />
              <p>{t('audio.noFound')}</p>
            </div>
          )}
      </div>
    </div>
  );
};

export default AdminAudio;
