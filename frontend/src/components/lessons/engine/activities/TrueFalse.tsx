import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Check, X, ArrowRight, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { QuestButton } from '../ui/QuestButton';
import { pickText } from './fieldText';

interface TrueFalseProps {
    exercise: any;
    onSubmit: (isTrue: boolean) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const TrueFalse = ({ exercise, onSubmit, onNext, onRetry }: TrueFalseProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [answered, setAnswered] = useState<boolean | null>(null); // true = Verdadero selected, false = Falso selected
    const [feedback, setFeedback] = useState<'none' | 'success' | 'error'>('none');

    useEffect(() => {
        setAnswered(null);
        setFeedback('none');
    }, [exercise]);

    const handleAnswer = (choice: boolean) => {
        if (answered !== null) return;
        playSound('ui_tap');
        setAnswered(choice);

        // Delegate validation to useLessonState via onSubmit (single source of truth)
        const isCorrect = onSubmit(choice);
        setFeedback(isCorrect ? 'success' : 'error');
    };

    const handleContinue = () => {
        if (feedback === 'success') {
            onNext();
        } else {
            setAnswered(null);
            setFeedback('none');
            onRetry();
        }
    };

    return (
        <div className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both flex flex-col items-center">

            {/* Statement Card */}
            <div className="bg-white rounded-[2.5rem] shadow-sm p-6 sm:p-8 mb-8 sm:mb-10 w-full text-center">
                <h3 className="lp-display text-2xl sm:text-3xl leading-tight" style={{ color: 'var(--lp-ink)' }}>
                    {pickText(exercise.content, ['statement', 'text', 'question', 'prompt', 'title'])}
                </h3>
            </div>

            {/* True / False Buttons */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full mb-8">
                {/* TRUE BUTTON */}
                <button
                    onClick={() => handleAnswer(true)}
                    disabled={answered !== null}
                    className={cn(
                        "lp-token lp-option lp-option--emerald h-28 sm:h-32 flex flex-col items-center justify-center gap-2",
                        answered !== null && "lp-token--locked",
                        answered === true && "is-selected",
                        answered === false && "is-dimmed",
                        feedback === 'success' && exercise.correct_answer?.isTrue === true && "is-correct",
                        feedback === 'error' && answered === true && "is-wrong lp-shake"
                    )}
                >
                    <Check className="w-10 h-10 sm:w-11 sm:h-11" strokeWidth={3} style={{ color: 'var(--lp-emerald)' }} />
                    <span className="lp-display text-2xl uppercase tracking-wider" style={{ color: 'var(--lp-ink)' }}>{t('common:true')}</span>
                </button>

                {/* FALSE BUTTON */}
                <button
                    onClick={() => handleAnswer(false)}
                    disabled={answered !== null}
                    className={cn(
                        "lp-token lp-option lp-option--coral h-28 sm:h-32 flex flex-col items-center justify-center gap-2",
                        answered !== null && "lp-token--locked",
                        answered === false && "is-selected",
                        answered === true && "is-dimmed",
                        feedback === 'success' && exercise.correct_answer?.isTrue === false && "is-correct",
                        feedback === 'error' && answered === false && "is-wrong lp-shake"
                    )}
                >
                    <X className="w-10 h-10 sm:w-11 sm:h-11" strokeWidth={3} style={{ color: 'var(--lp-coral)' }} />
                    <span className="lp-display text-2xl uppercase tracking-wider" style={{ color: 'var(--lp-ink)' }}>{t('common:false')}</span>
                </button>
            </div>

            {/* Continue Button */}
            {answered !== null && (
                <div className="w-full animate-in fade-in slide-in-from-bottom-4">
                    {/* Feedback Message */}
                    <div className="lp-display text-center mb-4 text-xl">
                        {feedback === 'success' ? (
                            <span className="flex items-center justify-center gap-2" style={{ color: 'var(--lp-emerald)' }}>
                                <Check className="w-6 h-6" strokeWidth={3} /> {t('feedback.success')}
                            </span>
                        ) : (
                            <span className="flex items-center justify-center gap-2" style={{ color: 'var(--lp-coral)' }}>
                                <X className="w-6 h-6" strokeWidth={3} /> {t('feedback.error')}
                            </span>
                        )}
                    </div>

                    <QuestButton
                        variant={feedback === 'success' ? 'go' : 'retry'}
                        onClick={handleContinue}
                    >
                        {feedback === 'success' ? t('actions.continue') : t('actions.retry')}
                        {feedback === 'success' ? <ArrowRight className="w-6 h-6" /> : <RotateCcw className="w-6 h-6" />}
                    </QuestButton>
                </div>
            )}
        </div>
    );
};
