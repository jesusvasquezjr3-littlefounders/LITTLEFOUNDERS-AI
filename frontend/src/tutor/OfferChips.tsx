import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui';
import type { CharacterId } from '@/components/characters/control/types';
import { cn } from '@/lib/utils';
import { playPlatformSound } from '@/lib/sound';
import { useAnchorSlot } from '@/tutor-scene/ScreenAnchor';
import { HudPlate } from './hud/HudPlate';
import { micBlockedReason } from './mic';
import { SessionHistory } from './SessionHistory';
import { SpeechCaption } from './SpeechCaption';
import { useStageDock, type OfferLayerProps } from './stage/StageShell';
import type { StartSessionInput } from './tutorApi';

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
}

export function OfferChips({
  offers,
  starting,
  startError,
  onStart,
  onPersonalize,
  token,
  onReplay,
  ready,
  character,
  nickname,
}: OfferChipsProps) {
  const { t } = useTranslation();
  const dock = useStageDock();

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
        <HudPlate shape="plate" className="pointer-events-none self-center">
          <span className="lf-body" role="status">
            {t('tutor.page.tutorUnavailable')}
          </span>
        </HudPlate>
      )}
      {startError && (
        <HudPlate shape="plate" className="pointer-events-none self-center">
          <span className="lf-body" role="status">
            {/* An error CODE, never a wire message: an untranslated server
                string on a child's screen is both an i18n violation and a leak
                of internal wording. */}
            {t(`tutor.startError.${startError}`, { defaultValue: t('tutor.startError.INTERNAL') })}
          </span>
        </HudPlate>
      )}
    </>
  );

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
      {ready ? (
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
          <SpeechCaption text={greeting} turnSeq={ready ? 1 : 0} />

          <div
            ref={clusterRef}
            /*
             * Zero-sized on purpose. The projector writes this node's whole
             * transform every frame and ends it with `translate(-50%, -50%)`,
             * so a box with no size centres exactly on the published point and
             * the child below is free to hang off it without fighting that
             * centring. Nothing here may add a transform of its own.
             */
            className="pointer-events-none fixed left-0 top-0 z-20 h-0 w-0 will-change-transform"
          >
            <div
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
              {chipsIn && chips}
              {chipsIn && !dockAbove && secondary}
              {/*
                THE ARCHIVE IS DELIBERATELY NOT HERE. This cluster is the
                anchored node `ScreenAnchor` rewrites the transform of on every
                frame; a 52vh scrolling sheet inside it would be a list flying
                around the island. Where there is no dock the archive belongs to
                the guaranteed column below, which is the arrangement a device
                without a stage actually gets.
              */}
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
          {chips}
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
