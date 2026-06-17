import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, Briefcase, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';
import { resolveOptions } from './optionSource';

interface SalaryComparisonProps {
    exercise: any;
    onSubmit: (selectedId: string) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

const normalizeDescription = (details: any): string => {
    if (typeof details === 'string') return details;
    if (Array.isArray(details)) return details.join('\n');
    return String(details || '');
};

const HUES = ['indigo', 'amber', 'emerald', 'coral'] as const;

export const SalaryComparison = ({ exercise, onSubmit, onNext, onRetry }: SalaryComparisonProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [selected, setSelected] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');

    // Determine format and normalize data safely
    const content = exercise?.content || {};
    const isLegacy = Array.isArray(content.offers) && content.offers.length > 0;

    // Normalize offers for unified rendering
    let offers: any[] = [];
    let factors: string[] = ['salary', 'benefits', 'location', 'growth'];

    if (isLegacy) {
        offers = content.offers;
        factors = content.factors || factors;
    } else {
        // Real lessons use options[] / offer_a-offer_b / optionA-optionB / jobA-jobB.
        offers = resolveOptions(content, ['offers', 'options']).map((o: any) => ({
            id: o.id,
            company: o.company ?? o.name ?? o.title ?? o.text ?? '',
            description: normalizeDescription(o.details ?? o.description ?? o.text ?? ''),
        }));
    }

    useEffect(() => {
        setSelected(null);
        setFeedback('none');
    }, [exercise]);

    const calculateScore = (offer: any): number => {
        if (!isLegacy) return 0;
        let score = 0;
        score += (offer.salary / 1000) * 0.4; // 40% weight on salary
        score += (offer.benefits || 0) * 0.3; // 30% weight on benefits
        score += (offer.location || 0) * 0.15; // 15% weight on location
        score += (offer.growth || 0) * 0.15; // 15% weight on growth
        return score;
    };

    const handleSelect = (offerId: string) => {
        setSelected(offerId);
        playSound('ui_tap');
    };

    const handleSubmit = () => {
        if (!selected) return;

        const isCorrect = onSubmit(selected);
        setFeedback(isCorrect ? 'success' : 'error');
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            setSelected(null);
            setFeedback('none');
            onRetry();
        }
    };

    // Graceful fallback if no recognizable data
    if (!isLegacy && offers.length === 0) {
        return (
            <div className={cn(
                "w-full max-w-5xl animate-in fade-in slide-in-from-bottom-4 duration-500",
                "flex flex-col items-center justify-center py-12 text-center"
            )}>
                <AlertCircle className="w-12 h-12 mb-4" style={{ color: 'var(--lp-muted)' }} />
                <p className="lp-display text-lg" style={{ color: 'var(--lp-muted)' }}>
                    {t('salary_comparison.no_data', { defaultValue: 'No comparison data available.' })}
                </p>
            </div>
        );
    }

    return (
        <div className={cn(
            "w-full max-w-5xl animate-in fade-in slide-in-from-bottom-4 duration-500"
        )}>
            {/* Scenario / Question / Instruction for new format */}
            {!isLegacy && (
                <div className="mb-6 space-y-3 text-center">
                    {content.scenario && (
                        <p className="text-base" style={{ color: 'var(--lp-muted)' }}>
                            {content.scenario}
                        </p>
                    )}
                    {content.question && (
                        <h2 className="lp-display text-xl sm:text-2xl" style={{ color: 'var(--lp-ink)' }}>
                            {content.question}
                        </h2>
                    )}
                    {content.instruction && (
                        <p className="text-sm" style={{ color: 'var(--lp-muted)' }}>
                            {content.instruction}
                        </p>
                    )}
                </div>
            )}

            {/* Offers Grid */}
            <div className={cn(
                "mb-6 grid gap-4",
                offers.length <= 2
                    ? "grid-cols-1 md:grid-cols-2"
                    : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
            )}>
                {offers.map((offer: any, index: number) => {
                    const score = calculateScore(offer);
                    const isSelected = selected === offer.id;
                    const otherSelected = selected !== null && selected !== offer.id;
                    const hue = HUES[index % HUES.length];

                    return (
                        <button
                            key={offer.id}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => handleSelect(offer.id)}
                            className={cn(
                                "lp-token lp-option p-5 sm:p-6 text-left",
                                "animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both",
                                `lp-option--${hue}`,
                                isSelected && "is-selected",
                                otherSelected && "is-dimmed",
                            )}
                            style={{ animationDelay: `${0.04 + index * 0.06}s` }}
                        >
                            <div className="flex items-center gap-2.5 mb-4">
                                <span className="lp-badge shrink-0 w-10 h-10 flex items-center justify-center">
                                    <Briefcase className="w-5 h-5" />
                                </span>
                                <h3 className="lp-display text-lg sm:text-xl" style={{ color: 'var(--lp-ink)' }}>
                                    {offer.company}
                                </h3>
                            </div>

                            {isLegacy ? (
                                <div className="space-y-2 mb-4">
                                    <div className="flex justify-between">
                                        <span className="text-sm" style={{ color: 'var(--lp-muted)' }}>
                                            {t('salary_comparison.salary', { defaultValue: 'Salary' })}
                                        </span>
                                        <span className="lp-display" style={{ color: 'var(--lp-emerald)' }}>
                                            ${offer.salary?.toLocaleString() ?? '0'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm" style={{ color: 'var(--lp-muted)' }}>
                                            {t('salary_comparison.benefits', { defaultValue: 'Benefits' })}
                                        </span>
                                        <span className="lp-display" style={{ color: 'var(--lp-ink)' }}>{offer.benefits ?? '0'}/10</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm" style={{ color: 'var(--lp-muted)' }}>
                                            {t('salary_comparison.location', { defaultValue: 'Location' })}
                                        </span>
                                        <span className="lp-display" style={{ color: 'var(--lp-ink)' }}>{offer.location ?? '0'}/10</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm" style={{ color: 'var(--lp-muted)' }}>
                                            {t('salary_comparison.growth', { defaultValue: 'Growth' })}
                                        </span>
                                        <span className="lp-display" style={{ color: 'var(--lp-ink)' }}>{offer.growth ?? '0'}/10</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="mb-4">
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--lp-muted)' }}>
                                        {offer.description}
                                    </p>
                                </div>
                            )}

                            {isLegacy && (
                                <div className="pt-3" style={{ borderTop: '1.5px solid var(--lp-line)' }}>
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs" style={{ color: 'var(--lp-muted)' }}>
                                            {t('salary_comparison.score', { defaultValue: 'Score' })}
                                        </span>
                                        <span className="lp-display text-xl" style={{ color: 'var(--lp-indigo)' }}>
                                            {score.toFixed(1)}
                                        </span>
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
                        <QuestButton variant="gold" disabled={!selected} onClick={handleSubmit}>
                            {t('actions.select_offer', { defaultValue: 'Select Offer' })}
                            <ArrowRight className="w-5 h-5" />
                        </QuestButton>
                    </div>
                ) : (
                    <div className="flex flex-col items-center w-full">
                        <p
                            className="lp-display text-lg mb-3"
                            style={{ color: feedback === 'success' ? 'var(--lp-emerald)' : 'var(--lp-coral)' }}
                        >
                            {feedback === 'success'
                                ? t('feedback.success', { defaultValue: 'Great job!' })
                                : t('feedback.error', { defaultValue: 'Not quite right.' })}
                        </p>
                        <div className="w-full max-w-md">
                            <QuestButton variant={feedback === 'success' ? 'go' : 'retry'} onClick={handleContinue}>
                                {t('actions.continue', { defaultValue: 'Continue' })}
                                <ArrowRight className="w-5 h-5" />
                            </QuestButton>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
