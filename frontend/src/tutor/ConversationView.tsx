import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Button, Icon } from '@/components/ui';
import { useAnchorSlot } from '@/tutor-scene/ScreenAnchor';
import { useSafeArea } from '@/tutor-scene/SafeAreaContext';
import { HudPlate } from './hud/HudPlate';
import { LessonPlate, type LessonPlateDetent } from './hud/LessonPlate';
import { WorldChip } from './hud/WorldChip';
import { SpeechCaption } from './SpeechCaption';
import { TutorBubble, TutorTranscript } from './TutorBubble';
import { LiveSegmentPanel } from './LiveSegmentPanel';
import { useStageDock, type ConversationLayerProps, type StageDockValue } from './stage/StageShell';

/*
 * The session itself, composed IN the scene.
 *
 * WHAT THIS LAYER IS NOW. Four surfaces over one continuous island, and not one
 * of them is a page. The caption rides the speaking character's own crown. The
 * lesson floats on a plate in the corner with island visible on all four sides.
 * The microphone is the largest control on the screen. Everything else is a
 * chip pinned to a named place in the world. There is no column, no grid, no
 * card and no header bar, because the version with those was rejected twice and
 * the reason both times was the SILHOUETTE rather than any individual control.
 *
 * WHAT IT DELETED, specifically, since each was a mechanism and not a mistake
 * of taste:
 *
 * - `lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]`. That one class is how the
 *   stage got minimised: it gave the island half a page to live in and put a
 *   panel in the other half. There is no split now; the island is the whole
 *   frame and the lesson is a plate on top of it.
 * - `{socket.microphone && (...)}` around the microphone button. With no voice
 *   provider configured the server says no, so that guard removed the single
 *   most important affordance in the product from every session anybody has
 *   ever run. The orb is now unconditional and says why when it cannot be
 *   used — and it is not mounted here at all any more, because being mounted
 *   here and in the arrival layer is what left four of the six phases with no
 *   microphone on screen. It belongs to the stage (`stage/StageShell.tsx`);
 *   this layer contributes the rows that ride above and below it.
 * - The raw `socket.error.message` on screen. An untranslated server string in
 *   front of a child is both a §1.8 violation and a leak of our internal
 *   wording; the CODE maps to a sentence we wrote, in their language.
 * - The global space-bar listener. See below.
 *
 * EVERY QUESTION THE TUTOR ASKS IS ANSWERABLE WITHOUT THE SCENE. This is the
 * rule the first version of this file broke, and it broke it in the one place
 * that matters most. The adaptation offer existed ONLY as three chips anchored
 * to `stage.mark.2`, `.1` and `.3`, and an anchored chip is hidden AND inert
 * whenever its world point leaves the frame (`ScreenAnchor.tsx`). Three marks
 * are three independent cull decisions, so on a phone, in the default
 * single-character configuration, whichever mark the placement solver happened
 * to leave in frame was what the learner got: nothing at all, or a bare "Yes
 * please" with no question beside it and no way to decline. The tutor was
 * asking a question the child could not answer. So the offer now lives in two
 * places at once, exactly the way a WorldChip and its mesh do (/DESIGN.md →
 * Components → WorldChip): the in-world pair is the delightful path and it is
 * ONE anchored node, so it is whole or absent and never a fragment; the pair
 * beside the microphone rides the shell's dock, is viewport-anchored, is never
 * culled by any camera move, and is the path the product actually promises.
 * Both dispatch the same handler, so there is one code path with two ways in
 * rather than a fallback that quietly diverges from the real feature.
 *
 * AND THE WHOLE LAYER HAS A NO-SCENE ARRANGEMENT, for the same reason its two
 * sibling layers do. `ready` is false on a device with no usable WebGL and
 * false until the first frame anywhere else, and while it is false NOTHING
 * anchored will ever be positioned. The caption over the speaker's crown and
 * the minutes rune in the sky are therefore replaced by plates that need no
 * projection, rather than being mounted as permanently hidden nodes and left to
 * take the tutor's own words offscreen with them.
 *
 * WHAT THIS LAYER DOES NOT DO, and must not start doing: drive the scene. The
 * emotion, the action, the speech URL and the camera shot are all derived from
 * this same socket one level up and handed to the single canvas there, so a
 * conversation ending can never take the island down with it.
 *
 * WHY THE SAME LINE APPEARS THREE TIMES. The caption above the head, the 2D
 * bubble, and the audio are not redundancy — they are three channels for three
 * different learners, and every one of them is somebody's only channel. A deaf
 * learner has the first two; a pre-reader has the third; a learner on a phone
 * on a bus with no headphones has the first two again. For `liruf` and `dina`
 * the bubble is the only articulating mouth that exists (/TUTOR_3D.md §3.1), so
 * it is not the fallback: for half the cast it is the feature.
 */

export type ConversationViewProps = ConversationLayerProps;

export function ConversationView({
  session,
  socket,
  token,
  ready,
  speaking,
  awaitingReply,
  onAwaitReply,
  onExit,
}: ConversationViewProps) {
  const { t } = useTranslation();
  const safeArea = useSafeArea();
  const dock = useStageDock();

  const [typed, setTyped] = useState('');
  /*
   * HALF is the resting detent, not PEEK, and that is a deaf-accessibility
   * decision rather than a default. The 2D head is the only mouth `liruf` and
   * `dina` have, and at PEEK the plate is 88 px tall and shows the top of it at
   * best. PEEK exists so a learner can deliberately get the plate out of the
   * way; it is not somewhere to leave them.
   */
  const [detent, setDetent] = useState<LessonPlateDetent>('half');

  /*
   * Where the plate is, readable from a subscription callback.
   *
   * The keyboard listener below is registered once for the life of the layer
   * and must not be torn down and rebuilt every time the plate moves, so it
   * cannot close over `detent`. A ref mirrored during render is the same
   * pattern `LessonPlate` uses for `onFootprint`.
   */
  const detentRef = useRef<LessonPlateDetent>(detent);
  detentRef.current = detent;

  /**
   * The detent the soft keyboard BORROWED, held until it is given back.
   *
   * Null means nothing is owed. Non-null means we, and not the learner, put the
   * plate at PEEK, and this is where it was standing before we did.
   */
  const borrowedDetentRef = useRef<LessonPlateDetent | null>(null);

  /*
   * Every detent change that is not the keyboard's own cancels the loan.
   *
   * A learner who drags the sheet while the keyboard is open has just said
   * where they want it, and handing back a height they overrode thirty seconds
   * earlier is the plate arguing with them.
   */
  const changeDetent = useCallback((next: LessonPlateDetent) => {
    borrowedDetentRef.current = null;
    setDetent(next);
  }, []);

  const { turn, sendText } = socket;
  const turnSeq = turn?.seq ?? 0;
  const segmentId = socket.segment?.segmentId ?? null;
  const ended = socket.closedReason !== null || socket.connection === 'closed';

  /*
   * THE GLOBAL SPACE-BAR LISTENER IS GONE, and removing it is the fix rather
   * than a regression. It used to hold the microphone from anywhere on the page
   * and bail out only while the composer had focus. This composition multiplies
   * focusable in-scene controls — chips, the plate, the handle, the send
   * button — and every one of them is a surface where Space is already the
   * activation key, so widening that guard would have meant enumerating them.
   * `MicOrb` owns Space and Enter while it has focus and implements hold and
   * tap properly, which is strictly better than what the global listener did,
   * and it cannot fight another control for a key press.
   */

  const submitTyped = () => {
    const value = typed.trim();
    if (value === '' || ended) return;
    sendText(value);
    setTyped('');
    // The wait is owned upstream, beside the orb that also displays it.
    onAwaitReply();
  };

  // A new activity is worth looking at. It raises a minimised sheet to the
  // working detent and never lowers one the learner opened themselves.
  useEffect(() => {
    if (segmentId === null) return;
    if (detentRef.current !== 'peek') return;
    /*
     * Raising it also settles the keyboard's debt: an arriving exercise is a
     * better reason to be at HALF than the keyboard was to be at PEEK, so the
     * restore must not fire later and undo it. Both the read and the clear
     * happen HERE rather than inside a state updater, because StrictMode
     * invokes an updater twice and a side effect written into one runs twice
     * with it.
     */
    borrowedDetentRef.current = null;
    setDetent('half');
  }, [segmentId]);

  /*
   * AN ARRIVING OFFER TAKES THE PLATE OFF FULL, and this is a measurement
   * rather than a courtesy.
   *
   * `LessonPlate` reserves a fixed 300 px above the sheet for the dock
   * (`STAGE_RESERVE_PX`), a number measured before the dock carried a question
   * and two answers. Measured again with them in a real browser, on a 375x812
   * phone at the FULL detent, the dock runs from y = -28: the answers are still
   * whole and pressable, but the top of the question is cut off, and a half
   * read question is a poor thing to answer. A transcript opened for reading
   * can wait the few seconds a yes-or-no takes; the question cannot. The
   * learner may drag straight back to FULL, and nothing here fights them if
   * they do.
   */
  const adaptationOffer = socket.adaptationOffer;
  useEffect(() => {
    if (adaptationOffer === null) return;
    if (detentRef.current !== 'full') return;
    borrowedDetentRef.current = null;
    setDetent('half');
  }, [adaptationOffer]);

  /*
   * The soft keyboard BORROWS the sheet's height and gives it back.
   *
   * Dropping to PEEK while the keyboard is up is right: at 375 px an open
   * keyboard plus a half-height sheet leaves the caption nowhere at all, so the
   * tutor would be speaking somewhere behind the learner's own composer. What
   * was missing is the other half of the sentence. The listener ignored
   * `open === false` entirely, so the plate stayed minimised for the rest of
   * the session and the 2D bubble — the only mouth `liruf` and `dina` have —
   * stayed folded away at 88 px with it. Only a brand-new segment or a manual
   * drag could raise it again, which is exactly what this file's own comment on
   * PEEK says must not happen: PEEK is somewhere a learner may deliberately go,
   * never somewhere to leave them.
   */
  useEffect(() => {
    if (!safeArea) return;
    return safeArea.subscribeKeyboard((open) => {
      if (open) {
        // Already minimised: there is nothing to borrow, and recording PEEK
        // would later "restore" the plate to the height it is already at while
        // claiming a debt had been settled.
        if (detentRef.current === 'peek') return;
        borrowedDetentRef.current = detentRef.current;
        setDetent('peek');
        return;
      }

      const borrowed = borrowedDetentRef.current;
      borrowedDetentRef.current = null;
      // Only what the keyboard lowered comes back up.
      if (borrowed) setDetent(borrowed);
    });
  }, [safeArea]);

  /*
   * THE DOCK RIDES ABOVE THE SHEET, through a ref channel the SHELL owns.
   *
   * The sheet's height changes on every frame of a drag, so this must never
   * become a `setState`: it would re-render the live exercise sixty times a
   * second while the learner's thumb is down and the GPU is drawing an island.
   * The plate reports its footprint, the shell writes one inline `bottom` on
   * the one element that carries the orb and everything stacked around it.
   *
   * `dock` is null only where no shell is mounted, which is a unit test or the
   * lab. The sheet is then simply not riding above anything, which is correct:
   * there is nothing above it.
   */
  const publishFootprint = useCallback((px: number) => dock?.setFootprint(px), [dock]);

  /*
   * An error CODE, never the wire message. `CONSENT_REVOKED` gets the sentence
   * we already wrote for a guardian turning the microphone off, because
   * "something went wrong on our side" is not what happened and a child should
   * not be told it was.
   */
  const errorLine = !socket.error
    ? null
    : socket.error.code === 'CONSENT_REVOKED'
      ? t('tutor.offers.voiceNeedsConsent')
      : t(`errors.api.${socket.error.code}`, { defaultValue: t('errors.api.INTERNAL') });

  const minutes = Math.max(0, Math.ceil(socket.remainingMs / 60_000));
  const budgetRune =
    socket.budget === 'wrapping'
      ? t('tutor.conversation.wrappingUp')
      : socket.budget === 'running' && socket.remainingMs > 0
        ? t('tutor.conversation.minutesLeft', { count: minutes })
        : null;

  const adaptation = socket.adaptationOffer;
  const adaptationQuestion = adaptation ? t(`tutor.adaptationOffer.${adaptation}`) : '';

  /*
   * THE TWO ANSWERS, DESCRIBED ONCE AND MOUNTED IN BOTH PLACES.
   *
   * One element, one handler, two ways in. Writing the in-world pair and the
   * docked pair as separate JSX is how an accessible twin starts diverging
   * from the real feature at the second change to either.
   *
   * Each answer carries the WHOLE question in its accessible name, because a
   * learner can meet either pair on its own and "Yes please" with nothing to
   * say yes to is not a control. The visible word comes FIRST: leading with the
   * sentence drops the visible label out of the front of the accessible name,
   * which breaks voice control for the one control a child is most likely to
   * ask for out loud.
   */
  const adaptationAnswers = adaptation && (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <HudPlate
        as="button"
        shape="chip"
        floor="surface"
        data-answer="yes"
        aria-label={`${t('tutor.conversation.yesPlease')} ${adaptationQuestion}`}
        onClick={() => socket.answerAdaptation(adaptation, true)}
        className="pointer-events-auto"
      >
        <span className="lf-caption">{t('tutor.conversation.yesPlease')}</span>
      </HudPlate>

      <HudPlate
        as="button"
        shape="chip"
        floor="surface"
        data-answer="no"
        aria-label={`${t('tutor.conversation.noThanks')} ${adaptationQuestion}`}
        onClick={() => socket.answerAdaptation(adaptation, false)}
        className="pointer-events-auto"
      >
        <span className="lf-caption">{t('tutor.conversation.noThanks')}</span>
      </HudPlate>
    </div>
  );

  return (
    <>
      {ready ? (
        <>
          <SpeechCaption text={turn?.text ?? null} turnSeq={turnSeq} />

          {/*
            Time is a rune over the island, not a chip in a header bar, because
            there is no header bar. It reports and is not a control, so it is
            not in the tab order (/DESIGN.md → Screen Recipes → Tutor: one sky
            rune, this one; the way out is viewport-anchored precisely so it
            cannot be culled the way this one can). The wrap-up state is
            repeated on the plate below, where it cannot be culled by the camera
            turning away: the minutes are ambient, but "we are nearly done"
            changes what the learner should spend the rest of the session on
            (/ORACLE.md §9.5).
          */}
          {budgetRune && (
            <WorldChip slot="sky.mark.3">
              <span className="lf-caption">{budgetRune}</span>
            </WorldChip>
          )}
        </>
      ) : (
        /*
          THE SAME TWO LINES, WITH NO SCENE TO HANG THEM ON.

          Both nodes above are anchored, and an anchored node is hidden and
          inert until the projector places it. Where there is no usable WebGL
          the projector never runs at all, so mounting them here would put the
          tutor's own words on a node nothing will ever position. That is worse
          than it sounds: the 2D bubble on the plate carries the same sentence
          VISUALLY but is deliberately not a live region, precisely because the
          caption already is (`TutorBubble.tsx`). Dropping the caption without
          replacing it therefore leaves a screen-reader learner with a tutor
          that never says anything at all.

          The typewriter goes with the projection. A device that cannot draw the
          island has no performance to keep up with, and a line that types
          itself out here is a delay rather than a character speaking.
        */
        <div className="pointer-events-none fixed inset-x-0 top-3 z-30 mx-auto flex w-full max-w-[min(34rem,92vw)] flex-col items-center gap-2 px-4 lg:top-6">
          {turn?.text && (
            <HudPlate shape="plate" floor="surface">
              <span className="lf-body" aria-live="polite" aria-atomic="true">
                {turn.text}
              </span>
            </HudPlate>
          )}
          {budgetRune && (
            <HudPlate shape="chip" floor="sunken">
              <span className="lf-caption">{budgetRune}</span>
            </HudPlate>
          )}
        </div>
      )}

      {/*
        THE ADAPTATION OFFER IS A QUESTION A CHARACTER ASKS, so it looks like
        one: the question and both answers float between the tutor and their
        companion, under the two-shot the phase mapping already swings to
        whenever an offer is pending. The card that used to push the
        conversation down the page said the same words and meant something else
        (/ORACLE.md §9.4).

        This is the DELIGHTFUL path, and it is allowed to disappear. The pair
        that may never disappear rides the dock beside the microphone.
      */}
      {ready && adaptation && (
        <AdaptationInWorld question={adaptationQuestion}>{adaptationAnswers}</AdaptationInWorld>
      )}

      <LessonPlate
        label={t('tutor.conversation.plateLabel')}
        resizeLabel={t('tutor.conversation.resizePanel')}
        detent={detent}
        onDetentChange={changeDetent}
        onFootprint={publishFootprint}
        header={
          // Finishing is a first-class turn, so it lives on the one surface
          // that is never culled and never scrolls away. The shell's way out
          // LEAVES the route; this ends the session, and the tutor gets to say
          // goodbye (/ORACLE.md §9.5).
          <Button variant="secondary" onClick={onExit}>
            {t('tutor.conversation.finish')}
          </Button>
        }
      >
        <TutorBubble
          character={session.character}
          emotion={turn?.emotion ?? 'neutral'}
          action={turn?.action ?? 'idle'}
          actionKey={turnSeq}
          speaking={speaking}
          history={socket.history}
          line={turn?.text ?? null}
          label={t('tutor.conversation.bubbleLabel')}
          // The log is mounted separately, below the activity: the tutor speaks,
          // hands over an exercise, and the history belongs under both.
          transcript={false}
        />

        {socket.budget === 'wrapping' && (
          <p className="lf-caption rounded-md bg-warning-soft px-3 py-2 text-content" role="status">
            {t('tutor.conversation.wrappingUp')}
          </p>
        )}

        {socket.intelDegraded && (
          <p className="lf-caption text-content-muted">{t('tutor.conversation.gettingToKnowYou')}</p>
        )}

        {/*
          The thinking state has to be visible even when the microphone is not,
          which today is every session: the orb carries it for a learner who
          spoke, and this carries it for the many more who typed.
        */}
        {awaitingReply && (
          <p className="lf-caption text-content-muted" role="status">
            {t('tutor.mic.thinking')}
          </p>
        )}

        {socket.segment ? (
          <LiveSegmentPanel live={socket.segment} token={token} onGraded={socket.reportGrade} />
        ) : ended ? (
          <p className="lf-body text-content-muted" role="status">
            {t('tutor.conversation.ended')}
          </p>
        ) : (
          turn?.next === 'segment' && (
            <p className="lf-body text-content-muted" role="status">
              {t('tutor.conversation.listening')}
            </p>
          )
        )}

        <TutorTranscript history={socket.history} label={t('tutor.conversation.transcriptLabel')} />
      </LessonPlate>

      {/*
        THE ROWS THAT RIDE WITH THE MICROPHONE.

        They are rendered into the SHELL's dock rather than into a cluster of
        this layer's own, because the orb, this question, this refusal and this
        composer all stack above one bottom edge — an edge the lesson sheet
        moves on every frame of a drag. Two elements cannot both own that edge,
        and when they tried, the answer was two `position: fixed` columns whose
        agreement about where the bottom was depended on both of them being
        given the same footprint.

        A PORTAL, not a prop. The composer holds a keystroke's worth of state
        and re-renders on every character; hoisting it into the shell would
        re-render the island with it. A portal moves the DOM and leaves the
        state exactly where it is.
      */}
      <DockSlot dock={dock} target={dock?.above ?? null}>
        {/*
          THE GUARANTEED WAY TO ANSWER THE TUTOR, and the whole reason this
          block exists twice.

          It is FIRST in the dock's upper slot, not last, and that is a
          measurement rather than a preference. The dock grows upward from a
          bottom edge the sheet's footprint fixes, and `LessonPlate`'s
          `STAGE_RESERVE_PX` leaves it about 272 px at the FULL detent, so
          whatever sits at the TOP of the column is what a tall dock pushes off
          the screen. Putting the offer last would have made the microphone and
          the composer the overflow, which is a bug this route has already
          shipped once; putting it first risks clipping the top of a question
          whose two answers stay fully on screen and fully pressable underneath
          it.

          It is announced HERE and not in the world, because this copy is the
          one that always exists: two live regions carrying one sentence make a
          screen reader say everything twice, so the in-world plate above stays
          silent and this one carries the announcement.
        */}
        {adaptation && (
          <div data-offer="guaranteed" className="flex w-full flex-col items-center gap-2">
            <HudPlate shape="plate" floor="sunken" className="pointer-events-none">
              <span className="lf-caption" role="status">
                {adaptationQuestion}
              </span>
            </HudPlate>
            {adaptationAnswers}
          </div>
        )}

        {errorLine && (
          <HudPlate shape="plate" floor="sunken" role="status" className="pointer-events-none self-center">
            <span className="lf-caption">{errorLine}</span>
          </HudPlate>
        )}

      </DockSlot>

      <DockSlot dock={dock} target={dock?.below ?? null}>
        {/*
          Typing is not the fallback. With no voice provider configured it is
          the ONLY channel, so it is a permanent, full-width control rather than
          something hidden behind an icon. It is also the one field every
          /ORACLE.md §5 injection defence exists for, which is why the single
          line and the 2000 character cap are unchanged.

          Built from `.lf-glass` plus an explicit opaque floor rather than from
          `HudPlate`, whose measures are reading widths for labels: a composer
          capped at 22ch would be four words wide.
        */}
        <div className="lf-glass pointer-events-auto flex items-center rounded-full p-0.5 shadow-glass-sm">
          <div className="flex min-w-0 flex-1 items-center gap-1 rounded-full bg-surface pl-4 pr-0.5">
            <input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && submitTyped()}
              maxLength={2000}
              disabled={ended}
              placeholder={t('tutor.conversation.typePlaceholder')}
              aria-label={t('tutor.conversation.typePlaceholder')}
              className="lf-body h-11 min-w-0 flex-1 bg-transparent text-content placeholder:text-content-muted focus:outline-none disabled:opacity-60"
            />
            <button
              type="button"
              onClick={submitTyped}
              disabled={typed.trim() === '' || ended}
              aria-label={t('tutor.conversation.send')}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-content-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-40"
            >
              <Icon name="send" />
            </button>
          </div>
        </div>
      </DockSlot>
    </>
  );
}

/**
 * A row of chrome that belongs beside the microphone.
 *
 * With a dock it is a portal into the shell's own column, so the DOM order and
 * the one measured rect stay where the orb is. WITHOUT one — a unit test, the
 * lab — it renders exactly where it stands rather than disappearing, because a
 * composer that vanishes when the shell is absent is a control that only exists
 * in the configuration nobody tests.
 *
 * The middle case is the one worth spelling out: a dock EXISTS but its slot is
 * still attaching, which is true for exactly the first render. Rendering in
 * place for that one frame would flash the composer across the top-left corner
 * of the island, so it renders nothing and lands a frame later in the right
 * place. A missing dock and an attaching one are different states and are read
 * as such.
 */
function DockSlot({
  dock,
  target,
  children,
}: {
  dock: StageDockValue | null;
  target: HTMLElement | null;
  children: ReactNode;
}) {
  if (!dock) return <>{children}</>;
  if (!target) return null;
  return createPortal(children, target);
}

/**
 * The offer, floating between the tutor and their companion (/ORACLE.md §9.4).
 *
 * ONE anchored node for the question AND both answers, where there used to be
 * three chips on three separate marks. Three nodes are three independent cull
 * decisions: `stage.mark.1`, `.2` and `.3` sit at different bearings around the
 * island, so which of them the camera happened to frame decided which THIRD of
 * a yes-or-no question the learner was shown. A bare "Yes please" with no
 * question beside it and no way to decline is worse than showing nothing at
 * all, because it is a control a child can press without knowing what it
 * agrees to. One node is one decision, so this arrangement is whole or absent.
 *
 * It is deliberately NOT built from `WorldChip`, for the same reason
 * `PersonalizeInWorld` has its own `WorldSlot`: `WorldChip` renders exactly one
 * plate, and holding a question and two answers together on one point needs
 * three. The contract with the projector is copied rather than adapted, and
 * every clause of it is load-bearing.
 */
function AdaptationInWorld({ question, children }: { question: string; children: ReactNode }) {
  const anchorRef = useAnchorSlot('stage.mark.2');

  return (
    <div
      ref={anchorRef}
      data-offer="world"
      /*
       * ZERO-SIZED, `fixed` at the origin, and carrying NO TRANSFORM OF ITS
       * OWN. The projector writes this node's whole transform every frame and
       * ends it with `translate(-50%, -50%)`, so a box with no size centres
       * exactly on the published point and anything Tailwind added here would
       * be erased or applied twice.
       *
       * `lf-caption` sits on THIS element because the projector reads its
       * computed font size once, at registration, to work out how far the node
       * may shrink before its text stops being readable. The smallest type
       * inside is the answers' caption, so the floor is computed against the
       * text that becomes illegible first rather than against the question.
       */
      className="lf-caption pointer-events-none fixed left-0 top-0 z-20 h-0 w-0 will-change-transform"
    >
      {/*
        Standing clear of the mark, since the marks are at standing height and
        a plate centred on one would sit across the island floor. The column
        keeps the question directly above its own answers: they are one thought
        and they are read in that order.
      */}
      <div className="absolute bottom-4 left-1/2 flex w-[min(80vw,24rem)] -translate-x-1/2 flex-col items-center gap-2">
        <HudPlate shape="plate" floor="sunken" className="pointer-events-none">
          {/*
            No live region. The copy beside the microphone is the one that is
            always mounted, so the announcement belongs to it; two live regions
            carrying one sentence make a screen reader say everything twice.
          */}
          <span className="lf-body">{question}</span>
        </HudPlate>
        {children}
      </div>
    </div>
  );
}
