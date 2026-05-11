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
            <div className="bg-card p-6 sm:p-8 rounded-3xl border-2 border-border mb-10 w-full text-center shadow-sm">
                <h3 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
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
                        "h-32 rounded-[2rem] flex flex-col items-center justify-center gap-2 transition-all transform duration-200 border-2 border-transparent",
                        "bg-blue-500 hover:bg-blue-400 text-white shadow-[0_8px_0_rgb(29,78,216)] hover:shadow-[0_4px_0_rgb(29,78,216)] hover:-translate-y-[2px] active:shadow-none active:translate-y-[8px]",
                        answered === true && "scale-95 shadow-none translate-y-[8px] ring-4 ring-blue-300",
                        answered === false && "opacity-30 grayscale",
                        feedback === 'success' && exercise.correct_answer?.isTrue === true && "bg-green-500 shadow-none ring-4 ring-green-300 scale-105",
                        feedback === 'error' && answered === true && "bg-red-500 shadow-none ring-4 ring-red-300 shake"
                    )}
                >
                    <Check className="w-10 h-10 relative" />
                    <span className="text-2xl font-black uppercase tracking-wider relative">{t('common:true')}</span>
                </button>

                {/* FALSE BUTTON */}
                <button
                    onClick={() => handleAnswer(false)}
                    disabled={answered !== null}
                    className={cn(
                        "h-32 rounded-[2rem] flex flex-col items-center justify-center gap-2 transition-all transform duration-200 border-2 border-transparent",
                        "bg-orange-500 hover:bg-orange-400 text-white shadow-[0_8px_0_rgb(194,65,12)] hover:shadow-[0_4px_0_rgb(194,65,12)] hover:-translate-y-[2px] active:shadow-none active:translate-y-[8px]",
                        answered === false && "scale-95 shadow-none translate-y-[8px] ring-4 ring-orange-300",
                        answered === true && "opacity-30 grayscale",
                        feedback === 'success' && exercise.correct_answer?.isTrue === false && "bg-green-500 shadow-none ring-4 ring-green-300 scale-105",
                        feedback === 'error' && answered === false && "bg-red-500 shadow-none ring-4 ring-red-300 shake"
                    )}
                >
                    <X className="w-10 h-10 relative" />
                    <span className="text-2xl font-black uppercase tracking-wider relative">{t('common:false')}</span>
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
                            "w-full h-14 sm:h-16 text-lg sm:text-xl font-bold rounded-2xl transition-all",
                            feedback === 'success'
                                ? "bg-green-500 hover:bg-green-600 text-white shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)] active:shadow-none active:translate-y-[4px]"
                                : "bg-orange-500 hover:bg-orange-600 text-white shadow-[0_4px_0_rgb(194,65,12)] hover:shadow-[0_2px_0_rgb(194,65,12)] active:shadow-none active:translate-y-[4px]",
                            "hover:-translate-y-[2px]"
                        )}
                    >
                        <span className="relative flex items-center justify-center">
                            {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                            <ArrowRight className="ml-2 w-6 h-6" />
                        </span>
                    </Button>
                </div>
            )}
        </div>
    );
};
