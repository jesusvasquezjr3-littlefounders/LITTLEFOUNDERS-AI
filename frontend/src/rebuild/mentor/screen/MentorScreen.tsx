import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { copyLimit, wordCount, type AgeBand, type Locale } from '../../design/copyBudget';
import {
  Banner, Button, ConfirmDialog, IconButton, InlineNotice, Menu, MENTOR_NAMES, ReplyChip, RewardChip, Sheet, TextField,
  type MentorCharacter, type MenuItem,
} from '../../design/controls';
import { MENTOR_CHARACTERS } from '../../design/assets';
import { MentorChooser } from '../MentorChooser';
import { MentorCalibration, type MentorCalibrationCopy } from '../../identity/MentorCalibration';
import { MentorStage, type MentorCompanionPose, type MentorStageCopy, type MentorStageLight, type MentorStageScene } from '../MentorStage';
import { AllianceCheck, type AllianceCheckCopy, type AllianceCheckResult } from '../AllianceCheck';
import type { BondProxyAnswer } from '../allianceApi';
import { CheckInChoice, type CheckInCopy } from '../CheckIn';
import { GoalCheckChoice, type GoalCheckCopy } from '../GoalCheck';
import { SessionClosing, SessionEndChoice, type SessionEndCopy } from '../SessionEnd';
import type { MentorStageState } from '../stageStates';
import type { MicBlockedReason } from '../session/micForPhase';
import type { StartSessionInput } from '../session/tutorApi';
import type { Adaptation, BudgetState, SessionSummary, TutorCatalog, TutorOffers, TutorPreferences, TutorWhiteboardWire } from '../session/types';
import { isRoleplayScene } from '../session/roleplay';
import { REPLY_CHIP_MAX, type LiveSegmentState, type TutorTurnState } from '../session/useTutorSocket';
import type { Microphone } from '../session/useMicrophone';
import type { MentorClosing, MentorPhase } from './useMentorSession';
import { MentorBoard, type MentorBoardCopy } from './MentorBoard';
import { speechPages } from './speechPages';
import type { MentorData } from './mentorData';
import {
  fill, HistoryView, KeepBoard, LearningMapView, NotebookView, PersonaliseView,
  type MentorHistoryCopy, type MentorMapCopy, type MentorNotebookCopy, type MentorPersonaliseCopy,
} from './MentorViews';
import type { MentorDecisionsCopy } from '../MentorDecisions';
import { replayBeats, replayHasSound, type ReplayBeat } from './replayModel';
import { useReplay } from './useReplay';
import { useRoleplay } from './useRoleplay';
import { LiveActivity, type ActivityGrade, type ActivityOutcome, type MentorActivityCopy } from './LiveActivity';
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
 *
 * W2M.3 (T1a-T1g): the menu also opens the learner's own island (T1a), the
 * learning map (T1f), the notebook (T1g) and past talks (T1e), each a
 * secondary sheet; a past talk replays ON THE STAGE, the character performing
 * each saved line with its board, never a list of bubbles. A board can be kept
 * in the notebook. A roleplay scene the Mentor names plays beat by beat in the
 * plate, the companion the learner invited speaking its part beside the
 * Mentor. A first visit opens the chooser once (08 §8: the learner chooses).
 *
 * W2M.4 (T1c, T1d, OD-28): a live activity is drawn with the 02 controls and
 * graded by Core; "say it another way", "change my last message" and "start
 * over" are back; the lesson's step is said in words; pressing close asks the
 * recap question first, and a second press leaves. There is no minutes-left
 * clock: a countdown on a learner surface is a dark pattern (DP-01), so the
 * gentle "almost done" notice is the only word about time.
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
  reconnecting: string; replyTimeout: string; wrapping: string;
  showBoard: string; hideBoard: string;
  explain: string; step: string; finishNow: string; editLast: string; editLabel: string; editCancel: string;
  startOver: string; startOverHeading: string; startOverBody: string; keepGoing: string; savedReplay: string;
  right: string; together: string; xp: string; noXp: string;
  chooser: { heading: string; chosen: string; saving: string; failed: string; lines: Record<MentorCharacter, string> };
  board: MentorBoardCopy;
  activityUi: MentorActivityCopy;
}

export interface MentorReplayCopy {
  loading: string; failed: string; empty: string; notLive: string; noSound: string; position: string; play: string; pause: string;
  previous: string; next: string; fromStart: string; talk: string; ended: string; note: string; activity: string; scored: string; unanswered: string;
}
export interface MentorRoleplayCopy { customer: string; scenes: Record<string, { title: string; beats: string[] }> }

export interface MentorCopy {
  mentorScreen: MentorScreenCopy;
  mentorPersonalise: MentorPersonaliseCopy;
  mentorMap: MentorMapCopy;
  mentorDecisions: MentorDecisionsCopy;
  mentorNotebook: MentorNotebookCopy;
  mentorHistory: MentorHistoryCopy;
  mentorReplay: MentorReplayCopy;
  mentorRoleplay: MentorRoleplayCopy;
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
  /** V4: the lesson thread (step N of M); null in an open conversation. */
  lesson: { topic: string | null; step: number; of: number } | null;
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
  /** The session speaks: Core allowed voice for it (the roleplay clips play only then). */
  voice: boolean;
  /** The friend the learner invited to the island (T1a), never the Mentor itself. */
  companion: MentorCharacter | null;
  light: MentorStageLight;
  nickname: string | null;
  /** What Core holds for the learner's island (T1a), once read. */
  preferences: TutorPreferences | null;
  catalog: TutorCatalog | null;
  /** False until the learner has saved any choice: the first visit opens the chooser once (08 §8). */
  personalized: boolean;
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
  /** OD-28 (M-04): the learner pressed close and the Mentor asked the recap question; a second press leaves. */
  recapOpen: boolean;
  mic: { present: boolean; blockedBy: MicBlockedReason | null; denied: boolean; recording: boolean; microphone: Pick<Microphone, 'subscribe'> };
  retry: () => void;
  chooseCalibration: (tier: 1 | 2 | 3) => void;
  start: (input: Omit<StartSessionInput, 'wantsVoice'>) => void;
  sendText: (text: string) => void;
  pressMic: () => void;
  endSession: () => void;
  /** T1c "start over": the conversation closes at once and the openings come back. */
  restart: () => void;
  /** T1c: rephrase the learner's last message. */
  editLast: (text: string) => void;
  /** T1c: Core grades a live activity (null when the check itself failed). */
  gradeActivity: (segmentId: string, answer: unknown, attempt: number) => Promise<ActivityGrade | null>;
  /** T1c: a finished activity goes to Oracle, and the Mentor reacts to it. */
  reportActivity: (outcome: ActivityOutcome) => void;
  chooseCharacter: (character: MentorCharacter) => Promise<boolean>;
  /** Saves a T1a choice to Core; resolves false when Core refused it (nothing changes). */
  updatePreferences: (patch: Partial<TutorPreferences>) => Promise<boolean>;
  /** Keeps the current conversation's board of turn `seq` in the notebook (T1g). */
  keepBoard: (seq: number) => Promise<boolean>;
  /** The learning map, the notebook and past talks (T1e-T1g). */
  data: MentorData;
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
  initialSheet?: MentorSheet | null;
  /** A past talk replaying from the first render (the development preview and its audits). */
  initialReplay?: { summary: SessionSummary; beats: ReplayBeat[] } | null;
  /** Hold a roleplay scene on its current beat (the development preview and its audits). */
  roleplayFrozen?: boolean;
}

export type MentorSheet = 'transcript' | 'grownUp' | 'chooser' | 'personalise' | 'map' | 'notebook' | 'history';


interface Opening { id: string; label: string; input: Omit<StartSessionInput, 'wantsVoice'> }

/** 2-3 openings (08 §2 layer 5): where the learner left off first, one flagged skill as an offer, then the course and a curated question. */
export function openingsFor(offers: TutorOffers, copy: MentorScreenCopy, context?: { locale: Locale; ageBand: AgeBand }): Opening[] {
  /*
   * W3M.1 (08 §2 layer 5, 06): a chip is an `option`, at most 8 words (5 for ages 6-9). A topic title comes from
   * the catalogue and can be long; a chip it would overflow says the generic line instead (never cut, 02 D1).
   */
  const limit = context ? copyLimit('option', { ...context, surface: 'app' }) : null;
  const named = (template: string, topic: string, generic: string) => {
    const label = fill(template, { topic });
    return limit !== null && wordCount(label) > limit ? generic : label;
  };
  const list: Opening[] = [];
  const last = offers.lastSession;
  if (last && (last.topic || last.skillKey)) {
    // A topic Core could not name is never shown as its internal key (an English slug in every language).
    list.push({ id: 'continue', label: last.topic ? named(copy.continue, last.topic, copy.continueGeneric) : copy.continueGeneric,
      input: last.courseId || last.topicId ? { intent: 'course_topic', courseId: last.courseId, topicId: last.topicId } : { intent: 'weak_skill', skillKey: last.skillKey } });
  }
  const weak = offers.weakSkills[0];
  if (weak) list.push({ id: 'weak_skill', label: weak.title ? named(copy.practise, weak.title, copy.practiseSkill) : copy.practiseSkill,
    input: { intent: 'weak_skill', skillKey: weak.skillKey, courseId: weak.courseId, topicId: weak.topicId } });
  else list.push({ id: 'diagnostic', label: copy.diagnostic, input: { intent: 'diagnostic' } });
  list.push({ id: 'course_topic', label: copy.courseTopic, input: { intent: 'course_topic' } });
  const faq = offers.faqIds.find((id) => copy.faq[id]);
  if (faq) list.push({ id: `faq:${faq}`, label: copy.faq[faq]!, input: { intent: 'faq', skillKey: faq } });
  return list.slice(0, 3);
}

/** The state the character plays (08 §3), from what the session is doing. The UI requests it; the stage never fakes it. */
export function stageStateFor(session: MentorScreenSession, { board, delivering, drafting, missed = false }: {
  board: boolean; delivering: boolean; drafting: boolean;
  /** The learner's last activity was a miss (T1c): the Mentor meets it warmly (08 §3, B.26). */
  missed?: boolean;
}): MentorStageState {
  if (session.phase === 'closing') return 'closing';
  if (session.phase !== 'conversing') return drafting ? 'listening' : 'idle';
  if (session.mic.recording || drafting) return 'listening';
  if (session.awaitingReply || session.socket.thinking) return 'thinking';
  if (session.speaking || delivering) return board ? 'demonstrating' : 'speaking';
  // 08 §3: encouraging after a miss, or while offering a guided review (C.15, D9); never disappointment.
  if (session.turn?.emotion === 'encouraging' || session.socket.adaptationOffer !== null || missed) return 'encouraging';
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

/** 08 §3, §5: while the Mentor speaks, each caption page stays up about as long as it takes to say it (a child's pace). */
export const CAPTION_MS_PER_WORD = 400;
export const CAPTION_MIN_PAGE_MS = 1500;
export function captionPageMs(page: string): number {
  return Math.max(CAPTION_MIN_PAGE_MS, page.split(/\s+/u).filter(Boolean).length * CAPTION_MS_PER_WORD);
}

function SpeechPlate({ text, locale, ageBand, copy, status, speaker = null, pageMs = null, paced = false }: {
  text: string | null; locale: Locale; ageBand: AgeBand; copy: MentorScreenCopy; status: string | null;
  /** Who is speaking, when it is not the Mentor's own live turn (a roleplay beat, a replayed line). */
  speaker?: string | null;
  /** Turn the caption's pages by themselves every `pageMs` (a roleplay beat plays without a Next press). */
  pageMs?: number | null;
  /**
   * The Mentor is saying this turn aloud: the caption follows the voice (08 §3 "the speech plate text shown as it
   * is spoken"), each page held for its own length and settling on the last; Next still moves on sooner.
   */
  paced?: boolean;
}) {
  const pages = useMemo(() => (text ? speechPages(text, locale, ageBand) : []), [text, locale, ageBand]);
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [text]);
  useEffect(() => {
    if (page >= pages.length - 1) return undefined;
    const hold = pageMs ?? (paced ? captionPageMs(pages[page] ?? '') : null);
    if (!hold) return undefined;
    const timer = window.setTimeout(() => setPage((n) => n + 1), hold);
    return () => window.clearTimeout(timer);
  }, [pageMs, paced, page, pages]);
  const shown = status ?? pages[Math.min(page, pages.length - 1)] ?? null;
  if (shown === null) return null;
  const more = status === null && !pageMs && page < pages.length - 1;
  return <section className="lf-mentor-plate" data-plate={status !== null ? 'status' : speaker ? 'line' : 'turn'} data-pages={pages.length || undefined}>
    {speaker && status === null ? <p className="lf-mentor-plate-speaker" data-copy-role="data">{speaker}</p> : null}
    <p className="lf-mentor-plate-text" data-copy-role="mentor" aria-live="polite">{shown}</p>
    {more ? <Button size="sm" variant="sky" className="lf-mentor-plate-next" onClick={() => setPage((n) => n + 1)}>{copy.nextLine}</Button> : null}
  </section>;
}

const isCharacter = (value: unknown): value is MentorCharacter => (MENTOR_CHARACTERS as readonly unknown[]).includes(value);

interface ReplayState { summary: SessionSummary; beats: ReplayBeat[] | null; failed: boolean }
/** One empty talk for every render without a replay: the clock restarts only when the talk itself changes. */
const NO_BEATS: readonly ReplayBeat[] = [];

/** A past talk on the stage (T1e): its transport, in the response area. */
function ReplayControls({ copy, clock, total, sound, name, onTalk }: {
  copy: MentorReplayCopy; clock: ReturnType<typeof useReplay>; total: number; sound: boolean; name: string; onTalk: () => void;
}) {
  return <div className="lf-mentor-replay" data-replay={clock.ended ? 'ended' : clock.playing ? 'playing' : 'paused'}>
    <InlineNotice tone="info">{fill(copy.notLive, { name })}</InlineNotice>
    {!sound ? <p data-copy-role="body">{copy.noSound}</p> : null}
    <p className="lf-mentor-replay-position" data-copy-role="data" aria-live="polite">
      {fill(copy.position, { current: clock.index + 1, total })}</p>
    <div className="lf-mentor-replay-transport" role="group" aria-label={copy.position.split('{')[0]!.trim() || copy.play}>
      <IconButton glyph="chevron" label={copy.previous} variant="soft" className="lf-mentor-replay-previous"
        disabled={clock.index === 0} onClick={clock.previous} />
      {clock.playing
        ? <IconButton glyph="pause" label={copy.pause} variant="inverse" data-transport="pause" onClick={clock.pause} />
        : <IconButton glyph="play" label={copy.play} variant="inverse" data-transport="play" onClick={clock.play} />}
      <IconButton glyph="chevron" label={copy.next} variant="soft" disabled={clock.index >= total - 1} onClick={clock.next} />
    </div>
    <div className="lf-mentor-chips">
      <Button variant="secondary" onClick={clock.restart}>{copy.fromStart}</Button>
      <Button variant="accent" onClick={onTalk}>{copy.talk}</Button>
    </div>
    {clock.ended ? <InlineNotice tone="info" live>{copy.ended}</InlineNotice> : null}
  </div>;
}

export function MentorScreen({ session, copy: all, locale, theme, guardianLink, onLeave, onPath, initialSheet = null, initialReplay = null, roleplayFrozen = false }: MentorScreenProps) {
  const copy = all.mentorScreen;
  const dark = theme === 'dark';
  const root = useRef<HTMLDivElement>(null);
  const split = useSplitLayout(root);
  const response = useRef<HTMLElement>(null);
  useResponseBlock(root, response);
  const titleId = useId();
  const [draft, setDraft] = useState('');
  const [sheet, setSheet] = useState<MentorSheet | null>(initialSheet);
  const [choosing, setChoosing] = useState<MentorCharacter | null>(null);
  const [chooseFailed, setChooseFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  /** The last finished activity's result, shown until the next activity or the learner's next word (T1c). */
  const [activityResult, setActivityResult] = useState<ActivityOutcome | null>(null);
  const turn = session.phase === 'conversing' ? session.turn : null;

  /* T1e: a past talk replaying on the stage, outside any conversation. */
  const [replay, setReplay] = useState<ReplayState | null>(initialReplay ? { ...initialReplay, failed: false } : null);
  const replayOn = replay !== null && session.phase !== 'conversing';
  const clock = useReplay(replay?.beats ?? NO_BEATS);
  const beat = replayOn ? clock.beat : null;
  const openReplay = (summary: SessionSummary) => {
    setSheet(null);
    setReplay({ summary, beats: null, failed: false });
    void session.data.transcript(summary.id).then((transcript) => {
      setReplay((current) => (current?.summary.id !== summary.id ? current
        : transcript ? { summary, beats: replayBeats(transcript), failed: false } : { summary, beats: null, failed: true }));
    });
  };
  useEffect(() => { if (session.phase === 'conversing') setReplay(null); }, [session.phase]);

  const character = replayOn && isCharacter(replay.summary.character) ? replay.summary.character : session.character;
  const name = MENTOR_NAMES[character];
  const title = session.known || replayOn ? name : copy.documentTitle;

  /* 08 §8: the first visit opens the chooser once; closing it keeps (and records) the character shown. */
  const firstVisit = useRef(false);
  useEffect(() => {
    if (firstVisit.current || !session.known || session.personalized || session.phase !== 'openings' || initialSheet) return;
    firstVisit.current = true;
    setSheet('chooser');
  }, [session.known, session.personalized, session.phase, initialSheet]);

  /* The board: open when a turn draws one, closable, and reopenable until the next board replaces it. */
  const [board, setBoard] = useState<{ seq: number; wire: TutorWhiteboardWire } | null>(null);
  const [boardOpen, setBoardOpen] = useState(false);
  useEffect(() => {
    if (turn?.whiteboard) { setBoard({ seq: turn.seq, wire: turn.whiteboard }); setBoardOpen(true); }
  }, [turn?.seq, turn?.whiteboard]);
  useEffect(() => { if (session.phase !== 'conversing') { setBoard(null); setBoardOpen(false); } }, [session.phase]);
  const segment = session.phase === 'conversing' ? session.socket.segment : null;
  /* An edit targets "the last message": a new turn or an activity makes it stale (the words stay in the field). */
  useEffect(() => { setEditing(false); }, [turn?.seq, segment?.segmentId]);
  useEffect(() => { if (segment || session.phase !== 'conversing') setActivityResult(null); }, [segment?.segmentId, session.phase]);

  /* A turn without a voice is still delivered: the speaking pose for about the time it takes to read it. */
  const [delivering, setDelivering] = useState(false);
  useEffect(() => {
    if (!turn || turn.audioUrl || turn.audioPending) { setDelivering(false); return undefined; }
    setDelivering(true);
    const words = turn.text.split(/\s+/).length;
    const timer = window.setTimeout(() => setDelivering(false), Math.min(6000, 1200 + words * 300));
    return () => window.clearTimeout(timer);
  }, [turn?.seq, turn?.audioUrl, turn?.audioPending]);

  /* A roleplay scene the turn names plays once the Mentor has introduced it (Class III `roleplay`). */
  const roleplay = useRoleplay({
    active: session.phase === 'conversing', scene: turn?.roleplayScene, turnSeq: turn?.seq ?? 0,
    waiting: session.speaking || delivering, lead: session.character, companion: session.companion, locale,
    voice: session.voice, frozen: roleplayFrozen,
  });
  const roleplayCopy = roleplay && isRoleplayScene(roleplay.scene) ? all.mentorRoleplay.scenes[roleplay.scene] : null;

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

  const replayState: MentorStageState = !beat || !clock.playing ? 'idle'
    : beat.kind === 'mentor' ? (beat.whiteboard ? 'demonstrating' : 'speaking') : beat.kind === 'learner' ? 'listening' : 'idle';
  const state: MentorStageState = replayOn ? replayState
    : roleplay ? (roleplay.beat.speaker === 'lead' ? 'speaking' : 'listening')
      : stageStateFor(session, { board: boardOpen && board !== null, delivering, drafting, missed: activityResult !== null && !activityResult.correct });
  const companionPose: MentorCompanionPose | null = roleplay && roleplay.beat.speaker === 'companion' && roleplay.speaker
    ? { emotion: roleplay.beat.emotion, action: roleplay.beat.action, beat: roleplay.index + 1 } : null;
  const offers = session.offers;
  const limited = session.startError === 'SESSION_LIMIT' || offers?.startBlockedBy === 'SESSION_LIMIT';
  const canStart = !!offers?.canStart && !limited && !session.starting;

  const plateText: string | null = (() => {
    if (replayOn) {
      if (!replay.beats) return replay.failed ? all.mentorReplay.failed : all.mentorReplay.loading;
      if (!beat) return all.mentorReplay.empty;
      if (beat.kind === 'activity') return beat.prompt || all.mentorReplay.activity;
      return beat.text;
    }
    if (roleplay && roleplayCopy) return roleplayCopy.beats[roleplay.index] ?? null;
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
  const plateSpeaker = replayOn && beat
    ? (beat.kind === 'mentor' ? name : beat.kind === 'learner' ? copy.you : beat.kind === 'note' ? all.mentorReplay.note : all.mentorReplay.activity)
    : roleplay && roleplayCopy
      ? `${roleplayCopy.title} · ${roleplay.speaker ? MENTOR_NAMES[roleplay.speaker] : all.mentorRoleplay.customer}` : null;
  const plateStatus = session.phase === 'conversing' && !roleplay
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
  const between = session.phase === 'conversing' && !offerOpen && !!turn && !session.awaitingReply && !session.ending && !roleplay && !session.recapOpen;
  const ladder = between && turn!.next === 'ask';
  // "Say it another way" (T1c): once the lesson is under way, never over a board or an activity.
  const explain = between && turn!.seq > 1 && !boardOpen && !segment;
  const boardChip = !!board && !boardOpen && session.phase === 'conversing' && !session.recapOpen;
  /*
   * 08 §2 layer 5, §4, §9 (GAP-FIX-R2): the likely answers the Mentor's turn offers (`turn.replies`, already
   * screened by Oracle), sent as the learner's own words. They come before the hint ladder, so a 6-9 learner
   * without a microphone taps an answer instead of typing it.
   */
  const replies = between && turn!.next === 'ask' ? turn!.replies : [];
  // 08 §2: at most three reply chips; the board comes back first, then the likely answers, then the hint ladder, then another way.
  const chips = ([
    boardChip ? { id: 'board', label: copy.showBoard, onPress: () => setBoardOpen(true) } : null,
    ...replies.map((reply, index) => ({ id: `reply-${index}`, label: reply, onPress: () => say(reply) })),
    ladder ? { id: 'hint', label: copy.hint, onPress: () => say(copy.hint) } : null,
    ladder ? { id: 'tell', label: copy.tell, onPress: () => say(copy.tell) } : null,
    explain ? { id: 'explain', label: copy.explain, onPress: () => say(copy.explain) } : null,
  ].filter(Boolean) as { id: string; label: string; onPress: () => void }[]).slice(0, REPLY_CHIP_MAX);

  function say(text: string) {
    setActivityResult(null);
    session.sendText(text);
  }
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    setActivityResult(null);
    // Never rewind the conversation while an activity or a board is on screen: the words go as a new message.
    if (editing && !segment && !boardOpen) session.editLast(draft); else session.sendText(draft);
    setEditing(false);
    setDraft('');
  };
  const lastLearnerIndex = session.phase === 'conversing' ? session.history.map((line) => line.speaker).lastIndexOf('learner') : -1;
  const canEdit = lastLearnerIndex >= 0 && !segment && !boardOpen && !session.awaitingReply && !session.ending && !session.recapOpen && !replayOn;
  const beginEdit = (text: string) => { setSheet(null); setDraft(text); setEditing(true); };
  const fieldShown = session.phase === 'conversing' || (session.phase === 'openings' && !!offers?.canAskOpen && canStart);
  const busy = session.phase === 'conversing' && (session.ending || session.resuming);

  /* The menu (08 §2 layer 1): what the learner can open from here, by what is happening. */
  const outside = session.known && (session.phase === 'openings' || session.phase === 'closing') && !replayOn;
  const reading = session.known && (outside || session.phase === 'conversing') && !replayOn;
  const open = (next: MentorSheet) => () => { if (next === 'chooser') setChooseFailed(false); setSheet(next); };
  const menuItems: MenuItem[] = [
    ...(outside ? [{ id: 'change', label: copy.changeMentor, onSelect: open('chooser') }] : []),
    ...(outside && session.preferences ? [{ id: 'personalise', label: all.mentorPersonalise.menu, onSelect: open('personalise') }] : []),
    ...(reading ? [{ id: 'map', label: all.mentorMap.menu, onSelect: open('map') }, { id: 'notebook', label: all.mentorNotebook.menu, onSelect: open('notebook') }] : []),
    ...(outside ? [{ id: 'history', label: all.mentorHistory.menu, onSelect: open('history') }] : []),
    { id: 'transcript', label: copy.transcript, onSelect: open('transcript') },
    ...(session.phase === 'conversing' && !replayOn && !session.ending ? [{ id: 'start-over', label: copy.startOver, onSelect: () => setConfirmRestart(true) }] : []),
    ...(guardianLink ? [{ id: 'grown-up', label: copy.grownUp, onSelect: open('grownUp') }] : []),
  ];

  const close = () => {
    if (replayOn) { setReplay(null); return; }
    if (session.phase === 'conversing') session.endSession(); else onLeave();
  };

  const closeSheet = () => {
    // A first visit that closes the chooser without a pick keeps the character shown, and records that it was offered.
    if (sheet === 'chooser' && !session.personalized && !choosing) void session.chooseCharacter(session.character);
    setSheet(null);
  };

  const choose = async (next: MentorCharacter) => {
    if (next === session.character) { if (!session.personalized) void session.chooseCharacter(next); setSheet(null); return; }
    setChoosing(next);
    setChooseFailed(false);
    const saved = await session.chooseCharacter(next);
    setChoosing(null);
    if (saved) setSheet(null); else setChooseFailed(true);
  };

  const startFromMap = (skillKey: string | null) => {
    setSheet(null);
    session.start(skillKey ? { intent: 'weak_skill', skillKey } : { intent: 'open' });
  };

  const micLabel = session.mic.recording ? copy.stopTalking : session.speaking ? copy.interrupt : copy.talk;
  const blockedLine = session.mic.blockedBy === 'CONSENT_REQUIRED' || session.mic.blockedBy === 'POLICY_BLOCKED'
    ? copy.micBlocked[session.mic.blockedBy] : null;

  const plate = <SpeechPlate text={plateText} locale={locale} ageBand={session.ageBand} copy={copy} status={plateStatus}
    paced={replayOn ? clock.playing : !roleplay && session.phase === 'conversing' && session.speaking}
    speaker={plateSpeaker} pageMs={roleplay ? Math.max(1200, Math.floor(roleplay.holdMs / Math.max(1, speechPages(plateText ?? '', locale, session.ageBand).length))) : null} />;
  const replayBoard = replayOn && beat?.kind === 'mentor' ? beat.whiteboard : null;
  // A roleplay scene is the picture while it plays: an earlier board steps aside (and can be shown again after it).
  const boardShown = replayOn ? replayBoard !== null : !!board && boardOpen && session.phase === 'conversing' && !roleplay;
  const closingEl = session.phase === 'closing' && session.closing && !replayOn
    ? <div className="lf-mentor-closing" ref={response as React.RefObject<HTMLDivElement>}>
          <SessionClosing copy={all.mentorSessionEnd} locale={locale} dark={dark} script={session.closing.script}
            effort={session.closing.effort} topic={session.closing.topic} onBack={onPath} />
          {/* T1d: the talk is kept, and it can be heard again from past talks (never after a safety stop). */}
          {session.closing.sessionId && session.closing.script !== 'safety_stop' && session.history.length > 0
            ? <p className="lf-mentor-saved" data-copy-role="body">{copy.savedReplay}</p> : null}
          {session.closing.sessionId
            ? <AllianceCheck copy={all.mentorAllianceCheck} locale={locale} dark={dark} script={session.closing.script} onAnswer={session.answerAlliance} />
            : null}
        </div>
    : null;
  const boardEl = replayOn
    ? (replayBoard ? <div className="lf-mentor-board" key={beat?.id}>
        <MentorBoard board={replayBoard} copy={copy.board} locale={locale} />
      </div> : null)
    : board && boardShown
        ? <div className="lf-mentor-board" key={board.seq}>
          <MentorBoard board={board.wire} copy={copy.board} locale={locale} />
          <IconButton glyph="close" label={copy.hideBoard} variant="inverse" className="lf-mentor-board-hide" onClick={() => setBoardOpen(false)} />
          <KeepBoard copy={all.mentorNotebook} seq={board.seq} onKeep={session.keepBoard} />
        </div>
        : null;
  const activityEl = segment && !boardOpen
        ? <LiveActivity key={segment.segmentId} live={segment} copy={copy.activityUi} locale={locale} headingId={`${titleId}-activity`}
          grade={session.gradeActivity} onDone={(outcome) => { setActivityResult(outcome); session.reportActivity(outcome); }}
          demo={turn?.demonstrate ? { seq: turn.seq, steps: turn.demonstrate } : null} />
        : null;
  const resultEl = activityResult && session.phase === 'conversing'
    ? <div className="lf-mentor-activity-result" role="status">
      <Banner tone={activityResult.correct ? 'success' : 'retry'} live={false}>
        {[activityResult.correct ? copy.right : copy.together, activityResult.feedback].filter(Boolean).join(' ')}
      </Banner>
      {activityResult.xpAwarded > 0 ? <RewardChip>{fill(copy.xp, { n: activityResult.xpAwarded })}</RewardChip>
        : !activityResult.scoresXp ? <p data-copy-role="body">{copy.noXp}</p> : null}
    </div>
    : null;
  const replayActivity = replayOn && beat?.kind === 'activity'
    ? <p className="lf-mentor-replay-score" data-copy-role="body">{beat.score === null ? all.mentorReplay.unanswered : fill(all.mentorReplay.scored, { score: beat.score })}</p>
    : null;
  const composeEl = fieldShown
            ? <form className="lf-mentor-compose" onSubmit={submit} data-editing={editing ? '' : undefined}>
              <TextField label={session.phase === 'openings' ? copy.askLabel : editing ? copy.editLabel : copy.replyLabel} value={draft} autoComplete="off"
                disabled={busy} onChange={(event) => setDraft(event.target.value)} />
              <div className="lf-mentor-compose-actions">
                <IconButton glyph="send" label={copy.send} type="submit" variant="soft" disabled={busy || !drafting} />
                {session.mic.present
                  ? <IconButton glyph="microphone" label={micLabel} variant={session.mic.recording ? 'inverse' : 'soft'}
                    data-mic={session.mic.recording ? 'recording' : session.speaking ? 'interrupt' : 'idle'}
                    disabled={busy || (session.phase === 'openings' && !canStart)} onClick={session.pressMic} />
                  : null}
                {editing ? <Button size="sm" variant="secondary" onClick={() => { setEditing(false); setDraft(''); }}>{copy.editCancel}</Button> : null}
              </div>
            </form>
            : session.phase === 'openings' && session.mic.present && canStart
              ? <div className="lf-mentor-compose-actions">
                <IconButton glyph="microphone" label={copy.talk} variant="soft" onClick={session.pressMic} />
              </div>
              : null;
  // 08 §9: the chips lead for 6-12, the field leads for 13 and older, in the DOM (and so the Tab order), not only visually.
  const fieldFirst = session.ageBand === '13-17' || session.ageBand === 'adult';
  const responseEl = replayOn
    ? <section className="lf-mentor-response" ref={response}>
      {replayActivity}
      {replay.beats && replay.beats.length > 0
        ? <ReplayControls copy={all.mentorReplay} clock={clock} total={replay.beats.length} sound={replayHasSound(replay.beats)} name={name}
          onTalk={() => setReplay(null)} />
        : <div className="lf-mentor-chips"><Button variant="accent" onClick={() => setReplay(null)}>{all.mentorReplay.talk}</Button></div>}
    </section>
    : session.phase !== 'closing'
        ? <section className="lf-mentor-response" ref={response}>
          {resultEl}
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
              {openingsFor(offers, copy, { locale, ageBand: session.ageBand }).map((opening) => <ReplyChip key={opening.id} data-opening={opening.id}
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

          {session.phase === 'conversing' && session.recapOpen
            ? <div className="lf-mentor-chips" role="group" aria-label={copy.replyChips}>
              <ReplyChip data-finish-now="" onPress={session.endSession}>{copy.finishNow}</ReplyChip>
            </div>
            : chips.length > 0
              ? <div className="lf-mentor-chips" role="group" aria-label={copy.replyChips}>
                {chips.map((chip) => <ReplyChip key={chip.id} data-chip={chip.id} data-ladder={chip.id === 'hint' || chip.id === 'tell' ? chip.id : undefined}
                  data-board-show={chip.id === 'board' ? '' : undefined} data-reply={chip.id.startsWith('reply-') ? '' : undefined}
                  onPress={chip.onPress}>{chip.label}</ReplyChip>)}
              </div>
              : null}

          {fieldFirst ? null : composeEl}

          {session.mic.recording ? <MicLevel microphone={session.mic.microphone} label={copy.listening} /> : null}
          {startRefusal ? <InlineNotice tone="error" live>{startRefusal}</InlineNotice> : null}
          {liveError ? <InlineNotice tone="error" live>{liveError}</InlineNotice> : null}
          {session.phase === 'conversing' && session.replyTimedOut ? <InlineNotice tone="info" live>{copy.replyTimeout}</InlineNotice> : null}
          {session.phase === 'conversing' && live.budget === 'wrapping' ? <InlineNotice tone="info">{copy.wrapping}</InlineNotice> : null}
          {session.phase === 'conversing' && live.lesson && live.lesson.of > 1
            ? <p className="lf-mentor-step" data-copy-role="data">{fill(copy.step, { n: Math.min(live.lesson.step, live.lesson.of), total: live.lesson.of })}</p> : null}
          {session.phase === 'openings' && offers?.intelDegraded ? <InlineNotice tone="info">{copy.noProgress}</InlineNotice> : null}
          {blockedLine && (session.phase === 'openings' ? canStart : true) ? <InlineNotice tone="info">{blockedLine}</InlineNotice> : null}
          {session.mic.denied ? <InlineNotice tone="info">{copy.micDenied}</InlineNotice> : null}
        </section>
        : null;

  const stageScene: MentorStageScene = replayOn ? (replay.summary.diorama === 'diorama-b' ? 'diorama-b' : 'diorama-a') : session.scene;
  const stageCompanion = replayOn ? (isCharacter(replay.summary.companion) && replay.summary.companion !== character ? replay.summary.companion : null) : session.companion;
  const transcript = replayOn && replay.beats
    ? replay.beats.map((line, index) => ({ key: line.id, speaker: line.kind === 'mentor' ? name : line.kind === 'learner' ? copy.you
      : line.kind === 'note' ? all.mentorReplay.note : all.mentorReplay.activity, text: line.kind === 'activity' ? line.prompt : line.text, tutor: line.kind === 'mentor', index }))
    : session.history.map((line, index) => ({ key: `${line.seq}-${index}`, speaker: line.speaker === 'tutor' ? name : copy.you, text: line.text, tutor: line.speaker === 'tutor', index }));

  return <div ref={root} className="lf-mentor-screen" data-shell="mentor" data-phase={session.phase} data-age-band={session.ageBand}
    data-layout={split ? 'split' : 'stacked'} data-board={boardShown ? 'open' : 'closed'} data-replay={replayOn ? 'on' : undefined}
    data-roleplay={roleplay ? roleplay.scene : undefined}>
    <header className="lf-mentor-top">
      <IconButton glyph="close" label={copy.close} onClick={close} disabled={session.ending} />
      <h1 id={titleId} className="lf-mentor-title" data-copy-role="data">{title}</h1>
      <Menu label={copy.menuLabel} items={menuItems}
        trigger={(props) => <IconButton glyph="menu" label={copy.menu} {...props} />} />
    </header>
    <main className="lf-mentor-main" aria-labelledby={titleId}>
      <div className="lf-mentor-stage-region">
        {session.known || replayOn ? <MentorStage character={character} state={state} board={boardShown && !split} ageBand={session.ageBand}
          theme={theme} scene={stageScene} light={replayOn ? 'auto' : session.light} companion={stageCompanion} companionPose={companionPose}
          shot={roleplay && stageCompanion ? 'two-shot' : undefined}
          closing={replayOn ? null : session.closing?.script ?? null} copy={all.mentorStage}
          beat={replayOn ? clock.audioKey : session.audioKey} speechUrl={replayOn ? clock.speechUrl : session.speechUrl}
          audioKey={replayOn ? clock.audioKey : session.audioKey}
          onSpeechEnd={replayOn ? clock.onSpeechEnd : session.onSpeechEnd}
          onSpeechBlocked={replayOn ? clock.onSpeechBlocked : session.onSpeechBlocked} /> : <div className="lf-mentor-stage-empty" aria-hidden="true" />}
        {!split && !boardShown && (session.phase !== 'closing' || replayOn) ? <div className="lf-mentor-plate-slot">{plate}</div> : null}
        {!split && boardShown ? boardEl : null}
      </div>
      <div className="lf-mentor-panel">
        {(split || boardShown) && (session.phase !== 'closing' || replayOn) ? plate : null}
        {split ? boardEl : null}
        {replayOn ? null : activityEl}
        {closingEl}
        {responseEl}
      </div>

    </main>

    <Sheet open={sheet === 'transcript'} onClose={closeSheet} heading={copy.transcript} closeLabel={copy.sheetClose}>
      {transcript.length === 0
        ? <p data-copy-role="body">{copy.transcriptEmpty}</p>
        : <ol className="lf-mentor-transcript">
          {transcript.map((line) => <li key={line.key} data-speaker={line.tutor ? 'tutor' : 'learner'}>
            <span className="lf-mentor-transcript-speaker" data-copy-role="data">{line.speaker}</span>
            <p data-copy-role="data">{line.text}</p>
            {!replayOn && canEdit && line.index === lastLearnerIndex
              ? <Button size="sm" variant="secondary" data-edit-last="" onClick={() => beginEdit(line.text)}>{copy.editLast}</Button> : null}
          </li>)}
        </ol>}
    </Sheet>
    <ConfirmDialog open={confirmRestart} heading={copy.startOverHeading} consequence={copy.startOverBody} keepLabel={copy.keepGoing}
      confirmLabel={copy.startOver} onKeep={() => setConfirmRestart(false)}
      onConfirm={() => { setConfirmRestart(false); setActivityResult(null); setDraft(''); setEditing(false); session.restart(); }} />
    <Sheet open={sheet === 'grownUp'} onClose={closeSheet} heading={copy.grownUp} closeLabel={copy.sheetClose}>
      <p data-copy-role="body">{copy.grownUpBody}</p>
    </Sheet>
    <Sheet open={sheet === 'chooser'} onClose={closeSheet} heading={copy.chooser.heading} closeLabel={copy.sheetClose}>
      {/* 08 §8: the shared chooser, the four characters on their Diorama (also the onboarding's mentor step). */}
      <MentorChooser label={copy.chooser.heading} lines={copy.chooser.lines} chosen={session.character} saving={choosing}
        chosenLabel={copy.chooser.chosen} savingLabel={copy.chooser.saving} onChoose={(candidate) => void choose(candidate)} />
      {chooseFailed ? <InlineNotice tone="error" live>{copy.chooser.failed}</InlineNotice> : null}
    </Sheet>
    <Sheet open={sheet === 'personalise'} onClose={closeSheet} heading={all.mentorPersonalise.heading} closeLabel={copy.sheetClose}>
      {session.preferences ? <PersonaliseView copy={all.mentorPersonalise} catalog={session.catalog} preferences={session.preferences}
        character={session.character} onSave={session.updatePreferences} /> : null}
    </Sheet>
    <Sheet open={sheet === 'map'} onClose={closeSheet} heading={all.mentorMap.heading} closeLabel={copy.sheetClose}>
      <LearningMapView copy={all.mentorMap} decisionsCopy={all.mentorDecisions} locale={locale} data={session.data} canStart={session.phase === 'openings' && canStart}
        conversing={session.phase === 'conversing'} onStart={startFromMap} />
    </Sheet>
    <Sheet open={sheet === 'notebook'} onClose={closeSheet} heading={all.mentorNotebook.heading} closeLabel={copy.sheetClose}>
      <NotebookView copy={all.mentorNotebook} boardCopy={copy.board} data={session.data} locale={locale} />
    </Sheet>
    <Sheet open={sheet === 'history'} onClose={closeSheet} heading={all.mentorHistory.heading} closeLabel={copy.sheetClose}>
      <HistoryView copy={all.mentorHistory} data={session.data} locale={locale} theme={theme} onReplay={openReplay} />
    </Sheet>
  </div>;
}
