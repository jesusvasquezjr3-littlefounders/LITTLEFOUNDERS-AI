import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from '@/contexts/SoundContext';
import { QuestButton } from '../ui/QuestButton';
import { pickText } from './fieldText';

interface DragDropProps {
    exercise: any;
    onSubmit: (classifications: Record<string, string>) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const DragDrop = ({ exercise, onSubmit, onNext, onRetry }: DragDropProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const content = exercise?.content || {};
    const categories = content.categories || [];
    const items = content.items || [];

    const [classifications, setClassifications] = useState<Record<string, string>>({});
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');
    const [draggedId, setDraggedId] = useState<string | null>(null);

    useEffect(() => {
        setClassifications({});
        setFeedback('none');
        setDraggedId(null);
    }, [exercise]);

    const unassignedItems = items.filter((item: any) => !classifications[item.id]);

    const getCategoryItems = (catId: string) =>
        items.filter((item: any) => classifications[item.id] === catId);

    const handleDragStart = (e: React.DragEvent, itemId: string) => {
        if (feedback !== 'none') return;
        setDraggedId(itemId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', itemId);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, catId: string) => {
        e.preventDefault();
        if (feedback !== 'none') return;
        const itemId = e.dataTransfer.getData('text/plain') || draggedId;
        if (!itemId) return;
        playSound('ui_tap');
        setClassifications(prev => ({ ...prev, [itemId]: catId }));
        setDraggedId(null);
    };

    const handleDragEnd = () => {
        setDraggedId(null);
    };

    // Tap-to-assign for mobile (no drag support)
    const [pendingTap, setPendingTap] = useState<string | null>(null);

    const handleTapItem = (itemId: string) => {
        if (feedback !== 'none') return;
        if (pendingTap === itemId) {
            setPendingTap(null);
            return;
        }
        setPendingTap(itemId);
    };

    const handleTapCategory = (catId: string) => {
        if (feedback !== 'none' || !pendingTap) return;
        playSound('ui_tap');
        setClassifications(prev => ({ ...prev, [pendingTap]: catId }));
        setPendingTap(null);
    };

    const handleCheck = () => {
        if (unassignedItems.length > 0) {
            playSound('edu_error');
            return;
        }
        const isCorrect = onSubmit(classifications);
        setFeedback(isCorrect ? 'success' : 'error');
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            setClassifications({});
            setFeedback('none');
            setPendingTap(null);
            onRetry();
        }
    };

    const hueFor = (idx: number) => ['indigo', 'amber', 'emerald', 'coral'][idx % 4];

    return (
        <div className="w-full max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Items pool */}
            <div className="mb-6">
                <p className="lp-display text-xs mb-3 text-center" style={{ color: 'var(--lp-muted)' }}>
                    {t('drag_drop.items', { defaultValue: 'Elementos' })}
                </p>
                <div className="flex flex-wrap gap-2 sm:gap-3 justify-center min-h-[56px]">
                    {unassignedItems.map((item: any) => (
                        <div
                            key={item.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, item.id)}
                            onDragEnd={handleDragEnd}
                            onClick={() => handleTapItem(item.id)}
                            className={cn(
                                'lp-token px-4 py-2.5 cursor-grab active:cursor-grabbing select-none',
                                pendingTap === item.id && 'lp-option--indigo is-selected',
                                draggedId === item.id && 'opacity-50'
                            )}
                        >
                            <span className="lp-display text-sm" style={{ color: 'var(--lp-ink)' }}>
                                {pickText(item, ['text', 'name', 'label', 'title'])}
                            </span>
                        </div>
                    ))}
                    {unassignedItems.length === 0 && feedback === 'none' && (
                        <span className="lp-display text-sm" style={{ color: 'var(--lp-muted)' }}>
                            {t('drag_drop.all_assigned', { defaultValue: 'Todos asignados' })}
                        </span>
                    )}
                </div>
            </div>

            {/* Category drop zones */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                {categories.map((cat: any, idx: number) => {
                    const catItems = getCategoryItems(cat.id);
                    const hue = hueFor(idx);
                    return (
                        <div
                            key={cat.id}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, cat.id)}
                            onClick={() => handleTapCategory(cat.id)}
                            className={cn(
                                'min-h-[140px] p-4 rounded-[2rem] border-2 border-dashed transition-all',
                                pendingTap && 'cursor-pointer hover:scale-[1.02]'
                            )}
                            style={{
                                borderColor: `var(--lp-${hue})`,
                                background: `var(--lp-${hue}-soft)`,
                            }}
                        >
                            <h3 className="lp-display text-sm mb-3" style={{ color: 'var(--lp-ink)' }}>
                                {pickText(cat, ['text', 'name', 'label', 'title'])}
                            </h3>
                            <div className="space-y-2">
                                {catItems.map((item: any) => (
                                    <div
                                        key={item.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (feedback === 'none') {
                                                playSound('ui_tap');
                                                setClassifications(prev => {
                                                    const next = { ...prev };
                                                    delete next[item.id];
                                                    return next;
                                                });
                                            }
                                        }}
                                        className="lp-token px-3 py-2 cursor-pointer"
                                    >
                                        <span className="lp-display text-sm" style={{ color: 'var(--lp-ink)' }}>
                                            {pickText(item, ['text', 'name', 'label', 'title'])}
                                        </span>
                                    </div>
                                ))}
                                {catItems.length === 0 && (
                                    <p className="lp-display text-xs py-4 text-center" style={{ color: 'var(--lp-muted)' }}>
                                        {t('drag_drop.drop_here', { defaultValue: 'Suelta aquí' })}
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Actions */}
            <div className="flex justify-center">
                {feedback === 'none' ? (
                    <QuestButton
                        variant="gold"
                        onClick={handleCheck}
                        disabled={unassignedItems.length > 0}
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
