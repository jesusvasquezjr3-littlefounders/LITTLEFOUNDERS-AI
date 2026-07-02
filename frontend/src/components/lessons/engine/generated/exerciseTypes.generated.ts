// ⚠️  ARCHIVO AUTOGENERADO — NO EDITAR A MANO.
// Fuente: backend/lesson_factory/schema/exercise_registry.json
// Regenerar: python3 backend/lesson_factory/schema/gen_frontend_types.py
// registry_version: 2.1

export type CanonicalExerciseType = 'intro_narrative' | 'multiple_choice' | 'true_false' | 'tap_action' | 'matching_pairs' | 'sequencing' | 'coin_counter' | 'word_scramble' | 'fill_blank' | 'classification' | 'math_challenge' | 'estimation_slider' | 'interest_calculator' | 'spot_trap' | 'roleplay_chat' | 'story_mode' | 'risk_reward' | 'opportunity_cost' | 'comparison' | 'case_study' | 'decision_challenge' | 'price_detective' | 'market_reaction' | 'mindset_comparison' | 'salary_comparison' | 'credit_score' | 'impact_meter' | 'quiz_battle' | 'mystery_investment' | 'debt_strategy' | 'concept_builder' | 'budget_builder' | 'portfolio_builder' | 'goal_roadmap' | 'expense_timeline' | 'savings_race' | 'passive_income' | 'subscription_tracker' | 'emergency_fund' | 'bill_splitter' | 'tax_puzzle' | 'inflation_simulator' | 'shop_sim' | 'drag_drop' | 'sorting_buckets' | 'image_hotspot' | 'balance_scale';

export type DeprecatedExerciseType = 'compare' | 'comparison_chart' | 'comparison_matrix' | 'comparison_slider' | 'comparison_table' | 'comparison_challenge' | 'case_real' | 'decision_matrix' | 'match_pairs';

export type ExerciseType = CanonicalExerciseType | DeprecatedExerciseType;

/** Mapa de tipo deprecado → tipo canónico (a plegar en regeneración). */
export const DEPRECATED_TYPE_MAP: Record<DeprecatedExerciseType, CanonicalExerciseType> = {
  'compare': 'comparison',
  'comparison_chart': 'comparison',
  'comparison_matrix': 'comparison',
  'comparison_slider': 'comparison',
  'comparison_table': 'comparison',
  'comparison_challenge': 'comparison',
  'case_real': 'case_study',
  'decision_matrix': 'decision_challenge',
  'match_pairs': 'matching_pairs',
};

/** Claves de correct_answer aceptadas por tipo (back-compat con el corpus). */
export const ANSWER_KEYS_BY_TYPE: Record<CanonicalExerciseType, string[]> = {
  'intro_narrative': [],
  'multiple_choice': ['correctOptionId', 'correctOptionIds'],
  'true_false': ['isTrue'],
  'tap_action': ['targetIds'],
  'matching_pairs': ['pairs', 'matches'],
  'sequencing': ['sequence', 'order'],
  'coin_counter': ['value', 'targetAmount'],
  'word_scramble': ['word', 'text'],
  'fill_blank': ['blanks', 'blank_ids', 'text', 'correctOptionId'],
  'classification': ['classifications', 'correct_classification', 'correctClassification', 'correct_mapping'],
  'math_challenge': ['value', 'tolerance', 'unit', 'correctOptionId'],
  'estimation_slider': ['value', 'tolerance', 'range', 'correctValue'],
  'interest_calculator': ['value', 'tolerance', 'correctOptionId', 'preferredOption'],
  'spot_trap': ['trapIds', 'trapId', 'correctTrapId', 'correctOptionId', 'targetIds'],
  'roleplay_chat': ['correctOptionId', 'correctOptionIds', 'chosenOptionId', 'keywords'],
  'story_mode': ['correctOptionId', 'correctChoiceId', 'value'],
  'risk_reward': ['correctOptionId', 'chosenOptionId', 'bestOptionId', 'chosenOption'],
  'opportunity_cost': ['correctOptionId', 'relevantIds', 'chosenOption'],
  'comparison': ['correctOptionId', 'correctScenario', 'correctOption', 'correctItemId'],
  'case_study': ['correctOptionId', 'correctOptionIds', 'value', 'sequence'],
  'decision_challenge': ['correctOptionId', 'decision'],
  'price_detective': ['correctOptionId', 'correctProductId', 'targetIds', 'bestOptionId'],
  'market_reaction': ['correctOptionId'],
  'mindset_comparison': ['correctOptionId', 'correctMindsetId', 'correctMindset', 'correctApproach'],
  'salary_comparison': ['correctOptionId', 'correctOfferId', 'correctOption', 'bestOffer', 'choice'],
  'credit_score': ['correctOptionId', 'correctProfile', 'minScore'],
  'impact_meter': ['correctOptionId', 'acceptAny'],
  'quiz_battle': ['correctOptionId', 'sequence', 'isTrue', 'minScore'],
  'mystery_investment': ['correctOptionId', 'minBoxes'],
  'debt_strategy': ['correctOptionId', 'sequence', 'debtId', 'betterStrategyId'],
  'concept_builder': ['sequence', 'correctOptionIds', 'correctOptionId'],
  'budget_builder': ['allocation', 'allocations', 'correctOptionId', 'selectedIds'],
  'portfolio_builder': ['allocation', 'portfolio', 'correctOptionId', 'recommendedOptionId', 'correctSequence'],
  'goal_roadmap': ['sequence', 'order', 'correct_sequence'],
  'expense_timeline': ['order', 'sequence'],
  'savings_race': ['correctOptionId', 'value'],
  'passive_income': ['correctOptionId', 'targetIncome', 'selectedIds'],
  'subscription_tracker': ['correctOptionId', 'selectedIds'],
  'emergency_fund': ['correctOptionId', 'minBalance', 'minBoxes', 'minFund', 'value'],
  'bill_splitter': ['splits', 'value', 'correctOptionId'],
  'tax_puzzle': ['correctOptionId', 'value'],
  'inflation_simulator': ['correctOptionId', 'value'],
  'shop_sim': ['correctItemId', 'correctItems', 'correctOptionId', 'correctPrices', 'correctProductId', 'optionId', 'selectedId', 'selectedIds', 'selectedProductId', 'selectedProductIds', 'shopItems', 'validCombinations', 'value'],
  'drag_drop': ['classifications', 'targetIds', 'order'],
  'sorting_buckets': ['classifications'],
  'image_hotspot': ['hotspotIds', 'targetIds'],
  'balance_scale': ['condition', 'correctOptionId'],
};

/** Tipos que califican respuesta (vs. narrativos/no graduables). */
export const GRADABLE_BY_TYPE: Record<CanonicalExerciseType, boolean> = {
  'intro_narrative': false,
  'multiple_choice': true,
  'true_false': true,
  'tap_action': true,
  'matching_pairs': true,
  'sequencing': true,
  'coin_counter': true,
  'word_scramble': true,
  'fill_blank': true,
  'classification': true,
  'math_challenge': true,
  'estimation_slider': true,
  'interest_calculator': true,
  'spot_trap': true,
  'roleplay_chat': true,
  'story_mode': true,
  'risk_reward': true,
  'opportunity_cost': true,
  'comparison': true,
  'case_study': true,
  'decision_challenge': true,
  'price_detective': true,
  'market_reaction': true,
  'mindset_comparison': true,
  'salary_comparison': true,
  'credit_score': true,
  'impact_meter': true,
  'quiz_battle': true,
  'mystery_investment': true,
  'debt_strategy': true,
  'concept_builder': true,
  'budget_builder': true,
  'portfolio_builder': true,
  'goal_roadmap': true,
  'expense_timeline': true,
  'savings_race': true,
  'passive_income': true,
  'subscription_tracker': true,
  'emergency_fund': true,
  'bill_splitter': true,
  'tax_puzzle': true,
  'inflation_simulator': true,
  'shop_sim': true,
  'drag_drop': true,
  'sorting_buckets': true,
  'image_hotspot': true,
  'balance_scale': true,
};

export const ALL_CANONICAL_TYPES: CanonicalExerciseType[] = [
  'intro_narrative', 'multiple_choice', 'true_false', 'tap_action', 'matching_pairs', 'sequencing', 'coin_counter', 'word_scramble', 'fill_blank', 'classification', 'math_challenge', 'estimation_slider', 'interest_calculator', 'spot_trap', 'roleplay_chat', 'story_mode', 'risk_reward', 'opportunity_cost', 'comparison', 'case_study', 'decision_challenge', 'price_detective', 'market_reaction', 'mindset_comparison', 'salary_comparison', 'credit_score', 'impact_meter', 'quiz_battle', 'mystery_investment', 'debt_strategy', 'concept_builder', 'budget_builder', 'portfolio_builder', 'goal_roadmap', 'expense_timeline', 'savings_race', 'passive_income', 'subscription_tracker', 'emergency_fund', 'bill_splitter', 'tax_puzzle', 'inflation_simulator', 'shop_sim', 'drag_drop', 'sorting_buckets', 'image_hotspot', 'balance_scale'
];

/** Resuelve un tipo (posiblemente deprecado) a su canónico. */
export function canonicalType(t: string): string {
  return (DEPRECATED_TYPE_MAP as Record<string, string>)[t] ?? t;
}
