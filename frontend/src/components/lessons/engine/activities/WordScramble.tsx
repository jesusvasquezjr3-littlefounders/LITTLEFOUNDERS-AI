import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, RotateCw, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from "../ui/QuestButton";

interface WordScrambleProps {
    exercise: any;
    onSubmit: (word: string) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

/** Fisher-Yates shuffle (unbiased) */
function shuffleArray<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export const WordScramble = ({ exercise, onSubmit, onNext, onRetry }: WordScrambleProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const targetWord = String(exercise?.content?.word || "").toUpperCase();
    const [availableIds, setAvailableIds] = useState<string[]>([]);
    const [slots, setSlots] = useState<(string | null)[]>([]);
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');

    const resetGame = useCallback(() => {
        if (!targetWord) return;
        const chars = targetWord.split('');
        const letterObjs = chars.map((c: string, i: number) => `${i}-${c}`);
        setSlots(new Array(targetWord.length).fill(null));
        setAvailableIds(shuffleArray(letterObjs));
        setFeedback('none');
    }, [targetWord]);

    useEffect(() => {
        resetGame();
    }, [resetGame]);

    const handleBankClick = (id: string) => {
        if (feedback !== 'none') return;
        playSound('ui_tap');

        const emptyIndex = slots.indexOf(null);
        if (emptyIndex !== -1) {
            const newSlots = [...slots];
            newSlots[emptyIndex] = id;
            setSlots(newSlots);
            setAvailableIds(prev => prev.filter(pid => pid !== id));
        }
    };

    const handleSlotClick = (index: number) => {
        if (feedback !== 'none') return;
        const id = slots[index];
        if (!id) return;

        playSound('ui_tap');
        const newSlots = [...slots];
        newSlots[index] = null;
        setSlots(newSlots);
        setAvailableIds(prev => [...prev, id]);
    };

    const handleCheck = () => {
        const currentWord = slots.map(id => id ? id.split('-')[1] : '').join('');
        const isCorrect = onSubmit(currentWord);
        setFeedback(isCorrect ? 'success' : 'error');
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            resetGame();
            onRetry();
        }
    };

    return (
        <div className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both flex flex-col items-center">

            {/* Hint / Question */}
            <div className="mb-8 text-center">
                <p className="lp-display text-lg sm:text-xl mb-3" style={{ color: "var(--lp-ink)" }}>
                    {exercise?.content?.question || t('instructions.word_scramble')}
                </p>
                {exercise?.content?.hint && (
                    <div
                        className="lp-display px-4 py-2 rounded-full text-sm inline-block"
                        style={{ background: "var(--lp-indigo-soft)", color: "var(--lp-indigo-ink)" }}
                    >
                        <span aria-hidden="true">💡 </span>
                        {exercise.content.hint}
                    </div>
                )}
            </div>

            {/* Answer Slots */}
            <div
                className="flex flex-wrap justify-center gap-2 mb-10 min-h-[80px]"
                role="group"
                aria-label={t('word_scramble.answer_slots', { defaultValue: 'Espacios para la palabra' })}
            >
                {slots.map((id, idx) => (
                    <button
                        key={idx}
                        onClick={() => handleSlotClick(idx)}
                        aria-label={id
                            ? t('word_scramble.letter_slot', { letter: id.split('-')[1], position: idx + 1 })
                            : t('word_scramble.empty_slot', { position: idx + 1 })
                        }
                        className={cn(
                            "lp-display w-12 h-14 sm:w-14 sm:h-16 text-2xl flex items-center justify-center",
                            id
                                ? "lp-token"
                                : "rounded-[16px] border-2 border-dashed"
                        )}
                        style={id
                            ? { background: "var(--lp-indigo-soft)", borderColor: "var(--lp-indigo)", boxShadow: "0 5px 0 var(--lp-indigo-lip)", color: "var(--lp-indigo-ink)" }
                            : { background: "var(--lp-bg-2)", borderColor: "var(--lp-line)" }
                        }
                    >
                        {id ? id.split('-')[1] : ''}
                    </button>
                ))}
            </div>

            {/* Letter Bank */}
            <div
                className="flex flex-wrap justify-center gap-3 mb-8 min-h-[100px]"
                role="group"
                aria-label={t('word_scramble.letter_bank', { defaultValue: 'Banco de letras' })}
            >
                {availableIds.map((id) => (
                    <button
                        key={id}
                        onClick={() => handleBankClick(id)}
                        aria-label={t('word_scramble.letter_tile', { letter: id.split('-')[1] })}
                        className="lp-token lp-display w-12 h-14 sm:w-14 sm:h-16 text-2xl flex items-center justify-center"
                        style={{ color: "var(--lp-ink)" }}
                    >
                        {id.split('-')[1]}
                    </button>
                ))}
            </div>

            {/* Actions */}
            {feedback === 'none' ? (
                <div className="w-full max-w-xs flex gap-3 items-stretch">
                    <button
                        type="button"
                        onClick={resetGame}
                        className="lp-token shrink-0 w-14 sm:w-16 h-[3.75rem] flex items-center justify-center"
                        style={{ color: "var(--lp-muted)" }}
                        title={t('actions.reset', { defaultValue: 'Reiniciar' })}
                        aria-label={t('actions.reset', { defaultValue: 'Reiniciar' })}
                    >
                        <RotateCw className="w-6 h-6" />
                    </button>
                    <QuestButton
                        variant="gold"
                        onClick={handleCheck}
                        disabled={slots.some(s => s === null)}
                        className="flex-1"
                    >
                        {t('actions.verify')}
                    </QuestButton>
                </div>
            ) : (
                <QuestButton
                    variant={feedback === 'success' ? 'go' : 'retry'}
                    onClick={handleContinue}
                    className="max-w-sm"
                >
                    {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                    {feedback === 'success' ? <ArrowRight className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
                </QuestButton>
            )}
        </div>
    );
};
