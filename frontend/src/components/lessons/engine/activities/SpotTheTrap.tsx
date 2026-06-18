import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, RotateCcw, AlertTriangle, ShieldCheck, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';
import { pickText, speakerOf, messageOf } from './fieldText';

interface SpotTheTrapProps {
    exercise: any;
    onSubmit: (selectedIds: string[]) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const SpotTheTrap = ({ exercise, onSubmit, onNext, onRetry }: SpotTheTrapProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [selectedTraps, setSelectedTraps] = useState<Set<string>>(new Set());
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');
    const [revealedMessages, setRevealedMessages] = useState<Set<string>>(new Set());
    const [fallbackSelection, setFallbackSelection] = useState<string>('');

    useEffect(() => {
        setSelectedTraps(new Set());
        setFeedback('none');
        setRevealedMessages(new Set());
        setFallbackSelection('');
    }, [exercise]);

    // Selectable items can live under many content keys across the real corpus.
    // Pick the first present container and normalize to the message shape so the
    // exercise always renders (options/choices stay as the fallback mode below).
    const CONTAINER_KEYS = [
        'messages', 'scenarios', 'traps', 'statements', 'items', 'plans',
        'planSteps', 'segments', 'textSegments', 'lines', 'redFlags', 'steps',
    ];
    const rawList = CONTAINER_KEYS
        .map((k) => exercise.content?.[k])
        .find((v) => Array.isArray(v) && v.length > 0);

    const messages = Array.isArray(rawList)
        ? rawList.map((it: any, idx: number) => ({
            id: it?.id ?? `seg${idx}`,
            text: messageOf(it) || pickText(it, ['text', 'label', 'content', 'statement']) || String(it ?? ''),
            isTrap: it?.isTrap ?? it?.isCorrect ?? false,
            sender: speakerOf(it),
            hints: it?.hints ?? [],
        }))
        : [];

    // Fallback options for when neither messages nor scenarios exist
    const fallbackOptions =
        exercise.content?.options ||
        exercise.content?.choices ||
        [];
    const fallbackText =
        exercise.content?.instruction ||
        exercise.content?.scenario ||
        exercise.content?.question ||
        exercise.content?.prompt ||
        '';

    const toggleTrap = (messageId: string) => {
        if (feedback !== 'none') return;
        playSound('ui_tap');

        setSelectedTraps(prev => {
            const newSet = new Set(prev);
            if (newSet.has(messageId)) {
                newSet.delete(messageId);
            } else {
                newSet.add(messageId);
            }
            return newSet;
        });
    };

    const handleCheck = () => {
        const selectedArray = Array.from(selectedTraps);
        // Delegate validation to useLessonState via onSubmit (single source of truth)
        const isCorrect = onSubmit(selectedArray);

        setFeedback(isCorrect ? 'success' : 'error');
        setRevealedMessages(new Set(messages.map((m: any) => m.id)));
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            setSelectedTraps(new Set());
            setFeedback('none');
            setRevealedMessages(new Set());
            onRetry();
        }
    };

    const handleFallbackSubmit = (optionId: string) => {
        if (feedback !== 'none') return;
        playSound('ui_tap');
        setFallbackSelection(optionId);
        const isCorrect = onSubmit([optionId]);
        setFeedback(isCorrect ? 'success' : 'error');
    };

    const correctTraps = new Set(exercise.correct_answer?.trapIds || []);

    const isFallbackMode = messages.length === 0;

    return (
        <div className="w-full max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">

            <div className="mb-8 text-center">
                <div
                    className="lp-chip inline-flex items-center gap-2 px-6 py-3"
                    style={{ background: 'var(--lp-amber-soft)', borderColor: 'var(--lp-amber)' }}
                >
                    <AlertTriangle className="w-5 h-5" style={{ color: 'var(--lp-amber-ink)' }} />
                    <span className="lp-display" style={{ color: 'var(--lp-amber-ink)' }}>
                        {t('spot_trap.warning', { defaultValue: '¡Cuidado! Identifica las trampas' })}
                    </span>
                </div>
            </div>

            {/* Messages or Scenarios */}
            {!isFallbackMode && (
                <div className="space-y-3 mb-6">
                    {messages.map((msg: any) => {
                        const isSelected = selectedTraps.has(msg.id);
                        const isTrap = msg.isTrap;
                        const isRevealed = revealedMessages.has(msg.id);

                        return (
                            <div
                                role="button"
                                tabIndex={0}
                                key={msg.id}
                                onClick={() => toggleTrap(msg.id)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        toggleTrap(msg.id);
                                    }
                                }}
                                className={cn(
                                    "lp-token lp-option lp-option--coral w-full text-left p-4 relative overflow-hidden select-none",
                                    "animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both",
                                    feedback === 'none' && "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-amber)] focus-visible:ring-offset-2",
                                    isRevealed && "lp-token--locked",
                                    !isRevealed && isSelected && "is-selected",
                                    isRevealed && isTrap && "is-wrong",
                                    isRevealed && !isTrap && "is-correct"
                                )}
                            >
                                {/* Message Header */}
                                <div className="flex items-start justify-between mb-2">
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0">
                                        <Mail
                                            className="w-5 h-5"
                                            style={{ color: isRevealed ? (isTrap ? 'var(--lp-coral)' : 'var(--lp-emerald)') : 'var(--lp-muted)' }}
                                        />
                                    </div>
                                    <div className="flex-1 ml-3">
                                        {msg.sender && (
                                            <div className="text-xs mb-1" style={{ color: 'var(--lp-muted)' }}>
                                                {msg.sender}
                                            </div>
                                        )}
                                        <p className="lp-display text-sm leading-relaxed" style={{ color: 'var(--lp-ink)' }}>
                                            {msg.text}
                                        </p>
                                    </div>
                                </div>

                                {/* Suspicious Indicators (Hints) */}
                                {!isRevealed && msg.hints && msg.hints.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {msg.hints.map((hint: string, idx: number) => (
                                            <span
                                                key={idx}
                                                className="text-xs font-bold px-2 py-1 rounded-full"
                                                style={{ background: 'var(--lp-indigo-soft)', color: 'var(--lp-indigo-ink)' }}
                                            >
                                                {hint}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Reveal Stamp */}
                                {isRevealed && (
                                    <div className="absolute top-4 right-4 animate-in zoom-in">
                                        {isTrap ? (
                                            <div
                                                className="lp-display text-white text-sm px-4 py-2 rounded-lg rotate-12 shadow-lg border-2"
                                                style={{ background: 'var(--lp-coral)', borderColor: 'var(--lp-coral-lip)' }}
                                            >
                                                {t('spot_trap.trap', { defaultValue: '¡Trampa!' })} ⚠️
                                            </div>
                                        ) : (
                                            <div
                                                className="lp-display text-white text-sm px-4 py-2 rounded-lg -rotate-12 shadow-lg border-2 flex items-center gap-1"
                                                style={{ background: 'var(--lp-emerald)', borderColor: 'var(--lp-emerald-lip)' }}
                                            >
                                                <ShieldCheck className="w-4 h-4" />
                                                {t('spot_trap.safe', { defaultValue: 'Seguro' })}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Selection Indicator */}
                                {!isRevealed && isSelected && (
                                    <div
                                        className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center animate-in zoom-in"
                                        style={{ background: 'var(--lp-coral)' }}
                                    >
                                        <AlertTriangle className="w-5 h-5 text-white" />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Fallback: instruction text + multiple-choice buttons */}
            {isFallbackMode && (
                <div className="space-y-4 mb-6">
                    {fallbackText && (
                        <p className="lp-display text-base leading-relaxed text-center" style={{ color: 'var(--lp-ink)' }}>
                            {fallbackText}
                        </p>
                    )}
                    <div className="space-y-3">
                        {fallbackOptions.map((opt: any) => {
                            const optId = opt?.id || opt?.value || opt?.label || JSON.stringify(opt);
                            const optLabel = pickText(opt) || String(opt);
                            const isSelected = fallbackSelection === optId;
                            const isRevealed = feedback !== 'none';
                            const isCorrectAnswer = correctTraps.has(optId);

                            return (
                                <div
                                    role="button"
                                    tabIndex={0}
                                    key={optId}
                                    onClick={() => handleFallbackSubmit(optId)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            handleFallbackSubmit(optId);
                                        }
                                    }}
                                    className={cn(
                                        "lp-token lp-option lp-option--indigo w-full text-left p-4 select-none",
                                        "animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both",
                                        feedback === 'none' && "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-amber)] focus-visible:ring-offset-2",
                                        isRevealed && "lp-token--locked",
                                        !isRevealed && isSelected && "is-selected",
                                        isRevealed && isCorrectAnswer && "is-correct",
                                        isRevealed && !isCorrectAnswer && isSelected && "is-wrong"
                                    )}
                                >
                                    <p className="lp-display text-sm leading-relaxed" style={{ color: 'var(--lp-ink)' }}>
                                        {optLabel}
                                    </p>
                                    {isRevealed && isCorrectAnswer && (
                                        <div className="mt-2 flex items-center gap-1 text-xs font-bold" style={{ color: 'var(--lp-emerald-ink)' }}>
                                            <ShieldCheck className="w-4 h-4" />
                                            {t('spot_trap.safe', { defaultValue: 'Seguro' })}
                                        </div>
                                    )}
                                    {isRevealed && !isCorrectAnswer && isSelected && (
                                        <div className="mt-2 flex items-center gap-1 text-xs font-bold" style={{ color: 'var(--lp-coral-ink)' }}>
                                            <AlertTriangle className="w-4 h-4" />
                                            {t('spot_trap.trap', { defaultValue: '¡Trampa!' })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-center">
                {feedback === 'none' ? (
                    <div className="w-full max-w-md">
                        <QuestButton
                            variant="gold"
                            onClick={handleCheck}
                            disabled={!isFallbackMode && selectedTraps.size === 0}
                        >
                            {t('actions.verify', { defaultValue: 'Verificar' })}
                        </QuestButton>
                    </div>
                ) : (
                    <div className="flex flex-col items-center w-full max-w-md">
                        <p
                            className="lp-display text-lg mb-3"
                            style={{ color: feedback === 'success' ? 'var(--lp-emerald)' : 'var(--lp-coral)' }}
                        >
                            {feedback === 'success'
                                ? t('status.correct', { defaultValue: '¡Correcto!' })
                                : t('status.incorrect', { defaultValue: '¡Incorrecto!' })}
                        </p>
                        <QuestButton
                            variant={feedback === 'success' ? 'go' : 'retry'}
                            onClick={handleContinue}
                        >
                            {feedback === 'success'
                                ? t('actions.continue', { defaultValue: 'Continuar' })
                                : t('actions.retry', { defaultValue: 'Reintentar' })}
                            {feedback === 'success' ? <ArrowRight className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
                        </QuestButton>
                    </div>
                )}
            </div>
        </div>
    );
};
