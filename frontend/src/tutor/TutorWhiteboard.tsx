import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { TutorWhiteboardWire } from './types';

/*
 * THE TUTOR'S WHITEBOARD (V4).
 *
 * Until now a growth or spending story lived only in `say` — the tutor could
 * narrate "empiezas con 10 y cada día te dan 2 más" and nothing on screen
 * changed. Reported directly by the owner from a live session, alongside a
 * COMPLETELY UNRELATED activity sitting in the plate. This renders the SAME
 * numbers the tutor is already inventing for its story (oracle/prompt.ts's
 * "invented numbers" rule), live, as the turn arrives.
 *
 * DELIBERATELY NOT A LESSON-ENGINE COMPONENT. `LiveSegmentPanel` reuses the
 * real 57-type registry because grading, XP and the answer key genuinely are
 * shared with the Lesson Player — this is not graded, has no key, and is
 * owned entirely by the tutor surface (LESSON_ENGINE.md §4's family-boundary
 * convention: a family's files are its own, and this is not a family).
 *
 * FOUR KINDS (/ORACLE.md §20.5): `sequence` (a value that changes over
 * time), `compare` (two named things at one moment), `marked_line` (values
 * placed on a line between two references), and `categories` — `compare`
 * generalized from a fixed two sides to 2-6 named things at that same one
 * moment. `TutorWhiteboardWire` (`./types`) is the single source for the
 * wire shape of all four.
 *
 * `values`/`difference`+`greater`/each mark's `position` ARE NEVER
 * RECOMPUTED HERE. Oracle already ran the same arithmetic server-side
 * (`whiteboard.ts`) before this ever reached the wire — the client's job is
 * to draw the numbers it was given, not to re-derive them, exactly the
 * posture the rest of the Tutor takes with a spoken verdict.
 *
 * EACH KIND OWNS ITS WHOLE RENDER, wrapper included — deliberately NOT one
 * shared wrapper with the visual swapped out underneath. `sequence` is the
 * only kind with a reveal animation, and that animation's own state (how
 * many bars are grown in) is also exactly what the accessible name needs to
 * stay in step with. A first draft of this file hoisted the wrapper (and
 * therefore the aria-label) to a shared parent while leaving the reveal
 * timer inside the kind-specific component — TWO independent copies of "how
 * far has this reveal gotten", ticking on two separate effects, with no
 * mechanism keeping them in agreement. That is the exact shape of bug this
 * file's own history (RUNBOOK.md round 101) already cost a round on, for
 * `shown` vs. a stale `seq` — never introduce a second live copy of a value
 * a component's own state already owns. Each kind function below is
 * therefore self-contained: it renders its own announcement span, its own
 * `role="img"` wrapper, and computes its own aria-label from whatever state
 * it alone holds.
 */

export type TutorWhiteboardData = TutorWhiteboardWire;

export interface TutorWhiteboardProps {
  board: TutorWhiteboardData;
  /** Bumped per turn, so the SAME board (same seq) never replays its animation. */
  seq: number;
  className?: string;
}

/**
 * How long each bar takes to grow in, one at a time.
 *
 * Exported so `replayScript.ts` can compute how long a replayed beat that
 * drew a SEQUENCE whiteboard must stay on screen at minimum — the reveal
 * this constant paces is real work `SequenceBoard` does AFTER the beat has
 * already started, and nothing else in the replay knew how long it takes.
 * Found by adversarial review (see RUNBOOK.md): a replayed beat's duration
 * was driven purely by the tutor's spoken word count, with zero awareness
 * of this number, so a short `say` paired with a many-step board — the
 * DESIGNED usage, per /ORACLE.md's whiteboard section, not a rare one —
 * could end the beat, and unmount this component, before the bars had
 * finished growing. Meaningless for `compare`/`marked_line`, which render
 * fully immediately (see those components' own doc comments) —
 * `replayScript.ts`'s own `whiteboardMinMs` only ever multiplies this by a
 * `sequence` board's step count.
 */
export const GROW_STEP_MS = 550;

/**
 * A running value this close to zero is drawn as zero height, not a bar with
 * the visibility floor below.
 *
 * Mirrors `oracle/src/tutor/whiteboard.ts`'s own `ZERO_EPSILON` (same value,
 * duplicated rather than imported — this package has no dependency on
 * `oracle/`, same posture as `TutorWhiteboardWire` (`./types`) hand-mirroring
 * the wire shape instead of importing it across the service boundary). That
 * module clamps a running value NEGATIVE by a hair of floating-point noise
 * up to exact `0`, for a legitimate "spend it down to zero" sequence — a
 * designed case, not an edge case. It does not clamp noise on the POSITIVE
 * side (e.g. `1e-16` from a different step ordering), so a value can still
 * arrive here a hair above zero. Found by adversarial review, round 107,
 * RUNBOOK.md: this component's `Math.max(6, …)` visibility floor — added so
 * a genuinely small nonzero bar stays visible — did not carve out true zero,
 * so a value the label above it showed as "$0" still drew a bar with real
 * height, contradicting its own label on exactly the story beat ("spend it
 * down to zero") this feature was built to narrate correctly.
 */
const ZERO_EPSILON = 1e-9;

function useValueFormat(currency: string | null): (n: number) => string {
  const { i18n } = useTranslation();
  return useMemo(() => {
    const fmt = currency
      ? new Intl.NumberFormat(i18n.language, { style: 'currency', currency, maximumFractionDigits: 0 })
      : new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 0 });
    return (n: number) => fmt.format(n);
  }, [i18n.language, currency]);
}

/** A locale-neutral "min–max" range, an en dash rather than a translated connector word — reads fine in all three shipped locales with no new i18n key. */
function formatRange(min: string, max: string): string {
  return `${min}–${max}`;
}

/**
 * The announcement + `role="img"` wrapper every kind shares byte-for-byte —
 * factored out so the three kind-specific components below differ ONLY in
 * their inner visual and their own aria-label, never in this shell. See
 * `key={seq}`'s own comment for why the announcement is generic and kind-
 * agnostic on purpose.
 */
function WhiteboardShell({
  seq,
  ariaLabel,
  label,
  className,
  children,
}: {
  seq: number;
  ariaLabel: string;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <>
      {/*
        THE MISSING LIVE ANNOUNCEMENT (round 101, HIGH — review sweep
        tutor-review-sweep-101, whiteboard-at-scale dimension). Until this
        round, the ONLY accessibility surface this component had was the
        static `aria-label` below, and an `aria-label` mutating on a node
        that is neither removed nor re-inserted is not reliably announced by
        assistive tech — a screen-reader user who had already met the board
        once got no notice that a NEW turn had redrawn the SAME node with
        new values. That is exactly the "something changed, tell the
        assistive-tech user" event this codebase already has a convention
        for: `LiveSegmentPanel.tsx`'s round-87 fix, a `key`-remounted
        `role="status" aria-live="polite"` span, announcing an activity's
        arrival regardless of breakpoint.

        `key={seq}` reuses the SAME turn-boundary signal the growth
        animation on a `sequence` board already resets on (`seq` is bumped
        once per turn specifically so the same board never re-plays for an
        unrelated re-render) — giving the identical guarantee `LiveSegmentPanel`
        gets from `live.segmentId`: announce once per genuinely NEW board,
        never on a re-render of the one already on screen.

        Deliberately a SIBLING of the `role="img"` node below, not a
        descendant of it — an element with `role="img"` presents its
        subtree to assistive tech as the image's own replaced content,
        which would swallow a nested live region rather than let it
        announce on its own.

        Deliberately a GENERIC message, not the board's own label/values —
        that content is owned by the `aria-label` below (this round's scope
        was the missing MECHANISM only). `LiveSegmentPanel` took the
        identical posture in round 87: its live region announces "an
        activity is ready," never the activity's own prompt text. Kind-
        agnostic on purpose: it announces that SOMETHING new arrived, which
        is equally true of `sequence`, `compare` and `marked_line`.
      */}
      <span key={seq} role="status" aria-live="polite" className="sr-only">
        {t('tutor.whiteboard.updated')}
      </span>
      <div data-tutor-whiteboard role="img" aria-label={ariaLabel} className={cn('flex min-h-0 flex-col gap-3', className)}>
        <p className="lf-caption shrink-0 text-content-muted">{label}</p>
        {children}
      </div>
    </>
  );
}

type SequenceWire = Extract<TutorWhiteboardWire, { kind: 'sequence' }>;
type CompareWire = Extract<TutorWhiteboardWire, { kind: 'compare' }>;
type MarkedLineWire = Extract<TutorWhiteboardWire, { kind: 'marked_line' }>;
type CategoriesWire = Extract<TutorWhiteboardWire, { kind: 'categories' }>;

/**
 * `kind: 'sequence'` — a value that changes over time, drawn as bars that
 * grow in one at a time while the tutor speaks (the ORIGINAL, proven
 * whiteboard visual; unchanged in substance from before this file learned
 * two more kinds — only moved into its own function).
 */
function SequenceBoard({ board, seq, className }: { board: SequenceWire; seq: number; className?: string }) {
  const { t } = useTranslation();
  const format = useValueFormat(board.currency);
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false),
    [],
  );
  /** How many bars are grown-in so far. All of them immediately for a replayed seq or reduced motion. */
  const [shown, setShown] = useState(() => (reducedMotion ? board.values.length : Math.min(1, board.values.length)));

  /**
   * A NEW turn (bumped `seq`, often-SHORTER `board.values`) can arrive while
   * the PREVIOUS turn's bars are still counting up. Resetting `shown` only
   * from a `useEffect` keyed on `seq` fixed the wrong render: an effect runs
   * AFTER React commits, so the render that paired the OLD, larger `shown`
   * with the NEW, shorter `board.values` committed and PAINTED FIRST —
   * every bar of the new sequence showed fully grown for one frame, then
   * visibly collapsed back to one bar and re-grew correctly a tick later.
   * Found by adversarial review, round 101 (RUNBOOK.md).
   *
   * The fix is React's own documented pattern for this exact shape of bug —
   * "adjust state during render, don't wait for an effect" — rather than the
   * general clamp-at-render-time advice, because the bad value here is not
   * merely `shown` OVERSHOOTING the new array's length (a plain
   * `Math.min(shown, board.values.length)` would still start a brand-new
   * turn's board pre-grown whenever the old count happened to fit the new,
   * shorter length); it is `shown` belonging to the WRONG turn entirely. So
   * this tracks which `seq` the current `shown` was computed for, and the
   * moment they disagree, corrects BOTH synchronously, in the render itself.
   * React discards the mismatched render and retries immediately, before
   * anything commits to the screen — the bad frame is never painted, rather
   * than painted and corrected one frame later.
   */
  const [revealedSeq, setRevealedSeq] = useState(seq);
  if (seq !== revealedSeq) {
    setRevealedSeq(seq);
    setShown(reducedMotion ? board.values.length : Math.min(1, board.values.length));
  }

  useEffect(() => {
    if (reducedMotion || shown >= board.values.length) return;
    const id = window.setTimeout(() => setShown((n) => Math.min(n + 1, board.values.length)), GROW_STEP_MS);
    return () => window.clearTimeout(id);
  }, [shown, reducedMotion, board.values.length]);

  /**
   * Defense in depth, for the SAME class of bug at the point of use: `shown`
   * must never be read against `board.values` without being bounded by its
   * CURRENT length, even though the guard above already keeps it in range
   * for every seq this component has actually seen (AGENTS.md §1.14, "a
   * measurement of a shared object must not depend on where it is
   * attached" — the sibling rule, applied to a counter instead of a Box3).
   */
  const safeShown = Math.min(shown, board.values.length);

  const max = Math.max(...board.values, 1);

  /**
   * The SAME per-bar time-step caption a sighted user reads under each bar
   * ("Start" / "Week 1" / "Week 2"…) — shared with the visual render below
   * rather than recomputed, so the two can never drift apart.
   *
   * Found by adversarial review (RUNBOOK.md Round 101): the aria-label was
   * built from `board.values` alone, so a screen-reader user heard a bare
   * "10, 18, 26" with no notion these were week-by-week totals, while a
   * sighted user saw the full "Start / Week 1 / Week 2" story the `unit`
   * field (§20.5) was added specifically to guarantee. The caption is exactly
   * what makes the board answer "what story is this", so leaving it out of
   * the accessible name loses the one thing this feature exists to convey.
   */
  const captionFor = (i: number) => (i === 0 ? t('tutor.whiteboard.start') : t(`tutor.whiteboard.step.${board.unit}`, { n: i }));

  const ariaLabel = `${board.label}. ${board.values
    .slice(0, safeShown)
    .map((value, i) => `${captionFor(i)}: ${format(value)}`)
    .join(', ')}`;

  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      <div className="flex min-h-0 flex-1 gap-2 overflow-x-auto px-1 pb-1">
        {board.values.map((value, i) => {
          const grown = i < safeShown;
          const heightPct = value <= ZERO_EPSILON ? 0 : Math.max(6, Math.round((value / max) * 100));
          return (
            <div key={i} className="flex min-w-[3.5rem] flex-1 flex-col items-center gap-1">
              <span className="lf-number lf-title text-content" aria-hidden="true">
                {grown ? format(value) : ''}
              </span>
              {/*
                THE BAR TRACK — `flex-1 min-h-0` so it (not the bar itself)
                is what carries the ROW's stretched, DEFINITE height down to
                a real pixel value, with `items-end` moved HERE so the bar
                grows from a shared bottom baseline. TWO defects found live,
                verifying THIS file in a real browser while building the
                `compare`/`marked_line` kinds — neither one jsdom (which
                never lays anything out) or any existing unit test here
                could have caught, exactly the class of bug this task's own
                brief warned about:

                (1) HEIGHT: `items-end` on the ROW itself (the ORIGINAL,
                pre-existing structure) leaves each COLUMN's own height
                auto/content-sized, which is not a definite containing
                block — a CSS percentage-height cannot resolve against an
                ancestor whose own height is still being derived FROM that
                same percentage, so it behaves as `height: auto` and the
                bar renders at ZERO pixels in every real browser, always,
                regardless of `heightPct`. Every existing test here only
                ever asserted the INLINE STYLE VALUE ("71%"), never the
                rendered box.

                (2) COLOR (see the class list below): the ORIGINAL fill was
                `bg-[color:var(--lf-accent)]/70` — an arbitrary-value
                utility referencing a design-token CSS variable that is
                itself a bare "R G B" triple (`--lf-accent: 79 70 229`,
                `index.css`), meant to be used inside `rgb(var(...) /
                <alpha>)` (which is exactly what `tailwind.config.js`'s OWN
                `accent` token does). Tailwind cannot decompose an opaque
                `var()` reference at build time, so it emitted
                `background-color: var(--lf-accent)` with NO `rgb()`
                wrapper and NO alpha applied — an invalid color value a
                browser silently discards, leaving the property at its
                initial `transparent`. `bg-accent/70` (the CONFIGURED
                token, below) is what correctly threads the opacity
                modifier through. BOTH defects left the bar fully invisible
                since the feature shipped — only the value number and the
                caption below it were ever seen.
              */}
              <div className="flex w-full min-h-0 flex-1 items-end">
                <div
                  className={cn(
                    'w-full rounded-t-md bg-accent/70 transition-[height] duration-500 ease-out',
                    !grown && 'opacity-0',
                  )}
                  style={{ height: grown ? `${heightPct}%` : '0%' }}
                />
              </div>
              <span className="lf-caption text-content-muted" aria-hidden="true">
                {captionFor(i)}
              </span>
            </div>
          );
        })}
      </div>
    </WhiteboardShell>
  );
}

/**
 * `kind: 'compare'` — two SEPARATE, static quantities side by side (V4,
 * /ORACLE.md §20.5 backlog). Renders immediately, no grow-in reveal: unlike
 * a `sequence`, there is no story unfolding over steps for an animation to
 * pace against — this is a snapshot, not a process, and the fastest way to
 * show a snapshot is to just show it. `difference`/`greater` are
 * SERVER-COMPUTED (`whiteboard.ts`'s `computeComparison`) — the schema gives
 * the model no field to assert either directly, so neither is ever the
 * model's own claim.
 */
function CompareBoard({ board, seq, className }: { board: CompareWire; seq: number; className?: string }) {
  const { t } = useTranslation();
  const format = useValueFormat(board.currency);
  const max = Math.max(board.left.value, board.right.value, 1);
  const sides = [board.left, board.right];

  const ariaLabel = `${board.label}. ${board.left.label}: ${format(board.left.value)}, ${board.right.label}: ${format(board.right.value)}${
    board.greater === 'tie' ? '' : `. ${t('tutor.whiteboard.compare.difference', { amount: format(board.difference) })}`
  }`;

  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex min-h-0 flex-1 justify-center gap-6 overflow-x-auto px-1 pb-1">
          {sides.map((side, i) => {
            const heightPct = side.value <= ZERO_EPSILON ? 0 : Math.max(6, Math.round((side.value / max) * 100));
            return (
              <div key={i} className="flex min-w-[5rem] max-w-[14rem] flex-1 flex-col items-center gap-1">
                <span className="lf-number lf-title text-content" aria-hidden="true">
                  {format(side.value)}
                </span>
                {/* The bar TRACK — see `SequenceBoard`'s own comment on why the bar itself cannot carry `flex-1`/`items-end`. */}
                <div className="flex w-full min-h-0 flex-1 items-end">
                  <div className="w-full rounded-t-md bg-accent/70" style={{ height: `${heightPct}%` }} />
                </div>
                {/*
                  `line-clamp-2` — a hard, DETERMINISTIC ceiling on how tall this
                  caption can ever grow. `side.label` is free text Oracle writes
                  live (moderated, up to 60 chars, /ORACLE.md §20.5) and never
                  passes through `i18n:check`, which only sees catalog strings —
                  so es-MX/pt-BR running 16-19% longer than en-US (TUTOR_QA_
                  2026-09-02.md, D1-as-a-class) can wrap this to 3+ lines in a
                  144-224px column. `LessonPlate`'s `bodyLayout="column"` body is
                  `overflow-hidden` with no scroll (this component is the ONE
                  child expected to manage its own bounds) — an unclamped wrap
                  does not truncate, it silently DISAPPEARS past that ancestor.
                  Clamping trades that invisible loss for a visible ellipsis; the
                  full label still reaches a screen reader via `ariaLabel` above,
                  unaffected by what the sighted caption shows.
                */}
                <span className="lf-caption text-content-muted text-center line-clamp-2 break-words" aria-hidden="true">
                  {side.label}
                </span>
              </div>
            );
          })}
        </div>
        {board.greater !== 'tie' && (
          <p className="lf-caption shrink-0 text-center text-content-muted" aria-hidden="true">
            {t('tutor.whiteboard.compare.difference', { amount: format(board.difference) })}
          </p>
        )}
      </div>
    </WhiteboardShell>
  );
}

/**
 * `kind: 'marked_line'` — one or more values placed on a line between two
 * references (V4, /ORACLE.md §20.5 backlog). Renders immediately, same
 * reasoning as `CompareBoard` above. Each mark's `position` (0..1) is
 * SERVER-COMPUTED (`whiteboard.ts`'s `computeMarkedLine`) from the model's
 * raw `value`/`min`/`max` — this component only ever reads `position`
 * directly, never re-deriving it from the raw numbers, the same "the server
 * computes it once, the client only draws it" rule `values` already follows
 * for `sequence`.
 *
 * Each mark's own VALUE is drawn ON the track, directly above its dot — a
 * short number, safe at any position including the two ends. Each mark's
 * LABEL (free text, up to 60 characters) is drawn in an ordinary wrapping
 * row BELOW the track instead of position-anchored on it, precisely to
 * avoid a label near either end overflowing the plate — a position-anchored
 * label has no such protection. KNOWN, ACCEPTED LIMITATION: two marks
 * positioned very close together can still crowd each other's VALUE text
 * above the track — undefended for now, the same as this file's other
 * kinds are undefended against a pathologically long `label`, because no
 * real session has shown it is a problem worth a layout algorithm for yet.
 */
function MarkedLineBoard({ board, seq, className }: { board: MarkedLineWire; seq: number; className?: string }) {
  const format = useValueFormat(board.currency);
  const range = formatRange(format(board.min), format(board.max));
  const marksText = board.marks.map((m) => `${m.label}: ${format(m.value)}`).join(', ');
  const ariaLabel = `${board.label}. ${range}. ${marksText}`;

  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-4 px-6">
        <div className="relative mx-2 h-1.5 rounded-full bg-accent-soft">
          {board.marks.map((mark, i) => (
            <div
              key={i}
              className="absolute top-1/2 flex flex-col items-center gap-1.5"
              style={{
                left: `${Math.min(100, Math.max(0, mark.position * 100))}%`,
                transform: 'translate(-50%, -50%)',
              }}
              aria-hidden="true"
            >
              <span className="lf-number lf-title text-content whitespace-nowrap">{format(mark.value)}</span>
              <span className="h-3.5 w-3.5 shrink-0 rounded-full bg-accent ring-2 ring-surface" />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1" aria-hidden="true">
          {/*
            `max-w` + `line-clamp-2` — the same bounded-caption reasoning as
            `CompareBoard`'s identical comment, applied here too: `mark.label`
            is the same shape of risk (moderated, model-authored, up to 60
            chars, up to 4 per board, invisible to `i18n:check`) even though
            TUTOR_QA_2026-09-02.md's live session only reproduced it on the
            two narrower bar-chart kinds. Lower likelihood here (this row has
            no per-label column width forcing an early wrap) but the same
            ceiling closes it rather than leaving it open on an untested guess.
          */}
          {board.marks.map((mark, i) => (
            <span key={i} className="lf-caption text-content-muted max-w-[16rem] text-center line-clamp-2 break-words">
              {mark.label}
            </span>
          ))}
        </div>
        <div className="flex justify-between px-1" aria-hidden="true">
          <span className="lf-caption text-content-muted">{format(board.min)}</span>
          <span className="lf-caption text-content-muted">{format(board.max)}</span>
        </div>
      </div>
    </WhiteboardShell>
  );
}

/**
 * `kind: 'categories'` — several DIFFERENT named things compared side by
 * side at ONE moment (V4, /ORACLE.md §20.5) — `compare` generalized from a
 * fixed two sides to 2-6. Renders immediately, same reasoning as
 * `CompareBoard` above: a snapshot of several things has no story unfolding
 * over steps for a `SequenceBoard`-style reveal to pace against. `values` is
 * SERVER-COMPUTED, one-to-one with `categories` (`whiteboard.ts`'s
 * `computeCategories`) — the schema gives the model no field to assert it
 * directly, the same posture `sequence`'s own `values` already takes. Needs
 * no i18n key for its per-bar captions: each one IS `categories[i].label`,
 * the model's own (moderated) name for that bar, never a translated word.
 */
function CategoriesBoard({ board, seq, className }: { board: CategoriesWire; seq: number; className?: string }) {
  const format = useValueFormat(board.currency);
  const max = Math.max(...board.values, 1);

  const ariaLabel = `${board.label}. ${board.categories
    .map((category, i) => `${category.label}: ${format(board.values[i]!)}`)
    .join(', ')}`;

  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      <div className="flex min-h-0 flex-1 gap-2 overflow-x-auto px-1 pb-1">
        {board.categories.map((category, i) => {
          const value = board.values[i]!;
          const heightPct = value <= ZERO_EPSILON ? 0 : Math.max(6, Math.round((value / max) * 100));
          return (
            <div key={i} className="flex min-w-[4.5rem] flex-1 flex-col items-center gap-1">
              <span className="lf-number lf-title text-content" aria-hidden="true">
                {format(value)}
              </span>
              {/* The bar TRACK — see `SequenceBoard`'s own comment on why the bar itself cannot carry `flex-1`/`items-end`. */}
              <div className="flex w-full min-h-0 flex-1 items-end">
                <div className="w-full rounded-t-md bg-accent/70" style={{ height: `${heightPct}%` }} />
              </div>
              {/* `line-clamp-2` — see `CompareBoard`'s identical comment above. `category.label`: moderated, up to 6 per board, up to 40 chars, model-authored. */}
              <span className="lf-caption text-content-muted text-center line-clamp-2 break-words" aria-hidden="true">
                {category.label}
              </span>
            </div>
          );
        })}
      </div>
    </WhiteboardShell>
  );
}

export function TutorWhiteboard({ board, seq, className }: TutorWhiteboardProps) {
  switch (board.kind) {
    case 'sequence':
      return <SequenceBoard board={board} seq={seq} className={className} />;
    case 'compare':
      return <CompareBoard board={board} seq={seq} className={className} />;
    case 'marked_line':
      return <MarkedLineBoard board={board} seq={seq} className={className} />;
    case 'categories':
      return <CategoriesBoard board={board} seq={seq} className={className} />;
  }
}
