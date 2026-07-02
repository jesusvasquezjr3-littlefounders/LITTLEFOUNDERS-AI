import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, RotateCcw, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';
import { resolveOptions } from './optionSource';

const HUES = ['indigo', 'amber', 'emerald', 'coral'] as const;

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
    // Items may live under products/items/options/prices/stores/cases/markets/cities or
    // pairwise itemA-itemB / marketA-marketB / cityA-cityB shapes.
    const rawProducts = resolveOptions(content, ['products', 'items', 'options', 'prices', 'stores', 'cases', 'markets', 'cities']);
    // Normalize items to product shape
    const products = rawProducts.map((p: any) => ({
        id: p.id,
        name: p.name || p.label || p.text || '',
        price: typeof p.price === 'number' ? p.price : parseFloat(String(p.price ?? '').replace(/[^0-9.]/g, '')) || 0,
        quantity: p.quantity || 1,
        unit: p.unit || 'unidad',
        icon: p.icon || '🔍',
    }));
    // Some price_detective lessons are plain choices (no per-unit price data).
    const hasPriceData = products.some((p: any) => p.price > 0);

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
            {hasPriceData && !showUnitPrices && feedback === 'none' && (
                <div className="mb-8 flex justify-center">
                    <QuestButton variant="brand" onClick={handleInvestigate} className="w-auto px-8">
                        <Search className="w-6 h-6" />
                        {t('price_detective.investigate')}
                    </QuestButton>
                </div>
            )}

            {/* Products Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                {products.map((product: any, index: number) => {
                    const isSelected = selectedId === product.id;
                    const unitPrice = calculateUnitPrice(product);
                    const isCorrect = product.id === exercise.correct_answer?.correctOptionId;
                    const hue = HUES[index % HUES.length];
                    const locked = feedback !== 'none';

                    return (
                        <button
                            key={product.id}
                            onClick={() => handleSelectProduct(product.id)}
                            disabled={feedback !== 'none'}
                            style={{ animationDelay: `${0.04 + index * 0.06}s` }}
                            className={cn(
                                "lp-token lp-option relative p-4 text-left",
                                "animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both",
                                `lp-option--${hue}`,
                                locked && "lp-token--locked",
                                isSelected && feedback === 'none' && "is-selected",
                                feedback === 'success' && isSelected && isCorrect && "is-correct",
                                feedback === 'error' && isSelected && "is-wrong",
                                feedback !== 'none' && !isSelected && "is-dimmed"
                            )}
                        >
                            {/* Product Info */}
                            <div className="text-center mb-3">
                                <div className="text-5xl sm:text-6xl mb-2">{product.icon || '📦'}</div>
                                <h3 className="lp-display text-lg mb-1" style={{ color: 'var(--lp-ink)' }}>
                                    {product.name}
                                </h3>
                                <div className="flex items-center justify-center gap-2" style={{ color: 'var(--lp-muted)' }}>
                                    <span className="text-xs">{product.quantity} {product.unit}</span>
                                </div>
                            </div>

                            {/* Price Tag */}
                            {hasPriceData && (
                                <div className="rounded-full p-3 mb-3 text-white" style={{ background: 'var(--lp-emerald)', boxShadow: 'inset 0 -3px 0 var(--lp-emerald-lip)' }}>
                                    <div className="text-xs font-medium opacity-90">{t('price_detective.total_price')}</div>
                                    <div className="lp-display text-2xl">${product.price.toFixed(2)}</div>
                                </div>
                            )}

                            {/* Unit Price Reveal */}
                            <div className={cn(
                                "transition-all duration-500 overflow-hidden",
                                showUnitPrices ? "max-h-32 opacity-100" : "max-h-0 opacity-0"
                            )}>
                                <div className="rounded-full p-3 flex items-center justify-between" style={{ background: 'var(--lp-indigo-soft)', border: '2px solid var(--lp-indigo)' }}>
                                    <div className="flex items-center gap-2">
                                        <Search className="w-5 h-5" style={{ color: 'var(--lp-indigo)' }} />
                                        <span className="text-sm font-bold" style={{ color: 'var(--lp-indigo-ink)' }}>
                                            {t('price_detective.unit_price')}
                                        </span>
                                    </div>
                                    <span className="lp-display text-xl" style={{ color: 'var(--lp-indigo-ink)' }}>
                                        ${unitPrice}
                                    </span>
                                </div>
                            </div>

                            {/* Selection Indicator */}
                            {isSelected && (
                                <div className="lp-badge absolute top-4 right-4 w-8 h-8 flex items-center justify-center animate-in zoom-in">
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
                    <div className="w-full max-w-md">
                        <QuestButton variant="gold" disabled={!selectedId || (hasPriceData && !showUnitPrices)} onClick={handleCheck}>
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
                        <QuestButton variant={feedback === 'success' ? 'go' : 'retry'} onClick={handleContinue}>
                            {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                            {feedback === 'success' ? <ArrowRight className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
                        </QuestButton>
                    </div>
                )}
            </div>
        </div>
    );
};
