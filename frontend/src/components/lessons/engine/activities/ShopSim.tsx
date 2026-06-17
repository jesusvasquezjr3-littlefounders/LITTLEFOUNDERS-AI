import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { ShoppingCart, ArrowRight, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';
import { OptionCard, type OptionState } from '../ui/OptionCard';
import { resolveOptions } from './optionSource';

interface ShopSimProps {
    exercise: any;
    onSubmit: (cartIds: string[]) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const ShopSim = ({ exercise, onSubmit, onNext, onRetry }: ShopSimProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const content = exercise?.content || {};
    const budget = content.budget || 20;
    const products = content.products || content.items || [];
    // Some shop_sim lessons are really single-choice decisions (options / price_options /
    // money_options) with no purchasable products → render selectable choice cards.
    const choiceItems = products.length === 0
        ? resolveOptions(content, ['options', 'price_options', 'money_options', 'choices', 'offers'])
        : [];
    const isChoiceMode = choiceItems.length > 0;

    const [cart, setCart] = useState<string[]>([]); // Product IDs
    const [totalSpent, setTotalSpent] = useState(0);
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error' | 'over_budget'>('none');
    // Ref to track latest totalSpent without stale closure
    const totalRef = useRef(0);

    useEffect(() => {
        totalRef.current = totalSpent;
    }, [totalSpent]);

    useEffect(() => {
        setCart([]);
        setTotalSpent(0);
        totalRef.current = 0;
        setFeedback('none');
    }, [exercise]);

    const parsePrice = (price: any): number => {
        if (typeof price === 'number') return price;
        if (typeof price === 'string') {
            const cleaned = price.replace(/[$,\s]/g, '');
            const num = parseFloat(cleaned);
            return isNaN(num) ? 0 : num;
        }
        return 0;
    };

    const addToCart = (product: any) => {
        if (feedback !== 'none') return;
        const price = parsePrice(product.price);

        setCart(prevCart => {
            if (prevCart.includes(product.id)) {
                // Remove from cart
                playSound('ui_tap');
                setTotalSpent(prev => prev - price);
                return prevCart.filter(id => id !== product.id);
            } else {
                // Check budget using ref to avoid stale closure
                if (totalRef.current + price > budget) {
                    playSound('edu_error');
                    return prevCart;
                }
                playSound('ui_tap');
                setTotalSpent(prev => prev + price);
                return [...prevCart, product.id];
            }
        });
    };

    const handleCheck = () => {
        // Delegar validación a useLessonState via onSubmit (single source of truth)
        const isCorrect = onSubmit(cart);
        setFeedback(isCorrect ? 'success' : 'error');
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            setCart([]);
            setTotalSpent(0);
            setFeedback('none');
            onRetry();
        }
    };

    // ── Single-choice mode (decision / price / money pick) ──
    if (isChoiceMode) {
        const correctId = exercise.correct_answer?.correctOptionId ?? exercise.correct_answer?.optionId
            ?? exercise.correct_answer?.selectedProductId ?? exercise.correct_answer?.selectedId;
        const chosen = cart[0] ?? null;
        const optState = (id: string): OptionState => {
            if (feedback === 'none') return chosen === id ? 'selected' : 'idle';
            if (correctId != null && String(id) === String(correctId)) return 'correct';
            if (id === chosen) return 'wrong';
            return 'dimmed';
        };
        return (
            <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                    {choiceItems.map((opt: any, index: number) => (
                        <OptionCard
                            key={opt.id}
                            index={index}
                            text={opt.text}
                            state={optState(opt.id)}
                            onClick={() => { if (feedback === 'none') { setCart([opt.id]); playSound('ui_tap'); } }}
                            disabled={feedback !== 'none'}
                        />
                    ))}
                </div>
                {feedback === 'none' ? (
                    <QuestButton variant="gold" disabled={cart.length === 0} onClick={handleCheck}>
                        {t('actions.verify')}
                    </QuestButton>
                ) : (
                    <QuestButton variant={feedback === 'success' ? 'go' : 'retry'} onClick={handleContinue}>
                        {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                        {feedback === 'success' ? <ArrowRight className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
                    </QuestButton>
                )}
            </div>
        );
    }

    return (
        <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col items-center">

            {/* Header / HUD */}
            <div className="lp-card w-full flex justify-between items-center mb-6 p-4 sm:p-5">
                <div className="flex flex-col">
                    <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--lp-muted)' }}>{t('economy.budget')}</span>
                    <span className="lp-display text-3xl sm:text-4xl" style={{ color: 'var(--lp-amber-ink)' }}>${budget}</span>
                </div>

                <div className="flex flex-col items-end">
                    <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--lp-muted)' }}>{t('economy.spent')}</span>
                    <span
                        className="lp-display text-3xl sm:text-4xl transition-colors"
                        style={{ color: totalSpent > budget ? 'var(--lp-coral)' : 'var(--lp-ink)' }}
                    >
                        ${totalSpent}
                    </span>
                </div>
            </div>

            {/* Shelf */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 w-full mb-8">
                {products.map((product: any, index: number) => {
                    const inCart = cart.includes(product.id);
                    return (
                        <button
                            key={product.id}
                            onClick={() => addToCart(product)}
                            style={{ animationDelay: `${0.04 + index * 0.06}s` }}
                            className={cn(
                                "lp-token lp-option lp-option--amber relative p-3 sm:p-4 flex flex-col items-center",
                                "animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both",
                                feedback !== 'none' && "lp-token--locked",
                                inCart && "is-correct",
                            )}
                        >
                            <div className="h-24 w-24 sm:h-32 sm:w-32 mb-3 flex items-center justify-center">
                                {(product.image && (product.image.startsWith('http') || product.image.startsWith('/'))) ? (
                                    <img
                                        src={product.image}
                                        alt={product.name}
                                        className="w-full h-full object-contain drop-shadow-md"
                                    />
                                ) : (
                                    <span className="text-5xl sm:text-6xl">{product.image || '📦'}</span>
                                )}
                            </div>
                            <div className="lp-display text-center leading-tight mb-1" style={{ color: 'var(--lp-ink)' }}>{product.name}</div>
                            <div className="lp-display text-lg sm:text-xl" style={{ color: 'var(--lp-amber-ink)' }}>${product.price}</div>

                            {inCart && (
                                <div className="lp-badge absolute top-2 right-2 w-7 h-7 flex items-center justify-center animate-in zoom-in" style={{ background: 'var(--lp-emerald)' }}>
                                    <ShoppingCart className="w-4 h-4" />
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Actions */}
            <div className="w-full max-w-sm">
                {feedback === 'none' ? (
                    <QuestButton variant="gold" onClick={handleCheck}>
                        {t('actions.buy')}
                    </QuestButton>
                ) : (
                    <QuestButton variant={feedback === 'success' ? 'go' : 'retry'} onClick={handleContinue}>
                        {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                        {feedback === 'success' ? <ArrowRight className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
                    </QuestButton>
                )}
            </div>
        </div>
    );
};
