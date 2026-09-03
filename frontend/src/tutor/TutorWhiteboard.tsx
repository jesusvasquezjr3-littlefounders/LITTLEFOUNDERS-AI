import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
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
        is equally true of every kind.
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
  }
}
