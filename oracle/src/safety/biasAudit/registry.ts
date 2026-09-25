import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Locale } from '../../context/schema.js';
import { classifyLearnerInput } from '../classifier.js';
import { deterministicModeration } from '../moderation.js';
import { isHintRequest, isTellRequest } from '../../tutor/hintLadder.js';
import { classifyStopReply } from '../../tutor/sessionEndSignal.js';
import {
  classifyCheckInReply,
  countWords,
  isHedging,
  isOffTopic,
  isTerseReply,
  normalizeAnswer,
} from '../../tutor/telemetryLexicon.js';

/*
 * C.20 — THE REGISTRY OF AUDITED COMPONENTS.
 *
 * Product C.20: "Any lexical or prosodic component feeding the Behavioral
 * Telemetry Layer (C.9) or content moderation must be audited against
 * dialect and ASR-artifact variation before release, with a recurring
 * re-audit cadence as the component or its underlying model changes."
 *
 * Every such component is listed here, with the source files whose content
 * defines it (hashed, so a material change is detectable) and a `run`
 * adapter that turns its output into one comparable label. The registry is
 * the denominator of Appendix F's Bias-Audit Coverage metric (target 100%),
 * and `biasAudit.test.ts` fails when the telemetry layer imports a
 * learner-text reader that is not registered here.
 *
 * PROSODIC COMPONENTS: none exist. The voice channel is transcribed text
 * only (`voice/provider.ts`); no pitch, energy or speaking-rate feature is
 * computed anywhere. The first prosodic feature must be registered here, with
 * accent and child-speech fixtures, before it may feed anything (policy §3).
 *
 * `mode: 'live_only'` marks a component that cannot run without a paid model
 * call (the output judge): OD-23 allows zero spend during the migration, so
 * its fixture set ships with a dry-run plan and an owner-run live step, and
 * coverage reports it as pending live evidence.
 */

export type AuditKind = 'lexical' | 'prosodic' | 'model';
export type AuditFeeds = 'behavioral_telemetry' | 'moderation' | 'adaptation_offer';

export interface AuditedComponent {
  id: string;
  description: string;
  kind: AuditKind;
  feeds: AuditFeeds[];
  /** Repo-relative files that define the component (hashed for change detection). */
  sources: string[];
  /** The exported functions this component is (for the registry-completeness check). */
  functions: string[];
  mode: 'fixture' | 'live_only';
  /** One comparable label for one utterance. `context` is the lesson text, where a component needs one. */
  run: (text: string, locale: Locale, context: string) => string;
}

const LEXICON = 'oracle/src/tutor/telemetryLexicon.ts';

/** Word-count bands: the verbosity channel compares a learner with THEMSELVES, so parity is judged by band. */
export function lengthBand(words: number): string {
  return words <= 2 ? 'short' : words <= 6 ? 'medium' : 'long';
}

export const AUDITED_COMPONENTS: AuditedComponent[] = [
  {
    id: 'telemetry.hedging',
    description: 'Hedging / uncertainty language ("no sé", "I guess") — C.9 hedging channel',
    kind: 'lexical',
    feeds: ['behavioral_telemetry'],
    sources: [LEXICON],
    functions: ['isHedging', 'foldText'],
    mode: 'fixture',
    run: (text, locale) => String(isHedging(text, locale)),
  },
  {
    id: 'telemetry.terse',
    description: 'Minimal-engagement replies ("k", "bet", "sale", "blz") — C.9 verbosity channel',
    kind: 'lexical',
    feeds: ['behavioral_telemetry'],
    sources: [LEXICON],
    functions: ['isTerseReply', 'wordsIn'],
    mode: 'fixture',
    run: (text) => String(isTerseReply(text)),
  },
  {
    id: 'telemetry.verbosity',
    description: 'Message length in words — C.9 verbosity channel (judged by band: short / medium / long)',
    kind: 'lexical',
    feeds: ['behavioral_telemetry'],
    sources: [LEXICON],
    functions: ['countWords'],
    mode: 'fixture',
    run: (text) => lengthBand(countWords(text)),
  },
  {
    id: 'telemetry.off_topic',
    description: 'Off-topic drift against the lesson vocabulary, with regional money words — C.9 off-topic channel',
    kind: 'lexical',
    feeds: ['behavioral_telemetry'],
    sources: [LEXICON],
    functions: ['isOffTopic', 'contentWords'],
    mode: 'fixture',
    run: (text, _locale, context) => String(isOffTopic(text, context)),
  },
  {
    id: 'telemetry.answer_key',
    description: 'Answer normalization (digits and number words) — C.9 repeated-answer channel',
    kind: 'lexical',
    feeds: ['behavioral_telemetry'],
    sources: [LEXICON],
    functions: ['normalizeAnswer'],
    mode: 'fixture',
    run: (text, locale) => normalizeAnswer(text, locale),
  },
  {
    id: 'telemetry.help_request',
    description: 'Hint and "just tell me" requests — C.9 hint-abuse channel and the C.13 hint ladder',
    kind: 'lexical',
    feeds: ['behavioral_telemetry'],
    sources: ['oracle/src/tutor/hintLadder.ts'],
    functions: ['isHintRequest', 'isTellRequest'],
    mode: 'fixture',
    run: (text) => (isTellRequest(text) ? 'tell' : isHintRequest(text) ? 'hint' : 'none'),
  },
  {
    id: 'check_in.reply',
    description: 'The learner’s answer to the C.19 check-in (aligned / misaligned / unclear) — routes the repair',
    kind: 'lexical',
    feeds: ['adaptation_offer'],
    sources: [LEXICON],
    functions: ['classifyCheckInReply'],
    mode: 'fixture',
    run: (text) => classifyCheckInReply(text),
  },
  {
    id: 'session_end.stop_reply',
    description: 'The learner’s answer to the C.8 stop-or-continue offer (accept / decline / unclear)',
    kind: 'lexical',
    feeds: ['adaptation_offer'],
    sources: ['oracle/src/tutor/sessionEndSignal.ts'],
    functions: ['classifyStopReply'],
    mode: 'fixture',
    run: (text) => classifyStopReply(text),
  },
  {
    id: 'moderation.input_classifier',
    description: 'The pre-model input classifier (self-harm, abuse, personal data, adult content, grooming, injection)',
    kind: 'lexical',
    feeds: ['moderation'],
    sources: ['oracle/src/safety/classifier.ts'],
    functions: ['classifyLearnerInput'],
    mode: 'fixture',
    run: (text, locale) => classifyLearnerInput(text, locale).category ?? 'none',
  },
  {
    id: 'moderation.output_deterministic',
    description: 'The deterministic output pass (prompt leak, fence echo, contact details) on Mentor lines that mirror a learner’s dialect',
    kind: 'lexical',
    feeds: ['moderation'],
    sources: ['oracle/src/safety/moderation.ts'],
    functions: ['deterministicModeration'],
    mode: 'fixture',
    run: (text, locale) => {
      const verdict = deterministicModeration({ text, locale, tier: 2, requireModelPass: false });
      return verdict.allowed ? 'allowed' : verdict.reason;
    },
  },
  {
    id: 'moderation.output_judge',
    description: 'The model-based output judge (harm categories) on Mentor lines that mirror a learner’s dialect',
    kind: 'model',
    feeds: ['moderation'],
    sources: ['oracle/src/safety/moderation.ts'],
    functions: ['moderateTutorOutput'],
    mode: 'live_only',
    // Never run by the fixture audit: a paid call (OD-23). `scripts/bias-audit.ts --judge-live` runs it.
    run: () => {
      throw new Error('moderation.output_judge is live-only (a paid model call); use bias-audit --judge-plan / --judge-live');
    },
  },
];

/**
 * The fused decision the session-parity cases exercise (`sessions.ts`): the
 * Behavioral Telemetry Layer's thresholds and fusion. Not a lexical reader
 * itself (so not in the coverage denominator), but a change to it changes
 * what the same words lead to, so it is hashed and re-audited like one.
 */
export const FUSED_DECISION = {
  id: 'telemetry.fused_decision',
  sources: ['oracle/src/tutor/behavioralTelemetry.ts'],
} as const;

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

/** sha256 of a component's sources, line endings normalized (a CRLF checkout is not a change). */
export function componentHash(component: Pick<AuditedComponent, 'sources'>, root: string = REPO_ROOT): string {
  const hash = createHash('sha256');
  for (const source of component.sources) {
    hash.update(source);
    hash.update(readFileSync(path.join(root, source), 'utf8').replace(/\r\n/g, '\n'));
  }
  return hash.digest('hex').slice(0, 16);
}

export { REPO_ROOT };
