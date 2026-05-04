import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ShoppingCart, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

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

    const [cart, setCart] = useState<string[]>([]); // Product IDs
    const [totalSpent, setTotalSpent] = useState(0);
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error' | 'over_budget'>('none');

    useEffect(() => {
        setCart([]);
        setTotalSpent(0);
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

        // If already in cart, remove it (toggle)
        if (cart.includes(product.id)) {
            playSound('ui_tap');
            const newCart = cart.filter(id => id !== product.id);
            setCart(newCart);
            setTotalSpent(prev => prev - price);
        } else {
            // Check budget
            if (totalSpent + price > budget) {
                playSound('edu_error');
                return;
            }
            playSound('ui_tap');
            setCart([...cart, product.id]);
            setTotalSpent(prev => prev + price);
        }
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

    return (
        <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col items-center">

            {/* Header / HUD */}
            <div className="w-full flex justify-between items-center mb-6 bg-slate-900 text-white p-4 rounded-2xl shadow-lg">
                <div className="flex flex-col">
                    <span className="text-xs font-bold opacity-70 uppercase tracking-widest">{t('economy.budget')}</span>
                    <span className="text-3xl font-black text-green-400">${budget}</span>
                </div>

                <div className="flex flex-col items-end">
                    <span className="text-xs font-bold opacity-70 uppercase tracking-widest">{t('economy.spent')}</span>
                    <span className={cn("text-3xl font-black transition-colors", totalSpent > budget ? "text-red-500" : "text-white")}>
                        ${totalSpent}
                    </span>
                </div>
            </div>

            {/* Shelf */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full mb-8">
                {products.map((product: any) => {
                    const inCart = cart.includes(product.id);
                    return (
                        <button
                            key={product.id}
                            onClick={() => addToCart(product)}
                            className={cn(
                                "relative p-4 rounded-xl border-2 flex flex-col items-center transition-all duration-300",
                                inCart
                                    ? "bg-green-100 dark:bg-green-900/40 border-green-500 shadow-inner scale-95"
                                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:-translate-y-1 hover:shadow-md"
                            )}
                        >
                            <div className="h-20 w-20 mb-3 flex items-center justify-center">
                                {(product.image && (product.image.startsWith('http') || product.image.startsWith('/'))) ? (
                                    <img
                                        src={product.image}
                                        alt={product.name}
                                        className="w-full h-full object-contain drop-shadow-md"
                                    />
                                ) : (
                                    <span className="text-4xl">{product.image || '📦'}</span>
                                )}
                            </div>
                            <div className="font-bold text-slate-700 dark:text-slate-200 text-center leading-tight mb-1">{product.name}</div>
                            <div className="font-black text-green-600 dark:text-green-400 text-lg">${product.price}</div>

                            {inCart && (
                                <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1 shadow-sm animate-in zoom-in">
                                    <ShoppingCart className="w-4 h-4" />
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Actions */}
            {feedback === 'none' ? (
                <Button
                    onClick={handleCheck}
                    className="relative overflow-hidden w-full max-w-sm h-14 text-lg font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-2xl shadow-[0_4px_0_rgb(107,33,168)] hover:shadow-[0_2px_0_rgb(107,33,168)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all"
                >
                    <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                    <span className="relative flex items-center justify-center">{t('actions.buy')}</span>
                </Button>
            ) : (
                <Button
                    onClick={handleContinue}
                    className={cn(
                        "relative overflow-hidden w-full max-w-sm h-14 text-lg font-bold rounded-2xl transition-all",
                        feedback === 'success'
                            ? "bg-green-500 hover:bg-green-600 text-white shadow-[0_4px_0_rgb(22,101,52)]"
                            : "bg-orange-500 hover:bg-orange-600 text-white shadow-[0_4px_0_rgb(194,65,12)]",
                        "hover:translate-y-[2px] active:translate-y-1 active:shadow-none"
                    )}
                >
                    <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                    <span className="relative flex items-center justify-center">
                        {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                        <ArrowRight className="ml-2 w-5 h-5" />
                    </span>
                </Button>
            )}
        </div>
    );
};
