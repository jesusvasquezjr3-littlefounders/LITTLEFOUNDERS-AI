import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { MarkdownLite } from '@/lesson-engine/core/MarkdownLite';
import { REGISTRY } from '@/lesson-engine/registry';
import type { CharacterCue, SegmentBase, Verdict } from '@/lesson-engine/core/types';
import { HudPlate } from './hud/HudPlate';
import { useScrollEdges } from './hud/useScrollEdges';
import { gradeSegment } from './tutorApi';
import { mayDemonstrate, runTrayDemo } from './trayDemo';
import { isSegmentLocked, MAX_ATTEMPTS } from './segmentLock';
import type { TrayDemoStep } from './types';
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
  onGraded: (
    segmentId: string,
    score: number,
    correct: boolean,
    pedagogy?: { echo: string; attemptNumber: number },
  ) => void;
  /**
   * v3: a demonstration the tutor performs on the OPEN tray while speaking.
   * `seq` is the turn that carried it, so the same steps never replay.
   */
  demo?: { seq: number; steps: TrayDemoStep[] } | null;
  /**
   * Present because this panel has no `CharacterLayerProvider` of its own
   * (LESSON_ENGINE.md §9.1) — a `story` family segment (`story_dialogue`,
   * `story_scene`, `eavesdrop`) fires this instead of drawing its own
   * character, and the Tutor's stage (`TutorExperience.tsx`) portrays it on
   * the persistent island rather than falling back to the flat 2D rig. Every
   * other segment type ignores this prop entirely.
   */
  onCharacterCue?: (cue: CharacterCue | null) => void;
  /**
   * Sizing from the plate. It is expected to be `flex-auto min-h-0`: this panel
   * is the ONE child of the lesson plate's column that owns the free height and
   * scrolls (`LessonPlate` -> `bodyLayout`).
   */
  className?: string;
}


export function LiveSegmentPanel({ live, token, onGraded, demo, onCharacterCue, className }: LiveSegmentPanelProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<unknown>(undefined);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [attempt, setAttempt] = useState(1);
  const [checking, setChecking] = useState(false);
  const [failed, setFailed] = useState(false);
  const [xpAwarded, setXpAwarded] = useState<number | null>(null);
  /** v3: input is locked while the tutor's hands are on the tray. */
  const [demoRunning, setDemoRunning] = useState(false);

  const segment = live.segment as unknown as SegmentBase;
  const entry = REGISTRY[segment.type];

  /*
   * THE TUTOR'S HANDS (v3). A `demonstrate` turn animates the SAME controlled
   * draft a real tap changes — the driver appends/removes picked coins on a
   * timer, the renderer shows each move, and the learner's input is locked
   * until the tutor hands the tray back. A demo for a segment that is not a
   * tray, or for one already graded, is ignored fail-safe.
   */
  const draftRef = useRef<unknown>(undefined);
  draftRef.current = draft;
  const lastDemoSeq = useRef<number>(-1);
  /*
   * `demo`, `segment` and `verdict` are held in refs so this effect depends
   * ONLY on `demo?.seq` — the one primitive that actually says "this is a
   * genuinely new demo to run." Found by adversarial review, 2026-08-30
   * (HIGH): `ConversationView.tsx` builds `demo` as a fresh object literal
   * every render (`{ seq: turn.seq, steps: turn.demonstrate }`), so ANY
   * unrelated re-render of that ancestor — a composer keystroke, a mic-level
   * update, any sibling state change, none of them rare during a 5+ second,
   * up-to-8-step demo — produced a new `demo` reference with the SAME `seq`.
   * Depending on the object itself made the effect re-run on every one of
   * those: the cleanup aborted `runTrayDemo` mid-loop, and the new setup's
   * `mayDemonstrate` check then saw `demoSeq === lastPlayedSeq` (set
   * synchronously at the FIRST run, before the demo even started moving) and
   * refused to restart — the tutor's hands moved exactly one coin and froze
   * forever while the tutor kept narrating the remaining steps aloud.
   */
  const demoRef = useRef(demo);
  demoRef.current = demo;
  const segmentRef = useRef(segment);
  segmentRef.current = segment;
  const verdictRef = useRef(verdict);
  verdictRef.current = verdict;
  useEffect(() => {
    const currentDemo = demoRef.current;
    const currentSegment = segmentRef.current;
    const denominations: unknown = (currentSegment.payload as { denominations?: unknown }).denominations;
    if (
      !mayDemonstrate({
        demoSeq: currentDemo?.seq ?? null,
        lastPlayedSeq: lastDemoSeq.current,
        segmentType: currentSegment.type,
        answeredCorrectly: verdictRef.current?.correct === true,
        denominations,
      })
    ) {
      return;
    }
    lastDemoSeq.current = currentDemo!.seq;
    const abort = new AbortController();
    setDemoRunning(true);
    void runTrayDemo(
      currentDemo!.steps,
      // `mayDemonstrate` has already established this is a non-empty array.
      (denominations as unknown[]).filter((d): d is number => typeof d === 'number'),
      {
        getPicked: () => {
          const current = draftRef.current as { picked?: unknown } | undefined;
          return Array.isArray(current?.picked) ? (current.picked as number[]) : [];
        },
        setPicked: (picked) => setDraft({ picked }),
      },
      { signal: abort.signal },
    ).finally(() => setDemoRunning(false));
    return () => abort.abort();
    // `demo`, `segment` and `verdict` are read from the refs above on
    // purpose, not listed here — see the comment above this effect.
    // `live.segmentId` (a stable string, not the `segment` object) IS a real
    // dependency: when the segment actually changes, any demo still mid-play
    // must be aborted rather than going on to write stale tray positions
    // into the NEW segment's draft.
  }, [demo?.seq, live.segmentId]);

  // The answers are the one scrolling box on the plate, so they are the one box
  // that has to SAY it scrolls. See `useScrollEdges`.
  const answersRef = useRef<HTMLDivElement | null>(null);
  useScrollEdges(answersRef);

  // A new segment resets everything. Without this, the previous activity's
  // draft and verdict bleed into the next one — which looks like the tutor
  // marking an answer the learner never gave.
  //
  // The character cue is reset here too, belt-and-suspenders alongside each
  // story renderer's own unmount cleanup: a segment that stays the SAME
  // registry type across a change (e.g. one `story_dialogue` replaced by
  // another) reuses the same component instance, so no unmount ever runs, and
  // the stage would otherwise keep portraying the FINISHED segment's last
  // speaker until the new one's own effect happens to fire.
  useEffect(() => {
    setDraft(undefined);
    setVerdict(null);
    setAttempt(1);
    setChecking(false);
    setFailed(false);
    setXpAwarded(null);
    onCharacterCue?.(null);
  }, [live.segmentId, onCharacterCue]);

  /*
   * Mirrors `live.segmentId` on every render, independent of which `submit`
   * closure is currently awaiting a response. Found by adversarial review,
   * 2026-08-30 (CRITICAL): the server can legitimately replace an unanswered
   * segment while a grade request for the PREVIOUS one is still in flight —
   * the tutor moved on before Core answered. `submit`'s own closure over
   * `live.segmentId` cannot detect this: React re-creates `submit` with a new
   * closure when the prop changes, but the ALREADY-RUNNING call keeps
   * evaluating its own, now-stale `live` from the render it started in. Only
   * a ref, mutated on every render regardless of which closure is running,
   * reflects what segment is actually on screen by the time the response
   * lands.
   */
  const liveSegmentIdRef = useRef(live.segmentId);
  liveSegmentIdRef.current = live.segmentId;

  const canSubmit = useMemo(() => {
    if (!entry || entry.kind !== 'input') return false;
    return entry.canSubmit ? entry.canSubmit(draft, segment) : draft !== undefined;
  }, [entry, draft, segment]);

  const submit = useCallback(
    async (answer: unknown) => {
      const requestedSegmentId = live.segmentId;
      setChecking(true);
      setFailed(false);
      const result = await gradeSegment(token, requestedSegmentId, answer, attempt);

      if (requestedSegmentId !== liveSegmentIdRef.current) {
        // The tutor already served a different segment while this grade
        // request was in flight. Applying the response now would paint a
        // stale verdict over a fresh, unanswered segment and — through
        // `isSegmentLocked` reading that leaked `verdict?.correct` — soft-lock
        // its inputs until the segment changes again. Silently drop it; the
        // segment-reset effect above has already put the new one in a clean
        // state.
        return;
      }

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
        // v3: relay Core's signed pedagogy receipt with the grade report, so
        // Oracle's strategy controller can trust the event it steers on.
        const pedagogy = result.data.pedagogy
          ? { echo: result.data.pedagogy.echo, attemptNumber: attempt }
          : undefined;
        onGraded(requestedSegmentId, result.data.verdict.score, result.data.verdict.correct, pedagogy);
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
  const locked = isSegmentLocked({
    checking,
    demoRunning,
    answeredCorrectly: verdict?.correct === true,
    attempt,
  });

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
      {/*
        THE ARRIVAL ANNOUNCEMENT, REACHABLE ON EVERY BREAKPOINT.

        Found by adversarial review, round 87 (2026-08-31, MEDIUM). Before
        this, the ONLY spoken notice that a graded/practice activity had
        arrived was `LessonPlate`'s own `peekStatus` span, and that span is
        gated on `resting = !desktop && detent === 'peek'` — unconditionally
        `false` on the docked desktop panel, which `ConversationView.tsx`'s
        own round-61 finding names as the DEFAULT state for essentially
        every ordinary desktop conversation. A screen-reader user on desktop
        therefore had no proactive indication a new activity was on screen —
        they would only find one by tabbing into the panel by chance. On
        mobile the same span could also be torn down within roughly one
        paint of mounting, whenever the tutor's own turn requested the
        segment out loud (`ConversationView.tsx`'s "segment arrives while
        the sheet borrows PEEK" effect raises the detent, which flips
        `resting` false and unmounts the span before assistive tech
        necessarily gets to it).

        This component mounts identically inside `LessonPlate` on BOTH
        forms — the desktop panel never hides its body at all, and this is
        the one surface an arriving activity is guaranteed to be inside on
        either breakpoint — so its own live region is what actually
        reaches a learner regardless of viewport, rather than depending on
        a sheet detent that only exists on a phone.

        `key={live.segmentId}` rather than a `useEffect` writing local
        state: changing a React element's `key` unmounts the old DOM node
        and mounts a fresh one, which is exactly "announce once for a
        genuinely NEW segment, never on a re-render of the one already on
        screen" — the same guarantee the reset effect above gets from its
        own `[live.segmentId]` deps, applied to a DOM node instead of
        component state. A re-render of the SAME segment (a composer
        keystroke elsewhere, a tray-demo step, a verdict arriving) leaves
        this key untouched, so the node is never re-created and nothing is
        re-announced.

        REUSES `tutor.conversation.peekActivityWaiting` rather than a new
        i18n key: it is the exact sentence the (unreachable-on-desktop,
        sometimes-too-brief-on-mobile) peek row already speaks for this
        same event, so this is a second, reliably reachable PLACE the
        product says it — not a new fact for a learner to be told.

        NOT A DUPLICATE OF THE PEEK ROW'S OWN SPAN, even though both can
        exist in the tree for the same arrival, and deliberately kept
        rather than removed. `LessonPlate` hides this entire component's
        subtree behind `hidden`/`display:none` while `resting` is true,
        which removes it from the accessibility tree — so on mobile, while
        the sheet is genuinely resting (an activity arrived without the
        tutor asking for it out loud, and the learner has not opened the
        sheet), only the peek row's span is reachable; this one is inert
        because its ancestor is hidden, so there is nothing here to say
        "twice." The peek row's span stays because it is the one mechanism
        proven to reach a learner while the sheet is still collapsed — this
        span cannot substitute for it there, only alongside it once the
        sheet (or the desktop panel, which never collapses) is open.
      */}
      <span key={live.segmentId} role="status" aria-live="polite" className="sr-only">
        {t('tutor.conversation.peekActivityWaiting')}
      </span>

      <header
        className="min-h-0 shrink space-y-1 overflow-y-auto"
        // Found by `npm run verify:tutor-a11y`, 2026-09-01:
        // `scrollable-region-focusable` (serious). The `overflow-y-auto` on
        // the line below — added the same day by the Round 137 fix that
        // stopped a rigid header squeezing the answers region to zero height
        // — made this a scrollable region reachable by mouse wheel or touch
        // and by NOTHING on a keyboard, since the framing and prompt it holds
        // are text with no focusable descendant of their own. That is the
        // identical violation class ORACLE.md §16 records closing on
        // `TutorTranscript.tsx`, reopened one component over by a fix for an
        // unrelated defect: the class was closed at the instance, not at the
        // class, and the next `overflow-y-auto` re-introduced it.
        //
        // `tabIndex={0}` is the same remedy used there — it puts the region
        // in the tab order without taking focus on mount, so arrow keys /
        // Page Up / Page Down scroll it exactly as a mouse would. Deliberately
        // NO `aria-label` here: `<header>` carries an implicit role, and
        // naming a region whose role does not accept a name is how the same
        // §16 re-run produced `aria-prohibited-attr` on a bare div. The
        // heading text inside is what a screen reader announces.
        tabIndex={0}
      >
        {/*
          NOT `shrink-0` — found live, 2026-09-01, testing a real "give
          change" activity at the HALF detent on a 375px phone. `framing`
          (up to 240 chars) plus `segment.prompt_md` together rendered at
          208px, and a rigid, unshrinkable header left the answers region
          below (`flex-auto`, `min-h-0`, no floor of its own) exactly zero
          height: `overflow: hidden` on an `h: 0` box, so all four options
          were in the DOM, individually measurable, and reached by NOTHING —
          `elementFromPoint` at every option's own center landed on the
          disabled Check button sitting where the collapsed list should have
          been. Nothing this ordinary-length should be able to erase an
          entire answer list with no error anywhere.

          This is not a rare length: `framing` and `prompt_md` are free
          model prose (moderated, not otherwise bounded) and es-MX/pt-BR
          routinely run longer than en-US for the same content. `shrink`
          plus `min-h-0` plus its own scroll means a verbose framing+prompt
          pair scrolls WITHIN the header instead of refusing to yield space
          — flexbox only pulls from a shrinkable item once the items with a
          floor (the answers region, given one below this change) have
          already hit theirs, so an ordinary-length header is completely
          unaffected and still renders at full height.
        */}
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

        `min-h-[110px]` is the floor `header`'s own comment refers to: one
        answer row measures 48-52px tall (`min-h-12` plus padding), so this
        guarantees at least one full option AND a peek of the next — enough
        for a learner to see there is a reachable list at all — no matter how
        much the header above needs to shrink. Sized off the real minimum, not
        a round number: smaller than this and a single-row activity could
        still show a peek too thin to register as "there's more, scroll."
      */}
      <div className="lf-scroll-edge -mx-2 flex min-h-[110px] flex-auto flex-col">
        <div ref={answersRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2">
          <Component
            segment={segment}
            value={draft}
            onChange={setDraft}
            disabled={locked}
            verdict={verdict}
            onFinish={(answer) => void submit(answer)}
            onContentDone={() => onGraded(live.segmentId, 100, true)}
            onCharacterCue={onCharacterCue}
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
