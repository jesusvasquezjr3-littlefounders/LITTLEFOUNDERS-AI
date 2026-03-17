import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Check, X, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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

                    // Solid Brand Colors
                    const optionColors = [
                        {
                            bg: 'bg-purple-500',
                            hover: 'hover:bg-purple-600',
                            text: 'text-white',
                            shadow: 'shadow-[0_6px_0_rgb(107,33,168)] hover:shadow-[0_3px_0_rgb(107,33,168)]',
                            active: 'active:shadow-none active:translate-y-[3px]'
                        },
                        {
                            bg: 'bg-pink-500',
                            hover: 'hover:bg-pink-600',
                            text: 'text-white',
                            shadow: 'shadow-[0_6px_0_rgb(190,24,93)] hover:shadow-[0_3px_0_rgb(190,24,93)]',
                            active: 'active:shadow-none active:translate-y-[3px]'
                        },
                        {
                            bg: 'bg-blue-500',
                            hover: 'hover:bg-blue-600',
                            text: 'text-white',
                            shadow: 'shadow-[0_6px_0_rgb(29,78,216)] hover:shadow-[0_3px_0_rgb(29,78,216)]',
                            active: 'active:shadow-none active:translate-y-[3px]'
                        },
                        {
                            bg: 'bg-orange-500',
                            hover: 'hover:bg-orange-600',
                            text: 'text-white',
                            shadow: 'shadow-[0_6px_0_rgb(194,65,12)] hover:shadow-[0_3px_0_rgb(194,65,12)]',
                            active: 'active:shadow-none active:translate-y-[3px]'
                        },
                    ];
                    // Keep consistent color mapping based on INDEX in shuffled list 
                    // (Kahoot positions have fixed colors usually: TopLeft=Red, TopRight=Blue etc.)
                    const color = optionColors[index % optionColors.length];

                    return (
                        <button
                            key={option.id}
                            onClick={() => handleSelectOption(option.id)}
                            disabled={isChecked}
                            className={cn(
                                "w-full p-4 rounded-2xl text-left transition-all duration-200 transform relative overflow-hidden h-full flex flex-col justify-center min-h-[80px] sm:min-h-[100px]",
                                "font-bold text-base sm:text-lg leading-tight",
                                color.text,
                                // Default state
                                !showResult && !isSelected && `${color.bg} ${color.hover} ${color.shadow} ${color.active} hover:translate-y-[2px]`,

                                // Selected state
                                !showResult && isSelected && `${color.bg} shadow-none translate-y-[4px] ring-4 ring-white/30`,

                                // Success
                                showResult && feedback === 'success' && isSelected && isCorrect && "bg-green-500 shadow-none ring-4 ring-green-300 scale-100 z-10",
                                showResult && feedback === 'success' && !isSelected && "opacity-20 grayscale",

                                // Error
                                showResult && feedback === 'error' && isSelected && "bg-red-500 shadow-none ring-4 ring-red-300",
                                showResult && feedback === 'error' && !isSelected && "opacity-50"
                            )}
                        >
                            <div className="flex items-center justify-between gap-3 w-full z-10 relative">
                                <span className="flex-1">
                                    {option.text}
                                </span>

                                {showResult && feedback === 'success' && isSelected && isCorrect && (
                                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm animate-in zoom-in">
                                        <Check className="w-5 h-5 text-green-600 stroke-[3px]" />
                                    </div>
                                )}
                                {showResult && feedback === 'error' && isSelected && (
                                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm animate-in zoom-in">
                                        <X className="w-5 h-5 text-red-600 stroke-[3px]" />
                                    </div>
                                )}
                            </div>

                            {/* Glass Shine */}
                            <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/25 to-transparent pointer-events-none" />
                            <div className="absolute bottom-0 left-0 w-full h-px bg-black/10 pointer-events-none" />
                        </button>
                    );
                })}
            </div>

            {/* Action Button */}
            {!isChecked ? (
                <Button
                    onClick={handleCheck}
                    disabled={!selectedOption}
                    className="relative overflow-hidden w-full h-14 text-lg font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-2xl shadow-[0_4px_0_rgb(107,33,168)] hover:shadow-[0_2px_0_rgb(107,33,168)] hover:translate-y-[2px] active:shadow-none active:translate-y-1 transition-all disabled:opacity-50 disabled:shadow-none disabled:bg-muted"
                >
                    <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
                    <span className="relative">{t('actions.verify')}</span>
                </Button>
            ) : (
                <Button
                    onClick={handleContinue}
                    className={cn(
                        "relative overflow-hidden w-full h-14 text-lg font-bold rounded-2xl transition-all",
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
