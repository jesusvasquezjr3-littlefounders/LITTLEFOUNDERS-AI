import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

interface FillBlankProps {
    exercise: any;
    onSubmit: (answer: any) => void;
    onNext: () => void;
    onRetry: () => void;
}

export const FillBlank = ({ exercise, onSubmit, onNext, onRetry }: FillBlankProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    // Sentence structure: "The [blank] is blue."
    // We need to parse the sentence text to find blanks. 
    // Format convention: "The {{blank}} is blue." or use splits.
    // For simplicity, let's assume `segments` array in content: ["The ", null, " is blue."]

    const [selectedWords, setSelectedWords] = useState<Record<number, string>>({}); // valid blank index -> wordId
    const [wordBank, setWordBank] = useState<any[]>([]);
    const [isChecked, setIsChecked] = useState(false);
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');

    const segments = exercise.content.segments || []; // ["Text", "BLANK", "Text"]
    // Or simpler: text with placeholders {0}, {1} etc.

    useEffect(() => {
        // Reset
        setSelectedWords({});
        setIsChecked(false);
        setFeedback('none');

        if (exercise.content.options) {
            const shuffled = [...exercise.content.options];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            setWordBank(shuffled);
        }
    }, [exercise]);

    const handleWordSelect = (word: any) => {
        if (isChecked) return;
        playSound('ui_tap');

        // Find first empty blank
        const firstEmptyIndex = segments.findIndex((seg: any, idx: number) => seg.type === 'blank' && !selectedWords[idx]);

        if (firstEmptyIndex !== -1) {
            setSelectedWords(prev => ({ ...prev, [firstEmptyIndex]: word.id }));
        }
    };

    const handleRemoveWord = (index: number) => {
        if (isChecked) return;
        playSound('ui_tap');
        const newSelected = { ...selectedWords };
        delete newSelected[index];
        setSelectedWords(newSelected);
    };

    const handleCheck = () => {
        const correctAnswers = exercise.correct_answer?.blank_ids || {}; // index -> wordId
        // Validate
        let isCorrect = true;
        Object.keys(correctAnswers).forEach(key => { // key is "b1"
            // Find the segment index that has this ID
            const segmentIndex = segments.findIndex((s: any) => s.id === key);
            if (segmentIndex !== -1) {
                if (selectedWords[segmentIndex] !== correctAnswers[key]) isCorrect = false;
            } else {
                // Fallback for legacy numeric keys if any
                if (selectedWords[parseInt(key)] !== correctAnswers[key]) isCorrect = false;
            }
        });

        setIsChecked(true);
        setFeedback(isCorrect ? 'success' : 'error');
        onSubmit(selectedWords);
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            // Retry
            setSelectedWords({});
            setIsChecked(false);
            setFeedback('none');
            onRetry();
        }
    };

    const isBankWordUsed = (wordId: string) => {
        return Object.values(selectedWords).includes(wordId);
    };

    return (
        <div className="w-full max-w-2xl animate-slide-in-bottom flex flex-col items-center">
            {/* Sentence Area */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border-2 border-slate-100 dark:border-slate-800 mb-8 w-full">
                <div className="flex flex-wrap gap-2 items-end justify-center text-xl sm:text-2xl font-medium leading-loose">
                    {segments.map((segment: any, idx: number) => {
                        if (segment.type === 'text') {
                            return <span key={idx}>{segment.text}</span>;
                        } else {
                            // Blank
                            const filledWordId = selectedWords[idx];
                            const filledWord = wordBank.find(w => w.id === filledWordId);

                            return (
                                <button
                                    key={idx}
                                    onClick={() => handleRemoveWord(idx)}
                                    className={cn(
                                        "min-w-[80px] h-10 px-3 rounded-lg border-b-4 transition-all mx-1 mb-1 font-bold text-center",
                                        filledWord
                                            ? "bg-purple-100 text-purple-700 border-purple-300 hover:bg-red-100 hover:text-red-600 hover:border-red-300" // Click to remove
                                            : "bg-slate-100 border-slate-300 animate-pulse"
                                    )}
                                >
                                    {filledWord ? filledWord.text : "____"}
                                </button>
                            );
                        }
                    })}
                </div>
            </div>

            {/* Checked Feedback */}
            {isChecked && (
                <div className="mb-6 text-center animate-in zoom-in">
                    <span className="text-4xl block mb-2">{feedback === 'success' ? '🎉' : '🤔'}</span>
                    <p className={cn("font-bold text-xl", feedback === 'success' ? "text-green-500" : "text-orange-500")}>
                        {feedback === 'success' ? t('feedback.success') : t('feedback.error')}
                    </p>
                </div>
            )}

            {/* Word Bank */}
            <div className="flex flex-wrap justify-center gap-3 mb-8">
                {wordBank.map((word) => {
                    const isUsed = isBankWordUsed(word.id);
                    return (
                        <button
                            key={word.id}
                            onClick={() => handleWordSelect(word)}
                            disabled={isUsed || isChecked}
                            className={cn(
                                "px-6 py-3 rounded-xl font-bold shadow-sm transition-all border-b-4 text-lg",
                                isUsed
                                    ? "opacity-0 scale-50 pointer-events-none"
                                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:-translate-y-1 hover:shadow-md active:translate-y-0 active:shadow-none bg-gradient-to-br from-indigo-50 to-white dark:from-slate-800 dark:to-slate-900"
                            )}
                        >
                            {word.text}
                        </button>
                    );
                })}
            </div>

            {/* Actions */}
            {!isChecked ? (
                <Button
                    onClick={handleCheck}
                    disabled={Object.keys(selectedWords).length < segments.filter((s: any) => s.type === 'blank').length}
                    className="w-full max-w-sm h-14 text-lg font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-2xl shadow-[0_4px_0_rgb(107,33,168)] hover:shadow-[0_2px_0_rgb(107,33,168)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all disabled:opacity-50 disabled:shadow-none"
                >
                    {t('actions.verify')}
                </Button>
            ) : (
                <Button
                    onClick={handleContinue}
                    className={cn(
                        "w-full max-w-sm h-14 text-lg font-bold rounded-2xl transition-all",
                        feedback === 'success'
                            ? "bg-green-500 hover:bg-green-600 text-white shadow-[0_4px_0_rgb(22,101,52)]"
                            : "bg-orange-500 hover:bg-orange-600 text-white shadow-[0_4px_0_rgb(194,65,12)]",
                        "hover:translate-y-[2px] active:translate-y-1 active:shadow-none"
                    )}
                >
                    {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                    <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
            )}
        </div>
    );
};
