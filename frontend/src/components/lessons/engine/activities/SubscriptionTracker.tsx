import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, ToggleLeft, ToggleRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';

interface SubscriptionTrackerProps {
    exercise: any;
    onSubmit: (active: string[]) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const SubscriptionTracker = ({ exercise, onSubmit, onNext, onRetry }: SubscriptionTrackerProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [activeSubscriptions, setActiveSubscriptions] = useState<Set<string>>(new Set());
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');

    useEffect(() => {
        const initial = new Set<string>((exercise.content.subscriptions || [])
            .filter((sub: any) => sub.initiallyActive)
            .map((sub: any) => String(sub.id)));
        setActiveSubscriptions(initial);
        setFeedback('none');
    }, [exercise]);

    const subscriptions = exercise.content.subscriptions || [];

    const toggleSubscription = (subId: string) => {
        if (feedback !== 'none') return;
        playSound('ui_tap');

        setActiveSubscriptions(prev => {
            const newSet = new Set(prev);
            if (newSet.has(subId)) {
                newSet.delete(subId);
            } else {
                newSet.add(subId);
            }
            return newSet;
        });
    };

    const totalCost = subscriptions
        .filter((sub: any) => activeSubscriptions.has(sub.id))
        .reduce((sum: number, sub: any) => sum + (sub.monthlyCost || 0), 0);

    const annualSavings = subscriptions
        .filter((sub: any) => !activeSubscriptions.has(sub.id))
        .reduce((sum: number, sub: any) => sum + (sub.monthlyCost || 0) * 12, 0);

    const handleSubmit = () => {
        const isCorrect = onSubmit(Array.from(activeSubscriptions));
        setFeedback(isCorrect ? 'success' : 'error');
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            const initial = new Set<string>((exercise.content.subscriptions || [])
                .filter((sub: any) => sub.initiallyActive)
                .map((sub: any) => String(sub.id)));
            setActiveSubscriptions(initial);
            setFeedback('none');
            onRetry();
        }
    };

    return (
        <div className="w-full max-w-3xl animate-slide-in-bottom">

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div
                    className="rounded-2xl p-4"
                    style={{
                        background: 'var(--lp-coral-soft)',
                        border: '2px solid var(--lp-coral)',
                        boxShadow: '0 5px 0 var(--lp-coral-lip)',
                    }}
                >
                    <div className="text-xs mb-1" style={{ color: 'var(--lp-coral-ink)' }}>{t('subscription.monthly_cost')}</div>
                    <div className="lp-display text-3xl" style={{ color: 'var(--lp-coral-ink)' }}>${totalCost.toFixed(2)}</div>
                    <div className="text-xs" style={{ color: 'var(--lp-coral-ink)', opacity: 0.8 }}>{t('subscription.per_month')}</div>
                </div>

                <div
                    className="rounded-2xl p-4"
                    style={{
                        background: 'var(--lp-emerald-soft)',
                        border: '2px solid var(--lp-emerald)',
                        boxShadow: '0 5px 0 var(--lp-emerald-lip)',
                    }}
                >
                    <div className="text-xs mb-1" style={{ color: 'var(--lp-emerald-ink)' }}>{t('subscription.annual_savings')}</div>
                    <div className="lp-display text-3xl" style={{ color: 'var(--lp-emerald-ink)' }}>${annualSavings.toFixed(2)}</div>
                    <div className="text-xs" style={{ color: 'var(--lp-emerald-ink)', opacity: 0.8 }}>{t('subscription.if_cancelled')}</div>
                </div>
            </div>

            {/* Subscriptions List */}
            <div className="space-y-3 mb-6">
                {subscriptions.map((sub: any) => {
                    const isActive = activeSubscriptions.has(sub.id);

                    return (
                        <button
                            key={sub.id}
                            onClick={() => toggleSubscription(sub.id)}
                            disabled={feedback !== 'none'}
                            className={cn(
                                "lp-token lp-option lp-option--indigo w-full p-4 text-left",
                                feedback !== 'none' && "lp-token--locked",
                                isActive && "is-selected",
                                !isActive && "is-dimmed"
                            )}
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                                    <div className="text-4xl sm:text-5xl shrink-0">{sub.icon || '📱'}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="lp-display text-sm sm:text-base" style={{ color: 'var(--lp-ink)' }}>
                                            {sub.name}
                                        </div>
                                        <div className="text-xs" style={{ color: 'var(--lp-muted)' }}>
                                            {sub.description}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                                    <div className="text-right">
                                        <div className="lp-display text-sm sm:text-base" style={{ color: 'var(--lp-ink)' }}>
                                            ${sub.monthlyCost}/mo
                                        </div>
                                        <div className="text-xs" style={{ color: 'var(--lp-muted)' }}>
                                            ${(sub.monthlyCost * 12).toFixed(0)}/yr
                                        </div>
                                    </div>
                                    {isActive ? (
                                        <ToggleRight aria-hidden="true" className="w-9 h-9 sm:w-10 sm:h-10" style={{ color: 'var(--lp-indigo)' }} />
                                    ) : (
                                        <ToggleLeft aria-hidden="true" className="w-9 h-9 sm:w-10 sm:h-10" style={{ color: 'var(--lp-muted)' }} />
                                    )}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center">
                {feedback === 'none' ? (
                    <div className="w-full max-w-md">
                        <QuestButton variant="gold" onClick={handleSubmit}>
                            {t('subscription.optimize')}
                        </QuestButton>
                    </div>
                ) : (
                    <div className="flex flex-col items-center w-full max-w-md">
                        <p
                            className="lp-display text-lg mb-3"
                            style={{ color: feedback === 'success' ? 'var(--lp-emerald)' : 'var(--lp-coral)' }}
                        >
                            {feedback === 'success' ? t('subscription.optimized') : t('feedback.error')}
                        </p>
                        <QuestButton variant={feedback === 'success' ? 'go' : 'retry'} onClick={handleContinue}>
                            {t('actions.continue')}
                            <ArrowRight className="w-5 h-5" />
                        </QuestButton>
                    </div>
                )}
            </div>
        </div>
    );
};
