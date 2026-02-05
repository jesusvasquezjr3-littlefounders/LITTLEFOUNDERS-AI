import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

interface EstimationSliderProps {
    exercise: any;
    onSubmit: (value: number) => void;
    onNext: () => void;
    onRetry: () => void;
}

export const EstimationSlider = ({ exercise, onSubmit, onNext, onRetry }: EstimationSliderProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const min = exercise.content.min || 0;
    const max = exercise.content.max || 100;
    const step = exercise.content.step || 1;
    const unit = exercise.content.unit || '';

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
        const correctVal = exercise.correct_answer?.correctValue || 0;
        const tolerance = exercise.correct_answer?.tolerance || 0; // Absolute tolerance

        const userVal = value[0];
        const diff = userVal - correctVal;

        setDifference(diff);

        let result: 'success' | 'close' | 'error' = 'error';
        if (Math.abs(diff) <= tolerance) {
            result = 'success';
        } else if (Math.abs(diff) <= (tolerance * 2)) { // Example logic for "close"
            result = 'close';
        }

        setFeedback(result);
        onSubmit(userVal);

        if (result === 'success') playSound('edu_success');
        else playSound('edu_error'); // Or 'edu_warning' for close?
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
        <div className="w-full max-w-lg animate-slide-in-bottom flex flex-col items-center">

            {/* Question Card */}
            <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-lg border-2 border-slate-100 dark:border-slate-800 mb-10 w-full text-center">
                <h3 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 mb-4">
                    {exercise.content.question || "¿Cuánto estimas?"}
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
                    className="w-full h-14 text-lg font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-2xl shadow-[0_4px_0_rgb(107,33,168)] hover:shadow-[0_2px_0_rgb(107,33,168)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all"
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
