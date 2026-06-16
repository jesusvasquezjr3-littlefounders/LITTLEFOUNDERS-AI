import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, Heart, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';

const HUES = ["indigo", "amber", "emerald", "coral"] as const;

interface ImpactMeterProps {
    exercise: any;
    onSubmit: (causeId: string) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const ImpactMeter = ({ exercise, onSubmit, onNext, onRetry }: ImpactMeterProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [selectedCause, setSelectedCause] = useState<string | null>(null);
    const [showImpact, setShowImpact] = useState(false);
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setSelectedCause(null);
        setShowImpact(false);
        setFeedback('none');
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [exercise]);

    const causes = exercise.content.causes || [];
    const budget = exercise.content.budget || 100;

    const handleSelectCause = (causeId: string) => {
        if (feedback !== 'none') return;
        playSound('ui_tap');
        setSelectedCause(causeId);
    };

    const handleDonate = () => {
        if (!selectedCause) return;

        setShowImpact(true);

        timeoutRef.current = setTimeout(() => {
            const isCorrect = onSubmit(selectedCause);
            setFeedback(isCorrect ? 'success' : 'error');
        }, 2000);
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            setSelectedCause(null);
            setShowImpact(false);
            setFeedback('none');
            onRetry();
        }
    };

    return (
        <div className="w-full max-w-4xl animate-slide-in-bottom">

            {/* Budget Display */}
            <div className="mb-8 text-center">
                <div
                    className="inline-flex flex-col items-center rounded-3xl px-10 py-6 animate-in fade-in zoom-in-95 duration-500"
                    style={{
                        background: 'var(--lp-amber)',
                        color: 'var(--lp-amber-ink)',
                        boxShadow: '0 6px 0 var(--lp-amber-lip), 0 16px 24px -12px color-mix(in srgb, var(--lp-amber) 60%, transparent)',
                    }}
                >
                    <span className="text-sm font-bold opacity-80 mb-1">{t('impact_meter.your_donation')}</span>
                    <div className="lp-display text-5xl">${budget}</div>
                </div>
            </div>

            {/* Causes Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {causes.map((cause: any, index: number) => {
                    const isSelected = selectedCause === cause.id;
                    const hue = HUES[index % HUES.length];
                    const locked = feedback !== 'none';

                    return (
                        <button
                            key={cause.id}
                            onClick={() => handleSelectCause(cause.id)}
                            disabled={feedback !== 'none'}
                            aria-pressed={isSelected}
                            aria-label={cause.name}
                            style={{ animationDelay: `${0.05 + index * 0.07}s` }}
                            className={cn(
                                "lp-token lp-option relative p-5 text-center",
                                "animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both",
                                `lp-option--${hue}`,
                                locked && "lp-token--locked",
                                isSelected && feedback === 'none' && "is-selected",
                                feedback === 'success' && isSelected && "is-correct",
                                feedback !== 'none' && !isSelected && "is-dimmed"
                            )}
                        >
                            <div className="text-center">
                                <div className="text-5xl sm:text-6xl mb-3">{cause.icon}</div>
                                <h3 className="lp-display text-base mb-1" style={{ color: 'var(--lp-ink)' }}>
                                    {cause.name}
                                </h3>
                                <p className="text-xs leading-snug" style={{ color: 'var(--lp-muted)' }}>
                                    {cause.impact}
                                </p>
                            </div>

                            {/* Selection Heart */}
                            {isSelected && feedback === 'none' && (
                                <div
                                    className="absolute -top-3 -right-3 w-10 h-10 rounded-full flex items-center justify-center animate-in zoom-in"
                                    style={{
                                        background: 'var(--lp-coral)',
                                        boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.18)',
                                    }}
                                >
                                    <Heart className="w-5 h-5 text-white fill-white" />
                                </div>
                            )}

                            {/* Impact Animation */}
                            {showImpact && isSelected && (
                                <div className="absolute inset-0 pointer-events-none">
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                                        {[...Array(6)].map((_, i) => (
                                            <Heart
                                                key={i}
                                                className="absolute w-6 h-6 animate-float-away"
                                                style={{
                                                    color: 'var(--lp-coral)',
                                                    fill: 'var(--lp-coral)',
                                                    animationDelay: `${i * 0.1}s`,
                                                    transform: `rotate(${i * 60}deg) translateY(-${i * 20}px)`
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center">
                {feedback === 'none' ? (
                    <div className="w-full max-w-md">
                        <QuestButton variant="gold" disabled={!selectedCause} onClick={handleDonate}>
                            <Heart className="w-5 h-5 fill-current" />
                            {t('impact_meter.donate')}
                        </QuestButton>
                    </div>
                ) : (
                    <div className="flex flex-col items-center w-full">
                        <p
                            className="lp-display text-lg mb-3"
                            style={{ color: feedback === 'success' ? 'var(--lp-emerald)' : 'var(--lp-coral)' }}
                        >
                            {feedback === 'success' ? (
                                <>
                                    <Sparkles className="w-5 h-5 inline-block mr-1" />
                                    {t('impact_meter.thank_you')}
                                </>
                            ) : (
                                t('feedback.error')
                            )}
                        </p>
                        <div className="w-full max-w-md">
                            <QuestButton variant={feedback === 'success' ? 'go' : 'retry'} onClick={handleContinue}>
                                {t('actions.continue')}
                                <ArrowRight className="w-5 h-5" />
                            </QuestButton>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
