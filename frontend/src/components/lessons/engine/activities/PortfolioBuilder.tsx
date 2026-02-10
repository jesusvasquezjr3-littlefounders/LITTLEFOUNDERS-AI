import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, PieChart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

interface PortfolioBuilderProps {
    exercise: any;
    onSubmit: (allocation: Record<string, number>) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const PortfolioBuilder = ({ exercise, onSubmit, onNext, onRetry }: PortfolioBuilderProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [allocation, setAllocation] = useState<Record<string, number>>({});
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');

    const assets = exercise.content.assets || [];
    const totalAmount = 100;

    useEffect(() => {
        const init: Record<string, number> = {};
        assets.forEach((asset: any) => {
            init[asset.id] = 0;
        });
        setAllocation(init);
        setFeedback('none');
    }, [exercise]);

    const allocatedTotal = Object.values(allocation).reduce((sum, val) => sum + val, 0);
    const remaining = totalAmount - allocatedTotal;

    const updateAllocation = (assetId: string, value: number) => {
        const newValue = Math.max(0, Math.min(100, value));
        const newAllocation = { ...allocation, [assetId]: newValue };
        const newTotal = Object.values(newAllocation).reduce((sum, val) => sum + val, 0);

        if (newTotal <= totalAmount) {
            setAllocation(newAllocation);
            playSound('ui_tap');
        }
    };

    const getRiskLevel = (): string => {
        let riskScore = 0;
        assets.forEach((asset: any) => {
            riskScore += (allocation[asset.id] || 0) * asset.risk;
        });
        riskScore /= totalAmount;

        if (riskScore < 3) return 'low';
        if (riskScore < 6) return 'medium';
        return 'high';
    };

    const riskLevel = getRiskLevel();

    const handleSubmit = () => {
        if (allocatedTotal !== totalAmount) return;

        const isCorrect = onSubmit(allocation);
        setFeedback(isCorrect ? 'success' : 'error');
    };

    return (
        <div className="w-full max-w-4xl animate-slide-in-bottom">
            {/* Pie Chart Visualization */}
            <div className="mb-6 flex justify-center">
                <div className="relative w-64 h-64">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                        {assets.map((asset: any, index: number) => {
                            const percentage = allocation[asset.id] || 0;
                            const startAngle = assets.slice(0, index).reduce((sum: number, a: any) =>
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
                                {t('portfolio_builder.allocated')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Asset Sliders */}
            <div className="mb-6 space-y-3">
                {assets.map((asset: any) => (
                    <div key={asset.id} className="bg-white dark:bg-slate-800 rounded-2xl p-4 border-2 border-slate-200 dark:border-slate-700">
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
                                    ({t('portfolio_builder.risk')}: {asset.risk}/10)
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
                        />
                    </div>
                ))}
            </div>

            {/* Risk Indicator */}
            <div className="mb-6 bg-gradient-to-r from-green-100 via-yellow-100 to-red-100 dark:from-green-950/30 dark:via-yellow-950/30 dark:to-red-950/30 border-2 border-slate-300 dark:border-slate-700 rounded-2xl p-4">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                        {t('portfolio_builder.risk_level')}
                    </span>
                    <span className={cn(
                        "text-lg font-black",
                        riskLevel === 'low' && "text-green-600",
                        riskLevel === 'medium' && "text-yellow-600",
                        riskLevel === 'high' && "text-red-600"
                    )}>
                        {t(`portfolio_builder.${riskLevel}`)}
                    </span>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center">
                {feedback === 'none' ? (
                    <Button
                        onClick={handleSubmit}
                        disabled={allocatedTotal !== totalAmount}
                        className="w-full max-w-md h-12 text-base font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-[0_4px_0_rgb(29,78,216)] hover:shadow-[0_2px_0_rgb(29,78,216)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all disabled:opacity-50"
                    >
                        <PieChart className="w-5 h-5 mr-2" />
                        {t('actions.build_portfolio')}
                    </Button>
                ) : (
                    <div className="flex flex-col items-center w-full">
                        <p className="font-bold text-lg mb-3 text-green-500">
                            {t('feedback.success')}
                        </p>
                        <Button
                            onClick={onNext}
                            className="w-full max-w-md h-12 text-base font-bold bg-green-500 hover:bg-green-600 text-white rounded-2xl shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all"
                        >
                            {t('actions.continue')}
                            <ArrowRight className="ml-2 w-5 h-5" />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};
