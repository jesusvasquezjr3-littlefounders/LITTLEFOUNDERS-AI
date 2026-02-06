import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

interface ClassificationProps {
    exercise: any;
    onSubmit: (classifications: Record<string, string>) => void;
    onNext: () => void;
    onRetry: () => void;
}

export const Classification = ({ exercise, onSubmit, onNext, onRetry }: ClassificationProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [selectedClassifications, setSelectedClassifications] = useState<Record<string, string>>({});
    const [isChecked, setIsChecked] = useState(false);
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');
    const [shuffledItems, setShuffledItems] = useState<any[]>([]);

    useEffect(() => {
        setSelectedClassifications({});
        setIsChecked(false);
        setFeedback('none');

        if (exercise?.content?.items) {
            const items = [...exercise.content.items];
            for (let i = items.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [items[i], items[j]] = [items[j], items[i]];
            }
            setShuffledItems(items);
        }
    }, [exercise]);

    const handleClassificationClick = (itemId: string, categoryId: string) => {
        if (isChecked) return;
        playSound('ui_tap');
        setSelectedClassifications(prev => ({
            ...prev,
            [itemId]: categoryId
        }));
    };

    const handleCheck = () => {
        const correctClassifications = exercise.correct_answer?.classifications || {};
        const allItems = exercise.content.items || [];

        const isCorrect = allItems.every((item: any) =>
            selectedClassifications[item.id] === correctClassifications[item.id]
        );

        setIsChecked(true);
        setFeedback(isCorrect ? 'success' : 'error');

        // Pass the result to parent and get confirmation
        const result = onSubmit(selectedClassifications);

        // If onSubmit returns a boolean, use that; otherwise use our calculation
        if (typeof result === 'boolean') {
            setFeedback(result ? 'success' : 'error');
        }
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            setSelectedClassifications({});
            setIsChecked(false);
            setFeedback('none');
            onRetry();
        }
    };

    const categories = exercise.content.categories || [];

    return (
        <div className="w-full max-w-2xl animate-slide-in-bottom">
            {/* Categories Header */}
            <div className="flex flex-wrap justify-center gap-4 mb-6">
                {categories.map((category: any, idx: number) => {
                    const categoryColors = [
                        { bg: 'bg-gradient-to-r from-yellow-400 to-orange-400', text: 'text-white', emoji: '🌟' },
                        { bg: 'bg-gradient-to-r from-purple-400 to-pink-400', text: 'text-white', emoji: '💎' },
                        { bg: 'bg-gradient-to-r from-blue-400 to-cyan-400', text: 'text-white', emoji: '🌊' },
                    ];
                    const catColor = categoryColors[idx % categoryColors.length];

                    return (
                        <div
                            key={category.id}
                            className={`${catColor.bg} px-4 py-2 rounded-xl text-center shadow-md min-w-[120px]`}
                        >
                            <span className={`font-bold ${catColor.text} text-lg shadow-sm`}>
                                {catColor.emoji} {category.label}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Items List */}
            <div className="space-y-4 mb-8 max-h-[45vh] overflow-y-auto p-2 custom-scrollbar">
                {shuffledItems.map((item, idx) => {
                    const selectedCategory = selectedClassifications[item.id];

                    // Card colors
                    const cardColors = [
                        'bg-sky-50 dark:bg-sky-900/30 border-sky-200 dark:border-sky-700',
                        'bg-pink-50 dark:bg-pink-900/30 border-pink-200 dark:border-pink-700',
                        'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700',
                        'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700',
                    ];
                    const cardColor = cardColors[idx % cardColors.length];

                    return (
                        <div
                            key={item.id}
                            className={cn(
                                "border-l-4 rounded-r-xl p-4 transition-all duration-200 shadow-sm",
                                cardColor,
                                selectedCategory ? "opacity-100" : "opacity-90"
                            )}
                        >
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                                <span className="font-bold text-lg flex-1 text-center sm:text-left">{item.text}</span>

                                <div className="flex gap-2 flex-wrap justify-center">
                                    {categories.map((cat: any, catIdx: number) => {
                                        const isSelected = selectedCategory === cat.id;

                                        // Button Styles
                                        const btnColors = [
                                            { active: 'bg-yellow-500', inactive: 'bg-white/50 hover:bg-yellow-200 text-yellow-700' },
                                            { active: 'bg-purple-500', inactive: 'bg-white/50 hover:bg-purple-200 text-purple-700' },
                                            { active: 'bg-blue-500', inactive: 'bg-white/50 hover:bg-blue-200 text-blue-700' },
                                        ];
                                        const color = btnColors[catIdx % btnColors.length];

                                        return (
                                            <button
                                                key={cat.id}
                                                onClick={() => handleClassificationClick(item.id, cat.id)}
                                                disabled={isChecked}
                                                className={cn(
                                                    "px-4 py-2 rounded-lg font-bold transition-all duration-200",
                                                    isSelected
                                                        ? `${color.active} text-white shadow-lg scale-105 ring-4 ring-white/50 border-2 border-white/30`
                                                        : `${color.inactive} hover:scale-105 border-2 border-transparent`
                                                )}
                                            >
                                                {cat.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Action Button */}
            {!isChecked ? (
                <Button
                    onClick={handleCheck}
                    disabled={Object.keys(selectedClassifications).length < (exercise.content.items?.length || 0)}
                    className="w-full h-14 text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-2xl shadow-[0_4px_0_rgb(107,33,168)] hover:shadow-[0_2px_0_rgb(107,33,168)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all disabled:opacity-50 disabled:shadow-none disabled:from-gray-400 disabled:to-gray-400"
                >
                    ✨ {t('actions.verify')} ✨
                </Button>
            ) : (
                <Button
                    onClick={handleContinue}
                    className={cn(
                        "w-full h-14 text-lg font-bold rounded-2xl transition-all",
                        feedback === 'success'
                            ? "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-[0_4px_0_rgb(22,101,52)]"
                            : "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-[0_4px_0_rgb(194,65,12)]",
                        "hover:translate-y-[2px] active:translate-y-1 active:shadow-none"
                    )}
                >
                    {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                    <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
            )}
        </div>
    );
};
