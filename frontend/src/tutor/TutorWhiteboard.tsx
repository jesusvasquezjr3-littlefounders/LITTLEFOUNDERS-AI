import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui';
import { cn } from '@/lib/utils';
import { playSfx } from '@/lesson-engine/player/sfx';
import type { TutorWhiteboardWire } from './types';
import {
  AxisCaption,
  BarColumn,
  BarTrack,
  BoardRow,
  Caption,
  HBar,
  Token,
  ValueLabel,
  barHeightPct,
  useValueFormat,
} from './whiteboard/primitives';

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
 * FIVE KINDS. Four are charts (/ORACLE.md §20.5): `sequence` (a value that
 * changes over time), `compare` (two named things at one moment),
 * `marked_line` (values placed on a line between two references), and
 * `categories` — `compare` generalized from a fixed two sides to 2-6 named
 * things at that same one moment. The fifth, `tokens`, is not a chart at all:
 * discrete denominated objects on a table, for the several remediation moves
 * that ask for coins a learner can pick up rather than a height. The catalog
 * these five are the first of, and the plan for the rest, is
 * /TUTOR_INSTRUMENTS.md. `TutorWhiteboardWire` (`./types`) is the single
 * source for the wire shape of all five.
 *
 * EVERY SHAPE IS DRAWN THROUGH `whiteboard/primitives.tsx`, and that is a
 * safety property rather than tidiness. Both defects this surface has shipped
 * lived in the shared parts, not in any one kind's logic: bars that resolved
 * their percentage height against nothing and rendered at ZERO PIXELS in every
 * real browser from launch, and a model-written caption that did not truncate
 * but DISAPPEARED behind an `overflow-hidden` ancestor. A primitive that makes
 * the bug unreachable protects the next instrument too; a fix applied kind by
 * kind protects only the kinds someone remembered.
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

/** A locale-neutral "min–max" range, an en dash rather than a translated connector word — reads fine in all three shipped locales with no new i18n key. */
function formatRange(min: string, max: string): string {
  return `${min}–${max}`;
}

/**
 * The announcement + `role="img"` wrapper every kind shares byte-for-byte —
 * factored out so the kind-specific components below differ ONLY in
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
  onAdvance,
  interactive,
}: {
  seq: number;
  /** Ignored when `interactive` is set — the group takes its name from `label` instead. */
  ariaLabel?: string;
  label: string;
  className?: string;
  children: ReactNode;
  /**
   * `step` (Class II, S9, /TUTOR_INSTRUMENTS.md §3.3): "advances the reveal
   * at their own pace instead of watching it." Present only on a board with
   * a genuine multi-beat reveal to pace through and only while a beat is
   * still pending (`SequenceBoard` is, today, the only caller — see its own
   * comment). Rendered as a SIBLING of the `role="img"` node below, for the
   * identical reason the live-announcement span above already is: an
   * element with `role="img"` presents its subtree as the image's own
   * replaced content, which would swallow a nested interactive control from
   * assistive tech rather than let it be reached. No model involvement and
   * no new schema field — advancing a beat sooner than the auto-timer would
   * have does not change what is drawn, only when, so there is nothing here
   * for the model to author.
   */
  onAdvance?: () => void;
  /**
   * `grab` (Class II, S9) only: this board's content is itself interactive
   * (tappable items and bins), not a picture of a finished state — the ONE
   * kind in the whole catalog where that is true. `role="img"` presents its
   * subtree to assistive tech as the image's own replaced content, which is
   * correct for 41 read-only boards and would swallow every button inside a
   * `grab` board the same way a nested `onAdvance` control would be (see
   * that prop's own comment). So this kind gets `role="group"` instead —
   * its own children stay individually reachable — and a plain caption for
   * its name rather than a full state description: the state itself is
   * exactly what a screen-reader user needs to explore turn by turn as they
   * place things, not hear collapsed into one string on every change.
   */
  interactive?: boolean;
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
        is equally true of every kind.
      */}
      <span key={seq} role="status" aria-live="polite" className="sr-only">
        {t('tutor.whiteboard.updated')}
      </span>
      <div
        data-tutor-whiteboard
        role={interactive ? 'group' : 'img'}
        aria-label={interactive ? label : (ariaLabel ?? '')}
        className={cn('flex min-h-0 flex-col gap-3', className)}
      >
        <p className="lf-caption shrink-0 text-content-muted">{label}</p>
        {children}
      </div>
      {onAdvance && (
        <button
          type="button"
          onClick={onAdvance}
          className="lf-caption pointer-events-auto flex shrink-0 items-center gap-1 self-end text-primary hover:underline"
        >
          {t('tutor.whiteboard.showNext')}
          <Icon name="chevron_right" className="!text-[16px]" />
        </button>
      )}
    </>
  );
}

type SequenceWire = Extract<TutorWhiteboardWire, { kind: 'sequence' }>;
type CompareWire = Extract<TutorWhiteboardWire, { kind: 'compare' }>;
type MarkedLineWire = Extract<TutorWhiteboardWire, { kind: 'marked_line' }>;
type CategoriesWire = Extract<TutorWhiteboardWire, { kind: 'categories' }>;
type TokensWire = Extract<TutorWhiteboardWire, { kind: 'tokens' }>;
type BarModelWire = Extract<TutorWhiteboardWire, { kind: 'bar_model' }>;
type PartWholeWire = Extract<TutorWhiteboardWire, { kind: 'part_whole' }>;
type FlowWire = Extract<TutorWhiteboardWire, { kind: 'flow' }>;
type GoalBarWire = Extract<TutorWhiteboardWire, { kind: 'goal_bar' }>;
type WorkedWire = Extract<TutorWhiteboardWire, { kind: 'worked' }>;
type TenFrameWire = Extract<TutorWhiteboardWire, { kind: 'ten_frame' }>;
type OpenNumberLineWire = Extract<TutorWhiteboardWire, { kind: 'open_number_line' }>;
type ArrayWire = Extract<TutorWhiteboardWire, { kind: 'array' }>;
type FractionStripWire = Extract<TutorWhiteboardWire, { kind: 'fraction_strip' }>;
type PartitionWire = Extract<TutorWhiteboardWire, { kind: 'partition' }>;
type TableWire = Extract<TutorWhiteboardWire, { kind: 'table' }>;
type ScaleWire = Extract<TutorWhiteboardWire, { kind: 'scale' }>;
type TwoBinsWire = Extract<TutorWhiteboardWire, { kind: 'two_bins' }>;
type VennWire = Extract<TutorWhiteboardWire, { kind: 'venn' }>;
type RankingWire = Extract<TutorWhiteboardWire, { kind: 'ranking' }>;
type OutcomesWire = Extract<TutorWhiteboardWire, { kind: 'outcomes' }>;
type TradeWire = Extract<TutorWhiteboardWire, { kind: 'trade' }>;
type ChanceWire = Extract<TutorWhiteboardWire, { kind: 'chance' }>;
type DealWire = Extract<TutorWhiteboardWire, { kind: 'deal' }>;
type ChangeWire = Extract<TutorWhiteboardWire, { kind: 'change' }>;
type RegroupWire = Extract<TutorWhiteboardWire, { kind: 'regroup' }>;
type EquationBarWire = Extract<TutorWhiteboardWire, { kind: 'equation_bar' }>;
type ReceiptWire = Extract<TutorWhiteboardWire, { kind: 'receipt' }>;
type LedgerWire = Extract<TutorWhiteboardWire, { kind: 'ledger' }>;
type PriceTagWire = Extract<TutorWhiteboardWire, { kind: 'price_tag' }>;
type InventoryWire = Extract<TutorWhiteboardWire, { kind: 'inventory' }>;
type BudgetPlateWire = Extract<TutorWhiteboardWire, { kind: 'budget_plate' }>;
type PictographWire = Extract<TutorWhiteboardWire, { kind: 'pictograph' }>;
type BeadStringWire = Extract<TutorWhiteboardWire, { kind: 'bead_string' }>;
type TallyWire = Extract<TutorWhiteboardWire, { kind: 'tally' }>;
type FractionCircleWire = Extract<TutorWhiteboardWire, { kind: 'fraction_circle' }>;
type StackWire = Extract<TutorWhiteboardWire, { kind: 'stack' }>;
type SequenceCompareWire = Extract<TutorWhiteboardWire, { kind: 'sequence_compare' }>;
type TimelineWire = Extract<TutorWhiteboardWire, { kind: 'timeline' }>;
type CycleWire = Extract<TutorWhiteboardWire, { kind: 'cycle' }>;
type BeforeAfterWire = Extract<TutorWhiteboardWire, { kind: 'before_after' }>;
type GrabWire = Extract<TutorWhiteboardWire, { kind: 'grab' }>;
type FillWire = Extract<TutorWhiteboardWire, { kind: 'fill' }>;
type WhatifWire = Extract<TutorWhiteboardWire, { kind: 'whatif' }>;
type YourTurnWire = Extract<TutorWhiteboardWire, { kind: 'your_turn' }>;

/**
 * `kind: 'sequence'` — a value that changes over time, drawn as bars that
 * grow in one at a time while the tutor speaks (the ORIGINAL, proven
 * whiteboard visual).
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

  /*
   * ONE CUE PER BAR (Sprint 3, /TUTOR_INSTRUMENTS.md), reusing the Lesson
   * Player's own `sfx.ts` — no new asset, and the same fire-and-forget,
   * autoplay-safe, "a missing sound is never an error a kid sees" posture
   * that module already has. Deliberately client-resolved rather than a new
   * model-facing field: which of the 9 sounds plays for a bar growing in
   * carries no pedagogical content, so authoring it per turn would spend a
   * §4.1 sealed-context field (its own sign-off, its own legal-review touch)
   * on a decision that is really about the board's own `kind`, not about
   * this turn's story — the same reasoning `GROW_STEP_MS` itself already
   * isn't authored, either.
   * Gated by the SAME `reducedMotion` check the reveal loop already uses:
   * under reduced motion this effect never runs at all (bars are all shown
   * on mount, above), so the cue is silent for free rather than needing its
   * own separate check — there is no standard `prefers-reduced-sound` media
   * query to check separately. Bar 0 (shown instantly on mount, above) does
   * NOT play a cue — only the bars that actually animate in via this timer
   * do, so the sound stays synchronized to visible motion rather than
   * popping before the learner has any context.
   */
  useEffect(() => {
    if (reducedMotion || shown >= board.values.length) return;
    const id = window.setTimeout(() => {
      setShown((n) => Math.min(n + 1, board.values.length));
      playSfx('drop');
    }, GROW_STEP_MS);
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

  /*
   * `step` (Class II, S9): tapping plays the SAME state transition the
   * timer's own callback does — one bar further, one `drop` cue — so a
   * learner who advances by hand sees and hears exactly what would have
   * happened anyway, only sooner. `setShown` here reruns the reveal effect
   * above (it is keyed on `shown`), whose cleanup already clears whatever
   * timer was pending — a tap and the timer racing each other can only ever
   * produce ONE advance, never a double one, because there is one source of
   * truth (`shown`) and one effect that reschedules from it.
   */
  const canAdvance = !reducedMotion && safeShown < board.values.length;
  const advance = () => {
    setShown((n) => Math.min(n + 1, board.values.length));
    playSfx('drop');
  };

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
    <WhiteboardShell
      seq={seq}
      ariaLabel={ariaLabel}
      label={board.label}
      className={className}
      onAdvance={canAdvance ? advance : undefined}
    >
      <BoardRow>
        {board.values.map((value, i) => {
          const grown = i < safeShown;
          return (
            <BarColumn key={i} minWidth="3.5rem">
              <ValueLabel>{grown ? format(value) : ''}</ValueLabel>
              <BarTrack heightPct={barHeightPct(value, max)} grown={grown} animated />
              {/* Chrome from the locale files, not model text — see `AxisCaption`. */}
              <AxisCaption>{captionFor(i)}</AxisCaption>
            </BarColumn>
          );
        })}
      </BoardRow>
    </WhiteboardShell>
  );
}

/**
 * `kind: 'compare'` — two SEPARATE, static quantities side by side. Renders
 * immediately, no grow-in reveal: unlike a `sequence`, there is no story
 * unfolding over steps for an animation to pace against — this is a snapshot,
 * not a process, and the fastest way to show a snapshot is to just show it.
 * `difference`/`greater` are SERVER-COMPUTED (`whiteboard.ts`'s
 * `computeComparison`) — the schema gives the model no field to assert either
 * directly, so neither is ever the model's own claim.
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
        <BoardRow gap="lg" justify="center">
          {sides.map((side, i) => (
            <BarColumn key={i} minWidth="5rem" maxWidth="14rem">
              <ValueLabel>{format(side.value)}</ValueLabel>
              <BarTrack heightPct={barHeightPct(side.value, max)} />
              {/* Model-written, so clamped — see `Caption`. */}
              <Caption>{side.label}</Caption>
            </BarColumn>
          ))}
        </BoardRow>
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
 * references. Renders immediately, same reasoning as `CompareBoard` above.
 * Each mark's `position` (0..1) is SERVER-COMPUTED (`whiteboard.ts`'s
 * `computeMarkedLine`) from the model's raw `value`/`min`/`max` — this
 * component only ever reads `position` directly, never re-deriving it from
 * the raw numbers, the same "the server computes it once, the client only
 * draws it" rule `values` already follows for `sequence`.
 *
 * Each mark's own VALUE is drawn ON the track, directly above its dot — a
 * short number, safe at any position including the two ends. Each mark's
 * LABEL (free text, up to 60 characters) is drawn in an ordinary wrapping
 * row BELOW the track instead of position-anchored on it, precisely to
 * avoid a label near either end overflowing the plate — a position-anchored
 * label has no such protection. KNOWN, ACCEPTED LIMITATION: two marks
 * positioned very close together can still crowd each other's VALUE text
 * above the track — undefended for now, because no real session has shown it
 * is a problem worth a layout algorithm for yet.
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
          {board.marks.map((mark, i) => (
            // Model-written and unbounded by any column width here, so the same
            // clamp plus an explicit ceiling — see `Caption`.
            <Caption key={i} className="max-w-[16rem]">
              {mark.label}
            </Caption>
          ))}
        </div>
        <div className="flex justify-between px-1" aria-hidden="true">
          <AxisCaption>{format(board.min)}</AxisCaption>
          <AxisCaption>{format(board.max)}</AxisCaption>
        </div>
      </div>
    </WhiteboardShell>
  );
}

/**
 * `kind: 'categories'` — several DIFFERENT named things compared side by
 * side at ONE moment — `compare` generalized from a fixed two sides to 2-6.
 * Renders immediately, same reasoning as `CompareBoard` above: a snapshot of
 * several things has no story unfolding over steps for a `SequenceBoard`-style
 * reveal to pace against. `values` is SERVER-COMPUTED, one-to-one with
 * `categories` (`whiteboard.ts`'s `computeCategories`) — the schema gives the
 * model no field to assert it directly, the same posture `sequence`'s own
 * `values` already takes. Needs no i18n key for its per-bar captions: each one
 * IS `categories[i].label`, the model's own (moderated) name for that bar,
 * never a translated word.
 */
function CategoriesBoard({ board, seq, className }: { board: CategoriesWire; seq: number; className?: string }) {
  const format = useValueFormat(board.currency);
  const max = Math.max(...board.values, 1);

  const ariaLabel = `${board.label}. ${board.categories
    .map((category, i) => `${category.label}: ${format(board.values[i]!)}`)
    .join(', ')}`;

  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      <BoardRow>
        {board.categories.map((category, i) => {
          const value = board.values[i]!;
          return (
            <BarColumn key={i} minWidth="4.5rem">
              <ValueLabel>{format(value)}</ValueLabel>
              <BarTrack heightPct={barHeightPct(value, max)} />
              {/* Model-written, so clamped — see `Caption`. */}
              <Caption>{category.label}</Caption>
            </BarColumn>
          );
        })}
      </BoardRow>
    </WhiteboardShell>
  );
}

/**
 * `kind: 'tokens'` — DISCRETE, DENOMINATED OBJECTS ON THE TABLE
 * (/TUTOR_INSTRUMENTS.md, Sprint 6). The first instrument here that is not a
 * chart, and the reason the primitive kit exists rather than the two bar-chart
 * kinds simply sharing a helper.
 *
 * `oracle/skills/moves/biggest-coin-first.md` instructs the tutor to "keep the
 * coins ON THE TABLE where they can be picked up. This move dies if it becomes
 * arithmetic in the head." A bar chart of "three 10s and two 5s" is a picture
 * of two numbers; this is a picture of a pile.
 *
 * EVERY TOKEN IS DRAWN THE SAME SIZE, and that is a pedagogical requirement,
 * not a shortcut. Three of the misconceptions this instrument exists to close
 * are `bigger-coin-worth-more`, `more-coins-more-money` and
 * `counts-coins-not-value` — a learner believing that what LOOKS bigger is
 * worth more. Sizing tokens by denomination would make appearance and value
 * agree on every board this tutor ever draws, which teaches the misconception
 * instead of breaking it. `value-not-appearance.md` asks for the opposite:
 * "build one case where the two split." So a token's value is READ, never
 * inferred from its size.
 *
 * Renders immediately, no reveal: a pile is a snapshot. The counting is the
 * learner's work, and pacing it for them would take that away.
 */
function TokensBoard({ board, seq, className }: { board: TokensWire; seq: number; className?: string }) {
  const { t } = useTranslation();
  const format = useValueFormat(board.currency);

  const ariaLabel = `${board.label}. ${board.groups
    .map((group, i) => `${t('tutor.whiteboard.tokens.each', { count: group.count, amount: format(group.denomination) })}: ${format(board.subtotals[i]!)}`)
    .join(', ')}. ${t('tutor.whiteboard.tokens.total', { amount: format(board.total) })}`;

  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      {/*
        Vertically CENTRED, unlike every bar-chart kind, and the difference is
        not a preference. A bar grows from a shared baseline, so bottom
        anchoring is what makes two bars comparable; a pile of coins has no
        baseline to share, and bottom-anchoring it inside the plate's full
        height left a large empty band above the coins that reads as a broken
        layout rather than as a table. Caught by looking at the gate's own
        screenshot, not by any assertion in it — 0 unreachable controls and 0
        overlaps were both true of the version that looked wrong.
      */}
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-2">
        <BoardRow gap="lg" justify="center" grow={false}>
          {board.groups.map((group, i) => (
            <div key={i} className="flex min-w-[5rem] flex-col items-center justify-center gap-1.5">
              <div className="flex flex-wrap items-end justify-center gap-1">
                {Array.from({ length: group.count }, (_, n) => (
                  <Token key={n}>{format(group.denomination)}</Token>
                ))}
              </div>
              {/* Chrome from the locale files around server-computed numbers — not model text. */}
              <AxisCaption>
                {t('tutor.whiteboard.tokens.each', { count: group.count, amount: format(group.denomination) })}
              </AxisCaption>
            </div>
          ))}
        </BoardRow>
        <p className="lf-caption shrink-0 text-center text-content-muted" aria-hidden="true">
          {t('tutor.whiteboard.tokens.total', { amount: format(board.total) })}
        </p>
      </div>
    </WhiteboardShell>
  );
}


/**
 * `kind: 'bar_model'` — THE SINGAPORE BAR. The whole as one length, the parts as
 * a second length beneath it, and the unknown as a dashed gap.
 *
 * The unknown is drawn at its REAL width and with no number in it, and both
 * halves of that are the representation working as intended: the width is what
 * lets a learner see how big the missing piece is, and the absent number is what
 * leaves them something to say. The server never sends the value (`computeBarModel`).
 */
function BarModelBoard({ board, seq, className }: { board: BarModelWire; seq: number; className?: string }) {
  const { t } = useTranslation();
  const format = useValueFormat(board.currency);
  const ariaLabel = `${board.label}. ${board.whole.label}: ${format(board.whole.value)}. ${board.parts
    .map((p) => `${p.label}: ${p.value === null ? t('tutor.whiteboard.board.unknown') : format(p.value)}`)
    .join(', ')}`;

  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-4 px-2">
        <div className="flex flex-col gap-1">
          <HBar segments={[{ fraction: 1, tone: 'muted' }]} />
          <div className="flex items-baseline justify-between gap-2">
            <Caption className="text-left">{board.whole.label}</Caption>
            <AxisCaption>{format(board.whole.value)}</AxisCaption>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <HBar segments={board.widths.map((fraction, i) => ({ fraction, dashed: board.parts[i]?.value === null }))} />
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            {board.parts.map((part, i) => (
              <span key={i} className="flex min-w-0 items-baseline gap-1.5">
                <Caption>{part.label}</Caption>
                <AxisCaption>{part.value === null ? t('tutor.whiteboard.board.unknown') : format(part.value)}</AxisCaption>
              </span>
            ))}
          </div>
        </div>
      </div>
    </WhiteboardShell>
  );
}

/**
 * `kind: 'part_whole'` — THE NUMBER BOND. One whole above, two parts below,
 * joined by lines.
 *
 * Nothing here is derived; every number was stated and the server's contribution
 * was refusing a bond that does not balance (`computePartWhole`). What the shape
 * adds is that adding and subtracting stop looking like two procedures.
 */
function PartWholeBoard({ board, seq, className }: { board: PartWholeWire; seq: number; className?: string }) {
  const format = useValueFormat(board.currency);
  const ariaLabel = `${board.label}. ${board.whole.label}: ${format(board.whole.value)} = ${board.left.label}: ${format(
    board.left.value,
  )} + ${board.right.label}: ${format(board.right.value)}`;

  const Node = ({ label, value, tone }: { label: string; value: number; tone: 'whole' | 'part' }) => (
    <span className="flex min-w-0 flex-col items-center gap-1">
      <span
        className={cn(
          'flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 text-center',
          tone === 'whole' ? 'border-accent bg-accent/15' : 'border-content-muted/40 bg-surface',
        )}
        aria-hidden="true"
      >
        <span className="lf-number text-content">{format(value)}</span>
      </span>
      <Caption>{label}</Caption>
    </span>
  );

  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1">
        <Node label={board.whole.label} value={board.whole.value} tone="whole" />
        {/* The bond itself: two strokes from the whole down to its parts. */}
        <svg width="120" height="26" viewBox="0 0 120 26" aria-hidden="true" className="shrink-0">
          <path
            d="M60 2 L22 24 M60 2 L98 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="text-content-muted/50"
          />
        </svg>
        <div className="flex items-start justify-center gap-8">
          <Node label={board.left.label} value={board.left.value} tone="part" />
          <Node label={board.right.label} value={board.right.value} tone="part" />
        </div>
      </div>
    </WhiteboardShell>
  );
}

/**
 * `kind: 'flow'` — WHAT CAME IN, WHAT WENT OUT, WHAT IS LEFT.
 *
 * `three-piles-in-out-left.md` asks for three places "left UNNAMED… coin by
 * coin", so the values appear first and the labels follow a beat later. The
 * reveal is client-side and deliberately short — long enough to make the point
 * that the third pile is a RESULT, not another thing the tutor decided.
 *
 * `kept` is server-computed and is the whole lesson (`computeFlow`).
 */
function FlowBoard({ board, seq, className }: { board: FlowWire; seq: number; className?: string }) {
  const format = useValueFormat(board.currency);
  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false),
    [],
  );
  const [named, setNamed] = useState(reducedMotion);

  // Reset on a genuinely new board, in render rather than an effect — the same
  // reason `SequenceBoard` does (a bad frame is never painted).
  const [namedSeq, setNamedSeq] = useState(seq);
  if (seq !== namedSeq) {
    setNamedSeq(seq);
    setNamed(reducedMotion);
  }

  useEffect(() => {
    if (named) return;
    const id = window.setTimeout(() => setNamed(true), GROW_STEP_MS * 2);
    return () => window.clearTimeout(id);
  }, [named]);

  const piles = [
    { label: board.income.label, value: board.income.value, tone: 'accent' as const },
    { label: board.spent.label, value: board.spent.value, tone: 'muted' as const },
    { label: board.keptLabel, value: board.kept, tone: 'accent' as const },
  ];
  const ariaLabel = `${board.label}. ${piles.map((p) => `${p.label}: ${format(p.value)}`).join(', ')}`;

  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      <div className="flex min-h-0 flex-1 items-center justify-center gap-3 px-2">
        {piles.map((pile, i) => (
          <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <div
              className={cn(
                'flex w-full items-center justify-center rounded-md border-2 border-dashed py-3',
                pile.tone === 'accent' ? 'border-accent/60 bg-accent/10' : 'border-content-muted/40',
              )}
              aria-hidden="true"
            >
              <span className="lf-number lf-title text-content">{format(pile.value)}</span>
            </div>
            {/* The label arrives AFTER the value — the move's own sequencing. */}
            <Caption className={cn('transition-opacity duration-300', !named && 'opacity-0')}>{pile.label}</Caption>
          </div>
        ))}
      </div>
    </WhiteboardShell>
  );
}

/**
 * `kind: 'goal_bar'` — THE GOAL END TO END, WHAT IS SAVED SHADED FROM THE LEFT.
 *
 * `find-what-is-missing.md`, rendered: the bar is drawn before any operation, so
 * the gap between the shading and the end IS the question. `remaining` is
 * server-computed (`computeGoalBar`).
 */
function GoalBarBoard({ board, seq, className }: { board: GoalBarWire; seq: number; className?: string }) {
  const { t } = useTranslation();
  const format = useValueFormat(board.currency);
  const ariaLabel = `${board.label}. ${board.goal.label}: ${format(board.goal.value)}. ${board.saved.label}: ${format(
    board.saved.value,
  )}. ${t('tutor.whiteboard.board.remaining', { amount: format(board.remaining) })}`;

  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-3 px-2">
        <HBar
          segments={[
            { fraction: board.savedFraction },
            { fraction: 1 - board.savedFraction, tone: 'muted' },
          ]}
        />
        <div className="flex items-baseline justify-between gap-2">
          <span className="flex min-w-0 items-baseline gap-1.5">
            <Caption>{board.saved.label}</Caption>
            <AxisCaption>{format(board.saved.value)}</AxisCaption>
          </span>
          <span className="flex min-w-0 items-baseline gap-1.5">
            <Caption>{board.goal.label}</Caption>
            <AxisCaption>{format(board.goal.value)}</AxisCaption>
          </span>
        </div>
        <p className="lf-caption shrink-0 text-center text-content-muted" aria-hidden="true">
          {t('tutor.whiteboard.board.remaining', { amount: format(board.remaining) })}
        </p>
      </div>
    </WhiteboardShell>
  );
}

/**
 * `kind: 'worked'` — THE CALCULATION LINE BY LINE, INCLUDING THE CHECK.
 *
 * The only kind that draws a HABIT rather than a quantity.
 * `worked-example-think-aloud.md` asks to "deliberately show the moment of
 * CHECKING… undo the operation", and `computeWorked` performs that undo server-
 * side, so the check drawn here is one the machine actually did.
 */
function WorkedBoard({ board, seq, className }: { board: WorkedWire; seq: number; className?: string }) {
  const { t } = useTranslation();
  const format = useValueFormat(board.currency);
  const lines = board.steps.map((step, i) => ({
    op: step.op === 'add' ? '+' : '−',
    value: step.value,
    result: board.values[i + 1]!,
  }));
  const ariaLabel = `${board.label}. ${format(board.start)}${lines
    .map((l) => `, ${l.op} ${format(l.value)} = ${format(l.result)}`)
    .join('')}. ${t('tutor.whiteboard.board.check', { amount: format(board.checkValue) })}`;

  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-1.5 px-2" aria-hidden="true">
        <p className="lf-number lf-title text-right text-content tabular-nums">{format(board.start)}</p>
        {lines.map((line, i) => (
          <p key={i} className="flex items-baseline justify-end gap-2 text-content">
            <span className="lf-caption text-content-muted tabular-nums">
              {line.op} {format(line.value)}
            </span>
            <span className="lf-number lf-title tabular-nums">{format(line.result)}</span>
          </p>
        ))}
        {/* The check: the last step undone, landing back where it started. */}
        <p className="mt-1 border-t border-content-muted/25 pt-1.5 text-right lf-caption text-content-muted tabular-nums">
          {t('tutor.whiteboard.board.check', { amount: format(board.checkValue) })}
        </p>
      </div>
    </WhiteboardShell>
  );
}


/**
 * `kind: 'ten_frame'` — a quantity SEEN rather than counted. Two rows of five,
 * so seven reads as "five and two" without counting to it.
 *
 * The empty cells are drawn as clearly as the full ones, because the complement
 * to ten is what a ten frame is usually being used to ask about — and it is
 * deliberately not a number the server sends.
 */
function TenFrameBoard({ board, seq, className }: { board: TenFrameWire; seq: number; className?: string }) {
  const ariaLabel = `${board.label}. ${board.count}`;
  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3" aria-hidden="true">
        {board.frames.map((filled, f) => (
          <div key={f} className="grid grid-cols-5 gap-1 rounded-md border-2 border-content-muted/40 p-1">
            {Array.from({ length: 10 }, (_, i) => (
              <span
                key={i}
                className={cn(
                  'h-7 w-7 rounded-full border',
                  i < filled ? 'border-accent bg-accent/70' : 'border-content-muted/30 bg-transparent',
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </WhiteboardShell>
  );
}

/**
 * `kind: 'open_number_line'` — COUNTING ON, IN JUMPS. The representation of
 * `money.make-change-counting-up`, which had no visual at all until now.
 *
 * Every stop's place is server-computed (`computeOpenNumberLine`), and a line
 * whose jumps do not land exactly on `to` never reaches here — a picture of
 * counting up that fails to arrive teaches the method as unreliable.
 */
function OpenNumberLineBoard({ board, seq, className }: { board: OpenNumberLineWire; seq: number; className?: string }) {
  const format = useValueFormat(board.currency);
  const ariaLabel = `${board.label}. ${board.stops.map((v) => format(v)).join(' → ')}`;
  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-2 px-6" aria-hidden="true">
        {/* The jumps, drawn as arcs between consecutive stops. */}
        <div className="relative h-9">
          {board.jumps.map((jump, i) => {
            const left = board.positions[i]! * 100;
            const width = (board.positions[i + 1]! - board.positions[i]!) * 100;
            return (
              <span
                key={i}
                className="absolute bottom-0 flex flex-col items-center"
                style={{ left: `${left}%`, width: `${width}%` }}
              >
                <span className="lf-caption text-content-muted tabular-nums">+{format(jump.value)}</span>
                <span className="h-2 w-full rounded-t-full border-x-2 border-t-2 border-accent/70" />
              </span>
            );
          })}
        </div>
        <div className="relative h-1.5 rounded-full bg-accent-soft">
          {board.stops.map((stop, i) => (
            <span
              key={i}
              className="absolute top-1/2 flex flex-col items-center gap-1"
              style={{ left: `${board.positions[i]! * 100}%`, transform: 'translate(-50%, -50%)' }}
            >
              <span className="h-3 w-3 shrink-0 rounded-full bg-accent ring-2 ring-surface" />
              <span className="lf-caption whitespace-nowrap text-content tabular-nums">{format(stop)}</span>
            </span>
          ))}
        </div>
        <div className="h-5" />
      </div>
    </WhiteboardShell>
  );
}

/**
 * `kind: 'array'` — rows by columns. Multiplying, sharing and unit price are one
 * rectangle read three ways. `total` is server-computed (`computeArray`).
 */
function ArrayBoard({ board, seq, className }: { board: ArrayWire; seq: number; className?: string }) {
  const { t } = useTranslation();
  const format = useValueFormat(board.currency);
  const ariaLabel = `${board.label}. ${board.rows} x ${board.columns}. ${t('tutor.whiteboard.board.total', {
    amount: format(board.total),
  })}`;
  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${board.columns}, minmax(0, 1fr))` }}
          aria-hidden="true"
        >
          {Array.from({ length: board.cells }, (_, i) => (
            <span key={i} className="h-7 w-7 rounded-sm border border-accent bg-accent/40" />
          ))}
        </div>
        <p className="lf-caption shrink-0 text-center text-content-muted" aria-hidden="true">
          {t('tutor.whiteboard.board.total', { amount: format(board.total) })}
        </p>
      </div>
    </WhiteboardShell>
  );
}

/**
 * `kind: 'fraction_strip'` — the same whole cut different ways and stacked, so
 * an equivalence is read by looking down a column rather than recalled as a rule.
 */
function FractionStripBoard({ board, seq, className }: { board: FractionStripWire; seq: number; className?: string }) {
  const ariaLabel = `${board.label}. ${board.rows.map((r) => `${r.highlighted}/${r.denominator}`).join(', ')}`;
  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-2 px-2" aria-hidden="true">
        {board.rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="flex h-7 flex-1 overflow-hidden rounded-md border border-content-muted/30">
              {Array.from({ length: row.denominator }, (_, piece) => (
                <span
                  key={piece}
                  className={cn(
                    'h-full min-w-0 flex-1 border-r border-surface last:border-r-0',
                    piece < row.highlighted ? 'bg-accent/70' : 'bg-content-muted/15',
                  )}
                />
              ))}
            </div>
            <AxisCaption className="w-12 shrink-0 text-right tabular-nums">
              {row.highlighted}/{row.denominator}
            </AxisCaption>
          </div>
        ))}
      </div>
    </WhiteboardShell>
  );
}

/**
 * `kind: 'partition'` — one amount shared two or three different ways, so "a
 * bigger bottom number means a smaller piece" is watched rather than asserted.
 * What one piece is worth in each split is server-computed (`computePartition`).
 */
function PartitionBoard({ board, seq, className }: { board: PartitionWire; seq: number; className?: string }) {
  const { t } = useTranslation();
  const format = useValueFormat(board.currency);
  const ariaLabel = `${board.label}. ${format(board.whole)}. ${board.splits
    .map((split, i) => `${split.label}: ${t('tutor.whiteboard.board.piece', { amount: format(board.pieceValues[i]!) })}`)
    .join(', ')}`;
  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-3 px-2">
        {board.splits.map((split, i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="flex h-7 overflow-hidden rounded-md border border-content-muted/30" aria-hidden="true">
              {Array.from({ length: split.denominator }, (_, piece) => (
                <span
                  key={piece}
                  className={cn(
                    'h-full min-w-0 flex-1 border-r border-surface last:border-r-0',
                    // Exactly ONE piece highlighted per split: the move asks to
                    // "take exactly ONE piece from each and set them side by side".
                    piece === 0 ? 'bg-accent/70' : 'bg-content-muted/15',
                  )}
                />
              ))}
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <Caption>{split.label}</Caption>
              <AxisCaption>{t('tutor.whiteboard.board.piece', { amount: format(board.pieceValues[i]!) })}</AxisCaption>
            </div>
          </div>
        ))}
      </div>
    </WhiteboardShell>
  );
}


/** A small chip used by several of the classification boards below. */
function Chip({ children, tone = 'muted' }: { children: ReactNode; tone?: 'accent' | 'muted' }) {
  return (
    <span
      className={cn(
        'lf-caption max-w-[9rem] truncate rounded-full border px-2.5 py-1',
        tone === 'accent' ? 'border-accent bg-accent/15 text-content' : 'border-content-muted/40 text-content-muted',
      )}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}

/**
 * `kind: 'table'` — options compared on PRICE PER UNIT, which is the comparison
 * `money.unit-price` is about and the one `highest-price-wins` gets wrong.
 * `unitPrices` and the winner are server-computed (`computeTable`).
 */
function TableBoard({ board, seq, className }: { board: TableWire; seq: number; className?: string }) {
  const { t } = useTranslation();
  const format = useValueFormat(board.currency);
  const ariaLabel = `${board.label}. ${board.options
    .map((o, i) => `${o.label}: ${format(o.price)}, ${t('tutor.whiteboard.board.perUnit', { amount: format(board.unitPrices[i]!) })}`)
    .join('. ')}`;
  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-1.5 px-2" aria-hidden="true">
        {board.options.map((option, i) => (
          <div
            key={i}
            className={cn(
              'flex items-baseline justify-between gap-2 rounded-md px-2 py-1.5',
              i === board.bestIndex ? 'bg-accent/15 ring-1 ring-accent' : 'bg-content-muted/5',
            )}
          >
            <Caption className="text-left">{option.label}</Caption>
            <span className="flex shrink-0 items-baseline gap-2">
              <AxisCaption className="tabular-nums">{format(option.price)}</AxisCaption>
              <span className="lf-number text-content tabular-nums">
                {t('tutor.whiteboard.board.perUnit', { amount: format(board.unitPrices[i]!) })}
              </span>
            </span>
          </div>
        ))}
      </div>
    </WhiteboardShell>
  );
}

/**
 * `kind: 'scale'` — a balance that tips. `compare` asks which is more; this asks
 * whether two things are fair to each other, which is what `biz.cost-vs-price`
 * and `biz.value-of-work` actually need. `tilt` is server-computed.
 */
function ScaleBoard({ board, seq, className }: { board: ScaleWire; seq: number; className?: string }) {
  const { t } = useTranslation();
  const format = useValueFormat(board.currency);
  const ariaLabel = `${board.label}. ${board.left.label}: ${format(board.left.value)}, ${board.right.label}: ${format(
    board.right.value,
  )}${board.tilt === 'level' ? `. ${t('tutor.whiteboard.board.fair')}` : ''}`;
  const angle = board.tilt === 'level' ? 0 : board.tilt === 'left' ? -8 : 8;
  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2" aria-hidden="true">
        <div className="relative flex h-28 w-full max-w-xs items-start justify-center">
          {/*
            The BEAM is what makes this a balance rather than two floating
            trays: it spans the full width inside the rotating group, so the
            pans hang from its ends and the tilt is read off the beam's own
            angle. Without it the first version drew two tilted pans with
            nothing between them, which reads as ambiguous rather than as
            weighing.
          */}
          <div
            className="absolute left-0 right-0 top-2 origin-center transition-transform duration-500"
            style={{ transform: `rotate(${angle}deg)` }}
          >
            <div className="h-1.5 w-full rounded-full bg-accent/70" />
            <div className="flex w-full justify-between">
              {[board.left, board.right].map((side, i) => (
                <span key={i} className="flex w-24 flex-col items-center">
                  {/* The hanger, so a pan is attached to the beam rather than near it. */}
                  <span className="h-4 w-0.5 bg-content-muted/50" />
                  <span className="flex h-10 w-full items-center justify-center rounded-b-lg border-2 border-t-0 border-accent/60 bg-surface">
                    <span className="lf-number text-content tabular-nums">{format(side.value)}</span>
                  </span>
                </span>
              ))}
            </div>
          </div>
          {/* The pillar and its base, which do not tip. */}
          <span className="absolute bottom-0 left-1/2 h-24 w-1.5 -translate-x-1/2 rounded-full bg-content-muted/40" />
          <span className="absolute bottom-0 left-1/2 h-1.5 w-16 -translate-x-1/2 rounded-full bg-content-muted/40" />
        </div>
        <div className="flex w-full max-w-xs justify-between gap-2">
          <Caption>{board.left.label}</Caption>
          <Caption>{board.right.label}</Caption>
        </div>
      </div>
    </WhiteboardShell>
  );
}

/**
 * `kind: 'two_bins'` — ungraded classification performed WHILE the tutor talks.
 * The Lesson Engine's sorting activities are graded and stop the conversation to
 * score; this does not. `computeTwoBins` refuses a sort with an empty bin.
 */
function TwoBinsBoard({ board, seq, className }: { board: TwoBinsWire; seq: number; className?: string }) {
  const ariaLabel = `${board.label}. ${board.binLabels
    .map((bin, b) => `${bin}: ${board.items.filter((i) => i.bin === b).map((i) => i.label).join(', ')}`)
    .join('. ')}`;
  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      <div className="flex min-h-0 flex-1 items-stretch justify-center gap-3 px-2" aria-hidden="true">
        {board.binLabels.map((bin, b) => (
          <div key={b} className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex min-h-0 flex-1 flex-wrap content-start justify-center gap-1 rounded-md border-2 border-dashed border-content-muted/40 p-2">
              {board.items
                .filter((item) => item.bin === b)
                .map((item, i) => (
                  <Chip key={i} tone={b === 0 ? 'accent' : 'muted'}>
                    {item.label}
                  </Chip>
                ))}
            </div>
            <Caption>{bin}</Caption>
          </div>
        ))}
      </div>
    </WhiteboardShell>
  );
}

/**
 * `kind: 'venn'` — what falls in BOTH. The instrument for `want-feels-like-need`,
 * where a two-bin sort forces a false choice about exactly the cases that
 * confuse a learner most. `computeVenn` refuses an empty overlap.
 */
function VennBoard({ board, seq, className }: { board: VennWire; seq: number; className?: string }) {
  const { t } = useTranslation();
  const regions: { key: 'left' | 'both' | 'right'; label: string }[] = [
    { key: 'left', label: board.leftLabel },
    { key: 'both', label: t('tutor.whiteboard.board.both') },
    { key: 'right', label: board.rightLabel },
  ];
  const ariaLabel = `${board.label}. ${regions
    .map((r) => `${r.label}: ${board.items.filter((i) => i.side === r.key).map((i) => i.label).join(', ')}`)
    .join('. ')}`;
  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      <div className="flex min-h-0 flex-1 items-stretch justify-center gap-1 px-2" aria-hidden="true">
        {regions.map((region) => (
          <div key={region.key} className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div
              className={cn(
                'flex min-h-0 flex-1 flex-wrap content-start justify-center gap-1 border-2 border-content-muted/40 p-2',
                region.key === 'left' && 'rounded-l-full border-r-0',
                region.key === 'both' && 'border-x-0 bg-accent/10',
                region.key === 'right' && 'rounded-r-full border-l-0',
              )}
            >
              {board.items
                .filter((item) => item.side === region.key)
                .map((item, i) => (
                  <Chip key={i} tone={region.key === 'both' ? 'accent' : 'muted'}>
                    {item.label}
                  </Chip>
                ))}
            </div>
            <Caption>{region.label}</Caption>
          </div>
        ))}
      </div>
    </WhiteboardShell>
  );
}

/**
 * `kind: 'ranking'` — an ordered list where the ORDER is the server's
 * (`computeRanking`), because putting things in order is the thing being
 * practised and a tie is refused rather than silently broken.
 */
function RankingBoard({ board, seq, className }: { board: RankingWire; seq: number; className?: string }) {
  const format = useValueFormat(board.currency);
  const ordered = board.order.map((i) => board.items[i]!);
  const ariaLabel = `${board.label}. ${ordered.map((item, i) => `${i + 1}. ${item.label}: ${format(item.value)}`).join(', ')}`;
  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-1.5 px-2" aria-hidden="true">
        {ordered.map((item, i) => (
          <div key={i} className="flex items-baseline gap-2 rounded-md bg-content-muted/5 px-2 py-1.5">
            <span className="lf-caption w-5 shrink-0 text-content-muted tabular-nums">{i + 1}</span>
            <Caption className="flex-1 text-left">{item.label}</Caption>
            <AxisCaption className="shrink-0 tabular-nums">{format(item.value)}</AxisCaption>
          </div>
        ))}
      </div>
    </WhiteboardShell>
  );
}

/**
 * `kind: 'outcomes'` — how it ends if it goes well, and if it does not.
 * `write-both-endings.md`: "side by side WHERE BOTH ARE VISIBLE AT ONCE. Two
 * columns, few words." The only board whose content is prose, which is why its
 * `detail` is capped hard and every string on it is moderated.
 */
function OutcomesBoard({ board, seq, className }: { board: OutcomesWire; seq: number; className?: string }) {
  const ariaLabel = `${board.label}. ${board.good.label}: ${board.good.detail}. ${board.bad.label}: ${board.bad.detail}`;
  const columns = [
    { ...board.good, tone: 'good' as const },
    { ...board.bad, tone: 'bad' as const },
  ];
  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      <div className="flex min-h-0 flex-1 items-stretch gap-3 px-2" aria-hidden="true">
        {columns.map((column, i) => (
          <div
            key={i}
            className={cn(
              'flex min-w-0 flex-1 flex-col gap-1.5 rounded-md border-l-4 bg-content-muted/5 p-2.5',
              column.tone === 'good' ? 'border-success' : 'border-warning',
            )}
          >
            <span className="lf-caption font-semibold text-content">{column.label}</span>
            <span className="lf-caption line-clamp-4 break-words text-content-muted">{column.detail}</span>
          </div>
        ))}
      </div>
    </WhiteboardShell>
  );
}

/**
 * `kind: 'trade'` — two parties, each judging their own side. `both-sides-said-
 * yes.md` needs two points of view at once, which no single-quantity board can
 * hold: seeing what each side gave AND got is what makes "both of them wanted
 * this" an observation rather than a claim.
 */
function TradeBoard({ board, seq, className }: { board: TradeWire; seq: number; className?: string }) {
  const sides = [board.left, board.right];
  const ariaLabel = `${board.label}. ${sides.map((s) => `${s.who}: ${s.gives} → ${s.gets}`).join('. ')}`;
  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      <div className="flex min-h-0 flex-1 items-center justify-center gap-2 px-2" aria-hidden="true">
        {sides.map((side, i) => (
          <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-md bg-content-muted/5 p-2.5">
            <span className="lf-caption font-semibold text-content">{side.who}</span>
            <Chip>{side.gives}</Chip>
            <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true" className="shrink-0 text-accent">
              <path d="M2 7 h12 M10 3 l4 4 l-4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <Chip tone="accent">{side.gets}</Chip>
          </div>
        ))}
      </div>
    </WhiteboardShell>
  );
}

/**
 * `kind: 'chance'` — likelihood as AREA, so "usually fine, sometimes not" is
 * visible without asking a nine-year-old to read a percentage. The model gives
 * plain weights; `computeChance` normalises them.
 */
function ChanceBoard({ board, seq, className }: { board: ChanceWire; seq: number; className?: string }) {
  const ariaLabel = `${board.label}. ${board.outcomes
    .map((o, i) => `${o.label}: ${Math.round(board.shares[i]! * 100)}%`)
    .join(', ')}`;
  const tones = ['bg-accent/70', 'bg-content-muted/40', 'bg-accent/30'];
  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-2 px-2" aria-hidden="true">
        <div className="flex h-9 w-full overflow-hidden rounded-md">
          {board.shares.map((share, i) => (
            <span
              key={i}
              className={cn('h-full min-w-0 border-r border-surface last:border-r-0', tones[i % tones.length])}
              style={{ width: `${share * 100}%` }}
            />
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
          {board.outcomes.map((outcome, i) => (
            <span key={i} className="flex min-w-0 items-baseline gap-1.5">
              <Caption>{outcome.label}</Caption>
              <AxisCaption className="tabular-nums">{Math.round(board.shares[i]! * 100)}%</AxisCaption>
            </span>
          ))}
        </div>
      </div>
    </WhiteboardShell>
  );
}


/** `kind: 'deal'` — the share AND the leftover, which is the part `categories` hides. */
function DealBoard({ board, seq, className }: { board: DealWire; seq: number; className?: string }) {
  const { t } = useTranslation();
  const ariaLabel = `${board.label}. ${t('tutor.whiteboard.board.eachGets', { count: board.perBin })}. ${t(
    'tutor.whiteboard.board.leftOver',
    { count: board.remainder },
  )}`;
  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-3 px-2" aria-hidden="true">
        <div className="flex items-stretch justify-center gap-2">
          {board.bins.map((bin, b) => (
            <div key={b} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full flex-wrap content-end justify-center gap-1 rounded-md border-2 border-dashed border-content-muted/40 p-1.5">
                {Array.from({ length: board.perBin }, (_, i) => (
                  <span key={i} className="h-4 w-4 rounded-full bg-accent/70" />
                ))}
              </div>
              <Caption>{bin}</Caption>
            </div>
          ))}
        </div>
        {/* The remainder sits APART, which is the whole point — it is not nothing. */}
        {board.remainder > 0 && (
          <div className="flex items-center justify-center gap-2">
            <span className="flex gap-1">
              {Array.from({ length: board.remainder }, (_, i) => (
                <span key={i} className="h-4 w-4 rounded-full border-2 border-warning bg-warning/30" />
              ))}
            </span>
            <AxisCaption>{t('tutor.whiteboard.board.leftOver', { count: board.remainder })}</AxisCaption>
          </div>
        )}
      </div>
    </WhiteboardShell>
  );
}

/** `kind: 'change'` — one payment splitting into two piles. */
function ChangeBoard({ board, seq, className }: { board: ChangeWire; seq: number; className?: string }) {
  const { t } = useTranslation();
  const format = useValueFormat(board.currency);
  const ariaLabel = `${board.label}. ${format(board.paid)} → ${format(board.price)}. ${t(
    'tutor.whiteboard.board.change',
    { amount: format(board.change) },
  )}`;
  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2" aria-hidden="true">
        <span className="flex h-12 w-28 items-center justify-center rounded-md border-2 border-accent bg-accent/15">
          <span className="lf-number lf-title text-content tabular-nums">{format(board.paid)}</span>
        </span>
        <svg width="120" height="24" viewBox="0 0 120 24" aria-hidden="true" className="shrink-0 text-content-muted/50">
          <path d="M60 2 L26 22 M60 2 L94 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <div className="flex items-start gap-4">
          {[
            { value: board.price, tone: 'muted' as const },
            { value: board.change, tone: 'accent' as const },
          ].map((pile, i) => (
            <span key={i} className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  'flex h-10 w-24 items-center justify-center rounded-md border-2',
                  pile.tone === 'accent' ? 'border-accent bg-accent/15' : 'border-content-muted/40',
                )}
              >
                <span className="lf-number text-content tabular-nums">{format(pile.value)}</span>
              </span>
            </span>
          ))}
        </div>
        <AxisCaption>{t('tutor.whiteboard.board.change', { amount: format(board.change) })}</AxisCaption>
      </div>
    </WhiteboardShell>
  );
}

/** `kind: 'regroup'` — one unit broken into many, as a visible step of the problem. */
function RegroupBoard({ board, seq, className }: { board: RegroupWire; seq: number; className?: string }) {
  const format = useValueFormat(board.currency);
  const ariaLabel = `${board.label}. ${board.fromCount} x ${format(board.fromDenomination)} → ${board.intoCount} x ${format(
    board.intoDenomination,
  )}`;
  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      <div className="flex min-h-0 flex-1 items-center justify-center gap-3 px-2" aria-hidden="true">
        <span className="flex flex-wrap justify-center gap-1">
          {Array.from({ length: board.fromCount }, (_, i) => (
            <Token key={i} size="md">
              {format(board.fromDenomination)}
            </Token>
          ))}
        </span>
        <svg width="24" height="16" viewBox="0 0 24 16" aria-hidden="true" className="shrink-0 text-accent">
          <path d="M2 8 h16 M14 3 l5 5 l-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="flex max-w-[55%] flex-wrap justify-center gap-1">
          {Array.from({ length: board.intoCount }, (_, i) => (
            <Token key={i} size="sm" tone="muted">
              {format(board.intoDenomination)}
            </Token>
          ))}
        </span>
      </div>
    </WhiteboardShell>
  );
}

/** `kind: 'equation_bar'` — two sides as lengths that match, because the server refused any board where they do not. */
function EquationBarBoard({ board, seq, className }: { board: EquationBarWire; seq: number; className?: string }) {
  const format = useValueFormat(board.currency);
  const sides = [board.left, board.right];
  const ariaLabel = `${board.label}. ${sides
    .map((side) => side.map((t) => `${t.label} ${format(t.value)}`).join(' + '))
    .join(' = ')}`;
  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-3 px-2" aria-hidden="true">
        {sides.map((side, i) => (
          <div key={i} className="flex flex-col gap-1">
            <HBar segments={side.map((term) => ({ fraction: term.value / Math.max(board.total, 1) }))} />
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {side.map((term, j) => (
                <span key={j} className="flex min-w-0 items-baseline gap-1.5">
                  <Caption>{term.label}</Caption>
                  <AxisCaption className="tabular-nums">{format(term.value)}</AxisCaption>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </WhiteboardShell>
  );
}

/** `kind: 'receipt'` — the document a child has already seen, written line by line to a total. */
function ReceiptBoard({ board, seq, className }: { board: ReceiptWire; seq: number; className?: string }) {
  const { t } = useTranslation();
  const format = useValueFormat(board.currency);
  const ariaLabel = `${board.label}. ${board.lines
    .map((l) => `${l.label}: ${format(l.value)}`)
    .join(', ')}. ${t('tutor.whiteboard.board.total', { amount: format(board.total) })}`;
  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      <div className="flex min-h-0 flex-1 items-center justify-center" aria-hidden="true">
        <div className="flex w-full max-w-[16rem] flex-col gap-1 rounded-sm border border-content-muted/30 bg-surface p-3">
          {board.lines.map((line, i) => (
            <div key={i} className="flex items-baseline justify-between gap-2">
              <Caption className="text-left">{line.label}</Caption>
              <AxisCaption className="shrink-0 tabular-nums">{format(line.value)}</AxisCaption>
            </div>
          ))}
          <div className="mt-1 flex items-baseline justify-between gap-2 border-t border-dashed border-content-muted/40 pt-1.5">
            <span className="lf-caption font-semibold text-content">{t('tutor.whiteboard.board.totalWord')}</span>
            <span className="lf-number lf-title text-content tabular-nums">{format(board.total)}</span>
          </div>
        </div>
      </div>
    </WhiteboardShell>
  );
}

/** `kind: 'ledger'` — two columns and a running balance, every step server-computed. */
function LedgerBoard({ board, seq, className }: { board: LedgerWire; seq: number; className?: string }) {
  const { t } = useTranslation();
  const format = useValueFormat(board.currency);
  const ariaLabel = `${board.label}. ${board.entries
    .map((e, i) => `${e.label} ${e.direction === 'in' ? '+' : '−'}${format(e.amount)} → ${format(board.balances[i]!)}`)
    .join(', ')}`;
  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-1 px-2" aria-hidden="true">
        <div className="flex items-baseline justify-between gap-2 border-b border-content-muted/30 pb-1">
          <span className="lf-caption text-content-muted">&nbsp;</span>
          <span className="lf-caption shrink-0 text-content-muted">{t('tutor.whiteboard.board.balance')}</span>
        </div>
        {board.entries.map((entry, i) => (
          <div key={i} className="flex items-baseline justify-between gap-2">
            <span className="flex min-w-0 items-baseline gap-1.5">
              <span className={cn('lf-caption shrink-0 tabular-nums', entry.direction === 'in' ? 'text-success' : 'text-warning')}>
                {entry.direction === 'in' ? '+' : '−'}
                {format(entry.amount)}
              </span>
              <Caption className="text-left">{entry.label}</Caption>
            </span>
            <AxisCaption className="shrink-0 tabular-nums">{format(board.balances[i]!)}</AxisCaption>
          </div>
        ))}
      </div>
    </WhiteboardShell>
  );
}

/** `kind: 'price_tag'` — price, quantity and discount on one object, where the decision happens. */
function PriceTagBoard({ board, seq, className }: { board: PriceTagWire; seq: number; className?: string }) {
  const { t } = useTranslation();
  const format = useValueFormat(board.currency);
  const ariaLabel = `${board.label}. ${board.item}: ${format(board.finalPrice)}. ${t(
    'tutor.whiteboard.board.perUnit',
    { amount: format(board.unitPrice) },
  )}`;
  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      <div className="flex min-h-0 flex-1 items-center justify-center" aria-hidden="true">
        <div className="flex min-w-[12rem] flex-col items-center gap-1 rounded-md border-2 border-accent bg-accent/10 px-5 py-3">
          <Caption>{board.item}</Caption>
          <span className="flex items-baseline gap-2">
            {board.discountPercent !== null && (
              <span className="lf-caption text-content-muted line-through tabular-nums">{format(board.price)}</span>
            )}
            <span className="lf-number lf-title text-content tabular-nums">{format(board.finalPrice)}</span>
          </span>
          {board.discountPercent !== null && (
            <span className="lf-caption rounded-full bg-warning-soft px-2 py-0.5 text-content">
              −{board.discountPercent}%
            </span>
          )}
          <AxisCaption>{t('tutor.whiteboard.board.perUnit', { amount: format(board.unitPrice) })}</AxisCaption>
        </div>
      </div>
    </WhiteboardShell>
  );
}

/** `kind: 'inventory'` — stock falling as sales happen: selling is exchanging, not only receiving. */
function InventoryBoard({ board, seq, className }: { board: InventoryWire; seq: number; className?: string }) {
  const { t } = useTranslation();
  const ariaLabel = `${board.label}. ${board.item}. ${t('tutor.whiteboard.board.stillHave', { count: board.left })}`;
  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-2" aria-hidden="true">
        <div className="flex max-w-full flex-wrap justify-center gap-1">
          {Array.from({ length: board.start }, (_, i) => (
            <span
              key={i}
              className={cn(
                'h-5 w-5 rounded-sm border',
                i < board.left ? 'border-accent bg-accent/60' : 'border-content-muted/30 bg-transparent',
              )}
            />
          ))}
        </div>
        <div className="flex items-baseline gap-2">
          <Caption>{board.item}</Caption>
          <AxisCaption>{t('tutor.whiteboard.board.stillHave', { count: board.left })}</AxisCaption>
        </div>
      </div>
    </WhiteboardShell>
  );
}

/**
 * `kind: 'budget_plate'` — a total against a visible ceiling.
 *
 * The ONE board that draws a rule being broken rather than refusing it:
 * `budget-is-per-item` can only be dislodged by letting the learner watch the
 * total cross the line, so `computeBudgetPlate` allows an overspend and this
 * draws the part that went past.
 */
function BudgetPlateBoard({ board, seq, className }: { board: BudgetPlateWire; seq: number; className?: string }) {
  const { t } = useTranslation();
  const format = useValueFormat(board.currency);
  const scale = Math.max(board.budget, board.spent);
  const ariaLabel = `${board.label}. ${board.items.map((i) => `${i.label}: ${format(i.value)}`).join(', ')}. ${
    board.overBy > 0
      ? t('tutor.whiteboard.board.over', { amount: format(board.overBy) })
      : t('tutor.whiteboard.board.remaining', { amount: format(board.remaining) })
  }`;
  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-2 px-2" aria-hidden="true">
        <div className="relative">
          <HBar
            segments={[
              ...board.items.map((item) => ({ fraction: item.value / scale })),
              { fraction: Math.max(0, board.budget - board.spent) / scale, tone: 'muted' as const },
            ]}
          />
          {/* The ceiling, drawn ON the bar so an overspend is visibly past it. */}
          <span
            className="absolute inset-y-0 w-0.5 bg-warning"
            style={{ left: `${(board.budget / scale) * 100}%` }}
          />
        </div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {board.items.map((item, i) => (
            <span key={i} className="flex min-w-0 items-baseline gap-1.5">
              <Caption>{item.label}</Caption>
              <AxisCaption className="tabular-nums">{format(item.value)}</AxisCaption>
            </span>
          ))}
        </div>
        <p className={cn('lf-caption shrink-0 text-center', board.overBy > 0 ? 'text-warning' : 'text-content-muted')}>
          {board.overBy > 0
            ? t('tutor.whiteboard.board.over', { amount: format(board.overBy) })
            : t('tutor.whiteboard.board.remaining', { amount: format(board.remaining) })}
        </p>
      </div>
    </WhiteboardShell>
  );
}


/** `kind: 'pictograph'` — quantity as a count of figures, for readers a bar chart cannot reach yet. */
function PictographBoard({ board, seq, className }: { board: PictographWire; seq: number; className?: string }) {
  const format = useValueFormat(board.currency);
  const ariaLabel = `${board.label}. ${board.rows.map((r, i) => `${r.label}: ${format(board.totals[i]!)}`).join(', ')}`;
  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-2 px-2" aria-hidden="true">
        {board.rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <Caption className="w-20 shrink-0 text-left">{row.label}</Caption>
            <span className="flex min-w-0 flex-wrap gap-1">
              {Array.from({ length: row.count }, (_, n) => (
                <span key={n} className="h-4 w-4 rounded-sm bg-accent/70" />
              ))}
            </span>
            <AxisCaption className="shrink-0 tabular-nums">{format(board.totals[i]!)}</AxisCaption>
          </div>
        ))}
      </div>
    </WhiteboardShell>
  );
}

/** `kind: 'bead_string'` — a quantity as a POSITION you slide along, the sibling of the ten frame. */
function BeadStringBoard({ board, seq, className }: { board: BeadStringWire; seq: number; className?: string }) {
  const ariaLabel = `${board.label}. ${board.count}`;
  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2" aria-hidden="true">
        {board.rows.map((filled, r) => (
          <div key={r} className="flex items-center gap-1">
            {Array.from({ length: 10 }, (_, i) => (
              <span
                key={i}
                className={cn(
                  'h-5 w-5 rounded-full border-2',
                  // Fives are grouped by tone, which is the whole reason a bead
                  // string reads faster than counting.
                  i < filled
                    ? i < 5
                      ? 'border-accent bg-accent/70'
                      : 'border-accent bg-accent/35'
                    : 'border-content-muted/30 bg-transparent',
                  i === 5 && 'ml-2',
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </WhiteboardShell>
  );
}

/** `kind: 'tally'` — a count being KEPT rather than reported. */
function TallyBoard({ board, seq, className }: { board: TallyWire; seq: number; className?: string }) {
  const ariaLabel = `${board.label}. ${board.groups.map((g) => `${g.label}: ${g.count}`).join(', ')}`;
  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-2 px-2" aria-hidden="true">
        {board.groups.map((group, i) => {
          const [fives, singles] = board.fives[i]!;
          return (
            <div key={i} className="flex items-center gap-2">
              <Caption className="w-20 shrink-0 text-left">{group.label}</Caption>
              <span className="flex min-w-0 flex-wrap items-center gap-2">
                {Array.from({ length: fives }, (_, f) => (
                  <svg key={`f${f}`} width="22" height="18" viewBox="0 0 22 18" className="shrink-0 text-accent">
                    <path
                      d="M3 2 v14 M8 2 v14 M13 2 v14 M18 2 v14 M1 15 L20 3"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      fill="none"
                    />
                  </svg>
                ))}
                {Array.from({ length: singles }, (_, n) => (
                  <span key={`s${n}`} className="h-4 w-0.5 rounded-full bg-accent" />
                ))}
              </span>
              <AxisCaption className="shrink-0 tabular-nums">{group.count}</AxisCaption>
            </div>
          );
        })}
      </div>
    </WhiteboardShell>
  );
}

/** `kind: 'fraction_circle'` — the slice of cake every child already owns. */
function FractionCircleBoard({ board, seq, className }: { board: FractionCircleWire; seq: number; className?: string }) {
  const ariaLabel = `${board.label}. ${board.highlighted}/${board.denominator}`;
  const R = 46;
  const slice = (i: number) => {
    const a0 = (i / board.denominator) * 2 * Math.PI - Math.PI / 2;
    const a1 = ((i + 1) / board.denominator) * 2 * Math.PI - Math.PI / 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M50 50 L${50 + R * Math.cos(a0)} ${50 + R * Math.sin(a0)} A${R} ${R} 0 ${large} 1 ${
      50 + R * Math.cos(a1)
    } ${50 + R * Math.sin(a1)} Z`;
  };
  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2" aria-hidden="true">
        <svg width="120" height="120" viewBox="0 0 100 100" className="shrink-0">
          {Array.from({ length: board.denominator }, (_, i) => (
            <path
              key={i}
              d={slice(i)}
              className={i < board.highlighted ? 'fill-accent/70' : 'fill-transparent'}
              stroke="currentColor"
              strokeWidth="1.5"
              // The token colour, so the outline reads in both themes.
              style={{ color: 'rgb(var(--lf-content-muted) / 0.45)' }}
            />
          ))}
        </svg>
        <AxisCaption className="tabular-nums">
          {board.highlighted}/{board.denominator}
        </AxisCaption>
      </div>
    </WhiteboardShell>
  );
}

/** `kind: 'stack'` — totals compared by what they are MADE OF, not only by size. */
function StackBoard({ board, seq, className }: { board: StackWire; seq: number; className?: string }) {
  const format = useValueFormat(board.currency);
  const ariaLabel = `${board.label}. ${board.columns
    .map((c, i) => `${c.label}: ${format(board.totals[i]!)} (${c.parts.map((p) => `${p.label} ${format(p.value)}`).join(', ')})`)
    .join('. ')}`;
  const tones = ['bg-accent/70', 'bg-accent/40', 'bg-content-muted/30'];
  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      <BoardRow gap="lg" justify="center">
        {board.columns.map((column, c) => (
          <BarColumn key={c} minWidth="5rem" maxWidth="10rem">
            <ValueLabel>{format(board.totals[c]!)}</ValueLabel>
            <div className="flex w-full min-h-0 flex-1 flex-col-reverse items-end">
              {column.parts.map((part, i) => (
                <div
                  key={i}
                  className={cn('w-full first:rounded-b-md last:rounded-t-md', tones[i % tones.length])}
                  style={{ height: `${(part.value / Math.max(board.max, 1)) * 100}%` }}
                />
              ))}
            </div>
            <Caption>{column.label}</Caption>
          </BarColumn>
        ))}
      </BoardRow>
    </WhiteboardShell>
  );
}

/** `kind: 'sequence_compare'` — two futures at once, which is the only form in which compounding means anything. */
function SequenceCompareBoard({ board, seq, className }: { board: SequenceCompareWire; seq: number; className?: string }) {
  const { t } = useTranslation();
  const format = useValueFormat(board.currency);
  const max = Math.max(...board.values.flat(), 1);
  const steps = board.values[0]!.length;
  const ariaLabel = `${board.label}. ${board.tracks
    .map((track, i) => `${track.label}: ${board.values[i]!.map((v) => format(v)).join(', ')}`)
    .join('. ')}`;
  const tones = ['bg-accent/70', 'bg-content-muted/40'];
  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <BoardRow>
          {Array.from({ length: steps }, (_, i) => (
            <BarColumn key={i} minWidth="3.5rem">
              <ValueLabel>{format(board.values[0]![i]!)}</ValueLabel>
              {/* Two bars per period, side by side, so the gap between the two
                  futures is the thing that grows. */}
              <div className="flex w-full min-h-0 flex-1 items-end gap-0.5">
                {board.values.map((track, tIdx) => (
                  <div
                    key={tIdx}
                    className={cn('min-w-0 flex-1 rounded-t-sm', tones[tIdx % tones.length])}
                    style={{ height: `${barHeightPct(track[i]!, max)}%` }}
                  />
                ))}
              </div>
              <AxisCaption>
                {i === 0 ? t('tutor.whiteboard.start') : t(`tutor.whiteboard.step.${board.unit}`, { n: i })}
              </AxisCaption>
            </BarColumn>
          ))}
        </BoardRow>
        <div className="flex shrink-0 flex-wrap justify-center gap-x-4 gap-y-1" aria-hidden="true">
          {board.tracks.map((track, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span className={cn('h-2.5 w-2.5 shrink-0 rounded-sm', tones[i % tones.length])} />
              <Caption>{track.label}</Caption>
            </span>
          ))}
        </div>
      </div>
    </WhiteboardShell>
  );
}

/** `kind: 'timeline'` — WHEN, not how much. Money on the 15th and a bill on the 10th is a problem of order. */
function TimelineBoard({ board, seq, className }: { board: TimelineWire; seq: number; className?: string }) {
  const { t } = useTranslation();
  const ariaLabel = `${board.label}. ${board.events
    .map((e) => `${t(`tutor.whiteboard.step.${board.unit}`, { n: e.at })}: ${e.label}`)
    .join(', ')}`;
  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-3 px-6" aria-hidden="true">
        <div className="relative h-1.5 rounded-full bg-accent-soft">
          {board.events.map((event, i) => (
            <span
              key={i}
              className="absolute top-1/2 flex flex-col items-center gap-1"
              style={{ left: `${board.positions[i]! * 100}%`, transform: 'translate(-50%, -50%)' }}
            >
              <span className="lf-caption whitespace-nowrap text-content-muted tabular-nums">
                {t(`tutor.whiteboard.step.${board.unit}`, { n: event.at })}
              </span>
              <span className="h-3 w-3 shrink-0 rounded-full bg-accent ring-2 ring-surface" />
            </span>
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
          {board.events.map((event, i) => (
            <Caption key={i} className="max-w-[10rem]">
              {event.label}
            </Caption>
          ))}
        </div>
      </div>
    </WhiteboardShell>
  );
}

/** `kind: 'cycle'` — a loop that comes back. Every other board draws something that ends; a business does not. */
function CycleBoard({ board, seq, className }: { board: CycleWire; seq: number; className?: string }) {
  const ariaLabel = `${board.label}. ${board.steps.join(' → ')} → ${board.steps[0]}`;
  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      <div className="flex min-h-0 flex-1 flex-wrap items-center justify-center gap-1.5 px-2" aria-hidden="true">
        {board.steps.map((step, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <Chip tone="accent">{step}</Chip>
            <svg width="16" height="12" viewBox="0 0 16 12" className="shrink-0 text-content-muted">
              <path d="M1 6 h11 M9 2 l4 4 l-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        ))}
        {/* The loop closes: the first step again, dimmed, so the arrow returns. */}
        <Chip>{board.steps[0]}</Chip>
      </div>
    </WhiteboardShell>
  );
}

/** `kind: 'before_after'` — what changed, and what stayed the same. The change is server-computed. */
function BeforeAfterBoard({ board, seq, className }: { board: BeforeAfterWire; seq: number; className?: string }) {
  const { t } = useTranslation();
  const format = useValueFormat(board.currency);
  const summary =
    board.direction === 'same'
      ? t('tutor.whiteboard.board.noChange')
      : t('tutor.whiteboard.board.changedBy', { amount: format(board.delta) });
  const ariaLabel = `${board.label}. ${board.what}. ${t('tutor.whiteboard.board.was', {
    amount: format(board.before),
  })}, ${t('tutor.whiteboard.board.now', { amount: format(board.after) })}. ${summary}`;
  return (
    <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-2" aria-hidden="true">
        <Caption>{board.what}</Caption>
        <div className="flex items-center gap-3">
          {[
            { value: board.before, key: 'was' as const, tone: 'muted' as const },
            { value: board.after, key: 'now' as const, tone: 'accent' as const },
          ].map((state, i) => (
            <span key={i} className="flex items-center gap-3">
              {i === 1 && (
                <svg width="22" height="14" viewBox="0 0 22 14" className="shrink-0 text-accent">
                  <path d="M1 7 h16 M14 2 l5 5 l-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              <span
                className={cn(
                  'flex h-14 w-24 items-center justify-center rounded-md border-2',
                  state.tone === 'accent' ? 'border-accent bg-accent/15' : 'border-content-muted/40',
                )}
              >
                <span className="lf-number lf-title text-content tabular-nums">{format(state.value)}</span>
              </span>
            </span>
          ))}
        </div>
        <AxisCaption>{summary}</AxisCaption>
      </div>
    </WhiteboardShell>
  );
}

/**
 * `kind: 'grab'` — Class II, S9 (/TUTOR_INSTRUMENTS.md §3.3): "drags tokens,
 * chips and labels into piles, bins or cells." The ONE interactive board in
 * the whole catalog — every sibling is a picture of a finished state; this
 * is finished by the LEARNER, tap by tap, which is why `WhiteboardShell`
 * renders it with `interactive` (`role="group"`, not `role="img"` — see that
 * prop's own comment).
 *
 * TAP-TO-SELECT, TAP-TO-PLACE — the Lesson Engine's own `SortingBoard`
 * pattern (`lesson-engine/families/arrange/components.tsx`), minus its
 * native pointer-drag half. `SortingBoard` is a GRADED exercise widget and
 * earns that extra machinery; this is an ungraded aside the tutor draws
 * mid-conversation, and touch drag-and-drop is exactly the interaction class
 * that reads worst on a phone, which is most of this product's real traffic
 * (§3.3's own reasoning, in `WhiteboardGrabSchema`'s comment).
 *
 * UNGRADED BY CONSTRUCTION: `assignments` is local component state, reset on
 * every new `seq` like the rest of this file, and never leaves the browser —
 * no draft, no submission, no verdict. Identity is ARRAY POSITION, matching
 * `WhiteboardGrabSchema`'s own comment on why the schema carries no item id.
 */
function GrabBoard({ board, seq, className }: { board: GrabWire; seq: number; className?: string }) {
  const { t } = useTranslation();
  const [assignments, setAssignments] = useState<Record<number, number>>({});
  const [selected, setSelected] = useState<number | null>(null);

  // Reset on a genuinely new board, in render rather than an effect — the
  // same reason `SequenceBoard` does (a bad frame is never painted).
  const [resetSeq, setResetSeq] = useState(seq);
  if (seq !== resetSeq) {
    setResetSeq(seq);
    setAssignments({});
    setSelected(null);
  }

  const selectItem = (item: number) => setSelected((prev) => (prev === item ? null : item));
  const placeInBin = (bin: number) => {
    if (selected === null) return;
    setAssignments((prev) => ({ ...prev, [selected]: bin }));
    setSelected(null);
  };
  const unassign = (item: number) => {
    setAssignments((prev) => {
      const next = { ...prev };
      delete next[item];
      return next;
    });
    setSelected(null);
  };

  const unassignedIndexes = board.items.map((_, i) => i).filter((i) => !(i in assignments));

  return (
    <WhiteboardShell seq={seq} label={board.label} className={className} interactive>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-1">
        {unassignedIndexes.length > 0 && (
          <div className="space-y-1.5">
            <p className="lf-caption text-content-muted">{t('tutor.whiteboard.grab.hint')}</p>
            <div className="flex flex-wrap gap-2">
              {unassignedIndexes.map((i) => (
                <button
                  key={i}
                  type="button"
                  aria-pressed={selected === i}
                  onClick={() => selectItem(i)}
                  className={cn(
                    'lf-caption max-w-[9rem] truncate rounded-full border px-2.5 py-1 transition-colors',
                    selected === i
                      ? 'border-primary bg-primary/15 text-content'
                      : 'border-content-muted/40 text-content-muted hover:border-content-muted/70',
                  )}
                >
                  {board.items[i]}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-2">
          {board.binLabels.map((bin, b) => {
            const placed = board.items.map((_, i) => i).filter((i) => assignments[i] === b);
            return (
              <div
                key={b}
                className={cn(
                  'flex min-h-[4.5rem] flex-col gap-1.5 rounded-md border-2 border-dashed p-2 transition-colors',
                  selected !== null ? 'border-primary/60' : 'border-content-muted/40',
                )}
              >
                {/*
                  A SEPARATE tap target from the placed-items group below,
                  deliberately: a <button> may not contain another focusable
                  element, so "tap this bin to place the selected item" and
                  "tap a placed item to take it back" have to be two controls,
                  not one nested inside the other.
                */}
                <button
                  type="button"
                  onClick={() => placeInBin(b)}
                  disabled={selected === null}
                  className="lf-caption -m-1 rounded p-1 text-left font-medium text-content-muted enabled:hover:bg-primary/5 enabled:hover:text-content"
                >
                  {bin}
                </button>
                <div role="group" aria-label={bin} className="flex flex-1 flex-wrap content-start gap-1">
                  {placed.map((i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => unassign(i)}
                      aria-label={t('tutor.whiteboard.grab.unassign', { item: board.items[i] })}
                      className="lf-caption max-w-[9rem] truncate rounded-full border border-accent bg-accent/15 px-2.5 py-1 text-content"
                    >
                      {board.items[i]}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </WhiteboardShell>
  );
}

/**
 * `kind: 'fill'` — Class II, S9 (/TUTOR_INSTRUMENTS.md §3.3): "taps to fill
 * a ten frame, a bar, a jar — counting with a finger." The SECOND
 * interactive board (`interactive` on `WhiteboardShell`, same reasoning as
 * `GrabBoard`'s own comment). `container` only picks the grid's shape — the
 * `ten_frame` cell styling is the EXISTING static `TenFrameBoard`'s own
 * (`h-7 w-7 rounded-full border`, `border-accent bg-accent/70` when filled),
 * reused rather than re-invented, since a filled cell means the same thing
 * whether the model drew it or the learner tapped it there.
 *
 * ORDERED, UNDO-ABLE COUNTING, not free toggling: only the next empty cell
 * (to fill) and the most recently filled cell (to undo) are ever tappable —
 * matching how a real ten-frame or bead jar is actually counted, one at a
 * time, and keeping "how many" always unambiguous from the shape alone.
 */
function FillBoard({ board, seq, className }: { board: FillWire; seq: number; className?: string }) {
  const { t } = useTranslation();
  const [filled, setFilled] = useState(0);

  // Reset on a genuinely new board, in render rather than an effect — the
  // same reason `SequenceBoard` does (a bad frame is never painted).
  const [resetSeq, setResetSeq] = useState(seq);
  if (seq !== resetSeq) {
    setResetSeq(seq);
    setFilled(0);
  }

  const cols = board.container === 'ten_frame' ? 5 : board.container === 'jar' ? 3 : board.capacity;

  return (
    <WhiteboardShell seq={seq} label={board.label} className={className} interactive>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-y-auto px-1">
        <div
          className="grid gap-1.5 rounded-md border-2 border-content-muted/40 p-2"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: board.capacity }, (_, i) => {
            const isFilled = i < filled;
            const isNextToFill = i === filled;
            const isLastFilled = i === filled - 1;
            const tappable = isNextToFill || isLastFilled;
            return (
              <button
                key={i}
                type="button"
                disabled={!tappable}
                onClick={() => setFilled(isLastFilled ? filled - 1 : filled + 1)}
                aria-label={
                  isLastFilled
                    ? t('tutor.whiteboard.fill.undo', { n: i + 1 })
                    : t('tutor.whiteboard.fill.tap', { n: i + 1 })
                }
                className={cn(
                  'h-7 w-7 shrink-0 rounded-full border transition-colors',
                  isFilled ? 'border-accent bg-accent/70' : 'border-content-muted/30 bg-transparent',
                  tappable && !isFilled && 'border-primary/60',
                )}
              />
            );
          })}
        </div>
        <p className="lf-caption text-content-muted" aria-live="polite">
          {t('tutor.whiteboard.fill.count', { filled, capacity: board.capacity })}
        </p>
      </div>
    </WhiteboardShell>
  );
}

/**
 * `kind: 'whatif'` — Class II, S10 (/TUTOR_INSTRUMENTS.md §3.3): "what if I
 * saved more, what if I saved less — the learner tries out branches
 * themselves, one at a time." 2-3 branches sharing ONE starting point
 * (`board.start`), generalizing `sequence_compare`'s two SIMULTANEOUS,
 * side-by-side tracks into branches the learner SWITCHES BETWEEN — the two
 * kinds answer different questions (`sequence_compare`: "how do these two
 * fixed paths differ, seen at once"; `whatif`: "what happens if I choose
 * differently, one path at a time"), which is why this is a new kind rather
 * than a `sequence_compare` variant. `values` is SERVER-COMPUTED
 * (`computeWhatif`, `whiteboard.ts`) — one array per branch, never
 * re-derived here, the same posture every other kind already takes with its
 * own computed fields.
 *
 * NOT `interactive` (unlike `grab`/`fill`): the bars for the active branch
 * are a picture of a finished, server-computed state — same as
 * `SequenceBoard`'s own — nothing about the CHART is learner-authored, only
 * WHICH branch's chart is showing. So the chart itself stays `role="img"`
 * with a full aria-label for the active branch (screen-reader parity with
 * the sighted bars), and the branch switcher is a plain button row rendered
 * as this component's OWN sibling, BEFORE `WhiteboardShell` — the same
 * "meta-control attached to a picture, not part of the picture" reasoning
 * `onAdvance` already applies (see that prop's own comment): a `role="img"`
 * node presents its subtree as the image's own replaced content, which
 * would swallow a nested tab control from assistive tech. Kept local to
 * this one component rather than a new `WhiteboardShell` prop — nothing
 * else in the catalog needs a branch switcher yet, and `WhiteboardShell`
 * already hands back a bare Fragment, so a sibling row ahead of it costs
 * nothing structurally.
 *
 * The Y-axis scale (`max`) is computed across ALL branches, not just the
 * active one — switching tabs must never rescale the chart, or the visual
 * comparison between branches (the entire point of the feature) would be
 * lying by omission.
 */
function WhatifBoard({ board, seq, className }: { board: WhatifWire; seq: number; className?: string }) {
  const { t } = useTranslation();
  const format = useValueFormat(board.currency);
  const [active, setActive] = useState(0);

  // Reset on a genuinely new board, in render rather than an effect — the
  // same reason `SequenceBoard` does (a bad frame is never painted).
  const [resetSeq, setResetSeq] = useState(seq);
  if (seq !== resetSeq) {
    setResetSeq(seq);
    setActive(0);
  }

  // Defense in depth for the same reason `SequenceBoard`'s `safeShown` is:
  // a stale `active` from a wider previous board must never index past a
  // narrower new one for the ONE render where `resetSeq` hasn't caught up
  // yet (see that guard's own comment).
  const safeActive = Math.min(active, board.branches.length - 1);
  const max = Math.max(...board.values.flat(), 1);
  const values = board.values[safeActive]!;
  const captionFor = (i: number) => (i === 0 ? t('tutor.whiteboard.start') : t(`tutor.whiteboard.step.${board.unit}`, { n: i }));
  const ariaLabel = `${board.label}. ${board.branches[safeActive]!.label}: ${values
    .map((value, i) => `${captionFor(i)}: ${format(value)}`)
    .join(', ')}`;

  return (
    <>
      <div className="flex shrink-0 flex-col gap-1.5">
        <p className="lf-caption text-content-muted">{t('tutor.whiteboard.whatif.hint')}</p>
        <div className="flex flex-wrap gap-1.5">
          {board.branches.map((branch, i) => (
            <button
              key={i}
              type="button"
              aria-pressed={i === safeActive}
              onClick={() => setActive(i)}
              className={cn(
                'lf-caption max-w-[10rem] truncate rounded-full border px-2.5 py-1 transition-colors',
                i === safeActive
                  ? 'border-primary bg-primary/15 text-content'
                  : 'border-content-muted/40 text-content-muted hover:border-content-muted/70',
              )}
            >
              {branch.label}
            </button>
          ))}
        </div>
      </div>
      <WhiteboardShell seq={seq} ariaLabel={ariaLabel} label={board.label} className={className}>
        <BoardRow>
          {values.map((value, i) => (
            <BarColumn key={i} minWidth="3.5rem">
              <ValueLabel>{format(value)}</ValueLabel>
              <BarTrack heightPct={barHeightPct(value, max)} />
              <AxisCaption>{captionFor(i)}</AxisCaption>
            </BarColumn>
          ))}
        </BoardRow>
      </WhiteboardShell>
    </>
  );
}

/**
 * `kind: 'your_turn'` — Class II, S10 (/TUTOR_INSTRUMENTS.md §3.3): "the
 * Tutor demonstrates, then hands the instrument over — the scaffold-fade two
 * moves ask for" (`oracle/skills/moves/scaffold-fading.md`'s FULL → LAST STEP
 * THEIRS → FIRST STEP YOURS → ALONE ladder). ONE `sequence`'s worth of
 * `values`, split at `board.givenCount`: the first `givenCount` are the
 * tutor's own contribution, shown on mount; the rest start hidden and the
 * LEARNER reveals them one at a time, tapping — `fill`'s exact ordered,
 * undo-able mechanic, generalized from an empty container to a partly-worked
 * chart. `values` is SERVER-COMPUTED in ONE pass over the WHOLE `steps` list
 * (`computeYourTurn`), so the tutor's shown prefix and the learner's revealed
 * suffix can never disagree arithmetically — there is no second computation
 * for the learner's half to drift from the first.
 *
 * `interactive` (`role="group"`), same as `grab`/`fill` and for the same
 * reason: unlike `whatif`, what is REVEALED is the learner's own doing, tap
 * by tap, not a finished picture with only a viewing choice attached.
 *
 * The tutor's own prefix and the learner's own reveals are colour-coded
 * differently (muted vs. accent) — a deliberate, visible answer to
 * `scaffold-fading.md`'s own instruction to name what the learner did
 * ("Terminaste tú solo la parte difícil"): the bars let them SEE which ones
 * were theirs, not just be told.
 */
function YourTurnBoard({ board, seq, className }: { board: YourTurnWire; seq: number; className?: string }) {
  const { t } = useTranslation();
  const format = useValueFormat(board.currency);
  const [filled, setFilled] = useState(board.givenCount);

  // Reset on a genuinely new board, in render rather than an effect — the
  // same reason `SequenceBoard` does (a bad frame is never painted).
  const [resetSeq, setResetSeq] = useState(seq);
  if (seq !== resetSeq) {
    setResetSeq(seq);
    setFilled(board.givenCount);
  }

  // Defense in depth, the same posture `SequenceBoard`'s `safeShown` and
  // `WhatifBoard`'s `safeActive` already take: a stale `filled` from a wider
  // previous board must never index past a narrower new one for the ONE
  // render where `resetSeq` hasn't caught up yet.
  const safeFilled = Math.min(Math.max(filled, board.givenCount), board.values.length);
  const max = Math.max(...board.values, 1);
  const captionFor = (i: number) => (i === 0 ? t('tutor.whiteboard.start') : t(`tutor.whiteboard.step.${board.unit}`, { n: i }));

  const reveal = () => setFilled((n) => Math.min(n + 1, board.values.length));
  // Never undoes below `givenCount` — the tutor's own prefix is not the
  // learner's to take back.
  const undo = () => setFilled((n) => Math.max(n - 1, board.givenCount));

  return (
    <WhiteboardShell seq={seq} label={board.label} className={className} interactive>
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <p className="lf-caption text-content-muted">{t('tutor.whiteboard.yourTurn.hint')}</p>
        <BoardRow>
          {board.values.map((value, i) => {
            const given = i < board.givenCount;
            const shown = i < safeFilled;
            const isNext = i === safeFilled;
            const isUndo = !given && i === safeFilled - 1;
            const tappable = isNext || isUndo;
            return (
              <button
                key={i}
                type="button"
                disabled={!tappable}
                onClick={isUndo ? undo : reveal}
                aria-label={
                  given
                    ? t('tutor.whiteboard.yourTurn.given', { n: captionFor(i), value: format(value) })
                    : isUndo
                      ? t('tutor.whiteboard.yourTurn.undo', { n: captionFor(i) })
                      : t('tutor.whiteboard.yourTurn.reveal', { n: captionFor(i) })
                }
                className="flex min-w-[3.5rem] flex-1 flex-col items-center gap-1 rounded-md p-1 enabled:hover:bg-primary/5"
              >
                <span className="lf-number lf-title text-content" aria-hidden="true">
                  {shown ? format(value) : ''}
                </span>
                <span className="flex w-full min-h-0 flex-1 items-end" aria-hidden="true">
                  <span
                    className={cn(
                      'w-full rounded-t-md',
                      given ? 'bg-content-muted/50' : 'bg-accent/70',
                      !shown && 'opacity-0',
                    )}
                    style={{ height: shown ? `${barHeightPct(value, max)}%` : '0%' }}
                  />
                </span>
                <span className="lf-caption text-content-muted" aria-hidden="true">
                  {captionFor(i)}
                </span>
              </button>
            );
          })}
        </BoardRow>
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
    case 'tokens':
      return <TokensBoard board={board} seq={seq} className={className} />;
    case 'bar_model':
      return <BarModelBoard board={board} seq={seq} className={className} />;
    case 'part_whole':
      return <PartWholeBoard board={board} seq={seq} className={className} />;
    case 'flow':
      return <FlowBoard board={board} seq={seq} className={className} />;
    case 'goal_bar':
      return <GoalBarBoard board={board} seq={seq} className={className} />;
    case 'worked':
      return <WorkedBoard board={board} seq={seq} className={className} />;
    case 'ten_frame':
      return <TenFrameBoard board={board} seq={seq} className={className} />;
    case 'open_number_line':
      return <OpenNumberLineBoard board={board} seq={seq} className={className} />;
    case 'array':
      return <ArrayBoard board={board} seq={seq} className={className} />;
    case 'fraction_strip':
      return <FractionStripBoard board={board} seq={seq} className={className} />;
    case 'partition':
      return <PartitionBoard board={board} seq={seq} className={className} />;
    case 'table':
      return <TableBoard board={board} seq={seq} className={className} />;
    case 'scale':
      return <ScaleBoard board={board} seq={seq} className={className} />;
    case 'two_bins':
      return <TwoBinsBoard board={board} seq={seq} className={className} />;
    case 'venn':
      return <VennBoard board={board} seq={seq} className={className} />;
    case 'ranking':
      return <RankingBoard board={board} seq={seq} className={className} />;
    case 'outcomes':
      return <OutcomesBoard board={board} seq={seq} className={className} />;
    case 'trade':
      return <TradeBoard board={board} seq={seq} className={className} />;
    case 'chance':
      return <ChanceBoard board={board} seq={seq} className={className} />;
    case 'deal':
      return <DealBoard board={board} seq={seq} className={className} />;
    case 'change':
      return <ChangeBoard board={board} seq={seq} className={className} />;
    case 'regroup':
      return <RegroupBoard board={board} seq={seq} className={className} />;
    case 'equation_bar':
      return <EquationBarBoard board={board} seq={seq} className={className} />;
    case 'receipt':
      return <ReceiptBoard board={board} seq={seq} className={className} />;
    case 'ledger':
      return <LedgerBoard board={board} seq={seq} className={className} />;
    case 'price_tag':
      return <PriceTagBoard board={board} seq={seq} className={className} />;
    case 'inventory':
      return <InventoryBoard board={board} seq={seq} className={className} />;
    case 'budget_plate':
      return <BudgetPlateBoard board={board} seq={seq} className={className} />;
    case 'pictograph':
      return <PictographBoard board={board} seq={seq} className={className} />;
    case 'bead_string':
      return <BeadStringBoard board={board} seq={seq} className={className} />;
    case 'tally':
      return <TallyBoard board={board} seq={seq} className={className} />;
    case 'fraction_circle':
      return <FractionCircleBoard board={board} seq={seq} className={className} />;
    case 'stack':
      return <StackBoard board={board} seq={seq} className={className} />;
    case 'sequence_compare':
      return <SequenceCompareBoard board={board} seq={seq} className={className} />;
    case 'timeline':
      return <TimelineBoard board={board} seq={seq} className={className} />;
    case 'cycle':
      return <CycleBoard board={board} seq={seq} className={className} />;
    case 'before_after':
      return <BeforeAfterBoard board={board} seq={seq} className={className} />;
    case 'grab':
      return <GrabBoard board={board} seq={seq} className={className} />;
    case 'fill':
      return <FillBoard board={board} seq={seq} className={className} />;
    case 'whatif':
      return <WhatifBoard board={board} seq={seq} className={className} />;
    case 'your_turn':
      return <YourTurnBoard board={board} seq={seq} className={className} />;
  }
}
