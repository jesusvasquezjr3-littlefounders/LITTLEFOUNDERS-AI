import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, Brain } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';
import { pickText } from './fieldText';

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
            { id: String(content.pair.left.id || 'left'), label: t('mindset_comparison.scarcity', { defaultValue: 'Mentalidad de Escasez' }), text: pickText(content.pair.left, ['text', 'description', 'thought', 'label', 'name']), consequences: [], color: 'red' },
            { id: String(content.pair.right.id || 'right'), label: t('mindset_comparison.abundance', { defaultValue: 'Mentalidad de Abundancia' }), text: pickText(content.pair.right, ['text', 'description', 'thought', 'label', 'name']), consequences: [], color: 'green' },
        ];
    }
    // Format 2: mindsetA / mindsetB
    else if (content.mindsetA && content.mindsetB) {
        mindsets = [
            { id: 'A', label: pickText(content.mindsetA, ['name', 'label', 'text', 'title']) || 'A', text: pickText(content.mindsetA, ['description', 'text', 'thought', 'label']), consequences: [], color: 'red' },
            { id: 'B', label: pickText(content.mindsetB, ['name', 'label', 'text', 'title']) || 'B', text: pickText(content.mindsetB, ['description', 'text', 'thought', 'label']), consequences: [], color: 'green' },
        ];
    }
    // Format 3: mindset_a / mindset_b with IDs
    else if (content.mindset_a && content.mindset_b) {
        mindsets = [
            { id: String(content.mindset_a.id || 'ma'), label: pickText(content.mindset_a, ['name', 'label', 'text', 'title']) || 'A', text: pickText(content.mindset_a, ['description', 'text', 'thought', 'label']), consequences: [], color: 'red' },
            { id: String(content.mindset_b.id || 'mb'), label: pickText(content.mindset_b, ['name', 'label', 'text', 'title']) || 'B', text: pickText(content.mindset_b, ['description', 'text', 'thought', 'label']), consequences: [], color: 'green' },
        ];
    }
    // Format 3b: approachA/approachB or approach_a/approach_b
    else if ((content.approachA && content.approachB) || (content.approach_a && content.approach_b)) {
        const a = content.approachA || content.approach_a;
        const b = content.approachB || content.approach_b;
        mindsets = [
            { id: String(a.id || 'A'), label: pickText(a, ['name', 'title', 'label', 'text']) || 'A', text: pickText(a, ['description', 'text', 'thought', 'label']), consequences: [], color: 'red' },
            { id: String(b.id || 'B'), label: pickText(b, ['name', 'title', 'label', 'text']) || 'B', text: pickText(b, ['description', 'text', 'thought', 'label']), consequences: [], color: 'green' },
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

    const colorClasses: Record<string, { hue: string; label: string; badge: string }> = {
        red: {
            hue: 'lp-option--coral',
            label: 'text-[var(--lp-coral-ink)]',
            badge: 'text-[var(--lp-coral-ink)]',
        },
        green: {
            hue: 'lp-option--emerald',
            label: 'text-[var(--lp-emerald-ink)]',
            badge: 'text-[var(--lp-emerald-ink)]',
        },
    };

    return (
        <div className="w-full max-w-5xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Scenario / Instruction */}
            {scenarioText && (
                <div className="lp-card mb-6 p-5 sm:p-6">
                    <div className="flex items-center gap-3 mb-3">
                        <span className="lp-badge lp-option--indigo shrink-0 w-11 h-11 sm:w-12 sm:h-12 flex items-center justify-center">
                            <Brain className="w-6 h-6 sm:w-7 sm:h-7" />
                        </span>
                        <h3 className="lp-display text-lg sm:text-xl text-[var(--lp-ink)]">
                            {t('mindset_comparison.scenario', { defaultValue: 'Escenario' })}
                        </h3>
                    </div>
                    <p className="text-[var(--lp-muted)] text-base leading-relaxed">
                        {scenarioText}
                    </p>
                </div>
            )}

            {/* Mindset Comparison */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                {mindsets.map((mindset) => {
                    const isSelected = selectedId === mindset.id;
                    const otherSelected = selectedId !== null && selectedId !== mindset.id;
                    const colors = colorClasses[mindset.color] || colorClasses.red;

                    return (
                        <button
                            key={mindset.id}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => handleSelect(mindset.id)}
                            className={cn(
                                "lp-token lp-option p-5 sm:p-6 text-left relative overflow-hidden",
                                "animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both",
                                colors.hue,
                                isSelected && "is-selected",
                                otherSelected && "is-dimmed",
                            )}
                        >
                            <div className="relative">
                                <div className="flex items-center gap-3 mb-4">
                                    <span className="text-4xl sm:text-5xl leading-none">{mindset.color === 'green' ? '😊' : '😰'}</span>
                                    <h3 className={`lp-display text-xl sm:text-2xl ${colors.label}`}>
                                        {mindset.label}
                                    </h3>
                                </div>

                                {mindset.text && (
                                    <div className="mb-4">
                                        <div className={`lp-display text-sm mb-2 ${colors.badge}`}>
                                            {t('mindset_comparison.response', { defaultValue: 'Respuesta' })}:
                                        </div>
                                        <p className="text-sm text-[var(--lp-muted)] italic leading-relaxed">
                                            "{mindset.text}"
                                        </p>
                                    </div>
                                )}

                                {mindset.consequences.length > 0 && (
                                    <div className="mb-4">
                                        <div className={`lp-display text-sm mb-2 ${colors.badge}`}>
                                            {t('mindset_comparison.consequences', { defaultValue: 'Consecuencias' })}:
                                        </div>
                                        <ul className="text-xs text-[var(--lp-muted)] space-y-1">
                                            {mindset.consequences.map((consequence: string, idx: number) => (
                                                <li key={idx}>{mindset.color === 'green' ? '✅' : '❌'} {consequence}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center">
                {feedback === 'none' ? (
                    <div className="w-full max-w-md">
                        <QuestButton variant="gold" disabled={!selectedId} onClick={handleSubmit}>
                            {t('actions.compare', { defaultValue: 'Comparar' })}
                            <ArrowRight className="w-5 h-5" />
                        </QuestButton>
                    </div>
                ) : (
                    <div className="flex flex-col items-center w-full">
                        <p
                            className="lp-display text-lg mb-3"
                            style={{ color: feedback === 'success' ? 'var(--lp-emerald)' : 'var(--lp-coral)' }}
                        >
                            {feedback === 'success' ? t('feedback.success', { defaultValue: '¡Correcto!' }) : t('feedback.error', { defaultValue: 'Inténtalo de nuevo' })}
                        </p>
                        <div
                            className="lp-card mb-4 p-4 max-w-2xl"
                            style={feedback === 'success'
                                ? { background: 'var(--lp-emerald-soft)', borderColor: 'var(--lp-emerald)' }
                                : { background: 'var(--lp-coral-soft)', borderColor: 'var(--lp-coral)' }}
                        >
                            <p
                                className="text-sm text-center"
                                style={{ color: feedback === 'success' ? 'var(--lp-emerald-ink)' : 'var(--lp-coral-ink)' }}
                            >
                                {feedback === 'success'
                                    ? t('mindset_comparison.feedback_abundance', { defaultValue: '¡Mentalidad de abundancia! Piensa en largo plazo.' })
                                    : t('mindset_comparison.feedback_scarcity', { defaultValue: 'La mentalidad de escasez limita tu potencial.' })
                                }
                            </p>
                        </div>

                        <div className="w-full max-w-md">
                            <QuestButton variant={feedback === 'success' ? 'go' : 'retry'} onClick={handleContinue}>
                                {t('actions.continue', { defaultValue: 'Continuar' })}
                                <ArrowRight className="w-5 h-5" />
                            </QuestButton>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
