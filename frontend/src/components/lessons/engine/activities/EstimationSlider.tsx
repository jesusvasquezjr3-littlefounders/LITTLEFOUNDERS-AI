import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

interface EstimationSliderProps {
    exercise: any;
    onSubmit: (value: number) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const EstimationSlider = ({ exercise, onSubmit, onNext, onRetry }: EstimationSliderProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const content = exercise?.content || {};
    const min = content.min ?? content.range?.min ?? 0;
    const max = content.max ?? content.range?.max ?? 100;
    const step = content.step ?? content.range?.step ?? 1;
    const unit = content.unit || '';

    // Initial value: middle
    const [value, setValue] = useState<number[]>([Math.floor((max - min) / 2) + min]);
    const [feedback, setFeedback] = useState<'none' | 'success' | 'close' | 'error'>('none');
    const [difference, setDifference] = useState<number>(0);

    useEffect(() => {
        setValue([Math.floor((max - min) / 2) + min]);
        setFeedback('none');
        setDifference(0);
    }, [exercise]);

    const handleValueChange = (val: number[]) => {
        if (feedback !== 'none') return;
        setValue(val);
        // Could play a subtle tick sound here
    };

    const handleCheck = () => {
        const correctVal = exercise.correct_answer?.correctValue ?? exercise.correct_answer?.value ?? exercise.correct_answer?.numericAnswer ?? content.correctValue ?? content.value ?? 0;
        const tolerance = exercise.correct_answer?.tolerance ?? exercise.content?.tolerance ?? 10;
        const userVal = value[0];
        const diff = userVal - correctVal;

        setDifference(diff);

        // Delegate validation to useLessonState via onSubmit (single source of truth)
        const isCorrect = onSubmit(userVal);

        // Show 'close' hint if within 2x tolerance but not within tolerance
        let result: 'success' | 'close' | 'error' = 'error';
        if (isCorrect) {
            result = 'success';
        } else if (Math.abs(diff) <= (tolerance * 2)) {
            result = 'close';
        }

        setFeedback(result);
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            // Retry? Maybe just allow re-adjusting?
            setFeedback('none');
            onRetry();
        }
    };

    return (
        <div className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col items-center">

            {/* Question Card */}
            <div className="liquid-glass-strong p-8 rounded-3xl shadow-xl border border-white/20 dark:border-white/10 mb-10 w-full text-center">
                <h3 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4">
                    {content.problem || content.question || t('instructions.estimation_slider', { defaultValue: 'Estima el valor' })}
                </h3>
                <div className="text-5xl font-black text-purple-600 dark:text-purple-400">
                    {value[0]}<span className="text-2xl ml-1 text-slate-400 font-medium">{unit}</span>
                </div>
            </div>

            {/* Slider Container */}
            <div className="w-full px-6 mb-12">
                <Slider
                    value={value}
                    onValueChange={handleValueChange}
                    max={max}
                    min={min}
                    step={step}
                    disabled={feedback !== 'none'}
                    className="py-4 cursor-pointer"
                />
                <div className="flex justify-between text-muted-foreground font-bold mt-2">
                    <span>{min}{unit}</span>
                    <span>{max}{unit}</span>
                </div>
            </div>

            {/* Feedback Display */}
            {feedback !== 'none' && (
                <div className="mb-8 text-center animate-in zoom-in">
                    {feedback === 'success' ? (
                        <div className="text-green-500 font-bold text-xl flex items-center gap-2 justify-center">
                            🎉 {t('feedback.exact')}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-1">
                            <span className="text-3xl mb-1">{difference > 0 ? "👇" : "👆"}</span>
                            <span className="font-bold text-lg text-slate-600 dark:text-slate-300">
                                {difference > 0 ? t('feedback.lower') : t('feedback.higher')}
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Actions */}
            {feedback === 'none' ? (
                <Button
                    onClick={handleCheck}
                    className="relative overflow-hidden w-full h-14 text-lg font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-2xl shadow-[0_4px_0_rgb(107,33,168)] hover:shadow-[0_2px_0_rgb(107,33,168)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all"
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
