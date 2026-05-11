import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, ArrowLeftRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

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
    const options = content.options || [];

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
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl text-center">
                    <p className="text-sm text-blue-800 dark:text-blue-200">{content.scenario}</p>
                </div>
            )}

            {/* Options */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {options.map((option: any) => {
                    const isSelected = selected === option.id;
                    const isNotSelected = selected && selected !== option.id;
                    const benefits = option.benefits || [];
                    const title = option.title || option.text || '';
                    const description = option.description || '';
                    const icon = option.icon || '💡';

                    return (
                        <div
                            key={option.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleSelect(option.id)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelect(option.id); }}
                            className={cn(
                                "p-6 rounded-2xl border-2 transition-all text-left relative overflow-hidden cursor-pointer",
                                isSelected && "bg-green-100 dark:bg-green-950 border-green-500 scale-105 shadow-[0_4px_0_rgb(34,197,94)]",
                                isNotSelected && "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800 opacity-50",
                                !selected && "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-green-300 hover:shadow-sm hover:-translate-y-1"
                            )}
                        >
                            {isNotSelected && (
                                <div className="absolute inset-0 bg-red-500/10 animate-pulse"></div>
                            )}

                            <h3 className="text-xl font-black text-slate-800 dark:text-slate-200 mb-3">
                                {title}
                            </h3>

                            {hasRichData && description && (
                                <div className="space-y-2 mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl">{icon}</span>
                                        <span className="text-sm text-slate-600 dark:text-slate-400">
                                            {description}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {hasRichData && benefits.length > 0 && (
                                <div className="space-y-2">
                                    <div className="text-sm font-bold text-green-600">
                                        ✅ {t('opportunity_cost.benefits', { defaultValue: 'Beneficios' })}:
                                    </div>
                                    <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1 ml-4">
                                        {benefits.map((benefit: string, idx: number) => (
                                            <li key={idx}>• {benefit}</li>
                                        ))}
                                    </ul>

                                    {isNotSelected && (
                                        <div className="mt-3">
                                            <div className="text-sm font-bold text-red-600">
                                                ❌ {t('opportunity_cost.sacrificed', { defaultValue: 'Sacrificado' })}:
                                            </div>
                                            <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1 ml-4">
                                                {benefits.map((benefit: string, idx: number) => (
                                                    <li key={idx} className="line-through opacity-50">• {benefit}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Analysis (only for rich data) */}
            {showAnalysis && hasRichData && selectedOption && notSelectedOption && (
                <div className="mb-6 bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-500 dark:border-blue-700 rounded-2xl p-6 animate-in fade-in slide-in-from-bottom-4 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <ArrowLeftRight className="w-6 h-6 text-blue-600" />
                        <h3 className="text-lg font-black text-blue-900 dark:text-blue-100">
                            {t('opportunity_cost.analysis', { defaultValue: 'Análisis' })}
                        </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-slate-800 rounded-xl p-4">
                            <div className="text-sm font-bold text-green-600 mb-2">
                                ✅ {t('opportunity_cost.you_gain', { defaultValue: 'Ganas' })}
                            </div>
                            <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1">
                                {(selectedOption.benefits || []).map((benefit: string, idx: number) => (
                                    <li key={idx}>• {benefit}</li>
                                ))}
                            </ul>
                        </div>
                        <div className="bg-white dark:bg-slate-800 rounded-xl p-4">
                            <div className="text-sm font-bold text-red-600 mb-2">
                                ❌ {t('opportunity_cost.you_lose', { defaultValue: 'Pierdes' })}
                            </div>
                            <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1">
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
                    <Button
                        onClick={handleSubmit}
                        disabled={!selected}
                        className="w-full max-w-md h-14 sm:h-16 text-lg sm:text-xl font-bold bg-purple-500 hover:bg-purple-600 text-white rounded-2xl shadow-[0_4px_0_rgb(107,33,168)] hover:shadow-[0_2px_0_rgb(107,33,168)] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {t('actions.analyze', { defaultValue: 'Analizar' })}
                        <ArrowRight className="w-5 h-5" />
                    </Button>
                ) : (
                    <div className="flex flex-col items-center w-full">
                        <p className={cn("font-bold text-lg mb-3", feedback === 'success' ? "text-green-500" : "text-red-500")}>
                            {feedback === 'success' ? t('feedback.success', { defaultValue: '¡Correcto!' }) : t('feedback.error', { defaultValue: 'Inténtalo de nuevo' })}
                        </p>
                        <Button
                            onClick={handleContinue}
                            className="w-full max-w-md h-14 sm:h-16 text-lg sm:text-xl font-bold bg-green-500 hover:bg-green-600 text-white rounded-2xl shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all flex items-center justify-center gap-2"
                        >
                            {t('actions.continue', { defaultValue: 'Continuar' })}
                            <ArrowRight className="w-5 h-5" />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};
