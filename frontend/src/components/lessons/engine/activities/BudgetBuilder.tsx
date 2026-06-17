import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, RotateCcw, Wallet, ShoppingCart, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';

interface BudgetBuilderProps {
    exercise: any;
    onSubmit: (allocation: Record<string, string | number>) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

// Slider/allocation mode: categories is a non-empty array of objects with an `id`.
// (Previously also required `allocated`, which most real lessons omit → nothing rendered.)
const isNewSchema = (content: any): boolean => {
    if (!content?.categories || !Array.isArray(content.categories)) return false;
    return (
        content.categories.length > 0 &&
        typeof content.categories[0] === 'object' &&
        content.categories[0] !== null &&
        'id' in content.categories[0]
    );
};

// Legacy drag-and-drop categorization mode: an `items` array exists.
const isLegacySchema = (content: any): boolean => {
    return Array.isArray(content?.items) && content.items.length > 0;
};

// Total budget — derive from many possible keys, else the sum of category targets,
// else the sum of the correct allocation, else a sensible default so sliders are movable.
const computeTotalIncome = (content: any, correctAnswer: any, categories: any[]): number => {
    const direct = content.total_income ?? content.totalIncome ?? content.income
        ?? content.monthlyIncome ?? content.budget ?? content.total ?? content.amount ?? content.totalBudget;
    if (direct != null && Number(direct) > 0) return Number(direct);
    const catSum = categories.reduce(
        (s: number, c: any) => s + Number(c?.target ?? c?.max ?? c?.maxValue ?? c?.allocated ?? c?.amount ?? 0), 0);
    if (catSum > 0) return catSum;
    const alloc = correctAnswer?.allocations ?? correctAnswer?.allocation
        ?? (correctAnswer && typeof correctAnswer === 'object' ? correctAnswer : null);
    if (alloc && typeof alloc === 'object') {
        const sum = Object.values(alloc).reduce((s: number, v: any) => s + (typeof v === 'number' ? v : 0), 0);
        if (sum > 0) return sum;
    }
    return 1000;
};

export const BudgetBuilder = ({ exercise, onSubmit, onNext, onRetry }: BudgetBuilderProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [allocation, setAllocation] = useState<Record<string, string | number>>({});
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');
    const [dcaError, setDcaError] = useState(false);

    const content = exercise?.content || {};
    // Legacy (drag-drop) takes priority when an items array exists; otherwise sliders.
    const legacySchema = isLegacySchema(content);
    const newSchema = !legacySchema && isNewSchema(content);
    const totalIncome = computeTotalIncome(content, exercise?.correct_answer, content.categories || []);

    useEffect(() => {
        setFeedback('none');
        setDcaError(false);
        if (newSchema) {
            const initial: Record<string, number> = {};
            content.categories.forEach((cat: any) => {
                initial[cat.id] = typeof cat.allocated === 'number' ? cat.allocated : 0;
            });
            setAllocation(initial);
        } else {
            setAllocation({});
        }
    }, [exercise, newSchema, content.categories]);

    // ── Legacy drag-and-drop handlers ──
    const handleDragStart = (e: React.DragEvent, itemId: string) => {
        e.dataTransfer.setData('itemId', itemId);
        playSound('ui_tap');
    };

    const handleDrop = (e: React.DragEvent, category: string) => {
        e.preventDefault();
        const itemId = e.dataTransfer.getData('itemId');
        if (itemId && feedback === 'none') {
            playSound('ui_tap');
            setAllocation(prev => ({ ...prev, [itemId]: category }));
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    // ── New schema slider handler ──
    const handleSliderChange = (categoryId: string, value: number) => {
        if (feedback !== 'none') return;
        setAllocation(prev => ({ ...prev, [categoryId]: value }));
        setDcaError(false);
    };

    // ── Check / Submit ──
    const handleCheck = () => {
        if (newSchema) {
            const categories = content.categories || [];
            const minDca = content.min_dca;

            const totalAllocated = categories.reduce(
                (sum: number, cat: any) => sum + Number(allocation[cat.id] || 0),
                0
            );

            // DCA validation
            let dcaValid = true;
            if (typeof minDca === 'number') {
                const dcaCategory = categories.find(
                    (cat: any) =>
                        cat.name?.toLowerCase().includes('dca') ||
                        cat.name?.toLowerCase().includes('inversion')
                );
                if (dcaCategory) {
                    const allocated = Number(allocation[dcaCategory.id] || 0);
                    if (allocated < minDca) {
                        dcaValid = false;
                    }
                }
            }

            if (totalAllocated > totalIncome || !dcaValid) {
                if (!dcaValid) setDcaError(true);
                playSound('ui_tap');
                return;
            }

            const isCorrect = onSubmit(allocation);
            setFeedback(isCorrect ? 'success' : 'error');
        } else if (legacySchema) {
            const items = content.items || [];
            const allAllocated = items.every((item: any) => allocation[item.id]);
            if (!allAllocated) {
                playSound('ui_tap');
                return;
            }
            const isCorrect = onSubmit(allocation);
            setFeedback(isCorrect ? 'success' : 'error');
        }
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            setFeedback('none');
            setDcaError(false);
            if (newSchema) {
                const initial: Record<string, number> = {};
                content.categories.forEach((cat: any) => {
                    initial[cat.id] = typeof cat.allocated === 'number' ? cat.allocated : 0;
                });
                setAllocation(initial);
            } else {
                setAllocation({});
            }
            onRetry();
        }
    };

    // ── Graceful fallback — allow continuing (no dead end) ──
    if (!newSchema && !legacySchema) {
        return (
            <div className="w-full max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col items-center justify-center py-12 gap-4 text-center">
                <AlertCircle className="w-10 h-10 opacity-60" style={{ color: 'var(--lp-muted)' }} />
                <p className="lp-display text-sm" style={{ color: 'var(--lp-muted)' }}>
                    {content.scenario || content.instruction || t('budget_builder.no_data', { defaultValue: 'No hay datos disponibles para este ejercicio.' })}
                </p>
                <div className="w-full">
                    <QuestButton variant="brand" onClick={onNext}>
                        {t('actions.continue', { defaultValue: 'Continuar' })}
                        <ArrowRight className="w-5 h-5" />
                    </QuestButton>
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════
    //  NEW SCHEMA RENDER
    // ═══════════════════════════════════════
    if (newSchema) {
        const categories = content.categories || [];
        const minDca = content.min_dca;
        const scenario = content.scenario || '';
        const instruction = content.instruction || '';

        const totalAllocated = categories.reduce(
            (sum: number, cat: any) => sum + Number(allocation[cat.id] || 0),
            0
        );
        const remaining = totalIncome - totalAllocated;
        const overBudget = remaining < 0;

        const dcaCategory =
            typeof minDca === 'number'
                ? categories.find(
                    (cat: any) =>
                        cat.name?.toLowerCase().includes('dca') ||
                        cat.name?.toLowerCase().includes('inversion')
                )
                : null;
        const dcaAllocated = dcaCategory ? Number(allocation[dcaCategory.id] || 0) : 0;
        const dcaValid = !dcaCategory || dcaAllocated >= minDca;

        return (
            <div className="w-full max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Scenario & Instruction */}
                {scenario && (
                    <div
                        className="mb-4 p-4 rounded-2xl"
                        style={{ background: 'var(--lp-indigo-soft)', border: '1.5px solid var(--lp-indigo)' }}
                    >
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--lp-ink)' }}>
                            {scenario}
                        </p>
                    </div>
                )}
                {instruction && (
                    <p className="lp-display text-sm mb-4 text-center" style={{ color: 'var(--lp-muted)' }}>
                        {instruction}
                    </p>
                )}

                {/* Budget Display */}
                <div className="mb-6 text-center">
                    <div className="lp-token lp-token--locked inline-flex flex-col items-center px-6 sm:px-8 py-4 sm:py-5" style={{ background: 'var(--lp-emerald-soft)', borderColor: 'var(--lp-emerald)', boxShadow: '0 5px 0 var(--lp-emerald-lip)' }}>
                        <span className="lp-display text-xs mb-1" style={{ color: 'var(--lp-emerald-ink)' }}>
                            {t('budget_builder.total_budget', { defaultValue: 'Presupuesto Total' })}
                        </span>
                        <div className="lp-display text-3xl sm:text-4xl" style={{ color: 'var(--lp-emerald-ink)' }}>${totalIncome}</div>
                        <span
                            className="lp-display text-xs mt-1"
                            style={{ color: overBudget ? 'var(--lp-coral)' : 'var(--lp-muted)' }}
                        >
                            {t('budget_builder.remaining', { defaultValue: 'Restante' })}: ${remaining}
                        </span>
                    </div>
                </div>

                {/* Categories with Sliders */}
                <div className="space-y-4 mb-6">
                    {categories.map((category: any) => {
                        const allocated = Number(allocation[category.id] || 0);
                        const isDca = dcaCategory?.id === category.id;

                        return (
                            <div
                                key={category.id}
                                className="lp-card p-4 transition-all"
                                style={
                                    isDca && !dcaValid && dcaError
                                        ? { background: 'var(--lp-coral-soft)', borderColor: 'var(--lp-coral)' }
                                        : undefined
                                }
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="lp-display text-sm" style={{ color: 'var(--lp-ink)' }}>
                                        {category.name}
                                    </h3>
                                    <span
                                        className="lp-display text-sm tabular-nums"
                                        style={{
                                            color: isDca && !dcaValid && dcaError
                                                ? 'var(--lp-coral)'
                                                : 'var(--lp-emerald)',
                                        }}
                                    >
                                        ${allocated}
                                    </span>
                                </div>

                                <input
                                    type="range"
                                    min={0}
                                    max={totalIncome}
                                    step={1}
                                    value={allocated}
                                    disabled={feedback !== 'none'}
                                    onChange={(e) =>
                                        handleSliderChange(category.id, Number(e.target.value))
                                    }
                                    className={cn(
                                        'w-full h-2 rounded-lg appearance-none cursor-pointer',
                                        feedback !== 'none' && 'opacity-60 cursor-not-allowed'
                                    )}
                                    style={{ accentColor: 'var(--lp-emerald)' }}
                                    aria-label={category.name}
                                    aria-valuemin={0}
                                    aria-valuemax={totalIncome}
                                    aria-valuenow={allocated}
                                />

                                {isDca && typeof minDca === 'number' && (
                                    <p
                                        className="lp-display text-xs mt-1"
                                        style={{
                                            color: dcaAllocated >= minDca
                                                ? 'var(--lp-emerald)'
                                                : 'var(--lp-muted)',
                                        }}
                                    >
                                        {t('budget_builder.min_dca_label', {
                                            defaultValue: `Mínimo requerido: $${minDca}`,
                                        })}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Warnings */}
                {dcaError && !dcaValid && (
                    <div
                        className="mb-4 p-3 rounded-2xl text-center"
                        style={{ background: 'var(--lp-coral-soft)', border: '1.5px solid var(--lp-coral)' }}
                    >
                        <p className="lp-display text-sm" style={{ color: 'var(--lp-coral)' }}>
                            {t('budget_builder.dca_error', {
                                defaultValue: `La inversión DCA debe ser al menos $${minDca}`,
                            })}
                        </p>
                    </div>
                )}

                {overBudget && feedback === 'none' && (
                    <div
                        className="mb-4 p-3 rounded-2xl text-center"
                        style={{ background: 'var(--lp-coral-soft)', border: '1.5px solid var(--lp-coral)' }}
                    >
                        <p className="lp-display text-sm" style={{ color: 'var(--lp-coral)' }}>
                            {t('budget_builder.over_budget', {
                                defaultValue: 'Has excedido el presupuesto total',
                            })}
                        </p>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-center">
                    {feedback === 'none' ? (
                        <QuestButton
                            variant="gold"
                            onClick={handleCheck}
                            disabled={overBudget || !!(dcaCategory && !dcaValid)}
                        >
                            {t('actions.verify', { defaultValue: 'Verificar' })}
                        </QuestButton>
                    ) : (
                        <div className="flex flex-col items-center w-full">
                            <p
                                className="lp-display text-lg mb-3"
                                style={{ color: feedback === 'success' ? 'var(--lp-emerald)' : 'var(--lp-coral)' }}
                            >
                                {feedback === 'success'
                                    ? t('feedback.success', { defaultValue: '¡Correcto!' })
                                    : t('feedback.error', { defaultValue: 'Inténtalo de nuevo' })}
                            </p>
                            <QuestButton
                                variant={feedback === 'success' ? 'go' : 'retry'}
                                onClick={handleContinue}
                            >
                                {feedback === 'success'
                                    ? t('actions.continue', { defaultValue: 'Continuar' })
                                    : t('actions.retry', { defaultValue: 'Reintentar' })}
                                {feedback === 'success'
                                    ? <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
                                    : <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />}
                            </QuestButton>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════
    //  LEGACY SCHEMA RENDER
    // ═══════════════════════════════════════
    const items = content.items || [];
    const budget = content.budget || 100;
    const categories = content.categories || ['needs', 'wants'];

    const getCategoryItems = (category: string) => {
        return items.filter((item: any) => allocation[item.id] === category);
    };

    const unallocatedItems = items.filter((item: any) => !allocation[item.id]);

    const totalSpent = items
        .filter((item: any) => allocation[item.id])
        .reduce((sum: number, item: any) => sum + (item.cost || 0), 0);

    return (
        <div className="w-full max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Budget Display */}
            <div className="mb-6 text-center">
                <div className="lp-token lp-token--locked inline-flex flex-col items-center px-6 sm:px-8 py-4 sm:py-5" style={{ background: 'var(--lp-emerald-soft)', borderColor: 'var(--lp-emerald)', boxShadow: '0 5px 0 var(--lp-emerald-lip)' }}>
                    <span className="lp-display text-xs mb-1" style={{ color: 'var(--lp-emerald-ink)' }}>
                        {t('budget_builder.total_budget', { defaultValue: 'Presupuesto Total' })}
                    </span>
                    <div className="lp-display text-3xl sm:text-4xl" style={{ color: 'var(--lp-emerald-ink)' }}>${budget}</div>
                    <span className="lp-display text-xs mt-1" style={{ color: 'var(--lp-muted)' }}>
                        {t('budget_builder.spent', { defaultValue: 'Gastado' })}: ${totalSpent}
                    </span>
                </div>
            </div>

            {/* Unallocated Items */}
            {unallocatedItems.length > 0 && (
                <div className="mb-6">
                    <h3 className="lp-display text-sm mb-3 text-center" style={{ color: 'var(--lp-muted)' }}>
                        {t('budget_builder.drag_items', { defaultValue: 'Arrastra los items' })}
                    </h3>
                    <div className="flex flex-wrap gap-2 sm:gap-3 justify-center">
                        {unallocatedItems.map((item: any) => (
                            <div
                                key={item.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, item.id)}
                                className="lp-token p-3 cursor-move"
                            >
                                <div className="text-center">
                                    <div className="text-3xl sm:text-4xl mb-1">{item.icon || '📦'}</div>
                                    <div className="lp-display text-xs" style={{ color: 'var(--lp-ink)' }}>
                                        {item.name}
                                    </div>
                                    <div className="lp-display text-xs" style={{ color: 'var(--lp-emerald)' }}>
                                        ${item.cost}
                                    </div>
                                </div>
                                <div className="sm:hidden flex gap-1 mt-2 justify-center flex-wrap">
                                    {categories.map((category: string) => (
                                        <button
                                            key={category}
                                            onClick={() => {
                                                if (feedback === 'none') {
                                                    playSound('ui_tap');
                                                    setAllocation(prev => ({ ...prev, [item.id]: category }));
                                                }
                                            }}
                                            className="lp-display text-[10px] px-2 py-1 rounded-lg uppercase"
                                            style={{ background: 'var(--lp-indigo-soft)', color: 'var(--lp-indigo-ink)' }}
                                        >
                                            {t(`budget_builder.${category}`, { defaultValue: category })}
                                        </button>
                                    ))}
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
                    const categoryTotal = categoryItems.reduce(
                        (sum: number, item: any) => sum + (item.cost || 0),
                        0
                    );

                    const accent = category === 'wants' ? 'var(--lp-amber)' : 'var(--lp-indigo)';
                    const accentSoft = category === 'wants' ? 'var(--lp-amber-soft)' : 'var(--lp-indigo-soft)';

                    return (
                        <div
                            key={category}
                            onDrop={(e) => handleDrop(e, category)}
                            onDragOver={handleDragOver}
                            className="min-h-[200px] p-4 rounded-2xl border-2 border-dashed transition-all"
                            style={{ borderColor: accent, background: accentSoft }}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    {category === 'needs' && (
                                        <Wallet className="w-5 h-5" style={{ color: 'var(--lp-indigo)' }} />
                                    )}
                                    {category === 'wants' && (
                                        <ShoppingCart className="w-5 h-5" style={{ color: 'var(--lp-amber)' }} />
                                    )}
                                    <h3 className="lp-display text-base" style={{ color: 'var(--lp-ink)' }}>
                                        {t(`budget_builder.${category}`, { defaultValue: category })}
                                    </h3>
                                </div>
                                <span className="lp-display text-sm" style={{ color: 'var(--lp-muted)' }}>
                                    ${categoryTotal}
                                </span>
                            </div>

                            <div className="space-y-2">
                                {categoryItems.map((item: any) => (
                                    <div
                                        key={item.id}
                                        onClick={() => {
                                            if (feedback === 'none') {
                                                playSound('ui_tap');
                                                setAllocation(prev => {
                                                    const next = { ...prev };
                                                    delete next[item.id];
                                                    return next;
                                                });
                                            }
                                        }}
                                        className="rounded-xl p-2 cursor-pointer"
                                        style={{ background: 'var(--lp-surface)', border: '1.5px solid var(--lp-line)' }}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg">{item.icon || '📦'}</span>
                                                <span className="lp-display text-xs" style={{ color: 'var(--lp-ink)' }}>
                                                    {item.name}
                                                </span>
                                            </div>
                                            <span className="lp-display text-xs" style={{ color: 'var(--lp-emerald)' }}>
                                                ${item.cost}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {categoryItems.length === 0 && (
                                <div className="flex items-center justify-center h-32 lp-display text-sm" style={{ color: 'var(--lp-muted)' }}>
                                    {t('budget_builder.drop_here', { defaultValue: 'Suelta aquí' })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center">
                {feedback === 'none' ? (
                    <QuestButton
                        variant="gold"
                        onClick={handleCheck}
                        disabled={unallocatedItems.length > 0}
                    >
                        {t('actions.verify', { defaultValue: 'Verificar' })}
                    </QuestButton>
                ) : (
                    <div className="flex flex-col items-center w-full">
                        <p
                            className="lp-display text-lg mb-3"
                            style={{ color: feedback === 'success' ? 'var(--lp-emerald)' : 'var(--lp-coral)' }}
                        >
                            {feedback === 'success'
                                ? t('feedback.success', { defaultValue: '¡Correcto!' })
                                : t('feedback.error', { defaultValue: 'Inténtalo de nuevo' })}
                        </p>
                        <QuestButton
                            variant={feedback === 'success' ? 'go' : 'retry'}
                            onClick={handleContinue}
                        >
                            {feedback === 'success'
                                ? t('actions.continue', { defaultValue: 'Continuar' })
                                : t('actions.retry', { defaultValue: 'Reintentar' })}
                            {feedback === 'success'
                                ? <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
                                : <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />}
                        </QuestButton>
                    </div>
                )}
            </div>
        </div>
    );
};
