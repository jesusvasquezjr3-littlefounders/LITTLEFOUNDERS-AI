import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, DollarSign, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';

interface PassiveIncomeProps {
    exercise: any;
    onSubmit: (selected: string[]) => boolean;
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
        const isCorrect = onSubmit(selectedStreams);
        setFeedback(isCorrect ? 'success' : 'error');
    };

    return (
        <div className="w-full max-w-5xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Intro Explanation */}
            <div className="mb-6 p-4 sm:p-6 lp-card">
                <p className="lp-display text-base sm:text-lg leading-snug mb-2" style={{ color: 'var(--lp-ink)' }}>
                    {t('passive_income.intro_title')} <strong>{t('passive_income.intro_desc')}</strong>
                </p>
                <p className="lp-display text-sm sm:text-base" style={{ color: 'var(--lp-emerald-ink)' }}>
                    {t('passive_income.intro_goal', { amount: targetIncome })}
                </p>
            </div>

            {/* Target Display */}
            <div className="mb-6 lp-card p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-6 h-6" style={{ color: 'var(--lp-emerald)' }} />
                        <h3 className="lp-display text-lg sm:text-xl" style={{ color: 'var(--lp-ink)' }}>
                            {t('passive_income.target')}
                        </h3>
                    </div>
                    <div className="lp-display text-2xl sm:text-3xl" style={{ color: 'var(--lp-emerald)' }}>
                        ${targetIncome}/mo
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="lp-track relative h-8">
                    <div
                        className="h-full transition-all duration-500 flex items-center justify-end pr-3"
                        style={{ width: `${progress}%`, background: 'linear-gradient(90deg, var(--lp-emerald-lip), var(--lp-emerald))', borderRadius: '999px', boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.12)' }}
                    >
                        {progress > 20 && (
                            <span className="lp-display text-sm text-white">
                                ${totalIncome}
                            </span>
                        )}
                    </div>
                </div>

                <div className="mt-2 text-center lp-display text-sm" style={{ color: 'var(--lp-emerald-ink)' }}>
                    {isTargetMet ? '🎉 ' + t('passive_income.target_met') : t('passive_income.keep_adding')}
                </div>
            </div>

            {/* Income Streams */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {streams.map((stream: any, idx: number) => {
                    const isSelected = selectedStreams.includes(stream.id);

                    return (
                        <button
                            key={stream.id}
                            onClick={() => toggleStream(stream.id)}
                            style={{ animationDelay: `${0.04 + idx * 0.06}s` }}
                            className={cn(
                                "lp-token lp-option lp-option--emerald p-6 text-left relative overflow-hidden",
                                "animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both",
                                isSelected && "is-selected"
                            )}
                        >
                            {/* Pipeline Animation */}
                            {isSelected && (
                                <div className="absolute top-0 left-0 w-full h-1 animate-pulse" style={{ background: 'var(--lp-emerald)' }}></div>
                            )}

                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-3xl">{stream.icon}</span>
                                <h3 className="lp-display text-lg" style={{ color: 'var(--lp-ink)' }}>
                                    {stream.name}
                                </h3>
                            </div>

                            <p className="text-xs sm:text-sm mb-3" style={{ color: 'var(--lp-muted)' }}>
                                {stream.description}
                            </p>

                            <div className="flex items-center justify-between">
                                <div className="text-xs" style={{ color: 'var(--lp-muted)' }}>
                                    {t('passive_income.monthly')}
                                </div>
                                <div className="lp-display text-xl" style={{ color: 'var(--lp-emerald-ink)' }}>
                                    ${stream.monthlyIncome}
                                </div>
                            </div>

                            {/* Checkmark */}
                            {isSelected && (
                                <div className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'var(--lp-emerald)' }}>
                                    <span className="text-white text-sm">✓</span>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Pipeline Visualization */}
            {selectedStreams.length > 0 && (
                <div className="mb-6 lp-card p-6">
                    <h3 className="lp-display text-sm sm:text-base mb-4 flex items-center gap-2" style={{ color: 'var(--lp-ink)' }}>
                        <DollarSign className="w-5 h-5" style={{ color: 'var(--lp-emerald)' }} />
                        {t('passive_income.your_streams')}
                    </h3>
                    <div className="space-y-4">
                        {selectedStreams.map((streamId) => {
                            const stream = streams.find((s: any) => s.id === streamId);
                            if (!stream) return null;

                            return (
                                <div key={streamId} className="flex items-center gap-3">
                                    <span className="text-2xl">{stream.icon}</span>
                                    <div className="lp-track flex-1 h-2">
                                        <div className="h-full animate-pulse" style={{ background: 'var(--lp-emerald)', borderRadius: '999px' }}></div>
                                    </div>
                                    <span className="lp-display" style={{ color: 'var(--lp-emerald-ink)' }}>
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
                            <p className="lp-display text-lg mb-3" style={{ color: 'var(--lp-coral)' }}>
                                {t('passive_income.not_enough')}
                            </p>
                        )}
                        <div className="w-full max-w-md">
                            <QuestButton
                                onClick={handleSubmit}
                                disabled={selectedStreams.length === 0}
                            >
                                {t('actions.build_income')}
                                <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
                            </QuestButton>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center w-full">
                        <div className="w-full max-w-md">
                            <QuestButton variant="go" onClick={onNext}>
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
