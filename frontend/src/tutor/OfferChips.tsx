import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui';
import type { CharacterId } from '@/components/characters/control/types';
import { cn } from '@/lib/utils';
import { playPlatformSound } from '@/lib/sound';
import { useAnchorSlot } from '@/tutor-scene/ScreenAnchor';
import { useSafeArea } from '@/tutor-scene/SafeAreaContext';
import { HudPlate } from './hud/HudPlate';
import { micBlockedReason } from './mic';
import { SessionHistory } from './SessionHistory';
import { SpeechCaption } from './SpeechCaption';
import { useStageDock, type OfferLayerProps } from './stage/StageShell';
import { MapGraph } from './map/MapGraph';
import type { StartSessionInput, TutorMapNode, TutorMapResponse } from './tutorApi';

/*
 * The introduction and the openings, in close-up (/ORACLE.md §9.2).
 *
 * WHAT THIS REPLACES, and why the replacement is the whole point. The openings
 * used to be up to five `Card`s in a `md:grid-cols-2` grid, each with an icon, a
 * title, a body paragraph and a full-width button whose label repeated its own
 * title, sitting on a page beside a shrunken stage. The owner's words for that
 * screen were "NO UNA CUADRICULA DE OPCIONES AL ARRANCAR EL TUTOR DE IA". They
 * were right, and not only aesthetically: /ORACLE.md §1 step 2 says "Begin, one
 * button; nothing before it requires reading", and a five-card reading exercise
 * placed immediately after that button contradicts the sentence it follows.
 *
 * So this is not a panel that got smaller. The camera is already in close-up
 * when this layer is on top (`shotForPhase('introducing')`), the tutor greets in
 * a caption over its own head, and the openings arrive AS IT SPEAKS as small
 * glass chips hanging in the air in front of it, staggered on the reveal cadence
 * so they read as the tutor thinking of things rather than as a menu opening.
 *
 * THE MICROPHONE IS THE LARGEST THING ON SCREEN, and it is NOT MOUNTED HERE.
 * The rejected version expressed voice as a checkbox labelled "I want to talk
 * out loud" tucked under the card grid, which is how the owner came to report
 * that the microphone was nowhere to be seen; the version after that mounted a
 * real orb here and another one in the conversation, which fixed two screens
 * and left the other four with nothing. The orb belongs to the stage
 * (`stage/StageShell.tsx`), is mounted once for the whole route, and pressing
 * it on this phase opens a spoken conversation on the same opening this file's
 * first chip offers (`mic.ts` → `primaryOpening`).
 *
 * WHAT THIS LAYER MAY NOT DO: mount a scene, move the camera, or reintroduce a
 * page. It receives `OfferLayerProps` from the shell, renders chrome over the
 * one canvas, and calls back.
 */

/**
 * How long after the greeting appears the first opening arrives.
 *
 * Long enough that the tutor has begun speaking and the chips read as its own
 * suggestions; short enough that a learner who already knows what they want is
 * never waiting on theatre. It is deliberately NOT derived from the length of
 * the greeting: a long sentence in one locale would then hold the controls back
 * for a second longer than in another, and the pacing of a control is not a
 * translation decision.
 */
const OFFERS_AFTER_GREETING_MS = 900;

/**
 * The settle stagger, as CLASSES rather than as a `Reveal` wrapper.
 *
 * `Reveal` animates a 20 px RISE, which §Motion recipe 10 forbids on this layer
 * and for a concrete reason: everything here is either projected by the camera
 * every frame or standing in a dock whose bottom edge a sheet is dragging, so a
 * translate is a second thing moving the same node. `.lf-settle` is the layer's
 * own arrival — opacity, a 0.965 scale and a 4 px blur, on the PLATE — and the
 * two stagger classes are the same 80/160 ms cadence the Reveal used
 * (/DESIGN.md §Lumen → Motion). Three steps, because the closed motion set caps
 * a stagger at three and a fourth chip arriving on its own reads as a stutter.
 */
const SETTLE_STEPS = ['', 'lf-settle-2', 'lf-settle-3'] as const;

const settleStep = (index: number): string => SETTLE_STEPS[Math.min(index, SETTLE_STEPS.length - 1)] ?? '';

/*
 * THE CLUSTER'S OWN CEILING ABOVE THE DOCK — round 123 bug 2, root-caused
 * rather than merely re-mitigated.
 *
 * Round 123 named the trigger ("right after a failed session-start attempt")
 * but could not reproduce it and guessed the mechanism was `ready &&
 * !dockAbove` letting the fallback pair join `chips` as bare siblings. That
 * guess was tested directly (this file's own regression test forces exactly
 * that combination) and held up as a real, separate hazard — but it is NOT
 * what round 123 actually saw, and chasing `dockAbove`'s truthiness alone
 * would have shipped a fix for the wrong bug.
 *
 * REPRODUCED LIVE, on `/dev/tutor-lab` at 863x349 (introducing, v2 openings,
 * `dockAbove` TRUTHY throughout — confirmed by watching `StageShell.tsx`'s own
 * `attachAbove` ref callback, which never fired with `null` once): forcing
 * `startError` non-null (a failed start's own aftermath) produced FIVE
 * measured overlaps, all between this cluster and the DOCK's own contents —
 * "Something went wrong. Try again." (the error plate `status` adds to the
 * TOP of this column) against "My island", "Past conversations" AND the mic
 * orb's own "Start talking" idle label; two of the four real openings against
 * that same idle label. `dockAbove` was never false. The dock's rect
 * (`SafeAreaContext`'s `mic` slot, published by `StageShell.tsx` regardless of
 * whether anything is portalled into `above`) never moved. What moved was
 * THIS cluster's own height: `status` inserts a whole new plate the moment a
 * start fails, ABOVE `chips` in the same unbounded flex column, and a column
 * that hangs downward from a camera-projected point with no ceiling will
 * eventually reach whatever is fixed to the bottom of the viewport — exactly
 * the "two layout systems that cannot see each other's rect" the file header
 * above already names, just not the half of it round 123 checked.
 *
 * THE FIX READS THE DOCK'S REAL RECT RATHER THAN GUESSING A CONSTANT — the
 * same `SafeAreaContext` the camera and `WorldChip` already trust, consumed
 * exactly the way `AnchorProjector`'s own `escapeReserved` call consumes it:
 * read-only, never published to. This cluster still may never REGISTER a rect
 * of its own (see `clusterRef`'s comment on why that specific direction is a
 * feedback loop) — reading the DOCK's already-published one is the opposite,
 * safe direction, the same one `SpeechCaption`'s `avoid` option already takes
 * for the very same dock.
 *
 * A max-height plus scroll, not a shove upward: the anchor point stays exactly
 * where the camera puts it — nudging the whole cluster would either detach it
 * visibly from the chest it names or fight the projector's own per-frame
 * transform on the ANCESTOR node — and content that does not fit is content a
 * finger can still reach by scrolling, which is strictly better than content
 * sitting invisibly under the dock's own controls.
 */
const CLUSTER_DOCK_GAP_PX = 8;
/**
 * The smallest this cluster may ever be capped to, however little room the
 * dock has left above it.
 *
 * A floor rather than letting the computed ceiling go to zero (or negative,
 * when the anchor itself projects at or below the dock — a degenerate shot
 * this cannot rule out): a learner can still read and scroll a ~2-line-tall
 * plate, and `overflow-y-auto` makes the rest reachable. A collapsed-to-zero
 * cluster would instead be indistinguishable from the tutor saying nothing.
 */
const CLUSTER_MIN_HEIGHT_PX = 96;
/**
 * How often the cluster's own height is checked against the dock's current
 * rect, in ms.
 *
 * A poll, not a `useFrame` subscription: unlike the caption or the picker's
 * name plates, this correction only has to react to THIS component's own
 * content changing shape (a status plate arriving, the reveal timer firing,
 * the dock growing a blocked-reason line) — none of which happens faster than
 * a render, and all of which are still well inside a learner's reaction time
 * at this cadence. The same order of cost as `HudOverlapReadout`'s own
 * 400 ms lab instrument, spent here in every build rather than only in dev.
 */
const CLUSTER_HEIGHT_CHECK_MS = 250;

/**
 * "In about N hours/minutes" for the SESSION_LIMIT refusal (§1.9 clarity —
 * found by review sweep tutor-review-sweep-92, session-cap-ux). The old
 * copy said only "come back tomorrow", which cannot tell a child whether the
 * wait is ten minutes or nearly a day.
 *
 * A DURATION rather than a clock time, deliberately: `resetAtIso` is always
 * the learner's next LOCAL MIDNIGHT (`startOfLocalDayIso(locale, now, 1)` on
 * the server), so a clock-time rendering would read "12:00 AM" or "00:00"
 * for every single refusal — true, but useless, since midnight is not itself
 * a time anyone is expected to be awake and starting a tutor session. "In
 * about 6 hours" says something a clock stamp of the boundary itself cannot.
 *
 * `Math.ceil` rather than rounding to nearest: the reported wait never reads
 * shorter than the real one, which is the safe direction for a promise made
 * to a child about when something becomes available again.
 */
function formatResetWhen(resetAtIso: string | null, fallback: string, locale: string): string {
  if (!resetAtIso) return fallback;
  const resetAt = new Date(resetAtIso);
  const diffMs = resetAt.getTime() - Date.now();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return fallback;

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'long' });
  const diffMinutes = diffMs / 60_000;
  if (diffMinutes < 60) return rtf.format(Math.max(1, Math.ceil(diffMinutes)), 'minute');
  return rtf.format(Math.max(1, Math.ceil(diffMinutes / 60)), 'hour');
}

/**
 * One opening the tutor can offer.
 *
 * A CLOSED SET, ALWAYS (/ORACLE.md §9.2). Four ways in, and the first three are
 * ids rather than text; only the fourth is free-form, and it is the one every
 * defence in /ORACLE.md §5 exists for.
 */
interface Opening {
  /** Stable key, and the hook a test uses to name one. */
  id: string;
  icon: string;
  /**
   * ONE SHORT LINE, AND IT CARRIES ITS OWN SUBJECT.
   *
   * There used to be a `detail` beside it — "Practise / Ahorro con meta" — and
   * it is deleted (/DESIGN.md §Lumen → What to delete). At the chrome density
   * there is no legible quieter ink to demote a second line into, so a line
   * that only works as a whisper is a line to delete.
   *
   * Deleting it may NOT delete the subject with it: "Practise" on its own is a
   * chip that names an action and no topic, which is exactly the failure
   * /AGENTS.md §1.14 records under "verified for subject, not only for form".
   * So the topic moved INTO the label — `offers.weakSkill.title` interpolates
   * it — and the one chip that had a second line now has one line that says
   * more than the two of them did.
   */
  label: string;
  /**
   * The tutor's own sentence for this opening, used as part of the accessible
   * name. This is where the offer PHRASING lives, which for the flagged skill is
   * the difference between an invitation and a verdict.
   */
  spoken: string;
  input: Omit<StartSessionInput, 'wantsVoice'>;
}

export interface OfferChipsProps extends OfferLayerProps {
  /**
   * Who is doing the greeting. The shell's seam does not carry it because no
   * other layer needs it, so it is passed alongside: a tutor that introduces
   * itself has to know its own name.
   */
  character: CharacterId;
  /**
   * The learner's chosen nickname, or null before they have picked one.
   *
   * The ONLY name-shaped value that may reach the model (/ORACLE.md §4.1), and
   * it is a learner-chosen nickname rather than a real name by construction.
   */
  nickname: string | null;
  /**
   * The learning map (Tutor v3) — the KC graph this learner's sessions
   * actually traverse. When it carries nodes, IT replaces the opening chips:
   * the map is the home (blueprint §A.2), CONTINUE is the planner's own first
   * pick, and "algo más" keeps the open door. Null (v3 off, unseeded, or a
   * failed read) falls back to the v2 openings — graceful in both directions.
   */
  map: TutorMapResponse | null;
}

export function OfferChips({
  offers,
  starting,
  startError,
  startErrorResetAt,
  onRetryOffers,
  onStart,
  onPersonalize,
  token,
  onReplay,
  ready,
  timedOut,
  character,
  nickname,
  map,
}: OfferChipsProps) {
  const { t, i18n } = useTranslation();
  const dock = useStageDock();
  /** Read-only: the dock's own published rect, never a registration of ours — see `CLUSTER_DOCK_GAP_PX` above. */
  const safeArea = useSafeArea();

  /*
   * ONE anchored node for the whole cluster, rather than one `WorldChip` per
   * opening, and the reason is the shot rather than convenience.
   *
   * A `WorldChip` needs a slot of its own, and the only slots a CLOSE-UP frames
   * are the lead's own: at this distance the five `stage.mark.*` places the
   * picker uses are off to the sides or behind the camera, where the projector
   * correctly hides AND inerts anything pinned to them. Five chips on the one
   * slot that is in frame would stack on a single point. So the cluster rides
   * one anchor and lays itself out, which keeps every chip in the tab order as
   * one ordered list and keeps the whole group culled together when the camera
   * turns away.
   *
   * IT RIDES THE CHEST, WHICH IS WHERE /DESIGN.md PUTS IT, and it used to ride
   * the HEAD hanging 10vh below — a workaround for a shot that framed 0.70 of
   * the character, which put the published chest point at about 90% of the
   * viewport, under the microphone. The measurement was right and the conclusion
   * was backwards: 10vh below the mid-head at that framing is the MOUTH, and a
   * screenshot of production showed four chips laid across Dr Rho's moustache.
   * Nothing may sit on the face — it is the one thing the character rig, the
   * mouth atlas and the whole lip-sync path exist to show. The shot opened
   * instead (`shots.ts` → `CLOSEUP_FRAME_FRACTION`), so the chest is on screen
   * above the microphone and the chips can be where the recipe says they are.
   *
   * THE CLUSTER MUST NEVER REGISTER WITH `SafeAreaContext`, however tempting:
   * it is positioned by projecting a point the camera is composing against, so
   * publishing its rect would make the camera push a surface that then reports a
   * new rect, forever. The rule and its reasoning live on `SafeAreaSlot`.
   */
  const clusterRef = useAnchorSlot('lead.chest');
  /**
   * The cluster's REAL, sized content — as opposed to `clusterRef`'s own
   * deliberately zero-sized wrapper (see its comment). This is what actually
   * grows when `status` gains a plate or `chips` gains a row, and therefore
   * the node the dock-ceiling correction below has to measure.
   */
  const clusterContentRef = useRef<HTMLDivElement | null>(null);

  const [chipsIn, setChipsIn] = useState(false);
  const [replaysOpen, setReplaysOpen] = useState(false);

  useEffect(() => {
    /*
     * The theatre waits for the island. `ready` means the island AND the cast
     * are actually on screen; starting the arrival on mount instead would spend
     * the whole performance behind the shell's veil on exactly the slow load
     * where it is the only thing to look at.
     */
    if (!ready) return;
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    if (reduced) {
      // Pacing is motion too. Someone who asked for less of it gets the
      // controls immediately rather than a slower version of the same wait.
      setChipsIn(true);
      return;
    }
    const timer = window.setTimeout(() => {
      setChipsIn(true);
      // ONE cue for the group, not one per chip: four taps in 240 ms is a
      // rattle, and every cue here has the visible arrival as its twin anyway.
      playPlatformSound('tutor_reveal');
    }, OFFERS_AFTER_GREETING_MS);
    return () => window.clearTimeout(timer);
  }, [ready]);

  /*
   * THE DOCK-CEILING CORRECTION — see `CLUSTER_DOCK_GAP_PX`'s comment above
   * for the live reproduction this closes.
   *
   * Polled rather than derived from props: what can make this cluster grow
   * (a status plate, a fourth opening wrapping to two lines in es-MX, the
   * dock itself gaining a blocked-reason row and therefore rising) is spread
   * across this component, `micForPhase`, and `StageShell.tsx`, and listing
   * every one of them as a dependency is exactly the kind of list this whole
   * mechanism exists to make unnecessary — `SafeAreaContext`'s `mic` rect and
   * a `getBoundingClientRect()` on this cluster's own content are the two
   * facts this correction actually needs, and both are cheap to re-read on a
   * quarter-second cadence rather than threaded through as props.
   */
  useEffect(() => {
    const content = clusterContentRef.current;
    if (!content) return;

    const sync = () => {
      /*
       * RESET BEFORE MEASURING, ALWAYS. `getBoundingClientRect()` reports
       * this node's CURRENT painted box, which after a PREVIOUS tick's own
       * `transform`/`maxHeight` is no longer this cluster's natural size or
       * position — measuring it without resetting first would compound the
       * previous correction into the next one, walking the cluster further
       * from the chest on every single tick it stayed non-zero.
       */
      content.style.transform = '';
      content.style.maxHeight = '';
      content.style.overflowY = '';

      const dockRect = safeArea?.chromeRef.current.get('mic');
      // No dock published (the scene lab without a shell, a unit test, or a
      // route where the dock has not mounted yet): nothing to clear against.
      if (!dockRect) return;

      const rect = content.getBoundingClientRect();
      const ceiling = dockRect.top - CLUSTER_DOCK_GAP_PX;
      const overflow = rect.top + rect.height - ceiling;
      // Already clear at its natural size and position: leave it exactly as
      // authored. This is the common case at every viewport this route
      // actually ships at, and it must stay pixel-identical to today.
      if (overflow <= 0) return;

      /*
       * AN UPWARD NUDGE FIRST, BOUNDED BY THE WAY-OUT CHIP RATHER THAN A
       * SMALL FIXED BUDGET — a height cap ALONE was tried and measured wrong.
       * At 863x349 with a failed-start error plate showing, the whole
       * cluster's NATURAL height was 88px — already under any reasonable
       * floor — and it still overlapped the dock by ~130px, because the
       * CHEST ANCHOR ITSELF was projecting close enough to the dock that no
       * amount of clipping the cluster's OWN bottom edge could keep its
       * unclipped remainder off it: capping the height of an already-short
       * block changes nothing. A small FIXED shift budget was tried next and
       * ALSO measured wrong, for the identical reason one level up — 64px
       * covered part of that same 130px gap and the height cap still could
       * not close the rest, since `Math.max(floor, natural - remaining)`
       * cannot shrink a block whose natural height is already under the
       * floor. So the shift is bounded by the one thing that actually limits
       * how far this cluster may honestly move: the "Leave the tutor" chip's
       * own real, published rect (`SafeAreaContext`'s `exit` slot) — the same
       * top-of-screen landmark `top-[max(4.5rem,9vh)]` on the map's own
       * wrapper below protects by a flat guess. `top-2`'s offset from the
       * anchor is a cosmetic gap, not a physical attachment, so closing it
       * down to nothing is a smaller, less disruptive move than pushing a
       * child's tutor further from the character it names would be — used
       * only when it is the shift that clears the dock, never past it.
       */
      const exitRect = safeArea?.chromeRef.current.get('exit');
      const topFloor = exitRect ? exitRect.top + exitRect.height + CLUSTER_DOCK_GAP_PX : 0;
      const maxShift = Math.max(0, rect.top - topFloor);
      const shift = Math.min(overflow, maxShift);
      /*
       * `translateX(-50%)` IS NOT OPTIONAL HERE — it is this node's OWN
       * `-translate-x-1/2` CLASS (centring it under `left-1/2`), and an
       * inline `style.transform` REPLACES a class's transform outright
       * rather than composing with it. Dropping it measured live: the whole
       * cluster centred a half-width too far right the instant any shift
       * applied, cropping the second column of chips off a 375 px screen.
       */
      if (shift > 0) content.style.transform = `translateX(-50%) translateY(-${shift}px)`;

      /*
       * STILL NOT CLEAR EVEN PRESSED AGAINST THE WAY OUT: now it genuinely is
       * a "too tall for the room available" problem — four openings plus a
       * status plate, on a viewport short enough that even the full run from
       * the chest to the top of the screen is not enough room — and clipping
       * plus a scrollbar is the right answer FOR THAT SHAPE OF PROBLEM, the
       * same remedy the map panel and the archive sheet already use for it.
       */
      const remaining = overflow - shift;
      if (remaining > 0) {
        content.style.maxHeight = `${Math.max(CLUSTER_MIN_HEIGHT_PX, rect.height - remaining)}px`;
        content.style.overflowY = 'auto';
      }
    };

    sync();
    const timer = window.setInterval(sync, CLUSTER_HEIGHT_CHECK_MS);
    return () => window.clearInterval(timer);
    // `safeArea` is the provider's own stable value (see `SafeAreaContext.tsx`
    // → its `useMemo`); the interval's own tick is what re-reads the REFS
    // inside it, so neither it nor `dock` needs to be in this list for the
    // CORRECTION to stay current. `ready` DOES belong here — `clusterContentRef`
    // only exists inside the `ready` branch below, so the effect that fires on
    // the FIRST render (`ready` still false, `content` still null) would
    // otherwise return immediately and never run again: an effect's own
    // dependency array is what makes it re-attach once the node it needs
    // actually mounts, and a ref alone does not trigger that on its own.
  }, [safeArea, ready]);

  const tutorName = t(`tutor.character.${character}.name`);

  /*
   * What the tutor says while the openings arrive.
   *
   * TWO SENTENCES AT MOST, AND USUALLY ONE. It used to be three: hello, a note
   * about how little the tutor knows yet, and "What would you like to look at
   * together today?" — asked immediately above four chips that ARE that
   * question, answerable by tapping one. A line of instructional text beside a
   * control that already says the same thing is the noise this pass exists to
   * remove, so `introduce.ask` is gone and the chips are the ask.
   *
   * THE NAME IS IN THE TEXT AND NOT IN THE VOICE (owner, 2026-08-22). This
   * caption is written here, not by the model, so the learner's nickname
   * appears in the words on screen while the tutor's spoken greeting stays
   * generic. The two halves land together: Oracle stops putting the nickname in
   * the greeting it synthesizes, and this keeps showing it.
   *
   * COLD START IS THE NORMAL CASE, not an edge case: the courses sit in review,
   * so most learners have almost no evidence attached to them. The tutor still
   * says so, in its own voice, but in six words rather than nineteen — a child
   * does not need the mechanism explained, only the fact admitted.
   */
  const greeting = useMemo(() => {
    const hello = nickname
      ? t('tutor.introduce.greeting', { name: nickname, tutor: tutorName })
      : t('tutor.introduce.greetingNoName', { tutor: tutorName });
    const note = offers.intelDegraded
      ? t('tutor.introduce.cannotSeeProgress')
      : offers.weakSkills.length === 0
        ? t('tutor.introduce.stillLearningYou')
        : null;
    return [hello, note].filter(Boolean).join(' ');
  }, [nickname, tutorName, offers.intelDegraded, offers.weakSkills.length, t]);

  const openings = useMemo<Opening[]>(() => {
    const list: Opening[] = [];

    /*
     * CONTINUITY FIRST (owner sign-off 2026-08-28). A learner who left
     * mid-conversation yesterday should find the door they left through, not
     * four fresh ones — the digest Core keeps at close carries the topic and
     * the ids to reopen the same ground. Only when there IS somewhere to go
     * back to; a completed open chat leaves nothing worth resuming.
     */
    const last = offers.lastSession;
    if (last && (last.topic || last.skillKey)) {
      const topic = last.topic ?? readableSkill(last.skillKey ?? '');
      list.push({
        id: 'continue',
        icon: 'history',
        label: t('tutor.offers.continue.title', { topic }),
        spoken: t('tutor.offers.continue.body', { topic }),
        input: last.courseId || last.topicId
          ? { intent: 'course_topic', courseId: last.courseId, topicId: last.topicId }
          : { intent: 'weak_skill', skillKey: last.skillKey },
      });
    }

    list.push({
      id: 'course_topic',
      icon: 'school',
      label: t('tutor.offers.courseTopic.title'),
      spoken: t('tutor.offers.courseTopic.body'),
      input: { intent: 'course_topic' },
    });

    /*
     * ONE flagged skill, the strongest, and it is an OFFER rather than a
     * verdict: the copy asks, declining costs nothing and is not recorded as a
     * fact about anyone, and Core has already filtered on evidence count and
     * uncertainty before any of them reach here. A tutor that opens with "you
     * are behind on this" is a tutor a child stops opening.
     *
     * Only the first, because the list arrives ranked and because five plates
     * hanging over a close-up stop being suggestions and become a menu again.
     */
    const weak = offers.weakSkills[0];
    if (weak) {
      // Core resolves the topic's real title now; the slug regex survives only
      // as the fallback for an entry Core could not resolve.
      const topic = weak.title ?? readableSkill(weak.skillKey);
      list.push({
        id: 'weak_skill',
        icon: 'lightbulb',
        label: t('tutor.offers.weakSkill.title', { topic }),
        spoken: t('tutor.offers.weakSkill.body', { topic }),
        input: {
          intent: 'weak_skill',
          skillKey: weak.skillKey,
          courseId: weak.courseId,
          topicId: weak.topicId,
        },
      });
    } else {
      list.push({
        id: 'diagnostic',
        icon: 'explore',
        label: t('tutor.offers.diagnostic.title'),
        spoken: t('tutor.offers.diagnostic.body'),
        input: { intent: 'diagnostic' },
      });
    }

    // The set stays at four. When continuity took a slot, the curated
    // question yields — it is the least personal of the four, and five plates
    // over a close-up stop being suggestions and become a menu.
    const faqId = list.some((o) => o.id === 'continue') ? undefined : offers.faqIds[0];
    if (faqId) {
      list.push({
        id: `faq:${faqId}`,
        icon: 'help',
        // The curated question IS the label. It is already one short human
        // sentence, which is exactly what a chip is for.
        label: t(`tutor.faq.${faqId}`),
        spoken: t('tutor.offers.faq.body'),
        input: { intent: 'faq', skillKey: faqId },
      });
    }

    if (offers.canAskOpen) {
      list.push({
        id: 'open',
        icon: 'chat',
        label: t('tutor.offers.open.title'),
        spoken: t('tutor.offers.open.body'),
        input: { intent: 'open' },
      });
    }

    return list;
  }, [offers.lastSession, offers.weakSkills, offers.faqIds, offers.canAskOpen, t]);

  /*
   * Voice is ON whenever it is possible, and the learner is never asked to tick
   * a box to be allowed to speak. The three reasons it can be off are computed
   * by Core before a session exists, so this is never a control that does
   * nothing (/ORACLE.md §14).
   */
  const voiceBlocked = micBlockedReason(offers.voiceAvailable, offers.microphoneBlockedBy);
  const wantsVoice = voiceBlocked === null;

  /** True when Oracle cannot serve at all, as opposed to a start in flight. */
  const cannotServe = !offers.canStart;
  /*
   * Found by adversarial review, round 99 (2026-08-31, HIGH), a sibling
   * finding of the daily-cap fix on `GET /offers` itself: `cannotServe`
   * used to render ONE message no matter why — "the tutor is resting" —
   * which is honest for an Oracle outage and actively WRONG for a learner
   * who simply used today's two sessions. `startBlockedBy` already carries
   * the distinction (the offers route folds the cap into the same
   * `canStart`/`startBlockedBy` pair Oracle's own health uses, reusing the
   * exact `SESSION_LIMIT` code `POST /sessions` returns for the identical
   * refusal), so this reads it back rather than inventing new wire
   * vocabulary — the existing `tutor.startError.SESSION_LIMIT` copy already
   * says the right thing, it was just never shown before a tap.
   *
   * Reuses round 95's `formatResetWhen` and `offers.sessionCapResetAt` (the
   * SAME reset-instant computation `POST /sessions`'s own `resetAt` uses,
   * exposed proactively) rather than the plain fallback word, so this
   * screen and the post-tap refusal never disagree about HOW LONG the wait
   * is — only about whether a tap already happened.
   */
  const sessionCapReached = offers.startBlockedBy === 'SESSION_LIMIT';
  const disabled = starting;

  const choose = useCallback(
    (input: Omit<StartSessionInput, 'wantsVoice'>) => {
      playPlatformSound('tutor_chip');
      onStart({ ...input, wantsVoice });
    },
    [onStart, wantsVoice],
  );

  /*
   * The status lines, where the learner is looking rather than at the top of a
   * page: a refusal belongs next to the control that was refused.
   */
  const status = (
    <>
      {cannotServe && (
        <HudPlate shape="plate" className="pointer-events-none flex flex-col items-center gap-2 self-center">
          <span className="lf-body" role="status">
            {sessionCapReached
              ? t('tutor.startError.SESSION_LIMIT', {
                  when: formatResetWhen(
                    offers.sessionCapResetAt,
                    t('tutor.startError.sessionLimitWhenFallback'),
                    i18n.language,
                  ),
                })
              : t('tutor.page.tutorUnavailable')}
          </span>
          {/*
            NOT shown for `sessionCapReached`: the cap does not clear itself by
            asking again, so a retry here would just repeat the same refusal —
            the wait in the sentence above is the only true answer for that
            case. For a genuine outage, this is the ask-again `onRetryOffers`
            exists for (see its own comment): `offers` is a snapshot, taken
            once, that never rechecks itself — found live, 2026-09-01, a
            dropped connection whose resume failed left exactly this message
            on screen with Oracle already back up seconds later and nothing in
            the app ever asking again.
          */}
          {!sessionCapReached && (
            <HudPlate as="button" shape="chip" onClick={onRetryOffers} className="pointer-events-auto">
              <Icon name="refresh" />
              <span className="lf-action">{t('tutor.page.tutorUnavailableRetry')}</span>
            </HudPlate>
          )}
        </HudPlate>
      )}
      {startError && (
        <HudPlate shape="plate" className="pointer-events-none self-center">
          <span className="lf-body" role="status">
            {/* An error CODE, never a wire message: an untranslated server
                string on a child's screen is both an i18n violation and a leak
                of internal wording. `when` only matters to SESSION_LIMIT's own
                key — every other key ignores an interpolation var it does not
                reference. Falls back to `sessionLimitWhenFallback` ("tomorrow")
                when the server omitted `resetAt`, rather than leaking a raw
                "{{when}}" onto the screen. */}
            {t(`tutor.startError.${startError}`, {
              when: formatResetWhen(startErrorResetAt, t('tutor.startError.sessionLimitWhenFallback'), i18n.language),
              defaultValue: t('tutor.startError.INTERNAL'),
            })}
          </span>
        </HudPlate>
      )}
    </>
  );

  /*
   * THE LEARNING MAP (Tutor v3). When the KC graph exists it IS the home:
   * one accent CONTINUE (the planner's own first pick — the map and the
   * session can never disagree), the review count when something is due, the
   * graph with its visible prerequisite edges, and the open door. Nodes that
   * can be started start; locked nodes name their prerequisite instead of
   * merely refusing.
   */
  const startInputForNode = useCallback(
    (skillKey: string | null): Omit<StartSessionInput, 'wantsVoice'> =>
      skillKey ? { intent: 'weak_skill', skillKey } : { intent: 'open' },
    [],
  );

  const pickNode = useCallback(
    (node: TutorMapNode) => choose(startInputForNode(node.skillKey)),
    [choose, startInputForNode],
  );

  const mapPanel =
    map && map.nodes.length > 0 ? (
      <HudPlate
        shape="sheet"
        className={cn('pointer-events-auto max-h-full w-full overflow-y-auto overscroll-contain', settleStep(0))}
        /*
         * INLINE for the same reason the chips do it: `cn` is a plain join, so
         * a `max-w-*` class here would land beside the sheet's own 44ch cap
         * with the winner decided by Tailwind's output order. A curriculum
         * graph is not a 44ch reading column.
         */
        style={{ maxWidth: '100%' }}
      >
        <div className="flex w-full flex-col gap-3">
          {/*
            The greeting lives IN the map while the map is the home: the
            crown caption is projected over the character, and with the camera
            at the establishing shot it landed across the map's own CONTINUE
            (measured overlap in the lab report). One sentence, one place.
          */}
          <p className="lf-speech text-content" aria-live="polite" aria-atomic="true">
            {greeting}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {map.continueTarget && (
              <HudPlate
                as="button"
                shape="chip"
                floor="accent"
                disabled={disabled}
                data-opening="map-continue"
                onClick={() => choose(startInputForNode(map.continueTarget!.skillKey))}
                className="pointer-events-auto"
                style={{ maxWidth: '100%' }}
              >
                <Icon name="play_arrow" />
                <span className="lf-action text-left">
                  {map.continueTarget.reason === 'review_due'
                    ? t('tutor.map.continueReview', { title: map.continueTarget.title })
                    : t('tutor.map.continue', { title: map.continueTarget.title })}
                </span>
              </HudPlate>
            )}
            {map.review.count > 0 && (
              <HudPlate shape="chip" className="pointer-events-none">
                <Icon name="history" className="text-warning-strong" />
                <span className="lf-caption">{t('tutor.map.reviewCount', { count: map.review.count })}</span>
              </HudPlate>
            )}
            {offers.canAskOpen && (
              <HudPlate
                as="button"
                shape="chip"
                disabled={disabled}
                data-opening="open"
                onClick={() => choose({ intent: 'open' })}
                className="pointer-events-auto"
              >
                <Icon name="chat" className="text-primary" />
                <span className="lf-action">{t('tutor.offers.open.title')}</span>
              </HudPlate>
            )}
          </div>
          <MapGraph map={map} onPick={pickNode} disabled={disabled} />
        </div>
      </HudPlate>
    ) : null;

  const chips = (
    <div
      role="group"
      aria-label={t('tutor.introduce.offersLabel')}
      /*
       * TWO COLUMNS ON A PHONE, one wrapped row from `md:` up, and the
       * difference is 52 px of island. MEASURED in a browser at 375 px: the four
       * openings are 209, 170, 265 and 167 px wide, so `flex-wrap` inside the
       * 22rem cluster gives every one of them a row of its own and the block is
       * 208 px tall — a quarter of a phone, hanging off the tutor's chest, above
       * a 188 px microphone dock. Forced into two columns the same four chips
       * are 156 px (140 px in es-MX and pt-BR, whose labels break differently),
       * and that is what fits between the chest and the dock.
       *
       * `items-stretch` is implied by the grid and is wanted: two chips in a row
       * whose labels wrap to different line counts should be the same height, or
       * the row reads as two unrelated controls.
       */
      /*
       * `auto-rows-fr` is what makes it a 2x2 BLOCK rather than two rows that
       * happen to be stacked. A grid equalises heights within a row, so one
       * three-line label — "Practise Ahorro con meta", which is the one chip
       * carrying a topic — made the top row 67 px and left the bottom one at
       * 50, measured at 375x812. Two mismatched rows of glass over a character
       * read as an accident; one block reads as a decision, and it costs 17 px.
       */
      className="grid grid-cols-2 auto-rows-fr gap-2 md:flex md:flex-wrap md:items-center md:justify-center"
    >
      {openings.map((opening, index) => (
          <HudPlate
            key={opening.id}
            as="button"
            shape="chip"
            disabled={disabled}
            data-opening={opening.id}
            /*
             * The visible label FIRST, then the tutor's own sentence. Leading
             * with the sentence would drop the visible words out of the
             * accessible name, which breaks voice control for the one control
             * a learner is most likely to ask for out loud.
             */
            aria-label={`${opening.label} ${opening.spoken}`}
            onClick={() => choose(opening.input)}
            className={cn('pointer-events-auto', settleStep(index), disabled && 'opacity-60')}
            /*
             * THE CLUSTER IS THE MEASURE HERE, NOT THE CHIP'S OWN 22ch, and
             * that is the locale swing rather than a preference.
             *
             * `HudPlate` caps a chip at `min(22ch, 72vw)` — about 167 px of
             * Inter at `lf-action` — which is a reading measure for a label of
             * two or three words. These labels are not that: they run 15
             * characters ("Ask me anything") to 33 ("¿Qué significa de verdad
             * ahorrar?"), a 2.2x swing across en-US / es-MX / pt-BR, and every
             * one of the four wraps to two lines in Spanish and Portuguese
             * while fitting on one in English. That is 80 px of extra chrome
             * hanging over the character, in the locale this product actually
             * ships in, decided by nothing but the length of a translation.
             * Released to the cluster's own width the same four sit on one line
             * each in all three from `md:` up, so the arrangement is the same
             * shape everywhere and only the wrap points move. Below `md:` the
             * cluster is two columns and the cell IS the measure — 156 px of
             * two-line chips in en-US against 208 px of one-per-row, measured,
             * and that 52 px is what fits between the chest and the microphone.
             *
             * INLINE, because `cn` is a plain string join with no conflict
             * resolution (`lib/utils.ts`): a `max-w-*` class passed through
             * `className` lands beside the primitive's own and which one wins
             * is decided by Tailwind's output order rather than by this file.
             */
            style={{ maxWidth: '100%' }}
          >
            <Icon name={opening.icon} className="text-primary" />
            <span className="lf-action text-left">{opening.label}</span>
          </HudPlate>
      ))}
    </div>
  );

  /*
   * The two things a learner may want that are not an opening. They are quieter
   * on purpose: during this phase the microphone is the one action (/DESIGN.md →
   * Screen Recipes → Tutor), so these are secondary and an opening chip is not a
   * second CTA either.
   *
   * THEY RIDE THE MICROPHONE DOCK RATHER THAN THE TUTOR'S CHEST, and the reason
   * is measured. /DESIGN.md's world-anchored list says "offer chips at the
   * tutor's chest" — these two are not offers, they are the way to the picker
   * and the way to a replay. Keeping them in the chest cluster cost 44 px of the
   * band between the chest and the microphone, and at 375 px the four openings
   * already wrap to two rows there: the pair was the difference between the
   * cluster fitting above the dock and disappearing behind it, since the dock is
   * `z-30` and world chrome is `z-20`. The dock's `above` slot exists for
   * exactly this (`StageDockValue`), it is measured into the safe area with the
   * rest of the dock so the camera composes around it, and it does not add a
   * fourth viewport-anchored element — it is part of the one that is already
   * there.
   */
  const secondary = (
    <div
      role="group"
      aria-label={t('tutor.introduce.moreLabel')}
      className="flex flex-wrap items-center justify-center gap-2"
    >
      <HudPlate as="button" shape="chip" onClick={onPersonalize} className="pointer-events-auto">
        <Icon name="landscape" />
        <span className="lf-action">{t('tutor.page.changeStage')}</span>
      </HudPlate>

      <HudPlate
        as="button"
        shape="chip"
        aria-expanded={replaysOpen}
        onClick={() => setReplaysOpen((open) => !open)}
        className="pointer-events-auto lf-settle-2"
      >
        <Icon name="history" />
        <span className="lf-action">
          {replaysOpen ? t('tutor.introduce.hideReplays') : t('tutor.introduce.replays')}
        </span>
      </HudPlate>
    </div>
  );

  /*
   * SAVED CONVERSATIONS, AND THEY STAND IN THE DOCK LIKE EVERYTHING ELSE HERE.
   *
   * It used to be `absolute inset-x-0 bottom-0 z-40` inside the HUD layer, and
   * that z-index could never have worked: `StageLayer`'s wrapper is
   * `absolute inset-0 z-30`, which is a positioned element with a z-index and
   * therefore a STACKING CONTEXT — so a z-40 child of it is confined to the
   * layer's own 30, and the microphone dock, also at 30 and later in the DOM,
   * paints over the top of it. Measured at 375x812 with the archive open: the
   * "My island" and "Hide" chips sat across the list, and "Play it again" — the
   * one control on the surface — was underneath them, half covered and still
   * pressable, which is worse than being gone.
   *
   * The dock's own `above` slot has none of that problem, is measured into the
   * safe area so the camera composes around it, and is exactly where the
   * goodbye already puts the same list (`ClosingInWorld`). One archive, two
   * phases, one arrangement. It scrolls inside itself because the dock grows
   * UPWARD from the bottom edge, so a learner with thirty conversations would
   * otherwise push the first row off the top of the screen.
   */
  const archive = replaysOpen ? (
    <HudPlate shape="sheet" className="pointer-events-auto max-h-[52vh] overflow-y-auto overscroll-contain">
      {/*
        The plate's own floor centres its content, which is right for a one-line
        chip and wrong for a list. The list sets its own alignment rather than
        the primitive growing a variant for it.
      */}
      <div className="flex w-full flex-col gap-3 text-left">
        <span className="lf-headline text-content">{t('tutor.history.title')}</span>
        <SessionHistory token={token} onReplay={onReplay} />
      </div>
    </HudPlate>
  ) : null;

  /*
   * The dock is absent on the scene lab and in a unit test, and a control that
   * exists only where a shell is mounted is a control two of the three places
   * this component runs cannot reach. Where there is no dock the pair falls back
   * into the cluster it came from, which is exactly where it used to live.
   */
  const dockAbove = dock?.above ?? null;

  return (
    <>
      {/*
        `ready && !timedOut`, NOT `ready` ALONE — found live, 2026-09-01,
        the exact failure this branch's OWN comment below already worried
        about ("with no projector running it never receives a position, so
        it either stays hidden or... lands half off the top-left corner")
        but did not yet have a signal to defend against: `ready` alone is
        also true once `useStageAnnouncement`'s deadline fires with NO real
        frame ever having rendered, which is precisely "no projector
        running." See `StageLayerCommonProps.timedOut`'s own comment.
      */}
      {ready && !timedOut ? (
        <>
          {/*
            The greeting, above the character's head.

            `SpeechCaption` owns captions for this whole feature, including
            their aria-live grammar and the typewriter that makes a line read as
            being SAID rather than as having appeared. Reusing it means the
            greeting rides the crown exactly as every later line does, instead
            of this surface growing a second caption that drifts away from the
            first.

            It is rendered ONLY once the scene is up, and that is not an
            optimisation. The caption is an anchored node: with no projector
            running it never receives a position, so it either stays hidden or,
            where no registry exists at all, lands half off the top-left corner
            of the screen. Measured in a browser, at (-158, -121). The
            arrangement below carries the same sentence for that case.

            `turnSeq` flips with `ready` so the sentence types when the island
            appears. Without it, a learner arriving on a slow connection watches
            the whole greeting play out behind the shell's veil and then lifts
            it on a line that has already finished.
          */}
          {/* With the map open the greeting rides the map's own header —
              projected over the establishing shot, the crown caption landed
              across the map's CONTINUE. */}
          {!mapPanel && <SpeechCaption text={greeting} turnSeq={ready ? 1 : 0} />}

          <div
            ref={clusterRef}
            /*
             * Zero-sized on purpose. The projector writes this node's whole
             * transform every frame and ends it with `translate(-50%, -50%)`,
             * so a box with no size centres exactly on the published point and
             * the child below is free to hang off it without fighting that
             * centring. Nothing here may add a transform of its own.
             */
            className={cn(
              'pointer-events-none fixed left-0 top-0 h-0 w-0 will-change-transform',
              /*
               * `z-20`, matching "world chrome is z-20" (`secondary`'s own
               * comment) — EXCEPT while `cannotServe`, when this cluster is
               * the only thing carrying the status message (and now a retry
               * control) a learner needs to see and reach. Found live,
               * 2026-09-01: the map panel is ALSO `z-20`
               * (`chipsIn && mapPanel`'s wrapper, below) and later in the DOM,
               * so on any account with a seeded map, a tie at the SAME
               * z-index resolves by paint order and the map's own node strip
               * painted over the status message and the new retry button
               * both — not merely obscured but, for the button, completely
               * unreachable: fifteen sampled points across its own rect all
               * hit a map node instead. `z-[21]` is the minimum nudge that
               * wins the tie; it stays well clear of the dock's `z-30`
               * (round 88/91's own hard-won boundary — see `secondary`'s
               * comment), so nothing about the cluster-vs-dock relationship
               * this file already measured changes in the ordinary case.
               */
              cannotServe ? 'z-[21]' : 'z-20',
            )}
          >
            <div
              ref={clusterContentRef}
              /*
               * Hanging FROM the chest point rather than centred on it, and
               * WIDER on desktop so the openings sit in one row across the
               * character's chest instead of in a column down its front. At
               * 375 px the same cluster is two columns, which is the composition
               * changing rather than the product changing.
               *
               * 54rem and not 44rem: the four openings measure 209, 170, 265 and
               * 167 px, which is 835 px with the gaps — so at 44rem the row that
               * was supposed to be one row was two, and the second one hung 52 px
               * lower down the character for no reason anybody chose. 54rem is
               * the first width where the sentence above is true.
               *
               * `top-2` and not a `vh` offset: the anchor is already the chest,
               * measured in metres from the character's own proportions by the
               * scene, so all this needs is the gap between the chip and the
               * body. A viewport-relative nudge was what put the last version on
               * the mouth — 10vh is a different part of a character at every
               * camera distance, and the one distance nobody checked was the one
               * the owner screenshotted.
               */
              className="absolute left-1/2 top-2 flex w-[min(88vw,22rem)] -translate-x-1/2 flex-col items-stretch gap-2 md:w-[min(90vw,54rem)] md:items-center"
            >
              {status}
              {/* With the map open, this anchored cluster carries ONLY the
                  status lines — the map has its own centered surface below,
                  because a 56vh reading sheet hanging from a chest anchor
                  covered the dock and the microphone (measured: three overlaps
                  in the lab's own collision report). */}
              {chipsIn && !mapPanel && chips}
              {/*
                THE FALLBACK PAIR RIDES ITS OWN DIVIDER, DELIBERATELY, RATHER
                THAN JOINING `chips` AS A PLAIN `flex-col` SIBLING.
                A live browser test measured `chips` (the openings) and this
                pair painting at IDENTICAL y-coordinates, text interleaved and
                unreadable, immediately after a failed session-start attempt.
                Round 123 guessed the trigger was `ready && !dockAbove`
                specifically; round-123-follow-up REPRODUCED the collision
                live and found `dockAbove` truthy throughout — see
                `CLUSTER_DOCK_GAP_PX`'s comment above this component for the
                actual mechanism and its fix (this cluster now caps its own
                height against the dock's real, published rect). This divider
                stays regardless, as belt-and-braces for the STRUCTURAL case
                this comment block is actually about: when `!dockAbove` DOES
                hold (no shell, or the dock genuinely absent), the fallback
                pair joins this same flex column as a real sibling of `chips`
                rather than a bare one, so even an unanticipated future
                collision between the two groups reads as "a different list"
                and never as text laid directly over text with no seam.
              */}
              {chipsIn && !dockAbove && (secondary || archive) && (
                <div
                  className="mt-2 flex w-full flex-col items-stretch gap-2 border-t border-outline/50 pt-2 md:items-center"
                >
                  {secondary}
                  {/*
                    THE ARCHIVE IS DELIBERATELY NOT HERE WHILE THE DOCK EXISTS.
                    This cluster is the anchored node `ScreenAnchor` rewrites the
                    transform of on every frame; a 52vh scrolling sheet inside it
                    would be a list flying around the island — it belongs in the
                    portal below instead, beside `secondary`.
                   *
                   * But when there IS no dock, it needs a home here, matching
                   * `secondary` immediately above. Found by adversarial review,
                   * round 27 (2026-08-30, MEDIUM): this branch used to render
                   * `archive` ONLY inside `{chipsIn && dockAbove ? createPortal(...)
                   * : null}` below, with no fallback for `!dockAbove` — unlike
                   * `secondary`, which already has one. In that combination the
                   * "Past conversations" toggle still renders and still flips its
                   * own `aria-expanded`/label on tap, so every outward sign says it
                   * worked, but the archive list itself never appears anywhere:
                   * exactly the §1.14 shape of "a surface that opts out of a
                   * system must be told what the system decided" — this cluster
                   * opts the archive OUT of its own layout without checking
                   * whether the fallback layout (the guaranteed no-stage column
                   * below) actually has it either. No live caller was PROVEN to
                   * hit `ready && !dockAbove` when this was first written (the
                   * dock's portal target mounts before `chipsIn`'s reveal delay
                   * elapses); a later live test found a real collision in this
                   * area but traced it to the cluster's own unbounded height
                   * against the dock's real rect, NOT to `dockAbove` going false
                   * (see `CLUSTER_DOCK_GAP_PX`'s comment above this component) —
                   * `dockAbove` itself was never observed false outside a unit
                   * test that sets it that way on purpose. The divider above is
                   * still the right belt-and-braces for THIS branch, structural
                   * rather than load-bearing for that other bug; see
                   * StageShell.tsx's own dock-pointer-events fix for the sibling
                   * defect the same original live test found close by.
                   */}
                  {archive}
                </div>
              )}
            </div>
          </div>

          {/*
            The two quieter chips, in the microphone's own column. See the note
            on `secondary`: they are not offers, and the 44 px they used to cost
            the chest cluster is the 44 px that decided whether the openings fit
            above the dock at 375 px.
          */}
          {chipsIn && dockAbove
            ? createPortal(
                <>
                  {archive}
                  {secondary}
                </>,
                dockAbove,
              )
            : null}

          {/*
            THE MAP'S OWN SURFACE (Tutor v3). Viewport-anchored and centered,
            never hung from the character: the camera is at the establishing
            shot while it is open (`phases.ts` → `mapOpen`), the island reads
            behind it, and the bottom offset keeps the microphone dock clear —
            the anchored-cluster version measurably covered the dock, the
            archive chips and the orb.

            THE BOTTOM RESERVATION SCALES WITH VIEWPORT HEIGHT, and a flat
            `bottom-60` (240px) did not. Found live at 863x349 (a landscape
            phone's own height, not a fabricated number): `top-[max(4.5rem,
            9vh)]` (72px there) plus a flat 240px left the sheet exactly
            `100vh - 72 - 240 = 37px` tall — its own CONTINUE chip, review
            count and every graph node clipped away, present in the DOM and
            entirely unreachable. §1.11 names this exact failure shape: mobile
            HEIGHT, not only width.

            `clamp(18rem, 27vh, 20rem)` — RAISED from `clamp(11rem, 27vh,
            15rem)`, round 123's own values. That round measured the dock
            WITHOUT `secondary` (My island / Past conversations) populated —
            correct for the phases it was checking, wrong for THIS one:
            `secondary` rides the dock's `above` slot (`StageDockValue`)
            precisely when `chipsIn` is true, which is the SAME flag that
            gates this map panel, so the two are never seen apart from each
            other in practice. Found live, 2026-09-01, three real breakpoints,
            `getBoundingClientRect()` on both the dock and this wrapper, not
            assumed: the dock's real "clear from here down" need is 244px at
            863x349, 264px at 375x812, and 272px at 1280x900 — all comfortably
            past the OLD 240px ceiling, which is why the sheet's own bottom
            edge measurably overlapped the dock's top edge by 32-68px at every
            one of the three, with `secondary`'s two chips squeezed against
            the map's own last visible row. `18rem` (288px) clears the largest
            (272px) with the same ~16px margin round 123's own comment used
            for ITS measurement; `20rem` (320px) keeps the ceiling above the
            new floor so `27vh` still has room to matter on a genuinely tall
            viewport, exactly as before.

            NOT SOLVED HERE: opening "Past conversations" (`archive`, riding
            the SAME `above` slot, ABOVE `secondary`) while this map is also
            open grows the dock further, by an amount `archive`'s own
            `max-h-[52vh]` makes unbounded rather than a second constant to
            measure. Left as a follow-up rather than folded in — reaching for
            `StageDockValue.keepClearOf`'s existing ResizeObserver (built for
            exactly "a surface that simply HAS a height rather than
            publishing one," today used in the other direction — the dock
            clearing a bottom sheet) would be the right shape for a live
            measurement, not another hand-tuned constant.
          */}
          {/*
            `items-start`, ADDED 2026-09-02, AND IT IS THE ONLY PART OF THIS
            SHEET'S SIZE THAT WAS EVER AN ACCIDENT.

            A live test reported the map covering the island down to the
            character's feet. Most of that is deliberate and is left exactly
            as it is: in `introducing` the map IS the home screen, the
            greeting was moved INTO it on purpose (see the plate's own comment
            above), and the map genuinely needs the whole band — measured over
            the real seed, the graph alone is 460 px at learner tier 1, 644 at
            tier 2 and 736 at tier 3, against a band of 531 px at 1280x900 and
            480 px at 390x844. Taking height back from this sheet would push
            the map below the fold, which is the exact failure rounds 123 and
            141 both fixed.

            What was NOT deliberate is that the flex default `align-items:
            stretch` made the plate fill the band whether or not it had
            anything to put there. Measured live at 1280x900 on the lab's own
            three-row map: the sheet painted 531 px tall for 424 px of
            content — 107 px of empty glass over the character, bought
            nothing. It only ever shows up where the band is taller than the
            map (a tall desktop monitor, a small map), which is precisely
            where there was island to give back.

            Round 141's `min-h-[110px]` floor below is unaffected: a
            min-height still wins over a content-derived height, so the "never
            silently collapse to zero" protection it added holds identically.
          */}
          {chipsIn && mapPanel && (
            <div className="pointer-events-none fixed inset-x-0 top-[max(4.5rem,9vh)] bottom-[clamp(18rem,27vh,20rem)] z-20 flex items-start justify-center px-4">
              {/*
                `min-h-[110px]` — the same floor Round 137 measured for the
                answers panel's own "never quite collapse to zero" problem,
                reused rather than re-derived: enough for the greeting line
                plus the CONTINUE chip to stay usable. WITHOUT it, the raised
                bottom reservation above, combined with the 349px-tall case
                that motivated round 123 in the first place, computes a
                NEGATIVE available height (72px top + 288px bottom > 349px
                total) — flexbox clamps that to zero rather than negative,
                which would silently reproduce the exact "entirely
                unreachable" failure this whole wrapper exists to prevent, at
                0px instead of 37px.

                HONESTLY: at that ONE extreme height the floor does not shrink
                the overlap versus the pre-round-140 baseline — measured live,
                77px with the floor against 68px before this round, roughly
                the same collision, not a smaller one. What it changes is the
                FAILURE MODE: the sheet stays at a usable 110px (greeting plus
                the CONTINUE chip, both real DOM and reachable, per this
                file's own "never quite collapse to zero" precedent) instead
                of silently going to zero and taking the CONTINUE chip and
                review count with it. Both breakpoints §1.11 actually mandates
                — 375x812 and 1280x900 — measured CLEAN with real margin
                (24px, 16px) live in this same round; 349px is this testing
                pane's own native size, not one of them, and is left exactly
                as imperfect as it already was rather than pretended fixed.
              */}
              <div className="pointer-events-auto flex max-h-full w-[min(94vw,58rem)] min-h-[110px] justify-center">
                {mapPanel}
              </div>
            </div>
          )}
        </>
      ) : (
        /*
         * The guaranteed arrangement, for a device with no WebGL and for the
         * moment before the first frame.
         *
         * There is no camera to anchor against, so the same chips become an
         * ordinary centred column that scrolls inside itself. In-scene placement
         * is a PRESENTATION of a list and never an excuse for not having one
         * (/DESIGN.md → Grid Systems, the in-scene exemption).
         */
        <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-y-auto overscroll-contain p-4 pb-48">
          {/*
            The same sentence the caption would have carried, on a plate that
            needs no projection. It keeps the aria grammar and drops the
            typewriter: a device that cannot draw the island has no performance
            to keep up with, and a line that types itself out on a fallback
            screen is a delay rather than a character speaking.
          */}
          <HudPlate shape="plate" className="pointer-events-none">
            {/* `lf-speech`, exactly as the caption it stands in for: this is
                still the tutor talking, and a device with no WebGL does not
                make its voice smaller. */}
            <span className="lf-speech" aria-live="polite" aria-atomic="true">
              {greeting}
            </span>
          </HudPlate>
          {status}
          {mapPanel ?? chips}
          {/*
            Inline here whatever the shell is doing. This branch is the no-stage
            arrangement — the dock is a control over a render, and on a device
            with no WebGL there is no render to put controls over.
          */}
          {secondary}
          {archive}
        </div>
      )}

    </>
  );
}

/**
 * `course-slug/topic-slug` → something a child can read.
 *
 * A skill key is an internal identifier and showing it raw ("investing/riesgo
 * -y-rendimiento") makes the tutor look like a database. Titles would be
 * better and are a Core change; this is the honest interim rather than
 * pretending the key is a title.
 */
function readableSkill(skillKey: string): string {
  const topic = skillKey.includes('/') ? skillKey.slice(skillKey.indexOf('/') + 1) : skillKey;
  return topic.replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}
