import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, Delete, Eraser } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

interface MathChallengeProps {
    exercise: any;
    onSubmit: (answer: string) => void;
    onNext: () => void;
    onRetry: () => void;
}

export const MathChallenge = ({ exercise, onSubmit, onNext, onRetry }: MathChallengeProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [input, setInput] = useState('');
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');

    useEffect(() => {
        setInput('');
        setFeedback('none');
    }, [exercise]);

    const handleKeyPress = (key: string) => {
        if (feedback !== 'none') return;
        playSound('ui_tap');

        if (input.length < 10) { // Limit length
            setInput(prev => prev + key);
        }
    };

    const handleDelete = () => {
        if (feedback !== 'none') return;
        playSound('ui_tap');
        setInput(prev => prev.slice(0, -1));
    };

    const handleCheck = () => {
        // Support both correctValue (number) and correctOptionId (string)
        const val = exercise.correct_answer?.correctValue ?? exercise.correct_answer?.correctOptionId;

        // Convert both to string for strict comparison
        const isCorrect = String(input) === String(val);

        setFeedback(isCorrect ? 'success' : 'error');
        onSubmit(input);

        if (isCorrect) playSound('edu_success');
        else playSound('edu_error');
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            setInput('');
            setFeedback('none');
            onRetry();
        }
    };

    return (
        <div className="w-full max-w-sm animate-slide-in-bottom flex flex-col items-center">

            {/* Display / Question */}
            <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-3xl w-full mb-6 text-center shadow-inner border-2 border-slate-200 dark:border-slate-700">
                <h3 className="text-xl font-medium text-slate-500 mb-2 uppercase tracking-wide">
                    {t('actions.calculate')}
                </h3>
                <div className="text-4xl sm:text-5xl font-mono font-bold text-slate-800 dark:text-slate-100 tracking-wider h-16 flex items-center justify-center">
                    {input || <span className="text-slate-300 animate-pulse">?</span>}
                </div>
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-3 w-full mb-6">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                        key={num}
                        onClick={() => handleKeyPress(num.toString())}
                        disabled={feedback !== 'none'}
                        className="bg-white dark:bg-slate-700 h-16 rounded-2xl text-2xl font-bold shadow-sm border-b-4 border-slate-200 dark:border-slate-600 active:border-b-0 active:translate-y-1 transition-all hover:bg-slate-50 dark:hover:bg-slate-600"
                    >
                        {num}
                    </button>
                ))}

                {/* 0 and Controls */}
                <button
                    onClick={() => handleKeyPress('.')}
                    disabled={feedback !== 'none'}
                    className="bg-slate-100 dark:bg-slate-800 h-16 rounded-2xl text-2xl font-bold shadow-sm border-b-4 border-slate-200 dark:border-slate-600 active:border-b-0 active:translate-y-1 transition-all"
                >
                    .
                </button>
                <button
                    onClick={() => handleKeyPress('0')}
                    disabled={feedback !== 'none'}
                    className="bg-white dark:bg-slate-700 h-16 rounded-2xl text-2xl font-bold shadow-sm border-b-4 border-slate-200 dark:border-slate-600 active:border-b-0 active:translate-y-1 transition-all hover:bg-slate-50 dark:hover:bg-slate-600"
                >
                    0
                </button>
                <button
                    onClick={handleDelete}
                    disabled={feedback !== 'none'}
                    className="bg-red-100 dark:bg-red-900/30 text-red-600 h-16 rounded-2xl flex items-center justify-center shadow-sm border-b-4 border-red-200 dark:border-red-900 active:border-b-0 active:translate-y-1 transition-all"
                >
                    <Delete className="w-6 h-6" />
                </button>
            </div>

            {/* Action Button */}
            {feedback === 'none' ? (
                <Button
                    onClick={handleCheck}
                    disabled={input.length === 0}
                    className="w-full h-14 text-lg font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-2xl shadow-[0_4px_0_rgb(107,33,168)] hover:shadow-[0_2px_0_rgb(107,33,168)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all disabled:opacity-50 disabled:shadow-none"
                >
                    {t('actions.verify')}
                </Button>
            ) : (
                <Button
                    onClick={handleContinue}
                    className={cn(
                        "w-full h-14 text-lg font-bold rounded-2xl transition-all",
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
