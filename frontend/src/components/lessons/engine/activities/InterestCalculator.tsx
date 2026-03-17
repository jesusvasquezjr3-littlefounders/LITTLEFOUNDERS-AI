import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, DollarSign } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

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

    useEffect(() => {
        setPrincipal(exercise.content.defaultPrincipal || 1000);
        setRate(exercise.content.defaultRate || 5);
        setTime(exercise.content.defaultTime || 1);
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
        onNext();
    };

    const maxPrincipal = exercise.content.maxPrincipal || 10000;
    const maxRate = exercise.content.maxRate || 20;
    const maxTime = exercise.content.maxTime || 30;

    return (
        <div className="w-full max-w-3xl animate-slide-in-bottom">

            {/* Title */}
            <div className="mb-6 text-center">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                    {exercise.content.type === 'compound'
                        ? t('interest_calculator.compound_title')
                        : t('interest_calculator.simple_title')
                    }
                </h2>
            </div>

            {/* Sliders */}
            <div className="space-y-6 mb-8">
                {/* Principal */}
                <div className="liquid-glass-strong rounded-2xl p-4 border border-white/20 dark:border-white/10 shadow-xl">
                    <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                            {t('interest_calculator.principal')}
                        </label>
                        <span className="text-lg font-black text-green-600 dark:text-green-400">
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
                        className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-green-600"
                    />
                </div>

                {/* Interest Rate */}
                <div className="liquid-glass-strong rounded-2xl p-4 border border-white/20 dark:border-white/10 shadow-xl">
                    <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                            {t('interest_calculator.rate')}
                        </label>
                        <span className="text-lg font-black text-blue-600 dark:text-blue-400">
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
                        className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                </div>

                {/* Time */}
                <div className="liquid-glass-strong rounded-2xl p-4 border border-white/20 dark:border-white/10 shadow-xl">
                    <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                            {t('interest_calculator.time')}
                        </label>
                        <span className="text-lg font-black text-purple-600 dark:text-purple-400">
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
                        className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                    />
                </div>
            </div>

            {/* Results */}
            <div className="mb-8">
                <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl p-6 text-white shadow-xl">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                        <div>
                            <div className="text-xs opacity-80 mb-1">{t('interest_calculator.initial')}</div>
                            <div className="text-2xl font-black">${principal.toLocaleString()}</div>
                        </div>
                        <div>
                            <div className="text-xs opacity-80 mb-1">{t('interest_calculator.interest_earned')}</div>
                            <div className="text-2xl font-black">${interest.toFixed(2)}</div>
                        </div>
                        <div>
                            <div className="text-xs opacity-80 mb-1">{t('interest_calculator.total')}</div>
                            <div className="text-3xl font-black">${totalAmount.toFixed(2)}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Visual Chart - Comparative Line Chart */}
            <div className="mb-8">
                <div className="liquid-glass-strong rounded-2xl p-6 border border-white/20 dark:border-white/10 shadow-xl">
                    {/* Legend */}
                    <div className="flex justify-center gap-6 mb-4">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-1 bg-blue-500 rounded"></div>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                Interés Simple
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-1 bg-green-500 rounded"></div>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                Interés Compuesto
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
                                    stroke="currentColor"
                                    strokeWidth="0.5"
                                    className="text-slate-300 dark:text-slate-600"
                                    opacity="0.3"
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
                                stroke="rgb(59, 130, 246)"
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
                                stroke="rgb(34, 197, 94)"
                                strokeWidth={exercise.content.type === 'compound' ? "3" : "2"}
                                className={exercise.content.type === 'compound' ? "opacity-100" : "opacity-50"}
                            />
                        </svg>

                        {/* Y-axis labels */}
                        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-slate-600 dark:text-slate-400 -ml-12">
                            <span>${totalAmount.toFixed(0)}</span>
                            <span>${(totalAmount * 0.5).toFixed(0)}</span>
                            <span>${principal}</span>
                        </div>

                        {/* X-axis labels */}
                        <div className="absolute bottom-0 left-0 w-full flex justify-between text-xs text-slate-600 dark:text-slate-400 -mb-6">
                            <span>0</span>
                            <span>{Math.floor(time / 2)}</span>
                            <span>{time}</span>
                        </div>
                    </div>

                    {/* Axis labels */}
                    <div className="flex justify-between items-center mt-8">
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Años</span>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400 -rotate-90 origin-center">Monto</span>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center">
                {feedback === 'none' ? (
                    <Button
                        onClick={handleSubmit}
                        className="relative overflow-hidden w-full max-w-md h-12 text-base font-bold bg-green-600 hover:bg-green-700 text-white rounded-2xl shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all"
                    >
                        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                        <span className="relative flex items-center justify-center">
                            <DollarSign className="w-5 h-5 mr-2" />
                            {t('interest_calculator.calculate')}
                        </span>
                    </Button>
                ) : (
                    <div className="flex flex-col items-center w-full">
                        <p className="font-bold text-lg mb-3 text-green-500">
                            {t('interest_calculator.calculated')}
                        </p>
                        <Button
                            onClick={handleContinue}
                            className="relative overflow-hidden w-full max-w-md h-12 text-base font-bold bg-green-500 hover:bg-green-600 text-white rounded-2xl shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all"
                        >
                            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                            <span className="relative flex items-center justify-center">
                                {t('actions.continue')}
                                <ArrowRight className="ml-2 w-5 h-5" />
                            </span>
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};
