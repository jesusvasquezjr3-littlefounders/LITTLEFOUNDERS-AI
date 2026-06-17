import { useState, useEffect, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { DinoCharacter, DinoMood } from '@/components/characters/DinoCharacter';
import DrRhoCharacter, { RhoMood } from '@/components/characters/DrRhoCharacter';
import { DinaCharacter } from '@/components/characters/DinaCharacter';
import ZaraVexCharacter, { ZaraMood } from '@/components/characters/ZaraVexCharacter';
import { normalizeGesture } from '@/utils/gestureMapper';
import { OptionCard, type OptionState } from '../ui/OptionCard';
import { QuestButton } from '../ui/QuestButton';
import { extractCorrectId } from '../hooks/useLessonState';

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
    onSubmit?: (choiceId: string) => boolean;
    isAudioPlaying?: boolean;
}

export const StoryMode = ({ exercise, onNext, onSubmit, isAudioPlaying = false }: StoryModeProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [pageIndex, setPageIndex] = useState(0);
    const [history, setHistory] = useState<number[]>([0]);
    const [isAnimating, setIsAnimating] = useState(false);
    // Graded decision point (non-branching choice + a correct answer): { id, correct }.
    const [decided, setDecided] = useState<{ id: string; correct: boolean } | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const gradedCorrectId = extractCorrectId(exercise?.correct_answer);

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
        setDecided(null);
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [exercise]);

    // Clear a graded decision when moving to another page.
    useEffect(() => { setDecided(null); }, [pageIndex]);

    // Guard against empty pages array — auto-advance (debounced to prevent loops)
    const onNextRef = useRef(onNext);
    onNextRef.current = onNext;
    useEffect(() => {
        if (pages.length === 0) {
            const t = setTimeout(() => onNextRef.current(), 100);
            return () => clearTimeout(t);
        }
    }, [pages.length]);

    const handleChoice = (choice: any) => {
        if (decided) return;
        playSound('ui_tap');
        // Branching narrative → navigate to the linked page.
        if (choice?.next_page) {
            setIsAnimating(true);
            timeoutRef.current = setTimeout(() => {
                const nextIdx = pages.findIndex(p => p.id === choice.next_page);
                if (nextIdx !== -1) {
                    setPageIndex(nextIdx);
                    setHistory(prev => [...prev, nextIdx]);
                } else {
                    handleNext();
                }
                setIsAnimating(false);
            }, 300);
            return;
        }
        // Graded single decision (the exercise has a correct answer) → record the result
        // and show feedback, without penalizing (gentle). The user continues afterward.
        if (onSubmit && gradedCorrectId !== undefined) {
            const ok = onSubmit(choice.id);
            setDecided({ id: choice.id, correct: ok });
            return;
        }
        // Pure consumption advance.
        setIsAnimating(true);
        timeoutRef.current = setTimeout(() => {
            handleNext();
            setIsAnimating(false);
        }, 300);
    };

    const handleNext = () => {
        if (pageIndex < pages.length - 1) {
            playSound('ui_tap');
            setIsAnimating(true);
            timeoutRef.current = setTimeout(() => {
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
                <div className="lp-display animate-pulse text-[var(--lp-muted)]">{t('loading', { defaultValue: 'Cargando...' })}</div>
            </div>
        );
    }

    const characterCode = exercise.character_code || 'dr_rho';
    const rawMood = currentPage?.character_mood || 'neutral';
    const normalizedCharCode = characterCode.toLowerCase().trim();
    const normalizedMood = normalizeGesture(normalizedCharCode, rawMood);

    const renderCharacter = () => {
        const className = "w-56 sm:w-72 md:w-80 mx-auto filter drop-shadow-xl transition-all duration-500";
        if (normalizedCharCode === 'dina') return <DinaCharacter className={className} expression={normalizedMood as any} isTalking={isAudioPlaying} />;
        if (normalizedCharCode === 'dr_rho' || normalizedCharCode === 'drrho') return <DrRhoCharacter className={className} mood={normalizedMood as any} isTalking={isAudioPlaying} />;
        if (normalizedCharCode === 'zara_vex' || normalizedCharCode === 'zaravex') return <ZaraVexCharacter className={className} mood={normalizedMood as any} isTalking={isAudioPlaying} />;
        return <DinoCharacter className={className} mood={normalizedMood as any} showBubble={false} isTalking={isAudioPlaying} />;
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-center animate-in fade-in duration-500 relative px-4">
            <div className="lp-card w-full max-w-4xl overflow-hidden flex flex-col md:flex-row min-h-[500px] relative">
                <div className="absolute top-0 left-0 w-full h-4 z-10" style={{ background: 'var(--lp-amber)' }} />

                <div className="w-full md:w-1/2 flex items-end justify-center p-6 relative overflow-hidden" style={{ background: 'var(--lp-indigo-soft)' }}>
                    <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-multiply dark:mix-blend-screen" />
                    <div className={cn("relative z-10 transition-all duration-500 transform", isAnimating ? "opacity-0 translate-y-10" : "opacity-100 translate-y-0")}>
                        {renderCharacter()}
                    </div>
                </div>

                <div className="w-full md:w-1/2 p-8 flex flex-col relative" style={{ background: 'var(--lp-surface)' }}>
                    <div className="lp-chip absolute top-6 right-8 lp-display text-xs px-3 py-1 text-[var(--lp-muted)]">
                        PAGE {pageIndex + 1} / {pages.length}
                    </div>

                    <div className="flex-1 flex flex-col justify-center">
                        <BookOpen className="w-8 h-8 mb-4 opacity-60" style={{ color: 'var(--lp-amber)' }} />

                        <div className={cn("transition-all duration-500 delay-100", isAnimating ? "opacity-0 translate-x-10" : "opacity-100 translate-x-0")}>
                            <p className="lp-display text-xl md:text-2xl leading-relaxed text-[var(--lp-ink)] mb-8">
                                "{currentPage?.text || ''}"
                            </p>

                            <div className="space-y-3">
                                {currentPage?.choices && currentPage.choices.length > 0 ? (
                                    <>
                                        {currentPage.choices.map((choice, idx) => {
                                            const st: OptionState = !decided
                                                ? 'idle'
                                                : (gradedCorrectId !== undefined && String(choice.id) === String(gradedCorrectId))
                                                    ? 'correct'
                                                    : (choice.id === decided.id ? 'wrong' : 'dimmed');
                                            return (
                                                <OptionCard
                                                    key={choice.id}
                                                    index={idx}
                                                    text={choice.text}
                                                    state={st}
                                                    onClick={() => handleChoice(choice)}
                                                    disabled={!!decided}
                                                />
                                            );
                                        })}
                                        {decided && (
                                            <QuestButton variant="go" onClick={handleNext}>
                                                {t('actions.continue', { defaultValue: 'Continuar' })}
                                                <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
                                            </QuestButton>
                                        )}
                                    </>
                                ) : (
                                    <div className="flex items-center gap-4">
                                        {history.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={handleBack}
                                                className="lp-display shrink-0 px-2 py-2 text-[var(--lp-muted)] hover:text-[var(--lp-ink)] transition-colors"
                                            >
                                                {t('common:buttons.back', { defaultValue: 'Atrás' })}
                                            </button>
                                        )}
                                        <QuestButton variant="brand" onClick={handleNext}>
                                            {pageIndex === pages.length - 1 ? t('actions.finish', { defaultValue: 'Finalizar' }) : t('actions.continue', { defaultValue: 'Continuar' })}
                                            <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
                                        </QuestButton>
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
