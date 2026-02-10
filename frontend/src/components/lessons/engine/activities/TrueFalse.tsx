import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Check, X, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

interface TrueFalseProps {
    exercise: any;
    onSubmit: (isTrue: boolean) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const TrueFalse = ({ exercise, onSubmit, onNext, onRetry }: TrueFalseProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [answered, setAnswered] = useState<boolean | null>(null); // true = Verdadero selected, false = Falso selected
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');

    useEffect(() => {
        setAnswered(null);
        setFeedback('none');
    }, [exercise]);

    const handleAnswer = (choice: boolean) => {
        if (answered !== null) return;
        playSound('ui_tap');
        setAnswered(choice);

        // Delegate validation to useLessonState via onSubmit (single source of truth)
        const isCorrect = onSubmit(choice);
        setFeedback(isCorrect ? 'success' : 'error');
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            setAnswered(null);
            setFeedback('none');
            onRetry();
        }
    };

    return (
        <div className="w-full max-w-lg animate-slide-in-bottom flex flex-col items-center">

            {/* Statement Card */}
            <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl border-2 border-slate-100 dark:border-slate-800 mb-10 w-full text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-400 to-purple-500" />
                <h3 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 leading-tight">
                    {exercise.content.statement}
                </h3>
            </div>

            {/* True / False Buttons */}
            <div className="grid grid-cols-2 gap-4 w-full mb-8">
                {/* TRUE BUTTON */}
                <button
                    onClick={() => handleAnswer(true)}
                    disabled={answered !== null}
                    className={cn(
                        "h-32 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all transform duration-200 border-b-4",
                        "bg-blue-500 hover:bg-blue-600 border-blue-700 text-white shadow-lg shadow-blue-500/30",
                        answered === true && "scale-95 border-b-0 translate-y-2 ring-4 ring-blue-300",
                        answered === false && "opacity-30 grayscale", // If picked False, dim this
                        feedback === 'success' && exercise.correct_answer?.isTrue === true && "bg-green-500 border-green-700 ring-4 ring-green-300 scale-105", // Pulse if correct answer
                        feedback === 'error' && answered === true && "bg-red-500 border-red-700 shake" // Shake if wrong pick
                    )}
                >
                    <Check className="w-10 h-10" />
                    <span className="text-2xl font-black uppercase tracking-wider">{t('common:true')}</span>
                </button>

                {/* FALSE BUTTON */}
                <button
                    onClick={() => handleAnswer(false)}
                    disabled={answered !== null}
                    className={cn(
                        "h-32 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all transform duration-200 border-b-4",
                        "bg-orange-500 hover:bg-orange-600 border-orange-700 text-white shadow-lg shadow-orange-500/30",
                        answered === false && "scale-95 border-b-0 translate-y-2 ring-4 ring-orange-300",
                        answered === true && "opacity-30 grayscale",
                        feedback === 'success' && exercise.correct_answer?.isTrue === false && "bg-green-500 border-green-700 ring-4 ring-green-300 scale-105",
                        feedback === 'error' && answered === false && "bg-red-500 border-red-700 shake"
                    )}
                >
                    <X className="w-10 h-10" />
                    <span className="text-2xl font-black uppercase tracking-wider">{t('common:false')}</span>
                </button>
            </div>

            {/* Continue Button */}
            {answered !== null && (
                <div className="w-full animate-in fade-in slide-in-from-bottom-4">
                    {/* Feedback Message */}
                    <div className="text-center mb-4 font-bold text-xl">
                        {feedback === 'success' ? (
                            <span className="text-green-500 flex items-center justify-center gap-2">
                                <Check className="w-6 h-6" /> {t('feedback.success')}
                            </span>
                        ) : (
                            <span className="text-red-500 flex items-center justify-center gap-2">
                                <X className="w-6 h-6" /> {t('feedback.error')}
                            </span>
                        )}
                    </div>

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
                </div>
            )}
        </div>
    );
};
