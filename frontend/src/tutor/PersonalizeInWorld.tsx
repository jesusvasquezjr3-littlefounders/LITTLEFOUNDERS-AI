import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui';
import type { CharacterId } from '@/components/characters/control/types';
import { playPlatformSound } from '@/lib/sound';
import { cn } from '@/lib/utils';
import { TutorFace } from './TutorFace';
import { type PersonalizeLayerProps } from './stage/StageShell';
import type { Adaptation, TutorPreferences } from './types';

/*
 * PERSONALIZATION, AS THE DESIGN STUDY'S DIALOG (2026-09-06, owner direction).
 *
 * WHAT THIS REPLACED, AND WHY IT IS NOT A REGRESSION OF THE PREVIOUS FIX.
 *
 * The version before this one put every choice IN THE WORLD: candidate chips
 * riding each character's crown, rim pads for the island, a sun on an arc, and
 * one small plate in the corner holding a nickname field and a list. That shape
 * existed because two EARLIER versions — both ordinary forms — had been
 * rejected for reading as "una configuración de uso" rather than as a place.
 *
 * The owner has now looked at the Stitch study's own configuration screen
 * beside it and chosen the study: a centred dialog, because it is easier to
 * navigate, easier to explore, and more intuitive to configure than a set of
 * controls scattered across a moving island. That is a product judgement about
 * the two things the in-world version genuinely could not do — show every
 * option at once, and group them under headings a person can scan — and it
 * outranks the reasoning recorded here before it.
 *
 * WHAT IS KEPT FROM THE IN-WORLD PASS, because it was never the part that was
 * wrong: every axis still applies OPTIMISTICALLY, and the island still changes
 * underneath the dialog as you pick — the scrim is blurred, not opaque, for
 * exactly that reason. Choosing Dusk moves the real sun; choosing a tutor puts
 * that character on the real island. Nothing here previews.
 *
 * AND `Cancel` REALLY CANCELS. The study draws Cancel and Save side by side,
 * which on a surface that saves every tap would be a lie — so the dialog takes
 * a snapshot of `preferences` when it opens and restores it if the learner
 * cancels. Save-and-continue is the same `onDone` the plate's "I'm ready" was.
 */

/**
 * The same rule the server enforces, applied before the round trip so the
 * learner is corrected by the field they are typing in rather than by a
 * rejected save. Letters and digits from any script, because the nickname is
 * written in three locales and a Latin-only rule would silently exclude two.
 */
const NICKNAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} '_-]*$/u;

/**
 * The hue each section is keyed to, and the study is deliberate about it: the
 * section's icon, its cards' selected state and its status words share one
 * colour, so a glance at the icon says which group you are in. The study's own
 * cyan has no token in this project's closed palette (/DESIGN.md); `delight` is
 * the answer to it, and is what every other cyan-shaped decision on this route
 * has already been mapped to.
 */
const SECTION_TONE = {
  identity: 'text-warning-strong',
  tutor: 'text-accent',
  world: 'text-delight',
  light: 'text-warning-strong',
  quick: 'text-success-strong',
} as const;

export function PersonalizeInWorld({
  preferences,
  catalog,
  saving,
  onSave,
  onDone,
}: PersonalizeLayerProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);

  /*
   * THE SNAPSHOT THAT MAKES `Cancel` HONEST. Taken once, on mount, from the
   * preferences as they arrived — not from a later render, or cancelling would
   * restore whatever the learner had already changed rather than what they
   * started with.
   */
  const openedWith = useRef<TutorPreferences | null>(null);
  if (openedWith.current === null) openedWith.current = preferences;

  const [nickname, setNickname] = useState(preferences.nickname ?? '');
  const [nicknameError, setNicknameError] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);

  const characters = catalog.characters;
  const lead = preferences.character;
  const companion = preferences.companion;

  /*
   * Every light the sun passes through, `auto` first. Ordered by NAME rather
   * than by the catalog's own order for the one entry that is not a time of
   * day: the catalog is server-driven and its order is not a contract, so a
   * reorder must never drop "follow my theme" into the middle of
   * dawn-day-dusk-night.
   */
  const lights = useMemo(() => {
    const times = catalog.backdrops.filter((id) => id !== 'auto');
    return catalog.backdrops.includes('auto') ? ['auto', ...times] : times;
  }, [catalog.backdrops]);

  const nameOf = (id: CharacterId) => t(`tutor.character.${id}.name`);
  const islandName = (id: string) => t(`tutor.diorama.${id}`, { defaultValue: id });
  const lightName = (id: string) => t(`tutor.backdrop.${id}`, { defaultValue: id });
  const noteFor = (id: CharacterId) =>
    catalog.articulates.includes(id)
      ? t(`tutor.character.${id}.blurb`)
      : // Said out loud rather than discovered: a learner who picks Liruf and
        // then wonders why his mouth never moves has been misled.
        t('tutor.personalize.bodyTalker');

  /**
   * Surfaces a rejected pick, because `persistPreferences` rolls the value back
   * silently and a picker that quietly discards a tap reads as working.
   */
  const reportIfRejected = (saved: boolean) => {
    if (!saved) setPickError(t('tutor.personalize.pickRejected'));
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
       * so the second mount would fight the first over a single object.
       */
      ...(companion === id ? { companion: null } : {}),
    });
    reportIfRejected(saved);
  };

  const toggleCompanion = async (id: CharacterId) => {
    if (id === lead) return;
    playPlatformSound('tutor_chip');
    setPickError(null);
    reportIfRejected(await onSave({ companion: companion === id ? null : id }));
  };

  const goToIsland = async (id: string) => {
    if (id === preferences.diorama) return;
    // The move is the choice, so it gets the travel cue rather than the pick one.
    playPlatformSound('tutor_camera');
    setPickError(null);
    reportIfRejected(await onSave({ diorama: id }));
  };

  const setLight = async (id: string) => {
    if (id === preferences.backdrop) return;
    playPlatformSound('tutor_chip');
    setPickError(null);
    reportIfRejected(await onSave({ backdrop: id }));
  };

  const toggleAdaptation = async (adaptation: Adaptation) => {
    playPlatformSound('tutor_chip');
    setPickError(null);
    const on = preferences.adaptations.includes(adaptation);
    reportIfRejected(
      await onSave({
        adaptations: on
          ? preferences.adaptations.filter((entry) => entry !== adaptation)
          : [...preferences.adaptations, adaptation],
      }),
    );
  };

  /**
   * Validates and persists the nickname. Returns whether it actually landed, so
   * the same function can guard the press that leaves this layer — the format
   * check here cannot replicate the backend's real-name check, so a
   * clean-looking value can still be refused after `onSave` is called.
   */
  const commitNickname = useCallback(async (): Promise<boolean> => {
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
  }, [nickname, preferences.nickname, onSave, t]);

  /** Puts every axis back to what it was when the dialog opened, then leaves. */
  const cancel = useCallback(() => {
    const snapshot = openedWith.current;
    playPlatformSound('tutor_chip');
    if (snapshot) {
      setNickname(snapshot.nickname ?? '');
      void onSave({
        character: snapshot.character,
        companion: snapshot.companion,
        diorama: snapshot.diorama,
        backdrop: snapshot.backdrop,
        nickname: snapshot.nickname,
        adaptations: snapshot.adaptations,
      });
    }
    onDone();
  }, [onSave, onDone]);

  /*
   * Escape leaves the way Cancel does, which is what a dialog owes a keyboard
   * user — and it is Cancel rather than Save because Escape has meant "undo
   * this detour" in every dialog anyone has ever used.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        cancel();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [cancel]);

  // Focus lands inside the dialog, once, so a keyboard user is not left on the
  // page behind it.
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const confirm = () => {
    void commitNickname().then((ok) => {
      if (ok) onDone();
    });
  };

  const resetToDefaults = () => {
    playPlatformSound('tutor_chip');
    setPickError(null);
    setNickname('');
    void onSave({
      backdrop: 'auto',
      companion: null,
      nickname: null,
      adaptations: [],
    });
  };

  /*
   * A PORTAL, and it is the only thing that makes a modal a modal here.
   *
   * The stage mounts every HUD layer inside `pointer-events-none absolute
   * inset-0 z-30` (`stage/StageShell.tsx`), which is a STACKING CONTEXT — so a
   * dialog rendered as one of those children can never rise above the
   * microphone dock's `z-40` sibling, whatever z-index it gives itself.
   * Photographed first at `z-50` and again at `z-[60]`, with the dock's
   * "Ready when the conversation starts" plate punched through the middle of
   * the dialog both times. Escaping to `document.body` is what actually puts
   * it over the whole screen, which is what "modal" means.
   */
  return createPortal(
    <div
      /*
       * ABOVE THE STAGE'S OWN CHROME. The microphone dock is `z-40` and the
       * shell's exit chip is `z-50` (`stage/StageShell.tsx`), so a dialog at
       * `z-50` was photographed with the dock's "Ready when the conversation
       * starts" plate punched through the middle of it. A modal is the one
       * surface that owns the whole screen while it is open.
       */
      className="lf-config-scrim pointer-events-auto fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto p-4 md:p-6"
      role="presentation"
      onMouseDown={(event) => {
        // Only a press that both starts and ends on the scrim dismisses; a drag
        // that began inside the dialog must never close it.
        if (event.target === event.currentTarget) cancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="lf-config-dialog my-auto flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden focus-visible:outline-none"
      >
        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <div className="lf-config-head flex shrink-0 items-center justify-between gap-3 px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className={cn('lf-tile h-10 w-10', SECTION_TONE.tutor)}>
              <Icon name="tune" className="!text-[22px]" />
            </span>
            <div className="min-w-0">
              <h2 id={titleId} className="lf-title text-content">
                {t('tutor.personalize.dialogTitle')}
              </h2>
              <p id={descriptionId} className="lf-caption text-content-muted">
                {t('tutor.personalize.dialogSubtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={cancel}
            aria-label={t('tutor.personalize.close')}
            className="lf-press grid h-11 w-11 shrink-0 place-items-center rounded-full border border-content/15 text-content-muted transition-colors hover:bg-content/10 hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Icon name="close" />
          </button>
        </div>

        {/* ── BODY ───────────────────────────────────────────────────────── */}
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          {pickError && (
            <p role="alert" className="lf-caption text-error-strong">
              {pickError}
            </p>
          )}

          {/*
            THE NICKNAME. Its own row rather than a section, because it is one
            field and the study gives it the only amber tile in the dialog —
            "your identity" reading differently from every feature group. The
            helper line stays with it: it is the only name that ever reaches the
            model (/ORACLE.md §4.1), and a learner not told that cannot make an
            informed choice about what to type.
          */}
          <div className="lf-config-row flex flex-col gap-3.5 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className={cn('lf-tile h-9 w-9', SECTION_TONE.identity)}>
                <Icon name="badge" className="!text-[20px]" />
              </span>
              <div className="min-w-0">
                <span className="lf-action block text-content">
                  {t('tutor.personalize.nicknameSection')}
                </span>
                <span className="lf-caption text-content-muted">
                  {t('tutor.personalize.nicknameHint')}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={nickname}
                  maxLength={24}
                  aria-label={t('tutor.personalize.nicknameLabel')}
                  aria-invalid={nicknameError ? true : undefined}
                  onChange={(event) => setNickname(event.target.value)}
                  onBlur={() => void commitNickname()}
                  className="lf-action min-h-11 w-44 rounded-xl border border-accent/40 bg-content/5 px-3.5 py-2 pr-9 text-content focus:border-accent focus:outline-none"
                />
                <Icon
                  name="edit"
                  aria-hidden
                  className="pointer-events-none absolute right-3 !text-[16px] text-content-faint"
                />
              </div>
              {nickname.trim() !== '' && (
                <span className="lf-caption hidden shrink-0 items-center gap-1 rounded-lg border border-success/30 bg-success-soft px-2 py-1 text-success-strong sm:flex">
                  <Icon name="check" className="!text-[14px]" />
                  {t('tutor.personalize.nicknameActive')}
                </span>
              )}
            </div>
          </div>
          {nicknameError && (
            <p role="alert" className="-mt-4 lf-caption text-error-strong">
              {nicknameError}
            </p>
          )}

          {/* ── THE CAST ─────────────────────────────────────────────────── */}
          <Section
            icon="smart_toy"
            tone={SECTION_TONE.tutor}
            title={t('tutor.personalize.whoTitle')}
            meta={t('tutor.personalize.tutorsUnlocked', { count: characters.length })}
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {characters.map((id) => {
                const isLead = id === lead;
                const isCompanion = id === companion;
                return (
                  <div key={id} className="relative">
                    <button
                      type="button"
                      onClick={() => void chooseTutor(id)}
                      aria-pressed={isLead}
                      aria-label={t('tutor.personalize.chooseTutor', { name: nameOf(id) })}
                      className={cn(
                        'lf-pick-card lf-press flex h-full w-full flex-col items-center gap-2 p-3 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                        isLead && 'lf-pick-card-on',
                      )}
                    >
                      {isLead && (
                        <span className="lf-pick-check" aria-hidden>
                          <Icon name="check" className="!text-[12px]" />
                        </span>
                      )}
                      {/*
                        The well keeps the CHARACTER's own hue while the frame
                        carries state — personality in the well, state in the
                        frame, which is the study's own division.
                      */}
                      <span
                        className={cn(
                          'lf-tile h-14 w-14 overflow-hidden !rounded-2xl',
                          isLead ? SECTION_TONE.tutor : 'text-delight',
                        )}
                      >
                        {/*
                          THE REAL CHARACTER, not a glyph. `TutorFace` is the
                          same 2D portrait the speech card uses, held still —
                          `speaking: false`, `action: 'idle'` — so a card shows
                          the person it names rather than a placeholder mask.
                        */}
                        <TutorFace
                          character={id}
                          emotion="happy"
                          action="idle"
                          actionKey={0}
                          speaking={false}
                          className="h-full w-full"
                        />
                      </span>
                      <span className="lf-action leading-tight text-content">{nameOf(id)}</span>
                      <span className="lf-caption leading-tight text-content-muted">
                        {noteFor(id)}
                      </span>
                      <span
                        className={cn(
                          'lf-caption mt-auto rounded-full border px-2 py-0.5',
                          isLead
                            ? 'border-accent/40 bg-accent/15 text-accent-strong'
                            : 'border-content/20 bg-content/5 text-content-muted',
                        )}
                      >
                        {isLead ? t('tutor.personalize.inUse') : t('tutor.personalize.select')}
                      </span>
                    </button>
                    {/*
                      The companion invite: a SIBLING, never nested — a button
                      inside a button is invalid HTML that browsers resolve by
                      dropping one of the two handlers.
                    */}
                    {!isLead && (
                      <button
                        type="button"
                        onClick={() => void toggleCompanion(id)}
                        aria-pressed={isCompanion}
                        aria-label={
                          isCompanion
                            ? t('tutor.personalize.dismissCompanion', { name: nameOf(id) })
                            : t('tutor.personalize.inviteCompanion', { name: nameOf(id) })
                        }
                        className={cn(
                          'lf-press absolute right-1.5 top-1.5 grid h-9 w-9 place-items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                          isCompanion
                            ? 'border-delight/50 bg-delight/20 text-delight'
                            : 'border-content/15 bg-surface/70 text-content-muted hover:text-content',
                        )}
                      >
                        <Icon
                          name={isCompanion ? 'person_remove' : 'person_add'}
                          className="!text-[16px]"
                        />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>

          {/* ── THE ISLAND ───────────────────────────────────────────────── */}
          {catalog.dioramas.length > 0 && (
            <Section
              icon="public"
              tone={SECTION_TONE.world}
              title={t('tutor.personalize.whereTitle')}
              meta={t('tutor.personalize.worldLive')}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {catalog.dioramas.map((id) => {
                  const active = id === preferences.diorama;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => void goToIsland(id)}
                      aria-pressed={active}
                      aria-label={t('tutor.personalize.goToIsland', { name: islandName(id) })}
                      className={cn(
                        'lf-pick-card lf-press flex min-h-11 flex-col gap-1 p-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                        active && 'lf-pick-card-on',
                      )}
                    >
                      <span className="flex items-center gap-2.5">
                        <span className={cn('lf-tile h-8 w-8', SECTION_TONE.world)}>
                          <Icon name="landscape" className="!text-[18px]" />
                        </span>
                        <span className="min-w-0">
                          <span className="lf-action block truncate text-content">
                            {islandName(id)}
                          </span>
                          {active && (
                            <span className="lf-caption text-delight">
                              {t('tutor.personalize.worldActive')}
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </Section>
          )}

          {/* ── THE HOUR ─────────────────────────────────────────────────── */}
          {lights.length > 0 && (
            <Section
              icon="wb_sunny"
              tone={SECTION_TONE.light}
              title={t('tutor.personalize.lightTitle')}
            >
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {lights.map((id) => {
                  const active = id === preferences.backdrop;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => void setLight(id)}
                      aria-pressed={active}
                      className={cn(
                        'lf-pick-card lf-press flex min-h-11 items-center gap-2 p-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                        active && 'lf-pick-card-on',
                      )}
                    >
                      <span
                        className={cn(
                          'lf-tile h-7 w-7 !rounded-full',
                          id === 'night' || id === 'auto' ? 'text-accent' : SECTION_TONE.light,
                        )}
                      >
                        <Icon
                          name={
                            id === 'night'
                              ? 'bedtime'
                              : id === 'auto'
                                ? 'contrast'
                                : id === 'dawn'
                                  ? 'wb_twilight'
                                  : id === 'dusk'
                                    ? 'wb_shade'
                                    : 'wb_sunny'
                          }
                          className="!text-[15px]"
                        />
                      </span>
                      <span className="lf-caption min-w-0 truncate font-semibold text-content">
                        {lightName(id)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Section>
          )}

          {/* ── HOW THE TUTOR EXPLAINS ───────────────────────────────────── */}
          {catalog.adaptations.length > 0 && (
            <Section
              icon="psychology"
              tone={SECTION_TONE.quick}
              title={t('tutor.personalize.quickTitle')}
            >
              {/*
                The study's quick-settings block is two rows carrying a segmented
                control and a switch. Ours carries the ADAPTATIONS, which is the
                axis that actually exists behind this product — offered as help,
                never written about the learner (/ORACLE.md §11) — in the study's
                own row skeleton, one switch each. A control with nothing behind
                it would be worse than one that is absent.
              */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {catalog.adaptations.map((adaptation) => {
                  const on = preferences.adaptations.includes(adaptation);
                  return (
                    <button
                      key={adaptation}
                      type="button"
                      role="switch"
                      aria-checked={on}
                      onClick={() => void toggleAdaptation(adaptation)}
                      className="lf-config-row lf-press flex min-h-11 items-center justify-between gap-3 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span
                          className={cn(
                            'lf-tile h-8 w-8',
                            on ? SECTION_TONE.quick : 'text-content-muted',
                          )}
                        >
                          <Icon name="auto_awesome" className="!text-[16px]" />
                        </span>
                        <span className="lf-caption min-w-0 font-semibold text-content">
                          {t(`tutor.adaptation.${adaptation}`)}
                        </span>
                      </span>
                      <span className={cn('lf-switch', on && 'lf-switch-on')} aria-hidden>
                        <span className="lf-switch-knob" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </Section>
          )}

          {saving && (
            <p className="lf-caption text-content-muted" role="status">
              {t('tutor.personalize.saving')}
            </p>
          )}
        </div>

        {/* ── FOOTER: the study's three tiers — ghost, glass, primary ─────── */}
        <div className="lf-config-foot flex shrink-0 flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={resetToDefaults}
            className="lf-press flex min-h-11 items-center gap-1.5 rounded-xl px-3 lf-action text-content-muted transition-colors hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Icon name="refresh" className="!text-[18px]" />
            {t('tutor.personalize.defaults')}
          </button>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={cancel}
              className="lf-press min-h-11 rounded-xl border border-content/15 bg-content/5 px-4 lf-action text-content transition-colors hover:bg-content/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {t('tutor.personalize.cancel')}
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={saving}
              className="lf-lumen-solid lf-press flex min-h-11 items-center gap-1.5 rounded-xl bg-accent px-5 lf-action text-on-accent disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {t('tutor.personalize.saveAndContinue')}
              <Icon name="auto_awesome" className="!text-[18px]" />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * A titled group.
 *
 * The uppercase, wide-tracked label is the study's strongest typographic
 * signature, and the leading icon's HUE is what keys the group: the cards below
 * inherit it for their selected state, so a glance at the icon says which set
 * you are choosing from. `.lf-eyebrow` already existed for exactly this lockup
 * and had never been used on this route.
 */
function Section({
  icon,
  tone,
  title,
  meta,
  children,
}: {
  icon: string;
  tone: string;
  title: string;
  meta?: string;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Icon name={icon} aria-hidden className={cn('!text-[18px]', tone)} />
          <h3 id={headingId} className="lf-eyebrow truncate text-content">
            {title}
          </h3>
        </div>
        {meta && <span className="lf-caption shrink-0 text-content-muted">{meta}</span>}
      </div>
      {children}
    </section>
  );
}
