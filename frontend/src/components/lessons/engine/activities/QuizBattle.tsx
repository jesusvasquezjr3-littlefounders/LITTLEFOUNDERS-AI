import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, RotateCcw, Clock, Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";
import { OptionCard, type OptionState } from '../ui/OptionCard';
import { QuestButton } from '../ui/QuestButton';
import { pickText } from './fieldText';

interface QuizBattleProps {
    exercise: any;
    onSubmit: (score: number) => boolean;
    onNext: () => void;
    onRetry: () => void;
}

export const QuizBattle = ({ exercise, onSubmit, onNext, onRetry }: QuizBattleProps) => {
    const { t } = useTranslation('lessons');
    const { playSound } = useSound();

    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [score, setScore] = useState(0);
    const scoreRef = useRef(0);
    const [timeLeft, setTimeLeft] = useState(15);
    const [isAnswered, setIsAnswered] = useState(false);
    const [feedback, setFeedback] = useState<'none' | 'success' | 'complete'>('none');
    const [quizPassed, setQuizPassed] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const content = exercise?.content || {};

    // Support both formats:
    // Legacy: content.questions (array of question objects with correctId)
    // Real JSON: content.question (string) + content.options (array)
    const questions = useRef<any[]>([]);

    useEffect(() => {
        if (content.questions && Array.isArray(content.questions) && content.questions.length > 0) {
            // Legacy multi-question format
            questions.current = content.questions;
        } else if (content.question && Array.isArray(content.options)) {
            // Real JSON single-question format
            questions.current = [{
                question: content.question,
                options: content.options,
                correctId: exercise.correct_answer?.correctOptionId || exercise.correct_answer?.correctId,
            }];
        } else {
            questions.current = [];
        }
    }, [exercise, content]);

    useEffect(() => {
        setCurrentQuestion(0);
        setSelectedAnswer(null);
        setScore(0);
        scoreRef.current = 0;
        setTimeLeft(15);
        setIsAnswered(false);
        setFeedback('none');
        setQuizPassed(false);
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [exercise]);

    useEffect(() => {
        if (feedback === 'complete' || isAnswered) return;

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    handleTimeout();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [currentQuestion, isAnswered, feedback]);

    const handleTimeout = () => {
        setIsAnswered(true);
        playSound('edu_error');
        timeoutRef.current = setTimeout(() => {
            moveToNext();
        }, 1500);
    };

    const question = questions.current[currentQuestion];
    const totalQuestions = questions.current.length;

    if (totalQuestions === 0) {
        return (
            <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col items-center justify-center py-20">
                <div className="text-6xl mb-4">📊</div>
                <h3 className="lp-display text-2xl text-center" style={{ color: 'var(--lp-ink)' }}>
                    {t('quiz_battle.no_questions', { defaultValue: 'Sin preguntas disponibles' })}
                </h3>
                <div className="mt-8 w-full max-w-md">
                    <QuestButton variant="brand" onClick={onNext}>
                        {t('actions.continue', { defaultValue: 'Continuar' })}
                        <ArrowRight className="w-5 h-5" />
                    </QuestButton>
                </div>
            </div>
        );
    }

    const getCorrectId = () => {
        // Priority: question.correctId (legacy) -> exercise.correct_answer.correctOptionId -> exercise.correct_answer.correctId
        return question?.correctId || exercise.correct_answer?.correctOptionId || exercise.correct_answer?.correctId;
    };

    const handleAnswer = (answerId: string) => {
        if (isAnswered) return;
        setSelectedAnswer(answerId);
        setIsAnswered(true);

        const correctId = getCorrectId();
        const isCorrect = answerId === correctId;

        if (isCorrect) {
            const timeBonus = Math.floor(timeLeft / 3);
            const points = 100 + timeBonus * 10;
            scoreRef.current += points;
            setScore(scoreRef.current);
            playSound('edu_success');
        } else {
            playSound('edu_error');
        }

        timeoutRef.current = setTimeout(() => {
            moveToNext();
        }, 1500);
    };

    const moveToNext = () => {
        if (currentQuestion < totalQuestions - 1) {
            setCurrentQuestion(prev => prev + 1);
            setSelectedAnswer(null);
            setTimeLeft(15);
            setIsAnswered(false);
        } else {
            const isCorrect = onSubmit(scoreRef.current);
            setFeedback('complete');
            setQuizPassed(isCorrect);
        }
    };

    const progress = totalQuestions > 0 ? ((currentQuestion + 1) / totalQuestions) * 100 : 0;

    return (
        <div className="w-full max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            {feedback !== 'complete' ? (
                <>
                    <div className="mb-5 flex items-center justify-between">
                        <div className="lp-chip h-11 px-4 flex items-center gap-2" style={{ color: 'var(--lp-amber-ink)' }}>
                            <Trophy className="w-5 h-5" style={{ color: 'var(--lp-amber)' }} />
                            <span className="lp-display text-xl tabular-nums">
                                {score}
                            </span>
                        </div>

                        <div
                            className={cn("lp-chip h-11 px-4 flex items-center gap-2", timeLeft <= 5 && "lp-shake")}
                            style={{ color: timeLeft <= 5 ? 'var(--lp-coral-ink)' : 'var(--lp-indigo-ink)' }}
                        >
                            <Clock
                                className={cn("w-5 h-5", timeLeft <= 5 && "animate-pulse")}
                                style={{ color: timeLeft <= 5 ? 'var(--lp-coral)' : 'var(--lp-indigo)' }}
                            />
                            <span className="lp-display text-xl tabular-nums">
                                {timeLeft}s
                            </span>
                        </div>
                    </div>

                    <div className="lp-track mb-6 h-3.5">
                        <div
                            className="lp-track-fill h-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>

                    <div className="lp-card mb-6 p-6">
                        <div className="lp-display text-sm mb-2 uppercase tracking-wide" style={{ color: 'var(--lp-muted)' }}>
                            {t('quiz_battle.question', { defaultValue: 'Pregunta' })} {currentQuestion + 1}/{totalQuestions}
                        </div>
                        <h3 className="lp-display text-xl sm:text-2xl leading-snug" style={{ color: 'var(--lp-ink)' }}>
                            {question?.question || content.question || ''}
                        </h3>
                    </div>

                    <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {(question?.options || []).map((option: any, index: number) => {
                            const isSelected = selectedAnswer === option.id;
                            const correctId = getCorrectId();
                            const isCorrect = option.id === correctId;
                            const showResult = isAnswered;

                            const optionState: OptionState = !showResult
                                ? (isSelected ? 'selected' : 'idle')
                                : isCorrect
                                    ? 'correct'
                                    : isSelected
                                        ? 'wrong'
                                        : 'dimmed';

                            return (
                                <OptionCard
                                    key={option.id}
                                    index={index}
                                    text={pickText(option)}
                                    state={optionState}
                                    onClick={() => handleAnswer(option.id)}
                                    disabled={isAnswered}
                                />
                            );
                        })}
                    </div>
                </>
            ) : (
                <div className="flex flex-col items-center w-full animate-in fade-in slide-in-from-bottom-4">
                    <div className="mb-8 p-6 text-center">
                        <div
                            className="w-28 h-28 sm:w-36 sm:h-36 rounded-full flex items-center justify-center mx-auto mb-5 lp-bob"
                            style={{
                                background: quizPassed ? 'var(--lp-emerald-soft)' : 'var(--lp-amber-soft)',
                                border: `2px solid ${quizPassed ? 'var(--lp-emerald)' : 'var(--lp-amber)'}`,
                            }}
                        >
                            <span className="text-5xl sm:text-6xl">{quizPassed ? '🎉' : '📊'}</span>
                        </div>
                        <h3 className="lp-display text-2xl sm:text-3xl mb-3" style={{ color: 'var(--lp-ink)' }}>
                            {quizPassed ? t('quiz_battle.complete', { defaultValue: '¡Completado!' }) : t('quiz_battle.try_again', { defaultValue: 'Necesitas más puntos' })}
                        </h3>
                        <p className="lp-display text-xl" style={{ color: 'var(--lp-amber-ink)' }}>
                            {t('quiz_battle.final_score', { defaultValue: 'Puntaje' })}: {score}
                        </p>
                    </div>

                    <div className="w-full max-w-md">
                        <QuestButton
                            variant={quizPassed ? 'go' : 'retry'}
                            onClick={() => {
                                if (quizPassed) {
                                    onNext();
                                } else {
                                    setCurrentQuestion(0);
                                    setSelectedAnswer(null);
                                    setScore(0);
                                    scoreRef.current = 0;
                                    setTimeLeft(15);
                                    setIsAnswered(false);
                                    setFeedback('none');
                                    setQuizPassed(false);
                                    onRetry();
                                }
                            }}
                        >
                            {quizPassed ? t('actions.continue', { defaultValue: 'Continuar' }) : t('actions.retry', { defaultValue: 'Reintentar' })}
                            {quizPassed ? <ArrowRight className="w-5 h-5" /> : <RotateCcw className="w-5 h-5" />}
                        </QuestButton>
                    </div>
                </div>
            )}
        </div>
    );
};
