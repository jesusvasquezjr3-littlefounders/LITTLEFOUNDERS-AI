/**
 * MultipleChoiceStage - Pregunta con opciones múltiples
 */
import { useState, useEffect } from 'react';
import { DinoCharacter, DinoMood } from '@/components/characters/DinoCharacter';
import { Button } from '@/components/ui/button';
import { Check, X, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ExerciseData } from '../hooks/useLessonData';

interface MultipleChoiceStageProps {
    exercise: ExerciseData;
    onAnswer: (answerId: string) => boolean;
    onComplete: () => void;
    feedbackState: 'none' | 'success' | 'error';
    isTalking?: boolean;
}

export function MultipleChoiceStage({
    exercise,
    onAnswer,
    onComplete,
    feedbackState,
    isTalking = false
}: MultipleChoiceStageProps) {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isChecked, setIsChecked] = useState(false);

    // Reset local state when exercise changes to avoid stale selections
    useEffect(() => {
        setSelectedId(null);
        setIsChecked(false);
    }, [exercise.id]);

    const content = exercise.content;
    const options = content.options || [];
    const mood: DinoMood = feedbackState === 'success' ? 'excited' :
        feedbackState === 'error' ? 'thinking' :
            'happy';

    const question = content.question || '';
    const feedback = exercise.feedback;

    const handleSelect = (optionId: string) => {
        if (isChecked) return;
        setSelectedId(optionId);
    };

    const handleCheck = () => {
        if (!selectedId) return;
        onAnswer(selectedId);
        setIsChecked(true);
    };

    const handleContinue = () => {
        setSelectedId(null);
        setIsChecked(false);
        onComplete();
    };

    const correctId = exercise.correct_answer?.correctOptionId;

    return (
        <div className="flex flex-col items-center min-h-[500px] p-6 animate-fadeIn">
            {/* Personaje con pregunta */}
            <div className="mb-6">
                <DinoCharacter
                    currentText={question}
                    showBubble={true}
                    mood={mood}
                    bubblePosition="standard"
                    isTalking={isTalking}
                />
            </div>

            {/* Opciones */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl mb-6">
                {options.map((option) => {
                    const isSelected = selectedId === option.id;
                    const isCorrect = option.id === correctId;
                    const showResult = isChecked;

                    return (
                        <button
                            key={option.id}
                            onClick={() => handleSelect(option.id)}
                            disabled={isChecked}
                            className={cn(
                                "p-4 rounded-full border-2 transition-all duration-200",
                                "font-medium text-lg",
                                "hover:scale-[1.02] active:scale-[0.98]",
                                !showResult && !isSelected && "border-gray-200 dark:border-gray-700 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20",
                                !showResult && isSelected && "border-blue-500 bg-blue-100 dark:bg-blue-900/30 ring-2 /30",
                                showResult && isCorrect && "border-green-500 bg-green-100 dark:bg-green-900/30",
                                showResult && isSelected && !isCorrect && "border-red-500 bg-red-100 dark:bg-red-900/30"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                {showResult && isCorrect && (
                                    <Check className="w-5 h-5 text-green-500" />
                                )}
                                {showResult && isSelected && !isCorrect && (
                                    <X className="w-5 h-5 text-red-500" />
                                )}
                                <span>{option.text}</span>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Feedback */}
            {isChecked && feedback && (
                <div className={cn(
                    "p-4 rounded-full mb-4 max-w-md text-center",
                    feedbackState === 'success' && "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
                    feedbackState === 'error' && "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200"
                )}>
                    {feedbackState === 'success' ? feedback.success : feedback.error}
                </div>
            )}

            {/* Botones */}
            <div className="flex gap-4 mt-4">
                {!isChecked && (
                    <Button
                        size="lg"
                        onClick={handleCheck}
                        disabled={!selectedId}
                        className="gap-2 bg-blue-500 hover:bg-blue-600 text-white font-bold px-8 h-14 sm:h-16 text-lg sm:text-xl rounded-full shadow-[0_4px_0_rgb(37,99,235)] hover:shadow-[0_2px_0_rgb(37,99,235)] hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] transition-all disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none w-full max-w-md"
                    >
                        {(exercise.content as any)?.checkLabel || 'Verificar'}
                        <Check className="w-5 h-5" />
                    </Button>
                )}

                {isChecked && (
                    <Button
                        size="lg"
                        onClick={handleContinue}
                        className={cn(
                            "gap-2 font-bold px-8 h-14 sm:h-16 text-lg sm:text-xl rounded-full transition-all hover:-translate-y-[2px] active:shadow-none active:translate-y-[4px] w-full max-w-md text-white",
                            feedbackState === 'success' && "bg-green-500 hover:bg-green-600 shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)]",
                            feedbackState === 'error' && "bg-violet-500 hover:bg-violet-600 shadow-[0_4px_0_rgb(194,65,12)] hover:shadow-[0_2px_0_rgb(194,65,12)]"
                        )}
                    >
                        {feedbackState === 'success'
                            ? ((exercise.content as any)?.nextLabel || 'Continuar')
                            : ((exercise.content as any)?.retryLabel || 'Intentar de nuevo')
                        }
                        <ArrowRight className="w-5 h-5" />
                    </Button>
                )}
            </div>
        </div>
    );
}
