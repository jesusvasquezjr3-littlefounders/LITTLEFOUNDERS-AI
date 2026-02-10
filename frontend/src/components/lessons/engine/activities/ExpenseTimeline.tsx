import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, Clock, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

interface ExpenseTimelineProps {
    exercise: any;
    onSubmit: (order: string[]) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const ExpenseTimeline = ({ exercise, onSubmit, onNext, onRetry }: ExpenseTimelineProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [orderedExpenses, setOrderedExpenses] = useState<string[]>([]);
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');

    useEffect(() => {
        setOrderedExpenses([]);
        setFeedback('none');
    }, [exercise]);

    const expenses = exercise.content.expenses || [];

    const handleDragStart = (e: React.DragEvent, expenseId: string) => {
        e.dataTransfer.setData('expenseId', expenseId);
        playSound('ui_tap');
    };

    const handleDrop = (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();
        const expenseId = e.dataTransfer.getData('expenseId');

        if (expenseId && feedback === 'none') {
            playSound('ui_tap');

            // Remove from current position if exists
            const newOrder = orderedExpenses.filter(id => id !== expenseId);

            // Insert at target position
            newOrder.splice(targetIndex, 0, expenseId);
            setOrderedExpenses(newOrder);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleCheck = () => {
        const isCorrect = onSubmit(orderedExpenses);
        setFeedback(isCorrect ? 'success' : 'error');
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            setOrderedExpenses([]);
            setFeedback('none');
            onRetry();
        }
    };

    const unorderedExpenses = expenses.filter((exp: any) => !orderedExpenses.includes(exp.id));

    const getExpenseById = (id: string) => expenses.find((exp: any) => exp.id === id);

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'urgent': return 'bg-red-100 dark:bg-red-950/30 border-red-500';
            case 'important': return 'bg-yellow-100 dark:bg-yellow-950/30 border-yellow-500';
            case 'can_wait': return 'bg-green-100 dark:bg-green-950/30 border-green-500';
            default: return 'bg-slate-100 dark:bg-slate-800 border-slate-300';
        }
    };

    return (
        <div className="w-full max-w-4xl animate-slide-in-bottom">

            {/* Instructions */}
            <div className="mb-6 text-center">
                <div className="inline-flex items-center gap-2 bg-blue-100 dark:bg-blue-950/30 border-2 border-blue-400 dark:border-blue-700 rounded-xl px-4 py-3">
                    <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-bold text-blue-800 dark:text-blue-200">
                        {t('expense_timeline.instruction')}
                    </span>
                </div>
            </div>

            {/* Unordered Expenses */}
            {unorderedExpenses.length > 0 && (
                <div className="mb-6">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 text-center">
                        {t('expense_timeline.drag_to_timeline')}
                    </h3>
                    <div className="flex flex-wrap gap-2 justify-center">
                        {unorderedExpenses.map((expense: any) => (
                            <div
                                key={expense.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, expense.id)}
                                className={cn(
                                    "border-2 rounded-xl p-3 cursor-move hover:shadow-lg transition-all hover:-translate-y-1",
                                    getPriorityColor(expense.priority)
                                )}
                            >
                                <div className="text-center">
                                    <div className="text-2xl mb-1">{expense.icon || '💳'}</div>
                                    <div className="text-xs font-bold text-slate-800 dark:text-slate-100">{expense.name}</div>
                                    <div className="text-xs text-slate-600 dark:text-slate-400">${expense.amount}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Timeline */}
            <div className="mb-6">
                <div className="relative">
                    {/* Timeline Line */}
                    <div className="absolute left-8 top-0 bottom-0 w-1 bg-gradient-to-b from-red-500 via-yellow-500 to-green-500"></div>

                    {/* Timeline Slots */}
                    <div className="space-y-3">
                        {[...Array(expenses.length)].map((_, index) => {
                            const expense = orderedExpenses[index] ? getExpenseById(orderedExpenses[index]) : null;

                            return (
                                <div
                                    key={index}
                                    onDrop={(e) => handleDrop(e, index)}
                                    onDragOver={handleDragOver}
                                    className="relative pl-16"
                                >
                                    {/* Timeline Dot */}
                                    <div className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white dark:bg-slate-800 border-4 border-blue-500 z-10"></div>

                                    {/* Expense Card or Empty Slot */}
                                    {expense ? (
                                        <div
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, expense.id)}
                                            className={cn(
                                                "border-2 rounded-xl p-3 cursor-move",
                                                getPriorityColor(expense.priority)
                                            )}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-2xl">{expense.icon || '💳'}</span>
                                                    <div>
                                                        <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                                            {expense.name}
                                                        </div>
                                                        <div className="text-xs text-slate-600 dark:text-slate-400">
                                                            {t(`expense_timeline.${expense.priority}`)}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-base font-bold text-slate-800 dark:text-slate-100">
                                                    ${expense.amount}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-3 bg-slate-50 dark:bg-slate-900/50">
                                            <div className="flex items-center justify-center h-12 text-slate-400 dark:text-slate-600 text-xs">
                                                {t('expense_timeline.drop_here')} #{index + 1}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center">
                {feedback === 'none' ? (
                    <Button
                        onClick={handleCheck}
                        disabled={orderedExpenses.length !== expenses.length}
                        className="w-full max-w-md h-12 text-base font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-2xl shadow-[0_4px_0_rgb(107,33,168)] hover:shadow-[0_2px_0_rgb(107,33,168)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all disabled:opacity-50 disabled:shadow-none"
                    >
                        {t('actions.verify')}
                    </Button>
                ) : (
                    <div className="flex flex-col items-center w-full">
                        <p className={cn("font-bold text-lg mb-3", feedback === 'success' ? "text-green-500" : "text-orange-500")}>
                            {feedback === 'success' ? t('status.correct') : t('status.incorrect')}
                        </p>
                        <Button
                            onClick={handleContinue}
                            className={cn(
                                "w-full max-w-md h-12 text-base font-bold rounded-2xl transition-all",
                                feedback === 'success'
                                    ? "bg-green-500 hover:bg-green-600 text-white shadow-[0_4px_0_rgb(22,101,52)]"
                                    : "bg-orange-500 hover:bg-orange-600 text-white shadow-[0_4px_0_rgb(194,65,12)]",
                                "hover:translate-y-[2px] active:translate-y-1 active:shadow-none"
                            )}
                        >
                            {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                            <ArrowRight className="ml-2 w-5 h-5" />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};
