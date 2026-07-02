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
        <div className="w-full max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Title */}
            <div className="mb-4 text-center">
                <h2 className="lp-display text-xl sm:text-2xl mb-1" style={{ color: 'var(--lp-ink)' }}>
                    {exercise.content.type === 'compound'
                        ? t('interest_calculator.compound_title', { defaultValue: 'Calculadora de Interés Compuesto' })
                        : t('interest_calculator.simple_title', { defaultValue: 'Calculadora de Interés Simple' })
                    }
                </h2>
            </div>

            {/* Sliders Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                {/* Principal */}
                <div className="bg-white rounded-[1.5rem] shadow-sm p-4">
                    <div className="flex items-center justify-between mb-2">
                        <label className="lp-display text-xs sm:text-sm" style={{ color: 'var(--lp-muted)' }}>
                            {t('interest_calculator.principal', { defaultValue: 'Capital Inicial' })}
                        </label>
                        <span className="lp-display text-base sm:text-lg" style={{ color: 'var(--lp-emerald-ink)' }}>
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
                        aria-label={t('interest_calculator.principal', { defaultValue: 'Capital Inicial' })}
                        className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                        style={{ accentColor: 'var(--lp-emerald)', background: 'color-mix(in srgb, var(--lp-ink) 12%, transparent)' }}
                    />
                </div>

                {/* Interest Rate */}
                <div className="bg-white rounded-[1.5rem] shadow-sm p-4">
                    <div className="flex items-center justify-between mb-2">
                        <label className="lp-display text-xs sm:text-sm" style={{ color: 'var(--lp-muted)' }}>
                            {t('interest_calculator.rate', { defaultValue: 'Tasa de Interés' })}
                        </label>
                        <span className="lp-display text-base sm:text-lg" style={{ color: 'var(--lp-indigo-ink)' }}>
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
                        aria-label={t('interest_calculator.rate', { defaultValue: 'Tasa de Interés' })}
                        className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                        style={{ accentColor: 'var(--lp-indigo)', background: 'color-mix(in srgb, var(--lp-ink) 12%, transparent)' }}
                    />
                </div>

                {/* Time */}
                <div className="bg-white rounded-[1.5rem] shadow-sm p-4">
                    <div className="flex items-center justify-between mb-2">
                        <label className="lp-display text-xs sm:text-sm" style={{ color: 'var(--lp-muted)' }}>
                            {t('interest_calculator.time', { defaultValue: 'Tiempo' })}
                        </label>
                        <span className="lp-display text-base sm:text-lg" style={{ color: 'var(--lp-amber-ink)' }}>
                            {time} {t('interest_calculator.years', { defaultValue: 'años' })}
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
                        aria-label={t('interest_calculator.time', { defaultValue: 'Tiempo' })}
                        className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                        style={{ accentColor: 'var(--lp-amber)', background: 'color-mix(in srgb, var(--lp-ink) 12%, transparent)' }}
                    />
                </div>
            </div>

            {/* Results Box */}
            <div className="mb-4">
                <div
                    className="rounded-[1.5rem] p-4 text-white"
                    style={{
                        background: 'var(--lp-emerald)',
                        boxShadow: '0 4px 0 var(--lp-emerald-lip), var(--lp-shadow)',
                    }}
                >
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                            <div className="text-[10px] sm:text-xs opacity-90 mb-1">{t('interest_calculator.initial', { defaultValue: 'Inicial' })}</div>
                            <div className="lp-display text-lg sm:text-xl">${principal.toLocaleString()}</div>
                        </div>
                        <div>
                            <div className="text-[10px] sm:text-xs opacity-90 mb-1">{t('interest_calculator.interest_earned', { defaultValue: 'Interés Ganado' })}</div>
                            <div className="lp-display text-lg sm:text-xl">${interest.toFixed(2)}</div>
                        </div>
                        <div>
                            <div className="text-[10px] sm:text-xs opacity-90 mb-1">{t('interest_calculator.total', { defaultValue: 'Total' })}</div>
                            <div className="lp-display text-xl sm:text-2xl">${totalAmount.toFixed(2)}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Visual Chart */}
            <div className="mb-6">
                <div className="bg-white rounded-[2rem] shadow-sm p-5 relative">
                    
                    {/* Chart Header: Y-Axis Label (Left) + Legend (Right) */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-2 border-b border-slate-100 dark:border-white/5">
                        <span className="lp-display text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--lp-muted)' }}>
                            {t('interest_calculator.amount', { defaultValue: 'Monto ($)' })}
                        </span>
                        <div className="flex items-center gap-4 text-xs">
                            <div className="flex items-center gap-1.5">
                                <div className="w-3.5 h-1.5 rounded-full" style={{ background: 'var(--lp-indigo)' }}></div>
                                <span className="font-semibold text-slate-600 dark:text-slate-300">
                                    {t('interest_calculator.simple_interest', { defaultValue: 'Interés Simple' })}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3.5 h-1.5 rounded-full" style={{ background: 'var(--lp-emerald)' }}></div>
                                <span className="font-semibold text-slate-600 dark:text-slate-300">
                                    {t('interest_calculator.compound_interest', { defaultValue: 'Interés Compuesto' })}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Chart area */}
                    <div className="relative h-36 sm:h-44 ml-10 mr-2 mt-3 mb-8">
                        <svg className="w-full h-full overflow-visible" viewBox="0 0 400 200" preserveAspectRatio="none">
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
                                    opacity="0.1"
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
                                className={exercise.content.type === 'simple' ? "opacity-100" : "opacity-40"}
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
                                className={exercise.content.type === 'compound' ? "opacity-100" : "opacity-40"}
                            />
                        </svg>

                        {/* Y-axis values */}
                        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-[11px] font-semibold -ml-10" style={{ color: 'var(--lp-muted)' }}>
                            <span>${totalAmount.toFixed(0)}</span>
                            <span>${((totalAmount + principal) / 2).toFixed(0)}</span>
                            <span>${principal}</span>
                        </div>

                        {/* X-axis values */}
                        <div className="absolute -bottom-6 left-0 w-full flex justify-between text-[11px] font-semibold" style={{ color: 'var(--lp-muted)' }}>
                            <span>0</span>
                            <span>{Math.floor(time / 2)}</span>
                            <span>{time}</span>
                        </div>
                    </div>

                    {/* X-axis Footer Title */}
                    <div className="text-center mt-3">
                        <span className="lp-display text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--lp-muted)' }}>
                            {t('interest_calculator.time_axis', { defaultValue: 'Tiempo (Años)' })}
                        </span>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center mt-2">
                {feedback === 'none' ? (
                    <div className="w-full max-w-xs sm:max-w-md">
                        <QuestButton variant="gold" onClick={handleSubmit}>
                            <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
                            {t('interest_calculator.calculate')}
                        </QuestButton>
                    </div>
                ) : (
                    <div className="flex flex-col items-center w-full">
                        <p
                            className="lp-display text-base sm:text-lg mb-3"
                            style={{ color: feedback === 'success' ? 'var(--lp-emerald-ink)' : 'var(--lp-coral-ink)' }}
                        >
                            {feedback === 'success' ? t('interest_calculator.calculated') : t('feedback.error')}
                        </p>
                        <div className="w-full max-w-xs sm:max-w-md">
                            <QuestButton variant={feedback === 'success' ? 'go' : 'retry'} onClick={handleContinue}>
                                {t('actions.continue')}
                                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                            </QuestButton>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
