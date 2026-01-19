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
    submitAnswer: (answer: string | Record<string, string> | string[]) => boolean;
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

    const submitAnswer = useCallback((answer: string | Record<string, string> | string[]): boolean => {
        if (!currentExercise || state !== 'WAITING_INPUT') return false;

        setState('CHECKING');
        setAttempts(prev => prev + 1);

        let isCorrect = false;

        // Check based on exercise type
        if (currentExercise.type === 'multiple_choice') {
            isCorrect = answer === currentExercise.correct_answer?.correctOptionId;
        } else if (currentExercise.type === 'classification') {
            const correctClassifications = currentExercise.correct_answer?.classifications || {};
            const userClassifications = answer as Record<string, string>;
            isCorrect = Object.keys(correctClassifications).every(
                key => userClassifications[key] === correctClassifications[key]
            );
        } else if (currentExercise.type === 'tap_action') {
            const targetIds = new Set(currentExercise.correct_answer?.targetIds || []);
            const tappedIds = new Set(answer as string[]);
            isCorrect =
                targetIds.size === tappedIds.size &&
                [...targetIds].every(id => tappedIds.has(id));
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
