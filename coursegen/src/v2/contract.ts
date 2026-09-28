// Forge's view of the verified v2 lesson document contract (S05.4c).
//
// The contract itself is Core's: backend/src/services/v2LessonDocument.ts
// (`v2PublicLessonSchema` + `validateV2LessonForGrading`) is the strict parser
// every delivered v2 lesson must pass, and the browser keeps its own
// fail-closed copy. The packages share no code by design, so Forge keeps only
// what it needs to ASSEMBLE a document: the segment kinds and the renderer
// capabilities each kind requires. That map is the third hand-maintained copy
// and `node agent/tools/check-v2-lesson-capability-parity.mjs` fails when it
// drifts from Core's or the browser's. Everything else (payload ranges,
// pathway ages, pilot constants, rubric shapes) is decided by Core's parser:
// the dry-run emitter's output is validated by Core itself
// (`npm --prefix backend run forge-v2:check`), never by a Forge re-implementation.

export const V2_SEGMENT_CAPABILITIES = {
  'money.allocation.v2': ['visual.stacked-bar.v1', 'operation.reallocate.v1'],
  'visual.savings-line.v2': ['visual.line.v1', 'operation.parameter-slider.v1'],
  'math.number-line.whole.v2': ['visual.number-line.v1', 'operation.place-point.v1'],
  'math.number-line.fraction.v2': ['visual.number-line.v1', 'visual.fraction-area.v1', 'operation.place-point.v1', 'operation.linked-representations.v1'],
  'math.fraction-area.v2': ['visual.fraction-area.v1', 'operation.partition-equal.v1', 'operation.shade-parts.v1', 'operation.split-equivalent.v1'],
  'math.bar-model.structure.v2': ['visual.bar-model.v1', 'operation.build-slots.v1', 'operation.structure-check.v1'],
  'math.bar-model.answer.v2': ['visual.bar-model.v1', 'operation.number-input.v1'],
  'math.schema-diagram.structure.v2': ['visual.schema-diagram.v1', 'operation.build-slots.v1', 'operation.structure-check.v1'],
  'math.schema-diagram.slots.v2': ['visual.schema-diagram.v1', 'operation.build-slots.v1'],
  'math.schema-diagram.answer.v2': ['visual.schema-diagram.v1', 'operation.number-input.v1'],
  'visual.goal-bullet.v2': ['visual.bullet.v1', 'operation.parameter-slider.v1'],
  'visual.percent-grid.v2': ['visual.percent-grid.v1', 'operation.parameter-slider.v1', 'operation.linked-representations.v1'],
  'math.place-value.v2': ['visual.base-ten.v1', 'operation.trade-ten.v1', 'operation.linked-representations.v1', 'operation.step-replay.v1'],
  'logic.savings-rule.v2': ['visual.rule-diagram.v1', 'operation.choose-connective.v1', 'operation.case-step.v1'],
  'money.running-ledger.v2': ['visual.balance-meter.v1', 'operation.running-ledger.v1', 'operation.step-replay.v1'],
  'visual.growth-comparison.v2': ['visual.multi-line.v1', 'operation.parameter-slider.v1', 'operation.predict-reveal.v1', 'operation.scale-toggle.v1'],
  'visual.tax-bracket.v2': ['visual.stacked-bar.v1', 'operation.parameter-slider.v1', 'operation.linked-representations.v1'],
  'math.ratio-table.v2': ['visual.ratio-table.v1', 'operation.parameter-slider.v1', 'operation.linked-representations.v1'],
  'math.worked-example.v2': ['visual.worked-example.v1', 'operation.step-replay.v1', 'operation.predict-next.v1', 'operation.backward-fade.v1', 'operation.number-input.v1'],
  'math.function-machine.v2': ['visual.function-machine.v1', 'operation.try-input.v1', 'operation.guess-rule.v1', 'operation.held-out-check.v1'],
  'math.cpa-count.v2': ['visual.cpa-count.v1', 'operation.count-objects.v1', 'operation.symbolic-answer.v1'],
  // B.12 (S05.3d): decide, then say why. Core's private rubric grades the choice and, separately, the reason.
  'reasoning.decide-justify.v2': ['visual.decision-card.v1', 'operation.choose-option.v1', 'operation.justify-choice.v1'],
  // GAP-FIX-R1 learning (Appendix P Part 8 first release; B.8, B.9, B.11).
  'logic.rule-checker.v2': ['visual.rule-cards.v1', 'operation.flip-card.v1'],
  'logic.euler.v2': ['visual.euler.v1', 'operation.place-in-region.v1', 'operation.move-menu.v1'],
  'logic.flowchart.v2': ['visual.flowchart.v1', 'operation.step-flowchart.v1'],
  'money.spend-decision.v2': ['visual.decision-tree.v1', 'operation.step-flowchart.v1'],
  'logic.sort-by-rule.v2': ['visual.sort-bins.v1', 'operation.sort-to-bin.v1', 'operation.move-menu.v1', 'operation.justify-choice.v1'],
  'money.needs-wants.v2': ['visual.sort-bins.v1', 'operation.sort-to-bin.v1', 'operation.move-menu.v1', 'operation.justify-choice.v1'],
  'logic.scam-spotter.v2': ['visual.message-list.v1', 'operation.flag-item.v1'],
  'money.scam-check.v2': ['visual.message-list.v1', 'operation.flag-item.v1'],
  'money.coin-tray.v2': ['visual.coin-tray.v1', 'operation.count-money.v1'],
  'money.making-change.v2': ['visual.coin-tray.v1', 'operation.count-money.v1', 'operation.make-change.v1'],
  'story.branch.v2': ['visual.story-scene.v1', 'operation.choose-option.v1'],
  'story.dialogue-choice.v2': ['visual.dialogue.v1', 'operation.choose-option.v1'],
  'story.would-you-rather.v2': ['visual.would-you-rather.v1', 'operation.choose-option.v1'],
  'voice.mentor-turn.v2': ['visual.speech-plate.v1'],
  'voice.mentor-episode.v2': ['visual.speech-plate.v1', 'operation.step-replay.v1'],
} as const;

/** The Mentor-voiced kinds (B.8, B.11): the only v2 segments that carry a narration channel. */
export const V2_MENTOR_VOICE_TYPES = ['voice.mentor-turn.v2', 'voice.mentor-episode.v2'] as const;
/** The story-decision kinds (B.9): their graded choice ids feed the decision journal. */
export const V2_STORY_TYPES = ['story.branch.v2', 'story.dialogue-choice.v2', 'story.would-you-rather.v2'] as const;

export type V2SegmentType = keyof typeof V2_SEGMENT_CAPABILITIES;
export const V2_SEGMENT_TYPES = Object.keys(V2_SEGMENT_CAPABILITIES) as V2SegmentType[];

export const V2_LOCALES = ['en-US', 'es-MX', 'pt-BR'] as const;
export type V2Locale = (typeof V2_LOCALES)[number];

export const V2_AGE_BANDS = ['6-9', '10-12', '13-17', 'adult'] as const;
export type V2AgeBand = (typeof V2_AGE_BANDS)[number];

/** Stable-id grammar shared by every v2 id field (Core's `id`). */
export const V2_ID = /^[a-z0-9][a-z0-9._:-]{2,100}$/;

export interface V2Segment {
  id: string;
  type: V2SegmentType;
  grading: 'server' | 'none';
  prompt: string;
  visual: { type: string };
  payload: Record<string, unknown>;
  /** Up to two help ladder steps shown on request as one Mentor speech-plate turn each. */
  help?: string[];
  item_role?: 'practice' | 'transfer';
  knowledge_component_id?: string;
}

/** The answerless public document (Core's `v2PublicLessonSchema`). */
export interface V2PublicDocument {
  schema_version: 2;
  course_id: string;
  pathway_id: string;
  chapter_id: string;
  lesson_id: string;
  version_id: string;
  locale: V2Locale;
  age_band: V2AgeBand;
  eligibility: { minimum_age: number; maximum_age: number };
  knowledge_component_ids: string[];
  adventure_scene_id: string;
  title: string;
  required_capabilities: string[];
  segments: V2Segment[];
  representation_progressions?: unknown[];
  mentor_stage?: { character: string; scene: string };
}

/**
 * The capabilities a document must declare: exactly the union its segments
 * need. An allocation drawn as a waffle or donut needs that visual instead of
 * the stacked bar, as in Core's parser.
 */
export function requiredCapabilities(segments: readonly Pick<V2Segment, 'type' | 'visual'>[]): string[] {
  const out = new Set<string>();
  for (const segment of segments) {
    const needed: readonly string[] =
      segment.type === 'money.allocation.v2' && segment.visual.type !== 'stacked-bar'
        ? [`visual.${segment.visual.type}.v1`, 'operation.reallocate.v1']
        : V2_SEGMENT_CAPABILITIES[segment.type];
    for (const capability of needed) out.add(capability);
  }
  return [...out];
}

/**
 * Payload string fields that are contract vocabulary or identifiers, never
 * learner-visible copy: ids, enums the renderer interprets (`currency`,
 * `mode`, `unit`) and id lists. Everything else a payload carries as a
 * string is copy (labels, spoken readouts, worked-step text).
 */
export function isNonCopyKey(key: string): boolean {
  return key === 'id' || key === 'currency' || key === 'mode' || key === 'unit' || key.endsWith('_ids') || key.endsWith('_id')
    // GAP-FIX-R1: structural ids and enums of the new families (flowchart edges, Euler relation, node kind, Mentor role, audio reference).
    || key === 'start' || key === 'yes' || key === 'no' || key === 'relation' || key === 'kind' || key === 'role' || key === 'audio_ref';
}
