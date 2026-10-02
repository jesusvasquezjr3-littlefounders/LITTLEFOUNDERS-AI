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
  // B.7 part 1: plus `visual.<kind>.v1` for the drawn kind, and choose-option when it asks a question.
  'visual.chart.v2': ['operation.show-table.v1'],
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
  // GAP-FIX-R2: $6 unit prices and the L2 rule builder; a built flowchart (L6/$9, 13+) also needs operation.build-flowchart.v1.
  'money.unit-price.v2': ['visual.ratio-table.v1', 'operation.number-input.v1', 'operation.choose-option.v1'],
  'logic.rule-builder.v2': ['visual.rule-builder.v1', 'operation.build-rule.v1', 'operation.case-step.v1'],
  'voice.mentor-turn.v2': ['visual.speech-plate.v1'],
  'voice.mentor-episode.v2': ['visual.speech-plate.v1', 'operation.step-replay.v1'],
  // GAP-FIX-R1 learning (Appendix A Parts 2 and 3; B.7 part 2).
  'money.amortization.v2': ['visual.amortization.v1', 'operation.step-replay.v1', 'operation.number-input.v1'],
  'econ.supply-demand.v2': ['visual.supply-demand.v1', 'operation.drag-point.v1', 'operation.curve-shift.v1'],
  'money.opportunity-cost.v2': ['visual.token-chooser.v1', 'operation.trade-off-chooser.v1'],
  'money.inflation.v2': ['visual.inflation.v1', 'operation.parameter-slider.v1', 'operation.scale-toggle.v1', 'operation.before-after.v1', 'operation.reactive-text.v1'],
  'money.rule-of-72.v2': ['visual.doubling.v1', 'operation.parameter-slider.v1', 'operation.threshold-marker.v1'],
  'money.debt-payoff.v2': ['visual.debt-race.v1', 'operation.what-if-branch.v1', 'operation.ghost-trace.v1'],
  'money.diversification.v2': ['visual.portfolio.v1', 'operation.reallocate.v1', 'operation.linked-representations.v1'],
  'money.lemonade-stand.v2': ['visual.waterfall.v1', 'operation.guided-sandbox.v1', 'operation.running-ledger.v1'],
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
  /** GAP-FIX-R6 (B.20, Bible 02 §9.2): the graded step's banner text; `met` names what was done right, `not_yet` is a hint. */
  feedback?: { met?: string; not_yet?: string };
  item_role?: 'practice' | 'transfer';
  /** Appendix P Part 8 (GAP-FIX-R2): L12/$11 pre/post items and the representation variant an A/B compares. */
  item_phase?: 'pre' | 'post';
  variant?: string;
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
  /** B.24 / Block B autonomy (GAP-FIX-R5): two or three equally valid, fully graded chains for one skill (10+). */
  approaches?: { options: Array<{ id: string; label: string; segment_ids: string[] }> };
}

/**
 * The capabilities a document must declare: exactly the union its segments
 * need. An allocation drawn as a waffle or donut needs that visual instead of
 * the stacked bar, as in Core's parser.
 */
export function requiredCapabilities(segments: readonly Pick<V2Segment, 'type' | 'visual' | 'payload'>[]): string[] {
  const out = new Set<string>();
  for (const segment of segments) {
    const needed: readonly string[] =
      segment.type === 'money.allocation.v2' && segment.visual.type !== 'stacked-bar'
        ? [`visual.${segment.visual.type}.v1`, 'operation.reallocate.v1']
        : segment.type === 'visual.chart.v2'
          ? [`visual.${segment.visual.type}.v1`, ...V2_SEGMENT_CAPABILITIES[segment.type], ...(segment.payload?.question ? ['operation.choose-option.v1'] : [])]
          : (segment.type === 'logic.flowchart.v2' || segment.type === 'money.spend-decision.v2') && segment.payload?.mode === 'build'
            ? [...V2_SEGMENT_CAPABILITIES[segment.type], 'operation.build-flowchart.v1']
            // Bible 05 §5 (GAP-FIX-R2): TeX notation on a worked step or the function machine's rule needs the KaTeX renderer.
            : (segment.type === 'math.worked-example.v2' && Array.isArray(segment.payload?.steps) && (segment.payload.steps as Array<{ notation?: unknown }>).some((step) => step.notation))
              || (segment.type === 'math.function-machine.v2' && segment.payload?.notation === true)
              ? [...V2_SEGMENT_CAPABILITIES[segment.type], 'visual.math-notation.v1']
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
    || key === 'start' || key === 'yes' || key === 'no' || key === 'relation' || key === 'kind' || key === 'role' || key === 'audio_ref'
    // Chart data: link endpoints and calendar dates are identifiers, not copy.
    || key === 'from' || key === 'to' || key === 'date' || key === 'end'
    // Horizonte F1.0: a heatmap cell names its column and row by id.
    || key === 'col' || key === 'row'
    // GAP-FIX-R2: a rule builder's level and a flowchart's build mode are contract vocabulary.
    || key === 'level'
    // GAP-FIX-R4: an L1 rule's kind is contract vocabulary.
    || key === 'rule_kind'
    // GAP-FIX-R2 charts: a swimlane node's lane and a Venn region's set list are ids.
    || key === 'lane' || key === 'sets'
    // TeX notation is locale-neutral data (spokenText carries the words).
    || key === 'notation'
    // GAP-FIX-R5 (M3): the numbers a fraction line compares or shows as equivalents are data; the board formats them per locale.
    || key === 'compare_values' || key === 'equivalent_values';
}
