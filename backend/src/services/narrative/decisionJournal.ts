import type { GradingSegment } from '../lessonDocument.js';

/*
 * B.9 (S05.3c) — the decision journal: the course engine's narrative state.
 *
 * WHAT IS RECORDED. A meaningful in-story decision is a point where the learner
 * was offered two or more real alternatives inside a story and picked one:
 *   - story_branch      a node that offered at least two choices (a
 *                       one-choice "Continue" node is advancing the story,
 *                       not deciding, exactly as the grader treats it);
 *   - dialogue_choice   every turn (the schema guarantees 2–4 replies);
 *   - would_you_rather  the one A-or-B pick.
 * Every other exercise type is explicitly NOT a story decision. The
 * classification below is exhaustive over the grader registry and pinned by a
 * test, so a new story type cannot silently skip the journal.
 *
 * WHERE IT COMES FROM. Core extracts the decisions from the answer it has just
 * graded, validated against the lesson document it served (a choice id that
 * the document does not offer records nothing). The browser never writes the
 * journal directly.
 *
 * WHAT IS KEPT. The situation, the chosen option and, for a story_branch, the
 * outcome the story showed next, as short plain-text snapshots in the learner's
 * lesson locale. Nothing numeric: the journal is the story, not a score, and
 * the quality the author assigned to a choice never enters it.
 *
 * No I/O here; narrativeData.ts writes what this returns.
 */

export type DecisionSegmentType = 'story_branch' | 'dialogue_choice' | 'would_you_rather';

/**
 * Every grader type, classified. `true` = a story decision the journal records.
 * Adding a grader without adding it here fails decisionJournal.test.ts.
 */
export const STORY_DECISION_TYPES: Readonly<Record<string, boolean>> = {
  story_branch: true,
  dialogue_choice: true,
  would_you_rather: true,
  balance_scale: false,
  best_decision: false,
  budget_fit: false,
  build_sentence: false,
  cause_effect: false,
  code_order: false,
  coin_count: false,
  compare_table: false,
  confidence_quiz: false,
  count_objects: false,
  debug_hunt: false,
  equation_builder: false,
  estimate_slider: false,
  evidence_hunt: false,
  fact_opinion: false,
  fair_trade: false,
  fill_blank: false,
  flash_match: false,
  group_sets: false,
  interest_peek: false,
  lightning_round: false,
  machine_io: false,
  make_change: false,
  match_pairs: false,
  measure_read: false,
  memory_flip: false,
  needs_wants: false,
  number_input: false,
  number_line: false,
  odd_one_out: false,
  order_steps: false,
  pattern_complete: false,
  picture_choice: false,
  piggy_split: false,
  price_compare: false,
  quiz_mcq: false,
  rank_choices: false,
  read_chart: false,
  red_flags: false,
  robot_path: false,
  savings_goal: false,
  sort_buckets: false,
  speed_tap: false,
  spot_error: false,
  timeline_order: false,
  true_false: false,
  type_answer: false,
  yes_no_cases: false,
};

/** The snapshot bound the database enforces (CHECK char_length ≤ 280). */
export const SNAPSHOT_MAX = 280;
/**
 * The learner reads a snapshot again as narrative copy, so it also fits the
 * narrative Copy Budget (Bible 06: 30 words, 2 sentences; 24 words leaves room
 * for the ×1.25 of es-MX and pt-BR measured on the same limit).
 */
export const SNAPSHOT_MAX_WORDS = 24;
export const SNAPSHOT_MAX_SENTENCES = 2;

export interface DecisionRecord {
  segment_id: string;
  decision_point: string;
  segment_type: DecisionSegmentType;
  situation_text: string;
  choice_id: string;
  choice_text: string;
  outcome_text: string | null;
}

type Dict = Record<string, unknown>;
const obj = (v: unknown): Dict | null => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Dict) : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);

/** Markdown-lite to plain text: emphasis, code and link syntax removed, whitespace collapsed. */
export function plainText(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~#>]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const sentencesOf = (text: string): string[] => text.match(/[^.!?…]+(?:[.!?…]+|$)/gu)?.map((s) => s.trim()).filter(Boolean) ?? [];
const wordsOf = (text: string): number => text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)?.length ?? 0;
const fits = (text: string, max: number): boolean => text.length <= max && wordsOf(text) <= SNAPSHOT_MAX_WORDS;

/**
 * Fits authored text into the stored snapshot without inventing anything:
 * up to two whole sentences while they fit the character and word bounds,
 * else the first sentence's longest word-boundary prefix within them. The UI
 * renders the snapshot in full (D1), so the bound lives here, in the data.
 */
export function fitSnapshot(markdown: string, max = SNAPSHOT_MAX): string | null {
  const text = plainText(markdown);
  if (!text) return null;
  let out = '';
  for (const sentence of sentencesOf(text).slice(0, SNAPSHOT_MAX_SENTENCES)) {
    const next = out ? `${out} ${sentence}` : sentence;
    if (!fits(next, max)) break;
    out = next;
  }
  if (out) return out;
  const words = text.split(' ');
  let prefix = '';
  for (const word of words) {
    const next = prefix ? `${prefix} ${word}` : word;
    if (!fits(next, max)) break;
    prefix = next;
  }
  return prefix.trim() || null;
}

/**
 * The situation a decision answered. A story node usually ends with the
 * question the learner answered ("What price brings me closer to the
 * guitar?"): that question is the clearest reminder. Otherwise the segment's
 * own title, then the node text itself.
 */
export function situationOf(nodeText: string | null, segmentTitle: string | null): string | null {
  if (nodeText) {
    const questions = sentencesOf(plainText(nodeText)).filter((s) => s.endsWith('?'));
    const question = questions[questions.length - 1];
    if (question && fits(question, SNAPSHOT_MAX)) return question;
  }
  if (segmentTitle) {
    const title = fitSnapshot(segmentTitle);
    if (title) return title;
  }
  return nodeText ? fitSnapshot(nodeText) : null;
}

function storyBranch(segment: GradingSegment, answer: Dict, title: string | null): DecisionRecord[] {
  const nodes = Array.isArray(segment.payload.nodes) ? segment.payload.nodes : [];
  const byId = new Map<string, Dict>();
  for (const node of nodes) {
    const o = obj(node);
    const id = o ? str(o.id) : null;
    if (o && id) byId.set(id, o);
  }
  const path = Array.isArray(answer.path) ? answer.path : [];
  const out: DecisionRecord[] = [];
  const seen = new Set<string>();
  for (const step of path) {
    const s = obj(step);
    const nodeId = s ? str(s.node_id) : null;
    const choiceId = s ? str(s.choice_id) : null;
    if (!nodeId || !choiceId || seen.has(nodeId)) continue;
    const node = byId.get(nodeId);
    const choices = node && Array.isArray(node.choices) ? node.choices.map(obj).filter((c): c is Dict => c !== null) : [];
    // A one-choice node advances the story; it is not a decision (see header).
    if (choices.length < 2) continue;
    const chosen = choices.find((c) => c.id === choiceId);
    const choiceText = chosen ? fitSnapshot(str(chosen.text_md) ?? '') : null;
    const situation = situationOf(str(node?.text_md), title);
    if (!chosen || !choiceText || !situation) continue;
    const next = str(chosen.next);
    const outcomeNode = next ? byId.get(next) : undefined;
    seen.add(nodeId);
    out.push({
      segment_id: segment.id, decision_point: nodeId, segment_type: 'story_branch',
      situation_text: situation, choice_id: choiceId, choice_text: choiceText,
      outcome_text: outcomeNode ? fitSnapshot(str(outcomeNode.text_md) ?? '') : null,
    });
  }
  return out;
}

function dialogueChoice(segment: GradingSegment, answer: Dict, title: string | null): DecisionRecord[] {
  const turns = Array.isArray(segment.payload.turns) ? segment.payload.turns : [];
  const byId = new Map<string, Dict>();
  for (const turn of turns) {
    const o = obj(turn);
    const id = o ? str(o.id) : null;
    if (o && id) byId.set(id, o);
  }
  const replies = Array.isArray(answer.replies) ? answer.replies : [];
  const out: DecisionRecord[] = [];
  const seen = new Set<string>();
  for (const reply of replies) {
    const r = obj(reply);
    const turnId = r ? str(r.turn_id) : null;
    const replyId = r ? str(r.reply_id) : null;
    if (!turnId || !replyId || seen.has(turnId)) continue;
    const turn = byId.get(turnId);
    const options = turn && Array.isArray(turn.replies) ? turn.replies.map(obj).filter((c): c is Dict => c !== null) : [];
    if (options.length < 2) continue;
    const chosen = options.find((c) => c.id === replyId);
    const choiceText = chosen ? fitSnapshot(str(chosen.text_md) ?? '') : null;
    const situation = situationOf(str(turn?.npc_md), title);
    if (!chosen || !choiceText || !situation) continue;
    seen.add(turnId);
    out.push({
      segment_id: segment.id, decision_point: turnId, segment_type: 'dialogue_choice',
      situation_text: situation, choice_id: replyId, choice_text: choiceText, outcome_text: null,
    });
  }
  return out;
}

function wouldYouRather(segment: GradingSegment, answer: Dict, title: string | null): DecisionRecord[] {
  const choice = answer.choice === 'a' || answer.choice === 'b' ? answer.choice : null;
  const option = choice ? obj(segment.payload[choice]) : null;
  const choiceText = option ? fitSnapshot(str(option.text_md) ?? '') : null;
  const situation = situationOf(str(segment.prompt_md), title);
  if (!choice || !choiceText || !situation) return [];
  return [{
    segment_id: segment.id, decision_point: 'pick', segment_type: 'would_you_rather',
    situation_text: situation, choice_id: choice, choice_text: choiceText, outcome_text: null,
  }];
}

/**
 * The story decisions inside one graded answer. `segmentTitle` is the
 * segment's authored title from the served document (graders do not carry it).
 * Returns [] for every non-decision type and for anything malformed.
 */
export function extractDecisions(segment: GradingSegment, answer: unknown, segmentTitle: string | null): DecisionRecord[] {
  const a = obj(answer);
  if (!a || STORY_DECISION_TYPES[segment.type] !== true) return [];
  const title = segmentTitle ? plainText(segmentTitle) || null : null;
  const records = segment.type === 'story_branch' ? storyBranch(segment, a, title)
    : segment.type === 'dialogue_choice' ? dialogueChoice(segment, a, title)
      : wouldYouRather(segment, a, title);
  return records.slice(0, 12);
}

// ── Resurfacing ─────────────────────────────────────────────────────────────

export interface JournalCandidate {
  id: string;
  lessonId: string;
  topicId: string;
  courseId: string;
  recordedAt: string;
  /** Lessons this entry has already been resurfaced in. */
  resurfacedIn: string[];
}

export interface RecallTarget {
  lessonId: string;
  topicId: string;
  courseId: string;
  /** Topic ids in the same saga (story arc) as the target lesson. */
  sagaTopicIds: ReadonlySet<string>;
  /** Knowledge-component ids per topic, for the target and the candidates' topics (B.6's shared graph). */
  kcByTopic: ReadonlyMap<string, ReadonlySet<string>>;
}

/** An entry is never resurfaced in more than this many different lessons. */
export const MAX_RESURFACINGS = 3;

export type RecallRelevance = 'shared-skill' | 'same-arc';

/**
 * Picks at most one earlier decision to resurface when a learner opens a
 * lesson. Relevant means the earlier decision's topic teaches a knowledge
 * component this lesson's topic teaches (the shared B.6 graph), or it sits in
 * the same story arc (saga). Never a decision from this lesson, never another
 * course's, never one already shown in three other lessons. An entry already
 * resurfaced in THIS lesson is shown again, so a reload is stable.
 */
export function pickRecall(candidates: readonly JournalCandidate[], target: RecallTarget): { entry: JournalCandidate; relevance: RecallRelevance; repeat: boolean } | null {
  const targetKcs = target.kcByTopic.get(target.topicId) ?? new Set<string>();
  const again = candidates.find((c) => c.resurfacedIn.includes(target.lessonId));
  if (again) return { entry: again, relevance: sharesSkill(again, targetKcs, target) ? 'shared-skill' : 'same-arc', repeat: true };
  let best: { entry: JournalCandidate; score: number; relevance: RecallRelevance } | null = null;
  for (const c of candidates) {
    if (c.lessonId === target.lessonId || c.courseId !== target.courseId) continue;
    if (c.resurfacedIn.length >= MAX_RESURFACINGS) continue;
    const shared = sharesSkill(c, targetKcs, target);
    const sameArc = target.sagaTopicIds.has(c.topicId);
    if (!shared && !sameArc) continue;
    // Relevance first, then the least-resurfaced, then the most recent.
    const score = (shared ? 2 : 1) * 1e15 - c.resurfacedIn.length * 1e13 + Date.parse(c.recordedAt) / 1000;
    if (!best || score > best.score) best = { entry: c, score, relevance: shared ? 'shared-skill' : 'same-arc' };
  }
  return best ? { entry: best.entry, relevance: best.relevance, repeat: false } : null;
}

function sharesSkill(c: JournalCandidate, targetKcs: ReadonlySet<string>, target: RecallTarget): boolean {
  const kcs = target.kcByTopic.get(c.topicId);
  if (!kcs || targetKcs.size === 0) return false;
  for (const kc of kcs) if (targetKcs.has(kc)) return true;
  return false;
}

// ── v2 story decisions (GAP-FIX-R1 learning, B.9 applied to the new catalog per OD-24) ──

/** The v2 story kinds, mapped onto the journal's existing decision types (record_learner_decisions accepts only these). */
export const V2_STORY_DECISION_TYPES: Readonly<Record<string, DecisionSegmentType>> = {
  'story.branch.v2': 'story_branch',
  'story.dialogue-choice.v2': 'dialogue_choice',
  'story.would-you-rather.v2': 'would_you_rather',
};

/**
 * The decision inside one graded v2 story answer. Core has already validated
 * the document and graded the choice id against the private rubric, so this
 * only snapshots the public situation and the chosen option's label. Returns
 * [] for every other kind and for anything malformed.
 */
export function extractV2Decisions(segment: { id: string; type: string; prompt: string; payload: unknown }, answer: unknown, lessonTitle: string | null): DecisionRecord[] {
  const kind = V2_STORY_DECISION_TYPES[segment.type];
  const a = obj(answer);
  const payload = obj(segment.payload);
  const choiceId = a ? str(a.choice) : null;
  if (!kind || !payload || !choiceId) return [];
  const options = (Array.isArray(payload.options) ? payload.options : Array.isArray(payload.replies) ? payload.replies : []).map(obj).filter((o): o is Dict => o !== null);
  const chosen = options.find((option) => option.id === choiceId);
  const choiceText = chosen ? fitSnapshot(str(chosen.label) ?? '') : null;
  const scene = kind === 'story_branch' ? str(payload.scene) : kind === 'dialogue_choice' ? str(payload.line) : null;
  const situation = situationOf(scene ?? segment.prompt, lessonTitle) ?? situationOf(segment.prompt, lessonTitle);
  if (!choiceText || !situation) return [];
  return [{
    segment_id: segment.id, decision_point: kind === 'would_you_rather' ? 'pick' : 'choice', segment_type: kind,
    situation_text: situation, choice_id: choiceId, choice_text: choiceText, outcome_text: null,
  }];
}
