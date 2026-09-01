import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { SCENE_ASSETS } from '@/tutor-scene/assets';
import { isSceneBackdropId } from '@/tutor-scene/backdrops';
import { overlappingPairs, type NamedRect } from '@/tutor-scene/hudSpace';
import { ConversationView } from '../ConversationView';
import { ClosingInWorld } from '../ClosingInWorld';
import { OfferChips } from '../OfferChips';
import { PersonalizeInWorld } from '../PersonalizeInWorld';
import { ReplayInWorld } from '../replay/ReplayInWorld';
import { buildReplayScript } from '../replay/replayScript';
import { useReplayDirector } from '../replay/useReplayDirector';
import { VoiceConsentControl } from '../VoiceConsentControl';
import { micBlockedForOffers, narrowBlockedReason } from '../mic';
import { auditionFor } from '../stage/phases';
import { micForPhase } from '../stage/micForPhase';
import {
  shotForPhase,
  StageLayer,
  StageShell,
  type ConversationLayerProps,
  type OfferLayerProps,
  type PersonalizeLayerProps,
  type ReplayLayerProps,
  type StageMicProps,
} from '../stage/StageShell';
import { useMicrophone } from '../useMicrophone';
import type { TutorPreferences } from '../types';
import type { Locale } from '@/i18n';
import {
  DEFAULT_LAB_ACTIVITY,
  DEFAULT_LAB_LOCALE,
  LAB_ACTIVITIES,
  LAB_CATALOG,
  LAB_LOCALES,
  LAB_PREFERENCES,
  LAB_SCENES,
  LAB_TOKEN,
  labLocaleOf,
  labMap,
  labOffers,
  labSession,
  labTranscript,
  phaseForScene,
  useLabSocket,
  useStubbedCoreApi,
  type LabScene,
} from './labFixtures';

/*
 * `/dev/tutor-lab` — the Tutor's immersive stage, drivable without a session.
 *
 * WHY IT EXISTS, restated, because the reason changed. It used to render three
 * Tutor panels against fixtures on an ordinary scrolling page, and it said in
 * its own comments that the anchored chrome "needs a camera to hang off and is
 * looked at on `/tutor` itself". That sentence was the bug. `/tutor` is behind
 * `RequireAuth` and `RequireOnboarded`, and it needs Core, a running Oracle, a
 * model key and a live websocket before it draws a single pixel — so "looked at
 * on /tutor" meant, in practice, looked at by nobody. The owner found the phone
 * layout before we did, which is the only outcome that arrangement could ever
 * have produced.
 *
 * So this page now mounts THE REAL `StageShell`: one full-bleed canvas, the real
 * island, the real camera, the real anchored HUD, the real microphone dock, the
 * real lesson sheet, driven through every phase by a switcher. What is faked is
 * the network and only the network, and all of it is in `./labFixtures.ts`
 * behind one banner.
 *
 * IT IS NOT A COPY OF THE ROUTE. Every prop below is built the same way
 * `TutorExperience` builds it — `shotForPhase` from the same inputs,
 * `micForPhase` from the same narrowing, `auditionFor` from the same catalog —
 * so a change to any of those mappings shows up here on the same commit. Where
 * the two genuinely differ, the difference is named in a comment rather than
 * smoothed over.
 *
 * DEV-ONLY. The route is mounted behind `import.meta.env.DEV` in `App.tsx`, so
 * none of this reaches a production bundle. Its own chrome is therefore written
 * in plain English rather than through i18n, exactly as `/dev/scene-lab` and
 * `/dev/lesson-lab` are: these are instrument labels for the person driving the
 * instrument, and three deliberate translations of the word "speaking" would be
 * noise in the locale files that §1.8 exists to keep honest. Every string the
 * LEARNER sees on this page comes from the real components and therefore from
 * the real locale files.
 *
 * THE INSTRUMENT IS IN ENGLISH; THE PRODUCT INSIDE IT IS NOT. That distinction
 * is the whole of the locale switch on the panel. The fixtures used to be
 * pinned to `es-MX` while the UI ran in whatever the browser detected, so every
 * screenshot showed English chrome around Spanish content and read as a product
 * full of hardcoded strings — it is not, and `labFixtures.ts` carries the note
 * on what actually went wrong. One switch now moves `i18n.changeLanguage` and
 * the simulated session together, so the two cannot disagree and a screenshot is
 * always coherent. It is also the only way to LOOK at the locale swing: these
 * three labels run to 1.86x of each other, and a plate sized for English is a
 * defect nobody can see in English.
 */

/** The lab's own surfaces. The stage is the point; consent has no stage. */
type LabSurface = LabScene | 'consent';

const LAB_SURFACES: readonly LabSurface[] = [...LAB_SCENES, 'consent'];

/** A `kid` whose guardian is being asked, for the consent fixture. */
const LAB_KID_ID = '9f1c2e44-3a58-4d7b-8b21-6c0e9d4f5a33';

// ── The instrument panel ────────────────────────────────────────────────────

/**
 * The viewport, live.
 *
 * A readout rather than a guess, because the whole reason this page exists is
 * that "it looks fine" at an unrecorded width is not a measurement. It reports
 * the band as well as the number: 1023 and 1024 px are one pixel and two
 * different layouts (`useDesktopPlate` switches the lesson plate from a sheet to
 * a floating corner plate at exactly that line).
 */
function readViewport(): { width: number; height: number; band: string } {
  const width = window.innerWidth;
  return {
    width,
    height: window.innerHeight,
    band: width >= 1024 ? 'desktop' : width >= 768 ? 'tablet' : 'mobile',
  };
}

function useViewport(): { width: number; height: number; band: string } {
  const [size, setSize] = useState(readViewport);

  useEffect(() => {
    const onResize = () => setSize(readViewport());
    // Once on mount as well: a window resized between the lazy initializer and
    // this effect would otherwise leave the readout claiming a width that is no
    // longer true, which is the one thing this component may never do.
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return size;
}

/**
 * EVERY HUD SURFACE ON THE STAGE, MEASURED, RIGHT NOW.
 *
 * The generic query is the point. Naming the surfaces would mean maintaining a
 * list, and a list is exactly what was missing when the caption and the way out
 * both took the top-left corner — nobody had written either of them down
 * anywhere the other could see. `.lf-lumen` is every HudPlate by construction
 * (chip, plate, orb, sheet), `.lf-glass` catches anything on this route still
 * built from the page material, and `button` catches the design system's own
 * controls that are not HudPlates, wherever one is left.
 *
 * A surface nested inside another is dropped: an orb's icon inside its frame
 * overlaps its frame by definition, and reporting that would bury the one
 * collision that matters under a dozen that never did.
 */
function surveyHudSurfaces(): NamedRect[] {
  const stage = document.querySelector('[data-tutor-stage]');
  if (!stage) return [];

  const found: Array<{ node: HTMLElement; surface: NamedRect }> = [];
  for (const node of stage.querySelectorAll<HTMLElement>('.lf-lumen, .lf-glass, button')) {
    // The instrument is never part of the thing under measurement.
    if (node.closest('[data-lab-chrome]')) continue;
    // The projector's two culled properties: a hidden node paints nothing.
    if (node.hidden || node.hasAttribute('inert')) continue;
    // The loading veil covers everything ON PURPOSE — it is a state, not a
    // surface competing for space. Counting it would report seven collisions
    // per phase and bury the ones that are actually bugs.
    if (node.closest('[data-tutor-veil]')) continue;
    const box = node.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) continue;
    // Document order, so any container is already in the list when its own
    // contents come round.
    if (found.some((entry) => entry.node.contains(node))) continue;

    const name =
      node.getAttribute('aria-label')?.trim() ||
      node.textContent?.trim().slice(0, 32) ||
      'unnamed surface';
    found.push({
      node,
      surface: { name, rect: { left: box.left, top: box.top, width: box.width, height: box.height } },
    });
  }

  return found.map((entry) => entry.surface);
}

/**
 * The readout, in its OWN component and with its own state.
 *
 * Deliberately not a `useState` on the page: it re-measures a few times a
 * second, and a page-level state update would re-render `StageShell` — and
 * therefore the canvas subtree — at the same cadence. An instrument that
 * disturbs the thing it measures reports the wrong answer, which is the mistake
 * the collapsed panel above is already there to avoid.
 */
function HudOverlapReadout() {
  const [collisions, setCollisions] = useState<Array<readonly [string, string]>>([]);

  useEffect(() => {
    const tick = window.setInterval(() => setCollisions(overlappingPairs(surveyHudSurfaces())), 400);
    return () => window.clearInterval(tick);
  }, []);

  if (collisions.length === 0) {
    return <span className="lf-caption whitespace-nowrap px-1 text-content-muted">no overlaps</span>;
  }

  return (
    <span className="lf-caption max-w-full px-1 text-error" role="status">
      {collisions.length} overlap{collisions.length === 1 ? '' : 's'}:{' '}
      {collisions.map(([a, b]) => `${a} × ${b}`).join(' · ')}
    </span>
  );
}

/**
 * One switch on the panel.
 *
 * Deliberately NOT the design system's `Button`: that control is 44 px tall
 * because a child taps it, and eleven of them across the top of a 375 px stage
 * would cover more of the thing under review than the HUD does. This is a dev
 * instrument, sized like one, and it is the only place on the route where that
 * argument holds.
 */
function LabSwitch({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'lf-caption shrink-0 whitespace-nowrap rounded-sm px-2 py-1 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        on ? 'bg-primary text-on-primary' : 'bg-surface-sunken text-content-muted hover:text-content',
      )}
    >
      {children}
    </button>
  );
}

// ── The page ────────────────────────────────────────────────────────────────

export default function TutorLabPage() {
  const { t, i18n } = useTranslation();
  const viewport = useViewport();

  const [surface, setSurface] = useState<LabSurface>('introducing');

  /*
   * THE LOCALE, AND IT DRIVES BOTH HALVES.
   *
   * Seeded from whatever i18next already resolved, so arriving on the page does
   * not silently change the language of the app in another tab; after that the
   * switch is the authority. `changeLanguage` persists through the detector, the
   * same way the product's own language picker does — a lab that changed the
   * language only for itself would be one more way for the instrument and the
   * thing under measurement to disagree.
   */
  const [locale, setLocale] = useState<Locale>(() => labLocaleOf(i18n.language ?? DEFAULT_LAB_LOCALE));
  useEffect(() => {
    if (labLocaleOf(i18n.language ?? DEFAULT_LAB_LOCALE) !== locale) void i18n.changeLanguage(locale);
  }, [i18n, locale]);

  const offers = useMemo(() => labOffers(locale), [locale]);

  /*
   * THE CAST SWITCH, and it exists because two of the four tutors could not be
   * looked at in a conversation at all.
   *
   * `labSession` pins the speaking tutor to `rho`, and the audition's picker
   * only moves `preferences` — which the conversing phase deliberately ignores,
   * because upstream a started session carries the cast it was started with. So
   * `liruf` and `dina` were unreachable on the one phase where the thing that
   * makes them different is visible: they have no 3D mouth (/TUTOR_3D.md §3.1),
   * their shot is `closeup-wide` rather than `closeup`, and the 2D face in the
   * caption is the only articulation they have. This sets both halves at once,
   * so the picker and the session can never disagree here either.
   */
  const [cast, setCast] = useState(LAB_PREFERENCES.character);
  const session = useMemo(() => ({ ...labSession(locale), character: cast }), [locale, cast]);

  /*
   * WHICH EXERCISE IS ON THE PLATE. See `labFixtures` -> the activity switch:
   * the scripted one is nearly the shortest thing the plate ever holds, and the
   * plate's height is what this page is for.
   */
  const [activity, setActivity] = useState<string>(DEFAULT_LAB_ACTIVITY);
  /*
   * Open on desktop, collapsed to one chip on a phone.
   *
   * Not a nicety: expanded, the panel is about 120 px tall at 375 px, which is
   * a seventh of the viewport whose crowding is the thing under review. A lab
   * that hides the symptom behind its own instrument reports the wrong answer,
   * so at the width where the argument is tightest the instrument gets out of
   * the way until it is asked for.
   */
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth >= 768);
  const [consentGranted, setConsentGranted] = useState(false);
  /*
   * The DPA policy, separately from consent, because they are separate facts
   * and the four combinations are four different screens. The default is
   * `blocked` — the state we actually ship in, and the one worth landing on
   * first when this page opens.
   */
  const [voicePolicy, setVoicePolicy] = useState<'allowed' | 'blocked'>('blocked');

  /*
   * The three flags `TutorExperience` DERIVES and the lab has to be TOLD.
   *
   * Upstream, `speaking` comes from the audio element, `awaitingReply` from a
   * turn arriving, and `stageReady` from the first frame. There is no audio and
   * no model here, so the first two are switches on the panel — otherwise the
   * orb's `speaking` and `thinking` states, and the plate's "thinking" line, are
   * unreachable and therefore unreviewed. `stageReady` stays REAL: it is the
   * canvas's own `onReady`, so a device that cannot draw the island falls
   * through to the guaranteed no-WebGL arrangements exactly as it would in
   * production, and that arrangement is worth looking at too.
   */
  const [speaking, setSpeaking] = useState(false);
  const [awaitingReply, setAwaitingReply] = useState(false);
  const [stageReady, setStageReady] = useState(false);
  /** Also REAL, same reasoning as `stageReady` above — see `StageShellProps.onTimedOut`. */
  const [stageTimedOut, setStageTimedOut] = useState(false);

  // Held in state, and patched optimistically, because that is what makes the
  // picker a picker: a choice has to reach the live island on the same tick.
  const [preferences, setPreferences] = useState<TutorPreferences>(LAB_PREFERENCES);
  // The cast switch moves the picker with it, so no phase can show a different
  // tutor from the one the conversation is being held with.
  useEffect(() => {
    setPreferences((prev) => (prev.character === cast ? prev : { ...prev, character: cast }));
  }, [cast]);

  useStubbedCoreApi(consentGranted, locale, voicePolicy);

  const scene: LabScene = surface === 'consent' ? 'introducing' : surface;
  const phase = phaseForScene(scene);
  const socket = useLabSocket(scene, locale, activity);

  /*
   * THE REPLAY, DRIVEN BY THE REAL DIRECTOR against a fixture transcript.
   *
   * Nothing about the performance is faked here — `buildReplayScript` and
   * `useReplayDirector` are the ones `/tutor` runs, so the running order, the
   * beat timing, the poses read off the stored rows and the end-of-replay
   * camera pull are all the product's. What the lab supplies is the transcript
   * Core would have served, and only that, which is the same seam every other
   * fixture on this page is drawn at.
   */
  const replayScript = useMemo(
    () => (scene === 'replaying' ? buildReplayScript(labTranscript(locale)) : null),
    [scene, locale],
  );
  const director = useReplayDirector(replayScript);

  // Switching surface resets what a previous surface was in the middle of. The
  // panel is a time machine, not a session, and a stale "thinking" ring carried
  // into the next screenshot is a lie about that screenshot.
  useEffect(() => {
    setAwaitingReply(false);
    setSpeaking(false);
  }, [surface]);

  const handleClip = useCallback(
    (clip: Blob | null) => {
      if (!clip) return;
      setAwaitingReply(true);
      void socket.sendAudio(clip);
    },
    [socket],
  );

  /*
   * THE REAL MICROPHONE HOOK, enabled by the same condition upstream uses.
   *
   * It is a browser API, not a network edge, so the lab does not stub it: a
   * held orb really opens a MediaStream and really lights the browser's
   * recording indicator, which is a thing worth being able to look at.
   *
   * ONE difference from `/tutor`, named rather than hidden: on `introducing`,
   * `TutorExperience` hands the orb an inert stand-in whose `start()` OPENS a
   * session instead of recording. The lab has no session to open, so it passes
   * the real hook (disabled, because the phase is not `conversing`). The orb
   * RENDERS identically — `MicOrb` reads `state`, the copy keys and
   * `permission`, and all three match — so nothing about the composition this
   * page measures is affected. Pressing it simply does nothing; the switcher is
   * how you move to a conversation here.
   */
  const microphone = useMicrophone(phase === 'conversing' && socket.microphone, {
    onAutoRelease: handleClip,
  });

  /*
   * A replay performs the CAST IT WAS RECORDED WITH, exactly as upstream does:
   * the summary in the transcript carries the character and the island, and
   * they outrank whatever the picker currently holds.
   */
  const replaySession = phase === 'replaying' ? (replayScript?.session ?? null) : null;
  const character = replaySession
    ? replaySession.character
    : phase === 'conversing'
      ? session.character
      : preferences.character;
  const companion = replaySession
    ? replaySession.companion
    : phase === 'conversing'
      ? session.companion
      : preferences.companion;
  const diorama =
    preferences.diorama in SCENE_ASSETS
      ? (preferences.diorama as keyof typeof SCENE_ASSETS)
      : 'diorama-a';
  const backdrop = isSceneBackdropId(preferences.backdrop) ? preferences.backdrop : 'auto';

  const articulates = LAB_CATALOG.articulates.includes(character);
  const shot = shotForPhase({
    phase,
    articulates,
    adaptationOffered: socket.adaptationOffer !== null,
    // The lab's introduction carries the map fixture, exactly as the product
    // does once the KC graph is seeded.
    mapOpen: phase === 'introducing',
    replayEnded: director?.finished ?? false,
  });

  const audition = useMemo(() => auditionFor(phase, LAB_CATALOG.characters), [phase]);

  const blockedBy =
    phase === 'conversing'
      ? narrowBlockedReason(session.microphoneBlockedBy)
      : micBlockedForOffers(offers);

  const micPlan = micForPhase({
    phase,
    blockedBy,
    live: socket.microphone,
    recording: microphone.recording,
    awaitingReply,
    speaking,
    starting: false,
  });

  const mic: StageMicProps = {
    present: micPlan.present,
    state: micPlan.state,
    microphone,
    blockedReason: micPlan.blockedReason,
    blockedCopy: micPlan.blockedKey ? t(micPlan.blockedKey) : null,
    idleCopy: micPlan.idleKey ? t(micPlan.idleKey) : undefined,
    denied: microphone.permission === 'denied',
    onClip: handleClip,
    // Upstream this nulls the speech URL for the current turn, which stops the
    // clip. There is no clip here, so the visible half of it is all there is.
    onInterrupt: () => setSpeaking(false),
  };

  const common = { phase, ready: stageReady, timedOut: stageTimedOut };

  const personalizeLayer: PersonalizeLayerProps = {
    ...common,
    preferences,
    catalog: LAB_CATALOG,
    saving: false,
    onSave: (patch) => {
      setPreferences((prev) => ({ ...prev, ...patch }));
      // There is no real backend here — a lab save always "succeeds".
      return Promise.resolve(true);
    },
    onDone: () => setSurface('introducing'),
  };

  const offerLayer: OfferLayerProps = {
    ...common,
    offers,
    starting: false,
    startError: null,
    startErrorResetAt: null,
    // No real backend here — the fixture never actually goes stale, so this
    // is a no-op rather than a real refetch.
    onRetryOffers: () => {},
    onStart: () => setSurface('conversing'),
    onPersonalize: () => setSurface('personalizing'),
    // The lab's stand-in token. It never leaves the page — the shim in
    // `labFixtures` answers the replay list before `fetch` does.
    token: LAB_TOKEN,
    onReplay: () => setSurface('replaying'),
  };

  const conversationLayer: ConversationLayerProps = {
    ...common,
    session,
    socket,
    token: LAB_TOKEN,
    speaking,
    // The lab drives fixtures, not a real voice provider — there is no
    // `<audio>` element here to read a playback position from, so the
    // caption correctly falls back to its ordinary typewriter reveal.
    audioElement: null,
    awaitingReply,
    onAwaitReply: () => setAwaitingReply(true),
    // The lab has no hands-free listener to gate — there is no real turn
    // loop here, only fixed fixtures — so there is nothing to do with this.
    onDraftChange: () => {},
    // The lab mounts no live segment fixture yet (`LiveSegmentPanel` never
    // renders here — see `LiveSegmentPanel.characterCue.test.tsx` for the
    // real integration coverage), so there is nothing for this to drive.
    onCharacterCue: () => {},
    // There is no wire here, so there is nothing to resume and no wait to
    // outlive; the affordances still render, which is what the lab is for.
    resuming: false,
    replyTimedOut: false,
    onRestart: () => setSurface('introducing'),
    onExit: () => {
      socket.endSession();
      setSurface('closing');
    },
  };

  const replayLayer: ReplayLayerProps = {
    ...common,
    director,
    // The fixture is synchronous, so neither of the two failure surfaces is
    // reachable from the switcher. They are the ordinary shape of one fetch and
    // are exercised by `/tutor` itself.
    loading: false,
    error: null,
    onDone: () => setSurface('introducing'),
  };

  const panel = (
    <div
      // `data-lab-chrome` is the hook a measurement script uses to subtract this
      // panel from anything it is measuring. The instrument must never be
      // counted as part of the thing under measurement.
      data-lab-chrome=""
      className="pointer-events-auto fixed right-2 top-2 z-[60] flex max-w-[calc(100vw-1rem)] flex-col items-end gap-1"
    >
      {panelOpen ? (
        <div className="flex max-w-full flex-col gap-1.5 rounded-md border border-outline bg-surface p-2 shadow-pop">
          <div className="flex items-center justify-between gap-3">
            <span className="lf-caption text-content">
              {viewport.width} × {viewport.height} · {viewport.band}
            </span>
            <LabSwitch on={false} onClick={() => setPanelOpen(false)}>
              hide
            </LabSwitch>
          </div>

          <div className="flex max-w-full gap-1 overflow-x-auto">
            {LAB_SURFACES.map((id) => (
              <LabSwitch key={id} on={surface === id} onClick={() => setSurface(id)}>
                {id}
              </LabSwitch>
            ))}
          </div>

          {/*
            THE LOCALE SWITCH, and it is one switch rather than two because the
            two halves it moves may never be set separately. Pressing `es-MX`
            changes the app's language AND the simulated session's content, so
            the tutor's line, the activity, the transcript and the chrome around
            them are always one language. Every screenshot ever taken of this
            page before this row existed showed English chrome around Spanish
            content, and was read — reasonably — as evidence of hardcoded
            strings in the product.
          */}
          <div className="flex max-w-full gap-1 overflow-x-auto">
            {LAB_LOCALES.map((id) => (
              <LabSwitch key={id} on={locale === id} onClick={() => setLocale(id)}>
                {id}
              </LabSwitch>
            ))}
          </div>

          {/*
            THE CAST, and WHICH EXERCISE IS ON THE PLATE. Two instruments, one
            row, because both answer the same question: what does this
            composition do when it is handed the hard case rather than the
            fixture it was designed against. The character decides whether the
            2D face in the caption is the tutor's ONLY mouth; the activity
            decides whether the plate is holding three two-character options or
            a market stall with a till.
          */}
          <div className="flex max-w-full items-center gap-1 overflow-x-auto">
            {LAB_CATALOG.characters.map((id) => (
              <LabSwitch key={id} on={cast === id} onClick={() => setCast(id)}>
                {id}
              </LabSwitch>
            ))}
            <select
              value={activity}
              onChange={(event) => setActivity(event.target.value)}
              aria-label="activity on the plate"
              className="lf-caption ml-1 max-w-[11rem] shrink-0 rounded-sm bg-surface-sunken px-1 py-1 text-content"
            >
              {LAB_ACTIVITIES.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </div>

          {/*
            NO CAVEAT UNDER THIS SWITCH ANY MORE, and the deletion is the point.
            It used to read "engine fixture — es-MX content by design", because
            the engine's fixtures were pinned to Spanish and a lesson DOCUMENT is
            single-locale (LESSON_ENGINE.md §3). True, and beside the point: a
            page whose whole job is to rule out a language defect may not itself
            print two languages at once and explain it in a footnote.
            `lesson-engine/lab/fixtureCopy.ts` writes every fixture in all three
            now, so every activity on this switch is safe to photograph the
            language from.
          */}

          <div className="flex max-w-full gap-1 overflow-x-auto">
            <LabSwitch on={speaking} onClick={() => setSpeaking((on) => !on)}>
              speaking
            </LabSwitch>
            <LabSwitch on={awaitingReply} onClick={() => setAwaitingReply((on) => !on)}>
              thinking
            </LabSwitch>
            {surface === 'consent' && (
              <>
                <LabSwitch on={consentGranted} onClick={() => setConsentGranted((on) => !on)}>
                  consent granted
                </LabSwitch>
                <LabSwitch
                  on={voicePolicy === 'allowed'}
                  onClick={() => setVoicePolicy((p) => (p === 'allowed' ? 'blocked' : 'allowed'))}
                >
                  policy allows
                </LabSwitch>
              </>
            )}
            <span className="lf-caption self-center whitespace-nowrap px-1 text-content-muted">
              {stageTimedOut ? 'stage ready (timed out)' : stageReady ? 'stage ready' : 'no first frame'}
            </span>
          </div>

          {/*
            THE COLLISION READOUT. The owner found three surfaces sitting on
            each other by testing on a phone; nothing in the repo could have
            told anyone before they did. It is a line on the instrument rather
            than a gate because the fix is usually a judgement about which
            surface should move, and because a HUD that overlaps for one frame
            while a sheet animates is not a bug — a HUD that overlaps at rest
            is.
          */}
          <HudOverlapReadout />
        </div>
      ) : (
        <LabSwitch on onClick={() => setPanelOpen(true)}>
          lab
        </LabSwitch>
      )}
    </div>
  );

  if (surface === 'consent') {
    /*
     * The ONE surface here that has no stage.
     *
     * The guardian's microphone gate lives on `/family`, not on the Tutor
     * route, and its exact wording is what a consent dispute is resolved
     * against (/ORACLE.md §4.3). It kept its place on this page when the rest
     * of it became a stage, because the alternative was that the one legally
     * significant screen in the feature went back to being unviewable.
     */
    return (
      <div className="min-h-screen bg-surface-sunken">
        {panel}
        <div className="mx-auto flex max-w-container flex-col gap-4 px-5 py-6 md:px-8 md:py-10">
          <p className="lf-body max-w-prose text-content-muted">
            The guardian&rsquo;s microphone gate, as it appears on /family. Toggle the fixture on the
            panel to see both states; the wording below is what Core stores verbatim.
          </p>
          <div className="rounded-lg border border-outline bg-surface">
            <VoiceConsentControl
              key={`${String(consentGranted)}-${voicePolicy}`}
              kidUserId={LAB_KID_ID}
              token={LAB_TOKEN}
              kidName="Ana"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <StageShell
        mic={mic}
        dockLabel={
          phase === 'replaying'
            ? t('tutor.stage.replayControls')
            : phase === 'closing'
              ? t('tutor.stage.closeControls')
              : undefined
        }
        audition={audition}
        scene={diorama}
        character={character}
        companion={companion}
        backdrop={backdrop}
        // In a replay the pose is the one the character ORIGINALLY held, read
        // off the stored row by the real director — the same expression the
        // real route hands the canvas.
        emotion={director?.beat?.emotion ?? socket.turn?.emotion ?? 'neutral'}
        action={director?.beat?.action ?? socket.turn?.action ?? 'idle'}
        actionKey={director?.beatKey ?? socket.turn?.seq ?? 0}
        // Null always. Audio is a network edge and the lab has no clip — the
        // replay fixture is deliberately a silent recording, which is the
        // arrangement every conversation reaches after ninety days — so the
        // `speaking` switch drives everything the clip would have driven.
        speechUrl={null}
        audioKey={director?.beatKey ?? socket.turn?.seq ?? 0}
        shot={shot}
        onReady={() => setStageReady(true)}
        onTimedOut={() => setStageTimedOut(true)}
        onSpeechEnd={() => setSpeaking(false)}
      >
        {/*
          No layer on `unavailable`, exactly as upstream. The sentence lives on
          the microphone now (`micForPhase`), because two surfaces saying the
          same thing landed on each other at both widths.
        */}

        {phase === 'personalizing' && (
          <StageLayer label={t('tutor.stage.personalizeLayer')} placement="world">
            <PersonalizeInWorld {...personalizeLayer} />
          </StageLayer>
        )}

        {phase === 'introducing' && (
          <StageLayer label={t('tutor.stage.introduceLayer')} placement="world">
            <OfferChips {...offerLayer} character={character} nickname={preferences.nickname} map={labMap(locale)} />
          </StageLayer>
        )}

        {phase === 'conversing' && (
          <StageLayer label={t('tutor.stage.conversationLayer')} placement="world">
            <ConversationView {...conversationLayer} />
          </StageLayer>
        )}

        {phase === 'closing' && (
          /*
            The same component `/tutor` mounts, not a copy of it. Two hand-kept
            copies is how a lab comes to report on a screen nobody ships.
          */
          <StageLayer label={t('tutor.stage.closeLayer')} placement="world">
            <ClosingInWorld
              token={LAB_TOKEN}
              onStartAnother={() => setSurface('introducing')}
              onReplay={() => setSurface('replaying')}
              closedReason={null}
            />
          </StageLayer>
        )}

        {phase === 'replaying' && (
          /*
            The same component `/tutor` mounts, driven by the same director. The
            only fixture underneath it is the transcript Core would have served.
          */
          <StageLayer label={t('tutor.stage.replayLayer')} placement="world">
            <ReplayInWorld {...replayLayer} />
          </StageLayer>
        )}
      </StageShell>

      {panel}
    </>
  );
}
