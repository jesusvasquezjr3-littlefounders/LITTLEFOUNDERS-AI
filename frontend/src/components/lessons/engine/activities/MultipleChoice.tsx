import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PopOptionButton } from '../components/PopOptionButton';

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

    const correctId = exercise.correct_answer?.correctOptionId;
    const isOddCount = shuffledOptions.length % 2 !== 0;

    return (
        <div className="w-full max-w-2xl animate-slide-in-bottom">
            {/* Options Grid */}
            <div className={cn(
                "grid gap-4 mb-6",
                // Responsive Logic: 
                // Mobile: 1 col always safe
                // Tablet/Desktop: 2 cols, UNLESS odd number of items, then maybe 1 col or 3 cols?
                // User requested: "si son 3, 1x5" (list). 
                // So if odd count and > 1, use 1 col. If even, 2 cols.
                isOddCount ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2",
                "max-h-[50vh] overflow-y-auto p-1 custom-scrollbar" // Scrollable on small screens
            )}>
                {shuffledOptions.map((option, index) => {
                    const isSelected = selectedOption === option.id;
                    const isCorrect = option.id === correctId;
                    const showResult = isChecked;

                    const optionColors: Array<'purple' | 'pink' | 'blue' | 'orange'> = [
                        'purple',
                        'pink',
                        'blue',
                        'orange'
                    ];
                    // Keep consistent color mapping based on INDEX in shuffled list 
                    // (Kahoot positions have fixed colors usually: TopLeft=Red, TopRight=Blue etc.)
                    const colorTheme = optionColors[index % optionColors.length];

                    return (
                        <PopOptionButton
                            key={option.id}
                            id={option.id}
                            text={option.text}
                            colorTheme={colorTheme}
                            isSelected={isSelected}
                            isCorrect={isCorrect}
                            showResult={showResult}
                            feedback={feedback}
                            onClick={() => handleSelectOption(option.id)}
                            disabled={isChecked}
                        />
                    );
                })}
            </div>

            {/* Action Button */}
            {!isChecked ? (
                <Button
                    onClick={handleCheck}
                    disabled={!selectedOption}
                    className="w-full h-14 sm:h-16 text-lg sm:text-xl rounded-2xl bg-purple-500 hover:bg-purple-600 text-white shadow-[0_4px_0_rgb(107,33,168)] hover:shadow-[0_2px_0_rgb(107,33,168)] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all disabled:opacity-50 disabled:shadow-none disabled:translate-y-[4px]"
                >
                    {t('actions.verify')}
                </Button>
            ) : (
                <Button
                    onClick={handleContinue}
                    className={cn(
                        "w-full h-14 sm:h-16 text-lg sm:text-xl font-bold rounded-2xl transition-all",
                        feedback === 'success'
                            ? "bg-green-500 hover:bg-green-600 text-white shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)] active:shadow-none active:translate-y-[4px]"
                            : "bg-orange-500 hover:bg-orange-600 text-white shadow-[0_4px_0_rgb(194,65,12)] hover:shadow-[0_2px_0_rgb(194,65,12)] active:shadow-none active:translate-y-[4px]",
                        "hover:-translate-y-[2px]"
                    )}
                >
                    <span className="relative flex items-center justify-center">
                        {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                        <ArrowRight className="ml-2 w-6 h-6" />
                    </span>
                </Button>
            )}
        </div>
    );
};
