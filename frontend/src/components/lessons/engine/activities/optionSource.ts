/**
 * optionSource — normalización de la fuente de opciones para actividades tipo "elige una".
 *
 * Muchas actividades (risk_reward, opportunity_cost, salary_comparison, debt_strategy,
 * price_detective, …) leían sus opciones de UNA sola clave de `content` y no renderizaban
 * nada cuando la lección real usaba otra clave o un formato pareado (optionA/optionB).
 *
 * `resolveOptions(content)` devuelve una lista normalizada `{ id, text, ...original }`:
 *  - Para arrays bajo claves conocidas, conserva el `id` original del item.
 *  - Para formas pareadas (optionA/optionB, strategy_a/strategy_b, …), sintetiza ids
 *    de letra ('A'/'B') porque es el esquema que usan los `correct_answer` de esas formas
 *    (correctOption:'A', betterOption:'B', …). El validador central (optionIdMatches) además
 *    tolera diferencias de prefijo/caso.
 *
 * El esquema de id resultante debe coincidir con el que espera `validateAnswer`; por eso se
 * preserva el id propio del objeto cuando existe en formas pareadas.
 */

export interface NormalizedOption {
    id: string;
    text: string;
    [key: string]: any;
}

function normOne(o: any, index: number, idOverride?: string): NormalizedOption {
    if (o == null || typeof o !== 'object') {
        const v = String(o ?? '');
        return { id: idOverride ?? v ?? String(index), text: v };
    }
    const id = idOverride ?? o.id ?? o.value ?? o.key ?? String(index);
    const text = o.text ?? o.label ?? o.title ?? o.name ?? o.description ?? o.statement ?? String(id);
    return { ...o, id: String(id), text: String(text) };
}

// Arrays under any of these content keys are treated as the option list (first present wins).
const ARRAY_KEYS = [
    'options', 'risk_options', 'riskOptions', 'choices', 'responseOptions', 'chatOptions',
    'scenarios', 'portfolios', 'strategies', 'plans', 'offers', 'candidates', 'answers',
    'cases', 'stores', 'prices', 'markets', 'cities', 'products', 'items',
];

// Pairwise object shapes → synthesized letter ids matching the typical correct_answer scheme.
const PAIRS: Array<[string, string, string, string]> = [
    ['optionA', 'optionB', 'A', 'B'],
    ['option_a', 'option_b', 'A', 'B'],
    ['choiceA', 'choiceB', 'A', 'B'],
    ['choice_a', 'choice_b', 'A', 'B'],
    ['strategyA', 'strategyB', 'A', 'B'],
    ['strategy_a', 'strategy_b', 'A', 'B'],
    ['approachA', 'approachB', 'A', 'B'],
    ['approach_a', 'approach_b', 'A', 'B'],
    ['offerA', 'offerB', 'A', 'B'],
    ['offer_a', 'offer_b', 'A', 'B'],
    ['jobA', 'jobB', 'A', 'B'],
    ['itemA', 'itemB', 'A', 'B'],
    ['marketA', 'marketB', 'A', 'B'],
    ['cityA', 'cityB', 'A', 'B'],
    ['planX', 'planY', 'X', 'Y'],
    ['mindsetA', 'mindsetB', 'A', 'B'],
];

/**
 * Resolve the list of selectable options from a lesson exercise's content.
 * @param content the exercise.content object
 * @param preferKeys optional content keys to try BEFORE the default array keys
 */
export function resolveOptions(content: any, preferKeys: string[] = []): NormalizedOption[] {
    if (!content || typeof content !== 'object') return [];

    for (const k of preferKeys) {
        const v = content[k];
        if (Array.isArray(v) && v.length > 0) return v.map((o, i) => normOne(o, i));
    }
    for (const k of ARRAY_KEYS) {
        const v = content[k];
        if (Array.isArray(v) && v.length > 0) return v.map((o, i) => normOne(o, i));
    }
    for (const [ka, kb, ia, ib] of PAIRS) {
        if (content[ka] != null && content[kb] != null) {
            return [
                normOne(content[ka], 0, content[ka]?.id ?? ia),
                normOne(content[kb], 1, content[kb]?.id ?? ib),
            ];
        }
    }
    return [];
}
