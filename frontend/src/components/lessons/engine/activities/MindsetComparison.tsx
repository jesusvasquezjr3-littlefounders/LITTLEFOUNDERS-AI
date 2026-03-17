import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, Brain } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

interface MindsetComparisonProps {
    exercise: any;
    onSubmit: (mindset: string) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const MindsetComparison = ({ exercise, onSubmit, onNext, onRetry }: MindsetComparisonProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [selectedMindset, setSelectedMindset] = useState<'scarcity' | 'abundance' | null>(null);
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');

    const scenario = exercise.content.scenario || {};
    const scarcityResponse = exercise.content.scarcity || {};
    const abundanceResponse = exercise.content.abundance || {};

    useEffect(() => {
        setSelectedMindset(null);
        setFeedback('none');
    }, [exercise]);

    const handleSelect = (mindset: 'scarcity' | 'abundance') => {
        setSelectedMindset(mindset);
        playSound('ui_tap');
    };

    const handleSubmit = () => {
        if (!selectedMindset) return;

        const isCorrect = onSubmit(selectedMindset);
        setFeedback(isCorrect ? 'success' : 'error');
    };

    return (
        <div className="w-full max-w-5xl animate-slide-in-bottom">
            {/* Scenario */}
            <div className="mb-6 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-950/30 dark:to-purple-950/30 border-2 border-blue-500 dark:border-blue-700 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-3">
                    <Brain className="w-6 h-6 text-blue-600" />
                    <h3 className="text-lg font-black text-blue-900 dark:text-blue-100">
                        {t('mindset_comparison.scenario')}
                    </h3>
                </div>
                <p className="text-slate-700 dark:text-slate-300">
                    {scenario.description}
                </p>
            </div>

            {/* Mindset Comparison */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Scarcity Mindset */}
                <button
                    onClick={() => handleSelect('scarcity')}
                    disabled={feedback === 'success'}
                    className={cn(
                        "p-6 rounded-2xl border-2 transition-all text-left relative overflow-hidden",
                        selectedMindset === 'scarcity' && "bg-red-100 dark:bg-red-950 border-red-500 scale-105 shadow-xl",
                        selectedMindset === 'abundance' && "opacity-50",
                        !selectedMindset && "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-red-300"
                    )}
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full -mr-16 -mt-16"></div>

                    <div className="relative">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-3xl">😰</span>
                            <h3 className="text-xl font-black text-red-700 dark:text-red-400">
                                {t('mindset_comparison.scarcity')}
                            </h3>
                        </div>

                        <div className="mb-4">
                            <div className="text-sm font-bold text-red-600 mb-2">
                                {t('mindset_comparison.response')}:
                            </div>
                            <p className="text-sm text-slate-700 dark:text-slate-300 italic">
                                "{scarcityResponse.thought}"
                            </p>
                        </div>

                        <div className="mb-4">
                            <div className="text-sm font-bold text-red-600 mb-2">
                                {t('mindset_comparison.consequences')}:
                            </div>
                            <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                                {scarcityResponse.consequences?.map((consequence: string, idx: number) => (
                                    <li key={idx}>❌ {consequence}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </button>

                {/* Abundance Mindset */}
                <button
                    onClick={() => handleSelect('abundance')}
                    disabled={feedback === 'success'}
                    className={cn(
                        "p-6 rounded-2xl border-2 transition-all text-left relative overflow-hidden",
                        selectedMindset === 'abundance' && "bg-green-100 dark:bg-green-950 border-green-500 scale-105 shadow-xl",
                        selectedMindset === 'scarcity' && "opacity-50",
                        !selectedMindset && "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-green-300"
                    )}
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full -mr-16 -mt-16"></div>

                    <div className="relative">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-3xl">😊</span>
                            <h3 className="text-xl font-black text-green-700 dark:text-green-400">
                                {t('mindset_comparison.abundance')}
                            </h3>
                        </div>

                        <div className="mb-4">
                            <div className="text-sm font-bold text-green-600 mb-2">
                                {t('mindset_comparison.response')}:
                            </div>
                            <p className="text-sm text-slate-700 dark:text-slate-300 italic">
                                "{abundanceResponse.thought}"
                            </p>
                        </div>

                        <div className="mb-4">
                            <div className="text-sm font-bold text-green-600 mb-2">
                                {t('mindset_comparison.consequences')}:
                            </div>
                            <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                                {abundanceResponse.consequences?.map((consequence: string, idx: number) => (
                                    <li key={idx}>✅ {consequence}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </button>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center">
                {feedback === 'none' ? (
                    <Button
                        onClick={handleSubmit}
                        disabled={!selectedMindset}
                        className="relative overflow-hidden w-full max-w-md h-12 text-base font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-2xl shadow-[0_4px_0_rgb(107,33,168)] hover:shadow-[0_2px_0_rgb(107,33,168)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all disabled:opacity-50"
                    >
                        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                        <span className="relative flex items-center justify-center">
                            {t('actions.compare')}
                            <ArrowRight className="ml-2 w-5 h-5" />
                        </span>
                    </Button>
                ) : (
                    <div className="flex flex-col items-center w-full">
                        <div className="mb-4 p-4 bg-purple-50 dark:bg-purple-950/30 border-2 border-purple-300 dark:border-purple-700 rounded-xl max-w-2xl">
                            <p className="text-sm text-purple-900 dark:text-purple-100 text-center">
                                {selectedMindset === 'abundance'
                                    ? t('mindset_comparison.feedback_abundance')
                                    : t('mindset_comparison.feedback_scarcity')}
                            </p>
                        </div>

                        <Button
                            onClick={onNext}
                            className="relative overflow-hidden w-full max-w-md h-12 text-base font-bold bg-green-500 hover:bg-green-600 text-white rounded-2xl shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all"
                        >
                            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                            <span className="relative flex items-center justify-center">
                                {t('actions.continue')}
                                <ArrowRight className="ml-2 w-5 h-5" />
                            </span>
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};
