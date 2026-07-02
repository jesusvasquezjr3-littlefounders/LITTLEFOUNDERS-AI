import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, RotateCcw, Users, DollarSign } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';
import { pickText } from './fieldText';

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
        <div className="w-full max-w-4xl animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both">
            {/* Mode Toggle */}
            <div className="mb-6 flex flex-col sm:flex-row justify-center gap-3">
                <button
                    type="button"
                    onClick={() => {
                        setMode('equitable');
                        playSound('ui_tap');
                    }}
                    className={cn(
                        "lp-token lp-option lp-option--indigo lp-display flex items-center justify-center gap-2 px-6 py-3 text-base",
                        mode === 'equitable' && "is-selected"
                    )}
                    style={{ color: "var(--lp-ink)" }}
                >
                    <Users className="w-5 h-5" />
                    {t('bill_splitter.equitable')}
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setMode('proportional');
                        playSound('ui_tap');
                    }}
                    className={cn(
                        "lp-token lp-option lp-option--emerald lp-display flex items-center justify-center gap-2 px-6 py-3 text-base",
                        mode === 'proportional' && "is-selected"
                    )}
                    style={{ color: "var(--lp-ink)" }}
                >
                    <DollarSign className="w-5 h-5" />
                    {t('bill_splitter.proportional')}
                </button>
            </div>

            {/* Items List (only in proportional mode) */}
            {mode === 'proportional' && (
                <div className="bg-white rounded-[2.5rem] shadow-sm mb-6 p-4">
                    <h3 className="lp-display text-sm mb-3" style={{ color: "var(--lp-ink)" }}>
                        {t('bill_splitter.assign_items')}
                    </h3>
                    <div className="space-y-2">
                        {items.map((item: any) => (
                            <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-full" style={{ background: "var(--lp-bg-2)" }}>
                                <div className="flex-1">
                                    <span className="lp-display" style={{ color: "var(--lp-ink)" }}>{pickText(item)}</span>
                                    <span className="ml-2 text-sm" style={{ color: "var(--lp-muted)" }}>
                                        ${item.price.toFixed(2)}
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {people.map((person: any) => (
                                        <button
                                            key={person.id}
                                            type="button"
                                            onClick={() => toggleItemAssignment(person.id, item.id)}
                                            className={cn(
                                                "lp-token lp-option lp-option--emerald lp-display px-3 py-1.5 text-xs",
                                                assignments[person.id]?.includes(item.id) && "is-selected"
                                            )}
                                            style={{ color: "var(--lp-ink)" }}
                                        >
                                            {pickText(person, ['name', 'label', 'text', 'title'])}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tip Slider */}
            <div className="bg-white rounded-[2.5rem] shadow-sm mb-6 p-4">
                <div className="flex items-center justify-between mb-3">
                    <label className="lp-display text-sm" style={{ color: "var(--lp-ink)" }}>
                        {t('bill_splitter.tip')}
                    </label>
                    <span className="lp-display text-lg" style={{ color: "var(--lp-emerald-ink)" }}>
                        {t('bill_splitter.tip_value', { percent: tip, amount: tipAmount.toFixed(2), defaultValue: '{{percent}}% (${{amount}})' })}
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
                    className="w-full h-3 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    style={{ background: "var(--lp-bg-2)" }}
                    aria-label={t('bill_splitter.tip')}
                    aria-valuemin={0}
                    aria-valuemax={30}
                    aria-valuenow={tip}
                />
            </div>

            {/* Results */}
            <div className="bg-white rounded-[2.5rem] shadow-sm mb-6 p-6" style={{ background: "var(--lp-indigo-soft)", borderColor: "var(--lp-indigo)" }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {people.map((person: any) => (
                        <div key={person.id} className="bg-white rounded-[2.5rem] shadow-sm p-4">
                            <div className="text-sm mb-1" style={{ color: "var(--lp-muted)" }}>
                                {pickText(person, ['name', 'label', 'text', 'title'])}
                            </div>
                            <div className="lp-display text-2xl" style={{ color: "var(--lp-indigo-ink)" }}>
                                ${splits[person.id]?.toFixed(2) || '0.00'}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-4 pt-4 text-center" style={{ borderTop: "2px solid var(--lp-line)" }}>
                    <div className="text-xs mb-1" style={{ color: "var(--lp-indigo-ink)" }}>
                        {t('bill_splitter.total')}
                    </div>
                    <div className="lp-display text-3xl" style={{ color: "var(--lp-indigo-ink)" }}>
                        ${grandTotal.toFixed(2)}
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center">
                {feedback === 'none' ? (
                    <div className="w-full max-w-md">
                        <QuestButton variant="gold" onClick={handleSubmit}>
                            {t('actions.split_bill')}
                            <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
                        </QuestButton>
                    </div>
                ) : (
                    <div className="flex flex-col items-center w-full">
                        <div className="bg-white rounded-[2.5rem] shadow-sm mb-4 p-4" style={{ background: "var(--lp-indigo-soft)", borderColor: "var(--lp-indigo)" }}>
                            <p className="text-sm text-center" style={{ color: "var(--lp-indigo-ink)" }}>
                                {mode === 'equitable'
                                    ? t('bill_splitter.feedback_equitable')
                                    : t('bill_splitter.feedback_proportional')}
                            </p>
                        </div>

                        <div className="w-full max-w-md">
                            <QuestButton variant={feedback === 'success' ? 'go' : 'retry'} onClick={handleContinue}>
                                {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                                {feedback === 'success' ? <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" /> : <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />}
                            </QuestButton>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
