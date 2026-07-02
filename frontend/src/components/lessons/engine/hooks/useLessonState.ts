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
        // ── Additional single-id aliases observed across the real lesson corpus ──
        // (audit 2026-06-16: many activities use these instead of correctOptionId)
        ?? correctAnswer.correctOption
        ?? correctAnswer.correctChoice
        ?? correctAnswer.chosenOption
        ?? correctAnswer.betterOption
        ?? correctAnswer.correctMindset
        ?? correctAnswer.correctApproach
        ?? correctAnswer.selectedApproach
        ?? correctAnswer.betterMindsetId
        ?? correctAnswer.preferredOptionId
        ?? correctAnswer.optimalOptionId
        ?? correctAnswer.optimalChoice
        ?? correctAnswer.lowerRiskOptionId
        ?? correctAnswer.correctPortfolio
        ?? correctAnswer.correctPortfolioId
        ?? correctAnswer.chosenStrategy
        ?? correctAnswer.strategyWithHigherOpportunityCost
        ?? correctAnswer.optionId
        ?? correctAnswer.selectedOptionId
        ?? correctAnswer.selectedProductId
        ?? correctAnswer.selectedItemId
        ?? correctAnswer.preferredOffer
        ?? correctAnswer.chosenOffer
        ?? correctAnswer.selectedOffer
        ?? correctAnswer.correctMarket
        ?? correctAnswer.correctCity
        ?? correctAnswer.correctItem
        ?? correctAnswer.selectedPriceId
        ?? correctAnswer.selectedStoreId
        ?? correctAnswer.cheaperItemId
        ?? correctAnswer.correctCaseId
        ?? correctAnswer.correctPlan
        ?? correctAnswer.correctModel
        ?? correctAnswer.correctProject
        ?? correctAnswer.correctEntrepreneur
        ?? correctAnswer.bestScenarioId
        // ── spot_trap single-id aliases (the item to flag / the correct spot) ──
        ?? correctAnswer.targetId
        ?? correctAnswer.correctStatementId
        ?? correctAnswer.incorrectStatementId
        ?? correctAnswer.incorrectPlanId
        ?? correctAnswer.incorrectOptionId
        ?? correctAnswer.incorrectStepId
        ?? correctAnswer.incorrectSegmentId
        ?? correctAnswer.incorrectLineId
        ?? correctAnswer.trapStepId
        ?? correctAnswer.trapSegmentId
        ?? correctAnswer.trapStatementId
        ?? correctAnswer.trapOptionId
        ?? correctAnswer.trapActionId
        ?? correctAnswer.trapPlanId
        ?? correctAnswer.trapCaseId
        ?? correctAnswer.trapScenarioId
        ?? correctAnswer.trapOfferId
        ?? correctAnswer.trapItemId
        ?? correctAnswer.correctReportId
        ?? correctAnswer.correctZoneId
        ?? correctAnswer.targetStepId
        ?? correctAnswer.targetPlanId
        ?? correctAnswer.trappedProfileId
        ?? correctAnswer.segmentId
        ?? correctAnswer.planId
        ?? correctAnswer.portfolioId
        ?? correctAnswer.decision
        ?? correctAnswer.isCorrect;
}

/**
 * Compara una respuesta de opción contra el id correcto de forma tolerante a
 * esquemas de id distintos entre datos y componente.
 * Ej.: el componente MindsetComparison emite ids 'A'/'B' pero el dato dice
 * 'mindsetB'/'approachB'. Hacemos match exacto y, como respaldo, comparando
 * tras quitar prefijos semánticos comunes en AMBOS lados.
 */
function optionIdMatches(answer: any, correctId: any): boolean {
    const a = String(answer).trim();
    const c = String(correctId).trim();
    if (a === c) return true;
    if (a.toLowerCase() === c.toLowerCase()) return true;
    const strip = (s: string) =>
        s.replace(/^(mindset|approach|option|opcion|plan|offer|oferta|strategy|strat|choice|item|product|producto)[\s_-]*/i, '').toLowerCase();
    const sa = strip(a);
    const sc = strip(c);
    // Solo aceptar el match por sufijo cuando realmente removimos un prefijo en
    // alguno de los dos (evita igualar cadenas no relacionadas) y el resto no es vacío.
    if (sa && sc && sa === sc && (sa !== a.toLowerCase() || sc !== c.toLowerCase())) return true;
    return false;
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
            ?? correctAnswer.correctAnswer
            ?? correctAnswer.solution
            ?? correctAnswer.calculatedResult
            ?? correctAnswer.value;
        if (val !== undefined && val !== null && typeof val !== 'object') return String(val);
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

/** Construye un resolvedor clave-de-categoría -> cat.id canónico usando content.categories.
 *  Permite que respuestas invertidas con clave por NOMBRE/slug (p.ej. {ETF:[...]} o
 *  {"Atención":[...]}) se comparen contra el cat.id que el componente realmente emite. */
function buildCategoryResolver(content?: any): (key: string) => string {
    const cats = content?.categories;
    if (!Array.isArray(cats)) return (k) => String(k);
    const lookup: Record<string, string> = {};
    cats.forEach((c: any) => {
        const id = c?.id ?? c?.value;
        if (id == null) return;
        const sid = String(id);
        lookup[sid.toLowerCase()] = sid;
        [c?.name, c?.label, c?.title].forEach((n: any) => {
            if (n != null) lookup[String(n).toLowerCase()] = sid;
        });
    });
    return (k) => lookup[String(k).toLowerCase()] ?? String(k);
}

/** Construye Record<itemId, categoryId> a partir de un array de objetos
 *  [{itemId, categoryId}, ...] (también item/id, category/catId, sectionId, columnId). */
function classificationsFromArray(arr: any[], resolve: (k: string) => string): Record<string, string> | null {
    const map: Record<string, string> = {};
    arr.forEach((el: any) => {
        if (!el || typeof el !== 'object') return;
        const iid = el.itemId ?? el.item ?? el.id ?? el.elementId;
        const cid = el.categoryId ?? el.category ?? el.catId ?? el.sectionId ?? el.columnId ?? el.bucketId;
        if (iid != null && cid != null) map[String(iid)] = resolve(String(cid));
    });
    return Object.keys(map).length > 0 ? map : null;
}

/** Normaliza classification correct_answer a Record<itemId, categoryId>.
 *  IMPORTANTE: las claves-wrapper nombradas y los arrays-de-objetos se detectan
 *  ANTES de la detección genérica de formato invertido, para no mal-interpretar
 *  { categoryAssignments:[...] } / { matches:[...] } como mapas invertidos. */
function normalizeClassifications(correctAnswer: any, content?: any): Record<string, string> | null {
    const resolve = buildCategoryResolver(content);

    // Array-of-objects: [{itemId, categoryId}, ...]
    if (Array.isArray(correctAnswer)) {
        return classificationsFromArray(correctAnswer, resolve);
    }

    if (correctAnswer && typeof correctAnswer === 'object') {
        // 1) Desenvolver claves-wrapper conocidas PRIMERO
        const WRAPPERS = ['classifications', 'classification', 'categoryAssignments', 'assignments',
            'categorizations', 'sectionAssignments', 'columnAssignments', 'itemCategoryMap',
            'mappings', 'mapping', 'matches', 'categoryItems', 'itemsByCategory', 'categories',
            'placement', 'categoryMatches'];
        for (const w of WRAPPERS) {
            if (correctAnswer[w] != null && typeof correctAnswer[w] === 'object') {
                return normalizeClassifications(correctAnswer[w], content);
            }
        }

        const keys = Object.keys(correctAnswer);
        if (keys.length > 0) {
            const firstVal = (correctAnswer as any)[keys[0]];
            // 2) Formato invertido: { categoryKey: [itemIds] } — resolver categoryKey -> cat.id
            if (Array.isArray(firstVal)) {
                const inverted: Record<string, string> = {};
                keys.forEach(catKey => {
                    const items = (correctAnswer as any)[catKey];
                    if (Array.isArray(items)) {
                        const cid = resolve(catKey);
                        items.forEach((itemId: any) => {
                            const iid = (itemId && typeof itemId === 'object')
                                ? (itemId.id ?? itemId.itemId)
                                : itemId;
                            if (iid != null) inverted[String(iid)] = cid;
                        });
                    }
                });
                return Object.keys(inverted).length > 0 ? inverted : null;
            }
            // 3) Formato directo: { itemId: categoryId } (valores string) — resolver valores
            if (typeof firstVal === 'string') {
                const direct: Record<string, string> = {};
                keys.forEach(itemId => {
                    direct[String(itemId)] = resolve(String((correctAnswer as any)[itemId]));
                });
                return direct;
            }
            // 4) Valores objeto: intentar como array-de-objetos disfrazado
            if (firstVal && typeof firstVal === 'object') {
                const fromArr = classificationsFromArray(keys.map(k => (correctAnswer as any)[k]), resolve);
                if (fromArr) return fromArr;
            }
        }
    }

    // 5) Fallback: construir desde content.items.correctCategory / correctCategoryId
    if (content?.items && Array.isArray(content.items)) {
        const built: Record<string, string> = {};
        content.items.forEach((item: any) => {
            const cat = item?.correctCategory ?? item?.correctCategoryId;
            if (item?.id && cat) built[String(item.id)] = resolve(String(cat));
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

/** Extrae la lista ORDENADA de respuestas esperadas para fill_blank desde los
 *  múltiples formatos reales de correct_answer/content. Los valores pueden ser
 *  textos o ids de palabra según el dato (el caso compara contra ambas formas). */
function fillBlankExpected(correctAnswer: any, content?: any): string[] | null {
    const out: string[] = [];
    const pushVal = (x: any) => {
        if (x == null) return;
        if (typeof x === 'object') {
            const t = x.text ?? x.correctText ?? x.correctWord ?? x.answer ?? x.word ?? x.wordId ?? x.id;
            if (t != null) out.push(String(t));
        } else out.push(String(x));
    };
    if (correctAnswer && typeof correctAnswer === 'object' && !Array.isArray(correctAnswer)) {
        const arrKey = correctAnswer.blanks ?? correctAnswer.blankValues ?? correctAnswer.values
            ?? correctAnswer.filledBlanks ?? correctAnswer.words ?? correctAnswer.answers
            ?? correctAnswer.gaps ?? correctAnswer.phrases ?? correctAnswer.correctSequence
            ?? correctAnswer.correctOrder ?? correctAnswer.correctBlanks ?? correctAnswer.sequence
            ?? correctAnswer.solution ?? correctAnswer.correctWords;
        if (Array.isArray(arrKey)) arrKey.forEach(pushVal);
        if (out.length === 0 && Array.isArray(correctAnswer.blankAnswers)) {
            correctAnswer.blankAnswers.forEach((b: any) => pushVal(b?.answer ?? b?.text ?? b?.correctText ?? b?.wordId));
        }
        if (out.length === 0 && Array.isArray(correctAnswer.blankAssignments)) {
            correctAnswer.blankAssignments.forEach((b: any) => pushVal(b?.wordId ?? b?.answer ?? b?.text));
        }
        // numeric / blankN / bN / __N__ / PN keys, ordered numerically
        if (out.length === 0) {
            const numKeys = Object.keys(correctAnswer).filter(k => /^(blank|b|gap|w|__|p|palabra|falta)?_?\d+_?_?$/i.test(k));
            if (numKeys.length > 0) {
                numKeys.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
                    .forEach(k => pushVal((correctAnswer as any)[k]));
            }
        }
        // single text keys (whole-blank / whole-template)
        if (out.length === 0) {
            const single = correctAnswer.text ?? correctAnswer.correctText ?? correctAnswer.word
                ?? correctAnswer.correctWord ?? correctAnswer.correctOption ?? correctAnswer.correctResponse
                ?? correctAnswer.value ?? correctAnswer.answer ?? correctAnswer.correctAnswer
                ?? correctAnswer.filledText ?? correctAnswer.filledTemplate ?? correctAnswer.phrase
                ?? correctAnswer.blank ?? correctAnswer.filledWord;
            if (single != null) pushVal(single);
        }
    } else if (Array.isArray(correctAnswer)) {
        correctAnswer.forEach(pushVal);
    } else if (typeof correctAnswer === 'string' || typeof correctAnswer === 'number') {
        pushVal(correctAnswer);
    }
    if (out.length === 0 && Array.isArray(content?.blanks)) {
        content.blanks.forEach((b: any) => pushVal(typeof b === 'object'
            ? (b.correctText ?? b.correctWord ?? b.text ?? b.answer ?? b.word) : b));
    }
    return out.length > 0 ? out : null;
}

// ============================================================
// HELPER: Validar respuesta según tipo de ejercicio
// Cada tipo de actividad tiene su propia lógica de validación.
// ============================================================
export function validateAnswer(exercise: ExerciseData, answer: any): boolean {
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
            // Multi-answer shape (rare): the user must pick exactly this set of ids.
            const multi = correctAnswer?.correctOptionIds ?? correctAnswer?.correctChoiceIds ?? correctAnswer?.trueOptionIds;
            if (Array.isArray(multi)) {
                const want = new Set(multi.map((x: any) => String(x)));
                const got = new Set((Array.isArray(answer) ? answer : [answer]).map((x: any) => String(x)));
                return want.size === got.size && [...want].every(id => got.has(id));
            }
            const correctId = extractCorrectId(correctAnswer);
            if (correctId !== undefined) return optionIdMatches(answer, correctId);
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
            const expected = fillBlankExpected(correctAnswer, content);

            // Build the user's filled values, both raw and resolved-to-text.
            let userRaw: string[];
            let userText: string[];
            if (typeof answer === 'string') {
                const s = answer.trim();
                userRaw = s ? [s] : [];
                userText = userRaw;
            } else if (Array.isArray(answer)) {
                userRaw = answer.map((x: any) => String(x));
                userText = userRaw;
            } else if (answer && typeof answer === 'object') {
                // word-bank: { blankId: wordId } — resolve wordId -> option text when possible
                const opts = content?.options;
                const idToText: Record<string, string> = {};
                if (Array.isArray(opts)) opts.forEach((o: any) => {
                    if (o && typeof o === 'object' && o.id != null) idToText[String(o.id)] = String(o.text ?? o.label ?? o.id);
                });
                const keys = Object.keys(answer).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                userRaw = keys.map(k => String((answer as any)[k]));
                userText = userRaw.map(v => idToText[v] ?? v);
            } else {
                userRaw = answer != null ? [String(answer)] : [];
                userText = userRaw;
            }

            if (!expected) {
                // Legacy explicit blank-id map { blankId: wordId }
                const correctBlanks = correctAnswer?.blank_ids;
                if (correctBlanks && typeof correctBlanks === 'object') {
                    const ck = Object.keys(correctBlanks).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
                    const exp = ck.map(k => String(correctBlanks[k]));
                    return exp.length === userRaw.length && exp.every((e, i) => stringMatch(e, userRaw[i]));
                }
                // No way to grade → accept (avoid false negatives on ungradeable lessons)
                return true;
            }

            const norm = (s: string) => String(s).trim().toLowerCase();
            const matchLists = (exp: string[], got: string[]): boolean => {
                if (got.length === 0) return false;
                // Single combined free-text answer vs multiple expected blanks
                if (got.length === 1 && exp.length > 1) {
                    const joined = norm(got[0]);
                    if (joined === norm(exp.join(' '))) return true;
                    const parts = got[0].split(/[,;]+|\s+/).map(norm).filter(Boolean);
                    if (parts.length === exp.length && exp.every((e, i) => parts[i] === norm(e))) return true;
                    return exp.every(e => joined.includes(norm(e)));
                }
                if (exp.length === got.length) return exp.every((e, i) => norm(e) === norm(got[i]));
                return false;
            };

            // Data may store texts OR word ids — accept a match against either form.
            return matchLists(expected, userText) || matchLists(expected, userRaw);
        }

        // ─── SEQUENCING / CONCEPT BUILDER / GOAL ROADMAP ───
        // Component sends string[] of ordered IDs
        case 'sequencing':
        case 'concept_builder':
        case 'goal_roadmap': {
            // concept_builder multi-select subset shapes: pick exactly this set of ids.
            if (type === 'concept_builder') {
                const subset = correctAnswer?.correctOptionIds ?? correctAnswer?.selectedIds
                    ?? correctAnswer?.componentIds ?? correctAnswer?.correctComponentIds
                    ?? correctAnswer?.essentialIds ?? correctAnswer?.correctConceptIds
                    ?? correctAnswer?.requiredIds ?? correctAnswer?.correctIds
                    ?? correctAnswer?.correctComponents ?? correctAnswer?.correctStatementIds;
                if (Array.isArray(subset)) {
                    const want = new Set(subset.map((x: any) => String(x)));
                    const got = new Set((Array.isArray(answer) ? answer : [answer]).map((x: any) => String(x)));
                    return want.size === got.size && [...want].every(id => got.has(id));
                }
            }
            let correctSequence = correctAnswer?.sequence
                || correctAnswer?.correctSequence
                || correctAnswer?.order
                || correctAnswer?.correctOrder
                || [];
            // goal_roadmap often stores the order in content.correct_sequence as
            // [{actionId, position}, ...] with a null correct_answer.
            if ((!correctSequence || correctSequence.length === 0) && Array.isArray(content?.correct_sequence)) {
                correctSequence = [...content.correct_sequence]
                    .sort((a: any, b: any) => Number(a?.position ?? 0) - Number(b?.position ?? 0))
                    .map((s: any) => String(s?.actionId ?? s?.id ?? s));
            }
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
            // Option-based math_challenge: content carries choices/options and the answer
            // is an option id (non-numeric). Resolve via extractCorrectId.
            if (!/^-?\d*\.?\d+$/.test(userStr)) {
                const optId = extractCorrectId(correctAnswer);
                if (optId !== undefined) return optionIdMatches(userStr, optId);
            }
            const correctValue = extractCorrectNumeric(correctAnswer, content);
            if (correctValue === undefined || isNaN(correctValue)) {
                // Non-numeric correct answer (e.g. "sí", "Subió", "5, 3, 2") → text compare.
                const correctText = extractCorrectText(correctAnswer, content);
                if (correctText !== undefined) {
                    if (stringMatch(userStr, correctText)) return true;
                    // Lenient compare for multi-number / separator-formatted answers.
                    const norm = (s: string) => String(s).replace(/[\s,;]+/g, ',').replace(/,+$/, '').toLowerCase();
                    return norm(userStr) === norm(correctText);
                }
                return false;
            }
            const tolerance = Number(correctAnswer?.tolerance ?? 0.01);
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
            const userVal = Number(answer);
            // Range-based: correctRangeId comparison against content.ranges
            const correctRangeId = correctAnswer?.correctRangeId ?? correctAnswer?.rangeId;
            if (correctRangeId !== undefined && content?.ranges && Array.isArray(content.ranges)) {
                const targetRange = content.ranges.find((r: any) => r.id === correctRangeId);
                if (targetRange) {
                    const min = Number(targetRange.minValue ?? targetRange.min ?? -Infinity);
                    const max = Number(targetRange.maxValue ?? targetRange.max ?? Infinity);
                    return userVal >= min && userVal <= max;
                }
                return String(answer) === String(correctRangeId);
            }

            // Range answer in object {min,max}/{low,high}, array [min,max], or split keys.
            const toRange = (r: any): [number, number] | null => {
                if (Array.isArray(r) && r.length >= 2) return [Number(r[0]), Number(r[1])];
                if (r && typeof r === 'object') {
                    const lo = r.min ?? r.low ?? r.start ?? r.rangeStart ?? r.minValue;
                    const hi = r.max ?? r.high ?? r.end ?? r.rangeEnd ?? r.maxValue;
                    if (lo !== undefined && hi !== undefined) return [Number(lo), Number(hi)];
                }
                return null;
            };
            const pairToRange = (lo: any, hi: any) =>
                (lo !== undefined && hi !== undefined) ? { min: lo, max: hi } : undefined;
            const rangeCandidate =
                correctAnswer?.range ?? correctAnswer?.correctRange ?? correctAnswer?.correct_range
                ?? content?.range ?? content?.correctRange ?? content?.correct_range
                ?? pairToRange(correctAnswer?.min, correctAnswer?.max)
                ?? pairToRange(correctAnswer?.rangeStart, correctAnswer?.rangeEnd)
                ?? pairToRange(content?.correct_range_start, content?.correct_range_end);
            const rng = toRange(rangeCandidate);
            if (rng && !isNaN(rng[0]) && !isNaN(rng[1])) {
                return userVal >= rng[0] && userVal <= rng[1];
            }

            // Numeric value comparison (with tolerance)
            const correctVal = extractCorrectNumeric(correctAnswer, content)
                ?? (content?.correct_value !== undefined ? Number(content.correct_value) : undefined);
            if (correctVal !== undefined && !isNaN(correctVal)) {
                const tolerance = Number(correctAnswer?.tolerance ?? content?.tolerance ?? 10);
                return numericMatch(userVal, correctVal, tolerance);
            }

            // Zone-based: targetZone high/low/mid relative to the slider extent.
            const zone = correctAnswer?.targetZone ?? content?.targetZone;
            if (zone) {
                const sMin = Number(content?.sliderMin ?? content?.min ?? 0);
                const sMax = Number(content?.sliderMax ?? content?.max ?? 100);
                const span = (sMax - sMin) || 100;
                const z = String(zone).toLowerCase();
                if (z.includes('high') || z.includes('alt')) return userVal >= sMin + span * 0.6;
                if (z.includes('low') || z.includes('baj')) return userVal <= sMin + span * 0.4;
                return userVal > sMin + span * 0.3 && userVal < sMin + span * 0.7;
            }

            // No correct-answer info at all → exploratory estimate, accept (do NOT
            // mark a correct guess wrong just because the lesson omitted a target).
            return true;
        }

        // ─── SPOT THE TRAP ───
        // Component sends string[] of selected trap IDs
        case 'spot_trap': {
            const selectedTraps = new Set((Array.isArray(answer) ? answer : [answer]).map((x: any) => String(x)));
            const correctTraps: Set<string> = new Set();
            const addAll = (v: any) => {
                if (Array.isArray(v)) v.forEach((id: any) => correctTraps.add(String(id)));
                else if (v !== undefined && v !== null) correctTraps.add(String(v));
            };
            // Array / list id keys that denote the item(s) to flag as traps.
            [correctAnswer?.trapIds, correctAnswer?.correctTrapIds, correctAnswer?.correctTraps,
            correctAnswer?.targetIds, correctAnswer?.correctOptionIds, correctAnswer?.redFlagIds,
            correctAnswer?.trapsFound, correctAnswer?.trapSegmentIds, correctAnswer?.trapLineIds]
                .forEach(addAll);

            // Single-id shapes: correctOptionId, trapId, correctTrapId, targetId,
            // incorrect*Id, trap*Id, etc. — all resolved centrally via extractCorrectId.
            if (correctTraps.size === 0) {
                const singleId = extractCorrectId(correctAnswer);
                if (singleId !== undefined) {
                    return selectedTraps.size === 1 && selectedTraps.has(String(singleId));
                }
            }

            // Fallback: derive trap ids from content items flagged isTrap (any container).
            if (correctTraps.size === 0) {
                [content?.scenarios, content?.messages, content?.plans, content?.statements,
                content?.items, content?.segments, content?.options].forEach((arr: any) => {
                    if (Array.isArray(arr)) arr.forEach((s: any) => {
                        if ((s?.isTrap || s?.isCorrect) && s?.id) correctTraps.add(String(s.id));
                    });
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

        // ── SHOP SIM ───
        // Component sends string[] (cart item IDs).
        // shop_sim is a cart exercise — never use extractCorrectId() (which has 60+
        // aliases including correctOptionId) because a stray correctOptionId from
        // another exercise type would force single-item exact match and reject
        // every multi-item cart selection.
        case 'shop_sim': {
            const userItems = new Set(Array.isArray(answer) ? answer.map(String) : [String(answer)]);
            // Explicit single-ID keys only (no broad extractCorrectId).
            const singleId = correctAnswer?.selectedProductId ?? correctAnswer?.selectedId
                ?? correctAnswer?.correctProductId ?? correctAnswer?.correctItemId;
            if (singleId !== undefined && singleId !== null) {
                return userItems.size === 1 && optionIdMatches([...userItems][0], String(singleId));
            }
            // Multi-selection: exact id-set (correctItems / selectedIds / selectedProductIds / shopItems)
            const idList = correctAnswer?.correctItems ?? correctAnswer?.selectedIds
                ?? correctAnswer?.selectedProductIds ?? correctAnswer?.shopItems;
            if (Array.isArray(idList)) {
                const want = new Set<string>(idList.map(String));
                return want.size === userItems.size && [...want].every(id => userItems.has(id));
            }
            // Any of several acceptable combinations
            if (Array.isArray(correctAnswer?.validCombinations)) {
                return correctAnswer.validCombinations.some((combo: any[]) =>
                    Array.isArray(combo) && combo.length === userItems.size &&
                    combo.every((id: any) => userItems.has(String(id)))
                );
            }
            // Price-choice exercises: the selected value(s) must be among correctPrices.
            if (Array.isArray(correctAnswer?.correctPrices)) {
                const want = correctAnswer.correctPrices.map(String);
                return userItems.size > 0 && [...userItems].every(id => want.includes(String(id)));
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
            // Budget constraint validation (default fallback — any non-empty cart under budget)
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
                    const tolerance = Number(correctAnswer?.tolerance ?? 0.01);
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
            const events = content?.events || [];
            if (!Array.isArray(events) || events.length === 0) return true;
            // Map decisions to events BY event.id (object form) or by index (array form).
            // The component keys its answer object by event.id, so Object.values()
            // ordering was unreliable — look up each event's own decision instead.
            const userMap = (answer && typeof answer === 'object' && !Array.isArray(answer))
                ? answer as Record<string, string>
                : null;
            const userArr = Array.isArray(answer) ? answer : null;
            let balance = Number(content?.initialFund ?? content?.initialBalance ?? 5000);
            events.forEach((event: any, i: number) => {
                const decisionId = userMap ? userMap[event.id] : (userArr ? userArr[i] : undefined);
                const option = event.options?.find((opt: any) => String(opt.id) === String(decisionId));
                if (option) balance -= Number(option.cost || 0);
            });
            const minBalance = Number(correctAnswer?.minBalance ?? correctAnswer?.minFund ?? 0);
            return balance >= minBalance;
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
                // OPTIONS mode submits { [selectedOptionId]: 100 }; ASSETS mode a string id.
                const picked = (answer && typeof answer === 'object' && !Array.isArray(answer))
                    ? Object.keys(answer)[0]
                    : answer;
                return optionIdMatches(picked, correctId);
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
            // The component awards >=100 points per correct answer (QuizBattle.tsx),
            // so the old hardcoded default of 200 was UNREACHABLE for single-question
            // quizzes. Derive a reachable threshold from the number of questions:
            // a perfect run scores >= questionCount * 100.
            const questionCount = Array.isArray(content?.questions) && content.questions.length > 0
                ? content.questions.length
                : 1;
            const minScore = Number(correctAnswer?.minScore ?? questionCount * 100);
            return score >= minScore;
        }

        // ─── MYSTERY INVESTMENT ───
        // Component sends Record<string, number> (box ID to coin count) or boolean
        case 'mystery_investment': {
            if (typeof answer === 'boolean') return answer;
            const allocation = (answer && typeof answer === 'object') ? answer as Record<string, number> : {};
            const boxesUsed = Object.values(allocation).filter(v => Number(v) > 0).length;
            // Exploratory simulator: only gate on minBoxes when the lesson explicitly
            // sets it; otherwise just require that the user actually invested.
            const minBoxes = correctAnswer?.minBoxes;
            if (minBoxes !== undefined && minBoxes !== null) return boxesUsed >= Number(minBoxes);
            return boxesUsed >= 1;
        }

        // ─── INTEREST CALCULATOR ───
        // Component sends { principal, rate, time } or number/string
        case 'interest_calculator': {
            // The calculator/slider sends an object {principal, rate, time}; it is an
            // exploratory simulator with no single 'correct' id, so accept the object.
            // (Coercing it to a number/id produced NaN/false → false negatives before.)
            if (answer && typeof answer === 'object') return true;
            const correctId = extractCorrectId(correctAnswer);
            if (correctId !== undefined) return optionIdMatches(answer, correctId);
            const correctVal = extractCorrectNumeric(correctAnswer, content);
            if (correctVal !== undefined) {
                const tolerance = Number(correctAnswer?.tolerance ?? 0.01);
                return numericMatch(Number(answer), correctVal, tolerance);
            }
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
        case 'drag_drop': {
            const correct = normalizeClassifications(correctAnswer);
            if (!correct) return true;
            const userMap = (answer && typeof answer === 'object' && !Array.isArray(answer))
                ? answer as Record<string, string>
                : null;
            if (!userMap) return false;
            return Object.keys(correct).every(key =>
                String(userMap[key] ?? '').toLowerCase() === String(correct[key]).toLowerCase()
            );
        }

        // ─── IMAGE HOTSPOT (multi-select hotspot IDs) ───
        case 'image_hotspot': {
            const correctIds = correctAnswer?.hotspotIds || correctAnswer?.hotspot_ids
                || correctAnswer?.targetIds || correctAnswer?.correctHotspotIds;
            if (Array.isArray(correctIds)) {
                const want = new Set(correctIds.map(String));
                const userSet = new Set(Array.isArray(answer) ? answer.map(String) : [String(answer)]);
                return want.size === userSet.size && [...want].every(id => userSet.has(id));
            }
            const singleId = correctAnswer?.hotspotId || correctAnswer?.targetId;
            if (singleId !== undefined) return String(answer) === String(singleId);
            return true;
        }

        // ─── BALANCE SCALE (condition: left_heavy | right_heavy | balanced) ───
        case 'balance_scale': {
            const condition = correctAnswer?.condition || correctAnswer?.correctCondition
                || correctAnswer?.answer || correctAnswer?.correctAnswer;
            if (condition !== undefined) return String(answer).toLowerCase() === String(condition).toLowerCase();
            const leftVal = Number(content?.left?.value ?? 0);
            const rightVal = Number(content?.right?.value ?? 0);
            const expected = leftVal > rightVal ? 'left_heavy' : leftVal < rightVal ? 'right_heavy' : 'balanced';
            return String(answer).toLowerCase() === expected;
        }

        // ─── UNMAPPED TYPES (defensive) ───
        case 'sorting_buckets': {
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
