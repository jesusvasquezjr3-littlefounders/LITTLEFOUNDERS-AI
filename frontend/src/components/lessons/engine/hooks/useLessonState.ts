/**
 * Hook para manejar el estado de la lección (máquina de estados)
 *
 * VALIDACIÓN CENTRALIZADA: Este hook es la ÚNICA fuente de verdad para
 * determinar si una respuesta es correcta o incorrecta. Los componentes
 * de actividad NO deben validar por su cuenta - deben enviar la respuesta
 * cruda a submitAnswer() y usar el valor de retorno para determinar feedback.
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

// ============================================================
// HELPER: Validar respuesta según tipo de ejercicio
// Cada tipo de actividad tiene su propia lógica de validación.
// ============================================================
function validateAnswer(exercise: ExerciseData, answer: any): boolean {
    const type = exercise.type;
    const content = exercise.content as any;
    const correctAnswer = exercise.correct_answer as any;

    switch (type) {
        // ─── OPTION-BASED (string ID comparison) ───
        case 'multiple_choice':
        case 'roleplay_chat':
        case 'risk_reward':
        case 'price_detective':
        case 'market_reaction':
            return answer === correctAnswer?.correctOptionId;

        // ─── TRUE/FALSE ───
        case 'true_false':
            return answer === correctAnswer?.isTrue;

        // ─── FILL BLANK ───
        // Component sends Record<number|string, string> mapping blank index/id to word id
        // correct_answer.blank_ids maps blank identifiers to correct word ids
        case 'fill_blank': {
            const correctBlanks = correctAnswer?.blank_ids || {};
            const userBlanks = answer as Record<string, string>;

            // Normalize keys: handle both numeric (0, 1, 2) and string ("b0", "b1") keys
            const correctKeys = Object.keys(correctBlanks);
            if (correctKeys.length === 0) return false;

            // Try direct key matching first
            const directMatch = correctKeys.every(key => userBlanks[key] === correctBlanks[key]);
            if (directMatch) return true;

            // Fallback: match by position (sort both and compare values)
            const correctValues = correctKeys
                .sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }))
                .map(k => correctBlanks[k]);
            const userKeys = Object.keys(userBlanks)
                .sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
            const userValues = userKeys.map(k => userBlanks[k]);

            return correctValues.length === userValues.length &&
                correctValues.every((val: string, idx: number) => val === userValues[idx]);
        }

        // ─── SEQUENCING / CONCEPT BUILDER ───
        // Component sends string[] of ordered IDs
        // correct_answer.sequence is the expected order
        case 'sequencing':
        case 'concept_builder': {
            const correctSequence = correctAnswer?.sequence || [];
            const userSequence = answer as string[];
            return userSequence.length === correctSequence.length &&
                userSequence.every((id: string, idx: number) => id === correctSequence[idx]);
        }

        // ─── MATCHING PAIRS ───
        // Component sends true when all pairs are matched (self-validating)
        case 'matching_pairs':
            return answer === true;

        // ─── TAP ACTION ───
        // Component sends string[] of tapped item IDs
        // Targets come from items with isTarget:true OR correct_answer.targetIds
        case 'tap_action': {
            const tappedIds = new Set(answer as string[]);
            const items = content?.items || [];
            const targetIds = new Set<string>(
                items.filter((item: any) => item.isTarget === true).map((item: any) => item.id)
            );
            // Also support legacy correct_answer.targetIds
            const legacyTargets = correctAnswer?.targetIds as string[] | undefined;
            if (legacyTargets) {
                legacyTargets.forEach((id: string) => targetIds.add(id));
            }
            return tappedIds.size === targetIds.size &&
                [...tappedIds].every(id => targetIds.has(id));
        }

        // ─── CLASSIFICATION ───
        // Component sends Record<string, string> mapping item ID to category ID
        // correct_answer.classifications maps item IDs to correct category IDs
        case 'classification': {
            const correctClassifications = correctAnswer?.classifications || {};
            const userClassifications = answer as Record<string, string>;
            const items = content?.items || [];
            return items.every((item: any) =>
                userClassifications[item.id] === correctClassifications[item.id]
            );
        }

        // ─── MATH CHALLENGE ───
        // Component sends string (user's numeric input)
        // correct_answer has correctValue (number/string) or correctOptionId as fallback
        case 'math_challenge': {
            const userStr = String(answer).trim();
            const correctValue = correctAnswer?.correctValue ?? correctAnswer?.correctOptionId;
            if (correctValue === undefined || correctValue === null) return false;
            // Compare as strings first (exact match)
            if (userStr === String(correctValue).trim()) return true;
            // Try numeric comparison with tolerance
            const userNum = parseFloat(userStr);
            const correctNum = parseFloat(String(correctValue));
            if (!isNaN(userNum) && !isNaN(correctNum)) {
                return Math.abs(userNum - correctNum) < 0.01;
            }
            return false;
        }

        // ─── WORD SCRAMBLE ───
        // Component sends string (reconstructed word)
        case 'word_scramble': {
            const correctWord = content?.word || correctAnswer?.word || "";
            return String(answer).toUpperCase() === String(correctWord).toUpperCase();
        }

        // ─── ESTIMATION SLIDER ───
        // Component sends number (slider value)
        // correct_answer has correctValue and tolerance
        case 'estimation_slider': {
            const userVal = Number(answer);
            const correctVal = correctAnswer?.correctValue ?? content?.correctValue;
            const tolerance = correctAnswer?.tolerance ?? content?.tolerance ?? 10;
            if (correctVal === undefined || correctVal === null) return false;
            return Math.abs(userVal - Number(correctVal)) <= Number(tolerance);
        }

        // ─── SPOT THE TRAP ───
        // Component sends string[] of selected trap IDs
        // correct_answer.trapIds is the expected set
        case 'spot_trap': {
            const selectedTraps = new Set(answer as string[]);
            const correctTraps = new Set(correctAnswer?.trapIds || []);
            return selectedTraps.size === correctTraps.size &&
                [...selectedTraps].every(id => correctTraps.has(id));
        }

        // ─── COIN COUNTER ───
        // Component sends number (counted amount)
        case 'coin_counter': {
            const targetAmount = content?.targetAmount;
            return Math.abs(Number(answer) - Number(targetAmount)) < 0.01;
        }

        // ─── SHOP SIM ───
        // Component sends string[] (cart item IDs)
        case 'shop_sim': {
            const correctItems = new Set(correctAnswer?.shopItems || []);
            const userItems = new Set(answer as string[]);
            // If specific correct items are defined, enforce them
            if (correctItems.size > 0) {
                return correctItems.size === userItems.size &&
                    [...correctItems].every(id => userItems.has(id));
            }
            // Otherwise, validate budget constraint
            const budget = content?.budget || 0;
            const products = content?.products || [];
            let totalSpent = 0;
            let itemsFound = 0;
            userItems.forEach(id => {
                const product = products.find((p: any) => p.id === id);
                if (product) {
                    totalSpent += product.price;
                    itemsFound++;
                }
            });
            return itemsFound > 0 && totalSpent <= budget && itemsFound === userItems.size;
        }

        // ─── BUDGET BUILDER ───
        // Component sends Record<string, string> (item ID to category)
        case 'budget_builder': {
            const correctAllocation = correctAnswer?.allocation || {};
            const userAllocation = answer as Record<string, string>;
            const keys = Object.keys(correctAllocation);
            return keys.length > 0 && keys.every(
                key => userAllocation[key] === correctAllocation[key]
            );
        }

        // ─── EXPENSE TIMELINE ───
        // Component sends string[] (ordered IDs)
        case 'expense_timeline': {
            const correctOrder = correctAnswer?.order || [];
            const userOrder = answer as string[];
            return userOrder.length === correctOrder.length &&
                userOrder.every((val: string, index: number) => val === correctOrder[index]);
        }

        // ─── CREDIT SCORE ───
        // Component sends string[] (decision IDs per scenario)
        case 'credit_score': {
            const decisions = answer as string[];
            const initialScore = content?.initialScore || 650;
            const scenarios = content?.scenarios || [];
            let finalScore = initialScore;
            decisions.forEach((decisionId: string, scenarioIndex: number) => {
                const scenario = scenarios[scenarioIndex];
                if (scenario) {
                    const option = scenario.options.find((opt: any) => opt.id === decisionId);
                    if (option) {
                        finalScore += option.scoreChange || 0;
                    }
                }
            });
            const minScore = correctAnswer?.minScore || 700;
            return finalScore >= minScore;
        }

        // ─── EMERGENCY FUND ───
        // Component sends string[] (decision IDs per event)
        case 'emergency_fund': {
            const decisions = answer as string[];
            const initialFund = content?.initialFund || 5000;
            const events = content?.events || [];
            let balance = initialFund;
            decisions.forEach((decisionId: string, eventIndex: number) => {
                const event = events[eventIndex];
                if (event) {
                    const option = event.options.find((opt: any) => opt.id === decisionId);
                    if (option) {
                        balance -= option.cost || 0;
                    }
                }
            });
            return balance >= 0;
        }

        // ─── SALARY COMPARISON ───
        // Component sends string (selected offer ID)
        case 'salary_comparison':
            return answer === correctAnswer?.bestOffer;

        // ─── PORTFOLIO BUILDER ───
        // Component sends Record<string, number> (asset ID to percentage)
        case 'portfolio_builder': {
            const allocation = answer as Record<string, number>;
            const total = Object.values(allocation).reduce((sum, val) => sum + Number(val), 0);
            return Math.abs(total - 100) < 0.01;
        }

        // ─── PASSIVE INCOME ───
        // Component sends string[] (selected stream IDs)
        case 'passive_income': {
            const selected = answer as string[];
            const streams = content?.streams || [];
            const totalIncome = selected.reduce((sum: number, id: string) => {
                const stream = streams.find((s: any) => s.id === id);
                return sum + (stream?.monthlyIncome || 0);
            }, 0);
            const target = content?.targetIncome || 1000;
            return totalIncome >= target;
        }

        // ─── QUIZ BATTLE ───
        // Component sends number (quiz score)
        case 'quiz_battle': {
            const score = Number(answer);
            const minScore = correctAnswer?.minScore || 200;
            return score >= minScore;
        }

        // ─── MYSTERY INVESTMENT ───
        // Component sends Record<string, number> (box ID to coin count) or boolean
        // Validates diversification (minBoxes) - always success after reveal
        case 'mystery_investment': {
            if (typeof answer === 'boolean') return answer;
            const allocation = answer as Record<string, number>;
            const boxesUsed = Object.values(allocation).filter(v => Number(v) > 0).length;
            const minBoxes = correctAnswer?.minBoxes || 2;
            return boxesUsed >= minBoxes;
        }

        // ─── IMPACT METER ───
        // Explorer activity - always correct (donation/impact exploration)
        case 'impact_meter':
            return true;

        // ─── SIMULATORS (always correct - exploratory/educational) ───
        case 'savings_race':
        case 'interest_calculator':
        case 'tax_puzzle':
        case 'subscription_tracker':
        case 'inflation_simulator':
        case 'bill_splitter':
        case 'debt_strategy':
        case 'opportunity_cost':
        case 'goal_roadmap':
        case 'mindset_comparison':
            return true;

        // ─── NARRATIVE / STORY (always correct - consumption activities) ───
        case 'intro_narrative':
        case 'story_mode':
            return true;

        // ─── DEFAULT FALLBACK ───
        // For any unknown type or components that pass explicit boolean results
        default:
            if (typeof answer === 'boolean') return answer;
            // If a component passes a pre-validated result, trust it
            return false;
    }
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
        // Permitir submission desde PLAYING (primer ejercicio) y WAITING_INPUT (subsiguientes)
        // Bloquear durante CHECKING, FEEDBACK, COMPLETED para evitar doble submission
        if (!currentExercise) return false;
        if (state !== 'WAITING_INPUT' && state !== 'PLAYING') return false;

        setState('CHECKING');
        setAttempts(prev => prev + 1);

        // Validación centralizada
        const isCorrect = validateAnswer(currentExercise, answer);

        // Agregar resultado
        setResults(prev => [
            ...prev.filter(r => r.exerciseId !== currentExercise.id),
            {
                exerciseId: currentExercise.id,
                status: isCorrect ? 'correct' : 'incorrect',
                attempts: attempts + 1
            }
        ]);

        // Actualizar estado de feedback directamente (sin setTimeout)
        // IMPORTANTE: No usar setTimeout aquí porque cuando intro_narrative/story_mode
        // llaman submitAnswer() + nextExercise() en secuencia, el setTimeout sobrescribe
        // el estado 'WAITING_INPUT' del siguiente ejercicio con 'FEEDBACK_SUCCESS',
        // causando que TODOS los ejercicios posteriores fallen la validación.
        setState(isCorrect ? 'FEEDBACK_SUCCESS' : 'FEEDBACK_ERROR');

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
