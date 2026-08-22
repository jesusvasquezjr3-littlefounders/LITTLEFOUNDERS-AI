import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui';
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
 * EVERY QUESTION THE TUTOR ASKS IS ANSWERABLE WITHOUT THE SCENE, AND IS ASKED
 * EXACTLY ONCE. Both halves of that sentence were learned the hard way.
 *
 * The first version broke the first half: the adaptation offer existed ONLY as
 * three chips anchored to `stage.mark.2`, `.1` and `.3`, and an anchored chip is
 * hidden AND inert whenever its world point leaves the frame
 * (`ScreenAnchor.tsx`). Three marks are three independent cull decisions, so on
 * a phone whichever mark the placement solver happened to leave in frame was
 * what the learner got: nothing at all, or a bare "Yes please" with no question
 * beside it and no way to decline.
 *
 * The fix for that broke the second half. It mounted the offer TWICE — an
 * anchored copy over `stage.mark.2` and a guaranteed copy on the shell's dock —
 * on the model of a WorldChip and the mesh it mirrors. That model does not
 * apply here, and the difference is the whole point: a WorldChip pairs a DOM
 * control with a PICKABLE MESH, so the learner sees ONE offer that can be
 * reached two ways. Two DOM copies are two offers. Driven at 375x812 the
 * anchored copy read "Would another example h" — clipped at (-42, 105, 263, 57)
 * — over its own "Yes please" at (-2, 170); at 1280x800 the same pair escaped
 * off the TOP instead, "Yes" landing at (40, -13). A half-read question with its
 * own live Yes button beside a whole one is worse than either alone, because a
 * child can press the half-read one.
 *
 * SO THE RULE IS: an offer the learner MUST be able to answer is mounted once,
 * and it is mounted in the band that cannot be culled. The dock copy stays; the
 * anchored copy is gone. What is lost is the offer floating between the two
 * characters, and it is not lost silently — `shotForPhase` still swings to the
 * two-shot while an offer is pending, so the question still arrives as a thing
 * one character asks another. What is gained is that there is exactly one of it.
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
   * PEEK IS WHERE THE SHEET RESTS, and this is the reversal the phone forced.
   *
   * It used to open at HALF, argued for as a deaf-accessibility decision: the
   * 2D head is the only mouth `liruf` and `dina` have, and at PEEK the sheet
   * showed the top of it at best. The argument was right about the mouth and
   * wrong about the arithmetic. HALF is 45% of the viewport, which at 375x812
   * left 227 px of island — so on the phone the answer to "where is the tutor
   * teaching me" was a strip above a panel, on a route whose entire premise is
   * that the stage IS the page. Burying the speaker to show a small picture of
   * the speaker is not an accessibility win.
   *
   * What actually pays the debt is that PEEK is no longer a clipped panel. It
   * is a row that says what is waiting and opens on one tap (`LessonPlate`),
   * the caption over the speaker's crown carries every line in every phase, and
   * the 3D character is on screen at full height rather than behind the sheet.
   * A learner who wants the bubble, the exercise or the transcript raises the
   * sheet deliberately and it stays where they put it.
   */
  const [detent, setDetent] = useState<LessonPlateDetent>('peek');

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

  /*
   * AN ARRIVING ACTIVITY ANNOUNCES ITSELF; IT DOES NOT TAKE THE SCREEN.
   *
   * This effect used to raise a resting sheet to HALF the instant a segment
   * arrived, which is how 45% of a phone came to be spent on a panel without
   * anyone choosing it. An exercise is worth looking at and it is still the
   * learner's call: the sheet says an activity is waiting, in words and to a
   * screen reader (`peekLabel`/`peekStatus` below), and one tap on that row
   * opens it. The tutor teaching it stays on screen either way.
   *
   * What remains here is the keyboard's debt. A segment arriving while the
   * plate is at PEEK because the SOFT KEYBOARD borrowed it must cancel the
   * loan, or the restore fires later and raises a sheet the learner never
   * asked for, minutes after the keyboard closed.
   */
  useEffect(() => {
    if (segmentId === null) return;
    borrowedDetentRef.current = null;
  }, [segmentId]);

  /*
   * AN ARRIVING OFFER PUTS THE PLATE AWAY, and it is the whole reason the
   * `adapting` screen stopped being a form.
   *
   * It used to take the plate off FULL and no further, for a measured reason:
   * `LessonPlate` reserves a fixed 300 px above the sheet for the dock
   * (`STAGE_RESERVE_PX`), and at FULL on a 375x812 phone the question's top
   * was cut off. That fixed the clipping and left the composition, which the
   * owner's reviewer then named exactly: at 375 px the island was a thin strip
   * across the middle and the bottom 45% was five stacked panels — question,
   * two answers, orb and composer, a label, and the sheet's own peek row.
   *
   * The tutor asking "shall I explain that differently?" is a MOMENT. It gets
   * the camera (`shotForPhase` swings to the two-shot), it gets the character,
   * and the two answers are the only other thing on the screen: the sheet
   * stands down for the length of the question (`standDown`, below) and the
   * composer is not rendered (see the dock's lower slot). Both come straight
   * back, with their state, the instant the offer is answered — the exercise is
   * hidden rather than unmounted, so a half-finished activity is exactly where
   * it was left.
   */
  const adaptationOffer = socket.adaptationOffer;
  useEffect(() => {
    if (adaptationOffer === null) return;
    borrowedDetentRef.current = null;
    // Where it will be found when it comes back, and the only detent that is
    // honest under a sheet nobody can see right now.
    setDetent('peek');
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
   * WHAT THE RESTING SHEET SAYS ABOUT ITSELF.
   *
   * Two strings for two jobs, and BOTH ARE ABSENT UNLESS SOMETHING HAPPENED.
   * The label names a CONTROL, so it is imperative and stays short enough to
   * sit on one row beside the finish control in all three locales. The status
   * is a SENTENCE about what changed, announced only while the sheet is
   * resting, because that is the state in which the panel's own live regions
   * are not mounted.
   *
   * The resting label used to fall back to "Conversation", which is the name of
   * the screen the learner is already on — deleted 2026-08-22 (/DESIGN.md
   * §Lumen → What to delete). The row's chevron says that it opens; a word is
   * only spent when there is news, and an arriving activity is the only news
   * this row has ever had. "Your tutor is thinking" is already on the
   * microphone and over the character's head; a third copy here would train a
   * learner to ignore the one row that tells them something new.
   */
  const activityWaiting = socket.segment !== null;
  const peekLabel = activityWaiting ? t('tutor.conversation.peekOpenActivity') : undefined;
  const peekStatus = activityWaiting ? t('tutor.conversation.peekActivityWaiting') : undefined;

  /*
   * THE TWO ANSWERS, AND THERE IS ONE PAIR OF THEM.
   *
   * Each answer carries the WHOLE question in its accessible name, because the
   * question sits on a plate of its own above them and "Yes please" with
   * nothing to say yes to is not a control. The visible word comes FIRST:
   * leading with the sentence drops the visible label out of the front of the
   * accessible name, which breaks voice control for the one control a child is
   * most likely to ask for out loud.
   */
  const adaptationAnswers = adaptation && (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <HudPlate
        as="button"
        shape="chip"
        data-answer="yes"
        aria-label={`${t('tutor.conversation.yesPlease')} ${adaptationQuestion}`}
        onClick={() => socket.answerAdaptation(adaptation, true)}
        className="pointer-events-auto lf-settle-2"
      >
        <span className="lf-action">{t('tutor.conversation.yesPlease')}</span>
      </HudPlate>

      <HudPlate
        as="button"
        shape="chip"
        data-answer="no"
        aria-label={`${t('tutor.conversation.noThanks')} ${adaptationQuestion}`}
        onClick={() => socket.answerAdaptation(adaptation, false)}
        className="pointer-events-auto lf-settle-3"
      >
        <span className="lf-action">{t('tutor.conversation.noThanks')}</span>
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
              <span className="lf-action">{budgetRune}</span>
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
        <div
          /*
           * BELOW THE WAY OUT, not on top of it. The anchored caption escapes
           * the fixed chrome through the shared registry (`SafeAreaContext` →
           * `chromeRef`); this plate is not anchored, so nothing arbitrated for
           * it and nothing could. Measured on `/dev/tutor-lab` at 375x812 with
           * no first frame: the plate spanned (15, 8, 345, 102) across the
           * way-out chip at (16, 16, 44, 44) — the tutor's first sentence laid
           * over the only navigation on the route, in the one state where the
           * learner most needs to leave. 80 px clears the chip at both widths
           * (44 px tall from a 16 px inset on a phone, 44 from 24 on desktop)
           * with room to spare, and this branch has no scene to protect.
           */
          className="pointer-events-none fixed inset-x-0 top-20 z-30 mx-auto flex w-full max-w-[min(34rem,92vw)] flex-col items-center gap-2 px-4"
        >
          {turn?.text && (
            <HudPlate shape="plate">
              <span className="lf-speech" aria-live="polite" aria-atomic="true">
                {turn.text}
              </span>
            </HudPlate>
          )}
          {budgetRune && (
            <HudPlate shape="chip">
              <span className="lf-action">{budgetRune}</span>
            </HudPlate>
          )}
        </div>
      )}

      {/*
        THE ADAPTATION OFFER IS A QUESTION A CHARACTER ASKS, and the CAMERA is
        what says so now: `shotForPhase` swings to the two-shot while an offer
        is pending, so the tutor and their companion are both in frame while the
        question is up (/ORACLE.md §9.4). The question itself is rendered once,
        into the dock below, where nothing the camera does can clip it.
      */}

      <LessonPlate
        label={t('tutor.conversation.plateLabel')}
        resizeLabel={t('tutor.conversation.resizePanel')}
        /*
         * OUT OF THE WAY WHILE THE TUTOR IS WAITING ON A YES OR NO. Hidden,
         * never unmounted: a half-answered exercise keeps its state, and the
         * sheet comes back at PEEK the moment the question is answered. See the
         * offer effect above for what the reviewer measured without it.
         */
        standDown={adaptation !== null}
        detent={detent}
        onDetentChange={changeDetent}
        onFootprint={publishFootprint}
        /*
         * And the OTHER axis: whether the corner is occupied, which is what
         * decides where the microphone stands at 1280 px. It is the plate's
         * fact and not the phase's — an adaptation question is still
         * `conversing` with the plate standing down.
         */
        onCornerHeld={dock?.setCornerPlate}
        peekLabel={peekLabel}
        peekStatus={peekStatus}
        header={
          /*
           * Finishing is a first-class turn, so it lives on the one surface
           * that is never culled and never scrolls away. The shell's way out
           * LEAVES the route; this ends the session, and the tutor gets to say
           * goodbye (/ORACLE.md §9.5).
           *
           * A HudPlate rather than the design system's `Button`, and that is
           * the material rather than a preference. `Button` is a `rounded-full`
           * pill wearing `lf-gaming-btn` — Liquid Glass grammar, correct on a
           * page and a capsule over a photographic frame here, which §Lumen
           * calls the silhouette of a sticker. On a 375 px sheet it also cost
           * 99 px of a 343 px row for one word; at `lf-action` inside a chip it
           * costs 76.
           */
          <HudPlate as="button" shape="chip" onClick={onExit} className="pointer-events-auto shrink-0">
            <span className="lf-action">{t('tutor.conversation.finish')}</span>
          </HudPlate>
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
          <p className="lf-body rounded-md bg-warning-soft px-3 py-2 text-content" role="status">
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

        {/*
          `spokenSeq` is what stops the same sentence printing three times. The
          caption carries it over the crown, the bubble carries it beside the
          animating mouth, and the log carried it a third time at the bottom of
          the same plate — measured at 1280x800 in `adapting` as 118 words on
          screen for the 30 being said (/DESIGN.md §Lumen → What to delete).
        */}
        <TutorTranscript
          history={socket.history}
          spokenSeq={turn ? turnSeq : null}
          label={t('tutor.conversation.transcriptLabel')}
        />
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
          THE ONE WAY TO ANSWER THE TUTOR, and it is the one that cannot be
          taken away.

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

          It carries the `role="status"`, and it is the ONLY copy, so there is
          nothing left that could make a screen reader say the question twice.
        */}
        {adaptation && (
          <div data-offer="guaranteed" className="flex w-full flex-col items-center gap-2">
            {/* The question is the tutor ASKING, so it is set in the tutor's
                own voice rather than in a control's — the same `lf-speech` the
                caption over its head is using at the same moment. */}
            <HudPlate shape="plate" className="pointer-events-none">
              <span className="lf-speech" role="status">
                {adaptationQuestion}
              </span>
            </HudPlate>
            {adaptationAnswers}
          </div>
        )}

        {errorLine && (
          <HudPlate shape="plate" role="status" className="pointer-events-none self-center">
            <span className="lf-body">{errorLine}</span>
          </HudPlate>
        )}

      </DockSlot>

      <DockSlot dock={dock} target={adaptation ? null : (dock?.below ?? null)}>
        {/*
          Typing is not the fallback. With no voice provider configured it is
          the ONLY channel, so it is a permanent, full-width control rather than
          something hidden behind an icon. It is also the one field every
          /ORACLE.md §5 injection defence exists for, which is why the single
          line and the 2000 character cap are unchanged.

          IT IS ABSENT FOR THE LENGTH OF A YES-OR-NO, and that is the only
          state it is ever absent in. An adaptation offer has exactly two
          answers and both are already on screen as chips; a text field under
          them is a third way to answer a closed question, and it costs 56 px
          of the one screen the reviewer refused to show the owner. The
          microphone stays — a learner may say "yes please" out loud — and the
          field returns, with whatever was typed in it, the moment the question
          is answered. This is a suppression at the PORTAL rather than of the
          element, so React keeps its state.

          Built from the stage material directly rather than from `HudPlate`,
          whose measures are reading widths for labels: a composer capped at
          22ch would be four words wide. It takes the READING density, because
          a surface you type into is one you are looking at, and because the
          placeholder is the one piece of muted text on this layer that has to
          stay muted — a placeholder at full ink reads as a field that is
          already filled.
        */}
        <div className="lf-lumen lf-lumen-reading pointer-events-auto flex items-center rounded-md">
          <div className="flex min-w-0 flex-1 items-center gap-1 rounded-[inherit] pl-4 pr-0.5">
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
              /*
                Full ink, not muted. The placeholder beside it is the one piece
                of muted text this layer is allowed (a placeholder at full ink
                reads as a field that is already filled) — but the SEND control
                is not text, it is the only way to answer the tutor by typing,
                and it was reading as decoration at 3.6:1 over the island.
              */
              className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-content transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-40"
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
