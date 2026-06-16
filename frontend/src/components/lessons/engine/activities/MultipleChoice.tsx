import { useState, useEffect } from 'react';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { extractCorrectId } from '../hooks/useLessonState';
import { OptionCard, type OptionState } from '../ui/OptionCard';
import { QuestButton } from '../ui/QuestButton';

interface MultipleChoiceProps {
    exercise: any; // Type should be clearer in a real app
    onSubmit: (answer: string) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const MultipleChoice = ({ exercise, onSubmit, onNext, onRetry }: MultipleChoiceProps) => {
    const { t } = useTranslation('lessons');
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [isChecked, setIsChecked] = useState(false);
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');

    // Shuffle state
    const [shuffledOptions, setShuffledOptions] = useState<any[]>([]);

    useEffect(() => {
        // Reset state on new exercise
        setSelectedOption(null);
        setIsChecked(false);
        setFeedback('none');

        // Shuffle options
        if (exercise?.content?.options) {
            const options = [...exercise.content.options];
            for (let i = options.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [options[i], options[j]] = [options[j], options[i]];
            }
            setShuffledOptions(options);
        }
    }, [exercise]);

    const handleSelectOption = (id: string) => {
        if (isChecked) return;
        setSelectedOption(id);
    };

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
            // Retry logic: localized reset
            setSelectedOption(null);
            setIsChecked(false);
            setFeedback('none');
            onRetry();
        }
    };

    const correctId = extractCorrectId(exercise.correct_answer);
    const isOddCount = shuffledOptions.length % 2 !== 0;

    const optionState = (id: string): OptionState => {
        if (!isChecked) return selectedOption === id ? 'selected' : 'idle';
        if (id === correctId) return 'correct';
        if (id === selectedOption) return 'wrong';
        return 'dimmed';
    };

    return (
        <div className="w-full max-w-2xl">
            {/* Options Grid */}
            <div className={isOddCount ? "grid grid-cols-1 gap-3 mb-6" : "grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6"}>
                {shuffledOptions.map((option, index) => (
                    <OptionCard
                        key={option.id}
                        index={index}
                        text={option.text}
                        state={optionState(option.id)}
                        onClick={() => handleSelectOption(option.id)}
                        disabled={isChecked}
                    />
                ))}
            </div>

            {/* Action Button */}
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
