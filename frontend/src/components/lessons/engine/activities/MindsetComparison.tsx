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

    // Helper to extract text safely from an object
    const getText = (obj: any, keys: string[]) => (obj ? pickText(obj, keys) || '' : '');

    // Detect format and build normalized mindsets with real IDs and labels
    let mindsets: { id: string; label: string; text: string; consequences: string[]; color: 'red' | 'green' }[] = [];

    // Format 1: pair with mindsetA / mindsetB or mindset_a / mindset_b or left / right
    if (content.pair) {
        const p = content.pair;
        const a = p.mindsetA || p.mindset_a || p.left || p.a || p.optionA;
        const b = p.mindsetB || p.mindset_b || p.right || p.b || p.optionB;
        if (a && b) {
            mindsets = [
                {
                    id: String(a.id || 'A'),
                    label: getText(a, ['name', 'label', 'title', 'heading', 'type', 'mindset']) || t('mindset_comparison.option_a', { defaultValue: 'Mentalidad A' }),
                    text: getText(a, ['text', 'description', 'thought', 'label', 'name', 'detail']),
                    consequences: Array.isArray(a.consequences) ? a.consequences : [],
                    color: 'green'
                },
                {
                    id: String(b.id || 'B'),
                    label: getText(b, ['name', 'label', 'title', 'heading', 'type', 'mindset']) || t('mindset_comparison.option_b', { defaultValue: 'Mentalidad B' }),
                    text: getText(b, ['text', 'description', 'thought', 'label', 'name', 'detail']),
                    consequences: Array.isArray(b.consequences) ? b.consequences : [],
                    color: 'red'
                }
            ];
        }
    }

    // Format 2: direct mindsetA / mindsetB or mindset_a / mindset_b or approachA / approachB
    if (mindsets.length === 0 && (content.mindsetA || content.mindset_a || content.approachA || content.approach_a)) {
        const a = content.mindsetA || content.mindset_a || content.approachA || content.approach_a;
        const b = content.mindsetB || content.mindset_b || content.approachB || content.approach_b;
        if (a && b) {
            mindsets = [
                {
                    id: String(a.id || 'A'),
                    label: getText(a, ['name', 'label', 'title', 'heading', 'type']) || t('mindset_comparison.option_a', { defaultValue: 'Mentalidad A' }),
                    text: getText(a, ['text', 'description', 'thought', 'label', 'name']),
                    consequences: Array.isArray(a.consequences) ? a.consequences : [],
                    color: 'green'
                },
                {
                    id: String(b.id || 'B'),
                    label: getText(b, ['name', 'label', 'title', 'heading', 'type']) || t('mindset_comparison.option_b', { defaultValue: 'Mentalidad B' }),
                    text: getText(b, ['text', 'description', 'thought', 'label', 'name']),
                    consequences: Array.isArray(b.consequences) ? b.consequences : [],
                    color: 'red'
                }
            ];
        }
    }

    // Format 3: Array of mindsets or options
    if (mindsets.length === 0 && (Array.isArray(content.mindsets) || Array.isArray(content.options) || Array.isArray(content.pairs))) {
        const arr = content.mindsets || content.options || content.pairs;
        mindsets = arr.slice(0, 2).map((item: any, idx: number) => ({
            id: String(item.id || (idx === 0 ? 'A' : 'B')),
            label: getText(item, ['name', 'label', 'title', 'heading', 'type']) || (idx === 0 ? 'Mentalidad A' : 'Mentalidad B'),
            text: getText(item, ['text', 'description', 'thought', 'label', 'name']),
            consequences: Array.isArray(item.consequences) ? item.consequences : [],
            color: idx === 0 ? 'green' : 'red'
        }));
    }

    // Format 4: Legacy scarcity / abundance fallback
    if (mindsets.length === 0) {
        const scarcity = content.scarcity || { thought: '', consequences: [] };
        const abundance = content.abundance || { thought: '', consequences: [] };
        mindsets = [
            { id: 'scarcity', label: t('mindset_comparison.scarcity', { defaultValue: 'Mentalidad de Escasez' }), text: getText(scarcity, ['thought', 'text', 'description']), consequences: scarcity.consequences || [], color: 'red' },
            { id: 'abundance', label: t('mindset_comparison.abundance', { defaultValue: 'Mentalidad de Abundancia' }), text: getText(abundance, ['thought', 'text', 'description']), consequences: abundance.consequences || [], color: 'green' },
        ];
    }

    const scenarioText = content.instruction || content.scenario || content.question || content.statement || '';

    useEffect(() => {
        setSelectedId(null);
        setFeedback('none');
    }, [exercise]);

    const handleSelect = (id: string) => {
        if (feedback !== 'none') return;
        setSelectedId(id);
        playSound('ui_tap');
    };

    const handleSubmit = () => {
        if (!selectedId) return;
        
        const validated = onSubmit(selectedId);
        
        // If exercise lacks explicit correct_answer in JSON, evaluate based on green/positive mindset
        const hasExplicitCorrectAnswer = Boolean(exercise.correct_answer || exercise.content?.correct_answer);
        let isCorrect = validated;
        if (!hasExplicitCorrectAnswer) {
            const selectedMindset = mindsets.find(m => m.id === selectedId);
            isCorrect = selectedMindset ? selectedMindset.color === 'green' : true;
        }

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

    const getFeedbackMessage = () => {
        const fb = exercise.feedback || content.feedback;
        if (fb) {
            if (typeof fb === 'string') return fb;
            if (selectedId && fb[selectedId]) return fb[selectedId];
            if (feedback === 'success' && fb.success && fb.success !== '🎉 CONTINUAR') return fb.success;
            if (feedback === 'error' && fb.error && fb.error !== '🔄 REINTENTAR') return fb.error;
        }
        const selectedMindset = mindsets.find(m => m.id === selectedId);
        if (feedback === 'success') {
            return selectedMindset?.text
                ? `¡Excelente! "${selectedMindset.text}" demuestra una mentalidad financiera recomendable.`
                : t('mindset_comparison.feedback_abundance', { defaultValue: '¡Mentalidad de abundancia! Piensa en el futuro y construye valor.' });
        } else {
            return selectedMindset?.text
                ? `"${selectedMindset.text}" refleja una postura que puede perjudicar tu estabilidad.`
                : t('mindset_comparison.feedback_scarcity', { defaultValue: 'La mentalidad de escasez o gasto sin control limita tu potencial.' });
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
                <div className="bg-white rounded-[2.5rem] shadow-sm mb-6 p-5 sm:p-6">
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

            {/* Mindset Comparison Grid */}
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
                            disabled={feedback !== 'none'}
                            className={cn(
                                "lp-token lp-option p-5 sm:p-6 text-left relative overflow-hidden transition-all duration-300",
                                "animate-in fade-in slide-in-from-bottom-3 duration-500 fill-mode-both",
                                colors.hue,
                                isSelected && "is-selected ring-4 ring-offset-2 ring-indigo-500/30",
                                otherSelected && "is-dimmed opacity-60",
                                feedback === 'success' && isSelected && "ring-emerald-500",
                                feedback === 'error' && isSelected && "ring-rose-500 lp-shake"
                            )}
                        >
                            <div className="relative">
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="text-3xl sm:text-4xl leading-none">{mindset.color === 'green' ? '💡' : '⚠️'}</span>
                                    <h3 className={`lp-display text-lg sm:text-xl ${colors.label}`}>
                                        {mindset.label}
                                    </h3>
                                </div>

                                {mindset.text && (
                                    <div className="mb-2">
                                        <p className="text-base text-slate-800 dark:text-slate-100 font-medium leading-relaxed">
                                            {mindset.text}
                                        </p>
                                    </div>
                                )}

                                {mindset.consequences.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/5">
                                        <div className={`lp-display text-xs mb-1.5 ${colors.badge}`}>
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

            {/* Action Buttons & Feedback */}
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
                            className="lp-display text-lg mb-2"
                            style={{ color: feedback === 'success' ? 'var(--lp-emerald-ink)' : 'var(--lp-coral-ink)' }}
                        >
                            {feedback === 'success' ? t('feedback.success', { defaultValue: '¡Excelente Elección!' }) : t('feedback.error', { defaultValue: 'Inténtalo de nuevo' })}
                        </p>
                        <div
                            className="bg-white rounded-[2rem] shadow-sm mb-4 p-4 max-w-2xl border w-full text-center"
                            style={feedback === 'success'
                                ? { background: 'var(--lp-emerald-soft)', borderColor: 'var(--lp-emerald)' }
                                : { background: 'var(--lp-coral-soft)', borderColor: 'var(--lp-coral)' }}
                        >
                            <p
                                className="text-sm font-medium leading-relaxed"
                                style={{ color: feedback === 'success' ? 'var(--lp-emerald-ink)' : 'var(--lp-coral-ink)' }}
                            >
                                {getFeedbackMessage()}
                            </p>
                        </div>

                        <div className="w-full max-w-md">
                            <QuestButton variant={feedback === 'success' ? 'go' : 'retry'} onClick={handleContinue}>
                                {feedback === 'success' ? t('actions.continue', { defaultValue: 'Continuar' }) : t('actions.retry', { defaultValue: 'Reintentar' })}
                                <ArrowRight className="w-5 h-5" />
                            </QuestButton>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

