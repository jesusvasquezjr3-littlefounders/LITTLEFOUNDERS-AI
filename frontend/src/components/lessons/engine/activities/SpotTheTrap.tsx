import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, AlertTriangle, ShieldCheck, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

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

    // 1. Try legacy messages format
    // 2. Fall back to scenarios format and map to message shape
    const rawMessages = exercise.content?.messages;
    const rawScenarios = exercise.content?.scenarios;

    const messages = rawMessages
        ? rawMessages
        : rawScenarios
            ? rawScenarios.map((scenario: any) => ({
                id: scenario.id,
                text: scenario.text,
                isTrap: scenario.isTrap,
                sender: '',
                hints: [],
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
                <div className="inline-flex items-center gap-2 bg-amber-100 dark:bg-amber-900/30 border-2 border-amber-400 dark:border-amber-700 rounded-full px-6 py-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    <span className="font-bold text-amber-800 dark:text-amber-200">
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
                                    "w-full text-left p-4 rounded-xl border-2 transition-all duration-300 relative overflow-hidden cursor-pointer select-none",
                                    "bg-white dark:bg-slate-800",
                                    feedback === 'none' && "focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2",
                                    !isRevealed && !isSelected && "border-slate-200 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-600 hover:shadow-lg",
                                    !isRevealed && isSelected && "border-red-500 dark:border-red-600 ring-4 ring-red-200 dark:ring-red-900/50 shadow-lg",
                                    isRevealed && isTrap && "border-red-500 bg-red-50 dark:bg-red-950/30",
                                    isRevealed && !isTrap && "border-green-500 bg-green-50 dark:bg-green-950/30"
                                )}
                            >
                                {/* Message Header */}
                                <div className="flex items-start justify-between mb-2">
                                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0">
                                        <Mail className={cn(
                                            "w-5 h-5",
                                            isTrap ? "text-red-600 dark:text-red-400" : "text-blue-600 dark:text-blue-400"
                                        )} />
                                    </div>
                                    <div className="flex-1 ml-3">
                                        {msg.sender && (
                                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                                                {msg.sender}
                                            </div>
                                        )}
                                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-relaxed">
                                            {msg.text}
                                        </p>
                                    </div>
                                </div>

                                {/* Suspicious Indicators (Hints) */}
                                {!isRevealed && msg.hints && msg.hints.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {msg.hints.map((hint: string, idx: number) => (
                                            <span key={idx} className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-1 rounded-full">
                                                {hint}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Reveal Stamp */}
                                {isRevealed && (
                                    <div className="absolute top-4 right-4 animate-in zoom-in">
                                        {isTrap ? (
                                            <div className="bg-red-600 text-white font-black text-sm px-4 py-2 rounded-lg rotate-12 shadow-lg border-2 border-red-700">
                                                {t('spot_trap.trap', { defaultValue: '¡Trampa!' })} ⚠️
                                            </div>
                                        ) : (
                                            <div className="bg-green-600 text-white font-black text-sm px-4 py-2 rounded-lg -rotate-12 shadow-lg border-2 border-green-700 flex items-center gap-1">
                                                <ShieldCheck className="w-4 h-4" />
                                                {t('spot_trap.safe', { defaultValue: 'Seguro' })}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Selection Indicator */}
                                {!isRevealed && isSelected && (
                                    <div className="absolute top-4 right-4 w-8 h-8 bg-red-600 rounded-full flex items-center justify-center animate-in zoom-in">
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
                        <p className="text-base font-medium text-slate-800 dark:text-slate-100 leading-relaxed text-center">
                            {fallbackText}
                        </p>
                    )}
                    <div className="space-y-3">
                        {fallbackOptions.map((opt: any) => {
                            const optId = opt.id || opt.value || opt.label || String(opt);
                            const optLabel = opt.label || opt.text || opt.value || String(opt);
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
                                        "w-full text-left p-4 rounded-xl border-2 transition-all duration-300 cursor-pointer select-none",
                                        "bg-white dark:bg-slate-800",
                                        feedback === 'none' && "focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2",
                                        !isRevealed && !isSelected && "border-slate-200 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-600 hover:shadow-lg",
                                        !isRevealed && isSelected && "border-red-500 dark:border-red-600 ring-4 ring-red-200 dark:ring-red-900/50 shadow-lg",
                                        isRevealed && isCorrectAnswer && "border-green-500 bg-green-50 dark:bg-green-950/30",
                                        isRevealed && !isCorrectAnswer && isSelected && "border-red-500 bg-red-50 dark:bg-red-950/30"
                                    )}
                                >
                                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-relaxed">
                                        {optLabel}
                                    </p>
                                    {isRevealed && isCorrectAnswer && (
                                        <div className="mt-2 flex items-center gap-1 text-green-600 dark:text-green-400 text-xs font-bold">
                                            <ShieldCheck className="w-4 h-4" />
                                            {t('spot_trap.safe', { defaultValue: 'Seguro' })}
                                        </div>
                                    )}
                                    {isRevealed && !isCorrectAnswer && isSelected && (
                                        <div className="mt-2 flex items-center gap-1 text-red-600 dark:text-red-400 text-xs font-bold">
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
                    <Button
                        onClick={handleCheck}
                        disabled={!isFallbackMode && selectedTraps.size === 0}
                        className="relative overflow-hidden w-full max-w-md h-12 text-base font-bold bg-red-600 hover:bg-red-700 text-white rounded-2xl shadow-[0_4px_0_rgb(153,27,27)] hover:shadow-[0_2px_0_rgb(153,27,27)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all disabled:opacity-50 disabled:shadow-none"
                    >
                        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                        <span className="relative flex items-center justify-center">
                            {t('actions.verify', { defaultValue: 'Verificar' })}
                        </span>
                    </Button>
                ) : (
                    <div className="flex flex-col items-center w-full">
                        <p className={cn("font-bold text-lg mb-3", feedback === 'success' ? "text-green-500" : "text-orange-500")}>
                            {feedback === 'success'
                                ? t('status.correct', { defaultValue: '¡Correcto!' })
                                : t('status.incorrect', { defaultValue: '¡Incorrecto!' })}
                        </p>
                        <Button
                            onClick={handleContinue}
                            className={cn(
                                "relative overflow-hidden w-full max-w-md h-12 text-base font-bold rounded-2xl transition-all",
                                feedback === 'success'
                                    ? "bg-green-500 hover:bg-green-600 text-white shadow-[0_4px_0_rgb(22,101,52)]"
                                    : "bg-orange-500 hover:bg-orange-600 text-white shadow-[0_4px_0_rgb(194,65,12)]",
                                "hover:translate-y-[2px] active:translate-y-1 active:shadow-none"
                            )}
                        >
                            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                            <span className="relative flex items-center justify-center">
                                {feedback === 'success'
                                    ? t('actions.continue', { defaultValue: 'Continuar' })
                                    : t('actions.retry', { defaultValue: 'Reintentar' })}
                                <ArrowRight className="ml-2 w-5 h-5" />
                            </span>
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};
