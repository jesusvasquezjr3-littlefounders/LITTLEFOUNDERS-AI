import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, RotateCcw, GripVertical, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';
import { pickText } from './fieldText';
import { Reorder } from 'framer-motion';

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
    const rawSource = content.concepts || content.items || content.components || content.pieces
        || content.blocks || content.steps || content.buildingBlocks || content.building_blocks
        || content.elements || content.options || content.parts || content.tags || [];

    const SUBSET_KEYS = ['correctOptionIds', 'selectedIds', 'componentIds', 'correctComponentIds',
        'essentialIds', 'correctConceptIds', 'requiredIds', 'correctIds', 'correctComponents', 'correctStatementIds'];
    const isSelectMode = SUBSET_KEYS.some((k) => Array.isArray(exercise.correct_answer?.[k]));

    useEffect(() => {
        setFeedback('none');
        setSelected(new Set());
        const source = Array.isArray(rawSource) ? rawSource : [];
        if (source.length > 0) {
            // Shuffle initially
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

    const handleCheck = () => {
        const currentIds = blocks.map(b => b.id);
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

    const titleText = exercise.content.instruction || exercise.content.question || t('instructions.concept_builder', { defaultValue: 'Ordena los elementos' });

    // Multi-select mode
    if (isSelectMode) {
        return (
            <div className="w-full max-w-2xl animate-slide-in-bottom flex flex-col items-center">
                <h3 className="lp-display text-xl sm:text-2xl mb-8 text-center text-[var(--lp-ink)]">
                    {titleText}
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
                                    "lp-token lp-option lp-display text-left px-5 py-4 text-base text-[var(--lp-ink)] rounded-2xl transition-all",
                                    "lp-option--indigo",
                                    isSel && "is-selected ring-2 ring-indigo-500",
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
                            {t('actions.verify', { defaultValue: 'Comprobar' })}
                        </QuestButton>
                    ) : (
                        <QuestButton variant={feedback === 'success' ? 'go' : 'retry'} onClick={handleSelectContinue}>
                            {feedback === 'success' ? t('actions.continue', { defaultValue: 'Continuar' }) : t('actions.retry', { defaultValue: 'Reintentar' })}
                            {feedback === 'success' ? <ArrowRight className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
                        </QuestButton>
                    )}
                </div>
            </div>
        );
    }

    // Drag & Drop Reorder Mode
    return (
        <div className="w-full max-w-3xl animate-slide-in-bottom flex flex-col items-center">
            <h3 className="lp-display text-xl sm:text-2xl mb-4 text-center text-[var(--lp-ink)]">
                {titleText}
            </h3>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 text-center">
                {t('concept_builder.drag_hint', { defaultValue: '🖐️ Mueve o arrastra cada bloque para colocarlo en la posición correcta' })}
            </p>

            {/* Drag & Drop Reorder List */}
            <Reorder.Group
                axis="y"
                values={blocks}
                onReorder={setBlocks}
                className="space-y-3 mb-8 w-full max-w-xl"
            >
                {blocks.map((block, index) => {
                    const text = pickText(block, ['label', 'text', 'name', 'title', 'item', 'word', 'term', 'value']);

                    return (
                        <Reorder.Item
                            key={block.id}
                            value={block}
                            dragListener={feedback === 'none'}
                            className={cn(
                                "bg-white rounded-[2rem] shadow-sm flex items-center gap-3 p-4 border transition-all duration-300",
                                feedback === 'none' && "cursor-grab active:cursor-grabbing hover:shadow-md border-slate-200 dark:border-white/10",
                                feedback === 'success' && "border-[var(--lp-emerald)] bg-[var(--lp-emerald-soft)]",
                                feedback === 'error' && "border-[var(--lp-coral)] bg-[var(--lp-coral-soft)]"
                            )}
                        >
                            {/* Grip Handle */}
                            {feedback === 'none' && (
                                <div className="text-slate-400 hover:text-slate-600 touch-none shrink-0 cursor-grab active:cursor-grabbing">
                                    <GripVertical className="w-6 h-6" />
                                </div>
                            )}

                            {/* Order Badge */}
                            <div
                                className="lp-badge lp-display w-9 h-9 rounded-full flex items-center justify-center text-base font-bold shrink-0 text-white"
                                style={{
                                    background: feedback === 'success'
                                        ? 'var(--lp-emerald)'
                                        : feedback === 'error'
                                            ? 'var(--lp-coral)'
                                            : 'var(--lp-indigo)'
                                }}
                            >
                                {index + 1}
                            </div>

                            {/* Content */}
                            <div className="lp-display flex-1 text-base sm:text-lg font-semibold" style={{ color: "var(--lp-ink)" }}>
                                {text}
                            </div>

                            {/* Result Icon */}
                            {feedback === 'success' && (
                                <Check className="w-6 h-6 shrink-0" strokeWidth={3} style={{ color: "var(--lp-emerald-ink)" }} />
                            )}
                        </Reorder.Item>
                    );
                })}
            </Reorder.Group>

            {/* Action Buttons */}
            <div className="w-full max-w-sm">
                {feedback === 'none' ? (
                    <QuestButton variant="gold" onClick={handleCheck}>
                        {t('actions.verify', { defaultValue: 'Comprobar' })}
                    </QuestButton>
                ) : (
                    <QuestButton
                        variant={feedback === 'success' ? 'go' : 'retry'}
                        onClick={handleContinue}
                    >
                        {feedback === 'success' ? t('actions.continue', { defaultValue: 'Continuar' }) : t('actions.retry', { defaultValue: 'Reintentar' })}
                        {feedback === 'success' ? <ArrowRight className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
                    </QuestButton>
                )}
            </div>
        </div>
    );
};
