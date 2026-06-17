import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, RotateCcw, CreditCard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';
import { OptionCard, type OptionState } from '../ui/OptionCard';
import { resolveOptions } from './optionSource';

interface CreditScoreBuilderProps {
    exercise: any;
    onSubmit: (decisions: string[]) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const CreditScoreBuilder = ({ exercise, onSubmit, onNext, onRetry }: CreditScoreBuilderProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [currentScenario, setCurrentScenario] = useState(0);
    const [decisions, setDecisions] = useState<string[]>([]);
    const [score, setScore] = useState(650);
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setCurrentScenario(0);
        setDecisions([]);
        setScore(exercise?.content?.initialScore || 650);
        setFeedback('none');
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [exercise]);

    const content = exercise?.content || {};
    const scenarios = content.scenarios || [];
    const scenario = scenarios[currentScenario];

    // Single-choice fallback: some credit_score lessons are a plain profile/option pick
    // ({correctProfile}/{correctOptionId}) with no scenario simulator.
    const choiceOptions = scenarios.length === 0
        ? resolveOptions(content, ['options', 'profiles', 'choices'])
        : [];

    if (scenarios.length === 0 && choiceOptions.length > 0) {
        const chosen = decisions[0] ?? null;
        const pick = (id: string) => {
            if (feedback !== 'none') return;
            playSound('ui_tap');
            setDecisions([id]);
            const isCorrect = onSubmit([id]);
            setFeedback(isCorrect ? 'success' : 'error');
        };
        const onContinue = () => {
            if (feedback === 'success') { onNext(); }
            else { setDecisions([]); setFeedback('none'); onRetry(); }
        };
        return (
            <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                {(content.scenario || content.question || content.instruction) && (
                    <div className="lp-card mb-6 p-5 text-center">
                        <p className="lp-display text-base sm:text-lg text-[var(--lp-ink)]">
                            {content.question || content.scenario || content.instruction}
                        </p>
                    </div>
                )}
                <div className="space-y-3 mb-6">
                    {choiceOptions.map((opt: any, idx: number) => {
                        const st: OptionState = feedback === 'none'
                            ? (chosen === opt.id ? 'selected' : 'idle')
                            : (chosen === opt.id ? (feedback === 'success' ? 'correct' : 'wrong') : 'dimmed');
                        return (
                            <OptionCard key={opt.id} index={idx} text={opt.text} state={st}
                                onClick={() => pick(opt.id)} disabled={feedback !== 'none'} />
                        );
                    })}
                </div>
                <div className="w-full max-w-md mx-auto">
                    {feedback !== 'none' && (
                        <QuestButton variant={feedback === 'success' ? 'go' : 'retry'} onClick={onContinue}>
                            {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                            {feedback === 'success' ? <ArrowRight className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
                        </QuestButton>
                    )}
                </div>
            </div>
        );
    }

    if (scenarios.length === 0) {
        // Graceful degradation: no real data exists for this exercise type
        return (
            <div className="w-full max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col items-center justify-center py-20">
                <div className="text-6xl sm:text-7xl mb-4 lp-bob" aria-hidden="true">💳</div>
                <h3 className="lp-display text-2xl sm:text-3xl mb-2 text-[var(--lp-ink)]">
                    {t('credit_score.title', { defaultValue: 'Construye tu Score Crediticio' })}
                </h3>
                <p className="text-sm sm:text-base text-[var(--lp-muted)] mb-6 text-center max-w-md">
                    {content.instruction || content.scenario || t('credit_score.no_data', { defaultValue: 'Ejercicio educativo sobre manejo del crédito.' })}
                </p>
                <div className="w-full max-w-md">
                    <QuestButton variant="brand" onClick={onNext}>
                        {t('actions.continue', { defaultValue: 'Continuar' })}
                        <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
                    </QuestButton>
                </div>
            </div>
        );
    }

    const handleDecision = (decisionId: string) => {
        if (feedback !== 'none') return;

        const decision = scenario.options.find((opt: any) => opt.id === decisionId);
        if (!decision) return;

        playSound('ui_tap');
        const newDecisions = [...decisions, decisionId];
        setDecisions(newDecisions);

        const newScore = Math.max(300, Math.min(850, score + (decision.scoreChange || 0)));
        setScore(newScore);

        if (currentScenario < scenarios.length - 1) {
            timeoutRef.current = setTimeout(() => setCurrentScenario(prev => prev + 1), 800);
        } else {
            timeoutRef.current = setTimeout(() => {
                const isCorrect = onSubmit(newDecisions);
                setFeedback(isCorrect ? 'success' : 'error');
            }, 800);
        }
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            setCurrentScenario(0);
            setDecisions([]);
            setScore(exercise.content.initialScore || 650);
            setFeedback('none');
            onRetry();
        }
    };

    const getScoreStyle = (): React.CSSProperties => {
        if (score >= 740) return { background: 'var(--lp-emerald)', borderColor: 'var(--lp-emerald-lip)', color: '#fff' };
        if (score >= 670) return { background: 'var(--lp-indigo)', borderColor: 'var(--lp-indigo-lip)', color: '#fff' };
        if (score >= 580) return { background: 'var(--lp-amber)', borderColor: 'var(--lp-amber-lip)', color: '#3a2606' };
        return { background: 'var(--lp-coral)', borderColor: 'var(--lp-coral-lip)', color: '#fff' };
    };

    const getScoreLabel = () => {
        if (score >= 740) return t('credit_score.excellent');
        if (score >= 670) return t('credit_score.good');
        if (score >= 580) return t('credit_score.fair');
        return t('credit_score.poor');
    };

    if (!scenario && feedback === 'none') {
        return (
            <div className="w-full max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col items-center justify-center py-20">
                <div className="text-6xl sm:text-7xl mb-4 lp-bob" aria-hidden="true">💳</div>
                <h3 className="lp-display text-2xl sm:text-3xl text-[var(--lp-ink)]">
                    {t('credit_score.loading', { defaultValue: 'Cargando escenarios...' })}
                </h3>
            </div>
        );
    }

    return (
        <div className="w-full max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Credit Score Meter */}
            <div className="mb-6">
                <div
                    className="rounded-2xl p-6 text-center border-2 transition-all duration-500"
                    style={{ ...getScoreStyle(), boxShadow: 'var(--lp-shadow)' }}
                >
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <CreditCard className="w-6 h-6" />
                        <span className="text-sm font-medium opacity-90">
                            {t('credit_score.your_score')}
                        </span>
                    </div>
                    <div className="lp-display text-6xl sm:text-7xl mb-2">{score}</div>
                    <div className="lp-display text-lg sm:text-xl opacity-90">{getScoreLabel()}</div>
                </div>

                {/* Score Range Indicator */}
                <div className="lp-track mt-4 h-3 overflow-hidden">
                    <div
                        className="h-full transition-all duration-500"
                        style={{ width: `${((score - 300) / 550) * 100}%`, background: 'linear-gradient(90deg, var(--lp-coral), var(--lp-amber), var(--lp-emerald))' }}
                    ></div>
                </div>
                <div className="flex justify-between text-xs text-[var(--lp-muted)] mt-1">
                    <span>300</span>
                    <span>850</span>
                </div>
            </div>

            {/* Scenario */}
            {scenario && feedback === 'none' && (
                <>
                    <div className="lp-card mb-6 p-4 sm:p-5">
                        <h3 className="lp-display text-sm sm:text-base mb-2 text-[var(--lp-muted)]">
                            {t('credit_score.scenario')} {currentScenario + 1}/{scenarios.length}
                        </h3>
                        <p className="lp-display text-base sm:text-lg leading-snug text-[var(--lp-ink)]">
                            {scenario.description}
                        </p>
                    </div>

                    <div className="space-y-3 mb-6">
                        {scenario.options.map((option: any, idx: number) => {
                            const hue = ['indigo', 'amber', 'emerald', 'coral'][idx % 4];
                            return (
                                <button
                                    key={option.id}
                                    onClick={() => handleDecision(option.id)}
                                    style={{ animationDelay: `${0.04 + idx * 0.06}s` }}
                                    className={cn(
                                        "lp-token lp-option w-full text-left px-4 py-4",
                                        "animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both",
                                        `lp-option--${hue}`
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-4">
                                        <p className="lp-display text-sm sm:text-base flex-1 leading-snug text-[var(--lp-ink)]">
                                            {option.text}
                                        </p>
                                        {/* Score change hidden until after selection to avoid spoiling the challenge */}
                                        <div className={cn(
                                            "lp-display text-sm sm:text-base shrink-0 px-3 py-1.5 rounded-xl border-2 transition-opacity duration-300",
                                            feedback !== 'none' ? "opacity-100" : "opacity-0"
                                        )}
                                        style={feedback !== 'none' ? (
                                            option.scoreChange > 0
                                                ? { background: 'var(--lp-emerald-soft)', borderColor: 'var(--lp-emerald)', color: 'var(--lp-emerald-ink)' }
                                                : option.scoreChange < 0
                                                    ? { background: 'var(--lp-coral-soft)', borderColor: 'var(--lp-coral)', color: 'var(--lp-coral-ink)' }
                                                    : { background: 'var(--lp-surface)', borderColor: 'var(--lp-line)', color: 'var(--lp-muted)' }
                                        ) : undefined}
                                        aria-hidden={feedback === 'none'}>
                                            {option.scoreChange > 0 && '+'}
                                            {option.scoreChange}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </>
            )}

            {/* Result */}
            {feedback !== 'none' && (
                <div className="flex flex-col items-center">
                    <div
                        className="mb-6 p-6 rounded-2xl text-center w-full border-2 animate-in fade-in zoom-in-95 duration-300"
                        style={feedback === 'success'
                            ? { background: 'var(--lp-emerald-soft)', borderColor: 'var(--lp-emerald)' }
                            : { background: 'var(--lp-coral-soft)', borderColor: 'var(--lp-coral)' }
                        }
                    >
                        <p
                            className="lp-display text-lg sm:text-xl mb-2"
                            style={{ color: feedback === 'success' ? 'var(--lp-emerald-ink)' : 'var(--lp-coral-ink)' }}
                        >
                            {feedback === 'success' ? t('credit_score.great_job') : t('credit_score.needs_work')}
                        </p>
                        <p className="text-sm sm:text-base text-[var(--lp-muted)]">
                            {feedback === 'success'
                                ? t('credit_score.success_message')
                                : t('credit_score.error_message')
                            }
                        </p>
                    </div>

                    <div className="w-full max-w-md">
                        <QuestButton
                            variant={feedback === 'success' ? 'go' : 'retry'}
                            onClick={handleContinue}
                        >
                            {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                            {feedback === 'success' ? <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" /> : <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />}
                        </QuestButton>
                    </div>
                </div>
            )}
        </div>
    );
};
