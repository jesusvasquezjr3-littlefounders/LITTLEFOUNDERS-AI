import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowRight, Zap, Clock, Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSound } from "@/contexts/SoundContext";

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
            <div className="w-full max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col items-center justify-center py-20">
                <div className="text-4xl mb-4">📊</div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                    {t('quiz_battle.no_questions', { defaultValue: 'Sin preguntas disponibles' })}
                </h3>
                <Button onClick={onNext} className="mt-6">
                    {t('actions.continue', { defaultValue: 'Continuar' })}
                </Button>
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
                    <div className="mb-6 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Trophy className="w-6 h-6 text-yellow-600" />
                            <span className="text-2xl font-black text-yellow-600">
                                {score}
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            <Clock className={cn(
                                "w-5 h-5",
                                timeLeft <= 5 ? "text-red-600 animate-pulse" : "text-blue-600"
                            )} />
                            <span className={cn(
                                "text-xl font-black",
                                timeLeft <= 5 ? "text-red-600" : "text-blue-600"
                            )}>
                                {timeLeft}s
                            </span>
                        </div>
                    </div>

                    <div className="mb-6 h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>

                    <div className="mb-6 bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-500 dark:border-blue-700 rounded-2xl p-6 shadow-sm">
                        <div className="text-sm text-blue-700 dark:text-blue-300 mb-2">
                            {t('quiz_battle.question', { defaultValue: 'Pregunta' })} {currentQuestion + 1}/{totalQuestions}
                        </div>
                        <h3 className="text-xl font-black text-blue-900 dark:text-blue-100">
                            {question?.question || content.question || ''}
                        </h3>
                    </div>

                    <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(question?.options || []).map((option: any) => {
                            const isSelected = selectedAnswer === option.id;
                            const correctId = getCorrectId();
                            const isCorrect = option.id === correctId;
                            const showResult = isAnswered;

                            return (
                                <button
                                    key={option.id}
                                    onClick={() => handleAnswer(option.id)}
                                    disabled={isAnswered}
                                    className={cn(
                                        "p-6 rounded-2xl border-2 transition-all text-left font-bold",
                                        !showResult && "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-400",
                                        showResult && isCorrect && "bg-green-100 dark:bg-green-950 border-green-500",
                                        showResult && !isCorrect && isSelected && "bg-red-100 dark:bg-red-950 border-red-500",
                                        showResult && !isCorrect && !isSelected && "opacity-50"
                                    )}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-800 dark:text-slate-200">
                                            {option.text}
                                        </span>
                                        {showResult && isCorrect && (
                                            <span className="text-2xl">✓</span>
                                        )}
                                        {showResult && !isCorrect && isSelected && (
                                            <span className="text-2xl">✗</span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </>
            ) : (
                <div className="flex flex-col items-center w-full animate-in fade-in slide-in-from-bottom-4">
                    <div className="mb-6 p-6 text-center">
                        <div className={cn(
                            "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4",
                            quizPassed ? "bg-green-100 dark:bg-green-900" : "bg-orange-100 dark:bg-orange-900"
                        )}>
                            <span className="text-3xl">{quizPassed ? '🎉' : '📊'}</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">
                            {quizPassed ? t('quiz_battle.complete', { defaultValue: '¡Completado!' }) : t('quiz_battle.try_again', { defaultValue: 'Necesitas más puntos' })}
                        </h3>
                        <p className="text-lg font-black text-yellow-600 mb-2">
                            {t('quiz_battle.final_score', { defaultValue: 'Puntaje' })}: {score}
                        </p>
                    </div>

                    <Button
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
                        className={cn(
                            "w-full max-w-md h-14 sm:h-16 text-lg sm:text-xl font-bold rounded-2xl transition-all flex items-center justify-center gap-2",
                            quizPassed
                                ? "bg-green-500 hover:bg-green-600 text-white shadow-[0_4px_0_rgb(22,101,52)] hover:shadow-[0_2px_0_rgb(22,101,52)]"
                                : "bg-orange-500 hover:bg-orange-600 text-white shadow-[0_4px_0_rgb(194,65,12)] hover:shadow-[0_2px_0_rgb(194,65,12)]",
                            "hover:-translate-y-[2px] active:translate-y-[4px] active:shadow-none"
                        )}
                    >
                        {quizPassed ? t('actions.continue', { defaultValue: 'Continuar' }) : t('actions.retry', { defaultValue: 'Reintentar' })}
                        <ArrowRight className="w-5 h-5" />
                    </Button>
                </div>
            )}
        </div>
    );
};
