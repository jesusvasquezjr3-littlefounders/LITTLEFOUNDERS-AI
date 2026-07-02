import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, ArrowLeftRight, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';
import { resolveOptions } from './optionSource';
import { pickText } from './fieldText';

interface OpportunityCostProps {
    exercise: any;
    onSubmit: (choice: string) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const OpportunityCost = ({ exercise, onSubmit, onNext, onRetry }: OpportunityCostProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [selected, setSelected] = useState<string | null>(null);
    const [showAnalysis, setShowAnalysis] = useState(false);
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');

    const content = exercise?.content || {};
    const options = resolveOptions(content, ['options']);

    useEffect(() => {
        setSelected(null);
        setShowAnalysis(false);
        setFeedback('none');
    }, [exercise]);

    const handleSelect = (optionId: string) => {
        setSelected(optionId);
        setShowAnalysis(true);
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
            setShowAnalysis(false);
            setFeedback('none');
            onRetry();
        }
    };

    const selectedOption = options.find((opt: any) => opt.id === selected);
    const notSelectedOption = options.find((opt: any) => opt.id !== selected);

    // Determine if options have rich data (legacy) or simple data (real JSON)
    const hasRichData = options.some((opt: any) => opt.benefits || opt.title || opt.description);

    return (
        <div className="w-full max-w-5xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Scenario text if available */}
            {content.scenario && (
                <div
                    className="bg-white rounded-[2.5rem] shadow-sm mb-4 p-4 text-center"
                    style={{ background: 'var(--lp-indigo-soft)', borderColor: 'var(--lp-indigo)' }}
                >
                    <p className="lp-display text-base" style={{ color: 'var(--lp-indigo-ink)' }}>{content.scenario}</p>
                </div>
            )}

            {/* Options */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {options.map((option: any) => {
                    const isSelected = selected === option.id;
                    const isNotSelected = selected && selected !== option.id;
                    const benefits = option.benefits || [];
                    const title = pickText(option, ['title', 'text', 'name', 'label']);
                    const description = option.description || '';
                    const icon = option.icon || '💡';

                    return (
                        <button
                            key={option.id}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => handleSelect(option.id)}
                            className={cn(
                                "lp-token lp-option p-6 text-left relative overflow-hidden",
                                "animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both",
                                isSelected && "lp-option--emerald is-selected",
                                isNotSelected && "lp-option--coral is-dimmed lp-token--locked",
                                !selected && "lp-option--indigo"
                            )}
                        >
                            <h3 className="lp-display text-xl mb-3" style={{ color: 'var(--lp-ink)' }}>
                                {title}
                            </h3>

                            {hasRichData && description && (
                                <div className="space-y-2 mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl">{icon}</span>
                                        <span className="text-sm" style={{ color: 'var(--lp-muted)' }}>
                                            {description}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {hasRichData && benefits.length > 0 && (
                                <div className="space-y-2">
                                    <div className="lp-display text-sm" style={{ color: 'var(--lp-emerald-ink)' }}>
                                        ✅ {t('opportunity_cost.benefits', { defaultValue: 'Beneficios' })}:
                                    </div>
                                    <ul className="text-xs space-y-1 ml-4" style={{ color: 'var(--lp-muted)' }}>
                                        {benefits.map((benefit: string, idx: number) => (
                                            <li key={idx}>• {benefit}</li>
                                        ))}
                                    </ul>

                                    {isNotSelected && (
                                        <div className="mt-3">
                                            <div className="lp-display text-sm" style={{ color: 'var(--lp-coral-ink)' }}>
                                                ❌ {t('opportunity_cost.sacrificed', { defaultValue: 'Sacrificado' })}:
                                            </div>
                                            <ul className="text-xs space-y-1 ml-4" style={{ color: 'var(--lp-muted)' }}>
                                                {benefits.map((benefit: string, idx: number) => (
                                                    <li key={idx} className="line-through opacity-50">• {benefit}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Analysis (only for rich data) */}
            {showAnalysis && hasRichData && selectedOption && notSelectedOption && (
                <div
                    className="bg-white rounded-[2.5rem] shadow-sm mb-6 p-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
                    style={{ background: 'var(--lp-indigo-soft)', borderColor: 'var(--lp-indigo)' }}
                >
                    <div className="flex items-center gap-3 mb-4">
                        <ArrowLeftRight className="w-6 h-6" style={{ color: 'var(--lp-indigo)' }} />
                        <h3 className="lp-display text-lg" style={{ color: 'var(--lp-indigo-ink)' }}>
                            {t('opportunity_cost.analysis', { defaultValue: 'Análisis' })}
                        </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white rounded-[2.5rem] shadow-sm p-4" style={{ boxShadow: 'none' }}>
                            <div className="lp-display text-sm mb-2" style={{ color: 'var(--lp-emerald-ink)' }}>
                                ✅ {t('opportunity_cost.you_gain', { defaultValue: 'Ganas' })}
                            </div>
                            <ul className="text-xs space-y-1" style={{ color: 'var(--lp-ink)' }}>
                                {(selectedOption.benefits || []).map((benefit: string, idx: number) => (
                                    <li key={idx}>• {benefit}</li>
                                ))}
                            </ul>
                        </div>
                        <div className="bg-white rounded-[2.5rem] shadow-sm p-4" style={{ boxShadow: 'none' }}>
                            <div className="lp-display text-sm mb-2" style={{ color: 'var(--lp-coral-ink)' }}>
                                ❌ {t('opportunity_cost.you_lose', { defaultValue: 'Pierdes' })}
                            </div>
                            <ul className="text-xs space-y-1" style={{ color: 'var(--lp-ink)' }}>
                                {(notSelectedOption.benefits || []).map((benefit: string, idx: number) => (
                                    <li key={idx}>• {benefit}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-center">
                {feedback === 'none' ? (
                    <div className="w-full max-w-md">
                        <QuestButton variant="gold" disabled={!selected} onClick={handleSubmit}>
                            {t('actions.analyze', { defaultValue: 'Analizar' })}
                            <ArrowRight className="w-5 h-5" />
                        </QuestButton>
                    </div>
                ) : (
                    <div className="flex flex-col items-center w-full max-w-md">
                        <p
                            className="lp-display text-lg mb-3"
                            style={{ color: feedback === 'success' ? 'var(--lp-emerald)' : 'var(--lp-coral)' }}
                        >
                            {feedback === 'success' ? t('feedback.success', { defaultValue: '¡Correcto!' }) : t('feedback.error', { defaultValue: 'Inténtalo de nuevo' })}
                        </p>
                        <QuestButton variant={feedback === 'success' ? 'go' : 'retry'} onClick={handleContinue}>
                            {t('actions.continue', { defaultValue: 'Continuar' })}
                            {feedback === 'success' ? <ArrowRight className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
                        </QuestButton>
                    </div>
                )}
            </div>
        </div>
    );
};
