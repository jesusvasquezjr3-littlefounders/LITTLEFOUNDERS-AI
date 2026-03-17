import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, Wallet, ShoppingCart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

interface BudgetBuilderProps {
    exercise: any;
    onSubmit: (allocation: Record<string, string>) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const BudgetBuilder = ({ exercise, onSubmit, onNext, onRetry }: BudgetBuilderProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [allocation, setAllocation] = useState<Record<string, string>>({});
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');

    useEffect(() => {
        setAllocation({});
        setFeedback('none');
    }, [exercise]);

    const items = exercise.content.items || [];
    const budget = exercise.content.budget || 100;
    const categories = exercise.content.categories || ['needs', 'wants'];

    const handleDragStart = (e: React.DragEvent, itemId: string) => {
        e.dataTransfer.setData('itemId', itemId);
        playSound('ui_tap');
    };

    const handleDrop = (e: React.DragEvent, category: string) => {
        e.preventDefault();
        const itemId = e.dataTransfer.getData('itemId');

        if (itemId && feedback === 'none') {
            playSound('ui_tap');
            setAllocation(prev => ({
                ...prev,
                [itemId]: category
            }));
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleCheck = () => {
        // Check if all items are allocated
        const allAllocated = items.every((item: any) => allocation[item.id]);
        if (!allAllocated) {
            playSound('ui_tap');
            return;
        }

        // Delegate validation to useLessonState via onSubmit (single source of truth)
        const isCorrect = onSubmit(allocation);
        setFeedback(isCorrect ? 'success' : 'error');
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            setAllocation({});
            setFeedback('none');
            onRetry();
        }
    };

    const getCategoryItems = (category: string) => {
        return items.filter((item: any) => allocation[item.id] === category);
    };

    const unallocatedItems = items.filter((item: any) => !allocation[item.id]);

    const totalSpent = items
        .filter((item: any) => allocation[item.id])
        .reduce((sum: number, item: any) => sum + (item.cost || 0), 0);

    return (
        <div className="w-full max-w-4xl animate-slide-in-bottom">

            {/* Budget Display */}
            <div className="mb-6 text-center">
                <div className="inline-flex flex-col items-center bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-2xl px-6 py-4 shadow-xl">
                    <span className="text-xs font-medium opacity-90 mb-1">{t('budget_builder.total_budget')}</span>
                    <div className="text-3xl font-black">${budget}</div>
                    <span className="text-xs opacity-80 mt-1">
                        {t('budget_builder.spent')}: ${totalSpent}
                    </span>
                </div>
            </div>

            {/* Unallocated Items */}
            {unallocatedItems.length > 0 && (
                <div className="mb-6">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 text-center">
                        {t('budget_builder.drag_items')}
                    </h3>
                    <div className="flex flex-wrap gap-2 justify-center">
                        {unallocatedItems.map((item: any) => (
                            <div
                                key={item.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, item.id)}
                                className="bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-xl p-3 cursor-move hover:shadow-lg transition-all hover:-translate-y-1"
                            >
                                <div className="text-center">
                                    <div className="text-2xl mb-1">{item.icon || '📦'}</div>
                                    <div className="text-xs font-bold text-slate-800 dark:text-slate-100">{item.name}</div>
                                    <div className="text-xs text-green-600 dark:text-green-400 font-bold">${item.cost}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Categories */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                {categories.map((category: string) => {
                    const categoryItems = getCategoryItems(category);
                    const categoryTotal = categoryItems.reduce((sum: number, item: any) => sum + (item.cost || 0), 0);

                    return (
                        <div
                            key={category}
                            onDrop={(e) => handleDrop(e, category)}
                            onDragOver={handleDragOver}
                            className={cn(
                                "min-h-[200px] p-4 rounded-2xl border-2 border-dashed transition-all",
                                category === 'needs' && "border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/30",
                                category === 'wants' && "border-purple-400 dark:border-purple-600 bg-purple-50 dark:bg-purple-950/30",
                                feedback === 'none' && "hover:border-solid hover:shadow-lg"
                            )}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    {category === 'needs' && <Wallet className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
                                    {category === 'wants' && <ShoppingCart className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
                                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                                        {t(`budget_builder.${category}`)}
                                    </h3>
                                </div>
                                <span className="text-sm font-bold text-slate-600 dark:text-slate-400">
                                    ${categoryTotal}
                                </span>
                            </div>

                            <div className="space-y-2">
                                {categoryItems.map((item: any) => (
                                    <div
                                        key={item.id}
                                        className="bg-white dark:bg-slate-800 rounded-lg p-2 shadow-sm"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg">{item.icon || '📦'}</span>
                                                <span className="text-xs font-medium text-slate-800 dark:text-slate-100">
                                                    {item.name}
                                                </span>
                                            </div>
                                            <span className="text-xs font-bold text-green-600 dark:text-green-400">
                                                ${item.cost}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {categoryItems.length === 0 && (
                                <div className="flex items-center justify-center h-32 text-slate-400 dark:text-slate-600 text-sm">
                                    {t('budget_builder.drop_here')}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center">
                {feedback === 'none' ? (
                    <Button
                        onClick={handleCheck}
                        disabled={unallocatedItems.length > 0}
                        className="relative overflow-hidden w-full max-w-md h-12 text-base font-bold bg-green-600 hover:bg-green-700 text-white rounded-2xl shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all disabled:opacity-50 disabled:shadow-none"
                    >
                        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                        <span className="relative flex items-center justify-center">{t('actions.verify')}</span>
                    </Button>
                ) : (
                    <div className="flex flex-col items-center w-full">
                        <p className={cn("font-bold text-lg mb-3", feedback === 'success' ? "text-green-500" : "text-orange-500")}>
                            {feedback === 'success' ? t('status.correct') : t('status.incorrect')}
                        </p>
                        <Button
                            onClick={handleContinue}
                            className={cn(
                                "relative overflow-hidden w-full max-w-md h-12 text-base font-bold rounded-2xl transition-all",
                                feedback === 'success'
                                    ? "bg-green-500 hover:bg-green-600 text-white shadow-[0_4px_0_rgb(22,101,52)]"
                                    : "bg-orange-500 hover:bg-orange-600 text-white shadow-[0_4px_0_rgb(194,65,12)]",
                                "hover:translate-y-[2px] active:translate-y-1 active:shadow-none"
                            )}
                        >
                            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                            <span className="relative flex items-center justify-center">
                                {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                                <ArrowRight className="ml-2 w-5 h-5" />
                            </span>
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};
