import { useState, useEffect } from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { extractCorrectId } from '../hooks/useLessonState';
import { OptionCard, type OptionState } from '../ui/OptionCard';
import { QuestButton } from '../ui/QuestButton';
import { resolveOptions } from './optionSource';

interface GenericChoiceProps {
    exercise: any;
    onSubmit: (answer: string) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

/**
 * GenericChoice — single-select renderer for choice-style exercise types that
 * previously had NO component and fell to the "exercise in development" skip card:
 * comparison, compare, comparison_*, case_study, case_real, decision_challenge,
 * decision_matrix. All are "pick the best option" tasks graded centrally by
 * validateAnswer's option-based case. Options are resolved from any content shape
 * via resolveOptions; if none are found the user can skip gracefully.
 */
export const GenericChoice = ({ exercise, onSubmit, onNext, onRetry }: GenericChoiceProps) => {
    const { t } = useTranslation('lessons');
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [isChecked, setIsChecked] = useState(false);
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');
    const [shuffled, setShuffled] = useState<any[]>([]);

    const content = exercise?.content || {};

    useEffect(() => {
        setSelectedOption(null);
        setIsChecked(false);
        setFeedback('none');
        const opts = resolveOptions(content, ['options', 'choices', 'scenarios', 'plans', 'offers', 'items', 'cases', 'models', 'portfolios']);
        const copy = [...opts];
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        setShuffled(copy);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [exercise]);

    const handleCheck = () => {
        if (!selectedOption) return;
        const isCorrect = onSubmit(selectedOption);
        setIsChecked(true);
        setFeedback(isCorrect ? 'success' : 'error');
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            setSelectedOption(null);
            setIsChecked(false);
            setFeedback('none');
            onRetry();
        }
    };

    const correctId = extractCorrectId(exercise.correct_answer);
    const isOddCount = shuffled.length % 2 !== 0;

    const optionState = (id: string): OptionState => {
        if (!isChecked) return selectedOption === id ? 'selected' : 'idle';
        if (correctId !== undefined && String(id) === String(correctId)) return 'correct';
        if (id === selectedOption) return 'wrong';
        return 'dimmed';
    };

    // Graceful fallback: no recognizable options → let the user continue.
    if (shuffled.length === 0) {
        return (
            <div className="w-full max-w-md mx-auto animate-slide-in-bottom">
                <div className="lp-card p-8 text-center space-y-4">
                    <div className="text-4xl">📊</div>
                    <p className="text-sm" style={{ color: 'var(--lp-muted)' }}>
                        {content.scenario || content.context || t('actions.continue', { defaultValue: 'Continuar' })}
                    </p>
                    <button onClick={onNext} className="lp-cta lp-cta--brand w-full h-14 sm:h-16 flex items-center justify-center gap-2">
                        {t('actions.continue', { defaultValue: 'Continuar' })} →
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-2xl">
            <div className={isOddCount ? 'grid grid-cols-1 gap-3 mb-6' : 'grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6'}>
                {shuffled.map((option, index) => (
                    <OptionCard
                        key={option.id}
                        index={index}
                        text={option.text}
                        state={optionState(option.id)}
                        onClick={() => { if (!isChecked) setSelectedOption(option.id); }}
                        disabled={isChecked}
                    />
                ))}
            </div>

            {!isChecked ? (
                <QuestButton variant="gold" disabled={!selectedOption} onClick={handleCheck}>
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
};
