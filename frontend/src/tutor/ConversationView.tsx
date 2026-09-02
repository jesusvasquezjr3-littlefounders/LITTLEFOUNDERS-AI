import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui';
import { useSafeArea } from '@/tutor-scene/SafeAreaContext';
import { HudPlate } from './hud/HudPlate';
import { LessonPlate, useDesktopPlate, type LessonPlateDetent } from './hud/LessonPlate';
import { WorldChip } from './hud/WorldChip';
import { SpeechCaption } from './SpeechCaption';
import { TutorFace } from './TutorFace';
import { TutorTranscript } from './TutorTranscript';
import { LiveSegmentPanel } from './LiveSegmentPanel';
import { TutorWhiteboard } from './TutorWhiteboard';
import { lessonStepDots } from './lessonStepDots';
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
 * THE TUTOR'S LINE IS PRINTED ONCE (2026-08-22 — /DESIGN.md §Lumen → *One
 * line, one printing, two channels*). There are still three CHANNELS, and each
 * is somebody's only one: the words, the moving mouth, and the audio. A deaf
 * learner has the first two; a pre-reader has the third; a learner on a bus
 * with no headphones has the first two again. What changed is that the first
 * two now share ONE surface — the caption over the speaker's crown carries the
 * sentence AND the 2D face (`TutorFace`), instead of the caption printing it
 * over the character and the lesson plate printing it again 252 px lower. Two
 * copies of one sentence is not a second channel; it is the same channel twice,
 * and it was pushing the exercise below the fold to be there.
 */

export type ConversationViewProps = ConversationLayerProps;

export function ConversationView({
  session,
  socket,
  token,
  ready,
  // Renamed locally from the shared `timedOut` field: `replyTimedOut` below
  // is an unrelated, pre-existing concern (a MODEL reply that took too
  // long) and the two must never be confused at a glance.
  timedOut: stageTimedOut,
  speaking,
  audioElement,
  awaitingReply,
  onAwaitReply,
  resuming,
  replyTimedOut,
  onRestart,
  onExit,
  onDraftChange,
  onCharacterCue,
}: ConversationViewProps) {
  const { t } = useTranslation();
  const safeArea = useSafeArea();
  const dock = useStageDock();
  const desktop = useDesktopPlate();

  const [typed, setTyped] = useState('');
  /*
   * ONE EFFECT, not a call at every `setTyped` site — a site missed there is a
   * draft the shell never learns about, and hands-free listening would open
   * over it exactly as if this feature did not exist. Derived from `typed`
   * itself rather than duplicated as separate state, so the two can never
   * disagree.
   */
  useEffect(() => {
    onDraftChange(typed.trim() !== '');
  }, [typed, onDraftChange]);
  /**
   * Whether the composer currently holds the learner's LAST message for
   * rephrasing rather than a fresh one. Set by the transcript's edit
   * affordance, cleared by sending or by emptying the field — an empty
   * composer is a fresh composer, whatever put text in it earlier.
   */
  const [editing, setEditing] = useState(false);
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

  /*
   * THE SPEAKER'S FACE, for the caption to carry beside the words.
   *
   * Built once here rather than at each of the two call sites below, because
   * the no-scene branch has to show exactly the same face: on a device with no
   * usable WebGL this is not a second view of the character, it is the ONLY
   * one, and a learner who cannot be shown the island should still be able to
   * see who is talking to them.
   */
  const face = {
    character: session.character,
    emotion: turn?.emotion ?? ('neutral' as const),
    action: turn?.action ?? ('idle' as const),
    actionKey: turnSeq,
    speaking,
  };
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

  /*
   * AN EDIT IN PROGRESS STOPS BEING VALID the moment the message it targets
   * stops being "the last message" — a new turn arrives, or an activity or
   * whiteboard opens (the same condition the transcript's own edit
   * affordance already gates on, `onEditLast` below). Found by adversarial
   * review, round 26 (2026-08-30, HIGH): `submitTyped` never re-checked this
   * at SEND time, only `beginEdit` checked it at START time — a learner who
   * tapped "Rephrase" and then had a segment/whiteboard arrive before
   * pressing Send could still fire `socket.editLast(...)`, a server-side
   * conversation rewind, while an activity was on screen. That is precisely
   * the flow the comment on `onEditLast` says is "not a flow we honour".
   * `typed` is deliberately left alone: the learner's effort survives, and
   * `submitTyped` below now sends it as an ordinary new message instead of a
   * forbidden rewind. `setEditing(false)` while already false is a no-op, so
   * this safely runs on every mount and on every turn/segment/whiteboard
   * change, not only the ones where an edit happened to be in progress.
   */
  useEffect(() => {
    setEditing(false);
  }, [turnSeq, socket.segment, turn?.whiteboard]);

  const submitTyped = () => {
    const value = typed.trim();
    /*
     * NO SUBMIT WHILE A REPLY IS ALREADY PENDING. Found by adversarial
     * review, round 26 (2026-08-30, HIGH): every OTHER way to speak to the
     * tutor already refuses to fire twice — `MicOrb` won't start a new
     * recording while `state === 'thinking'`, the "explain differently"
     * chip is gated on `!awaitingReply` — but the composer, "the ONLY
     * channel" per this file's own comment above, had no such guard. A
     * learner who typed again while waiting could fire a second (billed)
     * turn at the socket before the first reply had even landed.
     */
    if (value === '' || ended || awaitingReply) return;
    if (editing) {
      // Defence in depth alongside the reset effect above, for the
      // narrow window between a segment/whiteboard arriving and that
      // effect's re-render actually landing: never rewind the
      // conversation while an activity is on screen.
      if (socket.segment !== null || turn?.whiteboard != null) {
        setEditing(false);
        return;
      }
      socket.editLast(value);
      setEditing(false);
    } else {
      sendText(value);
    }
    setTyped('');
    // The wait is owned upstream, beside the orb that also displays it.
    onAwaitReply();
  };

  /** The transcript's edit affordance: the last message returns to the composer. */
  const beginEdit = useCallback((text: string) => {
    setTyped(text);
    setEditing(true);
  }, []);

  /**
   * One tap that asks, in the learner's own language, for a different
   * explanation. It is an ordinary learner turn through the full pipeline —
   * fence, classifier, model, judge — not a protocol verb; what the chip buys
   * is that a child who is lost does not have to compose the sentence that
   * says so.
   */
  const askDifferently = () => {
    if (ended) return;
    sendText(t('tutor.conversation.explainDifferently'));
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
   * …UNLESS THE TUTOR JUST PROMISED IT OUT LOUD (V4).
   *
   * The rule above holds for an activity that merely arrives. But the turn
   * that REQUESTS a segment (`next: 'segment'`) is the tutor saying "vamos a
   * practicar con monedas en la pantalla" — and on a phone the learner then
   * heard a promise and saw a peek row. The owner's verdict on that was
   * "elementos que no funcionan": an announced activity that does not appear
   * is a broken promise in UI form, the exact harm the unkept-promise
   * repair chases on the language side. So when the tutor's own current turn
   * asked for the screen, the sheet rises — the tutor keeps teaching above
   * it, and the learner keeps the handle to dismiss it. An unannounced
   * arrival still only announces itself.
   *
   * IT RISES TO `full`, WHICH IS THE DETENT THIS FILE ALREADY NAMES AS THE
   * ONE AN EXERCISE IS ANSWERABLE IN — see `peekOpensTo` below, whose own
   * comment says of HALF: "It is the wrong one for an exercise: at 375x812 it
   * leaves about 90 px between the pinned prompt and the pinned check
   * control." That was true and written down, and this effect raised to HALF
   * anyway: the two paths to the same question — "how much room does an
   * activity need?" — gave different answers, and the one the LEARNER does
   * not control gave the wrong one. So the child who taps the row got a sheet
   * they could answer in, and the child whose tutor announced the activity
   * OUT LOUD (the ordinary path, `next: 'segment'`) got one they could not.
   *
   * Measured live, 2026-09-02, es-MX at 390x844, the lab's own `quiz_mcq`
   * with an ordinary framing+prompt pair: at the HALF this used to raise to,
   * the plate body is 324 px against an activity that needs 363, so the
   * question's last line ("ahorrado en 4 semanas?") was scrolled out of a
   * header with no scroll cue on it, and the third of three options sat below
   * the answers scroller's fold with `elementFromPoint` at its own centre
   * landing on the Check button's wrapper. At FULL the same activity fits
   * whole with room over.
   *
   * FULL DOES NOT HIDE THE TUTOR, which is the thing HALF was protecting:
   * `LessonPlate`'s `STAGE_RESERVE_PX` reserves 300 px of stage above the
   * sheet and FULL is clamped to it, so the character and the caption keep
   * the room this file's own line 1135 comment already measures at FULL.
   *
   * BUT NOT WHILE THE KEYBOARD IS STILL OPEN. Found by adversarial review,
   * 2026-08-30 (HIGH): this raised the sheet unconditionally, so an
   * ordinary sequence — a learner sends a message and the reply announces a
   * practice activity before they have dismissed the keyboard — raised the
   * sheet to HALF while the keyboard still covered the bottom of the
   * screen, defeating the keyboard-borrow protection above by construction
   * (the two exactly overlap, the condition that mechanism exists to
   * prevent). While the keyboard is open, the raise is DEFERRED into the
   * same `borrowedDetentRef` the keyboard-close handler already reads: it
   * takes effect the moment the keyboard actually closes, never while it is
   * still covering the screen.
   */
  useEffect(() => {
    if (segmentId === null) return;
    if (turn?.next !== 'segment') return;
    if (safeArea?.keyboardOpenRef.current) {
      borrowedDetentRef.current = 'full';
      return;
    }
    setDetent((current) => (current === 'peek' ? 'full' : current));
  }, [segmentId, turn?.next, safeArea]);

  /*
   * THE SAME RULE FOR A LIVE WHITEBOARD (V4). A turn that draws a board is
   * exactly the same "the tutor is showing you something" moment a requested
   * segment is — the sheet should rise to make room for it rather than have
   * it render into a 90 px peek strip. Keyed on `turn.seq` rather than a
   * segment id, since a whiteboard turn has none.
   *
   * Same keyboard deferral as the segment announcement above, and for the
   * identical reason: a whiteboard turn can arrive while the learner is
   * still typing.
   */
  useEffect(() => {
    if (!turn?.whiteboard) return;
    if (safeArea?.keyboardOpenRef.current) {
      borrowedDetentRef.current = 'half';
      return;
    }
    setDetent((current) => (current === 'peek' ? 'half' : current));
  }, [turn?.seq, turn?.whiteboard, safeArea]);

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
   *
   * THE REST USED TO GET TOLD EXACTLY THAT, AND IT WAS THE REPORTED BUG.
   *
   * This resolved through `errors.api.<code>` — the envelope vocabulary for
   * Core's HTTP surface. The conversation does not speak that vocabulary. It
   * emits `STT_FAILED`, `NO_SEGMENT`, `CONNECTION_LOST` and the rest, none of
   * which have an `errors.api` key, so EVERY one of them fell through to
   * `errors.api.INTERNAL` — "Algo salió mal de nuestro lado." A child whose
   * microphone simply did not catch them was told the company had broken.
   *
   * `tutor.conversationError.*` is the conversation's own namespace, every key
   * present in all three locales, and its fallback apologises for a turn rather
   * than for a platform.
   */
  const errorLine = !socket.error
    ? null
    : socket.error.code === 'CONSENT_REVOKED'
      ? t('tutor.offers.voiceNeedsConsent')
      : t(`tutor.conversationError.${socket.error.code}`, {
          defaultValue: t('tutor.conversationError.generic'),
        });

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
   * V4: when a lesson surface owns the screen, the caption docks to the
   * space that is left instead of losing an unwinnable escape against it
   * (see SpeechCaptionProps.docked). The caller decides because the caller
   * KNOWS — no geometry listening.
   *
   * Found by adversarial review, round 43 (2026-08-30, HIGH): this used to
   * gate `'panel'` on `socket.segment !== null || turn?.whiteboard != null`
   * — but `LessonPlate` renders its full-height desktop panel
   * UNCONDITIONALLY (`hud/LessonPlate.tsx`, `inset-y-0 right-0`), activity
   * or not, and only actually hides it (`standDown`) during an adaptation
   * offer. So on desktop, during ORDINARY conversation with no exercise
   * open — most of a lesson — the panel was on screen exactly as before,
   * but the caption fell back to `ScreenAnchor`'s escape/clamp, whose
   * budget cannot beat a full-height docked panel (the exact defect this
   * docking mechanism exists to close, just outside the one condition that
   * was checked). The condition now tracks whether the panel is actually
   * VISIBLE — desktop and not standing down — not whether an activity
   * happens to be open. Hoisted to its own variable (was inline on the
   * prop) so the lesson-thread chip below can read it too.
   */
  const docked: 'panel' | 'sheet' | null =
    desktop && adaptation === null ? 'panel' : !desktop && detent === 'full' ? 'sheet' : null;

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
  /*
   * THE COMPOSER, built once and mounted in one of two homes: inline in the
   * docked panel on desktop, or portalled into the shell's dock beside the
   * orb everywhere else. Typing is not the fallback — with no voice provider
   * configured it is the ONLY channel — and it is the one field every
   * /ORACLE.md §5 injection defence exists for, which is why the single line
   * and the 2000 character cap are unchanged. While it holds a message being
   * REPHRASED it says so, and emptying it clears that state.
   */
  const composer = (
    <div className="lf-lumen lf-lumen-reading pointer-events-auto flex items-center rounded-md">
      <div className="flex min-w-0 flex-1 items-center gap-1 rounded-[inherit] pl-4 pr-0.5">
        <input
          value={typed}
          onChange={(event) => {
            setTyped(event.target.value);
            if (event.target.value === '') setEditing(false);
          }}
          onKeyDown={(event) => event.key === 'Enter' && submitTyped()}
          maxLength={2000}
          disabled={ended}
          placeholder={t(editing ? 'tutor.conversation.editPlaceholder' : 'tutor.conversation.typePlaceholder')}
          aria-label={t(editing ? 'tutor.conversation.editPlaceholder' : 'tutor.conversation.typePlaceholder')}
          /*
           * NO BROWSER AUTOFILL ON THIS FIELD — found live, round 108
           * (2026-08-31): with no `autoComplete` at all, Chrome treated this
           * as an ordinary saved-text field and, on focus/keystroke, spliced
           * an unrelated remembered value INTO the middle of whatever the
           * learner was actively typing — not appended, not offered as a
           * dismissible suggestion, already merged into `value` by the time
           * our own `onChange` ever saw it. `React state itself was never
           * wrong: `submitTyped` reads the exact `typed` React already holds,
           * and `sendText` fires one JSON frame per call with no buffering
           * (verified by reading both end to end) — the corruption lands
           * in the DOM's native value before any of our code runs a single
           * line. `off` is the one signal a browser's own autofill is
           * expected to honour for a plain text field, and it is also a
           * privacy floor per §1.9: a child's own typed words must never be
           * remembered or resurfaced by the browser, on this device or the
           * next session on a shared one. `name`/`id` are deliberately left
           * unset alongside it, since either one is exactly the hook Chrome
           * uses to key a saved-value association for a field with no
           * autocomplete category of its own.
           */
          autoComplete="off"
          className="lf-body h-11 min-w-0 flex-1 bg-transparent text-content placeholder:text-content-muted focus:outline-none disabled:opacity-60"
        />
        <button
          type="button"
          onClick={submitTyped}
          disabled={typed.trim() === '' || ended || awaitingReply}
          aria-label={t('tutor.conversation.send')}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-content transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-40"
        >
          <Icon name="send" />
        </button>
      </div>
    </div>
  );

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
      {/*
        `ready && !stageTimedOut`, NOT `ready` ALONE — found live, 2026-09-01.
        `ready` alone answers "has the veil lifted", which a stage that timed
        out (no WebGL, a backgrounded tab, a slow device) also satisfies —
        see `StageLayerCommonProps.timedOut`'s own comment. Everything this
        branch renders is positioned by the ANCHOR PROJECTOR
        (`ScreenAnchor.tsx`), a separate system that only ever un-hides a
        node from inside a render callback that a timed-out stage never
        fires even once — so `ready` alone here would print a genuinely
        correct caption INTO a node stuck `hidden`/`inert` forever: the
        learner sees nothing, on the one channel (`ORACLE.md §1 step 4`)
        that must never go silent for a deaf or hard-of-hearing learner, and
        with no error anywhere to say why.
      */}
      {ready && !stageTimedOut ? (
        <>
          {/*
            THE ONE SURFACE THAT PRINTS WHAT THE TUTOR IS SAYING, and it carries
            both channels: the words, and the 2D mouth that is the only
            articulation `liruf` and `dina` have (/TUTOR_3D.md §3.1).
          */}
          {/*
            V4 (C6): THE LESSON THREAD. One quiet line that says "this is a
            lesson, not a chat" — the child-facing topic and the step count
            the plan is actually on. Absent in open chat by construction (the
            server sends nothing), pointer-events-none, and small: it informs,
            it does not compete with the tutor.

            Found by adversarial review, round 43 (2026-08-30, MEDIUM): this
            and the docked caption (`SpeechCaption.tsx`'s `docked === 'sheet'`
            case) both land on the identical `top-16`/`z-20` band whenever a
            lesson is active AND the mobile sheet is at its FULL detent —
            reachable by drag or the documented keyboard `End` control. The
            caption's box can span up to `calc(100vw-2rem)` centered, reaching
            this chip's own `left-4` column on a phone-width screen. Both are
            `pointer-events-none` (nothing becomes unreachable), but the
            caption is the surface that "may never hide" for a deaf or
            hard-of-hearing learner (/ORACLE.md §1 step 4), so THIS chip
            yields: at FULL, the sheet's own body already shows the lesson's
            topic and step directly, making the redundant top banner both
            unnecessary and the thing that has to move.

            Found by adversarial review, round 61 (2026-08-30, MEDIUM): the
            guard above only excluded `docked === 'sheet'` — the mobile case
            round 43 fixed — and missed `docked === 'panel'`, which is the
            FAR more common state: since round 43's own fix, `docked` is
            `'panel'` on desktop for essentially every ordinary conversing
            screen, not only while an activity is open. `SpeechCaption`'s
            `docked === 'panel'` class is `top-20` (80px); this chip's
            `top-16` (64px) plus its own height puts its bottom at 88px — an
            8px vertical band both surfaces occupy on desktop, constant and
            content-independent (two fixed Tailwind offsets, not a layout
            computed from either surface's actual content). Neither of this
            codebase's other two anti-overlap mechanisms could have caught
            it: `SafeAreaContext`'s `HudChromeSlot` registry has no slot for
            a bare `<div>` outside its own primitive, and
            `verify-tutor-ui.mjs`'s `OVERLAPS` selectors name `.lf-speech`,
            `[data-plate-body]` and `[role="group"][aria-label]` — none of
            which this chip carries. Same resolution as round 43: the chip
            yields to the caption whenever the caption is docked to ANY
            fixed-offset surface, not only the sheet.

            `var(--lf-content-muted)`, not `var(--lf-muted)` — that token has
            never existed anywhere in `index.css`. An undefined custom
            property with no fallback makes `color`/`background-color`
            invalid, which resolves to whatever the ANCESTOR already painted
            — sometimes close enough to look right by accident, sometimes
            the same tone as the 3D backdrop behind it, which is what
            "invisible lesson-thread chip" actually meant: not hidden, just
            never actually given the muted-slate color every other `-muted`
            surface on this route uses on purpose.
          */}
          {socket.lesson !== null && docked === null && (
            <div className="lf-caption pointer-events-none fixed left-4 top-16 z-20 flex max-w-[60vw] items-center gap-1.5 rounded-full bg-[color:var(--lf-surface)]/70 px-3 py-1 text-[color:var(--lf-content-muted)] backdrop-blur-sm">
              <span className="truncate">
                {socket.lesson.topic !== null ? `${socket.lesson.topic} — ` : ''}
                {t('tutor.conversation.lessonThread', { step: socket.lesson.step, of: socket.lesson.of })}
              </span>
              {/*
                STEP DOTS (ORACLE.md §19.5): a purely visual companion to the
                sentence above, never a second source of truth for it —
                `aria-hidden` because that sentence already carries the
                accessible name, and a screen reader hearing "step 2 of 4"
                followed by an announced row of four dots would be told the
                same fact twice. `shrink-0` so a long, truncating topic name
                loses ITS OWN space first; the dots are the smaller, more
                stable of the two and the one least useful to lose.
              */}
              <span className="flex shrink-0 items-center gap-1" aria-hidden="true">
                {lessonStepDots(socket.lesson.step, socket.lesson.of).map((state, i) => (
                  <span
                    key={i}
                    data-lesson-step={state}
                    className={
                      'h-1.5 w-1.5 rounded-full transition-colors duration-150 ' +
                      (state === 'upcoming'
                        ? 'bg-[color:var(--lf-content-muted)]/30'
                        : state === 'done'
                          ? 'bg-[color:var(--lf-content-muted)]/60'
                          : 'bg-[color:var(--lf-content-muted)]')
                    }
                  />
                ))}
              </span>
            </div>
          )}

          <SpeechCaption
            text={turn?.text ?? null}
            turnSeq={turnSeq}
            face={face}
            docked={docked}
            wordTimings={turn?.wordTimings ?? null}
            audioElement={audioElement}
            speaking={speaking}
          />

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
          tutor's own words on a node nothing will ever position — and since
          2026-08-22 the caption is the ONLY surface that prints the line at
          all, so dropping it here would leave the learner with a tutor that
          says nothing, visually and to a screen reader alike.

          AND THE FACE COMES WITH IT, which matters more here than anywhere
          else on the route: with no island there is no 3D character, so this
          2D one is not a second view of the tutor, it is the only one.

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
            <HudPlate shape="plate" floorClassName="gap-3">
              <TutorFace {...face} className="h-11 w-11 self-start sm:h-14 sm:w-14" />
              <span
                className="lf-speech min-w-0 flex-1 text-start"
                aria-live="polite"
                aria-atomic="true"
              >
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
        /*
         * ONE TAP ON "AN ACTIVITY IS WAITING" LANDS SOMEWHERE IT CAN BE DONE.
         *
         * HALF is the next detent up and it is the right one for a learner who
         * just wants to see the conversation. It is the wrong one for an
         * exercise: at 375x812 it leaves about 90 px between the pinned prompt
         * and the pinned check control. The row that announces the activity
         * opens to the detent the activity is answerable in, and the learner can
         * still drag it anywhere afterwards.
         */
        peekOpensTo="full"
        /*
         * THE BODY IS A COLUMN, NOT A SCROLLER (2026-08-22).
         *
         * Exactly one child below owns the free height and scrolls — the
         * activity while there is one, the conversation log while there is not.
         * Everything else is `shrink-0`. That is what keeps a question and its
         * answers on screen together on the exercise types that are taller than
         * the plate (`LessonPlate` -> `bodyLayout`, `LiveSegmentPanel`).
         */
        bodyLayout="column"
        header={
          /*
           * Finishing is a first-class turn, so it lives on the one surface
           * that is never culled and never scrolls away. The shell's way out
           * LEAVES the route; this ends the session, and the tutor gets to say
           * goodbye (/ORACLE.md §9.5). Starting over sits beside it — the one
           * chat affordance the owner named as missing — and on desktop the
           * minutes ride here too, where the docked panel is the conversation's
           * home (the sky rune stays for the stage).
           *
           * HudPlates rather than the design system's `Button`, and that is
           * the material rather than a preference (§Lumen — a capsule over a
           * photographic frame is the silhouette of a sticker).
           */
          <>
            {desktop && budgetRune && (
              <span className="lf-caption whitespace-nowrap text-content-muted">{budgetRune}</span>
            )}
            {/*
             * DISABLED WHILE THE TUTOR IS STILL ANSWERING (found by
             * adversarial review, round 90, 2026-08-31, MEDIUM). Every other
             * way to speak over the tutor already refuses to fire during
             * `awaitingReply` — the composer's send button a few lines down,
             * the "explain differently" chip — but these two had no such
             * guard, and unlike those, the actual cost of firing anyway is
             * not a duplicate turn: `end_session` claims the SAME turn slot
             * the tutor's reply is still holding, `oracle/src/ws/server.ts`'s
             * `claimTurn` sees it busy, and (before the server-side half of
             * this fix, RUNBOOK.md Round 90) the request was refused
             * outright while this file's `onRestart`/`onExit`
             * (`TutorExperience.tsx`) tear the socket down regardless,
             * without waiting to find out — recording a deliberate "Start
             * over"/"Finish" as `learner_left` instead of `completed` and
             * skipping the tutor's farewell entirely (/ORACLE.md §9.5). The
             * server now defers rather than drops a busy `end_session`, but
             * a learner who can never trigger the race in the first place is
             * the cheaper and clearer fix, so both ship together.
             */}
            <HudPlate
              as="button"
              shape="chip"
              onClick={onRestart}
              disabled={awaitingReply}
              aria-label={t('tutor.conversation.startOver')}
              title={t('tutor.conversation.startOver')}
              className="pointer-events-auto shrink-0"
            >
              <Icon name="refresh" className="!text-[18px]" />
            </HudPlate>
            <HudPlate
              as="button"
              shape="chip"
              onClick={onExit}
              disabled={awaitingReply}
              className="pointer-events-auto shrink-0"
            >
              <span className="lf-action">{t('tutor.conversation.finish')}</span>
            </HudPlate>
          </>
        }
      >
        {/*
          NO SECOND PRINTING OF THE LIVE LINE HERE (2026-08-22, /DESIGN.md
          §Lumen → *One line, one printing, two channels*).

          The plate used to open with the 2D bubble: the tutor's head beside the
          exact sentence the caption was already carrying 252 px above it. Both
          channels the owner asked for survive — the words and the moving mouth
          are in the caption together now — and what the plate got back is the
          132 px that sentence was costing the exercise underneath it.
        */}
        {socket.budget === 'wrapping' && (
          <p className="shrink-0 lf-body rounded-md bg-warning-soft px-3 py-2 text-content" role="status">
            {t('tutor.conversation.wrappingUp')}
          </p>
        )}

        {socket.intelDegraded && (
          <p className="shrink-0 lf-caption text-content-muted">
            {t('tutor.conversation.gettingToKnowYou')}
          </p>
        )}

        {/*
          The thinking state has to be visible even when the microphone is not,
          which today is every session: the orb carries it for a learner who
          spoke, and this carries it for the many more who typed.
        */}
        {awaitingReply && (
          <p className="shrink-0 lf-caption text-content-muted" role="status">
            {t('tutor.mic.thinking')}
          </p>
        )}

        {/*
          A dropped connection being quietly repaired. Said in place, because
          the alternative the learner experiences is the tutor freezing
          mid-sentence with no explanation — and the repair usually wins the
          race against their patience only if they know it is running.
        */}
        {resuming && (
          <p className="shrink-0 lf-caption text-content-muted" role="status">
            {t('tutor.conversation.reconnecting')}
          </p>
        )}

        {/*
          The wait ran out of patience before the server did. Honest and
          actionable: the spinner has already stopped (upstream owns that), and
          this says what to do instead of leaving a child staring at a tutor
          who appears to have wandered off. If the reply does eventually land,
          the arriving turn clears this with everything else.
        */}
        {replyTimedOut && (
          <p className="shrink-0 lf-caption text-content-muted" role="status">
            {t('tutor.conversation.replyTimeout')}
          </p>
        )}

        {socket.segment ? (
          <LiveSegmentPanel
            live={socket.segment}
            token={token}
            onGraded={socket.reportGrade}
            // v3: a turn may carry tray-demonstration steps for the open activity.
            demo={turn?.demonstrate ? { seq: turn.seq, steps: turn.demonstrate } : null}
            // A `story` family segment has no character layer of its own here —
            // see `LiveSegmentPanel`'s own doc comment. Bubbled straight up:
            // this layer does not drive the scene (see the file header note
            // above), so the cue passes through to whoever does, one level up.
            onCharacterCue={onCharacterCue}
            // The one child of the column that takes the free height and scrolls.
            className="min-h-0 flex-auto"
          />
        ) : turn?.whiteboard ? (
          /*
            V4: THE LIVE WHITEBOARD. A graded segment always wins the plate if
            one is somehow also present (the orchestrator's own schema refuses
            a turn carrying both, so this is a belt-and-braces resolution, not
            the common case). Otherwise this is exactly the surface the owner
            asked for: the numbers the tutor is narrating, growing on screen as
            it speaks, instead of an unrelated activity sitting beside plain
            text.
          */
          <TutorWhiteboard
            board={turn.whiteboard}
            seq={turn.seq}
            className="min-h-0 flex-auto"
          />
        ) : ended ? (
          <p className="shrink-0 lf-body text-content-muted" role="status">
            {t('tutor.conversation.ended')}
          </p>
        ) : (
          turn?.next === 'segment' && (
            <p className="shrink-0 lf-body text-content-muted" role="status">
              {t('tutor.conversation.listening')}
            </p>
          )
        )}

        {/*
          THE RECORD, AND IT YIELDS TO THE ACTIVITY.

          `spokenSeq` keeps the live line out of the log — the caption above the
          speaker's crown is where the present tense lives, and a log that also
          carries it is a log catching up with itself. `compact` is the other
          half: with an exercise on the plate the learner is answering a
          question, and 192 px of history under it was the difference between a
          `Check` control on screen and a `Check` control past the bottom edge
          (measured at 1280x800 in es-MX). It is capped, never hidden — it is a
          live region, and the only place a learner ever sees what the
          microphone actually heard.
        */}
        {/*
          ONE TAP FOR "I DIDN'T GET THAT". Shown once the lesson is properly
          under way and the tutor is between turns — never over an activity,
          where the learner has a task, and never while a reply is in flight.
        */}
        {turn && turnSeq > 1 && !socket.segment && !awaitingReply && !ended && (
          <HudPlate
            as="button"
            shape="chip"
            onClick={askDifferently}
            className="pointer-events-auto shrink-0 self-start"
          >
            <span className="lf-action">{t('tutor.conversation.explainDifferently')}</span>
          </HudPlate>
        )}

        <TutorTranscript
          history={socket.history}
          spokenSeq={turn ? turnSeq : null}
          /*
            An open activity wins the height on EVERY breakpoint. The old
            exemption assumed the docked panel "has the height for both", and
            it does not: the panel is full-viewport-height but the transcript
            keeps flex-auto at the same shrink factor, so the answers scroller
            and the log split the shortfall and the exercise squeezes against
            its own Check button — which is what the owner saw as "elements
            overlapping". The transcript stays mounted (its live region keeps
            announcing the learner's speech) and returns the moment the
            activity is graded.
          */
          compact={socket.segment !== null || turn?.whiteboard != null}
          label={t('tutor.conversation.transcriptLabel')}
          /*
           * No edit affordance while an activity is open — same reasoning as
           * the explain-differently chip: mid-activity, rewinding the
           * conversation is not a flow we honour, and in the compacted log
           * the pencil was a control that existed but sat scrolled out of a
           * 96 px window, which the reachability gate rightly flagged.
           */
          onEditLast={ended || socket.segment !== null || turn?.whiteboard != null ? undefined : beginEdit}
          editLabel={t('tutor.conversation.editMessage')}
        />

        {/*
          ON DESKTOP THE COMPOSER LIVES IN THE PANEL — conversation, activity
          and the way to answer, one ordered column (owner sign-off
          2026-08-28). On a phone it stays in the shell's dock beside the orb,
          where the sheet's footprint keeps it above the bottom edge. Absent
          during an adaptation offer in both homes, for the same reason: a
          yes-or-no already has both its answers on screen.
        */}
        {desktop && !adaptation && <div className="shrink-0">{composer}</div>}
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

      {/*
        The phone's home for the composer: the shell's dock, beside the orb.
        Suppressed at the PORTAL for the length of a yes-or-no (both answers
        are already on screen; a third way to answer a closed question costs
        56 px of a small screen) — React keeps the field's state either way.
        On desktop it is not rendered here at all; the docked panel holds it.
      */}
      {!desktop && (
        <DockSlot dock={dock} target={adaptation ? null : (dock?.below ?? null)}>
          {composer}
        </DockSlot>
      )}
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
