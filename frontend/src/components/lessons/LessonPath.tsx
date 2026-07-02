/**
 * LessonPath - Ruta gamificada por Temas (Units) estilo Duolingo
 * Mobile-first, dark mode compatible, grouped by Topic
 */
import React, { useMemo, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Check, Lock, Star, Play, BookOpen, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Badge } from '@/components/ui/badge';
import { LessonItem } from './hooks/useLessonsList';
import { DinoCharacter } from '@/components/characters/DinoCharacter';
import { DinaCharacter } from '@/components/characters/DinaCharacter';
import DrRhoCharacter from '@/components/characters/DrRhoCharacter';
import ZaraVexCharacter from '@/components/characters/ZaraVexCharacter';

interface LessonPathProps {
    lessons: LessonItem[];
    isLoading?: boolean;
    sagaTitle?: string;
    themeColor?: string;
    /** Global next-to-do lesson code (e.g. "2-3-1-5"). Used to highlight a single current node. */
    currentLessonCode?: string | null;
    /** Whether this saga is the one containing the user's current lesson (fallback when no code match). */
    isCurrentSaga?: boolean;
}

const THEME_COLORS: Record<string, { bg: string; border: string; text: string; light: string; stroke: string }> = {
    archipelago: { bg: 'bg-cyan-500', border: 'border-cyan-600', text: 'text-cyan-500', light: 'bg-cyan-100 dark:bg-cyan-900/30', stroke: 'stroke-cyan-500' },
    forest: { bg: 'bg-emerald-500', border: 'border-emerald-600', text: 'text-emerald-500', light: 'bg-emerald-100 dark:bg-emerald-900/30', stroke: 'stroke-emerald-500' },
    city: { bg: 'bg-violet-500', border: 'border-violet-600', text: 'text-violet-500', light: 'bg-violet-100 dark:bg-violet-900/30', stroke: 'stroke-violet-500' },
    valley: { bg: 'bg-purple-500', border: 'border-purple-600', text: 'text-purple-500', light: 'bg-purple-100 dark:bg-purple-900/30', stroke: 'stroke-purple-500' },
    kingdom: { bg: 'bg-blue-500', border: 'border-blue-600', text: 'text-blue-500', light: 'bg-blue-100 dark:bg-blue-900/30', stroke: 'stroke-blue-500' },
    cosmos: { bg: 'bg-indigo-500', border: 'border-indigo-600', text: 'text-indigo-500', light: 'bg-indigo-100 dark:bg-indigo-900/30', stroke: 'stroke-indigo-500' },
};

interface TopicNodeProps {
    topicIndex: number;
    title: string;
    lessons: LessonItem[];
    isLocked: boolean;
    isCurrentTopic: boolean;
    theme: string;
}

const PathLine = ({ nodesCount }: { nodesCount: number }) => {
    const [pathD, setPathD] = useState("");
    const containerRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        const updatePath = () => {
            if (!containerRef.current) return;
            const containerBox = containerRef.current.getBoundingClientRect();
            const nodes = document.querySelectorAll('.topic-node-center');
            
            if (nodes.length < 2) return;
            
            let d = "";
            nodes.forEach((node, i) => {
                const box = node.getBoundingClientRect();
                const x = box.left + box.width / 2 - containerBox.left;
                const y = box.top + box.height / 2 - containerBox.top;
                
                if (i === 0) {
                    d += `M ${x} ${y} `;
                } else {
                    const prevBox = nodes[i - 1].getBoundingClientRect();
                    const prevX = prevBox.left + prevBox.width / 2 - containerBox.left;
                    const prevY = prevBox.top + prevBox.height / 2 - containerBox.top;
                    
                    const cpY = (prevY + y) / 2;
                    d += `C ${prevX} ${cpY}, ${x} ${cpY}, ${x} ${y} `;
                }
            });
            setPathD(d);
        };

        updatePath();
        window.addEventListener('resize', updatePath);
        const timeout1 = setTimeout(updatePath, 100);
        const timeout2 = setTimeout(updatePath, 500);
        
        return () => {
            window.removeEventListener('resize', updatePath);
            clearTimeout(timeout1);
            clearTimeout(timeout2);
        };
    }, [nodesCount]);

    return (
        <svg ref={containerRef} className="absolute inset-0 w-full h-full pointer-events-none z-0">
            <path 
                d={pathD} 
                fill="none" 
                stroke="currentColor" 
                className="text-slate-200 dark:text-slate-800"
                strokeWidth="32" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
            />
            {/* Optional inner decorative dashed line */}
            <path 
                d={pathD} 
                fill="none" 
                stroke="currentColor" 
                className="text-slate-300 dark:text-slate-700"
                strokeWidth="8" 
                strokeDasharray="12 24"
                strokeLinecap="round" 
                strokeLinejoin="round" 
            />
        </svg>
    );
};

const TopicNode: React.FC<TopicNodeProps> = ({
    topicIndex,
    title,
    lessons,
    isLocked,
    isCurrentTopic,
    theme
}) => {
    const { t } = useTranslation('lessons');
    const navigate = useNavigate();
    
    const completedCount = lessons.filter(l => l.completed).length;
    const totalCount = lessons.length;
    const isCompleted = totalCount > 0 && completedCount === totalCount;
    const progress = totalCount === 0 ? 0 : completedCount / totalCount;

    // Use gold (amber) if fully completed
    const colors = isLocked
        ? { bg: 'bg-slate-300 dark:bg-slate-700', border: 'border-slate-400 dark:border-slate-600', text: 'text-slate-400', stroke: 'stroke-slate-300 dark:stroke-slate-700' }
        : isCompleted
            ? { bg: 'bg-amber-400', border: 'border-amber-500', text: 'text-amber-500', stroke: 'stroke-amber-400' }
            : THEME_COLORS[theme] ? { ...THEME_COLORS[theme] } : { ...THEME_COLORS.archipelago };

    // Find target lesson: first incomplete, or last if all completed
    const targetLesson = lessons.find(l => !l.completed) || lessons[lessons.length - 1];

    const handleClick = () => {
        if (!isLocked && targetLesson) {
            navigate(`/lesson/${targetLesson.code}`);
        }
    };

    const size = 110;
    const strokeWidth = 10;
    const radius = (size - strokeWidth) / 2; // 50
    const circumference = 2 * Math.PI * radius; // ~314
    const strokeDashoffset = circumference - (progress * circumference);

    const wavePattern = [0, -45, -70, -45, 0, 45, 70, 45];
    const xOffset = wavePattern[topicIndex % wavePattern.length];

    // Random Character Logic evaluated once per mount
    const { charType, moodIndex, showCharacter, blobColor, blobDelay } = useMemo(() => {
        const characterTypes = ['dino', 'dina', 'rho', 'zara'] as const;
        const cType = characterTypes[Math.floor(Math.random() * characterTypes.length)];
        
        // The wavePattern has 8 steps. 
        // Index 2 is the peak of the left curve. Index 6 is the peak of the right curve.
        // We only show one character per curve, perfectly centered.
        const patternIndex = topicIndex % 8;
        const shouldShow = patternIndex === 2 || patternIndex === 6;
        
        // Define safe contrasting background blob colors for each character
        const blobColors = {
            dino: ['bg-rose-200', 'bg-purple-200', 'bg-amber-200', 'bg-sky-200'],
            dina: ['bg-emerald-200', 'bg-cyan-200', 'bg-purple-200', 'bg-rose-200'],
            rho: ['bg-emerald-200', 'bg-sky-200', 'bg-purple-200', 'bg-rose-200'],
            zara: ['bg-sky-200', 'bg-emerald-200', 'bg-amber-200', 'bg-indigo-200'],
        };
        const safeColors = blobColors[cType];
        
        return {
            charType: cType,
            moodIndex: Math.floor(Math.random() * 2),
            showCharacter: shouldShow,
            blobColor: safeColors[Math.floor(Math.random() * safeColors.length)],
            blobDelay: `${-(Math.random() * 8)}s` // Negative delay to jumpstart the animation randomly
        };
    }, [topicIndex]);

    // Positive expressions
    const dinoMoods = ['happy', 'excited'];
    const dinaExpressions = ['happy', 'wink'];
    const rhoMoods = ['wise', 'explaining'];
    const zaraMoods = ['happy', 'excited'];

    // Position character on the opposite side of the curve
    const isLeft = xOffset > 0 || (xOffset === 0 && topicIndex % 2 === 0);

    return (
        <div
            id={isCurrentTopic ? 'current-topic-node' : undefined}
            className="relative flex flex-col items-center justify-center py-8 z-10 outline-none"
            style={{
                transform: `translateX(${xOffset}px)`
            }}
            tabIndex={-1}
        >
            {/* Ambient Character */}
            {showCharacter && (
                <div 
                    className={cn(
                        "absolute top-1/2 -translate-y-1/2 z-0 flex items-center justify-center",
                        isLeft ? "right-[calc(50%+60px)] sm:right-[calc(50%+90px)]" : "left-[calc(50%+60px)] sm:left-[calc(50%+90px)]"
                    )}
                >
                    {/* SVG Filters for Brush/Gooey Effect */}
                    <svg width="0" height="0" className="absolute">
                        <defs>
                            <filter id="brushGooey" x="-50%" y="-50%" width="200%" height="200%">
                                {/* 1. Make elements merge together like liquid (gooey) */}
                                <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
                                <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
                                
                                {/* 2. Deform the edges to look like a brush stroke or watercolor */}
                                <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="4" result="noise" />
                                <feDisplacementMap in="goo" in2="noise" scale="25" xChannelSelector="R" yChannelSelector="G" result="roughPaint" />
                            </filter>
                        </defs>
                    </svg>

                    <style>{`
                        @keyframes morphBlob {
                            0% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
                            50% { border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%; }
                            100% { border-radius: 40% 60% 60% 40% / 60% 30% 70% 40%; }
                        }
                        @keyframes floatDrop1 {
                            0%, 100% { transform: translate(10px, 10px) scale(1); }
                            50% { transform: translate(-80px, -70px) scale(0.6); }
                        }
                        @keyframes floatDrop2 {
                            0%, 100% { transform: translate(-10px, -10px) scale(1); }
                            50% { transform: translate(90px, -30px) scale(0.8); }
                        }
                        @keyframes floatDrop3 {
                            0%, 100% { transform: translate(0, 0) scale(1); }
                            50% { transform: translate(-30px, 90px) scale(0.5); }
                        }
                        @keyframes particleTwinkle1 {
                            0%, 100% { transform: translate(0, 0) scale(0.5); opacity: 0.2; }
                            50% { transform: translate(-15px, -25px) scale(1.2); opacity: 0.8; }
                        }
                        @keyframes particleTwinkle2 {
                            0%, 100% { transform: translate(0, 0) scale(1.2); opacity: 0.7; }
                            50% { transform: translate(25px, 15px) scale(0.4); opacity: 0.1; }
                        }
                        @keyframes particleTwinkle3 {
                            0%, 100% { transform: translate(0, 0) scale(0.8); opacity: 0.4; }
                            50% { transform: translate(-20px, 20px) scale(1.5); opacity: 0.9; }
                        }
                        .animate-blob-morph { animation: morphBlob 8s ease-in-out infinite alternate; }
                        .animate-drop-1 { animation: floatDrop1 6s ease-in-out infinite; }
                        .animate-drop-2 { animation: floatDrop2 7s ease-in-out infinite; }
                        .animate-drop-3 { animation: floatDrop3 5s ease-in-out infinite; }
                        .animate-particle-1 { animation: particleTwinkle1 4s ease-in-out infinite; }
                        .animate-particle-2 { animation: particleTwinkle2 5s ease-in-out infinite; }
                        .animate-particle-3 { animation: particleTwinkle3 6s ease-in-out infinite; }
                    `}</style>
                    
                    {/* Floating Particles (Outside the liquid filter so they stay sharp) */}
                    <div className="absolute w-80 h-80 pointer-events-none z-0 mix-blend-multiply dark:mix-blend-screen">
                        <div className={cn("absolute top-[10%] left-[20%] w-2 h-2 rounded-full animate-particle-1", blobColor)} style={{ animationDelay: `${-(Math.random() * 4)}s` }} />
                        <div className={cn("absolute top-[80%] left-[15%] w-3 h-3 rounded-full animate-particle-2", blobColor)} style={{ animationDelay: `${-(Math.random() * 4)}s` }} />
                        <div className={cn("absolute top-[20%] right-[15%] w-1.5 h-1.5 rounded-full animate-particle-3", blobColor)} style={{ animationDelay: `${-(Math.random() * 4)}s` }} />
                        <div className={cn("absolute top-[75%] right-[20%] w-2.5 h-2.5 rounded-full animate-particle-1", blobColor)} style={{ animationDelay: `${-(Math.random() * 4)}s` }} />
                        <div className={cn("absolute top-[50%] left-[5%] w-2 h-2 rounded-full animate-particle-3", blobColor)} style={{ animationDelay: `${-(Math.random() * 4)}s` }} />
                    </div>

                    {/* Defined Contour Container */}
                    <div 
                        className="absolute w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center opacity-70 dark:opacity-40 mix-blend-multiply dark:mix-blend-screen"
                    >
                        {/* Main Clean Blob */}
                        <div 
                            className={cn("absolute w-48 h-48 sm:w-60 sm:h-60 animate-blob-morph transition-colors duration-1000 shadow-xl", blobColor)}
                            style={{ animationDelay: blobDelay }}
                        />
                    </div>

                    {/* Character */}
                    <div className="w-40 h-40 sm:w-56 sm:h-56 hover:-translate-y-2 hover:scale-105 transition-all duration-300 relative z-10">
                        {charType === 'dino' && <DinoCharacter mood={dinoMoods[moodIndex] as any} showBubble={false} />}
                        {charType === 'dina' && <DinaCharacter expression={dinaExpressions[moodIndex] as any} showBubble={false} />}
                        {charType === 'rho' && <DrRhoCharacter mood={rhoMoods[moodIndex] as any} showBubble={false} />}
                        {charType === 'zara' && <ZaraVexCharacter mood={zaraMoods[moodIndex] as any} showBubble={false} />}
                    </div>
                </div>
            )}

            {/* Floating "Start here" beacon */}
            {isCurrentTopic && (
                <div className="absolute -top-4 z-40 flex flex-col items-center animate-bounce pointer-events-none">
                    <span className="px-3 py-1 rounded-xl bg-amber-400 text-amber-950 text-[11px] font-black uppercase tracking-wider shadow-md shadow-amber-500/40 whitespace-nowrap relative after:content-[''] after:absolute after:-bottom-1.5 after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-amber-400">
                        {t('start_here')}
                    </span>
                </div>
            )}

            <div className="relative inline-flex items-center justify-center">
                {/* SVG Progress Ring - Only for current topic */}
                {isCurrentTopic && (
                    <svg className="absolute w-[110px] h-[110px] -rotate-90 pointer-events-none drop-shadow-sm" viewBox={`0 0 ${size} ${size}`}>
                        {/* Track Background */}
                        <circle
                            cx={size / 2}
                            cy={size / 2}
                            r={radius}
                            className="fill-transparent stroke-slate-200 dark:stroke-slate-700/50"
                            strokeWidth={strokeWidth}
                        />
                        {/* Progress Fill */}
                        {progress > 0 && (
                            <circle
                                cx={size / 2}
                                cy={size / 2}
                                r={radius}
                                className={`fill-transparent transition-all duration-1000 ease-out drop-shadow-md ${colors.stroke} ${isCompleted ? 'stroke-amber-400' : ''}`}
                                strokeWidth={strokeWidth}
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                            />
                        )}
                    </svg>
                )}

                <HoverCard openDelay={200}>
                    <HoverCardTrigger asChild>
                        <button
                            onClick={handleClick}
                            disabled={isLocked}
                            className={cn(
                                'topic-node-center group relative w-[76px] h-[76px] rounded-full flex items-center justify-center',
                                'transition-all duration-200 outline-none',
                                colors.bg,
                                !isLocked && `border-b-[8px] ${colors.border} active:border-b-[2px] active:translate-y-[6px]`,
                                isLocked && 'bg-[#e5e5e5] dark:bg-slate-800 border-b-[8px] border-[#cecece] dark:border-slate-900 cursor-not-allowed',
                                !isLocked && !isCurrentTopic && 'cursor-pointer hover:brightness-110 shadow-lg hover:-translate-y-1',
                                isCurrentTopic && 'cursor-pointer shadow-xl hover:-translate-y-1'
                            )}
                        >
                            {/* Inner 3D Highlight for current or unlocked nodes */}
                            {!isLocked && (
                                <div className="absolute inset-0 rounded-full shadow-[inset_0_4px_10px_rgba(255,255,255,0.4)] pointer-events-none" />
                            )}

                            {/* Internal Highlight for glass effect */}
                            <div className={cn(
                                "absolute top-2 left-2.5 h-3.5 rounded-full rotate-[-15deg] blur-[0.5px]",
                                isLocked ? "w-8 bg-white/40" : "w-10 bg-white/30"
                            )} />

                            {/* Icon */}
                            <div className={cn(
                                "text-white relative z-10",
                                isLocked ? "" : "drop-shadow-[0_2px_2px_rgba(0,0,0,0.2)]",
                                isCurrentTopic && "animate-[pulse_2s_ease-in-out_infinite]"
                            )}>
                                {isCompleted ? (
                                    <Check strokeWidth={5} className="w-9 h-9" />
                                ) : isLocked ? (
                                    <Lock strokeWidth={3} className="w-7 h-7 opacity-50" />
                                ) : (
                                    <Star fill="currentColor" className="w-8 h-8" />
                                )}
                            </div>
                        </button>
                    </HoverCardTrigger>

                    <HoverCardContent side="top" className="w-72 p-0 overflow-hidden border-2 shadow-xl z-50">
                        <div className={`h-2 w-full ${colors.bg}`} />
                        <div className="p-4 bg-popover/95 backdrop-blur-sm">
                            <h4 className="text-sm font-bold mb-1 flex items-center gap-2">
                                {title}
                                {isCompleted && <Check className="w-4 h-4 text-amber-500" />}
                            </h4>
                            <p className="text-xs text-muted-foreground mb-3">
                                {completedCount} / {totalCount} {t('lessons:lessons')}
                            </p>
                        </div>
                    </HoverCardContent>
                </HoverCard>
            </div>
            
            {/* (Title removed per user request, only visible in HoverCard now) */}
        </div>
    );
};

export const LessonPath: React.FC<LessonPathProps> = ({
    lessons,
    isLoading,
    sagaTitle,
    themeColor = 'archipelago',
    currentLessonCode,
    isCurrentSaga = false
}) => {
    const { t } = useTranslation('lessons');
    const { t: tAdventures } = useTranslation('adventures');
    const colors = THEME_COLORS[themeColor] || THEME_COLORS.archipelago;

    // Group lessons by Topic
    const groupedLessons = useMemo(() => {
        const groups: Record<number, { title: string, lessons: LessonItem[] }> = {};
        lessons.forEach(l => {
            if (!groups[l.topicLevel]) {
                let translatedTitle = '';
                if (l.code) {
                    const parts = l.code.split('-');
                    if (parts.length >= 3) {
                        const sagaId = parts[1];
                        const topicId = parts[2];
                        const key = `sagas.${sagaId}.topics.${topicId}.title`;
                        const translation = tAdventures(key);
                        if (translation && translation !== key) {
                            translatedTitle = translation;
                        }
                    }
                }
                groups[l.topicLevel] = { title: translatedTitle || l.topicTitle || `${t('unit')} ${l.topicLevel}`, lessons: [] };
            }
            groups[l.topicLevel].lessons.push(l);
        });
        return Object.entries(groups).sort(([a], [b]) => Number(a) - Number(b)).map(([_, val]) => val);
    }, [lessons, t, tAdventures]);

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

    // Determine the single "current" (next-to-do) lesson.
    // Prefer the GLOBAL next-lesson code so only the saga that truly contains it shows a
    // highlighted node — this prevents duplicate "current" markers across multiple open sagas.
    // for the saga flagged as current, so other open sagas never light up a node.
    const matchedByCodeIndex = currentLessonCode
        ? lessons.findIndex(l => l.code === currentLessonCode)
        : -1;
    const firstIncompleteIndex = lessons.findIndex(l => !l.completed);
    
    let currentLessonGlobalIndex = -1;
    if (isCurrentSaga) {
        // If the backend nextLessonCode points to an already completed lesson, auto-advance to the first incomplete one
        if (matchedByCodeIndex !== -1 && !lessons[matchedByCodeIndex].completed) {
            currentLessonGlobalIndex = matchedByCodeIndex;
        } else {
            // If all lessons are completed, we don't highlight any node as 'current' (no ring, no beacon)
            currentLessonGlobalIndex = firstIncompleteIndex;
        }
    }
    
    const currentLessonId = currentLessonGlobalIndex !== -1
        ? (lessons[currentLessonGlobalIndex]?.id ?? null)
        : null;

    return (
        <div className="w-full py-2 pb-32">
            {/* Topics Path */}
            <div className="relative flex flex-col items-center py-6 space-y-2 min-h-[500px]">
                <PathLine nodesCount={groupedLessons.length} />
                {groupedLessons.map((group, groupIndex) => {
                    const isCurrentTopic = group.lessons.some(l => l.id === currentLessonId);
                    const isTopicLocked = !group.lessons[0]?.completed && !isCurrentTopic;

                    return (
                        <TopicNode
                            key={groupIndex}
                            topicIndex={groupIndex}
                            title={group.title}
                            lessons={group.lessons}
                            isLocked={isTopicLocked}
                            isCurrentTopic={isCurrentTopic}
                            theme={themeColor}
                        />
                    );
                })}
            </div>
        </div>
    );
};

export default LessonPath;
