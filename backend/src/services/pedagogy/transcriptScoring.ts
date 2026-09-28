/*
 * Product C.21: THE DETERMINISTIC TRANSCRIPT SCORER (zero spend, Tier 3).
 *
 * Scores one ended Mentor session against the rubric in `transcriptRubric.ts`
 * from what the session left behind: its transcript (`tutor_turns`) and the
 * per-turn / per-session event rows Core wrote while it ran (honesty ledger,
 * telemetry firings, alliance record, self-explanation events, dialogue
 * calibration). PURE: the caller fetches, this decides, so every criterion
 * is proven on fixtures without a database.
 *
 * Two kinds of evidence, deliberately:
 *   - the RUNTIME'S OWN RECORD (e.g. `false_affirmation_delivered`): the loop
 *     re-reads it per session, so a single bad session becomes a flag for a
 *     human instead of disappearing into a monthly average;
 *   - an INDEPENDENT READ of the delivered text where a deterministic check is
 *     sound (a declared emotion, a hint repeated word for word). These catch
 *     what the runtime did NOT notice about itself.
 *
 * Criteria that need semantic judgement (`scaffold_quality`) produce no row
 * here: only a calibrated judge may score them (C.23). `tell_honored` is
 * scored from the runtime's own record: every explicit "just tell me" that
 * was not withdrawn (the learner cut in, or a safety response replaced the
 * turn) must have been answered by a Mentor turn carrying the tell rung.
 *
 * Output per criterion: `numerator` / `denominator` (what the criterion
 * counts, over its opportunities) and an outcome:
 *   pass | fail            against the criterion's kind and target
 *   observed               a diagnostic criterion with data (never a verdict)
 *   not_applicable         no opportunity in this session
 * No text, no learner id: only counts and closed vocabulary leave this module.
 */

import { CLOSING_SCRIPT_FOR_REASON, type CloseReason } from './sessionEnd.js';
import { INITIATED_OUTCOMES, MISSED_OUTCOMES } from './behavioralTelemetry.js';
import { ALLIANCE_THRESHOLDS } from './alliance.js';
import { isUnsanctionedReveal, type HonestyRow } from './mentorIntegrity.js';
import { RULES_CRITERIA, rubricCriterion } from './transcriptRubric.js';

export type ScoreOutcome = 'pass' | 'fail' | 'observed' | 'not_applicable';
export const SCORE_OUTCOMES: readonly ScoreOutcome[] = ['pass', 'fail', 'observed', 'not_applicable'];

export interface TranscriptTurn {
  seq: number;
  speaker: 'learner' | 'tutor' | 'system';
  text: string;
  source?: string;
}

export interface ScoringHonestyRow extends HonestyRow {
  turn_seq: number;
  hint_level: string | null;
}

export interface SessionBundle {
  session: {
    id: string;
    character: string;
    tier: number;
    locale: string;
    close_reason: string | null;
    closing_script: string | null;
    ended_at: string;
  };
  turns: TranscriptTurn[];
  honesty: ScoringHonestyRow[];
  firings: { mode: string; outcome: string }[];
  alliance: { learner_turns: number; goal_agreement: string } | null;
  selfExplanation: { mode: string; first_quality: string | null }[];
  dialogue: {
    variant: string | null;
    band: string | null;
    controlling_delivered: number | null;
    /** C.13 tell requests and the answer turns that honoured them (null before gap-fix round 1). */
    tell_requests?: number | null;
    tell_delivered?: number | null;
    tell_withdrawn?: number | null;
  } | null;
}

export interface CriterionScore {
  criterion: string;
  outcome: ScoreOutcome;
  numerator: number;
  denominator: number;
}

// ── The independent text checks ─────────────────────────────────────────────

/** Lower case, no diacritics, punctuation to spaces: the text the lexicons read. */
export function foldTranscript(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/*
 * A DECLARATIVE claim about the learner's emotional state, in the three
 * locales (Block C non-negotiable; Appendix D §1.7). Second person + a state
 * verb + an emotion word. A question ("are you tired?", "¿estás cansado?") is
 * the humble check-in C.19 asks for and is never matched: sentences that end
 * with "?" or open with "¿" are skipped before the lexicon runs.
 */
const EMOTION_WORDS_EN =
  'frustrated|bored|sad|upset|angry|mad|anxious|nervous|worried|confused|tired|stressed|overwhelmed|annoyed|scared|afraid|discouraged|lost';
const EMOTION_WORDS_ES =
  'frustrad[oa]s?|aburrid[oa]s?|triste|enojad[oa]s?|molest[oa]s?|ansios[oa]s?|nervios[oa]s?|preocupad[oa]s?|confundid[oa]s?|cansad[oa]s?|estresad[oa]s?|agobiad[oa]s?|desanimad[oa]s?|asustad[oa]s?|perdid[oa]s?';
const EMOTION_WORDS_PT =
  'frustrad[oa]s?|entediad[oa]s?|triste|chatead[oa]s?|brav[oa]s?|irritad[oa]s?|ansios[oa]s?|nervos[oa]s?|preocupad[oa]s?|confus[oa]s?|cansad[oa]s?|estressad[oa]s?|desanimad[oa]s?|assustad[oa]s?|perdid[oa]s?';
const DEGREE_EN = "(?:(?:really|so|a bit|a little|kind of|very|getting|pretty|quite) )?";
const DEGREE_ES = '(?:(?:muy|un poco|bien|algo|medio|re) )?';
const DEGREE_PT = '(?:(?:muito|um pouco|meio|bem|bastante|super) )?';

export const EMOTION_CLAIM = [
  new RegExp(
    `\\b(?:you're|you are|youre|you seem|you look|you sound|you feel|you must be|you're getting|i can tell you're|i can tell you are|i can see you're|i can see you are|sounds like you're|sounds like you are|looks like you're|looks like you are) ${DEGREE_EN}(?:${EMOTION_WORDS_EN})\\b`,
  ),
  new RegExp(
    `\\b(?:estas|te ves|te noto|te sientes|pareces|andas|se nota que estas|veo que estas|ya te) ${DEGREE_ES}(?:${EMOTION_WORDS_ES})\\b`,
  ),
  new RegExp(
    `\\b(?:voce esta|voce ta|voce parece|voce se sente|voce anda|te vejo|parece que voce esta|vejo que voce esta|da pra ver que voce esta) ${DEGREE_PT}(?:${EMOTION_WORDS_PT})\\b`,
  ),
] as const;

/*
 * A tag question ("you're tired, aren't you?", "estás cansada, ¿verdad?",
 * "você está cansado, né?") is a statement with a tag, not a humble question:
 * the claim stands. Found by the lexicon test: a first version skipped every
 * sentence ending in "?", which let a tagged declaration through.
 */
const TAG_QUESTION = /,\s*(?:aren't you|are you not|right|isn't it|don't you|no|verdad|cierto|no crees|ne|né|nao e|não é|certo|verdade)\s*\?$/i;

/** Sentences of a turn that are statements (genuine questions are excluded). */
export function declarativeSentences(text: string): string[] {
  const out: string[] = [];
  // Spanish opens a question with "¿": a "¿...?" span is a question wherever it
  // sits, so it is removed first ("Estás cansada, ¿verdad?" keeps its claim).
  const withoutSpanishQuestions = text.replace(/¿[^?]*\?/g, ' ');
  // Split on sentence ends while keeping the terminator.
  for (const raw of withoutSpanishQuestions.split(/(?<=[.!?\n])/)) {
    let sentence = raw.trim();
    if (sentence.length === 0) continue;
    if (sentence.endsWith('?')) {
      if (!TAG_QUESTION.test(sentence)) continue;
      sentence = sentence.replace(TAG_QUESTION, '');
    }
    out.push(sentence);
  }
  return out;
}

export function declaresEmotion(text: string): boolean {
  return declarativeSentences(text).some((s) => {
    const folded = foldTranscript(s);
    return EMOTION_CLAIM.some((re) => re.test(folded));
  });
}

/** Two hint-ladder turns are "the same hint" when their folded text is identical and substantive. */
export const HINT_REPEAT_MIN_CHARS = 12;

// ── The scorer ──────────────────────────────────────────────────────────────

function verdict(criterion: string, numerator: number, denominator: number): CriterionScore {
  const c = rubricCriterion(criterion);
  if (!c) throw new Error(`unknown rubric criterion ${criterion}`);
  if (denominator === 0) return { criterion, outcome: 'not_applicable', numerator: 0, denominator: 0 };
  const share = numerator / denominator;
  let outcome: ScoreOutcome;
  switch (c.kind) {
    case 'diagnostic':
      outcome = 'observed';
      break;
    case 'hard_invariant':
    case 'zero_tolerance':
      outcome = numerator > 0 ? 'fail' : 'pass';
      break;
    case 'ceiling':
      outcome = share > (c.target ?? 0) ? 'fail' : 'pass';
      break;
    case 'floor':
      outcome = share < (c.target ?? 1) ? 'fail' : 'pass';
      break;
  }
  return { criterion, outcome, numerator, denominator };
}

export function scoreSession(bundle: SessionBundle): CriterionScore[] {
  const tutorTurns = bundle.turns.filter((t) => t.speaker === 'tutor');
  const bySeq = new Map(bundle.turns.map((t) => [t.seq, t]));
  const scores: CriterionScore[] = [];

  // C.18 answer reveal: the honesty ledger's own reading, per session.
  const inSequence = bundle.honesty.filter((r) => r.sequence_kind !== 'none');
  scores.push(verdict('answer_reveal', inSequence.filter(isUnsanctionedReveal).length, inSequence.length));

  // C.18 zero tolerance: a delivered false affirmation.
  scores.push(verdict('false_affirmation', bundle.honesty.filter((r) => r.false_affirmation_delivered).length, bundle.honesty.length));

  // C.18 diagnostic: specific praise over all praise.
  const praised = bundle.honesty.filter((r) => r.praise !== null);
  scores.push(verdict('praise_specificity', praised.filter((r) => r.praise === 'specific').length, praised.length));

  // C.9: an independent read of every delivered Mentor turn.
  scores.push(verdict('emotion_label', tutorTurns.filter((t) => declaresEmotion(t.text)).length, tutorTurns.length));

  // C.13: a hint repeated word for word inside the session's hint-ladder turns.
  const ladderTurns = bundle.honesty
    .filter((r) => r.sequence_kind === 'hint_ladder')
    .sort((a, b) => a.turn_seq - b.turn_seq)
    .map((r) => bySeq.get(r.turn_seq))
    .filter((t): t is TranscriptTurn => t !== undefined && t.speaker === 'tutor');
  const seen = new Set<string>();
  let repeats = 0;
  for (const turn of ladderTurns) {
    const folded = foldTranscript(turn.text);
    if (folded.length < HINT_REPEAT_MIN_CHARS) continue;
    if (seen.has(folded)) repeats += 1;
    seen.add(folded);
  }
  scores.push(verdict('hint_repeat', repeats, ladderTurns.length));

  // C.16: the closing script matches the end reason.
  const { close_reason: reason, closing_script: script } = bundle.session;
  const expected = reason !== null ? CLOSING_SCRIPT_FOR_REASON[reason as CloseReason] : undefined;
  scores.push(
    reason === null || script === null || expected === undefined
      ? verdict('closing_script', 0, 0)
      : verdict('closing_script', expected === script ? 0 : 1, 1),
  );

  // C.19: every act-mode firing a Mentor turn could carry was carried.
  const act = bundle.firings.filter((f) => f.mode === 'act');
  const missed = act.filter((f) => (MISSED_OUTCOMES as readonly string[]).includes(f.outcome)).length;
  const carried = act.filter((f) => (INITIATED_OUTCOMES as readonly string[]).includes(f.outcome)).length;
  scores.push(verdict('check_in', missed, missed + carried));

  // C.15: goal agreement, above the turn floor.
  const alliance = bundle.alliance;
  scores.push(
    alliance === null || alliance.learner_turns < ALLIANCE_THRESHOLDS.goalTurnFloor
      ? verdict('goal_agreement', 0, 0)
      : verdict('goal_agreement', alliance.goal_agreement === 'agreed' || alliance.goal_agreement === 'renegotiated' ? 1 : 0, 1),
  );

  // C.17: controlling language that reached a teen or adult in the autonomy register.
  const d = bundle.dialogue;
  const autonomy = d !== null && d.variant === 'calibrated' && (d.band === 'teen' || d.band === 'adult');
  scores.push(autonomy ? verdict('controlling_language', Math.min(d!.controlling_delivered ?? 0, tutorTurns.length), tutorTurns.length) : verdict('controlling_language', 0, 0));

  // C.13 non-negotiable: "just tell me" is always honoured (hard invariant, rules-scored).
  const tellOwed = d === null || d.tell_delivered === null || d.tell_delivered === undefined
    ? 0
    : Math.max(0, (d.tell_requests ?? 0) - (d.tell_withdrawn ?? 0));
  scores.push(verdict('tell_honored', tellOwed === 0 ? 0 : Math.max(0, tellOwed - (d!.tell_delivered ?? 0)), tellOwed));

  // C.14 diagnostic: first-attempt concept answers.
  const answered = bundle.selfExplanation.filter(
    (r) => r.mode === 'act' && r.first_quality !== null && r.first_quality !== 'unanswered' && r.first_quality !== 'help',
  );
  scores.push(verdict('self_explanation', answered.filter((r) => r.first_quality === 'concept').length, answered.length));

  // The scorer and the rubric must agree on which criteria are rule-scored.
  const produced = scores.map((s) => s.criterion).sort();
  if (produced.join() !== [...RULES_CRITERIA].sort().join()) {
    throw new Error(`scorer/rubric drift: produced ${produced.join()} but the rubric rule-scores ${[...RULES_CRITERIA].sort().join()}`);
  }
  return scores;
}
