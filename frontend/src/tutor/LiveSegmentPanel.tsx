import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { MarkdownLite } from '@/lesson-engine/core/MarkdownLite';
import { REGISTRY } from '@/lesson-engine/registry';
import type { SegmentBase, Verdict } from '@/lesson-engine/core/types';
import { HudPlate } from './hud/HudPlate';
import { useScrollEdges } from './hud/useScrollEdges';
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
 * which is already the surface — Lumen at the reading density (/DESIGN.md
 * §Lumen) — so a second box here would render a card inside a card and
 * reinstate the panel look one layer down. Everything about the DATA flow is
 * untouched: the same attempts, the same server round trip, the same assertive
 * verdict.
 *
 * WHAT THIS FILE STILL DOES NOT OWN: the option cards themselves. They come
 * from `lesson-engine/core/primitives.tsx`, which is shared with the Lesson
 * Player and with all 57 renderers — and as of 2026-08-22 they are made of the
 * three ANSWER SURFACES (/DESIGN.md §Answer surfaces) rather than of the
 * outlined `bg-surface` boxes that used to read as a web form dropped into a
 * diorama. That was fixed IN the lesson engine, deliberately, and not here: it
 * is the one component family that renders on both layers, so a Tutor-local
 * patch would have left the other half of the product behind.
 */

export interface LiveSegmentPanelProps {
  live: LiveSegmentState;
  token: string;
  onGraded: (segmentId: string, score: number, correct: boolean) => void;
  /**
   * Sizing from the plate. It is expected to be `flex-auto min-h-0`: this panel
   * is the ONE child of the lesson plate's column that owns the free height and
   * scrolls (`LessonPlate` -> `bodyLayout`).
   */
  className?: string;
}

const MAX_ATTEMPTS = 2;

export function LiveSegmentPanel({ live, token, onGraded, className }: LiveSegmentPanelProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<unknown>(undefined);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [attempt, setAttempt] = useState(1);
  const [checking, setChecking] = useState(false);
  const [failed, setFailed] = useState(false);
  const [xpAwarded, setXpAwarded] = useState<number | null>(null);

  const segment = live.segment as unknown as SegmentBase;
  const entry = REGISTRY[segment.type];

  // The answers are the one scrolling box on the plate, so they are the one box
  // that has to SAY it scrolls. See `useScrollEdges`.
  const answersRef = useRef<HTMLDivElement | null>(null);
  useScrollEdges(answersRef);

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
    /*
     * THE QUESTION IS PINNED, THE ACTION IS PINNED, AND WHAT SCROLLS IS THE
     * ANSWERS BETWEEN THEM (2026-08-22).
     *
     * This used to be an auto-height stack inside the plate's own scroller, and
     * the plate is 420 px wide, which makes exercises tall. Measured on
     * `/dev/tutor-lab` at 1280x800 across all 55 engine fixtures: 14 of them
     * need more prompt-plus-answers height than the plate has — `read_chart`
     * wants 817 px against 540 — and in a single scroller that meant a learner
     * reaching the last option had pushed the question they were answering off
     * the top and the `Check` control off the bottom. A child should not have to
     * remember the question or go looking for the button.
     *
     * So the panel owns its own layout: header fixed, answers scrolling, verdict
     * and action fixed. On the 41 fixtures that fit, nothing scrolls at all and
     * this is invisible. On the 14 that do not, the prompt and the action stay
     * on screen and the answers move between them, which is the arrangement a
     * form has when it is built properly.
     */
    <section className={cn('flex min-h-0 flex-col gap-3', className)}>
      <header className="shrink-0 space-y-1">
        {/*
          "TRY THIS" IS GONE, AND IT WAS THE ONLY UPPERCASE LABEL ON THE ROUTE
          (/DESIGN.md §Lumen → What to delete). The exercise IS the try: a
          12 px all-caps eyebrow over the tutor's own lead-in was a heading for
          something that had already introduced itself, in the one typographic
          register this product does not use anywhere else.

          `practice only` survived it, because that one is a FACT rather than a
          heading — it tells a learner, before they answer, that this will not
          pay XP — and it moved to where the answer is given, beside the check
          control at the bottom of this panel. It is printed only when it is
          true, which is the other half of why it does not need an eyebrow to
          hang from.
        */}

        {/*
          THE TUTOR'S OWN SENTENCE INTRODUCING THE ACTIVITY, on screen at last.
          `framing` is defined in `oracle/src/tutor/turnSchema.ts` as up to 240
          characters of learner-facing prose, moderated exactly like `say`. It
          was generated, moderated, sent over the wire and stored by the client
          for every activity ever served, and rendered nowhere: the learner got
          a bare prompt with no lead-in, as if the exercise had appeared by
          itself rather than been offered by the character talking to them.
        */}
        {live.framing.trim() !== '' && <p className="lf-body text-content-muted">{live.framing}</p>}

        {/*
          The prompt in the TUTOR'S voice, because that is whose question it is.
          Both lines were `lf-body` and the plate had no hierarchy at all: a
          lead-in and the question itself set identically, one above the other,
          so the eye had to read both to find out which one it was answering.
          `lf-speech` is the token for a character speaking (/DESIGN.md §Lumen →
          Type) and this is the same character, in the same breath, as the
          caption over its crown.
        */}
        <MarkdownLite text={segment.prompt_md} className="lf-speech text-content" />
      </header>

      {/*
        THE SCROLLING REGION, and the only one on the plate.

        `-mx-2 px-2` gives the answer objects' seated shadows somewhere to land:
        an `overflow-y-auto` box clips on BOTH axes, and without the bleed the
        left and right edge of every option's shadow — and its 2 px state ring —
        was being shaved off by the scroller. `overscroll-contain` stops a flick
        at the end of the options from scrolling the page behind the island.
      */}
      <div className="lf-scroll-edge -mx-2 flex min-h-0 flex-auto flex-col">
        <div ref={answersRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2">
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
      </div>

      {verdict && (
        <div
          className={cnVerdict(verdict)}
          // Below the scrolling answers, never inside them: the result of the
          // learner's action is the one thing that must not need finding.
          // assertive: the result of an action the learner just took is the one
          // thing that should interrupt whatever a screen reader was saying.
          aria-live="assertive"
        >
          <p className="lf-label">{t(`tutor.segment.tier.${verdict.tier}`)}</p>
          {verdict.feedback_md && <MarkdownLite text={verdict.feedback_md} className="lf-body mt-1" />}
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
        <p className="shrink-0 lf-body text-content-muted" role="status">
          {t('tutor.segment.gradeFailed')}
        </p>
      )}

      {entry.kind === 'input' && (
        <div className="flex shrink-0 flex-col gap-1.5">
          {/*
            The honest line about XP, where the answer is actually given. It
            used to ride an uppercase eyebrow at the top of the panel, three
            scroll-lengths above the control it is about.
          */}
          {!live.scoresXp && (
            <p className="lf-caption text-center text-content-muted">{t('tutor.segment.practiceOnly')}</p>
          )}
          {/*
            Full width at every size. The plate is at most 420 px wide, so a
            right-aligned auto-width button leaves a stub of a target beside a
            stripe of empty glass rather than reading as the end of the
            exercise.

            A HudPlate action rather than the design system's `Button`: on this
            layer an indigo action is `.lf-lumen-solid` — a solid object at the
            pane radius, keeping only the seated shadow — because a call to
            action should not read as one more window onto the island, and a
            capsule over a photographic frame reads as a sticker (/DESIGN.md
            §Lumen). It is still the one indigo action of the phase.
          */}
          <HudPlate
            as="button"
            shape="plate"
            floor="accent"
            onClick={() => void submit(entry.buildAnswer ? entry.buildAnswer(draft, segment) : draft)}
            disabled={!canSubmit || locked}
            className="w-full !max-w-none disabled:opacity-50"
            floorClassName="py-3"
          >
            <span className="lf-action">
              {checking ? t('tutor.segment.checking') : t('tutor.segment.check')}
            </span>
          </HudPlate>
        </div>
      )}
    </section>
  );
}

function cnVerdict(verdict: Verdict): string {
  // A verdict is an OBJECT that arrived with news, so it is a slab in the
  // shared answer material rather than a bare tinted rectangle: over a Lumen
  // reading plate a flat `bg-*-soft` block is the one remaining shape with no
  // edge, no seat and no relationship to the light behind it.
  const base = 'lf-slab shrink-0 rounded-md px-3 py-2 text-content';
  // P3: feedback teaches, never punishes. Even `tryAgain` gets a warm well
  // rather than an error colour — there is no red "WRONG" anywhere in this
  // product (LESSON_ENGINE.md §1).
  return verdict.correct ? `${base} lf-answer-correct` : `${base} lf-answer-wrong`;
}
