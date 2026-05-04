import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, Briefcase, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

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

export const SalaryComparison = ({ exercise, onSubmit, onNext, onRetry }: SalaryComparisonProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [selected, setSelected] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');

    // Determine format and normalize data safely
    const content = exercise?.content || {};
    const isLegacy = Array.isArray(content.offers) && content.offers.length > 0;
    const isNewFormat = content.optionA && content.optionB;

    // Normalize offers for unified rendering
    let offers: any[] = [];
    let factors: string[] = ['salary', 'benefits', 'location', 'growth'];

    if (isLegacy) {
        offers = content.offers;
        factors = content.factors || factors;
    } else if (isNewFormat) {
        offers = [
            {
                id: content.optionA.id || 'A',
                company: content.optionA.name || '',
                description: normalizeDescription(content.optionA.details),
            },
            {
                id: content.optionB.id || 'B',
                company: content.optionB.name || '',
                description: normalizeDescription(content.optionB.details),
            },
        ];
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
    if (!isLegacy && !isNewFormat) {
        return (
            <div className={cn(
                "w-full max-w-5xl animate-in fade-in slide-in-from-bottom-4 duration-500",
                "flex flex-col items-center justify-center py-12 text-center"
            )}>
                <AlertCircle className="w-12 h-12 text-slate-400 mb-4" />
                <p className="text-lg font-medium text-slate-600 dark:text-slate-400">
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
                        <p className="text-base text-slate-700 dark:text-slate-300">
                            {content.scenario}
                        </p>
                    )}
                    {content.question && (
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">
                            {content.question}
                        </h2>
                    )}
                    {content.instruction && (
                        <p className="text-sm text-slate-500 dark:text-slate-400">
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
                {offers.map((offer: any) => {
                    const score = calculateScore(offer);
                    const isSelected = selected === offer.id;

                    return (
                        <button
                            key={offer.id}
                            onClick={() => handleSelect(offer.id)}
                            className={cn(
                                "p-6 rounded-2xl border-2 transition-all text-left",
                                isSelected
                                    ? "bg-blue-100 dark:bg-blue-950 border-blue-500 scale-105 shadow-xl"
                                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-300"
                            )}
                        >
                            <div className="flex items-center gap-2 mb-4">
                                <Briefcase className="w-5 h-5 text-blue-600" />
                                <h3 className="text-lg font-black text-slate-800 dark:text-slate-200">
                                    {offer.company}
                                </h3>
                            </div>

                            {isLegacy ? (
                                <div className="space-y-2 mb-4">
                                    <div className="flex justify-between">
                                        <span className="text-sm text-slate-600 dark:text-slate-400">
                                            {t('salary_comparison.salary', { defaultValue: 'Salary' })}
                                        </span>
                                        <span className="font-bold text-green-600">
                                            ${offer.salary.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-slate-600 dark:text-slate-400">
                                            {t('salary_comparison.benefits', { defaultValue: 'Benefits' })}
                                        </span>
                                        <span className="font-bold">{offer.benefits}/10</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-slate-600 dark:text-slate-400">
                                            {t('salary_comparison.location', { defaultValue: 'Location' })}
                                        </span>
                                        <span className="font-bold">{offer.location}/10</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-slate-600 dark:text-slate-400">
                                            {t('salary_comparison.growth', { defaultValue: 'Growth' })}
                                        </span>
                                        <span className="font-bold">{offer.growth}/10</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="mb-4">
                                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                                        {offer.description}
                                    </p>
                                </div>
                            )}

                            {isLegacy && (
                                <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-slate-600 dark:text-slate-400">
                                            {t('salary_comparison.score', { defaultValue: 'Score' })}
                                        </span>
                                        <span className="text-xl font-black text-blue-600">
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
                    <Button
                        onClick={handleSubmit}
                        disabled={!selected}
                        className="relative overflow-hidden w-full max-w-md h-12 text-base font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-[0_4px_0_rgb(29,78,216)] hover:shadow-[0_2px_0_rgb(29,78,216)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all disabled:opacity-50"
                    >
                        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                        <span className="relative flex items-center justify-center">
                            {t('actions.select_offer', { defaultValue: 'Select Offer' })}
                            <ArrowRight className="ml-2 w-5 h-5" />
                        </span>
                    </Button>
                ) : (
                    <div className="flex flex-col items-center w-full">
                        <p className={cn("font-bold text-lg mb-3", feedback === 'success' ? "text-green-500" : "text-red-500")}>
                            {feedback === 'success'
                                ? t('feedback.success', { defaultValue: 'Great job!' })
                                : t('feedback.error', { defaultValue: 'Not quite right.' })}
                        </p>
                        <Button
                            onClick={handleContinue}
                            className="relative overflow-hidden w-full max-w-md h-12 text-base font-bold bg-green-500 hover:bg-green-600 text-white rounded-2xl shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all"
                        >
                            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                            <span className="relative flex items-center justify-center">
                                {t('actions.continue', { defaultValue: 'Continue' })}
                                <ArrowRight className="ml-2 w-5 h-5" />
                            </span>
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};
