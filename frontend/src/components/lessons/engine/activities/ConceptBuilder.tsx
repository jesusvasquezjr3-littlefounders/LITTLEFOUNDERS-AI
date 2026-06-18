import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, ArrowDown, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';
import { pickText } from './fieldText';
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
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');

    const content = exercise.content || {};
    // Orderable/selectable blocks live under many content keys across the corpus.
    const rawSource = content.concepts || content.items || content.components || content.pieces
        || content.blocks || content.steps || content.buildingBlocks || content.building_blocks
        || content.elements || content.options || content.parts || content.tags || [];

    // Multi-select mode: the answer is a SUBSET of ids, not an ordering.
    const SUBSET_KEYS = ['correctOptionIds', 'selectedIds', 'componentIds', 'correctComponentIds',
        'essentialIds', 'correctConceptIds', 'requiredIds', 'correctIds', 'correctComponents', 'correctStatementIds'];
    const isSelectMode = SUBSET_KEYS.some((k) => Array.isArray(exercise.correct_answer?.[k]));

    useEffect(() => {
        setFeedback('none');
        setSelected(new Set());
        const source = Array.isArray(rawSource) ? rawSource : [];
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [exercise]);

    const toggleSelect = (id: string) => {
        if (feedback !== 'none') return;
        playSound('ui_tap');
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const handleSelectCheck = () => {
        const isCorrect = onSubmit([...selected]);
        setFeedback(isCorrect ? 'success' : 'error');
    };

    const handleSelectContinue = () => {
        if (feedback === 'success') { onNext(); }
        else { setSelected(new Set()); setFeedback('none'); onRetry(); }
    };

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

    // ── Multi-select mode: pick the correct subset of blocks ──
    if (isSelectMode) {
        return (
            <div className="w-full max-w-2xl animate-slide-in-bottom flex flex-col items-center">
                <h3 className="lp-display text-xl sm:text-2xl mb-8 text-center text-[var(--lp-ink)]">
                    {content.instruction || content.question || t('instructions.concept_builder', { defaultValue: 'Selecciona los elementos correctos' })}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8 w-full">
                    {blocks.map((block) => {
                        const isSel = selected.has(block.id);
                        return (
                            <button
                                key={block.id}
                                onClick={() => toggleSelect(block.id)}
                                disabled={feedback !== 'none'}
                                className={cn(
                                    "lp-token lp-option lp-display text-left px-5 py-4 text-base text-[var(--lp-ink)]",
                                    "lp-option--indigo",
                                    isSel && "is-selected",
                                    feedback !== 'none' && "lp-token--locked"
                                )}
                            >
                                {pickText(block, ['label', 'text', 'name', 'title', 'item', 'word', 'term', 'value'])}
                            </button>
                        );
                    })}
                </div>
                <div className="w-full max-w-sm">
                    {feedback === 'none' ? (
                        <QuestButton variant="gold" disabled={selected.size === 0} onClick={handleSelectCheck}>
                            {t('actions.verify')}
                        </QuestButton>
                    ) : (
                        <QuestButton variant={feedback === 'success' ? 'go' : 'retry'} onClick={handleSelectContinue}>
                            {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                            {feedback === 'success' ? <ArrowRight className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
                        </QuestButton>
                    )}
                </div>
            </div>
        );
    }

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
                            {pickText(block, ['label', 'text', 'name', 'title', 'item', 'word', 'term', 'value'])}

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
