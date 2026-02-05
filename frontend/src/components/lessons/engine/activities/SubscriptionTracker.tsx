import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, ToggleLeft, ToggleRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

interface SubscriptionTrackerProps {
    exercise: any;
    onSubmit: (active: string[]) => void;
    onNext: () => void;
    onRetry: () => void;
}

export const SubscriptionTracker = ({ exercise, onSubmit, onNext, onRetry }: SubscriptionTrackerProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [activeSubscriptions, setActiveSubscriptions] = useState<Set<string>>(new Set());
    const [feedback, setFeedback] = useState<'none' | 'success'>('none');

    useEffect(() => {
        const initial = new Set((exercise.content.subscriptions || [])
            .filter((sub: any) => sub.initiallyActive)
            .map((sub: any) => sub.id));
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
        playSound('edu_success');
        setFeedback('success');
        onSubmit(Array.from(activeSubscriptions));
    };

    const handleContinue = () => {
        onNext();
    };

    return (
        <div className="w-full max-w-3xl animate-slide-in-bottom">

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="bg-gradient-to-br from-red-500 to-rose-600 text-white rounded-2xl p-4 shadow-xl">
                    <div className="text-xs opacity-90 mb-1">{t('subscription.monthly_cost')}</div>
                    <div className="text-3xl font-black">${totalCost.toFixed(2)}</div>
                    <div className="text-xs opacity-80">{t('subscription.per_month')}</div>
                </div>

                <div className="bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-2xl p-4 shadow-xl">
                    <div className="text-xs opacity-90 mb-1">{t('subscription.annual_savings')}</div>
                    <div className="text-3xl font-black">${annualSavings.toFixed(2)}</div>
                    <div className="text-xs opacity-80">{t('subscription.if_cancelled')}</div>
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
                                "w-full p-4 rounded-xl border-2 transition-all text-left",
                                isActive && "bg-white dark:bg-slate-800 border-blue-400 dark:border-blue-600",
                                !isActive && "bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-600 opacity-60"
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1">
                                    <div className="text-2xl">{sub.icon || '📱'}</div>
                                    <div className="flex-1">
                                        <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                            {sub.name}
                                        </div>
                                        <div className="text-xs text-slate-600 dark:text-slate-400">
                                            {sub.description}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-right">
                                        <div className="text-base font-bold text-slate-800 dark:text-slate-100">
                                            ${sub.monthlyCost}/mo
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                            ${(sub.monthlyCost * 12).toFixed(0)}/yr
                                        </div>
                                    </div>
                                    {isActive ? (
                                        <ToggleRight className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                                    ) : (
                                        <ToggleLeft className="w-10 h-10 text-slate-400" />
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
                    <Button
                        onClick={handleSubmit}
                        className="w-full max-w-md h-12 text-base font-bold bg-green-600 hover:bg-green-700 text-white rounded-2xl shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all"
                    >
                        {t('subscription.optimize')}
                    </Button>
                ) : (
                    <div className="flex flex-col items-center w-full">
                        <p className="font-bold text-lg mb-3 text-green-500">
                            {t('subscription.optimized')}
                        </p>
                        <Button
                            onClick={handleContinue}
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
