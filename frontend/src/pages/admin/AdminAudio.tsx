import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAdminAudio, useUploadAudio, useGenerateAudio, useDeleteAudio } from '@/hooks/useAdminAudio';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Play, Trash2, Upload, Zap, Volume2, Search, Plus } from 'lucide-react';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { cn } from '@/lib/utils';

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
    <div className="space-y-6 p-8 bg-white dark:bg-slate-900 min-h-screen">
      {/* Premium Admin Header */}
      <div className="relative rounded-3xl overflow-hidden liquid-glass-strong px-5 py-5 md:px-7 md:py-6 flex flex-col md:flex-row items-center justify-between gap-5 border border-blue-500/10 dark:border-blue-500/5 shadow-2xl">
          {/* Ambient Glows */}
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-gradient-to-br from-blue-500/15 to-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-gradient-to-tr from-cyan-500/10 to-blue-600/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-row items-center gap-4 md:gap-5 relative z-10 w-full md:w-auto">
              <div className="p-2 md:p-3 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 rounded-xl md:rounded-[1.25rem] shadow-xl shadow-blue-500/25 transform -rotate-3 transition-transform hover:rotate-0 duration-300 shrink-0">
                  <Volume2 className="w-5 h-5 md:w-7 md:h-7 text-white" />
              </div>
              <div className="text-left">
                  <div className="flex items-center gap-2 mb-0.5">
                      {/* Branding removed as per user request */}
                  </div>
                  <h1 className="text-xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase md:normal-case leading-tight mb-1">
                      {t('audio.title')}
                  </h1>
                  <p className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400 font-bold md:font-medium leading-tight">
                      {t('audio.description')}
                  </p>
              </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 relative z-10 w-full md:w-auto">
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button className="h-11 px-6 rounded-xl md:rounded-full bg-white/50 dark:bg-black/20 backdrop-blur-md border hover:bg-white/80 dark:hover:bg-black/40 transition-all shadow-sm font-bold text-slate-700 dark:text-slate-200 gap-2">
                  <Upload className="h-4 w-4" />
                  {t('audio.uploadAudio')}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                {/* ... existing content ... */}
              </DialogContent>
            </Dialog>

            <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="h-11 px-6 rounded-xl md:rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold shadow-lg shadow-blue-500/20 transition-all hover:scale-105 active:scale-95 gap-2">
                  <Zap className="h-4 w-4" />
                  {t('audio.generateAudio')}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                {/* ... existing content ... */}
              </DialogContent>
            </Dialog>
          </div>
      </div>

      {/* Filters */}
      <GlassPanel variant="subtle" className="p-0 border-slate-200/50 dark:border-slate-700/50 shadow-sm overflow-hidden">
        <CardHeader className="py-3 px-6 border-b border-slate-100 dark:border-slate-800/50">
          <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-500">{t('common.filters')}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <div className="grid gap-4 md:grid-cols-5">
            {/* Search */}
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500 group-hover:text-blue-500 transition-colors" />
              <Input
                placeholder={t('audio.searchPlaceholder')}
                className="pl-10 h-11 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-100 dark:border-slate-700 focus:border-blue-500/50 transition-all rounded-xl text-slate-900 dark:text-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Lesson Filter */}
            <div className="relative">
              <Input
                placeholder={t('audio.lessonPlaceholder')}
                className="h-11 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-100 dark:border-slate-700 focus:border-blue-500/50 rounded-xl text-slate-900 dark:text-white"
                value={lessonFilter}
                onChange={(e) => setLessonFilter(e.target.value)}
              />
            </div>

            {/* Character Filter */}
            <div className="relative">
              <Input
                placeholder={t('audio.characterPlaceholder')}
                className="h-11 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-100 dark:border-slate-700 focus:border-blue-500/50 rounded-xl text-slate-900 dark:text-white"
                value={characterFilter}
                onChange={(e) => setCharacterFilter(e.target.value)}
              />
            </div>

            {/* Language Filter */}
            <Select value={languageFilter ? languageFilter : undefined} onValueChange={(value) => setLanguageFilter(value)}>
              <SelectTrigger className="h-11 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-100 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white">
                <SelectValue placeholder={t('audio.allLanguages')} />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
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
              className="h-11 rounded-xl font-bold bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {t('common.clear')}
            </Button>
          </div>
        </CardContent>
      </GlassPanel>

      {/* Results Info */}
      <div className="text-sm text-slate-600 dark:text-slate-400">
        {t('common.showing')} {filteredAudio.length} {t('audio.audioSegments')}
      </div>

      {/* Audio Table */}
      <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full bg-slate-200 dark:bg-slate-700" />
              ))}
            </div>
          ) : filteredAudio.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200 dark:border-slate-700">
                    <TableHead className="text-slate-900 dark:text-white">{t('common.id')}</TableHead>
                    <TableHead className="text-slate-900 dark:text-white">{t('audio.lesson')}</TableHead>
                    <TableHead className="text-slate-900 dark:text-white">{t('audio.character')}</TableHead>
                    <TableHead className="text-slate-900 dark:text-white">{t('audio.emotion')}</TableHead>
                    <TableHead className="text-slate-900 dark:text-white">{t('audio.language')}</TableHead>
                    <TableHead className="text-slate-900 dark:text-white">{t('audio.source')}</TableHead>
                    <TableHead className="text-slate-900 dark:text-white">{t('common.created')}</TableHead>
                    <TableHead className="text-slate-900 dark:text-white text-center">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAudio.map((segment) => (
                    <TableRow key={segment.public_id} className="border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                      <TableCell className="font-mono text-xs text-slate-600 dark:text-slate-400 max-w-xs truncate">
                        {segment.public_id}
                      </TableCell>
                      <TableCell>
                        {segment.lesson_id ? (
                          <Badge variant="outline" className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white">
                            {segment.lesson_id}
                          </Badge>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {segment.character_id ? (
                          <Badge variant="outline" className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white">
                            {segment.character_id}
                          </Badge>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white">
                          {segment.emotion}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100">
                          {(() => {
                            const lang = LANGUAGES.find((l) => l.code === segment.language_code);
                            return lang ? t(lang.labelKey) : segment.language_code;
                          })()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            segment.source === 'uploaded'
                              ? 'default'
                              : segment.source === 'generated'
                                ? 'secondary'
                                : 'outline'
                          }
                          className="capitalize bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white"
                        >
                          {segment.source}
                        </Badge>
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
                                className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                                title={t('common.delete')}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
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
                                  className="border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white"
                                >
                                  {t('common.cancel')}
                                </Button>
                                <Button
                                  variant="destructive"
                                  onClick={() => handleDelete(segment.public_id)}
                                  disabled={deleteMutation.isPending}
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
            <div className="text-center py-12">
              <Volume2 className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-500 mb-4" />
              <p className="text-slate-500 dark:text-slate-400">{t('audio.noFound')}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAudio;
