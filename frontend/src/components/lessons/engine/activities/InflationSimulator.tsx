import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

interface InflationSimulatorProps {
    exercise: any;
    onSubmit: (comparison: { yearStart: number; yearEnd: number }) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const InflationSimulator = ({ exercise, onSubmit, onNext, onRetry }: InflationSimulatorProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [yearStart, setYearStart] = useState(2000);
    const [yearEnd, setYearEnd] = useState(2024);
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');

    useEffect(() => {
        setYearStart(exercise.content.defaultYearStart || 2000);
        setYearEnd(exercise.content.defaultYearEnd || 2024);
        setFeedback('none');
    }, [exercise]);

    const product = exercise.content.product || {};
    const basePrice = product.basePrice || 100;
    const baseYear = product.baseYear || 2000;
    const inflationRate = exercise.content.inflationRate || 3;

    const calculatePrice = (year: number) => {
        const years = year - baseYear;
        return basePrice * Math.pow(1 + inflationRate / 100, years);
    };

    const priceStart = calculatePrice(yearStart);
    const priceEnd = calculatePrice(yearEnd);
    const percentageChange = priceStart === 0 ? 0 : ((priceEnd - priceStart) / priceStart) * 100;

    const handleSubmit = () => {
        const isCorrect = onSubmit({ yearStart, yearEnd });
        setFeedback(isCorrect ? 'success' : 'error');
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            setYearStart(exercise.content.defaultYearStart || 2000);
            setYearEnd(exercise.content.defaultYearEnd || 2024);
            setFeedback('none');
            onRetry();
        }
    };

    const minYear = exercise.content.minYear || 1990;
    const maxYear = exercise.content.maxYear || 2030;

    return (
        <div className="w-full max-w-3xl animate-slide-in-bottom">

            {/* Product Display */}
            <div className="mb-6 text-center">
                <div className="inline-flex flex-col items-center bg-purple-500 border-2 border-purple-600 text-white rounded-2xl px-6 py-4 shadow-sm">
                    <div className="text-4xl mb-2">{product.icon || '🛒'}</div>
                    <div className="text-lg font-bold">{product.name}</div>
                    <div className="text-xs opacity-80">
                        {t('inflation.base_price')}: ${basePrice} ({baseYear})
                    </div>
                </div>
            </div>

            {/* Year Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="bg-card border-2 border-border shadow-sm rounded-2xl p-4">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-3">
                        {t('inflation.start_year')}
                    </label>
                    <input
                        type="range"
                        min={minYear}
                        max={maxYear}
                        value={yearStart}
                        onChange={(e) => {
                            const val = Number(e.target.value);
                            setYearStart(val);
                            if (val > yearEnd) setYearEnd(val);
                            playSound('ui_tap');
                        }}
                        disabled={feedback !== 'none'}
                        className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600 mb-2"
                        aria-label={t('inflation.start_year')}
                        aria-valuemin={minYear}
                        aria-valuemax={maxYear}
                        aria-valuenow={yearStart}
                    />
                    <div className="text-center text-2xl font-black text-blue-600 dark:text-blue-400">
                        {yearStart}
                    </div>
                </div>

                <div className="bg-card border-2 border-border shadow-sm rounded-2xl p-4">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block mb-3">
                        {t('inflation.end_year')}
                    </label>
                    <input
                        type="range"
                        min={minYear}
                        max={maxYear}
                        value={yearEnd}
                        onChange={(e) => {
                            const val = Number(e.target.value);
                            setYearEnd(val);
                            if (val < yearStart) setYearStart(val);
                            playSound('ui_tap');
                        }}
                        disabled={feedback !== 'none'}
                        className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-600 mb-2"
                        aria-label={t('inflation.end_year')}
                        aria-valuemin={minYear}
                        aria-valuemax={maxYear}
                        aria-valuenow={yearEnd}
                    />
                    <div className="text-center text-2xl font-black text-purple-600 dark:text-purple-400">
                        {yearEnd}
                    </div>
                </div>
            </div>

            {/* Comparison */}
            <div className="mb-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-100 dark:bg-blue-950/30 border-2 border-blue-400 dark:border-blue-700 rounded-xl p-4 text-center">
                        <div className="text-xs font-bold text-blue-800 dark:text-blue-200 mb-2">
                            {yearStart}
                        </div>
                        <div className="text-3xl mb-2">{product.icon || '🛒'}</div>
                        <div className="text-2xl font-black text-blue-900 dark:text-blue-100">
                            ${priceStart.toFixed(2)}
                        </div>
                    </div>

                    <div className="bg-purple-100 dark:bg-purple-950/30 border-2 border-purple-400 dark:border-purple-700 rounded-xl p-4 text-center">
                        <div className="text-xs font-bold text-purple-800 dark:text-purple-200 mb-2">
                            {yearEnd}
                        </div>
                        <div className="text-3xl mb-2">{product.icon || '🛒'}</div>
                        <div className="text-2xl font-black text-purple-900 dark:text-purple-100">
                            ${priceEnd.toFixed(2)}
                        </div>
                    </div>
                </div>

                <div className="mt-4 bg-violet-50 dark:bg-violet-950/30 border-2 border-violet-500 dark:border-violet-700 rounded-xl p-4 text-center shadow-sm">
                    <div className="flex items-center justify-center gap-2 mb-1">
                        <TrendingUp className="w-5 h-5 text-violet-700 dark:text-violet-300" />
                        <span className="text-sm font-bold text-violet-800 dark:text-violet-200">
                            {t('inflation.price_increase')}
                        </span>
                    </div>
                    <div className="text-3xl font-black text-violet-900 dark:text-violet-100">
                        +{percentageChange.toFixed(1)}%
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center">
                {feedback === 'none' ? (
                    <Button
                        onClick={handleSubmit}
                        className="w-full max-w-md h-14 sm:h-16 text-lg sm:text-xl font-bold bg-purple-500 hover:bg-purple-600 text-white rounded-2xl shadow-[0_4px_0_rgb(107,33,168)] hover:shadow-[0_2px_0_rgb(107,33,168)] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all flex items-center justify-center gap-2"
                    >
                        {t('inflation.compare')}
                    </Button>
                ) : (
                    <div className="flex flex-col items-center w-full">
                        <p className={cn("font-bold text-lg mb-3", feedback === 'success' ? "text-green-500" : "text-red-500")}>
                            {feedback === 'success' ? t('inflation.compared') : t('feedback.error')}
                        </p>
                        <Button
                            onClick={handleContinue}
                            className="w-full max-w-md h-14 sm:h-16 text-lg sm:text-xl font-bold bg-green-500 hover:bg-green-600 text-white rounded-2xl shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all flex items-center justify-center gap-2"
                        >
                            {t('actions.continue')}
                            <ArrowRight className="ml-2 w-5 h-5 sm:w-6 sm:h-6" />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};
