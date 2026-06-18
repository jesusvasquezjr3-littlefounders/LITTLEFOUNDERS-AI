import { useState, useEffect } from 'react';
import { ArrowRight, RotateCcw, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';
import { pickText } from './fieldText';

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
                <div className="inline-flex flex-col items-center lp-card px-8 py-5">
                    <div className="text-6xl sm:text-7xl mb-2 lp-bob">{product.icon || '🛒'}</div>
                    <div className="lp-display text-xl sm:text-2xl" style={{ color: 'var(--lp-ink)' }}>{pickText(product, ['name', 'label', 'text', 'title'])}</div>
                    <div className="text-sm font-semibold" style={{ color: 'var(--lp-muted)' }}>
                        {t('inflation.base_price')}: ${basePrice} ({baseYear})
                    </div>
                </div>
            </div>

            {/* Year Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="lp-card p-4">
                    <label className="lp-display text-sm block mb-3" style={{ color: 'var(--lp-muted)' }}>
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
                        className="w-full h-3 rounded-lg appearance-none cursor-pointer mb-2"
                        style={{ accentColor: 'var(--lp-indigo)', background: 'var(--lp-indigo-soft)' }}
                        aria-label={t('inflation.start_year')}
                        aria-valuemin={minYear}
                        aria-valuemax={maxYear}
                        aria-valuenow={yearStart}
                    />
                    <div className="text-center lp-display text-3xl" style={{ color: 'var(--lp-indigo-ink)' }}>
                        {yearStart}
                    </div>
                </div>

                <div className="lp-card p-4">
                    <label className="lp-display text-sm block mb-3" style={{ color: 'var(--lp-muted)' }}>
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
                        className="w-full h-3 rounded-lg appearance-none cursor-pointer mb-2"
                        style={{ accentColor: 'var(--lp-amber)', background: 'var(--lp-amber-soft)' }}
                        aria-label={t('inflation.end_year')}
                        aria-valuemin={minYear}
                        aria-valuemax={maxYear}
                        aria-valuenow={yearEnd}
                    />
                    <div className="text-center lp-display text-3xl" style={{ color: 'var(--lp-amber-ink)' }}>
                        {yearEnd}
                    </div>
                </div>
            </div>

            {/* Comparison */}
            <div className="mb-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-2xl border-2 p-4 text-center" style={{ background: 'var(--lp-indigo-soft)', borderColor: 'var(--lp-indigo)' }}>
                        <div className="lp-display text-sm mb-2" style={{ color: 'var(--lp-indigo-ink)' }}>
                            {yearStart}
                        </div>
                        <div className="text-4xl sm:text-5xl mb-2">{product.icon || '🛒'}</div>
                        <div className="lp-display text-2xl sm:text-3xl" style={{ color: 'var(--lp-indigo-ink)' }}>
                            ${priceStart.toFixed(2)}
                        </div>
                    </div>

                    <div className="rounded-2xl border-2 p-4 text-center" style={{ background: 'var(--lp-amber-soft)', borderColor: 'var(--lp-amber)' }}>
                        <div className="lp-display text-sm mb-2" style={{ color: 'var(--lp-amber-ink)' }}>
                            {yearEnd}
                        </div>
                        <div className="text-4xl sm:text-5xl mb-2">{product.icon || '🛒'}</div>
                        <div className="lp-display text-2xl sm:text-3xl" style={{ color: 'var(--lp-amber-ink)' }}>
                            ${priceEnd.toFixed(2)}
                        </div>
                    </div>
                </div>

                <div className="mt-4 rounded-2xl border-2 p-4 text-center" style={{ background: 'var(--lp-emerald-soft)', borderColor: 'var(--lp-emerald)' }}>
                    <div className="flex items-center justify-center gap-2 mb-1">
                        <TrendingUp className="w-5 h-5" style={{ color: 'var(--lp-emerald-ink)' }} />
                        <span className="lp-display text-sm" style={{ color: 'var(--lp-emerald-ink)' }}>
                            {t('inflation.price_increase')}
                        </span>
                    </div>
                    <div className="lp-display text-3xl sm:text-4xl" style={{ color: 'var(--lp-emerald-ink)' }}>
                        +{percentageChange.toFixed(1)}%
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center">
                {feedback === 'none' ? (
                    <QuestButton variant="gold" onClick={handleSubmit}>
                        {t('inflation.compare')}
                    </QuestButton>
                ) : (
                    <div className="flex flex-col items-center w-full">
                        <p
                            className="lp-display text-lg mb-3"
                            style={{ color: feedback === 'success' ? 'var(--lp-emerald-ink)' : 'var(--lp-coral-ink)' }}
                        >
                            {feedback === 'success' ? t('inflation.compared') : t('feedback.error')}
                        </p>
                        <QuestButton variant={feedback === 'success' ? 'go' : 'retry'} onClick={handleContinue}>
                            {t('actions.continue')}
                            {feedback === 'success' ? <ArrowRight className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
                        </QuestButton>
                    </div>
                )}
            </div>
        </div>
    );
};
