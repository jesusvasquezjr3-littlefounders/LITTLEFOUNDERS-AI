import { useState, useEffect } from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';

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
    // When the lesson defines labeled ranges/zones, span the slider across their extent
    // so the user can land inside the correct band (validateAnswer grades the band).
    const ranges = Array.isArray(content.ranges) ? content.ranges : null;
    const rangeMin = ranges ? Math.min(...ranges.map((r: any) => Number(r.minValue ?? r.min ?? 0))) : undefined;
    const rangeMax = ranges ? Math.max(...ranges.map((r: any) => Number(r.maxValue ?? r.max ?? 100))) : undefined;
    const min = content.min ?? content.range?.min ?? content.sliderMin ?? rangeMin ?? 0;
    const max = content.max ?? content.range?.max ?? content.sliderMax ?? rangeMax ?? 100;
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
            <div className="bg-white rounded-[2.5rem] shadow-sm p-6 sm:p-8 mb-10 w-full text-center">
                <h3 className="lp-display text-xl sm:text-2xl mb-4" style={{ color: 'var(--lp-ink)' }}>
                    {content.problem || content.question || t('instructions.estimation_slider', { defaultValue: 'Estima el valor' })}
                </h3>
                <div className="lp-display text-5xl sm:text-6xl" style={{ color: 'var(--lp-amber-ink)' }}>
                    {value[0]}<span className="lp-display text-2xl ml-1 font-medium" style={{ color: 'var(--lp-muted)' }}>{unit}</span>
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
                <div className="lp-display flex justify-between mt-2" style={{ color: 'var(--lp-muted)' }}>
                    <span>{min}{unit}</span>
                    <span>{max}{unit}</span>
                </div>
            </div>

            {/* Feedback Display */}
            {feedback !== 'none' && (
                <div className="mb-8 text-center animate-in zoom-in">
                    {feedback === 'success' ? (
                        <div className="lp-display text-xl flex items-center gap-2 justify-center" style={{ color: 'var(--lp-emerald)' }}>
                            🎉 {t('feedback.exact')}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-1">
                            <span className="text-3xl mb-1">{difference > 0 ? "👇" : "👆"}</span>
                            <span className="lp-display text-lg" style={{ color: 'var(--lp-ink)' }}>
                                {difference > 0 ? t('feedback.lower') : t('feedback.higher')}
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Actions */}
            {feedback === 'none' ? (
                <QuestButton variant="gold" onClick={handleCheck}>
                    {t('actions.verify')}
                </QuestButton>
            ) : (
                <QuestButton variant={feedback === 'success' ? 'go' : 'retry'} onClick={handleContinue}>
                    {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                    {feedback === 'success' ? <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" /> : <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />}
                </QuestButton>
            )}
        </div>
    );
};
