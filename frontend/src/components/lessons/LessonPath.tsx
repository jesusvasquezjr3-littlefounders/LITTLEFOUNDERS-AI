/**
 * LessonPath - Ruta gamificada por Temas (Units) estilo Duolingo
 * Mobile-first, dark mode compatible, grouped by Topic
 */
import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Check, Lock, Star, Play, BookOpen, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Badge } from '@/components/ui/badge';
import { LessonItem } from './hooks/useLessonsList';

interface LessonPathProps {
    lessons: LessonItem[];
    isLoading?: boolean;
    sagaTitle?: string;
    themeColor?: string;
}

const THEME_COLORS: Record<string, { bg: string; border: string; text: string; light: string }> = {
    archipelago: { bg: 'bg-cyan-500', border: 'border-cyan-600', text: 'text-cyan-500', light: 'bg-cyan-100 dark:bg-cyan-900/30' },
    forest: { bg: 'bg-emerald-500', border: 'border-emerald-600', text: 'text-emerald-500', light: 'bg-emerald-100 dark:bg-emerald-900/30' },
    city: { bg: 'bg-orange-500', border: 'border-orange-600', text: 'text-orange-500', light: 'bg-orange-100 dark:bg-orange-900/30' },
    valley: { bg: 'bg-purple-500', border: 'border-purple-600', text: 'text-purple-500', light: 'bg-purple-100 dark:bg-purple-900/30' },
    kingdom: { bg: 'bg-amber-500', border: 'border-amber-600', text: 'text-amber-500', light: 'bg-amber-100 dark:bg-amber-900/30' },
    cosmos: { bg: 'bg-indigo-500', border: 'border-indigo-600', text: 'text-indigo-500', light: 'bg-indigo-100 dark:bg-indigo-900/30' },
};

interface LessonNodeProps {
    lesson: LessonItem;
    index: number;
    isLocked: boolean;
    isCurrentLesson: boolean;
    theme: string;
    totalInUnit: number;
}

const LessonNode: React.FC<LessonNodeProps> = ({
    lesson,
    index,
    isLocked,
    isCurrentLesson,
    theme,
    totalInUnit
}) => {
    const { t } = useTranslation('lessons');
    const navigate = useNavigate();
    const colors = isLocked
        ? { bg: 'bg-gray-300 dark:bg-gray-700', border: 'border-gray-400 dark:border-gray-600', text: 'text-gray-400' }
        : THEME_COLORS[theme] || THEME_COLORS.archipelago;

    const handleClick = () => {
        if (!isLocked) {
            navigate(`/lesson/${lesson.code}`);
        }
    };

    // Calculate winding position (sine wave approx)
    // 0 -> 0, 1 -> -40, 2 -> 0, 3 -> +40
    // Actually let's do a smoother curve: 0, -30, -40, -30, 0, 30, 40, 30
    const wavePattern = [0, -50, 0, 50];
    const xOffset = wavePattern[index % 4];

    return (
        <div
            className="relative flex items-center justify-center py-4 z-10"
            style={{
                transform: `translateX(${xOffset}px)`
            }}
        >
            <HoverCard openDelay={200}>
                <HoverCardTrigger asChild>
                    <button
                        onClick={handleClick}
                        disabled={isLocked}
                        className={`
                            group relative w-20 h-16 rounded-[30px] flex items-center justify-center
                            transition-all duration-200 active:scale-95 outline-none
                            ${colors.bg}
                            border-b-[6px] ${colors.border} active:border-b-0 active:translate-y-[6px]
                            ${isLocked ? 'opacity-80 cursor-not-allowed' : 'cursor-pointer hover:brightness-110 shadow-xl'}
                        `}
                    >
                        {/* Internal Highlight */}
                        <div className="absolute top-2 left-3 w-6 h-3 bg-white/30 rounded-full" />

                        {/* Icon */}
                        <div className="text-white drop-shadow-md relative z-10">
                            {lesson.completed ? (
                                <Check strokeWidth={4} className="w-8 h-8" />
                            ) : isLocked ? (
                                <Lock className="w-6 h-6 opacity-70" />
                            ) : isCurrentLesson ? (
                                <Play fill="currentColor" className="w-8 h-8 ml-1" />
                            ) : (
                                <Star fill="currentColor" className="w-8 h-8" />
                            )}
                        </div>

                        {/* Stars for score/mastery (tiny dots) if completed */}
                        {lesson.completed && (
                            <div className="absolute -bottom-8 flex gap-1">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className={`w-2 h-2 rounded-full ${i <= (lesson.score > 80 ? 3 : 2) ? 'bg-yellow-400' : 'bg-gray-300 dark:bg-gray-700'}`} />
                                ))}
                            </div>
                        )}
                    </button>
                </HoverCardTrigger>

                {/* Preview Content */}
                <HoverCardContent side="top" className="w-72 p-0 overflow-hidden border-2 shadow-xl z-50">
                    <div className={`h-2 w-full ${colors.bg}`} />
                    <div className="p-4 bg-popover/95 backdrop-blur-sm">
                        <h4 className="text-sm font-bold mb-1 flex items-center gap-2">
                            {lesson.title}
                            {lesson.completed && <Check className="w-4 h-4 text-green-500" />}
                        </h4>
                        <p className="text-xs text-muted-foreground mb-3 line-clamp-3">
                            {lesson.description || t('locked_description')}
                        </p>

                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px] gap-1 h-5 px-1.5">
                                <Clock className="w-3 h-3" /> {Math.ceil(lesson.duration / 60)} min
                            </Badge>
                            <Badge variant="outline" className="text-[10px] gap-1 h-5 px-1.5 border-yellow-500/50 text-yellow-600 dark:text-yellow-400">
                                <Star className="w-3 h-3 fill-yellow-500" /> +{lesson.pointsReward} pts
                            </Badge>
                            {isLocked && (
                                <Badge variant="outline" className="text-[10px] h-5 px-1.5 ml-auto text-gray-400 border-dashed">
                                    <Lock className="w-3 h-3 mr-1" /> {t('locked')}
                                </Badge>
                            )}
                        </div>
                    </div>
                </HoverCardContent>
            </HoverCard>
        </div>
    );
};

export const LessonPath: React.FC<LessonPathProps> = ({
    lessons,
    isLoading,
    sagaTitle,
    themeColor = 'archipelago'
}) => {
    const { t } = useTranslation('lessons');
    const colors = THEME_COLORS[themeColor] || THEME_COLORS.archipelago;

    // Group lessons by Topic
    const groupedLessons = useMemo(() => {
        const groups: Record<number, { title: string, lessons: LessonItem[] }> = {};
        lessons.forEach(l => {
            if (!groups[l.topicLevel]) {
                groups[l.topicLevel] = { title: l.topicTitle || `${t('unit')} ${l.topicLevel}`, lessons: [] };
            }
            groups[l.topicLevel].lessons.push(l);
        });
        return Object.entries(groups).sort(([a], [b]) => Number(a) - Number(b)).map(([_, val]) => val);
    }, [lessons]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center py-12 space-y-8">
                {[1, 2].map(i => (
                    <div key={i} className="w-full max-w-sm">
                        <div className="h-16 w-full rounded-2xl bg-gray-200 dark:bg-gray-800 animate-pulse mb-8"></div>
                        <div className="flex flex-col items-center gap-6">
                            <div className="w-20 h-16 rounded-[30px] bg-gray-200 dark:bg-gray-800 animate-pulse" />
                            <div className="w-20 h-16 rounded-[30px] bg-gray-200 dark:bg-gray-800 animate-pulse translate-x-8" />
                            <div className="w-20 h-16 rounded-[30px] bg-gray-200 dark:bg-gray-800 animate-pulse" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (lessons.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">
                    {t('no_lessons', { defaultValue: 'No hay lecciones disponibles.' })}
                </p>
            </div>
        );
    }

    // Find first incomplete lesson global index
    const firstIncompleteGlobalIndex = lessons.findIndex(l => !l.completed);
    const currentLessonGlobalIndex = firstIncompleteGlobalIndex === -1 ? lessons.length - 1 : firstIncompleteGlobalIndex;
    const currentLessonId = lessons[currentLessonGlobalIndex]?.id || -1;

    return (
        <div className="w-full py-2 pb-32">

            {/* Units */}
            <div className="space-y-4">
                {groupedLessons.map((group, groupIndex) => (
                    <div key={groupIndex} className="relative">
                        {/* Unit Header */}
                        <div className={cn(
                            "sticky top-0 z-30 mb-8 mx-2 p-5 rounded-2xl",
                            "flex items-center justify-between text-white relative overflow-hidden",
                            "shadow-xl",
                            colors.bg
                        )}
                        style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.3)' }}>
                            {/* Glass inner highlight */}
                            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none rounded-2xl" />
                            <div>
                                <h3 className="uppercase text-xs font-bold opacity-80 mb-1 tracking-wider relative">
                                    {t('unit')} {groupIndex + 1}
                                </h3>
                                <h2 className="text-lg font-black leading-tight relative">
                                    {group.title}
                                </h2>
                            </div>
                            <BookOpen className="w-8 h-8 opacity-90 relative" />
                        </div>

                        {/* Lessons Path for this Unit */}
                        <div className="relative flex flex-col items-center py-4">
                            {/* Line that connects *within* the unit? 
                                Actually, a global SVG line is hard with grouped divs. 
                                Usually Duolingo just uses space or simple connectors.
                             */}

                            {group.lessons.map((lesson, localIndex) => {
                                // Is this lesson locked?
                                // It is locked if its global index > currentLessonGlobalIndex
                                // But simpler: it's locked if !completed AND it's not the current one.
                                // Actually simplistic: if we haven't reached it.
                                const isCurrent = lesson.id === currentLessonId;
                                const isLocked = !lesson.completed && !isCurrent;

                                return (
                                    <LessonNode
                                        key={lesson.id}
                                        lesson={lesson}
                                        index={localIndex}
                                        isLocked={isLocked}
                                        isCurrentLesson={isCurrent}
                                        theme={themeColor}
                                        totalInUnit={group.lessons.length}
                                    />
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default LessonPath;
