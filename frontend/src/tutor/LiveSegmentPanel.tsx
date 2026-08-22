import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui';
import { MarkdownLite } from '@/lesson-engine/core/MarkdownLite';
import { REGISTRY } from '@/lesson-engine/registry';
import type { SegmentBase, Verdict } from '@/lesson-engine/core/types';
import { gradeSegment } from './tutorApi';
import type { LiveSegmentState } from './useTutorSocket';

/*
 * The Lesson Engine, running live, on the floating plate.
 *
 * IT REUSES THE REAL REGISTRY. Every one of the 57 renderers, the shared
 * primitives, the tap-first interaction rules and the accessibility work all
 * come along for free, and a lesson type improved for courses improves here on
 * the same commit. Re-implementing "a multiple-choice question, but for the
 * tutor" is how two subtly different question widgets end up in one product.
 *
 * WHAT IS DIFFERENT FROM `LessonPlayer`. The player owns a whole DOCUMENT: a
 * session reducer, a progress bar, hearts, a results screen. Here there is
 * exactly one segment at a time, chosen by a conversation, with no idea what
 * comes next — so the player's state machine would be carrying a lesson that
 * does not exist. This is the same renderers with a much smaller shell.
 *
 * GRADING IS SERVER-AUTHORITATIVE, always (/ORACLE.md §8). The answer key is
 * not in the browser; `gradeSegment` posts to Core, Core re-derives, and XP is
 * paid only when the key was verifiable. `scoresXp: false` is shown honestly
 * rather than hidden — a learner who is told they earned nothing and why is
 * better served than one who quietly earns nothing.
 *
 * ONLY THE CHROME CHANGED in the in-scene rebuild, and deliberately so. This
 * used to draw its own bordered, padded, opaque card because it lived in the
 * right-hand half of a two-column page. It now sits INSIDE `LessonPlate`,
 * whose glass frame and opaque floor are already the surface, so a second box
 * here would render a card inside a card and reinstate the panel look one layer
 * down. Everything about the DATA flow is untouched: the same attempts, the
 * same server round trip, the same assertive verdict.
 */

export interface LiveSegmentPanelProps {
  live: LiveSegmentState;
  token: string;
  onGraded: (segmentId: string, score: number, correct: boolean) => void;
}

const MAX_ATTEMPTS = 2;

export function LiveSegmentPanel({ live, token, onGraded }: LiveSegmentPanelProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<unknown>(undefined);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [attempt, setAttempt] = useState(1);
  const [checking, setChecking] = useState(false);
  const [failed, setFailed] = useState(false);
  const [xpAwarded, setXpAwarded] = useState<number | null>(null);

  const segment = live.segment as unknown as SegmentBase;
  const entry = REGISTRY[segment.type];

  // A new segment resets everything. Without this, the previous activity's
  // draft and verdict bleed into the next one — which looks like the tutor
  // marking an answer the learner never gave.
  useEffect(() => {
    setDraft(undefined);
    setVerdict(null);
    setAttempt(1);
    setChecking(false);
    setFailed(false);
    setXpAwarded(null);
  }, [live.segmentId]);

  const canSubmit = useMemo(() => {
    if (!entry || entry.kind !== 'input') return false;
    return entry.canSubmit ? entry.canSubmit(draft, segment) : draft !== undefined;
  }, [entry, draft, segment]);

  const submit = useCallback(
    async (answer: unknown) => {
      setChecking(true);
      setFailed(false);
      const result = await gradeSegment(token, live.segmentId, answer, attempt);
      setChecking(false);

      if (result.error || !result.data) {
        // A failed grade is NOT a wrong answer. Saying "let us try that again"
        // and keeping the draft is honest; scoring it zero would punish a
        // learner for our outage.
        setFailed(true);
        return;
      }

      setVerdict(result.data.verdict);
      setXpAwarded(result.data.xpAwarded);

      const done = result.data.verdict.correct || attempt >= MAX_ATTEMPTS;
      if (done) {
        onGraded(live.segmentId, result.data.verdict.score, result.data.verdict.correct);
      } else {
        setAttempt((n) => n + 1);
      }
    },
    [token, live.segmentId, attempt, onGraded],
  );

  if (!entry) {
    // Forward compatibility, same rule as the player (LESSON_ENGINE.md §6): an
    // unknown type renders an honest line and never a crash.
    return (
      <p className="lf-body text-content-muted" role="status">
        {t('tutor.segment.unsupported')}
      </p>
    );
  }

  const Component = entry.component;
  const locked = checking || verdict?.correct === true || attempt > MAX_ATTEMPTS;

  return (
    <section className="flex min-h-0 flex-col gap-3">
      <header className="space-y-1">
        <p className="lf-caption uppercase tracking-wide text-content-muted">
          {t('tutor.segment.activity')}
          {!live.scoresXp && ` · ${t('tutor.segment.practiceOnly')}`}
        </p>

        {/*
          THE TUTOR'S OWN SENTENCE INTRODUCING THE ACTIVITY, on screen at last.
          `framing` is defined in `oracle/src/tutor/turnSchema.ts` as up to 240
          characters of learner-facing prose, moderated exactly like `say`. It
          was generated, moderated, sent over the wire and stored by the client
          for every activity ever served, and rendered nowhere: the learner got
          a bare prompt with no lead-in, as if the exercise had appeared by
          itself rather than been offered by the character talking to them.
        */}
        {live.framing.trim() !== '' && (
          <p className="lf-body text-content-muted">{live.framing}</p>
        )}

        <MarkdownLite text={segment.prompt_md} className="lf-body text-content" />
      </header>

      <div className="min-h-0">
        <Component
          segment={segment}
          value={draft}
          onChange={setDraft}
          disabled={locked}
          verdict={verdict}
          onFinish={(answer) => void submit(answer)}
          onContentDone={() => onGraded(live.segmentId, 100, true)}
        />
      </div>

      {verdict && (
        <div
          className={cnVerdict(verdict)}
          // assertive: the result of an action the learner just took is the one
          // thing that should interrupt whatever a screen reader was saying.
          aria-live="assertive"
        >
          <p className="lf-label">{t(`tutor.segment.tier.${verdict.tier}`)}</p>
          {verdict.feedback_md && (
            <MarkdownLite text={verdict.feedback_md} className="lf-body mt-1" />
          )}
          {xpAwarded !== null && xpAwarded > 0 && (
            <p className="lf-caption mt-1 text-content-muted">
              {t('tutor.segment.xpEarned', { count: xpAwarded })}
            </p>
          )}
          {xpAwarded === 0 && verdict.correct && !live.scoresXp && (
            <p className="lf-caption mt-1 text-content-muted">{t('tutor.segment.noXpExplained')}</p>
          )}
        </div>
      )}

      {failed && (
        <p className="lf-body text-content-muted" role="status">
          {t('tutor.segment.gradeFailed')}
        </p>
      )}

      {entry.kind === 'input' && (
        // Full width at every size now. The plate is at most 420 px wide, so a
        // right-aligned auto-width button leaves a stub of a target beside a
        // stripe of empty glass rather than reading as the end of the exercise.
        <Button onClick={() => void submit(entry.buildAnswer ? entry.buildAnswer(draft, segment) : draft)} disabled={!canSubmit || locked} className="w-full">
          {checking ? t('tutor.segment.checking') : t('tutor.segment.check')}
        </Button>
      )}
    </section>
  );
}

function cnVerdict(verdict: Verdict): string {
  const base = 'rounded-md px-3 py-2';
  // P3: feedback teaches, never punishes. Even `tryAgain` gets a warm well
  // rather than an error colour — there is no red "WRONG" anywhere in this
  // product (LESSON_ENGINE.md §1).
  return verdict.correct
    ? `${base} bg-success-soft text-content`
    : `${base} bg-warning-soft text-content`;
}
