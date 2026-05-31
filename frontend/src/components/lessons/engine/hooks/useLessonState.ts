/**
 * Hook para manejar el estado de la lección (máquina de estados)
 *
 * VALIDACIÓN CENTRALIZADA: Este hook es la ÚNICA fuente de verdad para
 * determinar si una respuesta es correcta o incorrecta. Los componentes
 * de actividad NO deben validar por su cuenta - deben enviar la respuesta
 * cruda a submitAnswer() y usar el valor de retorno para determinar feedback.
 */
import { useState, useCallback, useEffect, useMemo } from 'react';
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
// HELPERS: Extraer el valor correcto de múltiples formatos
// ============================================================

/** Intenta extraer un string ID de respuesta correcta de correct_answer */
export function extractCorrectId(correctAnswer: any): string | undefined {
    if (!correctAnswer || typeof correctAnswer !== 'object') return undefined;
    return correctAnswer.correctOptionId
        ?? correctAnswer.correctChoiceId
        ?? correctAnswer.correctId
        ?? correctAnswer.choiceId
        ?? correctAnswer.correctItemId
        ?? correctAnswer.selectedId
        ?? correctAnswer.correctProductId
        ?? correctAnswer.itemId
        ?? correctAnswer.correctTrapId
        ?? correctAnswer.trapId
        ?? correctAnswer.correctScenarioId
        ?? correctAnswer.correctScenario
        ?? correctAnswer.correctPlanId
        ?? correctAnswer.recommendedOptionId
        ?? correctAnswer.bestChoiceId
        ?? correctAnswer.bestOptionId
        ?? correctAnswer.preferredOption
        ?? correctAnswer.chosenOptionId
        ?? correctAnswer.correctMindsetId
        ?? correctAnswer.betterStrategyId
        ?? correctAnswer.correctOfferId
        ?? correctAnswer.correctResponseId
        ?? correctAnswer.bestResponseId
        ?? correctAnswer.optimalResponseId
        ?? correctAnswer.correctMessageId
        ?? correctAnswer.correctPathId
        ?? correctAnswer.correctStepId
        ?? correctAnswer.correctProfile
        ?? correctAnswer.decision
        ?? correctAnswer.isCorrect;
}

/** Intenta extraer un valor numérico correcto de correct_answer o content */
function extractCorrectNumeric(correctAnswer: any, content?: any): number | undefined {
    if (correctAnswer !== null && typeof correctAnswer === 'object') {
        const val = correctAnswer.value
            ?? correctAnswer.numericAnswer
            ?? correctAnswer.answer
            ?? correctAnswer.calculatedAnswer
            ?? correctAnswer.calculatedValue
            ?? correctAnswer.numericValue
            ?? correctAnswer.correctValue
            ?? correctAnswer.total
            ?? correctAnswer.numeric
            ?? correctAnswer.result
            ?? correctAnswer.targetValue
            ?? correctAnswer.targetAmount
            ?? correctAnswer.finalAmount
            ?? correctAnswer.unit // sometimes unit contains the numeric value
            ?? correctAnswer.costo
            ?? correctAnswer.neto;
        if (val !== undefined && val !== null) return Number(val);
    }
    if (content !== null && typeof content === 'object') {
        const val = content.correctValue
            ?? content.value
            ?? content.numericAnswer
            ?? content.targetAmount;
        if (val !== undefined && val !== null) return Number(val);
    }
    return undefined;
}

/** Intenta extraer un string/texto correcto de correct_answer o content */
function extractCorrectText(correctAnswer: any, content?: any): string | undefined {
    if (correctAnswer !== null && typeof correctAnswer === 'object') {
        const val = correctAnswer.text
            ?? correctAnswer.correctText
            ?? correctAnswer.word
            ?? correctAnswer.correctWord
            ?? correctAnswer.correctResponse
            ?? correctAnswer.answer
            ?? correctAnswer.correctAnswer;
        if (val !== undefined && val !== null) return String(val);
    }
    if (content !== null && typeof content === 'object') {
        const val = content.word
            ?? content.correctWord
            ?? content.text
            ?? content.correctText
            ?? content.answer;
        if (val !== undefined && val !== null) return String(val);
    }
    return undefined;
}

/** Normaliza classification correct_answer a Record<itemId, categoryId> */
function normalizeClassifications(correctAnswer: any, content?: any): Record<string, string> | null {
    // Direct format: { itemId: categoryId }
    if (correctAnswer && typeof correctAnswer === 'object') {
        const keys = Object.keys(correctAnswer);
        if (keys.length > 0) {
            // Check if it's the inverted format: { categoryId: [itemIds] }
            const firstVal = (correctAnswer as any)[keys[0]];
            if (Array.isArray(firstVal)) {
                const inverted: Record<string, string> = {};
                keys.forEach(catId => {
                    const items = (correctAnswer as any)[catId];
                    if (Array.isArray(items)) {
                        items.forEach((itemId: any) => {
                            inverted[String(itemId)] = catId;
                        });
                    }
                });
                return inverted;
            }
            // Check if it's direct format: { itemId: categoryId } (values are strings, not arrays)
            if (typeof firstVal === 'string') {
                return correctAnswer as Record<string, string>;
            }
            // Check if it's category-to-single-item: { categoryId: itemId }
            if (typeof firstVal === 'string' && !keys[0].startsWith('i') && !keys[0].startsWith('it')) {
                // This could be { cat1: "i1" } — invert it
                const inverted: Record<string, string> = {};
                keys.forEach(catId => {
                    inverted[String((correctAnswer as any)[catId])] = catId;
                });
                return inverted;
            }
        }
        // Nested classifications object
        if (correctAnswer.classifications && typeof correctAnswer.classifications === 'object') {
            return normalizeClassifications(correctAnswer.classifications, content);
        }
        if (correctAnswer.categoryAssignments && typeof correctAnswer.categoryAssignments === 'object') {
            return normalizeClassifications(correctAnswer.categoryAssignments, content);
        }
        if (correctAnswer.itemCategoryMap && typeof correctAnswer.itemCategoryMap === 'object') {
            return normalizeClassifications(correctAnswer.itemCategoryMap, content);
        }
        if (correctAnswer.mappings && typeof correctAnswer.mappings === 'object') {
            return normalizeClassifications(correctAnswer.mappings, content);
        }
        if (correctAnswer.mapping && typeof correctAnswer.mapping === 'object') {
            return normalizeClassifications(correctAnswer.mapping, content);
        }
        if (correctAnswer.matches && typeof correctAnswer.matches === 'object') {
            return normalizeClassifications(correctAnswer.matches, content);
        }
        if (correctAnswer.categorizations && typeof correctAnswer.categorizations === 'object') {
            return normalizeClassifications(correctAnswer.categorizations, content);
        }
    }
    // Fallback: build from content.items.correctCategory or correctCategoryId
    if (content?.items && Array.isArray(content.items)) {
        const built: Record<string, string> = {};
        content.items.forEach((item: any) => {
            const cat = item?.correctCategory ?? item?.correctCategoryId;
            if (item?.id && cat) {
                built[String(item.id)] = String(cat);
            }
        });
        if (Object.keys(built).length > 0) return built;
    }
    return null;
}

/** Normaliza budget builder correct_answer */
function normalizeBudgetCorrect(correctAnswer: any): { type: 'allocation'; data: Record<string, number> } | { type: 'min'; category: string; amount: number } | { type: 'option'; id: string } | { type: 'valid' } | null {
    if (!correctAnswer || typeof correctAnswer !== 'object') return null;

    // Option-based: correctOptionId
    const optId = extractCorrectId(correctAnswer);
    if (optId) return { type: 'option', id: optId };

    // Min-category validation: minCategory + minAmount
    if (correctAnswer.minCategory && correctAnswer.minAmount !== undefined) {
        return { type: 'min', category: String(correctAnswer.minCategory), amount: Number(correctAnswer.minAmount) };
    }

    // Allocation nested
    if (correctAnswer.allocation && typeof correctAnswer.allocation === 'object') {
        const alloc: Record<string, number> = {};
        Object.keys(correctAnswer.allocation).forEach(k => {
            alloc[k] = Number(correctAnswer.allocation[k]);
        });
        return { type: 'allocation', data: alloc };
    }
    if (correctAnswer.allocations && typeof correctAnswer.allocations === 'object') {
        const alloc: Record<string, number> = {};
        Object.keys(correctAnswer.allocations).forEach(k => {
            alloc[k] = Number(correctAnswer.allocations[k]);
        });
        return { type: 'allocation', data: alloc };
    }

    // Direct numeric values (e.g. { c1: 100, c2: 250 })
    const keys = Object.keys(correctAnswer);
    const numericKeys = keys.filter(k =>
        k !== 'feedback' && k !== 'success' && k !== 'error' &&
        typeof correctAnswer[k] === 'number'
    );
    if (numericKeys.length > 0) {
        const alloc: Record<string, number> = {};
        numericKeys.forEach(k => {
            alloc[k] = Number(correctAnswer[k]);
        });
        return { type: 'allocation', data: alloc };
    }

    // Boolean / condition based
    if (correctAnswer.isValid === true || correctAnswer.isValidAllocation === true || correctAnswer.isValidBudget === true) {
        return { type: 'valid' };
    }

    return null;
}

/** Compara dos números con tolerancia */
function numericMatch(a: number, b: number, tolerance: number = 0.01): boolean {
    return Math.abs(a - b) <= tolerance;
}

/** Compara dos strings insensitivamente */
function stringMatch(a: string, b: string): boolean {
    return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
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
        case 'debt_strategy':
        case 'tax_puzzle':
        case 'mindset_comparison':
        case 'opportunity_cost':
        case 'impact_meter':
        case 'case_real':
        case 'case_study':
        case 'decision_challenge': {
            const correctId = extractCorrectId(correctAnswer);
            if (correctId !== undefined) return String(answer) === String(correctId);
            // Fallback for types that don't have explicit correct_answer
            return true;
        }

        // ─── TRUE/FALSE ───
        case 'true_false': {
            const correctId = extractCorrectId(correctAnswer);
            if (correctId !== undefined) return String(answer) === String(correctId);
            return answer === correctAnswer?.isTrue;
        }

        // ─── STORY MODE ───
        // Component sends string (selected choice ID)
        case 'story_mode': {
            const correctId = extractCorrectId(correctAnswer);
            if (correctId !== undefined) return String(answer) === String(correctId);
            // Some story modes are consumption-only (no correct answer)
            return true;
        }

        // ─── FILL BLANK ───
        // Component sends Record<number|string, string> mapping blank index/id to word id
        // OR a plain string for free text input
        case 'fill_blank': {
            // If answer is a string (free text input), compare directly
            if (typeof answer === 'string') {
                const correctText = extractCorrectText(correctAnswer, content);
                if (correctText === undefined) return false;
                return stringMatch(answer, correctText);
            }
            // Word bank / blank mapping mode
            const correctBlanks = correctAnswer?.blank_ids
                || correctAnswer?.blanks
                || correctAnswer?.blankAssignments
                || correctAnswer?.filledBlanks
                || {};
            const userBlanks = answer as Record<string, string>;

            const correctKeys = Object.keys(correctBlanks);
            if (correctKeys.length === 0) {
                // If no explicit blank mapping, try to validate against correct text
                const correctText = extractCorrectText(correctAnswer, content);
                if (correctText !== undefined) {
                    const userValues = Object.values(userBlanks).join(' ').trim();
                    return stringMatch(userValues, correctText);
                }
                return false;
            }

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

        // ─── SEQUENCING / CONCEPT BUILDER / GOAL ROADMAP ───
        // Component sends string[] of ordered IDs
        case 'sequencing':
        case 'concept_builder':
        case 'goal_roadmap': {
            const correctSequence = correctAnswer?.sequence
                || correctAnswer?.correctSequence
                || correctAnswer?.order
                || correctAnswer?.correctOrder
                || [];
            const userSequence = answer as string[];
            if (!Array.isArray(userSequence)) return false;
            if (correctSequence.length > 0) {
                return userSequence.length === correctSequence.length &&
                    userSequence.every((id: string, idx: number) => id === correctSequence[idx]);
            }
            // Fallback: if items have implicit order (e.g., already ordered in content)
            if (content?.items && Array.isArray(content.items)) {
                const expectedIds = content.items.map((item: any) => String(item?.id)).filter(Boolean);
                return userSequence.length === expectedIds.length &&
                    userSequence.every((id: string, idx: number) => id === expectedIds[idx]);
            }
            return true;
        }

        // ─── MATCHING PAIRS ───
        // Component sends true when all pairs are matched (self-validating)
        case 'matching_pairs':
        case 'match_pairs':
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
            if (targetIds.size === 0) return false;
            return tappedIds.size === targetIds.size &&
                [...tappedIds].every(id => targetIds.has(id));
        }

        // ─── CLASSIFICATION ───
        // Component sends Record<string, string> mapping item ID to category ID
        case 'classification': {
            const correctClassifications = normalizeClassifications(correctAnswer, content);
            if (!correctClassifications) {
                // No way to validate — assume correct (content issue)
                return true;
            }
            const userClassifications = answer as Record<string, string>;
            if (typeof userClassifications !== 'object' || userClassifications === null) return false;
            const items = content?.items || [];
            return items.every((item: any) =>
                userClassifications[item.id] === correctClassifications[item.id]
            );
        }

        // ─── MATH CHALLENGE ───
        // Component sends string (user's numeric input)
        case 'math_challenge': {
            const userStr = String(answer).trim();
            const correctValue = extractCorrectNumeric(correctAnswer, content);
            if (correctValue === undefined) {
                // Try text-based fallback
                const correctText = extractCorrectText(correctAnswer, content);
                if (correctText !== undefined) return stringMatch(userStr, correctText);
                return false;
            }
            const tolerance = Number(correctAnswer?.tolerance ?? correctAnswer?.tolerance ?? 0.01);
            // Compare as strings first (exact match)
            if (userStr === String(correctValue).trim()) return true;
            // Try numeric comparison with tolerance
            const userNum = parseFloat(userStr);
            if (!isNaN(userNum)) {
                return numericMatch(userNum, correctValue, tolerance);
            }
            return false;
        }

        // ─── WORD SCRAMBLE ───
        // Component sends string (reconstructed word)
        case 'word_scramble': {
            const correctWord = extractCorrectText(correctAnswer, content);
            if (correctWord === undefined) return false;
            return String(answer).toUpperCase() === String(correctWord).toUpperCase();
        }

        // ─── ESTIMATION SLIDER ───
        // Component sends number (slider value)
        case 'estimation_slider': {
            // Range-based: correctRangeId comparison
            const correctRangeId = correctAnswer?.correctRangeId ?? correctAnswer?.rangeId;
            if (correctRangeId !== undefined && content?.ranges && Array.isArray(content.ranges)) {
                const userVal = Number(answer);
                const targetRange = content.ranges.find((r: any) => r.id === correctRangeId);
                if (targetRange) {
                    const min = Number(targetRange.minValue ?? targetRange.min ?? -Infinity);
                    const max = Number(targetRange.maxValue ?? targetRange.max ?? Infinity);
                    return userVal >= min && userVal <= max;
                }
                // Fallback: direct string comparison if range not found
                return String(answer) === String(correctRangeId);
            }
            // Numeric value comparison
            const correctVal = extractCorrectNumeric(correctAnswer, content);
            if (correctVal === undefined) {
                // Fallback: some JSONs use { range: { min, max } }
                const range = correctAnswer?.range ?? content?.range;
                if (range && typeof range === 'object') {
                    const userVal = Number(answer);
                    return userVal >= Number(range.min ?? 0) && userVal <= Number(range.max ?? 100);
                }
                return false;
            }
            const tolerance = Number(correctAnswer?.tolerance ?? content?.tolerance ?? 10);
            return numericMatch(Number(answer), correctVal, tolerance);
        }

        // ─── SPOT THE TRAP ───
        // Component sends string[] of selected trap IDs
        case 'spot_trap': {
            const selectedTraps = new Set(Array.isArray(answer) ? answer : [String(answer)]);
            // Try explicit trap IDs from correct_answer
            let correctTraps: Set<string> = new Set();
            if (correctAnswer?.trapIds && Array.isArray(correctAnswer.trapIds)) {
                correctAnswer.trapIds.forEach((id: any) => correctTraps.add(String(id)));
            }
            if (correctAnswer?.correctTrapIds && Array.isArray(correctAnswer.correctTrapIds)) {
                correctAnswer.correctTrapIds.forEach((id: any) => correctTraps.add(String(id)));
            }
            if (correctAnswer?.correctTraps && Array.isArray(correctAnswer.correctTraps)) {
                correctAnswer.correctTraps.forEach((id: any) => correctTraps.add(String(id)));
            }
            if (correctAnswer?.correctTrapId) {
                correctTraps.add(String(correctAnswer.correctTrapId));
            }
            if (correctAnswer?.trapId) {
                correctTraps.add(String(correctAnswer.trapId));
            }
            if (correctAnswer?.targetIds && Array.isArray(correctAnswer.targetIds)) {
                correctAnswer.targetIds.forEach((id: any) => correctTraps.add(String(id)));
            }
            if (correctAnswer?.trapIds && typeof correctAnswer.trapIds === 'string') {
                correctTraps.add(String(correctAnswer.trapIds));
            }
            if (correctTraps.size > 0) {
                return selectedTraps.size === correctTraps.size &&
                    [...selectedTraps].every(id => correctTraps.has(id));
            }
            // Fallback: build trap IDs from content.scenarios or content.messages
            if (Array.isArray(content?.scenarios)) {
                content.scenarios.forEach((s: any) => {
                    if (s.isTrap && s.id) correctTraps.add(String(s.id));
                });
            }
            if (Array.isArray(content?.messages)) {
                content.messages.forEach((m: any) => {
                    if (m.isTrap && m.id) correctTraps.add(String(m.id));
                });
            }
            if (Array.isArray(content?.plans)) {
                content.plans.forEach((p: any) => {
                    if (p.isTrap && p.id) correctTraps.add(String(p.id));
                });
            }
            if (correctTraps.size === 0) return false;
            return selectedTraps.size === correctTraps.size &&
                [...selectedTraps].every(id => correctTraps.has(id));
        }

        // ─── COIN COUNTER ───
        // Component sends number (counted amount)
        case 'coin_counter': {
            if (answer == null) return false;
            const targetAmount = content?.targetAmount ?? content?.target;
            return numericMatch(Number(answer), Number(targetAmount), 0.01);
        }

        // ─── SHOP SIM ───
        // Component sends string[] (cart item IDs) OR string (single selected item)
        case 'shop_sim': {
            // Single selection mode
            const correctId = extractCorrectId(correctAnswer);
            if (correctId !== undefined) {
                return String(answer) === String(correctId);
            }
            // Multi-selection mode with correctItems
            if (correctAnswer?.correctItems && Array.isArray(correctAnswer.correctItems)) {
                const correctItems = new Set<string>(correctAnswer.correctItems.map(String));
                const userItems = new Set(Array.isArray(answer) ? answer.map(String) : [String(answer)]);
                return correctItems.size === userItems.size &&
                    [...correctItems].every(id => userItems.has(id));
            }
            // Legacy shopItems
            const correctItems = new Set<string>(
                (correctAnswer?.shopItems || []).map(String)
            );
            const userItems = new Set(Array.isArray(answer) ? answer.map(String) : [String(answer)]);
            if (correctItems.size > 0) {
                return correctItems.size === userItems.size &&
                    [...correctItems].every(id => userItems.has(id));
            }
            // Validate total if specified
            const expectedTotal = extractCorrectNumeric(correctAnswer, content);
            if (expectedTotal !== undefined) {
                const products = content?.products || content?.items || [];
                let totalSpent = 0;
                const userArr = Array.isArray(answer) ? answer : [String(answer)];
                userArr.forEach((id: any) => {
                    const product = products.find((p: any) => p.id === id || p.name === id);
                    if (product) {
                        totalSpent += Number(product.price ?? 0);
                    }
                });
                return numericMatch(totalSpent, expectedTotal, 0.01);
            }
            // Budget constraint validation
            const budget = content?.budget || 0;
            const products = content?.products || content?.items || [];
            let totalSpent = 0;
            let itemsFound = 0;
            const userArr = Array.isArray(answer) ? answer : [String(answer)];
            userArr.forEach((id: any) => {
                const product = products.find((p: any) => p.id === id);
                if (product) {
                    totalSpent += Number(product.price ?? 0);
                    itemsFound++;
                }
            });
            return itemsFound > 0 && totalSpent <= budget && itemsFound === userArr.length;
        }

        // ─── BUDGET BUILDER ───
        // Component sends Record<string, number> (newSchema sliders)
        // OR Record<string, string> (legacySchema drag-drop)
        case 'budget_builder': {
            const normalized = normalizeBudgetCorrect(correctAnswer);
            if (!normalized) {
                // No correct_answer defined — trust component's local validation
                return true;
            }
            switch (normalized.type) {
                case 'option':
                    return String(answer) === normalized.id;
                case 'min': {
                    // answer is Record<string, number>
                    const alloc = answer as Record<string, number>;
                    const val = Number(alloc?.[normalized.category] ?? 0);
                    return val >= normalized.amount;
                }
                case 'allocation': {
                    // answer is Record<string, number|string>
                    const userAlloc = answer as Record<string, number | string>;
                    const tolerance = Number(correctAnswer?.tolerance ?? correctAnswer?.tolerance ?? 0.01);
                    return Object.keys(normalized.data).every(key => {
                        const expected = normalized.data[key];
                        const actual = Number(userAlloc?.[key] ?? 0);
                        return numericMatch(actual, expected, tolerance);
                    });
                }
                case 'valid':
                    return true;
            }
            return true;
        }

        // ─── EXPENSE TIMELINE ───
        // Component sends string[] (ordered IDs)
        case 'expense_timeline': {
            const correctOrder = correctAnswer?.order
                || correctAnswer?.sequence
                || correctAnswer?.correctOrder
                || [];
            const userOrder = answer as string[];
            if (!Array.isArray(userOrder)) return false;
            return userOrder.length === correctOrder.length &&
                userOrder.every((val: string, index: number) => val === correctOrder[index]);
        }

        // ─── CREDIT SCORE ───
        // Component sends string[] (decision IDs per scenario) OR string (single choice)
        case 'credit_score': {
            const correctId = extractCorrectId(correctAnswer);
            if (correctId !== undefined) return String(answer) === String(correctId);
            // Simulator mode: validate score threshold
            const decisions = Array.isArray(answer) ? answer : Object.values(answer || {});
            const initialScore = content?.initialScore || 650;
            const scenarios = content?.scenarios || [];
            let finalScore = initialScore;
            decisions.forEach((decisionId: any, scenarioIndex: number) => {
                const scenario = scenarios[scenarioIndex];
                if (scenario) {
                    const option = scenario.options?.find((opt: any) => opt.id === decisionId);
                    if (option) {
                        finalScore += option.scoreChange || 0;
                    }
                }
            });
            const minScore = correctAnswer?.minScore || 700;
            return finalScore >= minScore;
        }

        // ─── EMERGENCY FUND ───
        // Component sends Record<string, string> (eventId -> decisionId)
        case 'emergency_fund': {
            // Support both array and object formats
            const decisions = Array.isArray(answer)
                ? answer
                : Object.values(answer || {});
            const initialFund = content?.initialFund || 5000;
            const events = content?.events || [];
            let balance = initialFund;
            decisions.forEach((decisionId: any, eventIndex: number) => {
                const event = events[eventIndex];
                if (event) {
                    const option = event.options?.find((opt: any) => opt.id === decisionId);
                    if (option) {
                        balance -= option.cost || 0;
                    }
                }
            });
            return balance >= 0;
        }

        // ─── SALARY COMPARISON ───
        // Component sends string (selected offer ID)
        case 'salary_comparison': {
            const correctId = extractCorrectId(correctAnswer);
            if (correctId !== undefined) return String(answer) === String(correctId);
            return answer === correctAnswer?.bestOffer;
        }

        // ─── PORTFOLIO BUILDER ───
        // Component sends Record<string, number> (asset ID to percentage)
        case 'portfolio_builder': {
            const correctId = extractCorrectId(correctAnswer);
            if (correctId !== undefined) {
                return String(answer) === String(correctId);
            }
            // Allocation validation: sum must be ~100%
            const allocation = answer as Record<string, number>;
            if (typeof allocation !== 'object' || allocation === null) return false;
            const total = Object.values(allocation).reduce((sum, val) => sum + Number(val), 0);
            return numericMatch(total, 100, 0.01);
        }

        // ─── PASSIVE INCOME ───
        // Component sends string[] (selected stream IDs)
        case 'passive_income': {
            const selected = Array.isArray(answer) ? answer : Object.keys(answer || {});
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
        case 'mystery_investment': {
            if (typeof answer === 'boolean') return answer;
            const allocation = answer as Record<string, number>;
            const boxesUsed = Object.values(allocation).filter(v => Number(v) > 0).length;
            const minBoxes = correctAnswer?.minBoxes || 2;
            return boxesUsed >= minBoxes;
        }

        // ─── INTEREST CALCULATOR ───
        // Component sends { principal, rate, time } or number/string
        case 'interest_calculator': {
            const correctId = extractCorrectId(correctAnswer);
            if (correctId !== undefined) return String(answer) === String(correctId);
            const correctVal = extractCorrectNumeric(correctAnswer, content);
            if (correctVal !== undefined) {
                const tolerance = Number(correctAnswer?.tolerance ?? 0.01);
                return numericMatch(Number(answer), correctVal, tolerance);
            }
            // If it's an object with calculation fields, trust the component
            return true;
        }

        // ─── COMPARISON / COMPARE / COMPARISON_* ───
        case 'comparison':
        case 'compare':
        case 'comparison_chart':
        case 'comparison_matrix':
        case 'comparison_slider':
        case 'comparison_table':
        case 'comparison_challenge': {
            const correctId = extractCorrectId(correctAnswer);
            if (correctId !== undefined) return String(answer) === String(correctId);
            // Some comparison types use leftIds/rightIds
            if (correctAnswer?.leftIds && Array.isArray(answer)) {
                const leftIds = new Set((correctAnswer.leftIds as string[]).map(String));
                const userLeft = new Set((answer as string[]).map(String));
                return leftIds.size === userLeft.size && [...leftIds].every(id => userLeft.has(id));
            }
            if (correctAnswer?.left && Array.isArray(answer)) {
                const leftIds = new Set((correctAnswer.left as string[]).map(String));
                const userLeft = new Set((answer as string[]).map(String));
                return leftIds.size === userLeft.size && [...leftIds].every(id => userLeft.has(id));
            }
            if (correctAnswer?.betterOption) {
                return String(answer).toUpperCase() === String(correctAnswer.betterOption).toUpperCase();
            }
            return true;
        }

        // ─── DECISION MATRIX ───
        case 'decision_matrix': {
            const correctId = extractCorrectId(correctAnswer);
            if (correctId !== undefined) return String(answer) === String(correctId);
            if (correctAnswer?.decision) {
                return String(answer) === String(correctAnswer.decision);
            }
            return true;
        }

        // ─── BILL SPLITTER / SUBSCRIPTION TRACKER / INFLATION SIMULATOR / SAVINGS RACE ───
        // Exploratory simulators: always correct unless explicit correct_answer exists
        case 'bill_splitter':
        case 'subscription_tracker':
        case 'inflation_simulator':
        case 'savings_race': {
            const correctId = extractCorrectId(correctAnswer);
            if (correctId !== undefined) return String(answer) === String(correctId);
            const correctVal = extractCorrectNumeric(correctAnswer, content);
            if (correctVal !== undefined) {
                const tolerance = Number(correctAnswer?.tolerance ?? 0.01);
                return numericMatch(Number(answer), correctVal, tolerance);
            }
            return true;
        }

        // ─── NARRATIVE / INTRO (always correct - consumption activities) ───
        case 'intro_narrative':
            return true;

        // ─── UNMAPPED TYPES (defensive) ───
        case 'drag_drop':
        case 'sorting_buckets':
        case 'image_hotspot':
        case 'balance_scale': {
            const correctId = extractCorrectId(correctAnswer);
            if (correctId !== undefined) return String(answer) === String(correctId);
            console.warn(`[LessonEngine] validateAnswer: unmapped exercise type '${type}'`);
            return false;
        }

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

    const timeline = useMemo(() => lessonData?.timeline || [], [lessonData?.timeline]);
    const totalExercises = timeline.length;
    const currentExercise = timeline[currentExerciseIndex] || null;
    const progress = useMemo(() =>
        totalExercises > 0 ? Math.round(((currentExerciseIndex + 1) / totalExercises) * 100) : 0,
    [currentExerciseIndex, totalExercises]);

    // Reset state machine when lesson data changes (navigating to a new lesson)
    useEffect(() => {
        setState('IDLE');
        setCurrentExerciseIndex(0);
        setResults([]);
        setAttempts(0);
    }, [lessonData]);

    const startLesson = useCallback(() => {
        setState('PLAYING');
        setCurrentExerciseIndex(0);
        setResults([]);
        setAttempts(0);
    }, []);

    const submitAnswer = useCallback((answer: string | Record<string, string> | string[] | boolean | any): boolean => {
        // Permitir submission desde PLAYING (primer ejercicio) y WAITING_INPUT (subsiguientes)
        // Bloquear durante CHECKING, FEEDBACK, COMPLETED para evitar doble submission
        if (!currentExercise) {
            console.warn('[LessonEngine] submitAnswer blocked: no currentExercise');
            return false;
        }
        if (state !== 'WAITING_INPUT' && state !== 'PLAYING') {
            console.warn(`[LessonEngine] submitAnswer blocked: state is '${state}', expected WAITING_INPUT or PLAYING. Exercise type: ${currentExercise.type}`);
            return false;
        }

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
            // Tipos de consumo (narrativas) inician en PLAYING, el resto en WAITING_INPUT
            const nextExercise = timeline[nextIndex];
            if (nextExercise?.type === 'intro_narrative' || nextExercise?.type === 'story_mode') {
                setState('PLAYING');
            } else {
                setState('WAITING_INPUT');
            }
        }
    }, [currentExerciseIndex, totalExercises, timeline]);

    // Retry after error - reset state to allow new attempt
    const retryExercise = useCallback(() => {
        setState('WAITING_INPUT');
        setAttempts(0);
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
