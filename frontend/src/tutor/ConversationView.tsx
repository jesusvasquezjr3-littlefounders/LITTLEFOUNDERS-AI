import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useSafeArea } from '@/tutor-scene/SafeAreaContext';
import { HudDisclosure } from './hud/HudDisclosure';
import { HudPlate } from './hud/HudPlate';
import { LessonPlate, useDesktopPlate, type LessonPlateDetent } from './hud/LessonPlate';
import { SpeechCaption } from './SpeechCaption';
import { TutorFace } from './TutorFace';
import { TutorTranscript } from './TutorTranscript';
import { LiveSegmentPanel } from './LiveSegmentPanel';
import { TutorWhiteboard } from './TutorWhiteboard';
import { NotebookKeepButton } from './NotebookKeepButton';
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
  mapAvailable,
  onOpenMap,
  onDraftChange,
  onCharacterCue,
}: ConversationViewProps) {
  const { t } = useTranslation();
  const safeArea = useSafeArea();
  const dock = useStageDock();

  /*
   * THE SESSION'S OWN XP, and it is a SUM of real awards rather than a number
   * this component invents. `LiveSegmentPanel` reads `xpAwarded` off each grade
   * response and now reports it; nothing else on this route knew the total,
   * which is why the study's "+45 XP" chip had nothing true behind it until
   * now. Zero renders no chip at all — a reward counter that starts at zero and
   * sits there is a promise the session has not kept yet.
   */
  const [sessionXp, setSessionXp] = useState(0);
  const addXp = useCallback((xp: number) => setSessionXp((total) => total + xp), []);
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
   * "START OVER" IS DESTRUCTIVE AND WAS ONE UNLABELLED TAP.
   *
   * It is a bare `refresh` glyph in the header row, two controls from the exit.
   * That glyph means RELOAD everywhere else a person has ever seen it, which
   * makes it the single most likely thing a confused learner presses when they
   * think the screen is stuck — and it threw away the live conversation, the
   * whiteboard and the tutor's diagnosis of what the child had got wrong, with
   * no confirmation and no undo. A 2026-09-09 production audit lost a five-turn
   * session to it on the first press.
   *
   * The transcript itself survives in "past conversations", so this is not data
   * loss; it is losing the session the learner is IN, which for a child who has
   * just been understood is the part that matters.
   *
   * Two-step inline confirm, the same contract as `ConfirmButton`: the control
   * is REPLACED in place rather than covered by a dialog (/DESIGN.md — this
   * product has never shipped a modal), and confirming takes focus so a
   * keyboard user never loses their place. It is built from `HudPlate` instead
   * of reusing `ConfirmButton` because that component paints with `Button`, and
   * flat app chrome inside the scene reads as a different product.
   */
  const [confirmingRestart, setConfirmingRestart] = useState(false);
  const restartYesRef = useRef<HTMLButtonElement>(null);

  /*
   * Whether the session menu is open. One boolean rather than a group id,
   * because during a live session there is exactly one disclosure — the board
   * is a surface, not a menu. `useOneOpen` is for the arrival, which has two.
   */
  const [sessionOpen, setSessionOpen] = useState(false);

  useEffect(() => {
    if (confirmingRestart) restartYesRef.current?.focus();
  }, [confirmingRestart]);

  /*
   * THE MENU STANDS DOWN FOR A QUESTION AND FOR THE END.
   *
   * An adaptation offer is a moment the tutor owns: the camera swings to the
   * two-shot and the two answers are the only other thing on screen. A reading
   * panel left open across it would be a third surface over that question, and
   * the lesson plate already stands down for exactly this reason.
   *
   * `ended` is the other one: a menu describing a live session — the emerald
   * dot, the minutes, "start over" — is a menu describing something that is
   * over. The disarm of `confirmingRestart` rides along, so a half-asked
   * question is never what the learner finds when they next open it.
   */
  useEffect(() => {
    if (socket.adaptationOffer === null && socket.closedReason === null) return;
    setSessionOpen(false);
    setConfirmingRestart(false);
  }, [socket.adaptationOffer, socket.closedReason]);

  /*
   * Disarm whenever the control that armed it would itself be disabled. The
   * plain button is gated on `!awaitingReply` (tearing the socket down mid-turn
   * records a deliberate restart as `learner_left`), so leaving a live "Yes"
   * on screen through the tutor's reply would route around that gate.
   */
  useEffect(() => {
    if (awaitingReply) setConfirmingRestart(false);
  }, [awaitingReply]);

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

  /**
   * Whether there is anything to put on the board surface at all.
   *
   * This is the condition the lesson plate is now MOUNTED on, and it is the
   * whole of the desktop rail's story. The plate used to render for the entire
   * conversation, `inset-y-0 right-0`, whether or not it had anything in it —
   * measured in production at 410x501 with a 425 px reading plate holding ZERO
   * children, for most of every lesson, over the island the route exists to
   * show. A panel that is on screen with nothing in it is not a neutral
   * container; it is the product telling a child that the interesting part is
   * elsewhere.
   */
  const hasBoard = socket.segment !== null || turn?.whiteboard != null;

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
  /*
   * KEYED ON IDENTITIES, NOT ON THE OBJECTS THEMSELVES.
   *
   * `socket.segment` and `turn?.whiteboard` are objects, and one caller builds
   * them fresh on every render: `useLabSocket` derives its whole turn inline
   * (`labTurn(locale, activity)`, no memo, and its own comment says so). Against
   * that caller this effect re-ran on every render, and React reported
   * "Maximum update depth exceeded" continuously — loud enough on `/dev/tutor-lab`
   * to flood the console and starve the 3D canvas of a clean frame.
   *
   * PRODUCTION WAS NEVER AFFECTED, and that is worth writing down rather than
   * leaving to be re-derived: `useTutorSocket` holds `turn` and `segment` in
   * real `useState`, so both references are stable between turns and the effect
   * fired exactly when it should. The defect was real, reproducible, and
   * confined to the surface built to catch defects.
   *
   * `segmentId` and `turnSeq` are the same facts as primitives — a genuinely
   * new segment and a genuinely new turn — so the behaviour is unchanged for
   * every caller and correct for both. The third dependency is dropped: a
   * whiteboard only ever arrives WITH a turn, so `turnSeq` already covers it.
   */
  useEffect(() => {
    setEditing(false);
  }, [turnSeq, segmentId]);

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

  /*
   * ONE LINE, ONE MESSAGE, BY PRECEDENCE.
   *
   * These five sentences used to be five separate `role="status"` paragraphs
   * stacked in the plate, each `shrink-0`, each mounted on its own condition —
   * and the conditions are not exclusive. "We are nearly done", "getting to
   * know you", "your tutor is thinking", "reconnecting" and "that took too
   * long" can all be true at once, and when they were, a child looking for
   * their exercise found a paragraph of system status where it used to be.
   * Five voices is not five channels; it is the same channel shouting.
   *
   * The order is severity, and each rung outranks the next because it changes
   * what the learner should DO: a dropped connection beats a slow reply, which
   * beats a session winding down, which beats a reply on its way, which beats
   * a tutor that does not know them well yet — the only one of the five that
   * asks for nothing at all.
   *
   * `wrapping` keeps its own surface. It is the one budget state that changes
   * how the remaining time should be spent, and flattening it into the same
   * quiet caption as the rest would lose the distinction this collapse exists
   * to protect.
   */
  const statusLine: { text: string; loud: boolean } | null = ended
    ? { text: t('tutor.conversation.ended'), loud: false }
    : resuming
      ? { text: t('tutor.conversation.reconnecting'), loud: false }
      : replyTimedOut
        ? { text: t('tutor.conversation.replyTimeout'), loud: false }
        : socket.budget === 'wrapping'
          ? { text: t('tutor.conversation.wrappingUp'), loud: true }
          : awaitingReply
            ? { text: t('tutor.mic.thinking'), loud: false }
            : !hasBoard && turn?.next === 'segment'
              ? { text: t('tutor.conversation.listening'), loud: false }
              : socket.intelDegraded
                ? { text: t('tutor.conversation.gettingToKnowYou'), loud: false }
                : null;

  /**
   * The learner's own last words, as the microphone heard them.
   *
   * The transcript is where this used to be read, and the transcript is now
   * inside the session menu — which is `hidden` while it is closed, so nothing
   * in it reaches a screen reader. For a learner who TYPED that is no loss;
   * for one who SPOKE it would remove the only confirmation that they were
   * heard correctly, which on a voice product is the difference between a
   * tutor that misunderstood and a microphone that did.
   */
  const lastLearnerLine =
    [...socket.history].reverse().find((entry) => entry.speaker === 'learner')?.text ?? null;

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
  /*
   * THE PHONE DOES NOT DOCK ANY MORE, and that is a defect being retired
   * rather than a feature being dropped.
   *
   * `'sheet'` docked the caption to `inset-x-0 top-16` whenever the mobile
   * sheet stood at FULL, on the argument that a caption cannot win an escape
   * against a full-width surface. The argument accounted for the SHEET and for
   * nothing else — and the other thing in that band is the microphone dock,
   * which on a phone is the orb and the composer together.
   *
   * It had never actually run. `ScreenAnchor` left its inline `top: 0; left: 0`
   * on the node when it released it, so the docked classes lost to stale
   * declarations and the caption sat in the top-left corner in both docked
   * modes. Fixing that release (same branch) made this path live for the first
   * time, and `verify:tutor-ui` measured what it does at mobile-es with the
   * sheet open: the caption overlapping the dock by 323x67 px, the orb painted
   * across the tutor's own last two lines.
   *
   * Anchored is the answer the codebase already has. The exit chip, the sheet
   * and the dock all publish their rectangles to `SafeAreaContext`, and an
   * anchored node registered with `avoid` is displaced out of all three by the
   * shortest move that stays in frame (`hudSpace.ts`, its own golden fixture).
   * Docking opted out of that machinery and then collided with one of the very
   * surfaces it knows about.
   *
   * Desktop still docks: there the panel is a genuinely unescapable full-height
   * column, the band beside it is wide, and the dock steps aside for it.
   */
  const docked: 'panel' | null = desktop && adaptation === null ? 'panel' : null;

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
          /*
           * A stable hook for `verify:tutor-ui`, which used to find this field
           * by `placeholder.includes('Rephrase')` — an English substring, in a
           * gate that also drives es-MX. A selector that silently matches
           * nothing in two of three configurations is the same decay as
           * `data-sheet-peek`, and the fix is the same: name the thing.
           */
          data-tutor-composer=""
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
          className="lf-press grid h-11 w-11 shrink-0 place-items-center rounded-md text-content transition-colors hover:text-primary lf-focus disabled:pointer-events-none disabled:opacity-40"
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

  /*
   * THE SESSION MENU, AND THE ONE CONTROL THAT STAYS OUTSIDE IT.
   *
   * The top-right corner used to carry five chips at once: a live badge, the
   * minutes, the XP, an unlabelled map glyph, an unlabelled refresh glyph and
   * "Finish" — six, when "start over" was armed and replaced itself with a
   * question and two answers. They did not fit at 390 px, so three of them
   * were `hidden lg:flex`, which is less a layout decision than an admission:
   * a learner on a phone simply never saw how much time they had.
   *
   * Now the corner is TWO things. A menu that says "menu", and the way to end
   * the session. Everything that REPORTS rather than acts moved inside the
   * menu, where it fits at every width — so the phone gained the minutes and
   * the XP it never had.
   *
   * `Finish` stays outside, visible, one press, and that is deliberate: it is
   * the only way to end a session, and a child who wants to stop should not
   * have to open something first. It is the same argument the way-out chip
   * already won in the opposite corner.
   *
   * The refresh glyph went in with them, and it was the most dangerous control
   * on the screen — a bare reload icon two places from the exit that threw
   * away the live conversation, the whiteboard and the tutor's diagnosis of
   * what the child had got wrong. It is now a NAMED row inside the menu, still
   * two-step, where nobody reaches it by accident.
   */
  const sessionPanel = (
    <div className="flex flex-col gap-4">
      {/*
        WHAT THE SESSION IS, in one row of numbers. The live dot is real state
        rather than decoration: it burns only while the socket is running, so a
        glance says whether the tutor is still listening.
      */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {socket.budget === 'running' && (
          <span className="flex items-center gap-2">
            <span className="lf-live-emerald" aria-hidden />
            <span className="lf-caption text-content">
              {t('tutor.conversation.liveWith', {
                name: t(`tutor.character.${session.character}.name`),
              })}
            </span>
          </span>
        )}

        {budgetRune && (
          <span className="flex items-center gap-1.5">
            {/*
              WARNING COLOUR ONLY WHEN THERE IS SOMETHING TO WARN ABOUT. This
              clock was `text-warning-strong` in every state, and a 2026-09-09
              audit photographed it reading 480 minutes in amber with nothing
              whatever to hurry about. A warning that is always on is a warning
              nobody reads on the day it is true.
            */}
            <Icon
              name="schedule"
              className={cn(
                '!text-[16px]',
                socket.budget === 'wrapping' ? 'text-warning-strong' : 'text-content-faint',
              )}
            />
            <span className="lf-caption text-content-muted">{budgetRune}</span>
          </span>
        )}

        {/*
          XP, and only once there is some: a counter that opens at zero and
          sits there is a promise nobody made.
        */}
        {sessionXp > 0 && (
          <span className="flex items-center gap-1.5">
            <Icon name="bolt" className="!text-[16px] text-warning-strong" />
            <span className="lf-caption font-bold text-accent-strong">
              {t('tutor.segment.xpEarned', { count: sessionXp })}
            </span>
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {mapAvailable && (
          <HudPlate
            as="button"
            shape="chip"
            onClick={onOpenMap}
            className="pointer-events-auto w-full !max-w-none"
            floorClassName="!justify-start !text-start"
          >
            <span className="flex items-center gap-2">
              <Icon name="map" className="!text-[18px]" />
              <span className="lf-action">{t('tutor.map.openLabel')}</span>
            </span>
          </HudPlate>
        )}

        {/*
          START OVER, NAMED, AND STILL TWO-STEP.
          The control is REPLACED in place rather than covered by a dialog —
          this product has never shipped a modal — and confirming takes focus so
          a keyboard user never loses their place. Gated on `!awaitingReply`,
          because tearing the socket down mid-turn records a deliberate restart
          as `learner_left`.
        */}
        {/*
          WHAT WE SAID, and this is where the transcript lives now.

          It was a card in the desktop rail and a block in the mobile sheet,
          and in both it was the surface that got whatever height was left:
          measured in production at 74 px holding 140 px of content after
          exactly two messages, with the tutor's own first sentence clipped
          mid-word. A log that can only ever show its last line and a half is
          not a record, it is a tease.

          Here it gets the panel's own scroller and its full natural height,
          and it costs nothing when nobody asks for it. `HudDisclosure` keeps
          it MOUNTED while closed, so its scroll position and its state
          survive being put away.
        */}
        <TutorTranscript
          history={socket.history}
          spokenSeq={turn ? turnSeq : null}
          label={t('tutor.conversation.transcriptLabel')}
          /*
           * No edit affordance while a board is open — same reasoning as the
           * repair chip: mid-activity, rewinding the conversation is not a
           * flow we honour.
           */
          onEditLast={ended || hasBoard ? undefined : beginEdit}
          editLabel={t('tutor.conversation.editMessage')}
        />

        {/* The phone's home for Finish — see the header group below. */}
        {!desktop && (
          <HudPlate
            as="button"
            shape="chip"
            onClick={onExit}
            disabled={awaitingReply}
            className="pointer-events-auto w-full !max-w-none"
            floorClassName="!justify-start !text-start"
          >
            <span className="flex items-center gap-2">
              <Icon name="logout" className="!text-[18px]" />
              <span className="lf-action">{t('tutor.conversation.finish')}</span>
            </span>
          </HudPlate>
        )}

        {confirmingRestart ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="lf-action min-w-0 flex-1 text-content">
              {t('tutor.conversation.startOverConfirm')}
            </span>
            <HudPlate
              as="button"
              shape="chip"
              ref={restartYesRef}
              onClick={() => {
                setConfirmingRestart(false);
                onRestart();
              }}
              className="pointer-events-auto shrink-0"
            >
              <span className="lf-action">{t('actions.confirmYes')}</span>
            </HudPlate>
            <HudPlate
              as="button"
              shape="chip"
              onClick={() => setConfirmingRestart(false)}
              className="pointer-events-auto shrink-0"
            >
              <span className="lf-action">{t('actions.confirmNo')}</span>
            </HudPlate>
          </div>
        ) : (
          <HudPlate
            as="button"
            shape="chip"
            onClick={() => setConfirmingRestart(true)}
            disabled={awaitingReply}
            className="pointer-events-auto w-full !max-w-none"
            floorClassName="!justify-start !text-start"
          >
            <span className="flex items-center gap-2">
              <Icon name="refresh" className="!text-[18px]" />
              <span className="lf-action">{t('tutor.conversation.startOver')}</span>
            </span>
          </HudPlate>
        )}
      </div>
    </div>
  );

  const headerChips = (
    <>
      <HudDisclosure
        id="session"
        label={t('tutor.session.label')}
        icon="menu"
        /*
         * The panel opens where its trigger is. On desktop that is the shell's
         * header-panel host, hanging just below the row. On a phone the trigger
         * rides the dock, so the panel renders IN PLACE — growing upward out of
         * the dock column, which is a first-class state of the primitive rather
         * than a fallback, and the same thing that happens with no shell at all.
         */
        host={dock?.headerPanel ?? null}
        open={sessionOpen}
        onOpenChange={setSessionOpen}
      >
        {sessionPanel}
      </HudDisclosure>

      {/*
        FINISH IS OUTSIDE THE MENU ON DESKTOP AND INSIDE IT ON A PHONE, and
        that is arithmetic rather than a change of mind.

        It belongs outside: it is the only way to END a session, and a child who
        wants to stop should not have to open something first. Desktop has the
        room, so it keeps it.

        A phone does not. There is space for the caption and ONE band of
        controls, not two — measured every way round. Two chips in the top-right
        corner pushed the ANCHORED caption 72 px down into the microphone dock;
        moving both into the dock made the dock 48 px taller and the caption met
        it from the other side, at 375 in en-US, by 121x32. The band a phone can
        afford holds the way out and one named door. So on a phone the door
        holds Finish, one tap further in, and the dock goes back to the height
        the stage reserve was sized for.
      */}
      {desktop && (
        <HudPlate
          as="button"
          shape="chip"
          onClick={onExit}
          /*
           * DISABLED WHILE THE TUTOR IS STILL ANSWERING (adversarial review,
           * round 90): `end_session` claims the same turn slot the reply is
           * holding, and tearing the socket down without waiting records a
           * deliberate "Finish" as `learner_left` instead of `completed`,
           * skipping the farewell.
           */
          disabled={awaitingReply}
          className="pointer-events-auto shrink-0"
        >
          <span className="lf-action">{t('tutor.conversation.finish')}</span>
        </HudPlate>
      )}
    </>
  );

  /*
   * INTO THE SHELL'S HEADER ROW WHEN THERE IS ONE, AND IN PLACE WHEN THERE IS
   * NOT.
   *
   * The fallback is not defensive noise: these five controls include the only
   * way to END a session and the only way to restart it, and a portal whose
   * target is missing renders NOTHING — silently. Any consumer that mounts this
   * layer outside `StageShell` (the test suite does exactly that) would lose
   * "Finish" with no error anywhere. A control that can disappear because a
   * layout slot was absent is the shape of bug this route has already shipped
   * twice, so the slot is an ENHANCEMENT and never a precondition.
   */
  /*
   * THE HEADER ROW AT BOTH WIDTHS NOW, and the collapse above is what paid
   * for it.
   *
   * These chips used to go back onto the plate's own header row below `lg:`,
   * because five chips beside the exit chip wrapped onto a second row and
   * landed across the speech card at 390 px. Two do not — and the plate they
   * were falling back to is no longer always mounted, so a fallback that
   * depends on it would take the only way to END a session off screen for
   * every conversation that never opens a board.
   *
   * AND THE LAST-RESORT RENDERING IS NO LONGER DESKTOP-ONLY. It used to be
   * `!desktop ? null : createPortal(...)`, which was correct while the phone
   * had the plate to fall back on and became a hole the moment it did not: a
   * consumer with no shell (the test suite mounts this layer bare, and so does
   * the lab) lost "Finish" entirely at phone width. A portal whose target is
   * missing renders NOTHING, silently, and a control that can vanish because a
   * layout slot was absent is the shape of bug this route has already shipped
   * twice. The slot is an ENHANCEMENT and never a precondition — at either
   * width.
   */
  /*
   * ONE HOME, THE SHELL'S HEADER ROW, AT BOTH WIDTHS — carrying two chips on
   * desktop and one on a phone.
   *
   * Three arrangements were measured before this one. Two chips in the corner
   * at 390 px pushed the ANCHORED caption 72 px down into the dock (263x49).
   * Both chips moved into the dock instead made the dock 48 px taller and the
   * caption met it from the other side — clean in es-MX at a raised stage
   * reserve, still 121x32 in en-US, where the same sentence wraps differently.
   * One locale's string length is not a layout budget.
   *
   * What a phone can actually afford above the island is the way out and ONE
   * named door. So the row carries the menu at both widths, Finish joins it on
   * desktop only, and the dock goes back to the orb and the composer — the
   * height `STAGE_RESERVE_PX` was sized for in the first place.
   */
  const headerHome = dock?.header ?? null;
  const headerGroup = headerHome
    ? createPortal(
        <div className="pointer-events-auto flex shrink-0 flex-wrap items-center justify-center gap-2">
          {headerChips}
        </div>,
        headerHome,
      )
    : /*
       * The last-resort rendering, for a consumer with no shell at all — the
       * test suite mounts this layer bare, and so does the lab. A portal whose
       * target is missing renders NOTHING, silently, and these controls include
       * the only way to END a session: a control that can vanish because a
       * layout slot was absent is the shape of bug this route has already
       * shipped twice, so the slot is an ENHANCEMENT and never a precondition.
       */
      createPortal(
        <div className="pointer-events-none fixed right-4 top-4 z-50 flex flex-wrap items-center justify-end gap-2 md:right-6 md:top-6">
          {headerChips}
        </div>,
        document.body,
      );

  return (
    <>
      {headerGroup}
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
          {/*
            THE LESSON CHIP IS GONE, and its content is not (2026-09-06).
            It floated at `top-16` on the left saying "topic — step 2 of 4",
            which is the same fact the speech card's own identity row now
            carries beside the face that is teaching it. Two surfaces for one
            fact is what the study's speech card exists to collapse, and this
            one was additionally hidden in exactly the layout that had the most
            room for it. The step DOTS went with it: they were an `aria-hidden`
            visual companion to a sentence that has moved.
          */}

          <SpeechCaption
            text={turn?.text ?? null}
            /*
             * The speaker's own name and the lesson they are in, folded into the
             * card that carries their portrait — the study's identity row. The
             * lesson line used to be a separate chip floating at the top-left
             * (removed below): a second surface for a fact that belongs beside
             * the face saying it.
             */
            /*
             * NO IDENTITY ROW ON A PHONE WITH A BOARD UP, and this file has
             * made the same trade once already: the lesson breadcrumb is
             * `hidden lg:inline` because two wrapped lines of it grew the
             * caption into the microphone dock by 308x43 px.
             *
             * Same band, same arithmetic. At 390 px with the sheet at FULL the
             * stage keeps `STAGE_RESERVE_PX` = 300, and that 300 now has to
             * hold the caption AND a dock carrying the orb, the composer and
             * the session controls. `verify:tutor-ui` measured the shortfall at
             * 262x33. The NAME is the part that goes: the speaker's portrait is
             * beside it, articulating, and the 3D character is behind — a child
             * who can see two faces does not need the word "Dr. Rho" to know
             * who is talking. The words never move.
             */
            speaker={
              !desktop && hasBoard
                ? null
                : {
                    name: t(`tutor.character.${session.character}.name`),
                    lesson:
                      socket.lesson !== null
                        ? (socket.lesson.topic !== null ? `${socket.lesson.topic} · ` : '') +
                          t('tutor.conversation.lessonThread', {
                            step: socket.lesson.step,
                            of: socket.lesson.of,
                          })
                        : null,
                  }
            }
            turnSeq={turnSeq}
            face={face}
            docked={docked}
            wordTimings={turn?.wordTimings ?? null}
            audioElement={audioElement}
            speaking={speaking}
          />

          {/*
            THE SKY RUNE IS GONE, and it was the THIRD printing of one number.
            The minutes were on this rune, on a header chip, and — while
            wrapping up — in a paragraph on the plate.

            It was also the printing nobody saw. It is a `WorldChip`, so it is
            culled the moment its world point leaves the frame, and the frame
            during a conversation is a close-up on the character rather than
            the sky: measured in production at 1604x677 the rune's node was
            `display: none` with a zero box while the header chip beside it
            rendered the same "Quedan 465 min" perfectly. A surface that is
            correct and invisible still costs a reader the question "which of
            these two is the real one".

            The minutes live in the session menu now, where they fit at every
            width — which is also the first time a learner on a phone has been
            able to see them at all. "We are nearly done" keeps its own line on
            the plate, because that is the one budget state that changes what
            the remaining time should be spent on.
          */}
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
              <TutorFace
                {...face}
                /*
                 * A TINTED RING, matching the design study's identity chip:
                 * an indigo-tinted backplate and hairline around the speaker's
                 * portrait, distinct from the plain photo it was. `bg-accent-soft`
                 * only shows at the rounded corners the image itself doesn't
                 * fill; the border is what reads as a chip rather than a crop.
                 */
                className="h-11 w-11 self-start border border-accent/30 bg-accent-soft sm:h-14 sm:w-14"
              />
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
              {/*
               * A LIVE DOT beside the session's own clock. The design study
               * pairs its session badge with a pulsing emerald dot, and here it
               * is TRUE rather than decorative: it shows only while
               * `socket.budget === 'running'`, which is one of the two states
               * that produce this rune at all. When the session starts wrapping
               * up the rune changes and the dot goes with it, so it can never
               * claim a session that is not live.
               */}
              {socket.budget === 'running' ? <span className="lf-live-emerald" aria-hidden /> : null}
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

      {/*
        THE BOARD SURFACE, AND IT ONLY EXISTS WHEN THERE IS A BOARD.
        See `hasBoard` for what the always-mounted version cost.

        What is inside it is now the board and nothing else. It used to be a
        stack: a status paragraph or five, a framed card with a generic
        "Interactive whiteboard" header and a permanently-lit "Live activity"
        badge, the exercise, an "explain it another way" chip, the whole
        transcript in a second card, and the composer in a third. Six surfaces
        of chrome around one drawing. The status line and the chip ride the
        dock, the transcript is a section of the session menu, the composer has
        one home at both widths, and the board's own model-written label is the
        only title it needs.
      */}
      {hasBoard && (
        <LessonPlate
          /*
           * NO HEADER CHIPS HERE ANY MORE. The session controls have ONE home
           * now — the shell's header row, or the fallback portal when there is
           * no shell — and passing them here as well rendered them twice for
           * any consumer without a dock: once in the fallback and once on the
           * plate's own handle row.
           */
          label={t('tutor.conversation.plateLabel')}
          resizeLabel={t('tutor.conversation.resizePanel')}
          /*
           * OUT OF THE WAY WHILE THE TUTOR IS WAITING ON A YES OR NO. Hidden,
           * never unmounted: a half-answered exercise keeps its state, and the
           * sheet comes back at PEEK the moment the question is answered.
           */
          standDown={adaptation !== null}
          detent={detent}
          onDetentChange={changeDetent}
          onFootprint={publishFootprint}
          /*
           * And the OTHER axis: whether the corner is occupied, which is what
           * decides where the microphone stands at 1280 px. It is the plate's
           * fact and not the phase's — and now that the plate is mounted only
           * with a board, the claim is automatically false the rest of the
           * time, which is the answer the dock always wanted.
           */
          onCornerHeld={dock?.setCornerPlate}
          peekLabel={peekLabel}
          peekStatus={peekStatus}
          peekOpensTo="full"
          bodyLayout="column"
        >
          {socket.segment ? (
            <LiveSegmentPanel
              live={socket.segment}
              token={token}
              onGraded={socket.reportGrade}
              onXpAwarded={addXp}
              // v3: a turn may carry tray-demonstration steps for the open activity.
              demo={turn?.demonstrate ? { seq: turn.seq, steps: turn.demonstrate } : null}
              // A `story` family segment has no character layer of its own here —
              // see `LiveSegmentPanel`'s own doc comment. Bubbled straight up:
              // this layer does not drive the scene, so the cue passes through to
              // whoever does, one level up.
              onCharacterCue={onCharacterCue}
              className="min-h-0 flex-auto"
            />
          ) : turn?.whiteboard ? (
            <>
              <TutorWhiteboard board={turn.whiteboard} seq={turn.seq} className="min-h-0 flex-auto" />
              {/*
                THE BOARD'S OWN CONTROL, under the board it keeps. On the bare
                rail it sat in the gap BETWEEN two cards, over the stage,
                reading as a stray link rather than as this drawing's control.
              */}
              <NotebookKeepButton
                key={turn.seq}
                token={token}
                sessionId={session.sessionId}
                turnSeq={turn.seq}
              />
            </>
          ) : null}
        </LessonPlate>
      )}

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

        {/*
          ONE TAP FOR "I DIDN'T GET THAT". It used to sit in the plate, which
          is why it disappeared for the whole of every conversation that never
          opened one. It is the child's own repair action — the only one they
          have when a sentence did not land — so it belongs beside the
          microphone, in the band that is always there.

          Shown once the lesson is properly under way and the tutor is between
          turns: never over a board, where the learner has a task, and never
          while a reply is in flight.
        */}
        {turn && turnSeq > 1 && !hasBoard && !awaitingReply && !ended && (
          <HudPlate
            as="button"
            shape="chip"
            onClick={askDifferently}
            className="pointer-events-auto lf-focus shrink-0"
          >
            <span className="lf-action">{t('tutor.conversation.explainDifferently')}</span>
          </HudPlate>
        )}

        {/*
          THE SESSION'S ONE STATUS LINE, and it rides the dock now rather than
          the plate. See `statusLine` for the precedence and for what five
          stacked paragraphs cost; it moved here for the same reason the chip
          above did — the plate it used to live in is no longer always there.

          KEYED ON THE SENTENCE, which is how this codebase already makes a
          live region announce reliably (`LiveSegmentPanel`'s round-87 fix): a
          changed `key` REMOUNTS the node, and a freshly inserted
          `role="status"` is announced, where an `aria-live` region whose text
          merely mutates is not dependably read. Keyed rather than
          always-mounted, so there is never a second nameless live region for a
          screen-reader user to disambiguate against the board's own.

          The thinking state reaches a learner who TYPED through this line; the
          orb carries it for one who spoke. Neither repeats the other.
        */}
        {statusLine && (
          <p
            key={statusLine.text}
            role="status"
            className={cn(
              'shrink-0 text-center',
              statusLine.loud
                ? 'lf-lumen lf-body rounded-md bg-warning-soft px-3 py-2 text-content'
                : 'lf-caption text-content-muted',
            )}
          >
            {statusLine.text}
          </p>
        )}

        {/*
          WHAT THE MICROPHONE HEARD, for a screen reader only.
          The visible transcript is a section of the session menu, and a closed
          disclosure is `hidden`, so nothing inside it reaches assistive tech.
          A learner who typed loses nothing by that; a learner who SPOKE would
          lose the only confirmation that they were heard correctly, which is
          the difference between a tutor who misunderstood and a microphone
          that did.
        */}
        {lastLearnerLine && (
          <span key={lastLearnerLine} role="status" className="sr-only">
            {lastLearnerLine}
          </span>
        )}
      </DockSlot>

      {/*
        THE COMPOSER HAS ONE HOME NOW, at both widths: the shell's dock, beside
        the orb, where the sheet's footprint keeps it above the bottom edge.

        On desktop it used to be the third card down inside the rail — which
        meant the way to answer the tutor moved house at 1024 px, and vanished
        entirely on any desktop conversation that never opened a board. One
        home, always present, is what "the one channel that cannot be taken
        away" actually requires.

        Suppressed at the PORTAL for the length of a yes-or-no (both answers
        are already on screen; a third way to answer a closed question costs
        56 px of a small screen) — React keeps the field's state either way.
      */}
      <DockSlot dock={dock} target={adaptation ? null : (dock?.below ?? null)}>
        {composer}
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


/*
 * `BoardFrame` AND `RailCard` ARE GONE (2026-09-12).
 *
 * `BoardFrame` was the board's chrome: a tinted `widgets` tile, the title
 * "Interactive whiteboard", and a pulsing dot beside the words "Live
 * activity" — about 50 px off the top of every drawing, saying the same thing
 * in every state on a surface that only ever exists while it is live. The
 * board already carries its own model-written label, which names THIS
 * drawing rather than the category of drawings. Chanel's rule: take one
 * accessory off before leaving the house.
 *
 * `RailCard` was the desktop-only reading card that wrapped each of the
 * rail's three blocks. With the board as the only thing in the plate there
 * is one block, and the plate is already a Lumen surface — a Lumen card
 * nested inside a Lumen plate was two materials for one object.
 */
