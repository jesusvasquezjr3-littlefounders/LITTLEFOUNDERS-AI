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

    const options = exercise.content.options || [];

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

    const selectedOption = options.find((opt: any) => opt.id === selected);
    const notSelectedOption = options.find((opt: any) => opt.id !== selected);

    return (
        <div className="w-full max-w-5xl animate-slide-in-bottom">
            {/* Options */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {options.map((option: any) => {
                    const isSelected = selected === option.id;
                    const isNotSelected = selected && selected !== option.id;

                    return (
                        <button
                            key={option.id}
                            onClick={() => handleSelect(option.id)}
                            disabled={feedback === 'success'}
                            className={cn(
                                "p-6 rounded-2xl border-2 transition-all text-left relative overflow-hidden",
                                isSelected && "bg-green-100 dark:bg-green-950 border-green-500 scale-105 shadow-xl",
                                isNotSelected && "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800 opacity-50",
                                !selected && "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-green-300"
                            )}
                        >
                            {isNotSelected && (
                                <div className="absolute inset-0 bg-gradient-to-br from-transparent to-red-500/20 animate-pulse"></div>
                            )}

                            <h3 className="text-xl font-black text-slate-800 dark:text-slate-200 mb-3">
                                {option.title}
                            </h3>

                            <div className="space-y-2 mb-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl">{option.icon}</span>
                                    <span className="text-sm text-slate-600 dark:text-slate-400">
                                        {option.description}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="text-sm font-bold text-green-600">
                                    ✅ {t('opportunity_cost.benefits')}:
                                </div>
                                <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1 ml-4">
                                    {option.benefits.map((benefit: string, idx: number) => (
                                        <li key={idx}>• {benefit}</li>
                                    ))}
                                </ul>

                                {isNotSelected && (
                                    <div className="mt-3">
                                        <div className="text-sm font-bold text-red-600">
                                            ❌ {t('opportunity_cost.sacrificed')}:
                                        </div>
                                        <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1 ml-4">
                                            {option.benefits.map((benefit: string, idx: number) => (
                                                <li key={idx} className="line-through opacity-50">• {benefit}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Analysis */}
            {showAnalysis && selectedOption && notSelectedOption && (
                <div className="mb-6 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-950/30 dark:to-purple-950/30 border-2 border-blue-500 dark:border-blue-700 rounded-2xl p-6 animate-slide-in-bottom">
                    <div className="flex items-center gap-3 mb-4">
                        <ArrowLeftRight className="w-6 h-6 text-blue-600" />
                        <h3 className="text-lg font-black text-blue-900 dark:text-blue-100">
                            {t('opportunity_cost.analysis')}
                        </h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-slate-800 rounded-xl p-4">
                            <div className="text-sm font-bold text-green-600 mb-2">
                                ✅ {t('opportunity_cost.you_gain')}
                            </div>
                            <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1">
                                {selectedOption.benefits.map((benefit: string, idx: number) => (
                                    <li key={idx}>• {benefit}</li>
                                ))}
                            </ul>
                        </div>
                        <div className="bg-white dark:bg-slate-800 rounded-xl p-4">
                            <div className="text-sm font-bold text-red-600 mb-2">
                                ❌ {t('opportunity_cost.you_lose')}
                            </div>
                            <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1">
                                {notSelectedOption.benefits.map((benefit: string, idx: number) => (
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
                        className="w-full max-w-md h-12 text-base font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-2xl shadow-[0_4px_0_rgb(107,33,168)] hover:shadow-[0_2px_0_rgb(107,33,168)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all disabled:opacity-50"
                    >
                        {t('actions.analyze')}
                        <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                ) : (
                    <div className="flex flex-col items-center w-full">
                        <p className="font-bold text-lg mb-3 text-green-500">
                            {t('feedback.success')}
                        </p>
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
