import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Field, Icon } from '@/components/ui';
import type { CharacterId } from '@/components/characters/control/types';
import { playPlatformSound } from '@/lib/sound';
import { cn } from '@/lib/utils';
import { castMarks, type AnchorId } from '@/tutor-scene/anchors';
import { useAnchorSlot } from '@/tutor-scene/ScreenAnchor';
import { useSafeArea } from '@/tutor-scene/SafeAreaContext';
import { HudPlate } from '@/tutor/hud/HudPlate';
import { useDesktopPlate } from '@/tutor/hud/LessonPlate';
import { WorldChip } from '@/tutor/hud/WorldChip';
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
 * The sun's arc: FOUR stops, not five.
 *
 * There are four times of day and `auto` is not one of them — it is the absence
 * of one — so "match my theme" is reached by choosing the lit stop again rather
 * than by taking a fifth place in the sky. The fifth mark stays free on purpose:
 * two nodes published on one anchor project to the same pixel with no way for
 * either to know, so the learner would see one control sitting on top of another
 * and neither would look broken. Leaving headroom on the ring is how that stays
 * impossible when the next phase wants a rune.
 */
const SUN_MARK_IDS = [
  'sky.mark.0',
  'sky.mark.1',
  'sky.mark.2',
  'sky.mark.3',
] as const satisfies readonly AnchorId[];

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
   * The times of day, without `auto`. Filtering by NAME rather than by position
   * matters: the catalog is server-driven and its order is not a contract, so
   * slicing the first four would put "match my theme" in the sky and drop a real
   * time of day off the end the day someone reorders the list.
   */
  const sunStops = useMemo(
    () => catalog.backdrops.filter((id) => id !== THEME_LIGHT),
    [catalog.backdrops],
  );

  const sunArc = useMemo(
    () =>
      SUN_MARK_IDS.flatMap((slot, index) => {
        const id = sunStops[index];
        return id ? [{ slot, id }] : [];
      }),
    [sunStops],
  );

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
  const listedSun = sunStops;
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

  const chooseTutor = (id: CharacterId) => {
    if (id === lead) return;
    playPlatformSound('tutor_chip');
    onSave({
      character: id,
      /*
       * A companion who is also the tutor would put one character on the island
       * twice, and `useSceneModel` deliberately does not clone the loaded scene,
       * so the second mount would fight the first over a single object. Clearing
       * it silently is kinder than an error the learner has to go and fix.
       */
      ...(companion === id ? { companion: null } : {}),
    });
  };

  const toggleCompanion = (id: CharacterId) => {
    if (id === lead) return;
    playPlatformSound('tutor_chip');
    onSave({ companion: companion === id ? null : id });
  };

  const goToIsland = (id: string) => {
    if (id === preferences.diorama) return;
    // The move is the choice, so it gets the travel cue rather than the pick one.
    playPlatformSound('tutor_camera');
    onSave({ diorama: id });
  };

  const setLight = (id: string) => {
    playPlatformSound('tutor_chip');
    // Choosing the lit stop again is how the learner gets back to following the
    // app's theme. It is the same "press it again to undo it" grammar the
    // companion toggle uses, so the screen has one rule rather than two.
    onSave({ backdrop: preferences.backdrop === id ? THEME_LIGHT : id });
  };

  const toggleAdaptation = (adaptation: Adaptation) => {
    playPlatformSound('tutor_chip');
    const on = preferences.adaptations.includes(adaptation);
    onSave({
      adaptations: on
        ? preferences.adaptations.filter((entry) => entry !== adaptation)
        : [...preferences.adaptations, adaptation],
    });
  };

  /**
   * Validates and persists the nickname. Returns whether it was acceptable, so
   * the same function can guard the press that leaves this layer.
   */
  const commitNickname = (): boolean => {
    const value = nickname.trim();
    if (value !== '' && !NICKNAME_PATTERN.test(value)) {
      setNicknameError(t('tutor.personalize.nicknameInvalid'));
      return false;
    }
    setNicknameError(null);
    const next = value === '' ? null : value;
    if (next !== preferences.nickname) onSave({ nickname: next });
    return true;
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
          return (
            <WorldSlot key={id} slot={slot}>
              <HudPlate
                as="button"
                shape="plate"
                onClick={() => chooseTutor(id)}
                aria-label={t('tutor.personalize.chooseTutor', { name: nameOf(id) })}
                aria-pressed={isLead}
                className={cn('pointer-events-auto', isLead && 'ring-2 ring-primary')}
                /*
                 * The bang is not decoration. `cn` is a plain string join with
                 * no conflict resolution, so which of `gap-2` and `gap-0.5`
                 * wins is decided by Tailwind's own emission order, which is an
                 * implementation detail and not something this file should be
                 * betting a layout on. Without it the name and the line under
                 * it sit a chip's worth of air apart.
                 */
                floorClassName="flex-col !gap-0.5"
              >
                <span className="lf-label text-content">{nameOf(id)}</span>
                <span className="lf-caption text-content-muted">{noteFor(id)}</span>
              </HudPlate>

              {/*
                A SIBLING, not a child. The tutor pick and the companion toggle
                are two different answers about one character, and a button
                inside a button is invalid HTML that browsers resolve by
                dropping one of the two handlers.
              */}
              {!isLead && (
                <HudPlate
                  as="button"
                  shape="orb"
                  onClick={() => toggleCompanion(id)}
                  aria-label={
                    isCompanion
                      ? t('tutor.personalize.dismissCompanion', { name: nameOf(id) })
                      : t('tutor.personalize.inviteCompanion', { name: nameOf(id) })
                  }
                  aria-pressed={isCompanion}
                  className={cn('pointer-events-auto', isCompanion && 'ring-2 ring-primary')}
                  floorClassName="h-11 w-11"
                >
                  <Icon name={isCompanion ? 'person_remove' : 'person_add'} />
                </HudPlate>
              )}
            </WorldSlot>
          );
        })}
      </div>

      {/*
        WHO IS STANDING WHERE, said over their heads.
        `aria-hidden`, because the ring above is already a real, ordered,
        labelled control for each character and its pressed state carries the
        same fact. A second announcement of the same thing makes a screen-reader
        user stop and work out whether they are two controls or one. This chip
        is the SIGHTED confirmation that the pick landed on the island, which is
        the entire point of choosing in the world.
      */}
      <div aria-hidden="true">
        <WorldChip slot="lead.head" shape="chip">
          <span className="flex flex-col items-center">
            <span className="lf-label text-content">{nameOf(lead)}</span>
            <span className="lf-caption text-content-muted">{t('tutor.personalize.tutorBadge')}</span>
          </span>
        </WorldChip>
      </div>

      {/*
        The companion's own chip IS interactive, and that is the one place the
        duplication is worth it: "tap them again and they leave" is the gesture
        the owner asked for, and with no pick proxy on the mesh yet this chip
        over their head is the closest thing to tapping the character. It
        dispatches the same handler as the ring toggle, so the two are one code
        path rather than two that drift.
      */}
      {companion && (
        <WorldChip
          slot="companion.head"
          shape="chip"
          onSelect={() => toggleCompanion(companion)}
          label={t('tutor.personalize.dismissCompanion', { name: nameOf(companion) })}
        >
          <span className="flex flex-col items-center">
            <span className="lf-label text-content">{nameOf(companion)}</span>
            <span className="lf-caption text-content-muted">
              {t('tutor.personalize.companionBadge')}
            </span>
          </span>
        </WorldChip>
      )}

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
              onSelect={() => goToIsland(previousIsland)}
              label={t('tutor.personalize.goToIsland', { name: islandName(previousIsland) })}
            >
              <span className="lf-caption text-content">{islandName(previousIsland)}</span>
            </WorldChip>
          )}
          {nextIsland && (
            <WorldChip
              slot="island.rim.right"
              onSelect={() => goToIsland(nextIsland)}
              label={t('tutor.personalize.goToIsland', { name: islandName(nextIsland) })}
            >
              <span className="lf-caption text-content">{islandName(nextIsland)}</span>
            </WorldChip>
          )}
        </div>
      )}

      {/*
        THE LIGHT, moved along the sun's own arc. The lit stop carries the way
        back to "match my theme" in its own words, because an affordance nobody
        can see is an affordance only the person who wrote it can use.
      */}
      {sunArc.length > 0 && (
        <div role="group" aria-label={t('tutor.personalize.lightTitle')}>
          {sunArc.map(({ slot, id }) => {
            const lit = preferences.backdrop === id;
            return (
              <WorldChip key={id} slot={slot} selected={lit} onSelect={() => setLight(id)}>
                <span className="flex flex-col items-center">
                  <span className="lf-caption text-content">{lightName(id)}</span>
                  {lit && (
                    <span className="lf-caption text-content-muted">
                      {t('tutor.personalize.lightClear')}
                    </span>
                  )}
                </span>
              </WorldChip>
            );
          })}
        </div>
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
            floor="surface"
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
                onBlur={() => commitNickname()}
              />

              <div role="group" aria-labelledby={adaptHeadingId}>
                {/*
                  Offered as help, never written about the learner (/ORACLE.md
                  §11). Nothing here is inferred from telemetry, nothing is
                  stored as a fact about them, and the tutor may only ever ask
                  to add one.
                */}
                <p id={adaptHeadingId} className="lf-label mb-2 text-content">
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
                      onSelect={() => toggleAdaptation(adaptation)}
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
                  <p className="lf-label mb-2 text-content">{t('tutor.personalize.whoTitle')}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {listedCharacters.map((id) => (
                      <div key={id} className="flex items-center gap-2">
                        <PlateChip
                          selected={id === lead}
                          onSelect={() => chooseTutor(id)}
                          label={t('tutor.personalize.chooseTutor', { name: nameOf(id) })}
                          className="flex-1"
                        >
                          {nameOf(id)}
                        </PlateChip>
                        {id !== lead && (
                          <PlateChip
                            selected={id === companion}
                            onSelect={() => toggleCompanion(id)}
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
                  <p className="lf-label mb-2 text-content">{t('tutor.personalize.whereTitle')}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {listedIslands.map((id) => (
                      <PlateChip
                        key={id}
                        selected={id === preferences.diorama}
                        onSelect={() => goToIsland(id)}
                      >
                        {islandName(id)}
                      </PlateChip>
                    ))}
                  </div>
                </div>
              )}

              {listedSun.length > 0 && (
                <div role="group" aria-label={t('tutor.personalize.lightTitle')}>
                  <p className="lf-label mb-2 text-content">{t('tutor.personalize.lightTitle')}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {listedSun.map((id) => (
                      <PlateChip
                        key={id}
                        selected={preferences.backdrop === id}
                        onSelect={() => setLight(id)}
                      >
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
          only `primary` fill in the phase (/DESIGN.md → Screen Recipes → Tutor:
          one indigo action per phase). The chip beside it is `sunken` glass,
          which is the same "quieter second thought" grammar the replays chip
          uses on the introduction.
        */}
        <div className="flex items-center gap-2">
          <HudPlate
            as="button"
            shape="chip"
            floor="sunken"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => {
              playPlatformSound('tutor_chip');
              setOpen((wasOpen) => !wasOpen);
            }}
            className="pointer-events-auto shrink-0"
          >
            <Icon name={open ? 'expand_more' : 'tune'} className="text-content-muted" />
            <span className="lf-caption">
              {open ? t('tutor.personalize.hideMore') : t('tutor.personalize.more')}
            </span>
          </HudPlate>

          <Button
            onClick={() => {
              if (commitNickname()) onDone();
            }}
            className="flex-1"
          >
            {t('tutor.personalize.done')}
          </Button>
        </div>
      </aside>
    </>
  );
}

/**
 * Two controls riding one named place in the world.
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
 */
function WorldSlot({ slot, children }: { slot: AnchorId; children: ReactNode }) {
  const anchorRef = useAnchorSlot(slot);
  return (
    <div
      ref={anchorRef}
      className="pointer-events-none fixed left-0 top-0 z-20 flex items-center gap-1.5 will-change-transform"
    >
      {children}
    </div>
  );
}

/**
 * A choice that lives ON the plate rather than over the render.
 *
 * Deliberately NOT a `HudPlate`. The plate underneath is already a glass frame,
 * and /DESIGN.md forbids stacking glass on glass — two blurred layers over a
 * moving island stop reading as one material and start reading as a bug in the
 * blur. Over an opaque floor the ordinary token grammar is both correct and
 * legible, and the contrast is a fixed ratio against a known colour.
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
        'lf-body flex min-h-11 items-center justify-center gap-2 rounded-full border px-4 py-2 text-center transition-colors',
        selected
          ? 'border-primary bg-accent-soft text-content'
          : 'border-outline bg-surface-sunken text-content hover:border-primary',
        className,
      )}
    >
      {selected && <Icon name="check" className="!text-[18px]" />}
      {children}
    </button>
  );
}
