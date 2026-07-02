import { useState, useEffect } from 'react';
import { ArrowRight, DollarSign } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';

interface InterestCalculatorProps {
    exercise: any;
    onSubmit: (values: { principal: number; rate: number; time: number }) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const InterestCalculator = ({ exercise, onSubmit, onNext, onRetry }: InterestCalculatorProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [principal, setPrincipal] = useState(1000);
    const [rate, setRate] = useState(5);
    const [time, setTime] = useState(1);
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');

    const content = exercise?.content || {};
    const params = content.parameters || {};

    useEffect(() => {
        const c = exercise?.content || {};
        const p = c.parameters || {};
        setPrincipal(c.defaultPrincipal || p.principal || 1000);
        setRate(c.defaultRate || p.annualRate || 5);
        setTime(c.defaultTime || 1);
        setFeedback('none');
    }, [exercise]);

    const calculateInterest = () => {
        const isCompound = exercise.content.type === 'compound';
        if (isCompound) {
            return principal * Math.pow(1 + rate / 100, time) - principal;
        } else {
            return (principal * rate * time) / 100;
        }
    };

    const totalAmount = principal + calculateInterest();
    const interest = calculateInterest();

    const handleSubmit = () => {
        const isCorrect = onSubmit({ principal, rate, time });
        setFeedback(isCorrect ? 'success' : 'error');
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            setPrincipal(content.defaultPrincipal || params.principal || 1000);
            setRate(content.defaultRate || params.annualRate || 5);
            setTime(content.defaultTime || 1);
            setFeedback('none');
            onRetry();
        }
    };

    const maxPrincipal = content.maxPrincipal || 10000;
    const maxRate = content.maxRate ?? (params.annualRate ? params.annualRate * 2 : 20);
    const maxTime = content.maxTime || 30;

    return (
        <div className="w-full max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Title */}
            <div className="mb-6 text-center">
                <h2 className="lp-display text-2xl sm:text-3xl mb-2" style={{ color: 'var(--lp-ink)' }}>
                    {exercise.content.type === 'compound'
                        ? t('interest_calculator.compound_title')
                        : t('interest_calculator.simple_title')
                    }
                </h2>
            </div>

            {/* Sliders */}
            <div className="space-y-6 mb-8">
                {/* Principal */}
                <div className="bg-white rounded-[2.5rem] shadow-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                        <label className="lp-display text-sm" style={{ color: 'var(--lp-muted)' }}>
                            {t('interest_calculator.principal')}
                        </label>
                        <span className="lp-display text-lg" style={{ color: 'var(--lp-emerald-ink)' }}>
                            ${principal.toLocaleString()}
                        </span>
                    </div>
                    <input
                        type="range"
                        min="100"
                        max={maxPrincipal}
                        step="100"
                        value={principal}
                        onChange={(e) => {
                            setPrincipal(Number(e.target.value));
                            playSound('ui_tap');
                        }}
                        aria-label={t('interest_calculator.principal')}
                        aria-valuemin={100}
                        aria-valuemax={maxPrincipal}
                        aria-valuenow={principal}
                        style={{ accentColor: 'var(--lp-emerald)', background: 'color-mix(in srgb, var(--lp-ink) 12%, transparent)' }}
                        className="w-full h-3 rounded-lg appearance-none cursor-pointer"
                    />
                </div>

                {/* Interest Rate */}
                <div className="bg-white rounded-[2.5rem] shadow-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                        <label className="lp-display text-sm" style={{ color: 'var(--lp-muted)' }}>
                            {t('interest_calculator.rate')}
                        </label>
                        <span className="lp-display text-lg" style={{ color: 'var(--lp-indigo-ink)' }}>
                            {rate}%
                        </span>
                    </div>
                    <input
                        type="range"
                        min="0.1"
                        max={maxRate}
                        step="0.1"
                        value={rate}
                        onChange={(e) => {
                            setRate(Number(e.target.value));
                            playSound('ui_tap');
                        }}
                        aria-label={t('interest_calculator.rate')}
                        aria-valuemin={0}
                        aria-valuemax={maxRate}
                        aria-valuenow={rate}
                        style={{ accentColor: 'var(--lp-indigo)', background: 'color-mix(in srgb, var(--lp-ink) 12%, transparent)' }}
                        className="w-full h-3 rounded-lg appearance-none cursor-pointer"
                    />
                </div>

                {/* Time */}
                <div className="bg-white rounded-[2.5rem] shadow-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                        <label className="lp-display text-sm" style={{ color: 'var(--lp-muted)' }}>
                            {t('interest_calculator.time')}
                        </label>
                        <span className="lp-display text-lg" style={{ color: 'var(--lp-amber-ink)' }}>
                            {time} {t('interest_calculator.years')}
                        </span>
                    </div>
                    <input
                        type="range"
                        min="1"
                        max={maxTime}
                        step="1"
                        value={time}
                        onChange={(e) => {
                            setTime(Number(e.target.value));
                            playSound('ui_tap');
                        }}
                        aria-label={t('interest_calculator.time')}
                        aria-valuemin={1}
                        aria-valuemax={maxTime}
                        aria-valuenow={time}
                        style={{ accentColor: 'var(--lp-amber)', background: 'color-mix(in srgb, var(--lp-ink) 12%, transparent)' }}
                        className="w-full h-3 rounded-lg appearance-none cursor-pointer"
                    />
                </div>
            </div>

            {/* Results */}
            <div className="mb-8">
                <div
                    className="rounded-[var(--lp-radius)] p-6 text-white"
                    style={{
                        background: 'var(--lp-emerald)',
                        boxShadow: '0 6px 0 var(--lp-emerald-lip), var(--lp-shadow)',
                    }}
                >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                        <div>
                            <div className="text-xs opacity-80 mb-1">{t('interest_calculator.initial')}</div>
                            <div className="lp-display text-2xl">${principal.toLocaleString()}</div>
                        </div>
                        <div>
                            <div className="text-xs opacity-80 mb-1">{t('interest_calculator.interest_earned')}</div>
                            <div className="lp-display text-2xl">${interest.toFixed(2)}</div>
                        </div>
                        <div>
                            <div className="text-xs opacity-80 mb-1">{t('interest_calculator.total')}</div>
                            <div className="lp-display text-3xl">${totalAmount.toFixed(2)}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Visual Chart - Comparative Line Chart */}
            <div className="mb-8">
                <div className="bg-white rounded-[2.5rem] shadow-sm p-6">
                    {/* Legend */}
                    <div className="flex justify-center gap-6 mb-4">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-1 rounded" style={{ background: 'var(--lp-indigo)' }}></div>
                            <span className="lp-display text-xs" style={{ color: 'var(--lp-muted)' }}>
                                {t('interest_calculator.simple_interest')}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-1 rounded" style={{ background: 'var(--lp-emerald)' }}></div>
                            <span className="lp-display text-xs" style={{ color: 'var(--lp-muted)' }}>
                                {t('interest_calculator.compound_interest')}
                            </span>
                        </div>
                    </div>

                    {/* Chart */}
                    <div className="relative h-48">
                        <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
                            {/* Grid lines */}
                            {[0, 1, 2, 3, 4].map((i) => (
                                <line
                                    key={`grid-${i}`}
                                    x1="0"
                                    y1={i * 50}
                                    x2="400"
                                    y2={i * 50}
                                    stroke="var(--lp-ink)"
                                    strokeWidth="0.5"
                                    opacity="0.15"
                                />
                            ))}

                            {/* Simple Interest Line */}
                            <polyline
                                points={[...Array(time + 1)].map((_, i) => {
                                    const year = i;
                                    const amount = principal + (principal * rate * year) / 100;
                                    const maxAmount = Math.max(
                                        principal + (principal * rate * time) / 100,
                                        principal * Math.pow(1 + rate / 100, time)
                                    );
                                    const x = (year / time) * 400;
                                    const y = 200 - ((amount / maxAmount) * 180);
                                    return `${x},${y}`;
                                }).join(' ')}
                                fill="none"
                                stroke="var(--lp-indigo)"
                                strokeWidth={exercise.content.type === 'simple' ? "3" : "2"}
                                className={exercise.content.type === 'simple' ? "opacity-100" : "opacity-50"}
                            />

                            {/* Compound Interest Line */}
                            <polyline
                                points={[...Array(time + 1)].map((_, i) => {
                                    const year = i;
                                    const amount = principal * Math.pow(1 + rate / 100, year);
                                    const maxAmount = Math.max(
                                        principal + (principal * rate * time) / 100,
                                        principal * Math.pow(1 + rate / 100, time)
                                    );
                                    const x = (year / time) * 400;
                                    const y = 200 - ((amount / maxAmount) * 180);
                                    return `${x},${y}`;
                                }).join(' ')}
                                fill="none"
                                stroke="var(--lp-emerald)"
                                strokeWidth={exercise.content.type === 'compound' ? "3" : "2"}
                                className={exercise.content.type === 'compound' ? "opacity-100" : "opacity-50"}
                            />
                        </svg>

                        {/* Y-axis labels */}
                        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs -ml-12" style={{ color: 'var(--lp-muted)' }}>
                            <span>${totalAmount.toFixed(0)}</span>
                            <span>${(totalAmount * 0.5).toFixed(0)}</span>
                            <span>${principal}</span>
                        </div>

                        {/* X-axis labels */}
                        <div className="absolute bottom-0 left-0 w-full flex justify-between text-xs -mb-6" style={{ color: 'var(--lp-muted)' }}>
                            <span>0</span>
                            <span>{Math.floor(time / 2)}</span>
                            <span>{time}</span>
                        </div>
                    </div>

                    {/* Axis labels */}
                    <div className="flex justify-between items-center mt-8">
                        <span className="lp-display text-xs" style={{ color: 'var(--lp-muted)' }}>{t('interest_calculator.years')}</span>
                        <span className="lp-display text-xs -rotate-90 origin-center" style={{ color: 'var(--lp-muted)' }}>{t('interest_calculator.amount')}</span>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center">
                {feedback === 'none' ? (
                    <div className="w-full max-w-md">
                        <QuestButton variant="gold" onClick={handleSubmit}>
                            <DollarSign className="w-5 h-5 sm:w-6 sm:h-6" />
                            {t('interest_calculator.calculate')}
                        </QuestButton>
                    </div>
                ) : (
                    <div className="flex flex-col items-center w-full">
                        <p
                            className="lp-display text-lg mb-3"
                            style={{ color: feedback === 'success' ? 'var(--lp-emerald-ink)' : 'var(--lp-coral-ink)' }}
                        >
                            {feedback === 'success' ? t('interest_calculator.calculated') : t('feedback.error')}
                        </p>
                        <div className="w-full max-w-md">
                            <QuestButton variant={feedback === 'success' ? 'go' : 'retry'} onClick={handleContinue}>
                                {t('actions.continue')}
                                <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
                            </QuestButton>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
