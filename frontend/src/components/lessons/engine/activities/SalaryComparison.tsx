import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, Briefcase } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

interface SalaryComparisonProps {
    exercise: any;
    onSubmit: (selectedId: string) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const SalaryComparison = ({ exercise, onSubmit, onNext, onRetry }: SalaryComparisonProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [selected, setSelected] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');

    const offers = exercise.content.offers || [];
    const factors = exercise.content.factors || ['salary', 'benefits', 'location', 'growth'];

    useEffect(() => {
        setSelected(null);
        setFeedback('none');
    }, [exercise]);

    const calculateScore = (offer: any): number => {
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

    return (
        <div className="w-full max-w-5xl animate-slide-in-bottom">
            {/* Offers Grid */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

                            <div className="space-y-2 mb-4">
                                <div className="flex justify-between">
                                    <span className="text-sm text-slate-600 dark:text-slate-400">
                                        {t('salary_comparison.salary')}
                                    </span>
                                    <span className="font-bold text-green-600">
                                        ${offer.salary.toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-slate-600 dark:text-slate-400">
                                        {t('salary_comparison.benefits')}
                                    </span>
                                    <span className="font-bold">{offer.benefits}/10</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-slate-600 dark:text-slate-400">
                                        {t('salary_comparison.location')}
                                    </span>
                                    <span className="font-bold">{offer.location}/10</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-slate-600 dark:text-slate-400">
                                        {t('salary_comparison.growth')}
                                    </span>
                                    <span className="font-bold">{offer.growth}/10</span>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-slate-600 dark:text-slate-400">
                                        {t('salary_comparison.score')}
                                    </span>
                                    <span className="text-xl font-black text-blue-600">
                                        {score.toFixed(1)}
                                    </span>
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
                        disabled={!selected}
                        className="w-full max-w-md h-12 text-base font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-[0_4px_0_rgb(29,78,216)] hover:shadow-[0_2px_0_rgb(29,78,216)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all disabled:opacity-50"
                    >
                        {t('actions.select_offer')}
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
