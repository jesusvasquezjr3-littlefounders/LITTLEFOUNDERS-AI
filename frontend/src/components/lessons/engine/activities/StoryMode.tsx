import { useState, useEffect, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { DinoCharacter, DinoMood } from '@/components/characters/DinoCharacter';
import DrRhoCharacter, { RhoMood } from '@/components/characters/DrRhoCharacter';
import { DinaCharacter } from '@/components/characters/DinaCharacter';
import ZaraVexCharacter, { ZaraMood } from '@/components/characters/ZaraVexCharacter';
import { normalizeGesture } from '@/utils/gestureMapper';

interface StoryPage {
    id: string;
    text: string;
    image?: string;
    character_mood?: string;
    choices?: Array<{ id: string; text: string; next_page?: string }>;
}

interface StoryModeProps {
    exercise: any;
    onNext: () => void;
}

export const StoryMode = ({ exercise, onNext }: StoryModeProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [pageIndex, setPageIndex] = useState(0);
    const [history, setHistory] = useState<number[]>([0]);
    const [isAnimating, setIsAnimating] = useState(false);

    // Build virtual pages from real JSON schema if legacy 'pages' is absent
    const pages: StoryPage[] = useMemo(() => {
        const content = exercise?.content || {};
        // Legacy format: content.pages exists
        if (content.pages && Array.isArray(content.pages) && content.pages.length > 0) {
            return content.pages;
        }
        // Real JSON format: scenario + question + choices
        const built: StoryPage[] = [];
        if (content.scenario) {
            built.push({
                id: 'page-scenario',
                text: content.scenario,
                character_mood: 'neutral',
            });
        }
        if (content.question || content.instruction) {
            const questionText = content.question || content.instruction || '';
            const choices = content.choices || content.options || [];
            built.push({
                id: 'page-question',
                text: questionText,
                character_mood: 'thinking',
                choices: choices.map((c: any, idx: number) => ({
                    id: c.id || `choice-${idx}`,
                    text: c.text || c.label || '',
                    next_page: undefined,
                })),
            });
        }
        // Fallback: if there's nothing, create a single page from any available text field
        if (built.length === 0) {
            const fallbackText = content.transcript || content.description || content.text || content.statement || '';
            if (fallbackText) {
                built.push({ id: 'page-fallback', text: fallbackText, character_mood: 'neutral' });
            }
        }
        return built;
    }, [exercise]);

    const currentPage = pages[pageIndex] || pages[0];

    useEffect(() => {
        setPageIndex(0);
        setHistory([0]);
    }, [exercise]);

    // Guard against empty pages array — auto-advance
    const onNextRef = useRef(onNext);
    onNextRef.current = onNext;
    useEffect(() => {
        if (pages.length === 0) {
            onNextRef.current();
        }
    }, [pages.length]);

    const handleChoice = (nextPageId?: string) => {
        playSound('ui_tap');
        setIsAnimating(true);
        setTimeout(() => {
            if (nextPageId) {
                const nextIdx = pages.findIndex(p => p.id === nextPageId);
                if (nextIdx !== -1) {
                    setPageIndex(nextIdx);
                    setHistory(prev => [...prev, nextIdx]);
                } else {
                    handleNext();
                }
            } else {
                handleNext();
            }
            setIsAnimating(false);
        }, 300);
    };

    const handleNext = () => {
        if (pageIndex < pages.length - 1) {
            playSound('ui_tap');
            setIsAnimating(true);
            setTimeout(() => {
                setPageIndex(prev => {
                    const next = prev + 1;
                    setHistory(h => [...h, next]);
                    return next;
                });
                setIsAnimating(false);
            }, 300);
        } else {
            onNext();
        }
    };

    const handleBack = () => {
        if (history.length > 1) {
            const newHistory = [...history];
            newHistory.pop();
            const prevIndex = newHistory[newHistory.length - 1];
            setHistory(newHistory);
            setPageIndex(prevIndex);
        }
    };

    if (pages.length === 0) {
        return (
            <div className="w-full h-full flex items-center justify-center">
                <div className="animate-pulse text-muted-foreground">{t('loading', { defaultValue: 'Cargando...' })}</div>
            </div>
        );
    }

    const characterCode = exercise.character_code || 'dr_rho';
    const rawMood = currentPage?.character_mood || 'neutral';
    const normalizedCharCode = characterCode.toLowerCase().trim();
    const normalizedMood = normalizeGesture(normalizedCharCode, rawMood);

    const renderCharacter = () => {
        const className = "w-[200px] sm:w-[280px] mx-auto filter drop-shadow-xl transition-all duration-500 hover:scale-105";
        if (normalizedCharCode === 'dina') return <DinaCharacter className={className} expression={normalizedMood as any} />;
        if (normalizedCharCode === 'dr_rho' || normalizedCharCode === 'drrho') return <DrRhoCharacter className={className} mood={normalizedMood as any} />;
        if (normalizedCharCode === 'zara_vex' || normalizedCharCode === 'zaravex') return <ZaraVexCharacter className={className} mood={normalizedMood as any} />;
        return <DinoCharacter className={className} mood={normalizedMood as any} showBubble={false} />;
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-center animate-in fade-in duration-500 relative px-4">
            <div className="w-full max-w-4xl liquid-glass-strong rounded-3xl shadow-xl border border-white/20 dark:border-white/10 overflow-hidden flex flex-col md:flex-row min-h-[500px] relative">
                <div className="absolute top-0 left-0 w-full h-4 bg-amber-300 dark:bg-amber-800 z-10" />

                <div className="w-full md:w-1/2 bg-gradient-to-b from-blue-50 to-indigo-100 dark:from-slate-800 dark:to-slate-900 flex items-end justify-center p-6 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-multiply dark:mix-blend-screen" />
                    <div className={cn("relative z-10 transition-all duration-500 transform", isAnimating ? "opacity-0 translate-y-10" : "opacity-100 translate-y-0")}>
                        {renderCharacter()}
                    </div>
                </div>

                <div className="w-full md:w-1/2 p-8 flex flex-col relative bg-paper-texture">
                    <div className="absolute top-6 right-8 text-muted-foreground font-mono text-xs border border-muted px-2 py-1 rounded-md">
                        PAGE {pageIndex + 1} / {pages.length}
                    </div>

                    <div className="flex-1 flex flex-col justify-center">
                        <BookOpen className="w-8 h-8 text-amber-500 mb-4 opacity-50" />

                        <div className={cn("transition-all duration-500 delay-100", isAnimating ? "opacity-0 translate-x-10" : "opacity-100 translate-x-0")}>
                            <p className="text-xl md:text-2xl font-medium leading-relaxed font-serif text-slate-800 dark:text-slate-200 mb-8">
                                "{currentPage?.text || ''}"
                            </p>

                            <div className="space-y-3">
                                {currentPage?.choices && currentPage.choices.length > 0 ? (
                                    currentPage.choices.map((choice, idx) => (
                                        <Button
                                            key={choice.id}
                                            onClick={() => handleChoice(choice.next_page)}
                                            className={cn(
                                                "w-full h-auto py-4 text-left justify-start text-lg whitespace-normal rounded-xl border-2 transition-all",
                                                "bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-slate-700 text-foreground border-amber-200 dark:border-slate-700",
                                                "shadow-sm hover:shadow-md hover:border-amber-400"
                                            )}
                                        >
                                            <span className="bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 w-8 h-8 rounded-full flex items-center justify-center mr-3 font-bold text-sm flex-shrink-0">
                                                {String.fromCharCode(65 + idx)}
                                            </span>
                                            {choice.text}
                                        </Button>
                                    ))
                                ) : (
                                    <div className="flex gap-4">
                                        {history.length > 1 && (
                                            <Button
                                                variant="ghost"
                                                onClick={handleBack}
                                                className="text-muted-foreground"
                                            >
                                                {t('common:buttons.back', { defaultValue: 'Atrás' })}
                                            </Button>
                                        )}
                                        <Button
                                            onClick={handleNext}
                                            className="relative overflow-hidden flex-1 h-14 text-lg font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-[0_4px_0_rgb(180,83,9)] hover:shadow-[0_2px_0_rgb(180,83,9)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all"
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                                            <span className="relative flex items-center justify-center">
                                                {pageIndex === pages.length - 1 ? t('actions.finish', { defaultValue: 'Finalizar' }) : t('actions.continue', { defaultValue: 'Continuar' })} <ArrowRight className="ml-2 w-5 h-5" />
                                            </span>
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
