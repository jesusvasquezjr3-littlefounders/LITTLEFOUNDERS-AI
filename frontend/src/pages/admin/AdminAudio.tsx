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
import { Play, Trash2, Upload, Zap, Volume2, Search } from 'lucide-react';

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

  const audioSegments = audioData ? (audioData as PaginatedResponse).items : [];

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {t('audio.title')}
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            {t('audio.description')}
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="mr-2 h-4 w-4" />
                {t('audio.uploadAudio')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-slate-900 dark:text-white">
                  {t('audio.uploadTitle')}
                </DialogTitle>
                <DialogDescription className="text-slate-600 dark:text-slate-400">
                  {t('audio.uploadDescription')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="lesson_id" className="text-slate-900 dark:text-white">
                    {t('audio.lessonId')} ({t('common.optional')})
                  </Label>
                  <Input
                    id="lesson_id"
                    value={uploadForm.lesson_id}
                    onChange={(e) =>
                      setUploadForm({ ...uploadForm, lesson_id: e.target.value })
                    }
                    placeholder="e.g., les-001"
                    className="mt-1 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <Label htmlFor="character_id" className="text-slate-900 dark:text-white">
                    {t('audio.characterId')} ({t('common.optional')})
                  </Label>
                  <Input
                    id="character_id"
                    value={uploadForm.character_id}
                    onChange={(e) =>
                      setUploadForm({ ...uploadForm, character_id: e.target.value })
                    }
                    placeholder="e.g., char-001"
                    className="mt-1 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <Label htmlFor="emotion_select" className="text-slate-900 dark:text-white">
                    {t('audio.emotion')}
                  </Label>
                  <Select
                    value={uploadForm.emotion}
                    onValueChange={(value) =>
                      setUploadForm({ ...uploadForm, emotion: value })
                    }
                  >
                    <SelectTrigger id="emotion_select" className="mt-1 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                      {EMOTIONS.map((emotion) => (
                        <SelectItem key={emotion} value={emotion} className="text-slate-900 dark:text-white">
                          {emotion.charAt(0).toUpperCase() + emotion.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="language_select" className="text-slate-900 dark:text-white">
                    {t('audio.language')}
                  </Label>
                  <Select
                    value={uploadForm.language_code}
                    onValueChange={(value) =>
                      setUploadForm({ ...uploadForm, language_code: value })
                    }
                  >
                    <SelectTrigger id="language_select" className="mt-1 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                      {LANGUAGES.map((lang) => (
                        <SelectItem key={lang.code} value={lang.code} className="text-slate-900 dark:text-white">
                          {t(lang.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="audio_file" className="text-slate-900 dark:text-white">
                    {t('audio.audioFile')}
                  </Label>
                  <Input
                    id="audio_file"
                    type="file"
                    accept="audio/*"
                    onChange={(e) =>
                      setUploadForm({ ...uploadForm, file: e.target.files?.[0] || null })
                    }
                    className="mt-1 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white"
                  />
                  {uploadForm.file && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                      {uploadForm.file.name} ({(uploadForm.file.size / 1024).toFixed(2)} KB)
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setUploadDialogOpen(false)}
                    className="border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white"
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    onClick={handleUpload}
                    disabled={!uploadForm.file || uploadMutation.isPending}
                  >
                    {uploadMutation.isPending ? t('common.uploading') : t('audio.upload')}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white">
                <Zap className="mr-2 h-4 w-4" />
                {t('audio.generateAudio')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-slate-900 dark:text-white">
                  {t('audio.generateTitle')}
                </DialogTitle>
                <DialogDescription className="text-slate-600 dark:text-slate-400">
                  {t('audio.generateDescription')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="text_input" className="text-slate-900 dark:text-white">
                    {t('audio.textToSpeak')}
                  </Label>
                  <textarea
                    id="text_input"
                    value={generateForm.text}
                    onChange={(e) =>
                      setGenerateForm({ ...generateForm, text: e.target.value })
                    }
                    placeholder={t('audio.textPlaceholder')}
                    className="w-full p-2 border rounded-lg mt-1 min-h-20 font-sans text-sm bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <Label htmlFor="gen_character_id" className="text-slate-900 dark:text-white">
                    {t('audio.characterId')}
                  </Label>
                  <Input
                    id="gen_character_id"
                    value={generateForm.character_id}
                    onChange={(e) =>
                      setGenerateForm({ ...generateForm, character_id: e.target.value })
                    }
                    placeholder="e.g., char-001"
                    className="mt-1 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <Label htmlFor="gen_emotion" className="text-slate-900 dark:text-white">
                    {t('audio.emotion')}
                  </Label>
                  <Select
                    value={generateForm.emotion}
                    onValueChange={(value) =>
                      setGenerateForm({ ...generateForm, emotion: value })
                    }
                  >
                    <SelectTrigger id="gen_emotion" className="mt-1 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                      {EMOTIONS.map((emotion) => (
                        <SelectItem key={emotion} value={emotion} className="text-slate-900 dark:text-white">
                          {emotion.charAt(0).toUpperCase() + emotion.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setGenerateDialogOpen(false)}
                    className="border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white"
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    onClick={handleGenerate}
                    disabled={!generateForm.text || !generateForm.character_id || generateMutation.isPending}
                  >
                    {generateMutation.isPending ? t('common.generating') : t('audio.generate')}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="text-base text-slate-900 dark:text-white">
            {t('common.filters')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
              <Input
                placeholder={t('audio.searchPlaceholder')}
                className="pl-10 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Lesson Filter */}
            <Input
              placeholder={t('audio.lessonPlaceholder')}
              className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white"
              value={lessonFilter}
              onChange={(e) => setLessonFilter(e.target.value)}
            />

            {/* Character Filter */}
            <Input
              placeholder={t('audio.characterPlaceholder')}
              className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white"
              value={characterFilter}
              onChange={(e) => setCharacterFilter(e.target.value)}
            />

            {/* Language Filter */}
            <Select value={languageFilter ? languageFilter : undefined} onValueChange={(value) => setLanguageFilter(value)}>
              <SelectTrigger className="bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white">
                <SelectValue placeholder={t('audio.allLanguages')} />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
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
              className="border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white"
            >
              {t('common.clear')}
            </Button>
          </div>
        </CardContent>
      </Card>

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
