import { Button, InlineNotice, LoadingState } from '../design/controls';
import './mentorDecisions.css';

/*
 * WHAT THE MENTOR DECIDED, AND ON WHAT EVIDENCE (GAP-FIX-R2).
 *
 * Product Block C's Real-Time Interaction Standard asks that the Extended
 * Mastery Engine's outputs stay interpretable and auditable to a parent, and
 * Appendix D §2.6 asks the parent-facing layer to "expose the evidence, not
 * just the conclusion" (C.10). Core projects the controller's logged
 * decisions as numbers and closed labels (`GET /tutor/kids/:kidUserId/mastery`
 * for the verified Tutor, `GET /tutor/mastery` for the learner); this card
 * phrases them as templated sentences such as "Moved on after 2 correct
 * answers in a row" and "Will check again on <date>". Nothing here is model
 * text or transcript: the only free string is the skill's authored title.
 *
 * Read-only in both places: the Family console child page and the learner's
 * own learning map sheet. Built from the shared controls (02 rule 23).
 *
 * The wire shape is hand-mirrored from `backend/src/services/pedagogy/
 * masteryEvidence.ts` (no shared types across packages, by design) and
 * validated here, so a drifted Core reads as "could not load", never as a
 * half-drawn card.
 */

export type MasteryDisplayState = 'not_yet' | 'provisional_mastered' | 'recheck_due';
export type MasteryDecisionKind = 'mastered' | 'remediation' | 'rescue' | 'mastery_withdrawn';
export type DiscountedEvidence = 'none' | 'too_fast' | 'hint_assisted' | 'too_fast_and_hint_assisted';

export interface MasteryDecision {
  kind: MasteryDecisionKind;
  observations: number | null;
  required: number | null;
  discounted: DiscountedEvidence | null;
  decidedAt: string;
}

export interface MasteryEvidenceItem {
  kcKey: string;
  title: string;
  state: MasteryDisplayState;
  correctInARow: number;
  attempts: number;
  decision: MasteryDecision | null;
  nextCheckAt: string | null;
}

export interface MasteryEvidence { items: MasteryEvidenceItem[] }

export interface MentorDecisionsCopy {
  title: string; loading: string; failed: string; retry: string; empty: string;
  states: Record<MasteryDisplayState, string>;
  mastered: string; masteredOne: string; remediation: string; remediationOne: string; rescue: string; rescueOne: string;
  withdrawn: string; streak: string; streakOne: string; tooFast: string; hintAssisted: string; bothDiscounted: string;
  decidedOn: string; nextCheck: string;
}

const STATES: readonly string[] = ['not_yet', 'provisional_mastered', 'recheck_due'];
const KINDS: readonly string[] = ['mastered', 'remediation', 'rescue', 'mastery_withdrawn'];
const DISCOUNTED: readonly string[] = ['none', 'too_fast', 'hint_assisted', 'too_fast_and_hint_assisted'];

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;
const isInstant = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const nullable = <T,>(value: unknown, test: (v: unknown) => v is T): value is T | null => value === null || test(value);

function isDecision(value: unknown): value is MasteryDecision {
  return isObject(value) && KINDS.includes(value.kind as string)
    && nullable(value.observations, isCount) && nullable(value.required, isCount)
    && (value.discounted === null || DISCOUNTED.includes(value.discounted as string)) && isInstant(value.decidedAt);
}

/** The Core projection, validated; null on any drift. */
export function parseMasteryEvidence(data: unknown): MasteryEvidence | null {
  if (!isObject(data) || !Array.isArray(data.items)) return null;
  const ok = data.items.every((item) => isObject(item) && typeof item.kcKey === 'string' && typeof item.title === 'string' && item.title.length > 0
    && STATES.includes(item.state as string) && isCount(item.correctInARow) && isCount(item.attempts)
    && (item.decision === null || isDecision(item.decision)) && nullable(item.nextCheckAt, isInstant));
  return ok ? { items: data.items as MasteryEvidenceItem[] } : null;
}

const fill = (template: string, values: Record<string, string | number>) =>
  Object.entries(values).reduce((text, [key, value]) => text.split(`{${key}}`).join(String(value)), template);

/** The sentences for one skill, in reading order: what was decided, what did not count, when it is looked at again. */
export function decisionSentences(item: MasteryEvidenceItem, copy: MentorDecisionsCopy, locale: string): string[] {
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  const counted = (many: string, one: string, n: number) => (n === 1 ? one : fill(many, { n }));
  const lines: string[] = [];
  const decision = item.decision;
  if (decision) {
    const n = decision.observations ?? 0;
    if (decision.kind === 'mastered') lines.push(counted(copy.mastered, copy.masteredOne, n));
    else if (decision.kind === 'remediation') lines.push(counted(copy.remediation, copy.remediationOne, n));
    else if (decision.kind === 'rescue') lines.push(counted(copy.rescue, copy.rescueOne, n));
    else lines.push(copy.withdrawn);
    if (decision.discounted === 'too_fast') lines.push(copy.tooFast);
    else if (decision.discounted === 'hint_assisted') lines.push(copy.hintAssisted);
    else if (decision.discounted === 'too_fast_and_hint_assisted') lines.push(copy.bothDiscounted);
  } else if (item.correctInARow > 0) {
    lines.push(counted(copy.streak, copy.streakOne, item.correctInARow));
  }
  if (item.nextCheckAt && item.state !== 'recheck_due') lines.push(fill(copy.nextCheck, { date: date.format(new Date(item.nextCheckAt)) }));
  return lines;
}

export function MentorDecisions({ copy, locale, phase, evidence, onRetry, headingLevel = 2 }: {
  copy: MentorDecisionsCopy;
  locale: string;
  phase: 'loading' | 'failed' | 'ready';
  evidence: MasteryEvidence | null;
  onRetry: () => void;
  /** 2 on its own page (the Family console), 3 inside a sheet under the sheet's heading. */
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 3 ? 'h3' : 'h2';
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  return <section className="lf-mentor-decisions" aria-labelledby="mentor-decisions-title" aria-busy={phase === 'loading'} data-mentor-decisions="">
    <Heading id="mentor-decisions-title" className="lf-mentor-decisions-title" data-copy-role="heading">{copy.title}</Heading>
    {phase === 'loading' ? <LoadingState label={copy.loading} lines={2} />
      : phase === 'failed' || !evidence ? <>
        <InlineNotice tone="error" live>{copy.failed}</InlineNotice>
        <Button size="sm" onClick={onRetry}>{copy.retry}</Button>
      </> : evidence.items.length === 0 ? <p data-copy-role="body">{copy.empty}</p>
        : <ul className="lf-mentor-decisions-list">
          {evidence.items.map((item) => <li key={item.kcKey} className="lf-mentor-decisions-item" data-state={item.state} data-decision={item.decision?.kind ?? undefined}>
            <div className="lf-mentor-decisions-row">
              <span className="lf-mentor-decisions-skill" data-copy-role="data">{item.title}</span>
              <span className="lf-mentor-decisions-state" data-copy-role="body">{copy.states[item.state]}</span>
            </div>
            {decisionSentences(item, copy, locale).map((line) => <p key={line} data-copy-role="body">{line}</p>)}
            {item.decision ? <time className="lf-mentor-decisions-date" dateTime={item.decision.decidedAt} data-copy-role="data">
              {fill(copy.decidedOn, { date: date.format(new Date(item.decision.decidedAt)) })}
            </time> : null}
          </li>)}
        </ul>}
  </section>;
}
