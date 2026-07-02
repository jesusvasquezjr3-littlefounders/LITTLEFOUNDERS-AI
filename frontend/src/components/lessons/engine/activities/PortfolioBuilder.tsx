import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, RotateCcw, PieChart, CheckCircle, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';
import { pickText } from './fieldText';

interface PortfolioBuilderProps {
    exercise: any;
    // Record<assetId, pct> for ASSETS mode, or a plain option id for OPTIONS mode.
    onSubmit: (allocation: Record<string, number> | string) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

const COLOR_PALETTE = [
    '#5b6ef5', // indigo
    '#19b67e', // emerald
    '#f6a821', // amber
    '#fb6f6f', // coral
    '#3a45c4', // indigo-lip
    '#c47808', // amber-lip
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
            name: pickText(a, ['name', 'label', 'text', 'title']) || String(a.id),
            color: String(a.color || '#5b6ef5'),
            risk: Number(a.risk ?? 5),
        }))
        : isOptions
            ? rawOptions.map((o: any, idx: number) => ({
                id: String(o.id ?? idx),
                name: pickText(o) || String(o.id ?? idx),
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
            // Options mode is a single pick — submit the option id directly so the
            // engine grades it against the author's recommendedOptionId/correctOptionId.
            const isCorrect = onSubmit(selectedOptionId);
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
                <AlertCircle className="w-12 h-12 mb-4" style={{ color: "var(--lp-muted)" }} />
                <p className="text-center lp-display" style={{ color: "var(--lp-muted)" }}>
                    {t('portfolio_builder.no_data', { defaultValue: 'No hay datos de portfolio disponibles.' })}
                </p>
                <div className="mt-6 w-full max-w-md">
                    <QuestButton variant="brand" onClick={onNext}>
                        {t('actions.continue', { defaultValue: 'Continuar' })}
                        <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" />
                    </QuestButton>
                </div>
            </div>
        );
    }

    return (
        <div className={cn("w-full max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500")}>
            {/* Scenario / Instruction / Criteria */}
            {(scenario || instruction || criteria.length > 0) && (
                <div className="mb-6 space-y-3">
                    {scenario && (
                        <div className="bg-white rounded-[2.5rem] shadow-sm p-4">
                            <p className="text-sm" style={{ color: "var(--lp-ink)" }}>
                                {scenario}
                            </p>
                        </div>
                    )}
                    {instruction && (
                        <div className="bg-white rounded-[2.5rem] shadow-sm p-4" style={{ background: "var(--lp-indigo-soft)", borderColor: "var(--lp-indigo)" }}>
                            <p className="text-sm lp-display" style={{ color: "var(--lp-indigo-ink)" }}>
                                {instruction}
                            </p>
                        </div>
                    )}
                    {criteria.length > 0 && (
                        <div className="bg-white rounded-[2.5rem] shadow-sm p-4" style={{ background: "var(--lp-indigo-soft)", borderColor: "var(--lp-indigo)" }}>
                            <p className="text-xs lp-display uppercase tracking-wide mb-2" style={{ color: "var(--lp-indigo-ink)" }}>
                                {t('portfolio_builder.criteria', { defaultValue: 'Criterios' })}
                            </p>
                            <ul className="list-disc list-inside space-y-1">
                                {criteria.map((c: string, idx: number) => (
                                    <li key={idx} className="text-sm" style={{ color: "var(--lp-indigo-ink)" }}>
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
                                <div className="lp-display text-4xl" style={{ color: "var(--lp-ink)" }}>
                                    {allocatedTotal}%
                                </div>
                                <div className="text-xs" style={{ color: "var(--lp-muted)" }}>
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
                        <div key={asset.id} className="bg-white rounded-[2.5rem] shadow-sm p-4">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-4 h-4 rounded-full"
                                        style={{ backgroundColor: asset.color }}
                                    ></div>
                                    <span className="lp-display" style={{ color: "var(--lp-ink)" }}>
                                        {asset.name}
                                    </span>
                                    <span className="text-xs" style={{ color: "var(--lp-muted)" }}>
                                        ({t('portfolio_builder.risk', { defaultValue: 'Riesgo' })}: {asset.risk}/10)
                                    </span>
                                </div>
                                <span className="lp-display text-lg" style={{ color: asset.color }}>
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
                                className="w-full h-3 rounded-lg appearance-none cursor-pointer"
                                style={{ accentColor: asset.color, background: "var(--lp-bg-2)" }}
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
                    {assets.map((asset, idx) => {
                        const isSelected = selectedOptionId === asset.id;
                        const hue = (['indigo', 'amber', 'emerald', 'coral'] as const)[idx % 4];
                        return (
                            <button
                                key={asset.id}
                                onClick={() => handleSelectOption(asset.id)}
                                className={cn(
                                    "lp-token lp-option text-left w-full p-4",
                                    `lp-option--${hue}`,
                                    isSelected && "is-selected"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className={cn(
                                            "w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors"
                                        )}
                                        style={{
                                            background: isSelected ? "var(--hue)" : "var(--lp-bg-2)",
                                            color: isSelected ? "#fff" : "var(--lp-muted)",
                                        }}
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
                                        <span className="lp-display" style={{ color: "var(--lp-ink)" }}>
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
                <div className="mb-6 bg-white rounded-[2.5rem] shadow-sm p-4">
                    <div className="flex items-center justify-between">
                        <span className="lp-display text-sm" style={{ color: "var(--lp-ink)" }}>
                            {t('portfolio_builder.risk_level', { defaultValue: 'Nivel de riesgo' })}
                        </span>
                        <span
                            className="lp-display text-lg"
                            style={{
                                color: riskLevel === 'low'
                                    ? "var(--lp-emerald-ink)"
                                    : riskLevel === 'medium'
                                        ? "var(--lp-indigo-ink)"
                                        : "var(--lp-coral-ink)",
                            }}
                        >
                            {t(`portfolio_builder.${riskLevel}`, { defaultValue: riskLevel })}
                        </span>
                    </div>
                </div>
            )}

            {/* Options format: Selected option summary */}
            {isOptions && selectedOptionId && (
                <div className="mb-6 bg-white rounded-[2.5rem] shadow-sm p-4" style={{ background: "var(--lp-indigo-soft)", borderColor: "var(--lp-indigo)" }}>
                    <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" style={{ color: "var(--lp-indigo)" }} />
                        <span className="text-sm lp-display" style={{ color: "var(--lp-indigo-ink)" }}>
                            {t('portfolio_builder.selected', { defaultValue: 'Opción seleccionada' })}: {assets.find(a => a.id === selectedOptionId)?.name}
                        </span>
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-center">
                {feedback === 'none' ? (
                    <div className="w-full max-w-md">
                        <QuestButton variant="gold" disabled={!canSubmit} onClick={handleSubmit}>
                            <PieChart className="w-5 h-5 sm:w-6 sm:h-6" />
                            {isOptions
                                ? t('actions.select_option', { defaultValue: 'Seleccionar opción' })
                                : t('actions.build_portfolio', { defaultValue: 'Construir portfolio' })
                            }
                        </QuestButton>
                    </div>
                ) : (
                    <div className="flex flex-col items-center w-full">
                        <p
                            className="lp-display text-lg mb-3"
                            style={{ color: feedback === 'success' ? "var(--lp-emerald-ink)" : "var(--lp-coral-ink)" }}
                        >
                            {feedback === 'success'
                                ? t('status.correct', { defaultValue: '¡Correcto!' })
                                : t('portfolio_builder.try_again', { defaultValue: 'Intenta de nuevo' })
                            }
                        </p>
                        <div className="w-full max-w-md">
                            <QuestButton variant={feedback === 'success' ? 'go' : 'retry'} onClick={handleContinue}>
                                {t('actions.continue', { defaultValue: 'Continuar' })}
                                {feedback === 'success' ? <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6" /> : <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6" />}
                            </QuestButton>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
