/**
 * Hook para manejar el estado de la lección (máquina de estados)
 */
import { useState, useCallback } from 'react';
import type { ExerciseData, LessonData } from './useLessonData';

export type LessonState =
    | 'IDLE'           // Esperando iniciar
    | 'PLAYING'        // Reproduciendo audio/narración
    | 'WAITING_INPUT'  // Esperando respuesta del usuario
    | 'CHECKING'       // Verificando respuesta
    | 'FEEDBACK_SUCCESS'
    | 'FEEDBACK_ERROR'
    | 'COMPLETED';     // Lección terminada

export interface UseLessonStateReturn {
    state: LessonState;
    currentExerciseIndex: number;
    currentExercise: ExerciseData | null;
    totalExercises: number;
    progress: number; // 0-100
    results: ExerciseResult[];

    // Actions
    startLesson: () => void;
    submitAnswer: (answer: string | Record<string, string> | string[] | boolean | any) => boolean;
    nextExercise: () => void;
    retryExercise: () => void; // Para reintentar después de error
    pauseLesson: () => void;
    resumeLesson: () => void;
}

interface ExerciseResult {
    exerciseId: number;
    status: 'correct' | 'incorrect' | 'skipped';
    attempts: number;
}

export function useLessonState(lessonData: LessonData | null): UseLessonStateReturn {
    const [state, setState] = useState<LessonState>('IDLE');
    const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
    const [results, setResults] = useState<ExerciseResult[]>([]);
    const [attempts, setAttempts] = useState(0);

    const timeline = lessonData?.timeline || [];
    const totalExercises = timeline.length;
    const currentExercise = timeline[currentExerciseIndex] || null;
    const progress = totalExercises > 0 ? Math.round((currentExerciseIndex / totalExercises) * 100) : 0;

    const startLesson = useCallback(() => {
        setState('PLAYING');
        setCurrentExerciseIndex(0);
        setResults([]);
    }, []);

    const submitAnswer = useCallback((answer: string | Record<string, string> | string[] | boolean | any): boolean => {
        if (!currentExercise || state !== 'WAITING_INPUT') return false;

        setState('CHECKING');
        setAttempts(prev => prev + 1);

        let isCorrect = false;

        // Check based on exercise type
        // Check based on exercise type
        if (currentExercise.type === 'multiple_choice' || currentExercise.type === 'roleplay_chat' || currentExercise.type === 'risk_reward') {
            isCorrect = answer === currentExercise.correct_answer?.correctOptionId;
        }
        else if (currentExercise.type === 'coin_counter') {
            const targetAmount = currentExercise.content.targetAmount;
            // Use epsilon for float comparison to avoid precision issues (3.5 vs 3.500000001)
            isCorrect = Math.abs(Number(answer) - targetAmount) < 0.01;
        }
        else if (currentExercise.type === 'shop_sim') {
            const correctItems = new Set(currentExercise.correct_answer?.shopItems || []);
            const userItems = new Set(answer as string[]);

            // If specific correct items are defined, enforce them
            if (correctItems.size > 0) {
                isCorrect = correctItems.size === userItems.size && [...correctItems].every(id => userItems.has(id));
            } else {
                // Otherwise, validate budget
                const budget = currentExercise.content.budget || 0;
                const products = currentExercise.content.products || [];

                // Calculate total spent based on answer IDs
                let totalSpent = 0;
                let itemsFound = 0;

                userItems.forEach(id => {
                    const product = products.find((p: any) => p.id === id);
                    if (product) {
                        totalSpent += product.price;
                        itemsFound++;
                    }
                });

                // Valid if spent > 0, spent <= budget, and we found the items
                isCorrect = itemsFound > 0 && totalSpent <= budget && itemsFound === userItems.size;
            }
        }
        else if (currentExercise.type === 'word_scramble') {
            // Case-insensitive comparison
            const content = currentExercise.content as any;
            const correctAns = currentExercise.correct_answer as any;
            const correctWord = content?.word || correctAns?.word || "";
            isCorrect = String(answer).toUpperCase() === String(correctWord).toUpperCase();
        }
        else if (currentExercise.type === 'budget_builder') {
            const correctAllocation = currentExercise.correct_answer?.allocation || {};
            const userAllocation = answer as Record<string, string>;
            isCorrect = Object.keys(correctAllocation).every(
                key => userAllocation[key] === correctAllocation[key]
            );
        }
        else if (currentExercise.type === 'savings_race') {
            // SIMULATOR: Always correct, any strategy is valid
            isCorrect = true;
        }
        else if (currentExercise.type === 'expense_timeline') {
            const correctOrder = currentExercise.correct_answer?.order || [];
            const userOrder = answer as string[];
            isCorrect = userOrder.length === correctOrder.length &&
                userOrder.every((val, index) => val === correctOrder[index]);
        }
        else if (currentExercise.type === 'interest_calculator') {
            // SIMULATOR: Always correct, exploration activity
            isCorrect = true;
        }
        else if (currentExercise.type === 'tax_puzzle') {
            // SIMULATOR: Always correct, exploration activity
            isCorrect = true;
        }
        else if (currentExercise.type === 'subscription_tracker') {
            // SIMULATOR: Always correct, personal optimization
            isCorrect = true;
        }
        else if (currentExercise.type === 'inflation_simulator') {
            // SIMULATOR: Always correct, comparison activity
            isCorrect = true;
        }
        else if (currentExercise.type === 'credit_score') {
            // Check if final score reaches MAXIMUM threshold
            const decisions = answer as string[];
            const initialScore = currentExercise.content.initialScore || 650;
            const scenarios = currentExercise.content.scenarios || [];

            let finalScore = initialScore;
            decisions.forEach((decisionId, scenarioIndex) => {
                const scenario = scenarios[scenarioIndex];
                if (scenario) {
                    const option = scenario.options.find((opt: any) => opt.id === decisionId);
                    if (option) {
                        finalScore += option.scoreChange || 0;
                    }
                }
            });

            const minScore = currentExercise.correct_answer?.minScore || 700;
            isCorrect = finalScore >= minScore;
        }
        else if (currentExercise.type === 'emergency_fund') {
            // Check if fund was not depleted
            const decisions = answer as string[];
            const initialFund = currentExercise.content.initialFund || 5000;
            const events = currentExercise.content.events || [];

            let balance = initialFund;
            decisions.forEach((decisionId, eventIndex) => {
                const event = events[eventIndex];
                if (event) {
                    const option = event.options.find((opt: any) => opt.id === decisionId);
                    if (option) {
                        balance -= option.cost || 0;
                    }
                }
            });



            isCorrect = balance >= 0;
        }
        else if (currentExercise.type === 'bill_splitter') {
            // SIMULATOR: Always correct (fairness exploration)
            isCorrect = true;
        }
        else if (currentExercise.type === 'salary_comparison') {
            // Validate best offer selected
            const selectedId = answer as string;
            isCorrect = selectedId === currentExercise.correct_answer?.bestOffer;
        }
        else if (currentExercise.type === 'debt_strategy') {
            // SIMULATOR: Always correct, educational comparison
            isCorrect = true;
        }
        else if (currentExercise.type === 'portfolio_builder') {
            // Validate balanced allocation
            const allocation = answer as Record<string, number>;
            const total = Object.values(allocation).reduce((sum, val) => sum + val, 0);
            isCorrect = Math.abs(total - 100) < 0.01;
        }
        else if (currentExercise.type === 'opportunity_cost') {
            // SIMULATOR: Always correct, educational exploration
            isCorrect = true;
        }
        else if (currentExercise.type === 'goal_roadmap') {
            // SIMULATOR: Always correct (goals prioritization)
            isCorrect = true;
        }
        else if (currentExercise.type === 'mindset_comparison') {
            // SIMULATOR: Always correct, educational reflection
            isCorrect = true;
        }
        else if (currentExercise.type === 'passive_income') {
            // Validate minimum income target met
            const selected = answer as string[];
            const streams = currentExercise.content.streams || [];
            const totalIncome = selected.reduce((sum, id) => {
                const stream = streams.find((s: any) => s.id === id);
                return sum + (stream?.monthlyIncome || 0);
            }, 0);
            const target = currentExercise.content.targetIncome || 1000;
            isCorrect = totalIncome >= target;
        }
        else if (currentExercise.type === 'quiz_battle') {
            // Validate quiz score (passed as number)
            const score = answer as number;
            const minScore = currentExercise.correct_answer?.minScore || 200;
            isCorrect = score >= minScore;
        }
        else {
            // Default fallback: allow components to pass explicit "true" (e.g. StoryMode ending)
            // or if it's an informational step like intro_narrative (though that usually auto-advances)
            if (typeof answer === 'boolean') isCorrect = answer;
        }

        // Agregar resultado
        setResults(prev => [
            ...prev.filter(r => r.exerciseId !== currentExercise.id),
            {
                exerciseId: currentExercise.id,
                status: isCorrect ? 'correct' : 'incorrect',
                attempts: attempts + 1
            }
        ]);

        // Actualizar estado de feedback
        setTimeout(() => {
            setState(isCorrect ? 'FEEDBACK_SUCCESS' : 'FEEDBACK_ERROR');
        }, 300);

        return isCorrect;
    }, [currentExercise, state, attempts]);

    const nextExercise = useCallback(() => {
        const nextIndex = currentExerciseIndex + 1;

        if (nextIndex >= totalExercises) {
            setState('COMPLETED');
        } else {
            setCurrentExerciseIndex(nextIndex);
            setAttempts(0);

            // Determinar estado inicial del siguiente ejercicio
            const nextExercise = timeline[nextIndex];
            if (nextExercise?.type === 'intro_narrative') {
                setState('PLAYING');
            } else {
                setState('WAITING_INPUT');
            }
        }
    }, [currentExerciseIndex, totalExercises, timeline]);

    // Retry after error - reset state to allow new attempt
    const retryExercise = useCallback(() => {
        setState('WAITING_INPUT');
    }, []);

    const pauseLesson = useCallback(() => {
        // Para cuando hay audio, aquí pausaríamos
        setState('IDLE');
    }, []);

    const resumeLesson = useCallback(() => {
        setState('PLAYING');
    }, []);

    return {
        state,
        currentExerciseIndex,
        currentExercise,
        totalExercises,
        progress,
        results,
        startLesson,
        submitAnswer,
        nextExercise,
        retryExercise,
        pauseLesson,
        resumeLesson
    };
}
