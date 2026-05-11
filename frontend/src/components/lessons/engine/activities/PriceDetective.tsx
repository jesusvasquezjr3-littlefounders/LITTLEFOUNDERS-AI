import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

interface PriceDetectiveProps {
    exercise: any;
    onSubmit: (choiceId: string) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const PriceDetective = ({ exercise, onSubmit, onNext, onRetry }: PriceDetectiveProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [showUnitPrices, setShowUnitPrices] = useState(false);
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');

    useEffect(() => {
        setSelectedId(null);
        setShowUnitPrices(false);
        setFeedback('none');
    }, [exercise]);

    const content = exercise?.content || {};
    const rawProducts = content.products || content.items || [];
    // Normalize items to product shape
    const products = rawProducts.map((p: any) => ({
        id: p.id,
        name: p.name || p.label || '',
        price: typeof p.price === 'number' ? p.price : parseFloat(String(p.price).replace(/[^0-9.]/g, '')) || 0,
        quantity: p.quantity || 1,
        unit: p.unit || 'unidad',
        icon: p.icon || '🔍',
    }));

    const calculateUnitPrice = (product: any) => {
        return (product.price / product.quantity).toFixed(2);
    };

    const handleInvestigate = () => {
        if (feedback !== 'none') return;
        playSound('ui_tap');
        setShowUnitPrices(true);
    };

    const handleSelectProduct = (productId: string) => {
        if (feedback !== 'none') return;
        playSound('ui_tap');
        setSelectedId(productId);
    };

    const handleCheck = () => {
        if (!selectedId) return;
        // Delegate validation to useLessonState via onSubmit (single source of truth)
        const isCorrect = onSubmit(selectedId);
        setFeedback(isCorrect ? 'success' : 'error');
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            setSelectedId(null);
            setShowUnitPrices(false);
            setFeedback('none');
            onRetry();
        }
    };

    return (
        <div className="w-full max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Detective Tool */}
            {!showUnitPrices && feedback === 'none' && (
                <div className="mb-8 flex justify-center">
                    <Button
                        onClick={handleInvestigate}
                        className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-lg px-8 py-6 rounded-2xl shadow-[0_4px_0_rgb(217,119,6)] hover:shadow-[0_2px_0_rgb(217,119,6)] hover:-translate-y-[2px] active:translate-y-[4px] active:shadow-none transition-all flex items-center gap-2"
                    >
                        <Search className="w-6 h-6 mr-2" />
                        {t('price_detective.investigate')}
                    </Button>
                </div>
            )}

            {/* Products Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                {products.map((product: any) => {
                    const isSelected = selectedId === product.id;
                    const unitPrice = calculateUnitPrice(product);
                    const isCorrect = product.id === exercise.correct_answer?.correctOptionId;

                    return (
                        <button
                            key={product.id}
                            onClick={() => handleSelectProduct(product.id)}
                            disabled={feedback !== 'none'}
                            className={cn(
                                "relative p-4 rounded-2xl border-3 transition-all duration-300 transform",
                                "bg-white dark:bg-slate-800",
                                isSelected && feedback === 'none' && "ring-4 ring-purple-400 dark:ring-purple-600 scale-105 shadow-sm",
                                !isSelected && feedback === 'none' && "border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-lg hover:-translate-y-1",
                                feedback === 'success' && isSelected && isCorrect && "border-green-500 ring-4 ring-green-300 scale-105",
                                feedback === 'error' && isSelected && "border-red-500 ring-4 ring-red-300",
                                feedback !== 'none' && !isSelected && "opacity-50 grayscale"
                            )}
                        >
                            {/* Product Info */}
                            <div className="text-center mb-3">
                                <div className="text-4xl sm:text-5xl mb-2">{product.icon || '📦'}</div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">
                                    {product.name}
                                </h3>
                                <div className="flex items-center justify-center gap-2 text-slate-600 dark:text-slate-400">
                                    <span className="text-xs">{product.quantity} {product.unit}</span>
                                </div>
                            </div>

                            {/* Price Tag */}
                            <div className="bg-emerald-500 border-2 border-emerald-600 text-white rounded-xl p-3 mb-3">
                                <div className="text-xs font-medium opacity-90">{t('price_detective.total_price')}</div>
                                <div className="text-2xl font-black">${product.price.toFixed(2)}</div>
                            </div>

                            {/* Unit Price Reveal */}
                            <div className={cn(
                                "transition-all duration-500 overflow-hidden",
                                showUnitPrices ? "max-h-32 opacity-100" : "max-h-0 opacity-0"
                            )}>
                                <div className="bg-amber-100 dark:bg-amber-900/30 border-2 border-amber-400 dark:border-amber-700 rounded-xl p-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Search className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                                        <span className="text-sm font-bold text-amber-800 dark:text-amber-300">
                                            {t('price_detective.unit_price')}
                                        </span>
                                    </div>
                                    <span className="text-xl font-black text-amber-900 dark:text-amber-100">
                                        ${unitPrice}
                                    </span>
                                </div>
                            </div>

                            {/* Selection Indicator */}
                            {isSelected && (
                                <div className="absolute top-4 right-4 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center animate-in zoom-in">
                                    <span className="text-white text-xl">✓</span>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center">
                {feedback === 'none' ? (
                    <Button
                        onClick={handleCheck}
                        disabled={!selectedId || !showUnitPrices}
                        className="w-full max-w-md h-14 sm:h-16 text-lg sm:text-xl font-bold bg-purple-500 hover:bg-purple-600 text-white rounded-2xl shadow-[0_4px_0_rgb(107,33,168)] hover:shadow-[0_2px_0_rgb(107,33,168)] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
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
                                "w-full max-w-md h-14 sm:h-16 text-lg sm:text-xl font-bold rounded-2xl transition-all flex items-center justify-center gap-2",
                                feedback === 'success'
                                    ? "bg-green-500 hover:bg-green-600 text-white shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)]"
                                    : "bg-orange-500 hover:bg-orange-600 text-white shadow-[0_4px_0_rgb(194,65,12)] hover:shadow-[0_2px_0_rgb(194,65,12)]",
                                "hover:-translate-y-[2px] active:translate-y-[4px] active:shadow-none"
                            )}
                        >
                            {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                            <ArrowRight className="w-5 h-5" />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};
