import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon, Reveal } from '@/components/ui';
import type { CharacterId } from '@/components/characters/control/types';
import { cn } from '@/lib/utils';
import { playPlatformSound } from '@/lib/sound';
import { useAnchorSlot } from '@/tutor-scene/ScreenAnchor';
import { HudPlate } from './hud/HudPlate';
import { micBlockedReason } from './mic';
import { SessionHistory } from './SessionHistory';
import { SpeechCaption } from './SpeechCaption';
import type { OfferLayerProps } from './stage/StageShell';
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

/** One step of the reveal stagger (/DESIGN.md §Motion recipe 2). */
const STAGGER_MS = 80;

/** The closed motion set caps a stagger at three steps. */
const MAX_STAGGER_STEPS = 3;

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
  /** One short line. A chip carries a label, never a paragraph. */
  label: string;
  /** A quieter second line, where the label alone loses the actual subject. */
  detail?: string;
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
  ready,
  character,
  nickname,
}: OfferChipsProps) {
  const { t } = useTranslation();

  /*
   * ONE anchored node for the whole cluster, rather than one `WorldChip` per
   * opening, and the reason is the shot rather than convenience.
   *
   * A `WorldChip` needs a slot of its own, and the only slots a CLOSE-UP frames
   * are the lead's own two: at this distance the five `stage.mark.*` places the
   * picker uses are off to the sides or behind the camera, where the projector
   * correctly hides AND inerts anything pinned to them. Five chips on the one
   * slot that is in frame would stack on a single point. So the cluster rides
   * one anchor and lays itself out, which keeps every chip in the tab order as
   * one ordered list and keeps the whole group culled together when the camera
   * turns away.
   *
   * It rides the HEAD and hangs below it, rather than riding `lead.chest`, and
   * that is measured rather than preferred: a close-up frames roughly 0.7 of the
   * character's height about the mid-head, which puts the published chest point
   * at about 90% of the viewport, underneath the mic orb. Hanging below the head
   * anchor is what puts the chips ON the chest ON SCREEN, which is what
   * /ORACLE.md §9.2 is describing.
   */
  const clusterRef = useAnchorSlot('lead.head');

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
   * COLD START IS THE NORMAL CASE, not an edge case: the courses sit in review,
   * so most learners have almost no evidence attached to them. The tutor says so
   * plainly, in its own voice, and offers a short diagnostic instead of
   * inventing a profile from nothing. That sentence used to be a `warning-soft`
   * banner above a card grid, which is a system telling a child about its own
   * data problem; said by the character it is simply somebody admitting they
   * have not met you yet.
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
    return [hello, note, t('tutor.introduce.ask')].filter(Boolean).join(' ');
  }, [nickname, tutorName, offers.intelDegraded, offers.weakSkills.length, t]);

  const openings = useMemo<Opening[]>(() => {
    const list: Opening[] = [];

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
      const topic = readableSkill(weak.skillKey);
      list.push({
        id: 'weak_skill',
        icon: 'lightbulb',
        label: t('tutor.offers.weakSkill.title'),
        detail: topic,
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

    const faqId = offers.faqIds[0];
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
  }, [offers.weakSkills, offers.faqIds, offers.canAskOpen, t]);

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
        <HudPlate shape="plate" floor="sunken" className="pointer-events-none">
          <span className="lf-caption" role="status">
            {t('tutor.page.tutorUnavailable')}
          </span>
        </HudPlate>
      )}
      {startError && (
        <HudPlate shape="plate" floor="sunken" className="pointer-events-none">
          <span className="lf-caption" role="status">
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
    <>
      <div
        role="group"
        aria-label={t('tutor.introduce.offersLabel')}
        className="flex flex-wrap items-center justify-center gap-2"
      >
        {openings.map((opening, index) => (
          <Reveal key={opening.id} delay={Math.min(index, MAX_STAGGER_STEPS) * STAGGER_MS}>
            <HudPlate
              as="button"
              shape="chip"
              floor="surface"
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
              className={cn('pointer-events-auto', disabled && 'opacity-60')}
            >
              <Icon name={opening.icon} className="text-primary" />
              <span className="flex flex-col items-start text-left">
                <span className="lf-label">{opening.label}</span>
                {opening.detail && <span className="lf-caption text-content-muted">{opening.detail}</span>}
              </span>
            </HudPlate>
          </Reveal>
        ))}
      </div>

      {/*
        The two things a learner may want that are not an opening. They are
        quieter on purpose: during this phase the microphone is the one action
        (/DESIGN.md → Screen Recipes → Tutor), so these are secondary and an
        opening chip is not a second CTA either.
      */}
      <div
        role="group"
        aria-label={t('tutor.introduce.moreLabel')}
        className="flex flex-wrap items-center justify-center gap-2"
      >
        <HudPlate
          as="button"
          shape="chip"
          floor="sunken"
          onClick={onPersonalize}
          className="pointer-events-auto"
        >
          <Icon name="landscape" className="text-content-muted" />
          <span className="lf-caption">{t('tutor.page.changeStage')}</span>
        </HudPlate>

        <HudPlate
          as="button"
          shape="chip"
          floor="sunken"
          aria-expanded={replaysOpen}
          onClick={() => setReplaysOpen((open) => !open)}
          className="pointer-events-auto"
        >
          <Icon name="history" className="text-content-muted" />
          <span className="lf-caption">
            {replaysOpen ? t('tutor.introduce.hideReplays') : t('tutor.introduce.replays')}
          </span>
        </HudPlate>
      </div>
    </>
  );

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
               * Hanging below the head, and WIDER on desktop so the openings
               * sit in one row across the character's chest instead of in a
               * column down its face. At 375 px the same cluster is narrow
               * enough to wrap to two rows, which is the composition changing
               * rather than the product changing.
               *
               * It hangs BELOW rather than sitting on the anchor because a
               * close-up frames about 0.7 of the character's height about the
               * mid-head: at that distance the published chest point is around
               * 90% of the viewport, underneath the mic orb.
               */
              className="absolute left-1/2 top-[10vh] flex w-[min(88vw,22rem)] -translate-x-1/2 flex-col items-center gap-2 md:w-[min(80vw,44rem)]"
            >
              {status}
              {chipsIn && chips}
            </div>
          </div>
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
          <HudPlate shape="plate" floor="surface" className="pointer-events-none">
            <span className="lf-body" aria-live="polite" aria-atomic="true">
              {greeting}
            </span>
          </HudPlate>
          {status}
          {chips}
        </div>
      )}

      {replaysOpen && (
        /*
         * Saved conversations, opened deliberately and closed again.
         *
         * It is a list of cards over the island, which is the silhouette this
         * whole rebuild is removing, and it is acceptable ONLY because a
         * learner asked for it: nothing about the arrival screen is a list.
         * /ORACLE.md §12's replay becomes stones on the island's shore and a
         * camera move down to one; until then, dropping the feature outright
         * would take away conversations a child already has.
         */
        <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-40 max-h-[70vh] overflow-y-auto overscroll-contain p-4">
          <HudPlate shape="sheet" floor="surface" className="mx-auto">
            {/*
              The plate's own floor centres its content, which is right for a
              one-line chip and wrong for a list. The list sets its own
              alignment rather than the primitive growing a variant for it.
            */}
            <div className="flex w-full flex-col gap-3 text-left">
              <span className="lf-title text-content">{t('tutor.history.title')}</span>
              <SessionHistory token={token} />
              <div className="flex justify-center">
                <HudPlate as="button" shape="chip" floor="sunken" onClick={() => setReplaysOpen(false)}>
                  <span className="lf-caption">{t('tutor.introduce.hideReplays')}</span>
                </HudPlate>
              </div>
            </div>
          </HudPlate>
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
