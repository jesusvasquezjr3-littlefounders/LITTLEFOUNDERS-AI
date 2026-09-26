import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { AgeBand, Locale } from '../../design/copyBudget';
import {
  Button, IconButton, InlineNotice, List, ListRow, Menu, MentorAvatar, MENTOR_NAMES, Pill, ReplyChip, Sheet, TextField,
  type MentorCharacter, type MenuItem,
} from '../../design/controls';
import { findMentorAvatar, MENTOR_CHARACTERS } from '../../design/assets';
import { MentorCalibration, type MentorCalibrationCopy } from '../../identity/MentorCalibration';
import { MentorStage, type MentorStageCopy, type MentorStageScene } from '../MentorStage';
import { AllianceCheck, type AllianceCheckCopy, type AllianceCheckResult } from '../AllianceCheck';
import type { BondProxyAnswer } from '../allianceApi';
import { CheckInChoice, type CheckInCopy } from '../CheckIn';
import { GoalCheckChoice, type GoalCheckCopy } from '../GoalCheck';
import { SessionClosing, SessionEndChoice, type SessionEndCopy } from '../SessionEnd';
import type { MentorStageState } from '../stageStates';
import type { MicBlockedReason } from '../session/micForPhase';
import type { StartSessionInput } from '../session/tutorApi';
import type { Adaptation, BudgetState, TutorOffers, TutorWhiteboardWire } from '../session/types';
import type { LiveSegmentState, TutorTurnState } from '../session/useTutorSocket';
import type { Microphone } from '../session/useMicrophone';
import type { MentorClosing, MentorPhase } from './useMentorSession';
import { MentorBoard, type MentorBoardCopy } from './MentorBoard';
import { speechPages } from './speechPages';
import '../../design/tokens.css';
import '../../design/system.css';
import './mentorScreen.css';

/*
 * THE MENTOR SCREEN (Frontend Bible 08 §2–§6; D13, rules 21–23).
 *
 * The screen IS the stage: the chosen character on its Diorama is the
 * dominant area on every width, never a chat window. Top to bottom on a phone:
 *
 *   1  top bar       close, the character's name as the title, a menu (change
 *                    Mentor, what we said, and "what my grown-up sees" only
 *                    with a guardian link);
 *   2  the stage     `MentorStage`, 55-60% of the height on a phone, half on a
 *                    tablet, the left 7 of 12 columns on a desktop;
 *   3  speech plate  the Mentor's CURRENT turn only, in caption pages within
 *                    the Copy Budget; a short "Thinking…" after 1.5 s;
 *   4  the board     on demand, in the shared Pizarrón frame: over the lower
 *                    stage on a phone, beside the character on a desktop;
 *   5  response      2-3 reply chips, the flat text field, and the microphone
 *                    only where C.2 allows it.
 *
 * The full conversation is a secondary sheet (the transcript). Block C shows up
 * as Mentor turns with equal chips: the hint ladder (C.13: "a hint" and "just
 * tell me" travel as the learner's own words, which Oracle's ladder reads),
 * adaptation offers (C.15), the stop-or-continue offer (C.8/C.12), the goal
 * check (C.15), the check-in (C.19) and the closing (C.16) with the bond proxy
 * (C.15). Age bands change presence and wording, never components (08 §9):
 * chips lead for 6-9, the field leads for 13+.
 */

export interface MentorScreenCopy {
  documentTitle: string;
  close: string; menu: string; menuLabel: string; changeMentor: string; transcript: string; grownUp: string; grownUpBody: string;
  sheetClose: string; transcriptEmpty: string; you: string;
  loading: string; unavailable: string; retry: string; greeting: string; greetingNamed: string; noProgress: string;
  openingsLabel: string; continue: string; continueGeneric: string; practise: string; practiseSkill: string; courseTopic: string; diagnostic: string; faq: Record<string, string>;
  askLabel: string; replyLabel: string; send: string; talk: string; stopTalking: string; interrupt: string; listening: string;
  micBlocked: Record<MicBlockedReason, string>; micDenied: string; thinking: string; nextLine: string;
  replyChips: string; hint: string; tell: string; adaptation: Record<Adaptation, string>; yes: string; no: string;
  limit: string; startFailed: string; startRefused: Record<string, string>; errors: Record<string, string>;
  reconnecting: string; replyTimeout: string; wrapping: string; activity: string; activityAnswer: string;
  showBoard: string; hideBoard: string;
  chooser: { heading: string; chosen: string; saving: string; failed: string; lines: Record<MentorCharacter, string> };
  board: MentorBoardCopy;
}

export interface MentorCopy {
  mentorScreen: MentorScreenCopy;
  mentorStage: MentorStageCopy;
  mentorCalibration: MentorCalibrationCopy;
  mentorSessionEnd: SessionEndCopy;
  mentorCheckIn: CheckInCopy;
  mentorGoalCheck: GoalCheckCopy;
  mentorAllianceCheck: AllianceCheckCopy;
}

/** What the screen reads of the live conversation (the socket satisfies it). */
export interface MentorLive {
  adaptationOffer: Adaptation | null;
  sessionEndOffer: boolean;
  checkInOpen: boolean;
  goalCheckOpen: boolean;
  error: { code: string } | null;
  budget: BudgetState;
  intelDegraded: boolean;
  segment: LiveSegmentState | null;
  thinking: boolean;
  answerAdaptation: (adaptation: Adaptation, accepted: boolean) => void;
  answerSessionEnd: (accepted: boolean) => void;
  answerCheckIn: (aligned: boolean) => void;
  answerGoal: (agreed: boolean) => void;
}

/** The session as the screen shows it (`useMentorSession` returns it; the preview builds fixtures of it). */
export interface MentorScreenSession {
  phase: MentorPhase;
  /** Core has said which character this learner chose: until then no character is shown, never a stand-in. */
  known: boolean;
  ageBand: AgeBand;
  character: MentorCharacter;
  scene: MentorStageScene;
  nickname: string | null;
  offers: TutorOffers | null;
  calibrationSaving: boolean;
  calibrationError: boolean;
  starting: boolean;
  startError: string | null;
  socket: MentorLive;
  turn: TutorTurnState | null;
  speechUrl: string | null;
  audioKey: number;
  speaking: boolean;
  awaitingReply: boolean;
  replyTimedOut: boolean;
  resuming: boolean;
  ending: boolean;
  history: readonly { speaker: 'learner' | 'tutor'; text: string; seq: number }[];
  closing: MentorClosing | null;
  mic: { present: boolean; blockedBy: MicBlockedReason | null; denied: boolean; recording: boolean; microphone: Pick<Microphone, 'subscribe'> };
  retry: () => void;
  chooseCalibration: (tier: 1 | 2 | 3) => void;
  start: (input: Omit<StartSessionInput, 'wantsVoice'>) => void;
  sendText: (text: string) => void;
  pressMic: () => void;
  endSession: () => void;
  chooseCharacter: (character: MentorCharacter) => Promise<boolean>;
  answerAlliance: (answer: BondProxyAnswer) => Promise<AllianceCheckResult>;
  setHasDraft: (draft: boolean) => void;
  onSpeechEnd: () => void;
  onSpeechBlocked: (blocked: boolean) => void;
}

export interface MentorScreenProps {
  session: MentorScreenSession;
  copy: MentorCopy;
  locale: Locale;
  theme: 'light' | 'dark';
  /** A child in a family (a verified guardian link): the menu explains what the grown-up sees. */
  guardianLink: boolean;
  /** Leave the Mentor screen (the top bar's close outside a conversation). */
  onLeave: () => void;
  /** The closing state's one action: back to the learning path. */
  onPath: () => void;
  /** A secondary sheet open from the first render (the development preview and its audits). */
  initialSheet?: 'transcript' | 'grownUp' | 'chooser' | null;
}

const fill = (template: string, values: Record<string, string>) =>
  Object.entries(values).reduce((text, [key, value]) => text.split(`{${key}}`).join(value), template);

interface Opening { id: string; label: string; input: Omit<StartSessionInput, 'wantsVoice'> }

/** 2-3 openings (08 §2 layer 5): where the learner left off first, one flagged skill as an offer, then the course and a curated question. */
export function openingsFor(offers: TutorOffers, copy: MentorScreenCopy): Opening[] {
  const list: Opening[] = [];
  const last = offers.lastSession;
  if (last && (last.topic || last.skillKey)) {
    // A topic Core could not name is never shown as its internal key (an English slug in every language).
    list.push({ id: 'continue', label: last.topic ? fill(copy.continue, { topic: last.topic }) : copy.continueGeneric,
      input: last.courseId || last.topicId ? { intent: 'course_topic', courseId: last.courseId, topicId: last.topicId } : { intent: 'weak_skill', skillKey: last.skillKey } });
  }
  const weak = offers.weakSkills[0];
  if (weak) list.push({ id: 'weak_skill', label: weak.title ? fill(copy.practise, { topic: weak.title }) : copy.practiseSkill,
    input: { intent: 'weak_skill', skillKey: weak.skillKey, courseId: weak.courseId, topicId: weak.topicId } });
  else list.push({ id: 'diagnostic', label: copy.diagnostic, input: { intent: 'diagnostic' } });
  list.push({ id: 'course_topic', label: copy.courseTopic, input: { intent: 'course_topic' } });
  const faq = offers.faqIds.find((id) => copy.faq[id]);
  if (faq) list.push({ id: `faq:${faq}`, label: copy.faq[faq]!, input: { intent: 'faq', skillKey: faq } });
  return list.slice(0, 3);
}

/** The state the character plays (08 §3), from what the session is doing. The UI requests it; the stage never fakes it. */
export function stageStateFor(session: MentorScreenSession, { board, delivering, drafting }: { board: boolean; delivering: boolean; drafting: boolean }): MentorStageState {
  if (session.phase === 'closing') return 'closing';
  if (session.phase !== 'conversing') return drafting ? 'listening' : 'idle';
  if (session.mic.recording || drafting) return 'listening';
  if (session.awaitingReply || session.socket.thinking) return 'thinking';
  if (session.speaking || delivering) return board ? 'demonstrating' : 'speaking';
  if (session.turn?.emotion === 'encouraging') return 'encouraging';
  return 'idle';
}

function useSplitLayout(ref: React.RefObject<HTMLElement>) {
  const [split, setSplit] = useState(false);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const measure = () => setSplit(element.getBoundingClientRect().width >= 1024);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return split;
}

/**
 * 08 §6: the stage is never smaller than the response area. With large text on
 * a narrow phone the response area can outgrow the stage's 55%; the stage then
 * grows with it (the screen scrolls) instead of shrinking under it.
 */
function useResponseBlock(root: React.RefObject<HTMLElement>, response: React.RefObject<HTMLElement>) {
  useLayoutEffect(() => {
    const element = response.current;
    const screen = root.current;
    if (!element || !screen || typeof ResizeObserver === 'undefined') return undefined;
    const measure = () => screen.style.setProperty('--lf-mentor-response-block', `${Math.ceil(element.getBoundingClientRect().height)}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  });
}

/** The microphone's level, drawn without re-rendering the screen (08 §3: the indicator is in the response area, not on the character). */
function MicLevel({ microphone, label }: { microphone: Pick<Microphone, 'subscribe'>; label: string }) {
  const bar = useRef<HTMLSpanElement>(null);
  useEffect(() => microphone.subscribe((level) => {
    bar.current?.style.setProperty('--lf-mentor-level', String(Math.max(0.04, Math.min(1, level))));
  }), [microphone]);
  return <span className="lf-mentor-level" data-copy-role="body">
    <span className="lf-mentor-level-track" aria-hidden="true"><span ref={bar} className="lf-mentor-level-fill" /></span>
    <span>{label}</span>
  </span>;
}

function SpeechPlate({ text, locale, ageBand, copy, status }: { text: string | null; locale: Locale; ageBand: AgeBand; copy: MentorScreenCopy; status: string | null }) {
  const pages = useMemo(() => (text ? speechPages(text, locale, ageBand) : []), [text, locale, ageBand]);
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [text]);
  const shown = status ?? pages[Math.min(page, pages.length - 1)] ?? null;
  if (shown === null) return null;
  const more = status === null && page < pages.length - 1;
  return <section className="lf-mentor-plate" data-plate={status !== null ? 'status' : 'turn'} data-pages={pages.length || undefined}>
    <p className="lf-mentor-plate-text" data-copy-role="mentor" aria-live="polite">{shown}</p>
    {more ? <Button size="sm" variant="sky" className="lf-mentor-plate-next" onClick={() => setPage((n) => n + 1)}>{copy.nextLine}</Button> : null}
  </section>;
}

export function MentorScreen({ session, copy: all, locale, theme, guardianLink, onLeave, onPath, initialSheet = null }: MentorScreenProps) {
  const copy = all.mentorScreen;
  const name = MENTOR_NAMES[session.character];
  const title = session.known ? name : copy.documentTitle;
  const dark = theme === 'dark';
  const root = useRef<HTMLDivElement>(null);
  const split = useSplitLayout(root);
  const response = useRef<HTMLElement>(null);
  useResponseBlock(root, response);
  const titleId = useId();
  const [draft, setDraft] = useState('');
  const [sheet, setSheet] = useState<'transcript' | 'grownUp' | 'chooser' | null>(initialSheet);
  const [choosing, setChoosing] = useState<MentorCharacter | null>(null);
  const [chooseFailed, setChooseFailed] = useState(false);
  const turn = session.phase === 'conversing' ? session.turn : null;

  /* The board: open when a turn draws one, closable, and reopenable until the next board replaces it. */
  const [board, setBoard] = useState<{ seq: number; wire: TutorWhiteboardWire } | null>(null);
  const [boardOpen, setBoardOpen] = useState(false);
  useEffect(() => {
    if (turn?.whiteboard) { setBoard({ seq: turn.seq, wire: turn.whiteboard }); setBoardOpen(true); }
  }, [turn?.seq, turn?.whiteboard]);
  useEffect(() => { if (session.phase !== 'conversing') { setBoard(null); setBoardOpen(false); } }, [session.phase]);
  const segment = session.phase === 'conversing' ? session.socket.segment : null;

  /* A turn without a voice is still delivered: the speaking pose for about the time it takes to read it. */
  const [delivering, setDelivering] = useState(false);
  useEffect(() => {
    if (!turn || turn.audioUrl || turn.audioPending) { setDelivering(false); return undefined; }
    setDelivering(true);
    const words = turn.text.split(/\s+/).length;
    const timer = window.setTimeout(() => setDelivering(false), Math.min(6000, 1200 + words * 300));
    return () => window.clearTimeout(timer);
  }, [turn?.seq, turn?.audioUrl, turn?.audioPending]);

  /* 08 §3: the thinking pose at once; the one-word status only after about 1.5 s. */
  const waiting = session.phase === 'conversing' && (session.awaitingReply || session.socket.thinking || (!turn && !session.resuming));
  const [longWait, setLongWait] = useState(false);
  useEffect(() => {
    if (!waiting) { setLongWait(false); return undefined; }
    const timer = window.setTimeout(() => setLongWait(true), 1500);
    return () => window.clearTimeout(timer);
  }, [waiting]);

  const drafting = draft.trim() !== '';
  useEffect(() => { session.setHasDraft(drafting); }, [drafting, session.setHasDraft]);

  const state = stageStateFor(session, { board: boardOpen && board !== null, delivering, drafting });
  const offers = session.offers;
  const limited = session.startError === 'SESSION_LIMIT' || offers?.startBlockedBy === 'SESSION_LIMIT';
  const canStart = !!offers?.canStart && !limited && !session.starting;

  const plateText: string | null = (() => {
    switch (session.phase) {
      case 'loading': return copy.loading;
      case 'unavailable': return copy.unavailable;
      case 'openings':
        if (limited) return copy.limit;
        if (offers && !offers.canStart) return copy.unavailable;
        return fill(session.nickname ? copy.greetingNamed : copy.greeting, { name, nickname: session.nickname ?? '' });
      case 'conversing': return turn?.text ?? null;
      default: return null;
    }
  })();
  const plateStatus = session.phase === 'conversing'
    ? (session.resuming ? copy.reconnecting : waiting && longWait ? copy.thinking : null)
    : null;

  const startRefusal = session.startError && session.startError !== 'SESSION_LIMIT'
    ? copy.startRefused[session.startError] ?? (['ORACLE_UNAVAILABLE', 'MODEL_UNAVAILABLE'].includes(session.startError) ? copy.unavailable : copy.startFailed)
    : null;
  const liveError = session.phase === 'conversing' && session.socket.error && !session.resuming
    ? (session.socket.error.code === 'SERVICE_DEGRADED' ? copy.unavailable : copy.errors[session.socket.error.code] ?? copy.errors.generic)
    : null;

  /* The reply chips of this moment: an offer the server opened outranks the hint ladder. */
  const live = session.socket;
  const offerOpen = session.phase === 'conversing' && (live.adaptationOffer !== null || live.sessionEndOffer || live.checkInOpen || live.goalCheckOpen);
  const ladder = session.phase === 'conversing' && !offerOpen && !!turn && turn.next === 'ask' && !session.awaitingReply && !session.ending;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    session.sendText(draft);
    setDraft('');
  };
  const fieldShown = session.phase === 'conversing' || (session.phase === 'openings' && !!offers?.canAskOpen && canStart);
  const busy = session.phase === 'conversing' && (session.ending || session.resuming);

  const menuItems: MenuItem[] = [
    ...(session.phase === 'conversing' || !session.known ? [] : [{ id: 'change', label: copy.changeMentor, onSelect: () => { setChooseFailed(false); setSheet('chooser'); } }]),
    { id: 'transcript', label: copy.transcript, onSelect: () => setSheet('transcript') },
    ...(guardianLink ? [{ id: 'grown-up', label: copy.grownUp, onSelect: () => setSheet('grownUp') }] : []),
  ];

  const close = () => { if (session.phase === 'conversing') session.endSession(); else onLeave(); };

  const choose = async (character: MentorCharacter) => {
    if (character === session.character) { setSheet(null); return; }
    setChoosing(character);
    setChooseFailed(false);
    const saved = await session.chooseCharacter(character);
    setChoosing(null);
    if (saved) setSheet(null); else setChooseFailed(true);
  };

  const micLabel = session.mic.recording ? copy.stopTalking : session.speaking ? copy.interrupt : copy.talk;
  const blockedLine = session.mic.blockedBy === 'CONSENT_REQUIRED' || session.mic.blockedBy === 'POLICY_BLOCKED'
    ? copy.micBlocked[session.mic.blockedBy] : null;

  const plate = <SpeechPlate text={plateText} locale={locale} ageBand={session.ageBand} copy={copy} status={plateStatus} />;
  const boardShown = !!board && boardOpen && session.phase === 'conversing';
  const closingEl = session.phase === 'closing' && session.closing
    ? <div className="lf-mentor-closing" ref={response as React.RefObject<HTMLDivElement>}>
          <SessionClosing copy={all.mentorSessionEnd} locale={locale} dark={dark} script={session.closing.script}
            effort={session.closing.effort} topic={session.closing.topic} onBack={onPath} />
          {session.closing.sessionId
            ? <AllianceCheck copy={all.mentorAllianceCheck} locale={locale} dark={dark} script={session.closing.script} onAnswer={session.answerAlliance} />
            : null}
        </div>
    : null;
  const boardEl = board && boardOpen && session.phase === 'conversing'
        ? <div className="lf-mentor-board" key={board.seq}>
          <MentorBoard board={board.wire} copy={copy.board} locale={locale} />
          <IconButton glyph="close" label={copy.hideBoard} variant="inverse" className="lf-mentor-board-hide" onClick={() => setBoardOpen(false)} />
        </div>
        : null;
  const activityEl = segment && !boardOpen
        ? <section className="lf-mentor-board lf-mentor-activity" aria-labelledby={`${titleId}-activity`} key={segment.segmentId}>
          <h2 id={`${titleId}-activity`} data-copy-role="heading">{copy.activity}</h2>
          {typeof segment.segment.prompt === 'string' ? <p data-copy-role="data">{segment.segment.prompt}</p> : null}
          <p data-copy-role="body">{copy.activityAnswer}</p>
        </section>
        : null;
  const composeEl = fieldShown
            ? <form className="lf-mentor-compose" onSubmit={submit}>
              <TextField label={session.phase === 'openings' ? copy.askLabel : copy.replyLabel} value={draft} autoComplete="off"
                disabled={busy} onChange={(event) => setDraft(event.target.value)} />
              <div className="lf-mentor-compose-actions">
                <IconButton glyph="send" label={copy.send} type="submit" variant="soft" disabled={busy || !drafting} />
                {session.mic.present
                  ? <IconButton glyph="microphone" label={micLabel} variant={session.mic.recording ? 'inverse' : 'soft'}
                    data-mic={session.mic.recording ? 'recording' : session.speaking ? 'interrupt' : 'idle'}
                    disabled={busy || (session.phase === 'openings' && !canStart)} onClick={session.pressMic} />
                  : null}
              </div>
            </form>
            : session.phase === 'openings' && session.mic.present && canStart
              ? <div className="lf-mentor-compose-actions">
                <IconButton glyph="microphone" label={copy.talk} variant="soft" onClick={session.pressMic} />
              </div>
              : null;
  // 08 §9: the chips lead for 6-12, the field leads for 13 and older, in the DOM (and so the Tab order), not only visually.
  const fieldFirst = session.ageBand === '13-17' || session.ageBand === 'adult';
  const responseEl = session.phase !== 'closing'
        ? <section className="lf-mentor-response" ref={response}>
          {session.phase === 'calibration'
            ? <MentorCalibration copy={all.mentorCalibration} locale={locale} dark={dark} error={session.calibrationError}
              state={session.calibrationSaving ? 'saving' : 'form'} onChoose={session.chooseCalibration} onRetry={session.retry} />
            : null}
          {session.phase === 'unavailable' || (session.phase === 'openings' && offers && !offers.canStart && !limited)
            ? <div className="lf-mentor-chips"><Button variant="accent" onClick={session.retry}>{copy.retry}</Button></div>
            : null}

          {fieldFirst ? composeEl : null}

          {session.phase === 'openings' && offers && canStart
            ? <div className="lf-mentor-chips" role="group" aria-label={copy.openingsLabel}>
              {openingsFor(offers, copy).map((opening) => <ReplyChip key={opening.id} data-opening={opening.id}
                disabled={session.starting} onPress={() => session.start(opening.input)}>{opening.label}</ReplyChip>)}
            </div>
            : null}

          {session.phase === 'conversing' && live.adaptationOffer
            ? <div className="lf-mentor-offer">
              <p className="lf-mentor-offer-question" data-copy-role="prompt">{copy.adaptation[live.adaptationOffer]}</p>
              <div className="lf-mentor-chips" role="group" aria-label={copy.adaptation[live.adaptationOffer]}>
                <ReplyChip data-adaptation="yes" onPress={() => live.answerAdaptation(live.adaptationOffer!, true)}>{copy.yes}</ReplyChip>
                <ReplyChip data-adaptation="no" onPress={() => live.answerAdaptation(live.adaptationOffer!, false)}>{copy.no}</ReplyChip>
              </div>
            </div>
            : session.phase === 'conversing' && live.sessionEndOffer
              ? <SessionEndChoice copy={all.mentorSessionEnd} locale={locale} dark={dark} onChoose={live.answerSessionEnd} />
              : session.phase === 'conversing' && live.goalCheckOpen
                ? <GoalCheckChoice copy={all.mentorGoalCheck} locale={locale} dark={dark} onAnswer={live.answerGoal} />
                : session.phase === 'conversing' && live.checkInOpen
                  ? <CheckInChoice copy={all.mentorCheckIn} locale={locale} dark={dark} onAnswer={live.answerCheckIn} />
                  : null}

          {ladder || (board && !boardOpen && session.phase === 'conversing')
            ? <div className="lf-mentor-chips" role="group" aria-label={copy.replyChips}>
              {ladder ? <ReplyChip data-ladder="hint" onPress={() => session.sendText(copy.hint)}>{copy.hint}</ReplyChip> : null}
              {ladder ? <ReplyChip data-ladder="tell" onPress={() => session.sendText(copy.tell)}>{copy.tell}</ReplyChip> : null}
              {board && !boardOpen ? <ReplyChip data-board-show="" onPress={() => setBoardOpen(true)}>{copy.showBoard}</ReplyChip> : null}
            </div>
            : null}

          {fieldFirst ? null : composeEl}

          {session.mic.recording ? <MicLevel microphone={session.mic.microphone} label={copy.listening} /> : null}
          {startRefusal ? <InlineNotice tone="error" live>{startRefusal}</InlineNotice> : null}
          {liveError ? <InlineNotice tone="error" live>{liveError}</InlineNotice> : null}
          {session.phase === 'conversing' && session.replyTimedOut ? <InlineNotice tone="info" live>{copy.replyTimeout}</InlineNotice> : null}
          {session.phase === 'conversing' && live.budget === 'wrapping' ? <InlineNotice tone="info">{copy.wrapping}</InlineNotice> : null}
          {session.phase === 'openings' && offers?.intelDegraded ? <InlineNotice tone="info">{copy.noProgress}</InlineNotice> : null}
          {blockedLine && (session.phase === 'openings' ? canStart : true) ? <InlineNotice tone="info">{blockedLine}</InlineNotice> : null}
          {session.mic.denied ? <InlineNotice tone="info">{copy.micDenied}</InlineNotice> : null}
        </section>
        : null;

  return <div ref={root} className="lf-mentor-screen" data-shell="mentor" data-phase={session.phase} data-age-band={session.ageBand}
    data-layout={split ? 'split' : 'stacked'} data-board={boardOpen && board ? 'open' : 'closed'}>
    <header className="lf-mentor-top">
      <IconButton glyph="close" label={copy.close} onClick={close} disabled={session.ending} />
      <h1 id={titleId} className="lf-mentor-title" data-copy-role="data">{title}</h1>
      <Menu label={copy.menuLabel} items={menuItems}
        trigger={(props) => <IconButton glyph="menu" label={copy.menu} {...props} />} />
    </header>
    <main className="lf-mentor-main" aria-labelledby={titleId}>
      <div className="lf-mentor-stage-region">
        {session.known ? <MentorStage character={session.character} state={state} board={boardOpen && board !== null && !split} ageBand={session.ageBand}
          theme={theme} scene={session.scene} closing={session.closing?.script ?? null} copy={all.mentorStage}
          beat={session.audioKey} speechUrl={session.speechUrl} audioKey={session.audioKey}
          onSpeechEnd={session.onSpeechEnd} onSpeechBlocked={session.onSpeechBlocked} /> : <div className="lf-mentor-stage-empty" aria-hidden="true" />}
        {!split && !boardShown && session.phase !== 'closing' ? <div className="lf-mentor-plate-slot">{plate}</div> : null}
        {!split && boardShown ? boardEl : null}
      </div>
      <div className="lf-mentor-panel">
        {(split || boardShown) && session.phase !== 'closing' ? plate : null}
        {split ? boardEl : null}
        {activityEl}
        {closingEl}
        {responseEl}
      </div>

    </main>

    <Sheet open={sheet === 'transcript'} onClose={() => setSheet(null)} heading={copy.transcript} closeLabel={copy.sheetClose}>
      {session.history.length === 0
        ? <p data-copy-role="body">{copy.transcriptEmpty}</p>
        : <ol className="lf-mentor-transcript">
          {session.history.map((line, index) => <li key={`${line.seq}-${index}`} data-speaker={line.speaker}>
            <span className="lf-mentor-transcript-speaker" data-copy-role="data">{line.speaker === 'tutor' ? name : copy.you}</span>
            <p data-copy-role="data">{line.text}</p>
          </li>)}
        </ol>}
    </Sheet>
    <Sheet open={sheet === 'grownUp'} onClose={() => setSheet(null)} heading={copy.grownUp} closeLabel={copy.sheetClose}>
      <p data-copy-role="body">{copy.grownUpBody}</p>
    </Sheet>
    <Sheet open={sheet === 'chooser'} onClose={() => setSheet(null)} heading={copy.chooser.heading} closeLabel={copy.sheetClose}>
      <List label={copy.chooser.heading}>
        {MENTOR_CHARACTERS.map((character) => {
          const render = findMentorAvatar(character, theme);
          const current = character === session.character;
          return <ListRow key={character} title={MENTOR_NAMES[character]} titleRole="data" supporting={copy.chooser.lines[character]}
            leading={render ? <MentorAvatar renderId={render} label={null} size="md" /> : null}
            trailing={current ? <Pill tone="primary">{copy.chooser.chosen}</Pill>
              : choosing === character ? <Pill tone="sky">{copy.chooser.saving}</Pill> : null}
            onPress={choosing ? undefined : () => void choose(character)} />;
        })}
      </List>
      {chooseFailed ? <InlineNotice tone="error" live>{copy.chooser.failed}</InlineNotice> : null}
    </Sheet>
  </div>;
}
