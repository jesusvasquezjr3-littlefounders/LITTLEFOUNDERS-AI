import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, DollarSign, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

interface PassiveIncomeProps {
    exercise: any;
    onSubmit: (selected: string[]) => void;
    onNext: () => void;
    onRetry: () => void;
}

export const PassiveIncome = ({ exercise, onSubmit, onNext, onRetry }: PassiveIncomeProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [selectedStreams, setSelectedStreams] = useState<string[]>([]);
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');

    const streams = exercise.content.streams || [];
    const targetIncome = exercise.content.targetIncome || 1000;

    useEffect(() => {
        setSelectedStreams([]);
        setFeedback('none');
    }, [exercise]);

    const toggleStream = (streamId: string) => {
        setSelectedStreams(prev => {
            if (prev.includes(streamId)) {
                return prev.filter(id => id !== streamId);
            } else {
                return [...prev, streamId];
            }
        });
        playSound('ui_tap');
    };

    const calculateTotalIncome = (): number => {
        return selectedStreams.reduce((total, streamId) => {
            const stream = streams.find((s: any) => s.id === streamId);
            return total + (stream?.monthlyIncome || 0);
        }, 0);
    };

    const totalIncome = calculateTotalIncome();
    const progress = Math.min((totalIncome / targetIncome) * 100, 100);
    const isTargetMet = totalIncome >= targetIncome;

    const handleSubmit = () => {
        if (!isTargetMet) {
            playSound('edu_error');
            setFeedback('error');
            return;
        }

        onSubmit(selectedStreams);
        playSound('edu_success');
        setFeedback('success');
    };

    return (
        <div className="w-full max-w-5xl animate-slide-in-bottom">
            {/* Intro Explanation */}
            {/* Intro Explanation */}
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-950/30 border-2 border-green-300 dark:border-green-700 rounded-xl">
                <p className="text-sm text-green-900 dark:text-green-100 mb-2">
                    {t('passive_income.intro_title')} <strong>{t('passive_income.intro_desc')}</strong>
                </p>
                <p className="text-xs text-green-800 dark:text-green-200">
                    {t('passive_income.intro_goal', { amount: targetIncome })}
                </p>
            </div>

            {/* Target Display */}
            <div className="mb-6 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-950/30 dark:to-emerald-950/30 border-2 border-green-500 dark:border-green-700 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-6 h-6 text-green-600" />
                        <h3 className="text-lg font-black text-green-900 dark:text-green-100">
                            {t('passive_income.target')}
                        </h3>
                    </div>
                    <div className="text-2xl font-black text-green-600">
                        ${targetIncome}/mo
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="relative h-8 bg-green-200 dark:bg-green-900 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-green-500 to-emerald-600 transition-all duration-500 flex items-center justify-end pr-3"
                        style={{ width: `${progress}%` }}
                    >
                        {progress > 20 && (
                            <span className="text-sm font-bold text-white">
                                ${totalIncome}
                            </span>
                        )}
                    </div>
                </div>

                <div className="mt-2 text-center text-sm text-green-700 dark:text-green-300">
                    {isTargetMet ? '🎉 ' + t('passive_income.target_met') : t('passive_income.keep_adding')}
                </div>
            </div>

            {/* Income Streams */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {streams.map((stream: any) => {
                    const isSelected = selectedStreams.includes(stream.id);

                    return (
                        <button
                            key={stream.id}
                            onClick={() => toggleStream(stream.id)}
                            className={cn(
                                "p-6 rounded-2xl border-2 transition-all text-left relative overflow-hidden",
                                isSelected
                                    ? "bg-green-100 dark:bg-green-950 border-green-500 shadow-lg"
                                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-green-300"
                            )}
                        >
                            {/* Pipeline Animation */}
                            {isSelected && (
                                <div className="absolute top-0 left-0 w-full h-1 bg-green-500 animate-pulse"></div>
                            )}

                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-3xl">{stream.icon}</span>
                                <h3 className="text-lg font-black text-slate-800 dark:text-slate-200">
                                    {stream.name}
                                </h3>
                            </div>

                            <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                                {stream.description}
                            </p>

                            <div className="flex items-center justify-between">
                                <div className="text-xs text-slate-600 dark:text-slate-400">
                                    {t('passive_income.monthly')}
                                </div>
                                <div className="text-xl font-black text-green-600">
                                    ${stream.monthlyIncome}
                                </div>
                            </div>

                            {/* Checkmark */}
                            {isSelected && (
                                <div className="absolute top-3 right-3 w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                                    <span className="text-white text-sm">✓</span>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Pipeline Visualization */}
            {selectedStreams.length > 0 && (
                <div className="mb-6 bg-white dark:bg-slate-800 rounded-2xl p-6 border-2 border-slate-200 dark:border-slate-700">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        {t('passive_income.your_streams')}
                    </h3>
                    <div className="space-y-2">
                        {selectedStreams.map((streamId) => {
                            const stream = streams.find((s: any) => s.id === streamId);
                            if (!stream) return null;

                            return (
                                <div key={streamId} className="flex items-center gap-3">
                                    <span className="text-2xl">{stream.icon}</span>
                                    <div className="flex-1 h-2 bg-green-200 dark:bg-green-900 rounded-full overflow-hidden">
                                        <div className="h-full bg-green-500 animate-pulse"></div>
                                    </div>
                                    <span className="font-bold text-green-600">
                                        ${stream.monthlyIncome}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-center">
                {feedback === 'none' || feedback === 'error' ? (
                    <div className="flex flex-col items-center w-full">
                        {feedback === 'error' && (
                            <p className="font-bold text-lg mb-3 text-red-500">
                                {t('passive_income.not_enough')}
                            </p>
                        )}
                        <Button
                            onClick={handleSubmit}
                            disabled={selectedStreams.length === 0}
                            className="w-full max-w-md h-12 text-base font-bold bg-green-600 hover:bg-green-700 text-white rounded-2xl shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all disabled:opacity-50"
                        >
                            {t('actions.build_income')}
                            <ArrowRight className="ml-2 w-5 h-5" />
                        </Button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center w-full">

                        <Button
                            onClick={onNext}
                            className="w-full max-w-md h-12 text-base font-bold bg-green-500 hover:bg-green-600 text-white rounded-2xl shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all"
                        >
                            {t('actions.continue')}
                            <ArrowRight className="ml-2 w-5 h-5" />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};
