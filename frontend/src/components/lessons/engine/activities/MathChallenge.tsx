import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, Delete, Eraser } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

interface MathChallengeProps {
    exercise: any;
    onSubmit: (answer: string) => boolean;
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
        // Delegate validation to useLessonState via onSubmit (single source of truth)
        const isCorrect = onSubmit(input);
        setFeedback(isCorrect ? 'success' : 'error');
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
            <div className="liquid-glass-strong p-6 rounded-3xl w-full mb-6 text-center shadow-xl border border-white/20 dark:border-white/10">
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
                    className="relative overflow-hidden w-full h-14 text-lg font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-2xl shadow-[0_4px_0_rgb(107,33,168)] hover:shadow-[0_2px_0_rgb(107,33,168)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all disabled:opacity-50 disabled:shadow-none"
                >
                    <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                    <span className="relative flex items-center justify-center">{t('actions.verify')}</span>
                </Button>
            ) : (
                <Button
                    onClick={handleContinue}
                    className={cn(
                        "relative overflow-hidden w-full h-14 text-lg font-bold rounded-2xl transition-all",
                        feedback === 'success'
                            ? "bg-green-500 hover:bg-green-600 text-white shadow-[0_4px_0_rgb(22,101,52)]"
                            : "bg-orange-500 hover:bg-orange-600 text-white shadow-[0_4px_0_rgb(194,65,12)]",
                        "hover:translate-y-[2px] active:translate-y-1 active:shadow-none"
                    )}
                >
                    <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                    <span className="relative flex items-center justify-center">
                        {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                        <ArrowRight className="ml-2 w-5 h-5" />
                    </span>
                </Button>
            )}
        </div>
    );
};
