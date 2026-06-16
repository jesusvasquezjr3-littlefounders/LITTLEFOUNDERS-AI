import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, ArrowDown, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';
// Removed unused dnd import

// NOTE: Using simple click-to-order instead of heavy DnD library for simplicity in this swift implementation if possible.
// Or using native simple swap like Sequencing.tsx.
// Let's reuse Sequencing logic but horizontally/block building style.

interface ConceptBuilderProps {
    exercise: any;
    onSubmit: (sequence: string[]) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const ConceptBuilder = ({ exercise, onSubmit, onNext, onRetry }: ConceptBuilderProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [blocks, setBlocks] = useState<any[]>([]);
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');

    useEffect(() => {
        setFeedback('none');
        const source = exercise.content.concepts || exercise.content.items || [];
        if (source.length > 0) {
            // Shuffle
            const shuffled = [...source];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            setBlocks(shuffled);
        } else {
            setBlocks([]);
        }
    }, [exercise]);

    const moveBlock = (index: number, direction: 'left' | 'right') => {
        if (feedback !== 'none') return;

        playSound('ui_tap');
        const newBlocks = [...blocks];
        const targetIndex = direction === 'left' ? index - 1 : index + 1;

        if (targetIndex >= 0 && targetIndex < newBlocks.length) {
            [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];
            setBlocks(newBlocks);
        }
    };

    const handleCheck = () => {
        const currentIds = blocks.map(b => b.id);
        // Delegate validation to useLessonState via onSubmit (single source of truth)
        const isCorrect = onSubmit(currentIds);
        setFeedback(isCorrect ? 'success' : 'error');
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            // Reshuffle for retry
            const shuffled = [...blocks];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            setBlocks(shuffled);
            setFeedback('none');
            onRetry();
        }
    };

    return (
        <div className="w-full max-w-4xl animate-slide-in-bottom flex flex-col items-center">

            <h3 className="lp-display text-xl sm:text-2xl mb-8 text-center text-[var(--lp-ink)]">{exercise.content.instruction || exercise.content.question || t('instructions.concept_builder', { defaultValue: 'Ordena los elementos' })}</h3>

            {/* Blocks Row */}
            <div className="flex flex-col md:flex-row flex-wrap justify-center items-center gap-2 mb-10 w-full">
                {blocks.map((block, index) => (
                    <div key={block.id} className="flex flex-col md:flex-row items-center">

                        {/* The Block */}
                        <div className={cn(
                            "lp-display relative px-5 py-4 sm:px-6 text-center min-w-[120px]",
                            block.type === 'connector'
                                ? "lp-chip text-sm text-[var(--lp-muted)] px-4 py-2.5"
                                : "lp-token text-lg text-[var(--lp-ink)]",
                            feedback === 'success' && block.type !== 'connector' && "is-correct lp-option lp-option--emerald"
                        )}>
                            {block.label || block.text}

                            {/* Controls (Hidden if done) */}
                            {feedback === 'none' && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex gap-1 sm:opacity-0 sm:hover:opacity-100 opacity-100 transition-opacity lp-chip px-1.5 py-0.5">
                                    <button onClick={() => moveBlock(index, 'left')} className="p-1 text-[var(--lp-muted)] hover:text-[var(--lp-indigo)]" disabled={index === 0} aria-label={t('actions.move_left', { defaultValue: 'Mover izquierda' })}>←</button>
                                    <button onClick={() => moveBlock(index, 'right')} className="p-1 text-[var(--lp-muted)] hover:text-[var(--lp-indigo)]" disabled={index === blocks.length - 1} aria-label={t('actions.move_right', { defaultValue: 'Mover derecha' })}>→</button>
                                </div>
                            )}
                        </div>

                        {/* Visual Connector Arrow (except last) */}
                        {index < blocks.length - 1 && (
                            <ArrowRight className="hidden md:block w-6 h-6 text-[var(--lp-muted)] mx-2" />
                        )}
                        {index < blocks.length - 1 && (
                            <ArrowDown className="block md:hidden w-6 h-6 text-[var(--lp-muted)] my-2" />
                        )}
                    </div>
                ))}
            </div>

            {/* Actions */}
            <div className="w-full max-w-sm">
                {feedback === 'none' ? (
                    <QuestButton variant="gold" onClick={handleCheck}>
                        {t('actions.verify')}
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
