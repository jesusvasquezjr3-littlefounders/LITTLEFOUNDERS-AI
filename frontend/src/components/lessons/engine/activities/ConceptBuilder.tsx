import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, ArrowDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
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
        if (exercise.content.concepts) {
            // Shuffle
            const shuffled = [...exercise.content.concepts];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            setBlocks(shuffled);
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

            <h3 className="text-xl font-bold mb-8 text-center">{exercise.content.question || t('instructions.concept_builder')}</h3>

            {/* Blocks Row */}
            <div className="flex flex-col md:flex-row flex-wrap justify-center items-center gap-2 mb-10 w-full">
                {blocks.map((block, index) => (
                    <div key={block.id} className="flex flex-col md:flex-row items-center">

                        {/* The Block */}
                        <div className={cn(
                            "relative px-6 py-4 rounded-xl border-b-4 font-bold text-center min-w-[120px] transition-all",
                            block.type === 'connector'
                                ? "bg-slate-100 text-slate-500 border-slate-300 text-sm"
                                : "bg-white dark:bg-slate-800 border-purple-200 dark:border-purple-900 shadow-sm text-lg",
                            feedback === 'success' && "border-green-400 bg-green-50 dark:bg-green-900/20"
                        )}>
                            {block.label}

                            {/* Controls (Hidden if done) */}
                            {feedback === 'none' && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex gap-1 opacity-0 hover:opacity-100 transition-opacity bg-white shadow-sm rounded-full px-1">
                                    <button onClick={() => moveBlock(index, 'left')} className="p-1 hover:text-purple-600" disabled={index === 0}>←</button>
                                    <button onClick={() => moveBlock(index, 'right')} className="p-1 hover:text-purple-600" disabled={index === blocks.length - 1}>→</button>
                                </div>
                            )}
                        </div>

                        {/* Visual Connector Arrow (except last) */}
                        {index < blocks.length - 1 && (
                            <ArrowRight className="hidden md:block w-6 h-6 text-slate-300 mx-2" />
                        )}
                        {index < blocks.length - 1 && (
                            <ArrowDown className="block md:hidden w-6 h-6 text-slate-300 my-2" />
                        )}
                    </div>
                ))}
            </div>

            {/* Actions */}
            {feedback === 'none' ? (
                <Button
                    onClick={handleCheck}
                    className="relative overflow-hidden w-full max-w-sm h-14 text-lg font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-2xl shadow-[0_4px_0_rgb(107,33,168)] hover:shadow-[0_2px_0_rgb(107,33,168)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all"
                >
                    <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                    <span className="relative flex items-center justify-center">{t('actions.verify')}</span>
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
