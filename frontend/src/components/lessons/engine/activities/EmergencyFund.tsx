import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, RotateCcw, AlertTriangle, Wallet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';
import { pickText } from './fieldText';

interface EmergencyFundProps {
    exercise: any;
    onSubmit: (decisions: Record<string, string>) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const EmergencyFund = ({ exercise, onSubmit, onNext, onRetry }: EmergencyFundProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [fundBalance, setFundBalance] = useState(5000);
    const [currentEvent, setCurrentEvent] = useState(0);
    const [decisions, setDecisions] = useState<Record<string, string>>({});
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setFundBalance(exercise?.content?.initialFund || 5000);
        setCurrentEvent(0);
        setDecisions({});
        setFeedback('none');
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [exercise]);

    const rawEvents = exercise?.content?.events || [];

    // Normalize legacy flat events ({ id, text, cost }) into full events with options.
    const events = rawEvents.map((ev: any) => {
        if (Array.isArray(ev.options) && ev.options.length > 0) return ev;
        const cost = Number(ev.cost ?? ev.amount ?? 0);
        const low = Math.round(cost * 0.5);
        const high = Math.round(cost * 1.5);
        return {
            ...ev,
            description: ev.description ?? ev.text ?? ev.title ?? ev.content ?? t('emergency_fund.default_event', { defaultValue: 'Emergencia' }),
            options: [
                { id: `${ev.id}_low`, text: ev.options?.[0]?.text ?? t('emergency_fund.option_save_more', { amount: low, defaultValue: 'Ahorra más (${{amount}})' }), cost: low },
                { id: `${ev.id}_orig`, text: ev.options?.[1]?.text ?? t('emergency_fund.option_spend', { amount: cost, defaultValue: 'Gasta ${{amount}}' }), cost },
                { id: `${ev.id}_high`, text: ev.options?.[2]?.text ?? t('emergency_fund.option_borrow', { amount: high, defaultValue: 'Pide prestado (${{amount}})' }), cost: high },
            ],
        };
    });

    const event = events[currentEvent];

    if (events.length === 0) {
        return (
            <div className="w-full max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col items-center justify-center py-20">
                <div className="text-6xl sm:text-7xl mb-4 lp-bob" aria-hidden="true">🚨</div>
                <h3 className="lp-display text-2xl sm:text-3xl mb-2 text-[var(--lp-ink)]">
                    {t('emergency_fund.loading', { defaultValue: 'Cargando emergencias...' })}
                </h3>
            </div>
        );
    }

    const handleDecision = (decisionId: string) => {
        if (feedback !== 'none') return;

        const decision = event.options.find((opt: any) => opt.id === decisionId);
        if (!decision) return;

        playSound('ui_tap');
        const newDecisions = { ...decisions, [event.id]: decisionId };
        setDecisions(newDecisions);

        const newBalance = fundBalance - (decision.cost || 0);
        setFundBalance(newBalance);

        if (currentEvent < events.length - 1) {
            timeoutRef.current = setTimeout(() => setCurrentEvent(prev => prev + 1), 1000);
        } else {
            timeoutRef.current = setTimeout(() => {
                const isCorrect = onSubmit(newDecisions);
                setFeedback(isCorrect ? 'success' : 'error');
            }, 1000);
        }
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            setFundBalance(exercise.content.initialFund || 5000);
            setCurrentEvent(0);
            setDecisions({});
            setFeedback('none');
            onRetry();
        }
    };

    if (!event && feedback === 'none') {
        return (
            <div className="w-full max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col items-center justify-center py-20">
                <div className="text-6xl sm:text-7xl mb-4 lp-bob" aria-hidden="true">🚨</div>
                <h3 className="lp-display text-2xl sm:text-3xl mb-2 text-[var(--lp-ink)]">
                    {t('emergency_fund.loading', { defaultValue: 'Cargando emergencias...' })}
                </h3>
            </div>
        );
    }

    return (
        <div className="w-full max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Fund Balance */}
            <div className="mb-6">
                <div
                    className="rounded-full p-6 border-2 text-center transition-all duration-500"
                    style={{
                        ...(fundBalance >= 3000
                            ? { background: 'var(--lp-emerald)', borderColor: 'var(--lp-emerald-lip)', color: '#fff' }
                            : fundBalance >= 1000
                                ? { background: 'var(--lp-indigo)', borderColor: 'var(--lp-indigo-lip)', color: '#fff' }
                                : { background: 'var(--lp-coral)', borderColor: 'var(--lp-coral-lip)', color: '#fff' }),
                        boxShadow: 'var(--lp-shadow)',
                    }}
                >
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <Wallet className="w-6 h-6" />
                        <span className="text-sm font-medium opacity-90">
                            {t('emergency_fund.balance')}
                        </span>
                    </div>
                    <div className="lp-display text-5xl sm:text-6xl">${fundBalance.toLocaleString()}</div>
                </div>
            </div>

            {/* Event */}
            {event && feedback === 'none' && (
                <>
                    <div
                        className="mb-6 border-2 rounded-full p-4 sm:p-5"
                        style={{ background: 'var(--lp-coral-soft)', borderColor: 'var(--lp-coral)' }}
                    >
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-1" style={{ color: 'var(--lp-coral)' }} />
                            <div className="flex-1">
                                <h3 className="lp-display text-sm sm:text-base mb-2" style={{ color: 'var(--lp-coral-ink)' }}>
                                    {t('emergency_fund.emergency')} {currentEvent + 1}/{events.length}
                                </h3>
                                <p className="lp-display text-base sm:text-lg leading-snug" style={{ color: 'var(--lp-ink)' }}>
                                    {event.description}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 mb-6">
                        {event.options.map((option: any, idx: number) => {
                            const canAfford = fundBalance >= (option.cost || 0);
                            const hue = ['indigo', 'amber', 'emerald', 'coral'][idx % 4];

                            return (
                                <button
                                    key={option.id}
                                    onClick={() => handleDecision(option.id)}
                                    disabled={!canAfford}
                                    style={{ animationDelay: `${0.04 + idx * 0.06}s` }}
                                    className={cn(
                                        "lp-token lp-option w-full text-left px-4 py-4",
                                        "animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both",
                                        `lp-option--${hue}`,
                                        !canAfford && "lp-token--locked is-dimmed cursor-not-allowed"
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-4 mb-2">
                                        <p className="lp-display text-sm sm:text-base flex-1 leading-snug" style={{ color: 'var(--lp-ink)' }}>
                                            {pickText(option)}
                                        </p>
                                        <span
                                            className="lp-display text-base sm:text-lg shrink-0"
                                            style={{ color: canAfford ? 'var(--lp-coral-ink)' : 'var(--lp-muted)' }}
                                        >
                                            ${option.cost?.toLocaleString()}
                                        </span>
                                    </div>
                                    <p className="text-xs sm:text-sm text-[var(--lp-muted)]">
                                        {option.description}
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                </>
            )}

            {/* Result */}
            {feedback !== 'none' && (
                <div className="flex flex-col items-center">
                    <div
                        className="mb-6 p-6 rounded-full text-center w-full border-2 animate-in fade-in zoom-in-95 duration-300"
                        style={feedback === 'success'
                            ? { background: 'var(--lp-emerald-soft)', borderColor: 'var(--lp-emerald)' }
                            : { background: 'var(--lp-coral-soft)', borderColor: 'var(--lp-coral)' }
                        }
                    >
                        <p
                            className="lp-display text-lg sm:text-xl mb-2"
                            style={{ color: feedback === 'success' ? 'var(--lp-emerald-ink)' : 'var(--lp-coral-ink)' }}
                        >
                            {feedback === 'success' ? t('emergency_fund.survived') : t('emergency_fund.depleted')}
                        </p>
                        <p className="text-sm sm:text-base text-[var(--lp-muted)]">
                            {feedback === 'success'
                                ? t('emergency_fund.success_message')
                                : t('emergency_fund.error_message')
                            }
                        </p>
                    </div>

                    <div className="w-full max-w-md">
                        <QuestButton
                            variant={feedback === 'success' ? 'go' : 'retry'}
                            onClick={handleContinue}
                        >
                            {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                            {feedback === 'success' ? <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" /> : <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />}
                        </QuestButton>
                    </div>
                </div>
            )}
        </div>
    );
};
