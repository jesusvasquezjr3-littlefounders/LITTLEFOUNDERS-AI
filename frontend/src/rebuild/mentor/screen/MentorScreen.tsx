import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { AgeBand, Locale } from '../../design/copyBudget';
import {
  Button, IconButton, InlineNotice, List, ListRow, Menu, MentorAvatar, MENTOR_NAMES, Pill, ReplyChip, Sheet, TextField,
  type MentorCharacter, type MenuItem,
} from '../../design/controls';
import { findMentorAvatar, MENTOR_CHARACTERS } from '../../design/assets';
import { findChooserStill } from '../stageStills';
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
import type { LiveSegmentState, TutorTurnState } from '../session/useTutorSocket';
import type { Microphone } from '../session/useMicrophone';
import type { MentorClosing, MentorPhase } from './useMentorSession';
import { MentorBoard, type MentorBoardCopy } from './MentorBoard';
import { speechPages } from './speechPages';
import type { MentorData } from './mentorData';
import {
  fill, HistoryView, KeepBoard, LearningMapView, NotebookView, PersonaliseView,
  type MentorHistoryCopy, type MentorMapCopy, type MentorNotebookCopy, type MentorPersonaliseCopy,
} from './MentorViews';
import { replayBeats, replayHasSound, type ReplayBeat } from './replayModel';
import { useReplay } from './useReplay';
import { useRoleplay } from './useRoleplay';
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

export interface MentorReplayCopy {
  loading: string; failed: string; empty: string; notLive: string; noSound: string; position: string; play: string; pause: string;
  previous: string; next: string; fromStart: string; talk: string; ended: string; note: string; activity: string; scored: string; unanswered: string;
}
export interface MentorRoleplayCopy { customer: string; scenes: Record<string, { title: string; beats: string[] }> }
export interface MentorVoiceConsentCopy {
  title: string; body: string; grant: string; revoke: string; activeSince: string; inactive: string; unavailable: string; pausedByPolicy: string;
  saving: string; failed: string; forChild: string; confirm: string; cancel: string; loading: string;
}

export interface MentorCopy {
  mentorScreen: MentorScreenCopy;
  mentorPersonalise: MentorPersonaliseCopy;
  mentorMap: MentorMapCopy;
  mentorNotebook: MentorNotebookCopy;
  mentorHistory: MentorHistoryCopy;
  mentorReplay: MentorReplayCopy;
  mentorRoleplay: MentorRoleplayCopy;
  mentorVoiceConsent: MentorVoiceConsentCopy;
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
  mic: { present: boolean; blockedBy: MicBlockedReason | null; denied: boolean; recording: boolean; microphone: Pick<Microphone, 'subscribe'> };
  retry: () => void;
  chooseCalibration: (tier: 1 | 2 | 3) => void;
  start: (input: Omit<StartSessionInput, 'wantsVoice'>) => void;
  sendText: (text: string) => void;
  pressMic: () => void;
  endSession: () => void;
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

function SpeechPlate({ text, locale, ageBand, copy, status, speaker = null, pageMs = null }: {
  text: string | null; locale: Locale; ageBand: AgeBand; copy: MentorScreenCopy; status: string | null;
  /** Who is speaking, when it is not the Mentor's own live turn (a roleplay beat, a replayed line). */
  speaker?: string | null;
  /** Turn the caption's pages by themselves every `pageMs` (a roleplay beat plays without a Next press). */
  pageMs?: number | null;
}) {
  const pages = useMemo(() => (text ? speechPages(text, locale, ageBand) : []), [text, locale, ageBand]);
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [text]);
  useEffect(() => {
    if (!pageMs || page >= pages.length - 1) return undefined;
    const timer = window.setTimeout(() => setPage((n) => n + 1), pageMs);
    return () => window.clearTimeout(timer);
  }, [pageMs, page, pages.length]);
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
      : stageStateFor(session, { board: boardOpen && board !== null, delivering, drafting });
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
  const ladder = session.phase === 'conversing' && !offerOpen && !!turn && turn.next === 'ask' && !session.awaitingReply && !session.ending && !roleplay;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    session.sendText(draft);
    setDraft('');
  };
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
    speaker={plateSpeaker} pageMs={roleplay ? Math.max(1200, Math.floor(roleplay.holdMs / Math.max(1, speechPages(plateText ?? '', locale, session.ageBand).length))) : null} />;
  const replayBoard = replayOn && beat?.kind === 'mentor' ? beat.whiteboard : null;
  // A roleplay scene is the picture while it plays: an earlier board steps aside (and can be shown again after it).
  const boardShown = replayOn ? replayBoard !== null : !!board && boardOpen && session.phase === 'conversing' && !roleplay;
  const closingEl = session.phase === 'closing' && session.closing && !replayOn
    ? <div className="lf-mentor-closing" ref={response as React.RefObject<HTMLDivElement>}>
          <SessionClosing copy={all.mentorSessionEnd} locale={locale} dark={dark} script={session.closing.script}
            effort={session.closing.effort} topic={session.closing.topic} onBack={onPath} />
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
        ? <section className="lf-mentor-board lf-mentor-activity" aria-labelledby={`${titleId}-activity`} key={segment.segmentId}>
          <h2 id={`${titleId}-activity`} data-copy-role="heading">{copy.activity}</h2>
          {typeof segment.segment.prompt === 'string' ? <p data-copy-role="data">{segment.segment.prompt}</p> : null}
          <p data-copy-role="body">{copy.activityAnswer}</p>
        </section>
        : null;
  const replayActivity = replayOn && beat?.kind === 'activity'
    ? <p className="lf-mentor-replay-score" data-copy-role="body">{beat.score === null ? all.mentorReplay.unanswered : fill(all.mentorReplay.scored, { score: beat.score })}</p>
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
          </li>)}
        </ol>}
    </Sheet>
    <Sheet open={sheet === 'grownUp'} onClose={closeSheet} heading={copy.grownUp} closeLabel={copy.sheetClose}>
      <p data-copy-role="body">{copy.grownUpBody}</p>
    </Sheet>
    <Sheet open={sheet === 'chooser'} onClose={closeSheet} heading={copy.chooser.heading} closeLabel={copy.sheetClose}>
      <div className="lf-mentor-chooser"><List label={copy.chooser.heading}>
        {MENTOR_CHARACTERS.map((candidate) => {
          // 08 §8: the character standing on its Diorama where that render exists, else its avatar render; never a stand-in.
          const still = findChooserStill(candidate, theme);
          const avatar = still ? null : findMentorAvatar(candidate, theme);
          const current = candidate === session.character;
          return <ListRow key={candidate} title={MENTOR_NAMES[candidate]} titleRole="data" supporting={copy.chooser.lines[candidate]}
            leading={still ? <img className="lf-mentor-chooser-still" src={still.path} alt="" data-asset-id={still.id} data-character={candidate} />
              : avatar ? <MentorAvatar renderId={avatar} label={null} size="md" /> : null}
            trailing={current ? <Pill tone="primary">{copy.chooser.chosen}</Pill>
              : choosing === candidate ? <Pill tone="sky">{copy.chooser.saving}</Pill> : null}
            onPress={choosing ? undefined : () => void choose(candidate)} />;
        })}
      </List></div>
      {chooseFailed ? <InlineNotice tone="error" live>{copy.chooser.failed}</InlineNotice> : null}
    </Sheet>
    <Sheet open={sheet === 'personalise'} onClose={closeSheet} heading={all.mentorPersonalise.heading} closeLabel={copy.sheetClose}>
      {session.preferences ? <PersonaliseView copy={all.mentorPersonalise} catalog={session.catalog} preferences={session.preferences}
        character={session.character} onSave={session.updatePreferences} /> : null}
    </Sheet>
    <Sheet open={sheet === 'map'} onClose={closeSheet} heading={all.mentorMap.heading} closeLabel={copy.sheetClose}>
      <LearningMapView copy={all.mentorMap} data={session.data} canStart={session.phase === 'openings' && canStart}
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
