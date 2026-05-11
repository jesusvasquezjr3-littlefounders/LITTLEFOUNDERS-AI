import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, Users, DollarSign } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

interface BillSplitterProps {
    exercise: any;
    onSubmit: (splits: Record<string, number>) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const BillSplitter = ({ exercise, onSubmit, onNext, onRetry }: BillSplitterProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [mode, setMode] = useState<'equitable' | 'proportional'>('equitable');
    const [assignments, setAssignments] = useState<Record<string, string[]>>({});
    const [tip, setTip] = useState(15);
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');

    const people = exercise.content.people || [];
    const items = exercise.content.items || [];
    const total = items.reduce((sum: number, item: any) => sum + item.price, 0);
    const tipAmount = (total * tip) / 100;
    const grandTotal = total + tipAmount;

    useEffect(() => {
        // Initialize assignments
        const init: Record<string, string[]> = {};
        people.forEach((person: any) => {
            init[person.id] = [];
        });
        setAssignments(init);
        setFeedback('none');
    }, [exercise]);

    const toggleItemAssignment = (personId: string, itemId: string) => {
        setAssignments(prev => {
            const current = prev[personId] || [];
            const newAssignments = { ...prev };

            if (current.includes(itemId)) {
                newAssignments[personId] = current.filter(id => id !== itemId);
            } else {
                newAssignments[personId] = [...current, itemId];
            }

            return newAssignments;
        });
        playSound('ui_tap');
    };

    const calculateSplits = (): Record<string, number> => {
        const splits: Record<string, number> = {};

        if (mode === 'equitable') {
            const perPerson = people.length > 0 ? grandTotal / people.length : 0;
            people.forEach((person: any) => {
                splits[person.id] = perPerson;
            });
        } else {
            // Proportional based on items consumed
            people.forEach((person: any) => {
                const personItems = assignments[person.id] || [];
                const personSubtotal = personItems.reduce((sum, itemId) => {
                    const item = items.find((i: any) => i.id === itemId);
                    return sum + (item?.price || 0);
                }, 0);
                const personTip = (personSubtotal / total) * tipAmount;
                splits[person.id] = personSubtotal + personTip;
            });
        }

        return splits;
    };

    const splits = calculateSplits();

    const handleSubmit = () => {
        if (mode === 'proportional') {
            // Check if all items are assigned
            const allAssigned = items.every((item: any) =>
                Object.values(assignments).some((itemIds: any) => itemIds.includes(item.id))
            );

            if (!allAssigned) {
                playSound('ui_tap');
                return;
            }
        }

        // Delegate validation to useLessonState via onSubmit (single source of truth)
        const isCorrect = onSubmit(splits);
        setFeedback(isCorrect ? 'success' : 'error');
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            setAssignments(() => {
                const init: Record<string, string[]> = {};
                people.forEach((person: any) => {
                    init[person.id] = [];
                });
                return init;
            });
            setFeedback('none');
            onRetry();
        }
    };

    return (
        <div className="w-full max-w-4xl animate-slide-in-bottom">
            {/* Mode Toggle */}
            <div className="mb-6 flex justify-center gap-3">
                <Button
                    onClick={() => {
                        setMode('equitable');
                        playSound('ui_tap');
                    }}
                    className={cn(
                        "px-6 py-3 rounded-xl font-bold transition-all",
                        mode === 'equitable'
                            ? "bg-blue-600 text-white shadow-lg scale-105"
                            : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                    )}
                >
                    <Users className="w-4 h-4 mr-2" />
                    {t('bill_splitter.equitable')}
                </Button>
                <Button
                    onClick={() => {
                        setMode('proportional');
                        playSound('ui_tap');
                    }}
                    className={cn(
                        "px-6 py-3 rounded-xl font-bold transition-all",
                        mode === 'proportional'
                            ? "bg-green-600 text-white shadow-lg scale-105"
                            : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                    )}
                >
                    <DollarSign className="w-4 h-4 mr-2" />
                    {t('bill_splitter.proportional')}
                </Button>
            </div>

            {/* Items List (only in proportional mode) */}
            {mode === 'proportional' && (
                <div className="mb-6 bg-card border-2 border-border shadow-sm rounded-2xl p-4">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">
                        {t('bill_splitter.assign_items')}
                    </h3>
                    <div className="space-y-2">
                        {items.map((item: any) => (
                            <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                                <div className="flex-1">
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{item.name}</span>
                                    <span className="ml-2 text-sm text-slate-600 dark:text-slate-400">
                                        ${item.price.toFixed(2)}
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    {people.map((person: any) => (
                                        <button
                                            key={person.id}
                                            onClick={() => toggleItemAssignment(person.id, item.id)}
                                            className={cn(
                                                "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                                                assignments[person.id]?.includes(item.id)
                                                    ? "bg-green-600 text-white"
                                                    : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                                            )}
                                        >
                                            {person.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tip Slider */}
            <div className="mb-6 bg-white dark:bg-slate-800 rounded-2xl p-4 border-2 border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                        {t('bill_splitter.tip')}
                    </label>
                    <span className="text-lg font-black text-green-600 dark:text-green-400">
                        {tip}% (${tipAmount.toFixed(2)})
                    </span>
                </div>
                <input
                    type="range"
                    min="0"
                    max="30"
                    step="5"
                    value={tip}
                    onChange={(e) => {
                        setTip(Number(e.target.value));
                        playSound('ui_tap');
                    }}
                    className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-green-600"
                    aria-label={t('bill_splitter.tip')}
                    aria-valuemin={0}
                    aria-valuemax={30}
                    aria-valuenow={tip}
                />
            </div>

            {/* Results */}
            <div className="mb-6 bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-500 dark:border-blue-700 rounded-2xl p-6 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {people.map((person: any) => (
                        <div key={person.id} className="bg-white dark:bg-slate-800 rounded-xl p-4">
                            <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                                {person.name}
                            </div>
                            <div className="text-2xl font-black text-blue-900 dark:text-blue-100">
                                ${splits[person.id]?.toFixed(2) || '0.00'}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-4 pt-4 border-t-2 border-blue-300 dark:border-blue-700 text-center">
                    <div className="text-xs text-blue-800 dark:text-blue-200 mb-1">
                        {t('bill_splitter.total')}
                    </div>
                    <div className="text-3xl font-black text-blue-900 dark:text-blue-100">
                        ${grandTotal.toFixed(2)}
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center">
                {feedback === 'none' ? (
                    <Button
                        onClick={handleSubmit}
                        className="w-full max-w-md h-14 sm:h-16 text-lg sm:text-xl font-bold bg-green-500 hover:bg-green-600 text-white rounded-2xl shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all flex items-center justify-center gap-2"
                    >
                        {t('actions.split_bill')}
                        <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
                    </Button>
                ) : (
                    <div className="flex flex-col items-center w-full">
                        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-300 dark:border-blue-700 rounded-xl">
                            <p className="text-sm text-blue-900 dark:text-blue-100 text-center">
                                {mode === 'equitable'
                                    ? t('bill_splitter.feedback_equitable')
                                    : t('bill_splitter.feedback_proportional')}
                            </p>
                        </div>

                        <Button
                            onClick={handleContinue}
                            className={cn(
                                "w-full max-w-md h-14 sm:h-16 text-lg sm:text-xl font-bold rounded-2xl transition-all flex items-center justify-center gap-2",
                                feedback === 'success'
                                    ? "bg-green-500 hover:bg-green-600 text-white shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)] active:shadow-none active:translate-y-[4px]"
                                    : "bg-orange-500 hover:bg-orange-600 text-white shadow-[0_4px_0_rgb(194,65,12)] hover:shadow-[0_2px_0_rgb(194,65,12)] active:shadow-none active:translate-y-[4px]",
                                "hover:-translate-y-[2px]"
                            )}
                        >
                            {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                            <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};
