import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  useAdminLesson,
  useCreateLesson,
  useUpdateLesson,
  useValidateLesson,
  Lesson,
} from '@/hooks/useAdminLessons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
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
import {
  AlertCircle, CheckCircle, Save, X, Eye, Plus, Edit, Trash2, ArrowLeft,
  Copy, ChevronUp, ChevronDown, GripVertical,
} from 'lucide-react';
import { ExercisePreview } from '@/components/admin/ExercisePreview';
import {
  EXERCISE_TYPE_GROUPS,
  ALL_EXERCISE_TYPES,
  EXERCISE_TYPE_ICONS,
  getExerciseEditor,
} from '@/components/admin/ExerciseEditorForms';
import { CHARACTER_OPTIONS, getGestureLabels } from '@/utils/gestureMapper';
import { DinoCharacter } from '@/components/demo/DinoCharacter';
import { DinaCharacter } from '@/components/demo/DinaCharacter';
import DrRhoCharacter from '@/components/demo/DrRhoCharacter';
import ZaraVexCharacter from '@/components/demo/ZaraVexCharacter';

// ── Types ──

interface ExerciseContent {
  type?: string;
  content?: any;
  correct_answer?: any;
  feedback?: any;
  character_code?: string;
  [key: string]: any;
}

interface LessonFormData {
  lesson_code: string;
  title_es: string;
  title_en: string;
  description_es: string;
  description_en: string;
  duration: number;
  age_rate: string;
  points_reward: number;
  adventure_level: number;
  saga_level: number;
  topic_level: number;
  lesson_number: number;
  content_es: ExerciseContent[];
  content_en: ExerciseContent[];
}

// ── Helper: Parse JSON content safely ──

function parseContent(raw: any): ExerciseContent[] {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ── Component ──

export const AdminLessonEditor: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation('admin');
  const isNew = !id;

  const { data: fetchedLesson, isLoading } = useAdminLesson(id || '');
  const createLesson = useCreateLesson();
  const updateLesson = useUpdateLesson();
  const validateLesson = useValidateLesson();

  const [lessonData, setLessonData] = useState<LessonFormData>({
    lesson_code: '', title_es: '', title_en: '',
    description_es: '', description_en: '',
    duration: 180, age_rate: "4-6", points_reward: 100,
    adventure_level: 1, saga_level: 1, topic_level: 1, lesson_number: 1,
    content_es: [], content_en: [],
  });

  const [selectedExerciseIndex, setSelectedExerciseIndex] = useState<number | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isEditing, setIsEditing] = useState(isNew);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLang, setPreviewLang] = useState<'es' | 'en'>('es');
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);

  // Load fetched lesson
  useEffect(() => {
    if (fetchedLesson && !isNew) {
      setLessonData({
        ...fetchedLesson,
        content_es: parseContent(fetchedLesson.content_es),
        content_en: parseContent(fetchedLesson.content_en),
      });
    }
  }, [fetchedLesson, isNew]);

  // ── Handlers ──

  const handleField = (field: keyof LessonFormData, value: any) => {
    setLessonData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddExercise = (type: string) => {
    const newEx: ExerciseContent = { type, content: {}, feedback: {} };
    setLessonData((prev) => ({
      ...prev,
      content_es: [...prev.content_es, newEx],
      content_en: [...prev.content_en, { ...newEx }],
    }));
    setSelectedExerciseIndex(lessonData.content_es.length);
    setAddDialogOpen(false);
  };

  const handleUpdateExercise = (lang: 'es' | 'en', updates: Partial<ExerciseContent>) => {
    if (selectedExerciseIndex === null) return;
    const key = lang === 'es' ? 'content_es' : 'content_en';
    setLessonData((prev) => ({
      ...prev,
      [key]: prev[key].map((ex, idx) =>
        idx === selectedExerciseIndex ? { ...ex, ...updates } : ex
      ),
    }));
  };

  const handleDeleteExercise = (index: number) => {
    setLessonData((prev) => ({
      ...prev,
      content_es: prev.content_es.filter((_, i) => i !== index),
      content_en: prev.content_en.filter((_, i) => i !== index),
    }));
    if (selectedExerciseIndex === index) setSelectedExerciseIndex(null);
    else if (selectedExerciseIndex !== null && selectedExerciseIndex > index) {
      setSelectedExerciseIndex(selectedExerciseIndex - 1);
    }
  };

  const handleDuplicateExercise = (index: number) => {
    setLessonData((prev) => {
      const esClone = JSON.parse(JSON.stringify(prev.content_es[index]));
      const enClone = JSON.parse(JSON.stringify(prev.content_en[index]));
      const newEs = [...prev.content_es];
      const newEn = [...prev.content_en];
      newEs.splice(index + 1, 0, esClone);
      newEn.splice(index + 1, 0, enClone);
      return { ...prev, content_es: newEs, content_en: newEn };
    });
    setSelectedExerciseIndex(index + 1);
  };

  const handleMoveExercise = (from: number, to: number) => {
    if (to < 0 || to >= lessonData.content_es.length) return;
    setLessonData((prev) => {
      const moveArr = (arr: ExerciseContent[]) => {
        const next = [...arr];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        return next;
      };
      return { ...prev, content_es: moveArr(prev.content_es), content_en: moveArr(prev.content_en) };
    });
    setSelectedExerciseIndex(to);
  };

  // HTML5 Drag & Drop handlers
  const handleDragStart = (idx: number) => (e: React.DragEvent) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    (e.target as HTMLElement).style.opacity = '0.5';
  };
  const handleDragEnd = (e: React.DragEvent) => {
    (e.target as HTMLElement).style.opacity = '1';
    if (dragIdx !== null && dropIdx !== null && dragIdx !== dropIdx) {
      handleMoveExercise(dragIdx, dropIdx);
    }
    setDragIdx(null);
    setDropIdx(null);
  };
  const handleDragOver = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropIdx(idx);
  };

  const handleValidate = async () => {
    if (!id) { setValidationErrors([t('editor.mustSaveFirst')]); return; }
    try {
      const result = await validateLesson.mutateAsync(id);
      setValidationErrors(result.is_valid ? [] : [...(result.errors_es || []), ...(result.errors_en || [])]);
    } catch {
      setValidationErrors([t('editor.validationError')]);
    }
  };

  const handleSave = async () => {
    try {
      const apiData = {
        ...lessonData,
        // Don't stringify - backend expects arrays, not strings
        content_es: lessonData.content_es,
        content_en: lessonData.content_en,
      };
      if (isNew) {
        const result = await createLesson.mutateAsync(apiData as unknown as Omit<Lesson, 'id' | 'created_at' | 'updated_at'>);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        setIsEditing(false);
        if (result?.id) navigate(`/admin/lessons/${result.id}/edit`);
      } else {
        await updateLesson.mutateAsync({ id: id || '', lesson: apiData as unknown as Partial<Lesson> });
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        setIsEditing(false);
      }
    } catch {
      setValidationErrors([t('editor.saveError')]);
    }
  };

  const handleDiscard = () => {
    if (isNew) { navigate('/admin/lessons'); return; }
    setIsEditing(false);
    if (fetchedLesson) {
      setLessonData({
        ...fetchedLesson,
        content_es: parseContent(fetchedLesson.content_es),
        content_en: parseContent(fetchedLesson.content_en),
      });
    }
  };

  // ── Selected exercise ──
  const selectedExerciseEs = selectedExerciseIndex !== null ? lessonData.content_es[selectedExerciseIndex] : null;
  const selectedExerciseEn = selectedExerciseIndex !== null ? lessonData.content_en[selectedExerciseIndex] : null;
  const selectedType = selectedExerciseEs?.type || 'multiple_choice';
  const ExerciseEditor = getExerciseEditor(selectedType);

  // ── Loading ──
  if (isLoading && !isNew) {
    return (
      <div className="space-y-6 p-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 lg:p-8 dark:bg-slate-950 dark:text-slate-50 max-w-[1400px] mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/lessons')} className="dark:text-slate-400 dark:hover:text-slate-50">
            <ArrowLeft className="h-4 w-4 mr-1" /> {t('editor.backToLessons')}
          </Button>
          <Separator orientation="vertical" className="h-6 dark:bg-slate-700" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight dark:text-slate-50">
              {isNew ? t('editor.createNew') : `${t('editor.editTitle')}: ${lessonData.lesson_code}`}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isNew ? t('editor.createNewDesc') : t('editor.editDesc')}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isEditing && (
            <>
              <Button variant="outline" onClick={handleDiscard} className="dark:border-slate-700 dark:text-slate-50 dark:hover:bg-slate-800">
                <X className="mr-2 h-4 w-4" /> {t('editor.discard')}
              </Button>
              <Button variant="outline" onClick={handleValidate} disabled={validateLesson.isPending} className="dark:border-slate-700 dark:text-slate-50 dark:hover:bg-slate-800">
                {t('editor.validate')}
              </Button>
              <Button onClick={handleSave} disabled={createLesson.isPending || updateLesson.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-700">
                <Save className="mr-2 h-4 w-4" />
                {createLesson.isPending || updateLesson.isPending ? t('editor.saving') : t('editor.save')}
              </Button>
            </>
          )}
          {!isEditing && !isNew && (
            <Button onClick={() => setIsEditing(true)} className="dark:bg-blue-600 dark:hover:bg-blue-700">
              <Edit className="mr-2 h-4 w-4" /> {t('editor.edit')}
            </Button>
          )}
        </div>
      </div>

      {/* ── Alerts ── */}
      {validationErrors.length > 0 && (
        <Alert variant="destructive" className="dark:bg-red-950 dark:border-red-800 dark:text-red-200">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-semibold mb-1">{t('editor.validationErrors')}:</p>
            <ul className="list-disc list-inside space-y-0.5 text-sm">
              {validationErrors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      {saveSuccess && (
        <Alert className="bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800">
          <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <AlertDescription className="text-emerald-800 dark:text-emerald-200">{t('editor.savedSuccess')}</AlertDescription>
        </Alert>
      )}

      {/* ── Metadata ── */}
      <Card className="dark:bg-slate-800 dark:border-slate-700">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg dark:text-slate-50">{t('editor.metadata')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Code + Lesson Number */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="dark:text-slate-300">{t('editor.code')}</Label>
              <Input value={lessonData.lesson_code}
                onChange={(e) => handleField('lesson_code', e.target.value)}
                disabled={!isEditing} placeholder={t('editor.codePlaceholder')}
                className="mt-1 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50" />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{t('editor.codeHelp')}</p>
            </div>
            <div>
              <Label className="dark:text-slate-300">{t('editor.lessonNumber')}</Label>
              <Input type="number" value={lessonData.lesson_number}
                onChange={(e) => handleField('lesson_number', parseInt(e.target.value))}
                disabled={!isEditing} min={1}
                className="mt-1 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50" />
            </div>
          </div>

          {/* Bilingual Titles */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="bg-blue-50/50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-100 dark:border-blue-900/50">
              <Label className="text-blue-700 dark:text-blue-300 text-xs font-semibold uppercase tracking-wider">🇲🇽 {t('editor.titleES')}</Label>
              <Input value={lessonData.title_es}
                onChange={(e) => handleField('title_es', e.target.value)}
                disabled={!isEditing} placeholder={t('editor.titleESPlaceholder')}
                className="mt-1 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50" />
            </div>
            <div className="bg-red-50/50 dark:bg-red-950/20 p-3 rounded-lg border border-red-100 dark:border-red-900/50">
              <Label className="text-red-700 dark:text-red-300 text-xs font-semibold uppercase tracking-wider">🇺🇸 {t('editor.titleEN')}</Label>
              <Input value={lessonData.title_en}
                onChange={(e) => handleField('title_en', e.target.value)}
                disabled={!isEditing} placeholder={t('editor.titleENPlaceholder')}
                className="mt-1 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50" />
            </div>
          </div>

          {/* Bilingual Descriptions */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="bg-blue-50/50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-100 dark:border-blue-900/50">
              <Label className="text-blue-700 dark:text-blue-300 text-xs font-semibold uppercase tracking-wider">🇲🇽 {t('editor.descriptionES')}</Label>
              <Textarea value={lessonData.description_es}
                onChange={(e) => handleField('description_es', e.target.value)}
                disabled={!isEditing} placeholder={t('editor.descriptionESPlaceholder')}
                className="mt-1 min-h-20 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50" />
            </div>
            <div className="bg-red-50/50 dark:bg-red-950/20 p-3 rounded-lg border border-red-100 dark:border-red-900/50">
              <Label className="text-red-700 dark:text-red-300 text-xs font-semibold uppercase tracking-wider">🇺🇸 {t('editor.descriptionEN')}</Label>
              <Textarea value={lessonData.description_en}
                onChange={(e) => handleField('description_en', e.target.value)}
                disabled={!isEditing} placeholder={t('editor.descriptionENPlaceholder')}
                className="mt-1 min-h-20 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50" />
            </div>
          </div>

          {/* Numeric & Level Fields */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            <div>
              <Label className="dark:text-slate-300 text-xs">{t('editor.duration')}</Label>
              <Input type="number" value={lessonData.duration}
                onChange={(e) => handleField('duration', parseInt(e.target.value))}
                disabled={!isEditing} min={1}
                className="mt-1 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50" />
            </div>
            <div>
              <Label className="dark:text-slate-300 text-xs">{t('editor.ageRate')}</Label>
              <Select value={lessonData.age_rate}
                onValueChange={(v) => handleField('age_rate', v)} disabled={!isEditing}>
                <SelectTrigger className="mt-1 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="dark:bg-slate-700 dark:border-slate-600">
                  <SelectItem value="4-6" className="dark:text-slate-50">4-6</SelectItem>
                  <SelectItem value="7-9" className="dark:text-slate-50">7-9</SelectItem>
                  <SelectItem value="10-12" className="dark:text-slate-50">10-12</SelectItem>
                  <SelectItem value="13+" className="dark:text-slate-50">13+</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="dark:text-slate-300 text-xs">{t('editor.points')}</Label>
              <Input type="number" value={lessonData.points_reward}
                onChange={(e) => handleField('points_reward', parseInt(e.target.value))}
                disabled={!isEditing} min={0}
                className="mt-1 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50" />
            </div>
            {[
              { field: 'adventure_level' as const, label: t('editor.adventureLevel'), max: 6 },
              { field: 'saga_level' as const, label: t('editor.sagaLevel'), max: 5 },
              { field: 'topic_level' as const, label: t('editor.topicLevel'), max: 4 },
            ].map(({ field, label, max }) => (
              <div key={field}>
                <Label className="dark:text-slate-300 text-xs">{label}</Label>
                <Select value={lessonData[field].toString()}
                  onValueChange={(v) => handleField(field, parseInt(v))} disabled={!isEditing}>
                  <SelectTrigger className="mt-1 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-slate-700 dark:border-slate-600">
                    {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
                      <SelectItem key={n} value={n.toString()} className="dark:text-slate-50">
                        {t('editor.level')} {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Exercise Timeline ── */}
      <Card className="dark:bg-slate-800 dark:border-slate-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg dark:text-slate-50">
              {t('editor.exercises')} ({lessonData.content_es.length})
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Timeline Strip */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {lessonData.content_es.map((exercise, idx) => {
              const icon = EXERCISE_TYPE_ICONS[exercise.type || ''] || '❓';
              const typeName = t(`editor.types.${exercise.type}`, exercise.type || 'unknown');
              const isSelected = selectedExerciseIndex === idx;
              const isDragOver = dropIdx === idx && dragIdx !== idx;
              return (
                <button key={idx} onClick={() => setSelectedExerciseIndex(idx)}
                  draggable={isEditing}
                  onDragStart={handleDragStart(idx)}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver(idx)}
                  className={`flex-shrink-0 w-24 h-24 rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all duration-200 relative
                    ${isSelected
                      ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/50 shadow-lg scale-105'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow dark:border-slate-600 dark:bg-slate-700 dark:hover:border-slate-500'
                    }
                    ${isDragOver ? 'ring-2 ring-blue-400 ring-offset-2 dark:ring-offset-slate-800' : ''}
                    ${isEditing ? 'cursor-grab active:cursor-grabbing' : ''}`}
                >
                  {isEditing && (
                    <GripVertical className="absolute top-1 right-1 h-3 w-3 text-gray-300 dark:text-gray-500" />
                  )}
                  <span className="text-2xl">{icon}</span>
                  <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300 leading-tight text-center px-1 line-clamp-2">
                    {typeName}
                  </span>
                  <span className="text-[9px] text-gray-400 dark:text-gray-500">#{idx + 1}</span>
                </button>
              );
            })}
            {/* Add button */}
            {isEditing && (
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <button className="flex-shrink-0 w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 dark:border-slate-500 flex flex-col items-center justify-center gap-1 hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:border-emerald-500 dark:hover:bg-emerald-900/20 transition-all">
                    <Plus className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">{t('editor.addExercise')}</span>
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-lg dark:bg-slate-800 dark:text-slate-50 dark:border-slate-700 max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="dark:text-slate-50">{t('editor.addExercise')}</DialogTitle>
                    <DialogDescription className="dark:text-gray-400">{t('editor.selectType')}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    {EXERCISE_TYPE_GROUPS.map((group) => (
                      <div key={group.key}>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                          {group.emoji} {t(`editor.${group.key}`)}
                        </h4>
                        <div className="grid grid-cols-2 gap-1.5">
                          {group.types.map((type) => (
                            <button key={type} onClick={() => handleAddExercise(type)}
                              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                              <span>{EXERCISE_TYPE_ICONS[type]}</span>
                              <span className="dark:text-slate-200">{t(`editor.types.${type}`)}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {lessonData.content_es.length === 0 && (
            <div className="text-center py-8 text-gray-400 dark:text-gray-500">
              <p>{t('editor.noExercises')}</p>
            </div>
          )}

          <Separator className="dark:bg-slate-700" />

          {/* ── Bilingual Exercise Editor ── */}
          {selectedExerciseEs && selectedExerciseEn ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold dark:text-slate-50 flex items-center gap-2">
                  <span className="text-xl">{EXERCISE_TYPE_ICONS[selectedType]}</span>
                  {t('editor.exercise')} #{selectedExerciseIndex! + 1}: {t(`editor.types.${selectedType}`)}
                </h3>
                <div className="flex gap-2 flex-wrap">
                  {/* Preview button (always visible) */}
                  <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}
                    className="dark:border-slate-600 dark:text-slate-50 dark:hover:bg-slate-700">
                    <Eye className="h-4 w-4 mr-1" /> {t('editor.preview')}
                  </Button>
                  {isEditing && (
                    <>
                      {/* Move up/down */}
                      <Button variant="outline" size="sm" onClick={() => handleMoveExercise(selectedExerciseIndex!, selectedExerciseIndex! - 1)}
                        disabled={selectedExerciseIndex === 0}
                        className="dark:border-slate-600 dark:text-slate-50 dark:hover:bg-slate-700" title={t('editor.moveUp')}>
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleMoveExercise(selectedExerciseIndex!, selectedExerciseIndex! + 1)}
                        disabled={selectedExerciseIndex === lessonData.content_es.length - 1}
                        className="dark:border-slate-600 dark:text-slate-50 dark:hover:bg-slate-700" title={t('editor.moveDown')}>
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      {/* Duplicate */}
                      <Button variant="outline" size="sm" onClick={() => handleDuplicateExercise(selectedExerciseIndex!)}
                        className="dark:border-slate-600 dark:text-slate-50 dark:hover:bg-slate-700" title={t('editor.duplicate')}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      {/* Type change */}
                      <Select value={selectedType}
                        onValueChange={(v) => {
                          handleUpdateExercise('es', { type: v });
                          handleUpdateExercise('en', { type: v });
                        }}>
                        <SelectTrigger className="w-48 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="dark:bg-slate-700 dark:border-slate-600 max-h-60">
                          {ALL_EXERCISE_TYPES.map((type) => (
                            <SelectItem key={type} value={type} className="dark:text-slate-50">
                              {EXERCISE_TYPE_ICONS[type]} {t(`editor.types.${type}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="destructive" size="sm"
                        onClick={() => handleDeleteExercise(selectedExerciseIndex!)}
                        className="dark:bg-red-600 dark:hover:bg-red-700">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Character & Gesture Selector Row */}
              {isEditing && (
                <div className="flex items-center gap-3 flex-wrap p-3 bg-gradient-to-r from-purple-50/50 to-indigo-50/50 dark:from-purple-950/20 dark:to-indigo-950/20 rounded-xl border border-purple-100 dark:border-purple-900/50">
                  {/* Character Selector */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-semibold text-purple-700 dark:text-purple-300 whitespace-nowrap">
                      {t('editor.fields.character')}
                    </Label>
                    <Select
                      value={selectedExerciseEs?.character_code || ''}
                      onValueChange={(v) => {
                        handleUpdateExercise('es', { character_code: v, character_mood: undefined });
                        handleUpdateExercise('en', { character_code: v, character_mood: undefined });
                      }}
                    >
                      <SelectTrigger className="w-40 h-8 text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50">
                        <SelectValue placeholder={t('editor.fields.selectCharacter')} />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-slate-700 dark:border-slate-600">
                        {CHARACTER_OPTIONS.map((char) => (
                          <SelectItem key={char.code} value={char.code} className="dark:text-slate-50">
                            {char.emoji} {char.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Gesture Selector (dynamic based on character) */}
                  {selectedExerciseEs?.character_code && (
                    <div className="flex items-center gap-2">
                      <Label className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 whitespace-nowrap">
                        {t('editor.fields.gesture')}
                      </Label>
                      <Select
                        value={selectedExerciseEs?.character_mood || ''}
                        onValueChange={(v) => {
                          handleUpdateExercise('es', { character_mood: v });
                          handleUpdateExercise('en', { character_mood: v });
                        }}
                      >
                        <SelectTrigger className="w-44 h-8 text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-slate-50">
                          <SelectValue placeholder={t('editor.fields.selectGesture')} />
                        </SelectTrigger>
                        <SelectContent className="dark:bg-slate-700 dark:border-slate-600">
                          {getGestureLabels(selectedExerciseEs.character_code).map((g) => (
                            <SelectItem key={g.value} value={g.value} className="dark:text-slate-50">
                              {g.emoji} {i18n.language === 'en' ? g.labelEn : g.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Live Character Mini Preview */}
                  {selectedExerciseEs?.character_code && (
                    <div className="ml-auto flex-shrink-0 w-32 h-32 flex items-center justify-center bg-white/50 dark:bg-slate-900/50 rounded-lg backdrop-blur-sm shadow-inner p-2 border border-slate-200 dark:border-slate-700">
                      {(() => {
                        const code = selectedExerciseEs.character_code;
                        const mood = selectedExerciseEs.character_mood;
                        const cls = "w-full h-full object-contain filter drop-shadow-lg";
                        switch (code) {
                          case 'dina': return <DinaCharacter className={cls} expression={(mood || 'happy') as any} />;
                          case 'dr_rho': return <DrRhoCharacter className={cls} mood={(mood || 'wise') as any} />;
                          case 'zara_vex': return <ZaraVexCharacter className={cls} mood={(mood || 'happy') as any} />;
                          default: return <DinoCharacter className={cls} mood={(mood || 'happy') as any} showBubble={false} />;
                        }
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Side-by-side bilingual editors */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="bg-blue-50/30 dark:bg-blue-950/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/50">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm">🇲🇽</span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                      {t('editor.spanish')}
                    </span>
                  </div>
                  <ExerciseEditor
                    exercise={selectedExerciseEs}
                    onChange={(updates) => handleUpdateExercise('es', updates)}
                    disabled={!isEditing}
                    t={t}
                  />
                </div>
                <div className="bg-red-50/30 dark:bg-red-950/20 p-4 rounded-xl border border-red-100 dark:border-red-900/50">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm">🇺🇸</span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-red-700 dark:text-red-300">
                      {t('editor.english')}
                    </span>
                  </div>
                  <ExerciseEditor
                    exercise={selectedExerciseEn}
                    onChange={(updates) => handleUpdateExercise('en', updates)}
                    disabled={!isEditing}
                    t={t}
                  />
                </div>
              </div>
            </div>
          ) : (
            lessonData.content_es.length > 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>{t('editor.noExerciseSelected')}</p>
              </div>
            )
          )}
        </CardContent>
      </Card>

      {/* ── Preview Dialog ── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-md dark:bg-slate-900 dark:text-slate-50 dark:border-slate-700">
          <DialogHeader>
            <DialogTitle className="dark:text-slate-50 flex items-center gap-2">
              <Eye className="h-5 w-5" /> {t('editor.previewTitle')}
            </DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              {t(`editor.types.${selectedType}`)}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center gap-2 mb-2">
            <Button variant={previewLang === 'es' ? 'default' : 'outline'} size="sm"
              onClick={() => setPreviewLang('es')}
              className={previewLang === 'es' ? 'bg-blue-600 hover:bg-blue-700' : 'dark:border-slate-600 dark:text-slate-50'}>
              🇲🇽 ES
            </Button>
            <Button variant={previewLang === 'en' ? 'default' : 'outline'} size="sm"
              onClick={() => setPreviewLang('en')}
              className={previewLang === 'en' ? 'bg-red-600 hover:bg-red-700' : 'dark:border-slate-600 dark:text-slate-50'}>
              🇺🇸 EN
            </Button>
          </div>
          <ExercisePreview
            exercise={previewLang === 'es' ? selectedExerciseEs : selectedExerciseEn}
            t={t}
          />
        </DialogContent>
      </Dialog>

      {/* ── Floating save bar ── */}
      {isEditing && (
        <div className="fixed bottom-6 right-6 flex gap-2 z-50">
          <Button variant="outline" onClick={handleDiscard}
            className="shadow-lg dark:border-slate-600 dark:text-slate-50 dark:hover:bg-slate-800 dark:bg-slate-800">
            {t('editor.discard')}
          </Button>
          <Button onClick={handleSave} disabled={createLesson.isPending || updateLesson.isPending}
            className="shadow-lg bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-700">
            <Save className="mr-2 h-4 w-4" />
            {t('editor.save')}
          </Button>
        </div>
      )}
    </div>
  );
};

export default AdminLessonEditor;
