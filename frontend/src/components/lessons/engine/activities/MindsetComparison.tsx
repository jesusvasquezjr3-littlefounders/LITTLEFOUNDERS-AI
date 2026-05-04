import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, Brain } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

interface MindsetComparisonProps {
    exercise: any;
    onSubmit: (choiceId: string) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const MindsetComparison = ({ exercise, onSubmit, onNext, onRetry }: MindsetComparisonProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');

    const content = exercise?.content || {};

    // Detect format and build normalized mindsets with real IDs
    let mindsets: { id: string; label: string; text: string; consequences: string[]; color: 'red' | 'green' }[] = [];

    // Format 1: pair.left / pair.right
    if (content.pair?.left && content.pair?.right) {
        mindsets = [
            { id: String(content.pair.left.id || 'left'), label: t('mindset_comparison.scarcity', { defaultValue: 'Mentalidad de Escasez' }), text: content.pair.left.text || '', consequences: [], color: 'red' },
            { id: String(content.pair.right.id || 'right'), label: t('mindset_comparison.abundance', { defaultValue: 'Mentalidad de Abundancia' }), text: content.pair.right.text || '', consequences: [], color: 'green' },
        ];
    }
    // Format 2: mindsetA / mindsetB
    else if (content.mindsetA && content.mindsetB) {
        mindsets = [
            { id: 'A', label: content.mindsetA.name || 'A', text: content.mindsetA.description || '', consequences: [], color: 'red' },
            { id: 'B', label: content.mindsetB.name || 'B', text: content.mindsetB.description || '', consequences: [], color: 'green' },
        ];
    }
    // Format 3: mindset_a / mindset_b with IDs
    else if (content.mindset_a && content.mindset_b) {
        mindsets = [
            { id: String(content.mindset_a.id || 'ma'), label: content.mindset_a.name || 'A', text: content.mindset_a.description || '', consequences: [], color: 'red' },
            { id: String(content.mindset_b.id || 'mb'), label: content.mindset_b.name || 'B', text: content.mindset_b.description || '', consequences: [], color: 'green' },
        ];
    }
    // Format 4: legacy scenario with scarcity/abundance
    else {
        const scarcity = content.scarcity || { thought: '', consequences: [] };
        const abundance = content.abundance || { thought: '', consequences: [] };
        mindsets = [
            { id: 'scarcity', label: t('mindset_comparison.scarcity', { defaultValue: 'Mentalidad de Escasez' }), text: scarcity.thought || '', consequences: scarcity.consequences || [], color: 'red' },
            { id: 'abundance', label: t('mindset_comparison.abundance', { defaultValue: 'Mentalidad de Abundancia' }), text: abundance.thought || '', consequences: abundance.consequences || [], color: 'green' },
        ];
    }

    const scenarioText = content.instruction || content.scenario || content.question || '';

    useEffect(() => {
        setSelectedId(null);
        setFeedback('none');
    }, [exercise]);

    const handleSelect = (id: string) => {
        setSelectedId(id);
        playSound('ui_tap');
    };

    const handleSubmit = () => {
        if (!selectedId) return;
        const isCorrect = onSubmit(selectedId);
        setFeedback(isCorrect ? 'success' : 'error');
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            setSelectedId(null);
            setFeedback('none');
            onRetry();
        }
    };

    const colorClasses: Record<string, { selected: string; unselected: string; label: string; badge: string }> = {
        red: {
            selected: 'bg-red-100 dark:bg-red-950 border-red-500 scale-105 shadow-xl',
            unselected: 'opacity-50',
            label: 'text-red-700 dark:text-red-400',
            badge: 'text-red-600',
        },
        green: {
            selected: 'bg-green-100 dark:bg-green-950 border-green-500 scale-105 shadow-xl',
            unselected: 'opacity-50',
            label: 'text-green-700 dark:text-green-400',
            badge: 'text-green-600',
        },
    };

    return (
        <div className="w-full max-w-5xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Scenario / Instruction */}
            {scenarioText && (
                <div className="mb-6 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-950/30 dark:to-purple-950/30 border-2 border-blue-500 dark:border-blue-700 rounded-2xl p-6">
                    <div className="flex items-center gap-2 mb-3">
                        <Brain className="w-6 h-6 text-blue-600" />
                        <h3 className="text-lg font-black text-blue-900 dark:text-blue-100">
                            {t('mindset_comparison.scenario', { defaultValue: 'Escenario' })}
                        </h3>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300">
                        {scenarioText}
                    </p>
                </div>
            )}

            {/* Mindset Comparison */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {mindsets.map((mindset) => {
                    const isSelected = selectedId === mindset.id;
                    const otherSelected = selectedId !== null && selectedId !== mindset.id;
                    const colors = colorClasses[mindset.color] || colorClasses.red;

                    return (
                        <div
                            key={mindset.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleSelect(mindset.id)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelect(mindset.id); }}
                            className={cn(
                                "p-6 rounded-2xl border-2 transition-all text-left relative overflow-hidden cursor-pointer",
                                isSelected && colors.selected,
                                otherSelected && colors.unselected,
                                !selectedId && "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-300"
                            )}
                        >
                            <div className={`absolute top-0 right-0 w-32 h-32 rounded-full -mr-16 -mt-16 ${mindset.color === 'green' ? 'bg-green-500/10' : 'bg-red-500/10'}`}></div>

                            <div className="relative">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="text-3xl">{mindset.color === 'green' ? '😊' : '😰'}</span>
                                    <h3 className={`text-xl font-black ${colors.label}`}>
                                        {mindset.label}
                                    </h3>
                                </div>

                                {mindset.text && (
                                    <div className="mb-4">
                                        <div className={`text-sm font-bold mb-2 ${colors.badge}`}>
                                            {t('mindset_comparison.response', { defaultValue: 'Respuesta' })}:
                                        </div>
                                        <p className="text-sm text-slate-700 dark:text-slate-300 italic">
                                            "{mindset.text}"
                                        </p>
                                    </div>
                                )}

                                {mindset.consequences.length > 0 && (
                                    <div className="mb-4">
                                        <div className={`text-sm font-bold mb-2 ${colors.badge}`}>
                                            {t('mindset_comparison.consequences', { defaultValue: 'Consecuencias' })}:
                                        </div>
                                        <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                                            {mindset.consequences.map((consequence: string, idx: number) => (
                                                <li key={idx}>{mindset.color === 'green' ? '✅' : '❌'} {consequence}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center">
                {feedback === 'none' ? (
                    <Button
                        onClick={handleSubmit}
                        disabled={!selectedId}
                        className="relative overflow-hidden w-full max-w-md h-12 text-base font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-2xl shadow-[0_4px_0_rgb(107,33,168)] hover:shadow-[0_2px_0_rgb(107,33,168)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all disabled:opacity-50"
                    >
                        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                        <span className="relative flex items-center justify-center">
                            {t('actions.compare', { defaultValue: 'Comparar' })}
                            <ArrowRight className="ml-2 w-5 h-5" />
                        </span>
                    </Button>
                ) : (
                    <div className="flex flex-col items-center w-full">
                        <p className={cn("font-bold text-lg mb-3", feedback === 'success' ? "text-green-500" : "text-red-500")}>
                            {feedback === 'success' ? t('feedback.success', { defaultValue: '¡Correcto!' }) : t('feedback.error', { defaultValue: 'Inténtalo de nuevo' })}
                        </p>
                        <div className="mb-4 p-4 bg-purple-50 dark:bg-purple-950/30 border-2 border-purple-300 dark:border-purple-700 rounded-xl max-w-2xl">
                            <p className="text-sm text-purple-900 dark:text-purple-100 text-center">
                                {feedback === 'success'
                                    ? t('mindset_comparison.feedback_abundance', { defaultValue: '¡Mentalidad de abundancia! Piensa en largo plazo.' })
                                    : t('mindset_comparison.feedback_scarcity', { defaultValue: 'La mentalidad de escasez limita tu potencial.' })
                                }
                            </p>
                        </div>

                        <Button
                            onClick={handleContinue}
                            className="relative overflow-hidden w-full max-w-md h-12 text-base font-bold bg-green-500 hover:bg-green-600 text-white rounded-2xl shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all"
                        >
                            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                            <span className="relative flex items-center justify-center">
                                {t('actions.continue', { defaultValue: 'Continuar' })}
                                <ArrowRight className="ml-2 w-5 h-5" />
                            </span>
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};
