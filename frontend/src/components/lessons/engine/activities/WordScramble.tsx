import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, RotateCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

interface WordScrambleProps {
    exercise: any;
    onSubmit: (word: string) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const WordScramble = ({ exercise, onSubmit, onNext, onRetry }: WordScrambleProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const targetWord = (exercise.content.word || "").toUpperCase();
    const [scrambledLetters, setScrambledLetters] = useState<{ id: string, char: string }[]>([]);
    const [placedLetters, setPlacedLetters] = useState<(string | null)[]>([]); // Array of chars at positions
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');

    useEffect(() => {
        resetGame();
    }, [exercise]);

    const resetGame = () => {
        if (!targetWord) return;
        const chars = targetWord.split('');
        const letterObjs = chars.map((c: string, i: number) => ({ id: `${i}-${c}`, char: c }));

        // Shuffle
        const initialScramble = [...letterObjs];
        for (let i = initialScramble.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [initialScramble[i], initialScramble[j]] = [initialScramble[j], initialScramble[i]];
        }

        setSlots(new Array(targetWord.length).fill(null));
        setAvailableIds(initialScramble.map(l => l.id));
        setFeedback('none');
    };

    const handleLetterClick = (letterObj: { id: string, char: string }) => {
        if (feedback !== 'none') return;

        // Check if letter is already placed. If not, place in first empty slot.
        // If already placed, remove it (return to pool).

        const currentIdx = placedLetters.indexOf(letterObj.id); // Storing IDs in placed array? No, simpler to store ID.
        // Let's store IDs in placedLetters to track exactly which tile is where.

    };

    // Actually let's restart logic: 
    // Two pools: Available and Placed.
    const [availableIds, setAvailableIds] = useState<string[]>([]);
    const [slots, setSlots] = useState<(string | null)[]>([]); // Array of IDs or Null

    useEffect(() => {
        if (!targetWord) return;
        const chars = targetWord.split('');
        const letterObjs = chars.map((c: string, i: number) => ({ id: `${i}-${c}`, char: c }));

        // Shuffle for scramble
        const initialScramble = [...letterObjs];
        for (let i = initialScramble.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [initialScramble[i], initialScramble[j]] = [initialScramble[j], initialScramble[i]];
        }

        // Store the LETTER OBJECTS in state so we can render them by ID lookup?
        // Let's just store the full object array as "Bank" and IDs in lists.
        // Actually, let's keep it simple: 
        // 1. Bank of letters (Objects).
        // 2. Slots (Array of Objects or Null).
        setSlots(new Array(targetWord.length).fill(null));
        setAvailableIds(initialScramble.map(l => l.id)); // All available initially
        setFeedback('none');
    }, [targetWord]);

    const getLetterById = (id: string) => {
        const idx = parseInt(id.split('-')[0]);
        const char = id.split('-')[1];
        return { id, char }; // Simple reconstruction or lookup if we kept map
    }

    const handleBankClick = (id: string) => {
        if (feedback !== 'none') return;
        playSound('ui_tap');

        // Find first empty slot
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

        // Return to bank
        const newSlots = [...slots];
        newSlots[index] = null;
        setSlots(newSlots);

        setAvailableIds(prev => [...prev, id]);
    };

    const handleCheck = () => {
        // Construct word from slots
        const currentWord = slots.map(id => id ? id.split('-')[1] : '').join('');
        // Delegate validation to useLessonState via onSubmit (single source of truth)
        const isCorrect = onSubmit(currentWord);
        setFeedback(isCorrect ? 'success' : 'error');
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            // Reset
            // Shuffle available again? Or just clear slots.
            const chars = targetWord.split('');
            const letterIds = chars.map((c: string, i: number) => `${i}-${c}`);
            setAvailableIds(letterIds.sort(() => Math.random() - 0.5));
            setSlots(new Array(targetWord.length).fill(null));
            setFeedback('none');
            onRetry();
        }
    };

    return (
        <div className="w-full max-w-lg animate-slide-in-bottom flex flex-col items-center">

            {/* Hint / Question */}
            <div className="mb-8 text-center">
                <p className="text-muted-foreground font-medium mb-2">{exercise.content.question || t('instructions.word_scramble')}</p>
                {exercise.content.hint && (
                    <div className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 px-4 py-2 rounded-full text-sm inline-block">
                        💡 {exercise.content.hint}
                    </div>
                )}
            </div>

            {/* Answer Slots */}
            <div className="flex flex-wrap justify-center gap-2 mb-10 min-h-[80px]">
                {slots.map((id, idx) => (
                    <button
                        key={idx}
                        onClick={() => handleSlotClick(idx)}
                        className={cn(
                            "w-12 h-14 sm:w-14 sm:h-16 rounded-xl border-b-4 text-2xl font-bold flex items-center justify-center transition-all",
                            id
                                ? "bg-purple-100 dark:bg-purple-900 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-100 shadow-sm hover:-translate-y-1"
                                : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 border-dashed"
                        )}
                    >
                        {id ? id.split('-')[1] : ''}
                    </button>
                ))}
            </div>

            {/* Letter Bank */}
            <div className="flex flex-wrap justify-center gap-3 mb-8 min-h-[100px]">
                {availableIds.map((id) => (
                    <button
                        key={id}
                        onClick={() => handleBankClick(id)}
                        className="w-12 h-14 sm:w-14 sm:h-16 rounded-xl bg-white dark:bg-slate-700 border-b-4 border-slate-200 dark:border-slate-600 shadow-sm text-2xl font-bold text-slate-700 dark:text-slate-200 hover:-translate-y-1 hover:shadow-md active:translate-y-0 active:shadow-none transition-all"
                    >
                        {id.split('-')[1]}
                    </button>
                ))}
            </div>

            {/* Actions */}
            {feedback === 'none' ? (
                <div className="w-full max-w-xs flex gap-3">
                    <Button
                        variant="ghost"
                        onClick={resetGame}
                        className="h-14 sm:h-16 px-4 rounded-2xl"
                        title="Reset"
                    >
                        <RotateCw className="w-6 h-6" />
                    </Button>
                    <Button
                        onClick={handleCheck}
                        disabled={slots.some(s => s === null)}
                        className="flex-1 h-14 sm:h-16 text-lg sm:text-xl font-bold bg-purple-500 hover:bg-purple-600 text-white rounded-2xl shadow-[0_4px_0_rgb(107,33,168)] hover:shadow-[0_2px_0_rgb(107,33,168)] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                    >
                        {t('actions.verify')}
                    </Button>
                </div>
            ) : (
                <Button
                    onClick={handleContinue}
                    className={cn(
                        "w-full max-w-sm h-14 sm:h-16 text-lg sm:text-xl font-bold rounded-2xl transition-all flex items-center justify-center gap-2",
                        feedback === 'success'
                            ? "bg-green-500 hover:bg-green-600 text-white shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)]"
                            : "bg-orange-500 hover:bg-orange-600 text-white shadow-[0_4px_0_rgb(194,65,12)] hover:shadow-[0_2px_0_rgb(194,65,12)]",
                        "hover:-translate-y-[2px] active:translate-y-[4px] active:shadow-none"
                    )}
                >
                    {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                    <ArrowRight className="w-5 h-5" />
                </Button>
            )}
        </div>
    );
};
