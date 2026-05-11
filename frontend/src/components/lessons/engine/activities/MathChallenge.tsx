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
            <div className="bg-card p-6 rounded-3xl w-full mb-6 text-center shadow-sm border-2 border-border">
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
                        className="bg-card text-foreground h-16 rounded-2xl text-2xl font-bold border-2 border-border shadow-[0_4px_0_hsl(var(--border))] hover:shadow-[0_2px_0_hsl(var(--border))] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all flex items-center justify-center"
                    >
                        {num}
                    </button>
                ))}

                {/* 0 and Controls */}
                <button
                    onClick={() => handleKeyPress('.')}
                    disabled={feedback !== 'none'}
                    className="bg-muted text-muted-foreground h-16 rounded-2xl text-2xl font-bold border-2 border-border shadow-[0_4px_0_hsl(var(--border))] hover:shadow-[0_2px_0_hsl(var(--border))] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all flex items-center justify-center"
                >
                    .
                </button>
                <button
                    onClick={() => handleKeyPress('0')}
                    disabled={feedback !== 'none'}
                    className="bg-card text-foreground h-16 rounded-2xl text-2xl font-bold border-2 border-border shadow-[0_4px_0_hsl(var(--border))] hover:shadow-[0_2px_0_hsl(var(--border))] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all flex items-center justify-center"
                >
                    0
                </button>
                <button
                    onClick={handleDelete}
                    disabled={feedback !== 'none'}
                    className="bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400 h-16 rounded-2xl flex items-center justify-center border-2 border-red-300 dark:border-red-800 shadow-[0_4px_0_rgb(252,165,165)] dark:shadow-[0_4px_0_rgb(153,27,27)] hover:shadow-[0_2px_0_rgb(252,165,165)] dark:hover:shadow-[0_2px_0_rgb(153,27,27)] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all"
                >
                    <Delete className="w-6 h-6" />
                </button>
            </div>

            {/* Action Button */}
            {feedback === 'none' ? (
                <Button
                    onClick={handleCheck}
                    disabled={input.length === 0}
                    className="w-full h-14 sm:h-16 text-lg sm:text-xl font-bold bg-purple-500 hover:bg-purple-600 text-white rounded-2xl shadow-[0_4px_0_rgb(107,33,168)] hover:shadow-[0_2px_0_rgb(107,33,168)] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all disabled:opacity-50 disabled:shadow-none disabled:translate-y-[4px] flex items-center justify-center gap-2"
                >
                    {t('actions.verify')}
                </Button>
            ) : (
                <Button
                    onClick={handleContinue}
                    className={cn(
                        "w-full h-14 sm:h-16 text-lg sm:text-xl font-bold rounded-2xl transition-all flex items-center justify-center gap-2",
                        feedback === 'success'
                            ? "bg-green-500 hover:bg-green-600 text-white shadow-[0_4px_0_rgb(34,197,94)] hover:shadow-[0_2px_0_rgb(34,197,94)] active:shadow-none active:translate-y-[4px]"
                            : "bg-orange-500 hover:bg-orange-600 text-white shadow-[0_4px_0_rgb(249,115,22)] hover:shadow-[0_2px_0_rgb(249,115,22)] active:shadow-none active:translate-y-[4px]",
                        "hover:-translate-y-[2px]"
                    )}
                >
                    {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                    <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
                </Button>
            )}
        </div>
    );
};
