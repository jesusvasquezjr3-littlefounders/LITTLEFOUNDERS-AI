import { useState, useEffect } from 'react';
import { ArrowRight, Clock, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from "../ui/QuestButton";

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

    const getPriorityStyle = (priority: string): React.CSSProperties => {
        switch (priority) {
            case 'urgent': return { background: 'var(--lp-coral-soft)', borderColor: 'var(--lp-coral)', boxShadow: '0 4px 0 var(--lp-coral-lip)' };
            case 'important': return { background: 'var(--lp-amber-soft)', borderColor: 'var(--lp-amber)', boxShadow: '0 4px 0 var(--lp-amber-lip)' };
            case 'can_wait': return { background: 'var(--lp-emerald-soft)', borderColor: 'var(--lp-emerald)', boxShadow: '0 4px 0 var(--lp-emerald-lip)' };
            default: return { background: 'var(--lp-surface)', borderColor: 'var(--lp-line)', boxShadow: '0 4px 0 var(--lp-line)' };
        }
    };

    return (
        <div className="w-full max-w-4xl animate-slide-in-bottom">

            {/* Instructions */}
            <div className="mb-6 text-center">
                <div
                    className="lp-chip inline-flex items-center gap-2 px-4 py-3"
                    style={{ background: 'var(--lp-indigo-soft)', borderColor: 'var(--lp-indigo)' }}
                >
                    <Clock className="w-5 h-5" style={{ color: 'var(--lp-indigo)' }} />
                    <span className="lp-display text-sm" style={{ color: 'var(--lp-indigo-ink)' }}>
                        {t('expense_timeline.instruction')}
                    </span>
                </div>
            </div>

            {/* Unordered Expenses */}
            {unorderedExpenses.length > 0 && (
                <div className="mb-6">
                    <h3 className="lp-display text-sm mb-3 text-center" style={{ color: 'var(--lp-muted)' }}>
                        {t('expense_timeline.drag_to_timeline')}
                    </h3>
                    <div className="flex flex-wrap gap-3 justify-center">
                        {unorderedExpenses.map((expense: any) => (
                            <div
                                key={expense.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, expense.id)}
                                className="lp-token cursor-move p-3 min-w-[6.5rem]"
                                style={getPriorityStyle(expense.priority)}
                            >
                                <div className="text-center">
                                    <div className="text-3xl sm:text-4xl mb-1.5">{expense.icon || '💳'}</div>
                                    <div className="lp-display text-xs" style={{ color: 'var(--lp-ink)' }}>{expense.name}</div>
                                    <div className="lp-display text-xs" style={{ color: 'var(--lp-muted)' }}>${expense.amount}</div>
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
                    <div
                        className="absolute left-8 top-0 bottom-0 w-1 opacity-60 rounded-full"
                        style={{ background: 'linear-gradient(to bottom, var(--lp-coral), var(--lp-amber), var(--lp-emerald))' }}
                    ></div>

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
                                    <div
                                        className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full z-10"
                                        style={{ background: 'var(--lp-surface)', border: '4px solid var(--lp-indigo)' }}
                                    ></div>

                                    {/* Expense Card or Empty Slot */}
                                    {expense ? (
                                        <div
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, expense.id)}
                                            className="lp-token cursor-move p-3"
                                            style={getPriorityStyle(expense.priority)}
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-3xl sm:text-4xl">{expense.icon || '💳'}</span>
                                                    <div>
                                                        <div className="lp-display text-sm" style={{ color: 'var(--lp-ink)' }}>
                                                            {expense.name}
                                                        </div>
                                                        <div className="lp-display text-xs" style={{ color: 'var(--lp-muted)' }}>
                                                            {t(`expense_timeline.${expense.priority}`)}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="lp-display text-base" style={{ color: 'var(--lp-ink)' }}>
                                                    ${expense.amount}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div
                                            className="rounded-2xl p-3"
                                            style={{ border: '2px dashed var(--lp-line)', background: 'var(--lp-bg-2)' }}
                                        >
                                            <div className="lp-display flex items-center justify-center h-12 text-xs" style={{ color: 'var(--lp-muted)' }}>
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
                    <div className="w-full max-w-md">
                        <QuestButton
                            variant="gold"
                            onClick={handleCheck}
                            disabled={orderedExpenses.length !== expenses.length}
                        >
                            {t('actions.verify')}
                        </QuestButton>
                    </div>
                ) : (
                    <div className="flex flex-col items-center w-full max-w-md">
                        <p
                            className="lp-display text-lg mb-3"
                            style={{ color: feedback === 'success' ? 'var(--lp-emerald)' : 'var(--lp-coral)' }}
                        >
                            {feedback === 'success' ? t('status.correct') : t('status.incorrect')}
                        </p>
                        <QuestButton
                            variant={feedback === 'success' ? 'go' : 'retry'}
                            onClick={handleContinue}
                        >
                            {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                            {feedback === 'success' ? <ArrowRight className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
                        </QuestButton>
                    </div>
                )}
            </div>
        </div>
    );
};
