import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, Wallet, ShoppingCart, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

interface BudgetBuilderProps {
    exercise: any;
    onSubmit: (allocation: Record<string, string | number>) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

const isNewSchema = (content: any): boolean => {
    if (!content?.categories || !Array.isArray(content.categories)) return false;
    return (
        content.categories.length > 0 &&
        typeof content.categories[0] === 'object' &&
        'id' in content.categories[0] &&
        'allocated' in content.categories[0]
    );
};

const isLegacySchema = (content: any): boolean => {
    return !!content?.items && Array.isArray(content.items);
};

export const BudgetBuilder = ({ exercise, onSubmit, onNext, onRetry }: BudgetBuilderProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [allocation, setAllocation] = useState<Record<string, string | number>>({});
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');
    const [dcaError, setDcaError] = useState(false);

    const content = exercise?.content || {};
    const newSchema = isNewSchema(content);
    const legacySchema = !newSchema && isLegacySchema(content);

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
            const totalIncome = content.total_income || 0;
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

    // ── Graceful fallback ──
    if (!newSchema && !legacySchema) {
        return (
            <div className="w-full max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500 flex items-center justify-center py-12">
                <div className="text-center text-slate-500 dark:text-slate-400">
                    <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-60" />
                    <p className="text-sm font-medium">
                        {t('budget_builder.no_data', { defaultValue: 'No hay datos disponibles para este ejercicio.' })}
                    </p>
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════
    //  NEW SCHEMA RENDER
    // ═══════════════════════════════════════
    if (newSchema) {
        const categories = content.categories || [];
        const totalIncome = content.total_income || 0;
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
                    <div className="mb-4 p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-200 dark:border-blue-800 shadow-sm">
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                            {scenario}
                        </p>
                    </div>
                )}
                {instruction && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 text-center font-medium">
                        {instruction}
                    </p>
                )}

                {/* Budget Display */}
                <div className="mb-6 text-center">
                    <div className="inline-flex flex-col items-center bg-green-500 border-2 border-green-600 text-white rounded-2xl px-6 py-4 shadow-sm">
                        <span className="text-xs font-medium opacity-90 mb-1">
                            {t('budget_builder.total_budget', { defaultValue: 'Presupuesto Total' })}
                        </span>
                        <div className="text-3xl font-black">${totalIncome}</div>
                        <span
                            className={cn(
                                'text-xs mt-1 font-medium',
                                overBudget ? 'text-red-200' : 'opacity-80'
                            )}
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
                                className={cn(
                                    'p-4 rounded-2xl border transition-all',
                                    isDca && !dcaValid && dcaError
                                        ? 'border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-950/30'
                                        : 'border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm'
                                )}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                                        {category.name}
                                    </h3>
                                    <span
                                        className={cn(
                                            'text-sm font-bold tabular-nums',
                                            isDca && !dcaValid && dcaError
                                                ? 'text-red-600 dark:text-red-400'
                                                : 'text-green-600 dark:text-green-400'
                                        )}
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
                                        'w-full h-2 rounded-lg appearance-none cursor-pointer accent-green-600 dark:accent-green-500',
                                        feedback !== 'none' && 'opacity-60 cursor-not-allowed'
                                    )}
                                    aria-label={category.name}
                                    aria-valuemin={0}
                                    aria-valuemax={totalIncome}
                                    aria-valuenow={allocated}
                                />

                                {isDca && typeof minDca === 'number' && (
                                    <p
                                        className={cn(
                                            'text-xs mt-1 font-medium',
                                            dcaAllocated >= minDca
                                                ? 'text-green-600 dark:text-green-400'
                                                : 'text-slate-500 dark:text-slate-400'
                                        )}
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
                    <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-center">
                        <p className="text-sm font-bold text-red-600 dark:text-red-400">
                            {t('budget_builder.dca_error', {
                                defaultValue: `La inversión DCA debe ser al menos $${minDca}`,
                            })}
                        </p>
                    </div>
                )}

                {overBudget && feedback === 'none' && (
                    <div className="mb-4 p-3 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 text-center">
                        <p className="text-sm font-bold text-violet-600 dark:text-violet-400">
                            {t('budget_builder.over_budget', {
                                defaultValue: 'Has excedido el presupuesto total',
                            })}
                        </p>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-center">
                    {feedback === 'none' ? (
                        <Button
                            onClick={handleCheck}
                            disabled={overBudget || (dcaCategory && !dcaValid)}
                            className="w-full max-w-md h-14 sm:h-16 text-lg sm:text-xl font-bold bg-green-500 hover:bg-green-600 text-white rounded-2xl shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none flex items-center justify-center gap-2"
                        >
                            {t('actions.verify', { defaultValue: 'Verificar' })}
                        </Button>
                    ) : (
                        <div className="flex flex-col items-center w-full">
                            <p
                                className={cn(
                                    'font-bold text-lg mb-3',
                                    feedback === 'success' ? 'text-green-500' : 'text-violet-500'
                                )}
                            >
                                {feedback === 'success'
                                    ? t('feedback.success', { defaultValue: '¡Correcto!' })
                                    : t('feedback.error', { defaultValue: 'Inténtalo de nuevo' })}
                            </p>
                            <Button
                                onClick={handleContinue}
                                className={cn(
                                    'w-full max-w-md h-14 sm:h-16 text-lg sm:text-xl font-bold rounded-2xl transition-all flex items-center justify-center gap-2',
                                    feedback === 'success'
                                        ? 'bg-green-500 hover:bg-green-600 text-white shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)] active:shadow-none active:translate-y-[4px]'
                                        : 'bg-violet-500 hover:bg-violet-600 text-white shadow-[0_4px_0_rgb(194,65,12)] hover:shadow-[0_2px_0_rgb(194,65,12)] active:shadow-none active:translate-y-[4px]',
                                    'hover:-translate-y-[2px]'
                                )}
                            >
                                {feedback === 'success'
                                    ? t('actions.continue', { defaultValue: 'Continuar' })
                                    : t('actions.retry', { defaultValue: 'Reintentar' })}
                                <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
                            </Button>
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
                <div className="inline-flex flex-col items-center bg-green-500 border-2 border-green-600 text-white rounded-2xl px-6 py-4 shadow-sm">
                    <span className="text-xs font-medium opacity-90 mb-1">
                        {t('budget_builder.total_budget', { defaultValue: 'Presupuesto Total' })}
                    </span>
                    <div className="text-3xl font-black">${budget}</div>
                    <span className="text-xs opacity-80 mt-1">
                        {t('budget_builder.spent', { defaultValue: 'Gastado' })}: ${totalSpent}
                    </span>
                </div>
            </div>

            {/* Unallocated Items */}
            {unallocatedItems.length > 0 && (
                <div className="mb-6">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 text-center">
                        {t('budget_builder.drag_items', { defaultValue: 'Arrastra los items' })}
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
                                    <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                                        {item.name}
                                    </div>
                                    <div className="text-xs text-green-600 dark:text-green-400 font-bold">
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
                                            className="text-[10px] px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 font-bold uppercase"
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

                    return (
                        <div
                            key={category}
                            onDrop={(e) => handleDrop(e, category)}
                            onDragOver={handleDragOver}
                            className={cn(
                                'min-h-[200px] p-4 rounded-2xl border-2 border-dashed transition-all',
                                category === 'needs' &&
                                    'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/30',
                                category === 'wants' &&
                                    'border-purple-400 dark:border-purple-600 bg-purple-50 dark:bg-purple-950/30',
                                feedback === 'none' && 'hover:border-solid hover:shadow-lg'
                            )}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    {category === 'needs' && (
                                        <Wallet className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                    )}
                                    {category === 'wants' && (
                                        <ShoppingCart className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                    )}
                                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                                        {t(`budget_builder.${category}`, { defaultValue: category })}
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
                                        className="bg-white dark:bg-slate-800 rounded-lg p-2 shadow-sm cursor-pointer"
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
                    <Button
                        onClick={handleCheck}
                        disabled={unallocatedItems.length > 0}
                        className="w-full max-w-md h-14 sm:h-16 text-lg sm:text-xl font-bold bg-green-500 hover:bg-green-600 text-white rounded-2xl shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none flex items-center justify-center gap-2"
                    >
                        {t('actions.verify', { defaultValue: 'Verificar' })}
                    </Button>
                ) : (
                    <div className="flex flex-col items-center w-full">
                        <p
                            className={cn(
                                'font-bold text-lg mb-3',
                                feedback === 'success' ? 'text-green-500' : 'text-violet-500'
                            )}
                        >
                            {feedback === 'success'
                                ? t('feedback.success', { defaultValue: '¡Correcto!' })
                                : t('feedback.error', { defaultValue: 'Inténtalo de nuevo' })}
                        </p>
                        <Button
                            onClick={handleContinue}
                            className={cn(
                                'w-full max-w-md h-14 sm:h-16 text-lg sm:text-xl font-bold rounded-2xl transition-all flex items-center justify-center gap-2',
                                feedback === 'success'
                                    ? 'bg-green-500 hover:bg-green-600 text-white shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)] active:shadow-none active:translate-y-[4px]'
                                    : 'bg-violet-500 hover:bg-violet-600 text-white shadow-[0_4px_0_rgb(194,65,12)] hover:shadow-[0_2px_0_rgb(194,65,12)] active:shadow-none active:translate-y-[4px]',
                                'hover:-translate-y-[2px]'
                            )}
                        >
                            {feedback === 'success'
                                ? t('actions.continue', { defaultValue: 'Continuar' })
                                : t('actions.retry', { defaultValue: 'Reintentar' })}
                            <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};
