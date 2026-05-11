import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, PieChart, CheckCircle, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

interface PortfolioBuilderProps {
    exercise: any;
    onSubmit: (allocation: Record<string, number>) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

const COLOR_PALETTE = [
    '#3b82f6',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#ec4899',
];

interface AssetLike {
    id: string;
    name: string;
    color: string;
    risk: number;
}

export const PortfolioBuilder = ({ exercise, onSubmit, onNext, onRetry }: PortfolioBuilderProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [allocation, setAllocation] = useState<Record<string, number>>({});
    const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');

    const content = exercise?.content || {};
    const rawAssets = content.assets;
    const rawOptions = content.options;
    const criteria = content.criteria || [];
    const scenario = content.scenario || '';
    const instruction = content.instruction || '';

    const isLegacy = Array.isArray(rawAssets) && rawAssets.length > 0;
    const isOptions = !isLegacy && Array.isArray(rawOptions) && rawOptions.length > 0;

    const assets: AssetLike[] = isLegacy
        ? rawAssets.map((a: any) => ({
            id: String(a.id),
            name: String(a.name || a.id),
            color: String(a.color || '#3b82f6'),
            risk: Number(a.risk ?? 5),
        }))
        : isOptions
            ? rawOptions.map((o: any, idx: number) => ({
                id: String(o.id ?? idx),
                name: String(o.text || o.name || o.id || idx),
                color: COLOR_PALETTE[idx % COLOR_PALETTE.length],
                risk: 5,
            }))
            : [];

    const totalAmount = 100;

    useEffect(() => {
        if (isLegacy) {
            const init: Record<string, number> = {};
            assets.forEach((asset) => {
                init[asset.id] = 0;
            });
            setAllocation(init);
            setSelectedOptionId(null);
        } else if (isOptions) {
            setAllocation({});
            setSelectedOptionId(null);
        }
        setFeedback('none');
    }, [exercise]);

    const allocatedTotal = Object.values(allocation).reduce((sum, val) => sum + val, 0);
    const remaining = totalAmount - allocatedTotal;

    const updateAllocation = (assetId: string, value: number) => {
        const newValue = Math.max(0, Math.min(100, value));
        setAllocation(prev => {
            const next = { ...prev, [assetId]: newValue };
            const newTotal = Object.values(next).reduce((sum, val) => sum + val, 0);
            if (newTotal <= totalAmount) {
                playSound('ui_tap');
                return next;
            }
            return prev;
        });
    };

    const getRiskLevel = (): string => {
        if (isOptions && selectedOptionId) {
            return 'medium';
        }
        let riskScore = 0;
        assets.forEach((asset) => {
            riskScore += (allocation[asset.id] || 0) * asset.risk;
        });
        riskScore /= totalAmount;

        if (riskScore < 3) return 'low';
        if (riskScore < 6) return 'medium';
        return 'high';
    };

    const riskLevel = getRiskLevel();

    const handleSelectOption = (optionId: string) => {
        setSelectedOptionId(optionId);
        playSound('ui_tap');
    };

    const handleSubmit = () => {
        if (isLegacy) {
            if (allocatedTotal !== totalAmount) return;
            const isCorrect = onSubmit(allocation);
            setFeedback(isCorrect ? 'success' : 'error');
        } else if (isOptions) {
            if (!selectedOptionId) return;
            const isCorrect = onSubmit({ [selectedOptionId]: 100 });
            setFeedback(isCorrect ? 'success' : 'error');
        }
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            if (isLegacy) {
                const init: Record<string, number> = {};
                assets.forEach((asset) => {
                    init[asset.id] = 0;
                });
                setAllocation(init);
            } else if (isOptions) {
                setSelectedOptionId(null);
            }
            setFeedback('none');
            onRetry();
        }
    };

    const canSubmit = isLegacy ? allocatedTotal === totalAmount : !!selectedOptionId;

    if (!isLegacy && !isOptions) {
        return (
            <div className={cn("w-full max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col items-center justify-center py-12")}>
                <AlertCircle className="w-12 h-12 text-slate-400 mb-4" />
                <p className="text-slate-600 dark:text-slate-400 text-center">
                    {t('portfolio_builder.no_data', { defaultValue: 'No hay datos de portfolio disponibles.' })}
                </p>
                <Button
                    onClick={onNext}
                    className="mt-6 w-full max-w-md h-14 sm:h-16 text-lg sm:text-xl font-bold bg-blue-500 hover:bg-blue-600 text-white rounded-2xl shadow-[0_4px_0_rgb(29,78,216)] hover:shadow-[0_2px_0_rgb(29,78,216)] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all flex items-center justify-center gap-2"
                >
                    {t('actions.continue', { defaultValue: 'Continuar' })}
                    <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
                </Button>
            </div>
        );
    }

    return (
        <div className={cn("w-full max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500")}>
            {/* Scenario / Instruction / Criteria */}
            {(scenario || instruction || criteria.length > 0) && (
                <div className="mb-6 space-y-3">
                    {scenario && (
                        <div className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
                            <p className="text-sm text-slate-700 dark:text-slate-300">
                                {scenario}
                            </p>
                        </div>
                    )}
                    {instruction && (
                        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
                            <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                                {instruction}
                            </p>
                        </div>
                    )}
                    {criteria.length > 0 && (
                        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
                            <p className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wide mb-2">
                                {t('portfolio_builder.criteria', { defaultValue: 'Criterios' })}
                            </p>
                            <ul className="list-disc list-inside space-y-1">
                                {criteria.map((c: string, idx: number) => (
                                    <li key={idx} className="text-sm text-amber-900 dark:text-amber-200">
                                        {c}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* Legacy: Pie Chart Visualization */}
            {isLegacy && (
                <div className="mb-6 flex justify-center">
                    <div className="relative w-64 h-64">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                            {assets.map((asset, index) => {
                                const percentage = allocation[asset.id] || 0;
                                const startAngle = assets.slice(0, index).reduce((sum, a) =>
                                    sum + (allocation[a.id] || 0), 0) * 3.6;
                                const endAngle = startAngle + percentage * 3.6;

                                if (percentage === 0) return null;

                                const startX = 50 + 40 * Math.cos((startAngle - 90) * Math.PI / 180);
                                const startY = 50 + 40 * Math.sin((startAngle - 90) * Math.PI / 180);
                                const endX = 50 + 40 * Math.cos((endAngle - 90) * Math.PI / 180);
                                const endY = 50 + 40 * Math.sin((endAngle - 90) * Math.PI / 180);
                                const largeArc = percentage > 50 ? 1 : 0;

                                return (
                                    <path
                                        key={asset.id}
                                        d={`M 50 50 L ${startX} ${startY} A 40 40 0 ${largeArc} 1 ${endX} ${endY} Z`}
                                        fill={asset.color}
                                        className="transition-all duration-300"
                                    />
                                );
                            })}
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                                <div className="text-3xl font-black text-slate-800 dark:text-slate-200">
                                    {allocatedTotal}%
                                </div>
                                <div className="text-xs text-slate-600 dark:text-slate-400">
                                    {t('portfolio_builder.allocated', { defaultValue: 'Asignado' })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Legacy: Asset Sliders */}
            {isLegacy && (
                <div className="mb-6 space-y-3">
                    {assets.map((asset) => (
                        <div key={asset.id} className="bg-card rounded-2xl p-4 border-2 border-border shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-4 h-4 rounded-full"
                                        style={{ backgroundColor: asset.color }}
                                    ></div>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">
                                        {asset.name}
                                    </span>
                                    <span className="text-xs text-slate-600 dark:text-slate-400">
                                        ({t('portfolio_builder.risk', { defaultValue: 'Riesgo' })}: {asset.risk}/10)
                                    </span>
                                </div>
                                <span className="text-lg font-black" style={{ color: asset.color }}>
                                    {allocation[asset.id] || 0}%
                                </span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="5"
                                value={allocation[asset.id] || 0}
                                onChange={(e) => updateAllocation(asset.id, Number(e.target.value))}
                                className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
                                style={{ accentColor: asset.color }}
                                aria-label={asset.name}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={allocation[asset.id] || 0}
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* Options format: Selectable cards */}
            {isOptions && (
                <div className="mb-6 space-y-3">
                    {assets.map((asset) => {
                        const isSelected = selectedOptionId === asset.id;
                        return (
                            <button
                                key={asset.id}
                                onClick={() => handleSelectOption(asset.id)}
                                className={cn(
                                    "w-full text-left rounded-2xl p-4 border-2 transition-all duration-200 shadow-sm",
                                    "hover:shadow-md hover:scale-[1.01] active:scale-[0.99]",
                                    isSelected
                                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 shadow-blue-200 dark:shadow-blue-900/20"
                                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className={cn(
                                            "w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors",
                                            isSelected ? "bg-blue-500 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-500"
                                        )}
                                    >
                                        {isSelected ? (
                                            <CheckCircle className="w-5 h-5" />
                                        ) : (
                                            <div
                                                className="w-4 h-4 rounded-full"
                                                style={{ backgroundColor: asset.color }}
                                            />
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <span className={cn(
                                            "font-bold",
                                            isSelected ? "text-blue-700 dark:text-blue-300" : "text-slate-800 dark:text-slate-200"
                                        )}>
                                            {asset.name}
                                        </span>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Legacy: Risk Indicator */}
            {isLegacy && (
                <div className="mb-6 bg-slate-50 dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                            {t('portfolio_builder.risk_level', { defaultValue: 'Nivel de riesgo' })}
                        </span>
                        <span className={cn(
                            "text-lg font-black",
                            riskLevel === 'low' && "text-green-600",
                            riskLevel === 'medium' && "text-yellow-600",
                            riskLevel === 'high' && "text-red-600"
                        )}>
                            {t(`portfolio_builder.${riskLevel}`, { defaultValue: riskLevel })}
                        </span>
                    </div>
                </div>
            )}

            {/* Options format: Selected option summary */}
            {isOptions && selectedOptionId && (
                <div className="mb-6 bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-300 dark:border-blue-700 rounded-2xl p-4">
                    <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <span className="text-sm font-bold text-blue-800 dark:text-blue-300">
                            {t('portfolio_builder.selected', { defaultValue: 'Opción seleccionada' })}: {assets.find(a => a.id === selectedOptionId)?.name}
                        </span>
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-center">
                {feedback === 'none' ? (
                    <Button
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className="w-full max-w-md h-14 sm:h-16 text-lg sm:text-xl font-bold bg-blue-500 hover:bg-blue-600 text-white rounded-2xl shadow-[0_4px_0_rgb(29,78,216)] hover:shadow-[0_2px_0_rgb(29,78,216)] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none flex items-center justify-center gap-2"
                    >
                        <PieChart className="w-5 h-5 sm:w-6 sm:h-6" />
                        {isOptions
                            ? t('actions.select_option', { defaultValue: 'Seleccionar opción' })
                            : t('actions.build_portfolio', { defaultValue: 'Construir portfolio' })
                        }
                    </Button>
                ) : (
                    <div className="flex flex-col items-center w-full">
                        <p className={cn("font-bold text-lg mb-3", feedback === 'success' ? "text-green-500" : "text-red-500")}>
                            {feedback === 'success'
                                ? t('feedback.success', { defaultValue: '¡Correcto!' })
                                : t('feedback.error', { defaultValue: 'Intenta de nuevo' })
                            }
                        </p>
                        <Button
                            onClick={handleContinue}
                            className="w-full max-w-md h-14 sm:h-16 text-lg sm:text-xl font-bold bg-green-500 hover:bg-green-600 text-white rounded-2xl shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all flex items-center justify-center gap-2"
                        >
                            {t('actions.continue', { defaultValue: 'Continuar' })}
                            <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};
