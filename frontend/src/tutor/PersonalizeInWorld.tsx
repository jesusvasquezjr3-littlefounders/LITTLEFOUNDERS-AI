import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Field, Icon } from '@/components/ui';
import type { CharacterId } from '@/components/characters/control/types';
import { playPlatformSound } from '@/lib/sound';
import { cn } from '@/lib/utils';
import { castMarks, type AnchorId } from '@/tutor-scene/anchors';
import { useAnchorSlot } from '@/tutor-scene/ScreenAnchor';
import { useSafeArea } from '@/tutor-scene/SafeAreaContext';
import { HudPlate } from '@/tutor/hud/HudPlate';
import { useDesktopPlate } from '@/tutor/hud/LessonPlate';
import { useHudOcclusion, WorldChip } from '@/tutor/hud/WorldChip';
import { useStageDock, type PersonalizeLayerProps } from './stage/StageShell';
import type { Adaptation } from './types';

/*
 * Personalization, in the world it configures (/ORACLE.md §10).
 *
 * WHAT THIS REPLACED, AND WHY. The previous version was a form: a grid of
 * character cards, pill buttons for the island and the light, a text input and
 * five checkboxes, laid out in five `<section>` blocks. Every one of those
 * controls worked. The owner still rejected it, twice, and the second time
 * named the exact fault: it read as "una configuracion de uso" rather than as
 * a place. A thumbnail of an island is a PROMISE that the island will change;
 * the island itself changing is the thing. Those two look identical in a code
 * review and nothing alike on a screen, which is why the backdrop axis could
 * ship for weeks as a control that changed no light and pass every gate.
 *
 * SO EVERY CHOICE IS MADE WHILE STANDING IN WHAT IT CHANGES. The candidates are
 * chips at the stage marks around the island, and picking one puts that
 * character on the island at full size, lit by the light you chose, on the
 * island you are standing on. The island is changed by walking to the other one
 * at a rim pad. The light is changed by moving the sun along its arc. Nothing
 * here previews; everything here IS.
 *
 * IT IS AN INVITATION, NOT A TOLL GATE. Every axis saves the moment it is
 * touched, so there is no draft to reconcile, no "save" step, and no way to
 * lose a choice by leaving. A learner who wants to start is one press from
 * starting, and the returning learner never sees this layer at all.
 *
 * THE CANDIDATES ARE REALLY THERE. This layer asks the shell for an audition
 * (`TutorExperience` → `audition`), so during this phase the WHOLE cast stands
 * on the island and each name plate rides the crown of the person it names
 * (`anchors.ts` → `castMarks`, shared with the scene so the two cannot drift).
 * Before that, the plates hung at the stage marks while the scene rendered only
 * the tutor and their companion, so two of the four floated over empty grass:
 * the ring LOOKED like choosing by looking, and was a menu laid out in world
 * coordinates. A candidate the placement solver cannot seat publishes no
 * anchor, so their plate is hidden AND inert rather than pointing at nobody,
 * and the list on the plate is where they stay reachable.
 *
 * WHAT IT STILL CANNOT DO, stated plainly rather than faked. A HUD layer renders
 * DOM over the shell's single canvas and never mounts a scene
 * (`stage/StageShell.tsx`), so it cannot attach an R3F `onClick` to a character
 * mesh. The plate over each candidate's head is the pick surface until the scene
 * owns pick proxies; it dispatches the handler the mesh will dispatch, and it is
 * already the accessible half of that pair, so the mesh can be added without
 * touching this file.
 */

/**
 * The sun: ONE marker on the arc, not four labels in the sky.
 *
 * It used to be four `WorldChip`s on `sky.mark.0..3`, each naming a time of day,
 * plus a sentence on whichever was lit explaining that choosing it again went
 * back to following the app theme. Measured on `/dev/tutor-lab` at 375x812 that
 * is four of the twelve surfaces on the phase, hanging in blank sky above a
 * 12%-of-the-viewport island — a menu drawn in world coordinates, which is the
 * exact failure /ORACLE.md §10 already names for thumbnail grids.
 *
 * One marker, and tapping it moves the sun on to the next light. That is what a
 * sun on an arc DOES, it costs one label instead of four, and it makes "follow
 * my theme" an ordinary stop on the cycle rather than a hidden gesture that
 * needed its own sentence to be discoverable at all. Choosing a specific light
 * directly is what the panel's list is for, and that list is the guaranteed path
 * every world control already has (/DESIGN.md → Components → WorldChip).
 *
 * `sky.mark.2` is the middle of the five, so the sun sits near the apex of the
 * arc rather than off at one end of it. The other four marks stay free: two
 * nodes published on one anchor project to the same pixel with no way for either
 * to know, and headroom is how that stays impossible when the next phase wants a
 * rune.
 */
const SUN_MARK_ID = 'sky.mark.2' as const satisfies AnchorId;

/** The light that follows the app's own theme rather than naming an hour. */
const THEME_LIGHT = 'auto';

/**
 * The same rule the server enforces, applied before the round trip so the
 * learner is corrected by the field they are typing in rather than by a
 * rejected save. Letters and digits from any script, because the nickname is
 * written in three locales and a Latin-only rule would silently exclude two.
 */
const NICKNAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} '_-]*$/u;

/**
 * How long the stage may fail to report a first frame before the plate's panel
 * opens by itself.
 *
 * Matched to the shell's own veil timeout on purpose. A device with no WebGL
 * renders an honest "this device cannot show 3D" line instead of a canvas, so
 * no anchor is ever published, so every world chip stays culled — correctly,
 * because there is nothing on screen for it to point at. Without this the
 * learner on that device would have a personalization screen with nothing on
 * it. The two timers agreeing means the list arrives in the same moment the
 * veil lifts, rather than a beat after the learner has already decided the page
 * is broken. The list itself is always THERE — it is the guaranteed twin of
 * every world chip — so what this timer decides is whether it is open, not
 * whether it exists.
 */
const STAGE_GRACE_MS = 8000;

/*
 * THE CANDIDATES' PLATES DO NOT PILE UP ANY MORE, and the mechanism is in the
 * projector rather than here (`ScreenAnchor` → `stack`, `culling.ts` →
 * `stackClearance`). Each plate rises until it is clear of the plates already
 * placed this frame, so it stays over its own character's head and never sits
 * on a neighbour's label.
 *
 * WHY NOT A LADDER IN CSS. That was written first — a fixed 64 px step per
 * candidate — and it was correct in the screenshot that justified it and wrong a
 * few seconds later. `SHOT_AMBIENT` orbits this phase's shot, so the crowns
 * travel continuously across the frame: at one bearing four rungs are needed and
 * at the next the cast is spread and every rung is sky spent for nothing — sky
 * the sun's own arc is using. A per-frame answer costs nothing when nobody is
 * overlapping, which at 1280x800 is most of the time.
 */

export function PersonalizeInWorld({
  preferences,
  catalog,
  saving,
  ready,
  onSave,
  onDone,
}: PersonalizeLayerProps) {
  const { t } = useTranslation();
  const adaptHeadingId = useId();
  const panelId = useId();
  const safeArea = useSafeArea();
  const dock = useStageDock();
  const desktop = useDesktopPlate();

  /*
   * The nickname is the ONE value with a draft, because it is the one value a
   * learner produces a keystroke at a time. Everything else is a discrete pick
   * and goes straight to `onSave`, which the experience applies optimistically:
   * that is the whole mechanism by which the island changes under the finger.
   */
  const [nickname, setNickname] = useState(preferences.nickname ?? '');
  const [nicknameError, setNicknameError] = useState<string | null>(null);

  /*
   * THE FIVE AXES WITH NO DRAFT SHARE ONE ERROR SLOT, because they share one
   * failure mode. Unlike the nickname, none of `chooseTutor`, `toggleCompanion`,
   * `goToIsland`, `setLight` or `toggleAdaptation` holds a value this component
   * owns — each writes straight to `preferences` through `onSave`, which
   * `persistPreferences` (`TutorExperience.tsx`) applies optimistically and
   * ROLLS BACK to the exact prior value the instant the server refuses it. So a
   * rejection here never leaves a truth/display mismatch behind the way an
   * unsaved nickname draft would — `preferences` is already correct again by
   * the time this runs. What was missing was never a state repair, only that
   * the child was never told the tap did nothing, so the picker read as
   * working when a save was silently discarded.
   *
   * Found by adversarial review, sweep 92 (2026-08-31, MEDIUM): every one of
   * these five handlers fired `void onSave(...)` and never looked at the
   * `Promise<boolean>` it got back — exactly the bug round 38 fixed for the
   * nickname, on every OTHER axis at once.
   */
  const [pickError, setPickError] = useState<string | null>(null);

  /*
   * WHAT THE PLATE PERSISTENTLY SHOWS: one press, and a way to open the rest.
   *
   * The plate was rejected as a form and then rebuilt as the same form in a
   * corner — a labelled field with a hint and an error slot, a heading with a
   * help paragraph, a two-column grid of chips, a saving line and a full-width
   * button. Everything on it worked; the SILHOUETTE was the complaint both
   * times. So the only thing standing on the island at all times is the one
   * thing a learner must be able to do, and everything else is either out in
   * the world or one press away behind this.
   */
  const [open, setOpen] = useState(false);

  /*
   * `listed` is the no-stage state, and it is a real state rather than a
   * defensive one (/DESIGN.md → Grid Systems → the in-scene exemption names the
   * ordinary card grid as the fallback arrangement). With no island, every world
   * chip is culled — correctly, since there is nothing on screen for it to point
   * at — so the panel is OPENED rather than merely made available: a learner on
   * a device with no WebGL would otherwise be looking at a start button and an
   * empty screen.
   */
  const [listed, setListed] = useState(false);
  useEffect(() => {
    if (ready) {
      setListed(false);
      return;
    }
    const timer = window.setTimeout(() => setListed(true), STAGE_GRACE_MS);
    return () => window.clearTimeout(timer);
  }, [ready]);

  useEffect(() => {
    // Opened for them, never closed on them: a learner who opened the panel and
    // then watched the island arrive keeps it open.
    if (listed) setOpen(true);
  }, [listed]);

  /*
   * The plate is the one large opaque surface on the screen, so it registers
   * with the safe-area channel and the camera composes the cast into the band
   * beside it rather than behind it. It had never registered at all, which is
   * why the director was solving a frame with a 420 px hole in it that it could
   * not see.
   *
   * Below `lg:` it is a bottom surface instead of a corner one, so the
   * microphone dock rides above it. Above `lg:` the dock has already moved into
   * the free width to its left, and pushing it up as well would float the orb
   * in the middle of the sky.
   */
  const measureLesson = safeArea?.measure('lesson');
  const keepClearOf = dock?.keepClearOf;
  const attachPlate = useCallback(
    (node: HTMLElement | null) => {
      measureLesson?.(node);
      keepClearOf?.(desktop ? null : node);
    },
    [measureLesson, keepClearOf, desktop],
  );

  /*
   * And the corner claim, the other half of the same fact.
   *
   * `keepClearOf` above says "the dock rides above me" and is only true below
   * `lg:`; this says "the dock centres itself to my LEFT" and is only true
   * above it. They are mutually exclusive by construction, which is the shape
   * the shell used to encode as a phase constant and could not keep true once
   * the lesson plate learned to stand down (`StageDockValue.setCornerPlate`).
   * Unlike `LessonPlate` this plate has no stood-down state — its resting row
   * is the way in to everything else on the phase and is always mounted — so
   * the desktop breakpoint is the whole condition.
   */
  const setCornerPlate = dock?.setCornerPlate;
  useEffect(() => {
    setCornerPlate?.(desktop);
    return () => setCornerPlate?.(false);
  }, [setCornerPlate, desktop]);

  const characters = catalog.characters;
  const lead = preferences.character;
  const companion = preferences.companion;

  const castRing = useMemo(() => {
    const marks = castMarks(characters.length);
    return marks.flatMap((slot, index) => {
      const id = characters[index];
      return id ? [{ slot, id }] : [];
    });
  }, [characters]);

  /*
   * Every light the sun passes through, `auto` first.
   *
   * Ordered by NAME rather than by the catalog's own order for the one entry
   * that is not a time of day: the catalog is server-driven and its order is not
   * a contract, so a reorder must never drop "follow my theme" into the middle
   * of dawn-day-dusk-night. Everything after it keeps the catalog's order, which
   * IS the arc.
   */
  const sunCycle = useMemo(() => {
    const times = catalog.backdrops.filter((id) => id !== THEME_LIGHT);
    return catalog.backdrops.includes(THEME_LIGHT) ? [THEME_LIGHT, ...times] : times;
  }, [catalog.backdrops]);

  /** The light the sun moves to when it is tapped. */
  const nextLight = useMemo(() => {
    if (sunCycle.length === 0) return undefined;
    const here = sunCycle.indexOf(preferences.backdrop);
    return sunCycle[(here + 1) % sunCycle.length];
  }, [sunCycle, preferences.backdrop]);

  /*
   * Where the rim pads lead. Cycling rather than "the other one" so a third
   * island is content work and not a frontend release, which is the same
   * assumption the catalog itself is built on.
   */
  const dioramas = catalog.dioramas;
  const here = Math.max(0, dioramas.indexOf(preferences.diorama));
  const nextIsland = dioramas.length > 1 ? dioramas[(here + 1) % dioramas.length] : undefined;
  const previousIsland =
    dioramas.length > 2 ? dioramas[(here - 1 + dioramas.length) % dioramas.length] : undefined;

  /*
   * THE PANEL CARRIES EVERY CHOICE, ALWAYS, and that is the reachability
   * guarantee rather than a duplicate.
   *
   * It used to carry only the OVERFLOW — the characters and lights the ring had
   * no mark for — which quietly assumed every anchored control gets projected.
   * They do not: a candidate the placement solver cannot seat publishes no
   * anchor, a camera move culls whatever leaves the frame, and a device with no
   * WebGL culls all of them at once. Each of those is a choice the learner can
   * no longer make, and the layer had no way to know it had happened. The list
   * is the WorldChip contract applied to a whole phase (/DESIGN.md → Components
   * → WorldChip): the in-world plate is the delightful path, this is the
   * guaranteed one, and both dispatch the same handler.
   */
  const listedCharacters = characters;
  const listedSun = sunCycle;
  const listedIslands = dioramas;

  const nameOf = (id: CharacterId) => t(`tutor.character.${id}.name`);
  const islandName = (id: string) => t(`tutor.diorama.${id}`, { defaultValue: id });
  const lightName = (id: string) => t(`tutor.backdrop.${id}`, { defaultValue: id });
  const noteFor = (id: CharacterId) =>
    catalog.articulates.includes(id)
      ? t(`tutor.character.${id}.blurb`)
      : // Said out loud rather than discovered: a learner who picks Liruf and
        // then wonders why his mouth never moves has been misled, and one who
        // was told he talks with his whole body has been given a choice.
        t('tutor.personalize.bodyTalker');

  /**
   * Surfaces a rejected pick the same way `commitNickname` surfaces a rejected
   * nickname: an inline alert, in the one panel every axis already renders
   * into. Forces the panel open, because four of the five callers below have a
   * WORLD control as well as a panel row (`chooseTutor`, `toggleCompanion`,
   * `goToIsland`, `setLight`; `toggleAdaptation` is panel-only), and a message
   * rendered only inside a closed panel is not feedback a learner can see.
   *
   * Deliberately does NOT block the "I'm ready" press the way a rejected
   * nickname does. Nickname blocks continuing because leaving would carry an
   * OPTIMISTIC value the server never actually stored. These five axes have no
   * draft: `persistPreferences` (`TutorExperience.tsx`) rolls `preferences`
   * back to the exact prior value the instant the server refuses a patch, so by
   * the time this runs the displayed state is already true again — there is
   * nothing stale left for "I'm ready" to carry forward, only a message worth
   * showing.
   *
   * Found by adversarial review, sweep 92 (2026-08-31, MEDIUM): every one of
   * `chooseTutor`, `toggleCompanion`, `goToIsland`, `setLight` and
   * `toggleAdaptation` fired `void onSave(...)` and never looked at the
   * `Promise<boolean>` it got back — exactly the bug round 38 fixed for the
   * nickname, on every OTHER axis at once.
   */
  const reportIfRejected = (saved: boolean) => {
    if (saved) return;
    setPickError(t('tutor.personalize.pickRejected'));
    setOpen(true);
  };

  const chooseTutor = async (id: CharacterId) => {
    if (id === lead) return;
    playPlatformSound('tutor_chip');
    setPickError(null);
    const saved = await onSave({
      character: id,
      /*
       * A companion who is also the tutor would put one character on the island
       * twice, and `useSceneModel` deliberately does not clone the loaded scene,
       * so the second mount would fight the first over a single object. Clearing
       * it silently is kinder than an error the learner has to go and fix.
       */
      ...(companion === id ? { companion: null } : {}),
    });
    reportIfRejected(saved);
  };

  const toggleCompanion = async (id: CharacterId) => {
    if (id === lead) return;
    playPlatformSound('tutor_chip');
    setPickError(null);
    const saved = await onSave({ companion: companion === id ? null : id });
    reportIfRejected(saved);
  };

  const goToIsland = async (id: string) => {
    if (id === preferences.diorama) return;
    // The move is the choice, so it gets the travel cue rather than the pick one.
    playPlatformSound('tutor_camera');
    setPickError(null);
    const saved = await onSave({ diorama: id });
    reportIfRejected(saved);
  };

  /*
   * One light, chosen outright.
   *
   * "Press the lit one again to go back to following the app theme" is gone
   * with the four sky chips it was invented for: `auto` is a stop on the sun's
   * own cycle and a row in the list below, so it is picked the same way every
   * other light is. That deleted a rule, a sentence in three locales, and the
   * only affordance on this phase a learner could not see.
   */
  const setLight = async (id: string) => {
    if (id === preferences.backdrop) return;
    playPlatformSound('tutor_chip');
    setPickError(null);
    const saved = await onSave({ backdrop: id });
    reportIfRejected(saved);
  };

  const toggleAdaptation = async (adaptation: Adaptation) => {
    playPlatformSound('tutor_chip');
    setPickError(null);
    const on = preferences.adaptations.includes(adaptation);
    const saved = await onSave({
      adaptations: on
        ? preferences.adaptations.filter((entry) => entry !== adaptation)
        : [...preferences.adaptations, adaptation],
    });
    reportIfRejected(saved);
  };

  /**
   * Validates and persists the nickname. Returns whether it actually landed,
   * so the same function can guard the press that leaves this layer.
   *
   * Found by adversarial review, round 38 (2026-08-30, HIGH): this used to
   * return `true` the instant `onSave` was CALLED, not once it actually
   * succeeded — the format check here cannot replicate the backend's
   * real-name check (it has no access to the learner's `display_name`), so
   * a clean-looking value like "Ana Vasquez" sailed past this function,
   * `onSave` fired, and the "I'm ready" button closed the picker as if it
   * had worked, while the server had actually rejected it and the
   * optimistic value never really saved.
   */
  const commitNickname = async (): Promise<boolean> => {
    const value = nickname.trim();
    if (value !== '' && !NICKNAME_PATTERN.test(value)) {
      setNicknameError(t('tutor.personalize.nicknameInvalid'));
      return false;
    }
    setNicknameError(null);
    const next = value === '' ? null : value;
    if (next === preferences.nickname) return true;
    const saved = await onSave({ nickname: next });
    if (!saved) setNicknameError(t('tutor.personalize.nicknameRejected'));
    return saved;
  };

  return (
    <>
      {/*
        THE CAST. The ring keeps every candidate at the same mark for the whole
        phase, whoever is currently chosen: a chip that jumped to a new place
        when you picked it would make the next choice a hunt.
      */}
      <div role="group" aria-label={t('tutor.personalize.whoTitle')}>
        {castRing.map(({ slot, id }) => {
          const isLead = id === lead;
          const isCompanion = id === companion;
          /*
           * ONE PERSON, ONE LABEL, AND THE LABEL IS THE NAME.
           *
           * The role used to live on a SECOND anchored chip over the same
           * character's mid-head, then on a quiet second line of this plate.
           * Both are gone, and the second one went on 2026-08-22 as the first
           * application of the material's one-ink rule (/DESIGN.md §Lumen →
           * Type): a line that has to be quieter than the line above it to
           * earn its place is a line to delete.
           *
           * It is also a MEASUREMENT. A world plate is 48 px tall now and can
           * no longer be shrunk under the tap floor, so the two-line version
           * put Liruf's whole cluster past the right edge of a 375 px frame and
           * the audition lost a candidate — the exact bug the audition exists
           * to prevent. One line brings him back.
           *
           * Nothing is lost that a learner needs: the chosen tutor wears the
           * material's selection ring and announces `aria-pressed`, the
           * companion has the dismiss control standing beside them, and the
           * panel's list carries every candidate's full description in a
           * column that has room for one.
           */
          return (
            <WorldSlot key={id} slot={slot}>
              <HudPlate
                as="button"
                /*
                 * A CHIP, NOT A PLATE, AND THE NOTE HAS MOVED TO THE PANEL.
                 * `noteFor` is one short sentence about how a character
                 * performs, and it was what made these 108-197 px wide — wide
                 * enough that at 375 px each plate covered its neighbours'
                 * characters as well as their plates. It is not lost: it reads
                 * better in the panel's list, where the rows are a column and
                 * have the width for a second line, and that list is the path
                 * every candidate is reachable through anyway.
                 */
                shape="chip"
                onClick={() => void chooseTutor(id)}
                aria-label={t('tutor.personalize.chooseTutor', { name: nameOf(id) })}
                aria-pressed={isLead}
                // Through the material, never `ring-2`: a Tailwind ring writes
                // `box-shadow` and utilities outrank components, so it would
                // erase the plate's edge, its specular lip and the shadow that
                // seats it in the scene.
                selected={isLead}
                className="pointer-events-auto"
              >
                <span className="lf-action">{nameOf(id)}</span>
              </HudPlate>

              {/*
                ONE ORB IN THE WORLD, AND IT BELONGS TO WHOEVER IS ALREADY
                STANDING WITH YOU.

                A SIBLING, not a child: the tutor pick and the companion toggle
                are two different answers about one character, and a button
                inside a button is invalid HTML that browsers resolve by
                dropping one of the two handlers.

                It used to be mounted for all three non-tutors, which put a
                second control on every candidate's row and made each row 42 px
                wider than the name it carries. Three of the seven overlaps
                measured at 375x812 involved one of those orbs, and the last one
                left at 1280x800 was Dina's INVITE orb sitting across Dr. Rho's
                plate — 27x35 px, with the two crowns only 48 px apart at that
                camera distance. The invite is not lost: it is in the panel's
                list, on the same row as the candidate, dispatching this same
                handler. What stays out here is "tap them again and they leave",
                which is the gesture the owner asked for and the one
                /ORACLE.md §10 describes, and it can only apply to somebody who
                is already here.
              */}
              {isCompanion && (
                <HudPlate
                  as="button"
                  shape="orb"
                  onClick={() => void toggleCompanion(id)}
                  aria-label={t('tutor.personalize.dismissCompanion', { name: nameOf(id) })}
                  aria-pressed
                  selected
                  className="pointer-events-auto"
                  /*
                   * 48, matching HudPlate's own interactive floor. An anchored
                   * control is multiplied by its distance from the camera, and
                   * `ScreenAnchor` clamps that scale against 44 — so a control
                   * authored at exactly 44 pins its whole cluster to full size,
                   * which pushed Liruf's plate off a 375 px frame entirely. The
                   * depth cue needs the 4 px of headroom to exist in.
                   */
                  floorClassName="h-12 w-12"
                >
                  <Icon name="person_remove" />
                </HudPlate>
              )}
            </WorldSlot>
          );
        })}
      </div>

      {/*
        THE TWO CHIPS THAT USED TO BE HERE ARE GONE, and their absence is the fix
        rather than a deletion.

        One rode `lead.head` saying the tutor's name and "Your tutor"; the other
        rode `companion.head` saying the companion's name and "Here with you",
        and dismissed them when tapped. Both named a character who ALREADY had a
        plate over their crown, four fifths of a head higher up — measured at
        1280x800 as two "Dr. Rho" plates 67 px apart and two "Liruf" plates 63 px
        apart, which is four labels for two people on a screen whose whole
        problem was too many labels. Both facts moved onto the candidate's own
        plate above: the role is a line on it, and "tap them again and they
        leave" is the add/remove control standing beside it, which rides the same
        crown and dispatches the same handler it always did.
      */}

      {/*
        THE ISLAND, changed by going to it. The pad names where it leads rather
        than what it is, because the learner is being offered a walk and not a
        setting. With exactly two islands there is only one elsewhere to go, so
        there is one pad; a third island turns the left pad on by itself.
      */}
      {(nextIsland || previousIsland) && (
        <div role="group" aria-label={t('tutor.personalize.whereTitle')}>
          {previousIsland && (
            <WorldChip
              slot="island.rim.left"
              onSelect={() => void goToIsland(previousIsland)}
              label={t('tutor.personalize.goToIsland', { name: islandName(previousIsland) })}
              /* See the note on the sun below: same set, same clearance. */
              stack
            >
              <span className="lf-action">{islandName(previousIsland)}</span>
            </WorldChip>
          )}
          {nextIsland && (
            <WorldChip
              slot="island.rim.right"
              onSelect={() => void goToIsland(nextIsland)}
              label={t('tutor.personalize.goToIsland', { name: islandName(nextIsland) })}
              /*
               * AND THE RIM PAD STACKS TOO, which is the sibling of the sun's
               * bug and was left behind when the sun's was fixed.
               *
               * Every anchored surface on this phase is a peer of every other:
               * the pad sits on the island's rim and a candidate stands close
               * to it, so at some bearings the pad's plate lands on a name.
               * Measured on `/dev/tutor-lab` at 375x812 while walking the
               * journey with the ambient orbit stopped — "Go to Stone circle"
               * across "Talk with Dina" by 51 x 18 px, and across the dismiss
               * orb beside her by 44 x 18. A clearance rule that half the set
               * opts into is not a clearance rule.
               */
              stack
            >
              <span className="lf-action">{islandName(nextIsland)}</span>
            </WorldChip>
          )}
        </div>
      )}

      {/*
        THE LIGHT: ONE SUN, AND TAPPING IT MOVES THE SUN ON.

        Four labelled stops used to hang across the sky here, and the measurement
        that ended them is on `SUN_MARK_ID`: at 375x812 they were four of the
        twelve surfaces on this phase, in blank sky, above an island painting 12%
        of the viewport. An arc seen edge-on is also a point, so the four spent
        most of the camera's orbit rising off each other on the stacking rule
        rather than sitting where the sun would be.

        The marker shows the light that is on NOW, because that is the fact a
        learner needs from a label; where it is going is on the button's own
        accessible name, so a screen-reader user is told the outcome before they
        press. Every light remains directly pickable in the panel's list, which
        is the guaranteed twin of every world control on this route.
      */}
      {nextLight && (
        <WorldChip
          slot={SUN_MARK_ID}
          onSelect={() => void setLight(nextLight)}
          label={t('tutor.personalize.lightNext', { name: lightName(nextLight) })}
          /*
           * IT STACKS, AND IT DID NOT, WHICH IS WHY IT LANDED ON DINA.
           *
           * `stack` opts a node into the projector's per-frame clearance pass,
           * and it was set on the four candidate plates and not on this one — so
           * the cast rose off each other and the sun sat wherever the arc put
           * it, which at some bearings is on top of a candidate. Measured on
           * `/dev/tutor-lab` at 375x812: this chip at (187, 290, 72, 44) across
           * "Dina" at (208, 314, 59, 44), a 20 px overlap on the name of a
           * character the learner is being asked to choose. Clearance is a
           * property of a SET of peers, and the sun is a peer of the cast
           * whether or not it is one of them.
           */
          stack
        >
          <Icon name={preferences.backdrop === 'night' ? 'bedtime' : 'wb_sunny'} />
          <span className="lf-action">{lightName(preferences.backdrop)}</span>
        </WorldChip>
      )}

      {/*
        THE ONE PLATE, and the only thing this layer anchors to the viewport
        rather than to the world.

        /ORACLE.md §10 names it as the exception and says why: a text field
        cannot be in-world. A caption riding a projected point is a delight; an
        input doing it while you type in it is motion sickness, and it would be
        culled out from under a learner's fingers the moment the camera turned.

        WHAT IS PERSISTENTLY ON IT IS ONE PRESS. The rejected silhouette was a
        form: a labelled field with a hint and an error slot, a heading with a
        help paragraph, a two-column grid of chips, a saving line and a
        full-width button — moved into a corner and still a form. So the resting
        state of this plate is a row: the way in to everything else, and the one
        thing a learner must be able to do. The rest is revealed on demand and
        is opened FOR them whenever the island cannot be shown.
      */}
      <aside
        ref={attachPlate}
        aria-label={t('tutor.personalize.aboutYou')}
        /*
         * Edge insets rather than a computed width: `hud-inset` is 16px at
         * 375px and 24px on desktop, and pinning both edges below `lg:` gives
         * the plate the whole line without a `calc()` to get wrong. Desktop
         * takes the recipe's `plate-max` off the right edge — expressed as a
         * `min()` against the viewport, never as a bare `420px`, because a
         * fixed pixel width for structural layout is what §1.11 restricts and
         * because a 420px box inset 24px does not fit a 440px window.
         *
         * `lg:`, matching `LessonPlate`: the two surfaces take the same corner
         * and must change form at the same width, or between 768px and 1024px
         * one of them is in the corner while the microphone is still centred
         * underneath it.
         */
        className="pointer-events-auto fixed bottom-4 left-4 right-4 z-30 flex flex-col items-stretch gap-2 lg:bottom-6 lg:left-auto lg:right-6 lg:w-[min(420px,calc(100vw-3rem))]"
      >
        {open && (
          <HudPlate
            shape="sheet"
            id={panelId}
            /*
             * The measure override is deliberate and is the only one in the
             * file. `HudPlate` measures in `ch` because almost everything it
             * wraps is a label that must not truncate in the third locale; this
             * panel holds a text field and rows of chips, and its width is set
             * by the recipe's `plate-max` on the element above. Left as-is the
             * frame would cap at 44ch inside a 420px box and sit visibly
             * off-centre against the viewport edge it is inset from.
             */
            className="w-full !max-w-none"
            /*
             * The bangs are load-bearing. `HudPlate`'s floor centres its content
             * because almost every in-scene control is a one-line chip, and `cn`
             * is a plain string join with no conflict resolution: which of
             * `items-center` and `items-stretch` wins is Tailwind's emission
             * order, not this file's intent. Without them the panel quietly
             * centres a text field, and a centred label over a left-aligned
             * input is the tell that nobody chose either.
             */
            floorClassName="flex-col !items-stretch !justify-start !text-left gap-4"
          >
            <div className="flex max-h-[38vh] flex-col gap-4 overflow-y-auto overscroll-contain lg:max-h-[52vh]">
              {/*
                THE ONE ALERT EVERY OTHER PICK SHARES, first in the panel so it
                is seen before any of the rows it is about. The nickname gets
                its own error slot on its own `Field` because it is the one
                axis with a field to attach one to; these five have none, so
                this is the same `role="alert"` treatment
                (`components/ui/Field.tsx`) standing on its own instead of
                riding a specific control.
              */}
              {pickError && (
                <p role="alert" className="lf-caption text-error-strong">
                  {pickError}
                </p>
              )}

              {/*
                The nickname stays a real input, and its helper line stays with
                it: it is the only name that ever reaches the model
                (/ORACLE.md §4.1), and a learner who is not told that cannot
                make an informed choice about what to type.
              */}
              <Field
                label={t('tutor.personalize.nicknameLabel')}
                hint={t('tutor.personalize.nicknameHint')}
                error={nicknameError ?? undefined}
                value={nickname}
                maxLength={24}
                onChange={(event) => setNickname(event.target.value)}
                onBlur={() => void commitNickname()}
              />

              <div role="group" aria-labelledby={adaptHeadingId}>
                {/*
                  Offered as help, never written about the learner (/ORACLE.md
                  §11). Nothing here is inferred from telemetry, nothing is
                  stored as a fact about them, and the tutor may only ever ask
                  to add one.
                */}
                <p id={adaptHeadingId} className="lf-title mb-2 text-content">
                  {t('tutor.personalize.adaptTitle')}
                </p>
                {/*
                  A wrapping row of chips, not a `sm:grid-cols-2` grid. The grid
                  is what made this read as a settings form; the same controls
                  in a row read as chips, which is what they are everywhere else
                  on this route. The card grid stays where /DESIGN.md puts it:
                  the no-stage fallback lists below.
                */}
                <div className="flex flex-wrap gap-2">
                  {catalog.adaptations.map((adaptation) => (
                    <PlateChip
                      key={adaptation}
                      selected={preferences.adaptations.includes(adaptation)}
                      onSelect={() => void toggleAdaptation(adaptation)}
                    >
                      {t(`tutor.adaptation.${adaptation}`)}
                    </PlateChip>
                  ))}
                </div>
              </div>

              {/*
                EVERY CHOICE, LISTED. Not the overflow: the whole set. A chip in
                the world can be culled by a camera move, by a candidate the
                solver could not seat, or by a device with no WebGL at all, and
                none of those is something this layer can detect. This is the
                guaranteed path (/DESIGN.md → Components → WorldChip) and it
                dispatches the same handlers the world does.
              */}
              {listedCharacters.length > 0 && (
                <div role="group" aria-label={t('tutor.personalize.whoTitle')}>
                  <p className="lf-title mb-2 text-content">{t('tutor.personalize.whoTitle')}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {listedCharacters.map((id) => (
                      <div key={id} className="flex items-center gap-2">
                        <PlateChip
                          selected={id === lead}
                          onSelect={() => void chooseTutor(id)}
                          label={t('tutor.personalize.chooseTutor', { name: nameOf(id) })}
                          className="flex-1"
                        >
                          {/*
                            The note the world plate gave up, and this is where
                            it belongs. A learner who picks Liruf and then
                            wonders why his mouth never moves has been misled;
                            these rows are a column, so the sentence costs a
                            second line here instead of 90 px of width over a
                            character's face.
                          */}
                          <span className="flex flex-col items-center">
                            <span>{nameOf(id)}</span>
                            <span className="lf-caption text-content-muted">{noteFor(id)}</span>
                          </span>
                        </PlateChip>
                        {id !== lead && (
                          <PlateChip
                            selected={id === companion}
                            onSelect={() => void toggleCompanion(id)}
                            label={
                              id === companion
                                ? t('tutor.personalize.dismissCompanion', { name: nameOf(id) })
                                : t('tutor.personalize.inviteCompanion', { name: nameOf(id) })
                            }
                          >
                            <Icon name={id === companion ? 'person_remove' : 'person_add'} />
                          </PlateChip>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {listedIslands.length > 1 && (
                <div role="group" aria-label={t('tutor.personalize.whereTitle')}>
                  <p className="lf-title mb-2 text-content">{t('tutor.personalize.whereTitle')}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {listedIslands.map((id) => (
                      <PlateChip
                        key={id}
                        selected={id === preferences.diorama}
                        onSelect={() => void goToIsland(id)}
                      >
                        {islandName(id)}
                      </PlateChip>
                    ))}
                  </div>
                </div>
              )}

              {listedSun.length > 0 && (
                <div role="group" aria-label={t('tutor.personalize.lightTitle')}>
                  <p className="lf-title mb-2 text-content">{t('tutor.personalize.lightTitle')}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {listedSun.map((id) => (
                      <PlateChip
                        key={id}
                        selected={preferences.backdrop === id}
                        onSelect={() => void setLight(id)}
                      >
                        {/*
                          One word per row, "My theme" included. The sentence
                          that used to hang on the lit row — "choose again to
                          match my theme" — described a gesture that no longer
                          exists: following the app's theme is a light like any
                          other now, listed here and reachable on the sun's own
                          cycle, so nothing has to be explained for it to be
                          found.
                        */}
                        {lightName(id)}
                      </PlateChip>
                    ))}
                  </div>
                </div>
              )}

              {/*
                Reported, never blocking, and inside the panel rather than under
                the press. A picker that goes dead while a patch is in flight
                teaches the learner to wait after every tap, and the patch is
                already applied on screen anyway.
              */}
              {saving && (
                <p className="lf-caption text-content-muted" role="status">
                  {t('tutor.personalize.saving')}
                </p>
              )}
            </div>
          </HudPlate>
        )}

        {/*
          THE RESTING SILHOUETTE: one quiet chip and one press.

          The press is last so it is the closest thing to the learner's thumb
          and the last thing in the tab order before the world, and it is the
          only indigo action in the phase (/DESIGN.md → Screen Recipes → Tutor).
          It is a HudPlate rather than the design system's `Button`, because on
          this layer an indigo action is `.lf-lumen-solid` — a solid object at
          the pane radius keeping only the seated shadow — and a `rounded-full`
          capsule over a photographic frame is the sticker silhouette §Lumen
          exists to remove.

          THE CHIP BESIDE IT NO LONGER SAYS "MORE" (/DESIGN.md §Lumen → What to
          delete: "`More` in the audition. An overflow menu on a phase with four
          candidates.") The control itself cannot go: it opens the LIST, and the
          list is the guaranteed twin of every world chip on this phase — a
          candidate the placement solver cannot seat, a chip the camera has
          culled and a device with no WebGL all take a choice away, and this is
          the only path that survives all three (/DESIGN.md → Components →
          WorldChip). Deleting it would delete reachability, which is the one
          thing this phase may not trade for quiet. What went is the WORD: an
          overflow menu is a place things are hidden, a list is a thing you can
          ask for, and the chip now says which one this is.
        */}
        <div className="flex items-center gap-2">
          <HudPlate
            as="button"
            shape="chip"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => {
              playPlatformSound('tutor_chip');
              setOpen((wasOpen) => !wasOpen);
            }}
            className="pointer-events-auto shrink-0"
          >
            <Icon name={open ? 'expand_more' : 'format_list_bulleted'} />
            <span className="lf-action">
              {open ? t('tutor.personalize.hideList') : t('tutor.personalize.showList')}
            </span>
          </HudPlate>

          <HudPlate
            as="button"
            shape="chip"
            floor="accent"
            /*
             * Found by adversarial review, round 27 (2026-08-30, LOW): every
             * session-starting control in the sibling `OfferChips` carries
             * `disabled={disabled}` — this one had no busy guard at all.
             * `onDone` runs `persistPreferences({})`, which sets `saving`
             * true synchronously before its network call the same way
             * `begin()` sets `starting` — so two fast clicks fired the save
             * twice, a wholly redundant request with nothing to show for it.
             */
            disabled={saving}
            onClick={() => {
              void commitNickname().then((ok) => {
                if (ok) onDone();
              });
            }}
            className="pointer-events-auto min-w-0 flex-1 !max-w-none"
            floorClassName="py-3"
          >
            <span className="lf-action">{t('tutor.personalize.done')}</span>
          </HudPlate>
        </div>
      </aside>
    </>
  );
}

/**
 * Two controls riding one named place in the world, at a height of their own.
 *
 * `WorldChip` is the primitive for the ordinary case and is used everywhere
 * else in this file. It cannot serve here because it renders exactly one
 * button, and the candidate needs two: choosing a tutor and inviting a
 * companion are different answers that must not be nested inside one another.
 * The contract with the projector is identical and deliberately copied rather
 * than adapted: `fixed` at the origin, no transform of this element's own (the
 * projector writes the whole `transform` string every frame and ends it with
 * its own centering translate), and pointer events off on the positioned layer
 * so the box never punches an invisible hole in the island.
 *
 * `place: 'above'` rather than the default centring, because the mark this
 * rides is the top of the candidate's SKULL: a row centred on it wears the
 * character's head as a hat.
 *
 * `stack: true` is what stops four of these landing on each other. The
 * projector lifts each one clear of the rows already placed that frame, so a
 * plate is always over its own character and never over a neighbour's name —
 * see `culling.ts` → `stackClearance` for the measurements that forced it.
 */
function WorldSlot({ slot, children }: { slot: AnchorId; children: ReactNode }) {
  /*
   * `clampToFrame` IS WHAT KEEPS THE FOURTH CANDIDATE IN THE AUDITION.
   *
   * Measured on `/dev/tutor-lab` at 375x812 with the camera held still: Liruf's
   * cluster projected to x = 321 with a half-width of 55, so its right edge
   * landed at 376 against a 375 px viewport, and the ordinary box cull hid it
   * AND made it inert. One pixel, and the learner could no longer choose him by
   * looking at him — which is the exact bug the audition exists to fix, and it
   * had been quietly true at this bearing the whole time. His is the widest
   * cluster because he is the current companion and therefore carries the
   * dismiss orb; a longer name in another locale reaches the same edge with no
   * orb at all, so trimming the cluster would only move the failure.
   *
   * Clamping is right here and wrong for a rim pad, and `ScreenAnchor` carries
   * the distinction: this plate names a PERSON who is still fully on screen,
   * not a PLACE that has left it. Behind the camera it still culls — a name
   * parked at the top of the frame for somebody nobody can see is worse than
   * nothing.
   */
  const anchorRef = useAnchorSlot(slot, { place: 'above', stack: true, clampToFrame: true });

  /*
   * AND IT HIDES UNDER FIXED CHROME, exactly as a `WorldChip` does.
   *
   * This was the part the hand-copied contract left out, and it is the half
   * /DESIGN.md's arbitration rule is about: a world-anchored surface painted
   * over by a viewport-anchored one HIDES, because a control a learner can only
   * half read must not be under their thumb or in their tab order. Measured on
   * `/dev/tutor-lab` at 375x812 with the personalization list open and the
   * orbit stopped: the microphone dock had risen to (15, 223, 345, 156) to
   * clear the panel, and Dina (101, 291), Zara Vex (215, 285) and Dr. Rho
   * (8, 208) were sitting under it — while the island chip and the sun, which
   * ARE `WorldChip`s, hid correctly beside them.
   *
   * Nothing is lost by hiding: the panel that covered them is the guaranteed
   * twin of every world control on this phase, and every candidate is a row in
   * it (§Components → WorldChip).
   *
   * The two refs go on two different nodes for the reason `useHudOcclusion`
   * documents: the projector owns `hidden` on the FRAME, so the occlusion owns
   * it on the box inside, and the frame stays measurable.
   */
  const occlusion = useHudOcclusion();
  const attachFrame = useCallback(
    (node: HTMLElement | null) => {
      anchorRef(node);
      occlusion.frame(node);
    },
    [anchorRef, occlusion],
  );

  return (
    <div ref={attachFrame} className="pointer-events-none fixed left-0 top-0 z-20 will-change-transform">
      <div ref={occlusion.plate} className="flex items-center gap-1.5">
        {children}
      </div>
    </div>
  );
}

/**
 * A choice that lives ON the plate rather than over the render.
 *
 * Deliberately NOT a `HudPlate`. The plate underneath is already the material,
 * and /DESIGN.md forbids stacking glass on glass — two blurred layers over a
 * moving island stop reading as one material and start reading as a bug in the
 * blur. What it borrows from the material instead is the SHAPE and the
 * SELECTION grammar: the pane radius rather than a capsule, and an inset ring
 * in `primary` rather than an outline that is always there.
 *
 * It was a `rounded-full border` pill, and on a translucent reading surface a
 * row of outlined capsules is the single loudest "this is a settings form" cue
 * there is — the exact complaint that got this phase rejected twice. An
 * unselected chip now has no border at all; it is a slightly recessed pane, and
 * the only thing an outline means here is "this one is chosen".
 */
function PlateChip({
  selected,
  onSelect,
  label,
  className,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={label}
      className={cn(
        // ≥44px, because this is used by six-year-olds on phones.
        'lf-action flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-center',
        'transition-[background-color,box-shadow] duration-200 active:translate-y-px',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        selected
          ? 'bg-accent-soft text-content shadow-[inset_0_0_0_2px_rgb(var(--lf-primary))]'
          : 'bg-content/[0.06] text-content hover:bg-content/[0.11]',
        className,
      )}
    >
      {selected && <Icon name="check" className="!text-[18px]" />}
      {children}
    </button>
  );
}
