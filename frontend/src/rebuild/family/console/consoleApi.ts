/*
 * W2 Lane 4 (W2F.1): the client API layer of the rebuilt Family console (F1),
 * a child's progress (F2) and the Tutor's view of a child's Mentor talks (F3).
 *
 * Core is the only service called, through a transport the route adapter
 * injects (it binds the shared Core client and a fresh token per call), so
 * this layer imports nothing outside the rebuild (Bible 02 rule 23). Every
 * response is shape-checked: a surface never renders a state the server did
 * not return. Nothing here authorizes anything; Core re-checks the verified
 * guardian link on every request and the database says it again.
 *
 * The wire shapes are hand-mirrored from Core (`backend/src/routes/family.ts`,
 * `routes/tutor.ts`, `routes/learn.ts`, `routes/tasks.ts`); this repository
 * shares no types across packages.
 */

import type { DispositionSummaryData } from '../../mentor/allianceApi';
import { boardModel, type BoardFormat, type BoardWords } from '../../mentor/screen/boardModel';
import type { TutorWhiteboardWire } from '../../mentor/session/types';

export type ConsoleTransportResult = { data: unknown; error: null } | { data: null; error: { code: string } };
export type ConsoleMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
/** Calls Core's `/api/v1` with the signed-in session. A network failure answers `{ error: { code: 'NETWORK' } }`. */
export type ConsoleTransport = (path: string, options?: { method?: ConsoleMethod; body?: unknown }) => Promise<ConsoleTransportResult>;
export type Outcome<T> = { ok: true; data: T } | { ok: false; code: string };

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isNullableString = (value: unknown): value is string | null => value === null || typeof value === 'string';
const isInt = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value);
const isInstant = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const isNullableInstant = (value: unknown): value is string | null => value === null || isInstant(value);
const arrayOf = <T>(value: unknown, check: (item: unknown) => item is T): value is T[] => Array.isArray(value) && value.every(check);

async function call<T>(transport: ConsoleTransport, path: string, check: (data: unknown) => data is T,
  init: { method?: ConsoleMethod; body?: unknown } = {}): Promise<Outcome<T>> {
  const result = await transport(path, init);
  if (result.error) return { ok: false, code: result.error.code };
  return check(result.data) ? { ok: true, data: result.data } : { ok: false, code: 'INVALID_RESPONSE' };
}

const kid = (id: string) => encodeURIComponent(id);

// ── F1: the children of this Tutor ─────────────────────────────────────────

export type ProfileField = 'username' | 'displayName';

export interface Child {
  userId: string;
  displayName: string | null;
  username: string | null;
  analyticsConsent: boolean;
  /** Chores done and waiting for this Tutor's approval. */
  pendingApprovalCount: number;
  /** Save + spend + share, or null when the wallet could not be read. */
  walletTotal: number | null;
  /** The chore streak (D.2's lapse-tolerant model), never the lesson streak. */
  taskStreakDays: number;
  /** 'teen': a self-registered teen who linked this Tutor (they manage their own sign-in); null: unknown. */
  accountType: 'child' | 'teen' | null;
  /** E.13: fields that keep the child hidden from every approved outside connection. */
  profileReview: { flagged: boolean; fields: ProfileField[] } | null;
  /** M-12 (OD-26): the usage-data consent also enrols this child in the Mentor's hint-style test (a 10-12 child). Absent = false. */
  dialogueExperiment: boolean;
  /** A.4 (OD-3): false only when Core says the child has no age on record (the Tutor gives it); null or absent = unknown. */
  ageRecorded?: boolean | null;
}

const isField = (value: unknown): value is ProfileField => value === 'username' || value === 'displayName';

function toChild(value: unknown): Child | null {
  if (!isObject(value) || !isString(value.userId) || !isNullableString(value.displayName) || !isNullableString(value.username)
    || typeof value.analyticsConsent !== 'boolean' || !isInt(value.pendingApprovalCount) || !(value.walletTotal === null || isInt(value.walletTotal))
    || !isInt(value.taskStreakDays)) return null;
  const review = value.profileReview;
  const accountType = value.accountType === 'child' || value.accountType === 'teen' ? value.accountType : null;
  return {
    userId: value.userId, displayName: value.displayName, username: value.username, analyticsConsent: value.analyticsConsent,
    pendingApprovalCount: value.pendingApprovalCount, walletTotal: value.walletTotal as number | null, taskStreakDays: value.taskStreakDays, accountType,
    profileReview: isObject(review) && typeof review.flagged === 'boolean' && arrayOf(review.fields, isField) ? { flagged: review.flagged, fields: review.fields } : null,
    dialogueExperiment: value.dialogueExperiment === true,
    ageRecorded: typeof value.ageRecorded === 'boolean' ? value.ageRecorded : null,
  };
}

export async function fetchChildren(transport: ConsoleTransport): Promise<Outcome<Child[]>> {
  const result = await call(transport, '/family/kids', (data): data is { kids: unknown[] } => isObject(data) && Array.isArray(data.kids));
  if (!result.ok) return result;
  const kids = result.data.kids.map(toChild);
  return kids.every((child): child is Child => child !== null) ? { ok: true, data: kids } : { ok: false, code: 'INVALID_RESPONSE' };
}

/** The name a Tutor sees for a child: the first name, else the handle. */
export const childName = (child: Pick<Child, 'displayName' | 'username'>) => child.displayName ?? child.username ?? '';

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
export const PASSPHRASE_MIN = 8;

/** A.4 (OD-3): the bands a Tutor may give a child without a birth date. */
export type ChildAgeBand = 'under_13' | '13_to_17';

/** The Tutor gives the child's age: a birth date, or else `ageBand` (Core refuses a child with neither, CHILD_AGE_REQUIRED). */
export interface NewChild { displayName: string; username: string; passphrase: string; birthDate: string | null; ageBand?: ChildAgeBand; locale: 'en-US' | 'es-MX' | 'pt-BR' }

export function createChild(transport: ConsoleTransport, input: NewChild) {
  return call(transport, '/family/kids', (data): data is { kid: { userId: string; displayName: string | null; username: string | null } } =>
    isObject(data) && isObject(data.kid) && isString(data.kid.userId) && isNullableString(data.kid.displayName) && isNullableString(data.kid.username),
  { method: 'POST', body: input });
}

export function renameChild(transport: ConsoleTransport, kidId: string, displayName: string) {
  return call(transport, `/family/kids/${kid(kidId)}`, (data): data is { kid: { userId: string; displayName: string | null } } =>
    isObject(data) && isObject(data.kid) && data.kid.userId === kidId && isNullableString(data.kid.displayName),
  { method: 'PATCH', body: { displayName } });
}

/** A.4: the age of a child who has none on record; Core records it once (AGE_ALREADY_RECORDED when one exists). */
export function setChildAge(transport: ConsoleTransport, kidId: string, ageBand: ChildAgeBand) {
  return call(transport, `/family/kids/${kid(kidId)}`, (data): data is { kid: { userId: string }; ageRecorded: true } =>
    isObject(data) && isObject(data.kid) && data.kid.userId === kidId && data.ageRecorded === true,
  { method: 'PATCH', body: { ageBand } });
}

export function setChildPassphrase(transport: ConsoleTransport, kidId: string, passphrase: string) {
  return call(transport, `/family/kids/${kid(kidId)}/passphrase`, (data): data is { rotated: true } => isObject(data) && data.rotated === true,
    { method: 'POST', body: { passphrase } });
}

/** S-06: a new username for a child whose handle the E.13 review flags; Core moves the sign-in address with it. */
export function changeChildUsername(transport: ConsoleTransport, kidId: string, username: string) {
  // `sessionsEnded` (S-06): Core signed the child out everywhere; false or absent = old sign-ins may still be open.
  return call(transport, `/family/kids/${kid(kidId)}/username`, (data): data is { kid: { userId: string; username: string }; sessionsEnded?: boolean } =>
    isObject(data) && isObject(data.kid) && data.kid.userId === kidId && isString(data.kid.username)
      && (data.sessionsEnded === undefined || typeof data.sessionsEnded === 'boolean'),
  { method: 'POST', body: { username } });
}

/** E.6: 'held' means the erasure is paused (nothing was deleted); 'finishing' means stored files are still being cleared. */
export type Removal = { deleted: true; status: 'completed' | 'finishing' } | { deleted: false; status: 'held' };

export function removeChild(transport: ConsoleTransport, kidId: string) {
  return call(transport, `/family/kids/${kid(kidId)}`, (data): data is Removal => isObject(data)
    && ((data.deleted === true && (data.status === 'completed' || data.status === 'finishing')) || (data.deleted === false && data.status === 'held')),
  { method: 'DELETE' });
}

/** The §1.9 usage-insights consent. Off means the child's browser sends no usage events. */
export function setInsightsConsent(transport: ConsoleTransport, kidId: string, on: boolean) {
  return call(transport, `/family/kids/${kid(kidId)}/analytics-consent`, (data): data is { kidId: string; analyticsConsent: boolean } =>
    isObject(data) && data.kidId === kidId && data.analyticsConsent === on, { method: on ? 'POST' : 'DELETE' });
}

// ── The microphone consent (the Mentor's voice input) ──────────────────────

export interface MicrophoneState {
  active: boolean;
  grantedAt: string | null;
  /** Whether policy offers a minor's microphone at all. Absent or unknown reads as blocked, never as permission. */
  policy: 'allowed' | 'blocked';
}

export async function fetchMicrophone(transport: ConsoleTransport, kidId: string): Promise<Outcome<MicrophoneState>> {
  const result = await call(transport, `/tutor/consent/${kid(kidId)}`, (data): data is Record<string, unknown> =>
    isObject(data) && typeof data.active === 'boolean' && isNullableInstant(data.grantedAt));
  if (!result.ok) return result;
  const data = result.data as { active: boolean; grantedAt: string | null; policy?: unknown };
  return { ok: true, data: { active: data.active, grantedAt: data.grantedAt, policy: data.policy === 'allowed' ? 'allowed' : 'blocked' } };
}

/** `consentText` is the exact wording the Tutor was shown; Core stores it verbatim (at least 40 characters). */
export function grantMicrophone(transport: ConsoleTransport, kidId: string, consentText: string, locale: 'en-US' | 'es-MX' | 'pt-BR') {
  return call(transport, '/tutor/consent', (data): data is { granted: true; grantedAt: string } => isObject(data) && data.granted === true && isInstant(data.grantedAt),
    { method: 'POST', body: { kidUserId: kidId, consentText, locale } });
}

export function revokeMicrophone(transport: ConsoleTransport, kidId: string) {
  return call(transport, `/tutor/consent/${kid(kidId)}`, (data): data is { revoked: boolean } => isObject(data) && typeof data.revoked === 'boolean',
    { method: 'DELETE' });
}

// ── F2: a child's progress ─────────────────────────────────────────────────

export type LocalizedText = Record<string, unknown>;
export interface CourseSummary { slug: string; title: LocalizedText }

export function fetchCourses(transport: ConsoleTransport) {
  return call(transport, '/learn/courses', (data): data is { courses: CourseSummary[] } => isObject(data)
    && arrayOf(data.courses, (c): c is CourseSummary => isObject(c) && isString(c.slug) && isObject(c.title)));
}

export type TopicState = 'not-started' | 'in-progress' | 'completed' | 'review-due';
export interface Progress { passed: number; total: number }
export interface TerritoryTopic { id: string; title: LocalizedText; state: TopicState; lessons: { id: string; state: string }[] }
export interface TerritoryUnit { id: string; title: LocalizedText; progress: Progress; topics: TerritoryTopic[] }
export interface Territory {
  course: { slug: string; title: LocalizedText; progress: Progress; inProgress: boolean; placementRequired: boolean };
  units: TerritoryUnit[];
  stats: { xpPoints: number; lessonsCompleted: number; streakDays: number; longestStreak: number; lastActiveDate: string | null } | null;
}

const TOPIC_STATES: readonly TopicState[] = ['not-started', 'in-progress', 'completed', 'review-due'];
const isProgressShape = (value: unknown): value is Progress => isObject(value) && isInt(value.passed) && isInt(value.total);

/** The kid's own tree (adventure > saga > topic > lesson), flattened to units of topics for the Tutor's read-only map. */
function toTerritory(data: unknown): Territory | null {
  if (!isObject(data) || !isObject(data.tree)) return null;
  const tree = data.tree;
  const course = tree.course;
  if (!isObject(course) || !isString(course.slug) || !isObject(course.title) || !isProgressShape(course.progress) || !Array.isArray(tree.adventures)) return null;
  const units: TerritoryUnit[] = [];
  for (const adventure of tree.adventures) {
    if (!isObject(adventure) || !isString(adventure.id) || !isObject(adventure.title) || !isProgressShape(adventure.progress) || !Array.isArray(adventure.sagas)) return null;
    const topics: TerritoryTopic[] = [];
    for (const saga of adventure.sagas) {
      if (!isObject(saga) || !Array.isArray(saga.topics)) return null;
      for (const topic of saga.topics) {
        if (!isObject(topic) || !isString(topic.id) || !isObject(topic.title) || !TOPIC_STATES.includes(topic.state as TopicState) || !Array.isArray(topic.lessons)) return null;
        const lessons = topic.lessons.filter((lesson): lesson is { id: string; state: string } => isObject(lesson) && isString(lesson.id) && isString(lesson.state));
        topics.push({ id: topic.id, title: topic.title, state: topic.state as TopicState, lessons: lessons.map(({ id, state }) => ({ id, state })) });
      }
    }
    units.push({ id: adventure.id, title: adventure.title, progress: { passed: adventure.progress.passed, total: adventure.progress.total }, topics });
  }
  const stats = data.stats;
  const parsedStats = isObject(stats) && isInt(stats.xpPoints) && isInt(stats.lessonsCompleted) && isInt(stats.streakDays) && isInt(stats.longestStreak)
    && isNullableString(stats.lastActiveDate)
    ? { xpPoints: stats.xpPoints, lessonsCompleted: stats.lessonsCompleted, streakDays: stats.streakDays, longestStreak: stats.longestStreak, lastActiveDate: stats.lastActiveDate }
    : null;
  if (stats !== null && parsedStats === null) return null;
  return {
    course: { slug: course.slug, title: course.title, progress: { passed: course.progress.passed, total: course.progress.total },
      inProgress: course.inProgress === true, placementRequired: course.placementRequired === true },
    units, stats: parsedStats,
  };
}

export async function fetchTerritory(transport: ConsoleTransport, kidId: string, slug: string): Promise<Outcome<Territory>> {
  const result = await transport(`/family/kids/${kid(kidId)}/courses/${encodeURIComponent(slug)}/territory`);
  if (result.error) return { ok: false, code: result.error.code };
  const territory = toTerritory(result.data);
  return territory ? { ok: true, data: territory } : { ok: false, code: 'INVALID_RESPONSE' };
}

export interface ReachedGoal { id: string; title: string }

/** The child's first reached savings goal, the one a Tutor may share as a picture (null when none). */
export async function fetchReachedGoal(transport: ConsoleTransport, kidId: string): Promise<Outcome<ReachedGoal | null>> {
  const result = await call(transport, `/tasks/${kid(kidId)}/goals`, (data): data is { goals: unknown[] } => isObject(data) && Array.isArray(data.goals));
  if (!result.ok) return result;
  const reached = result.data.goals.find((goal): goal is { id: string; title: string; status: string } =>
    isObject(goal) && isString(goal.id) && isString(goal.title) && goal.status === 'reached');
  return { ok: true, data: reached ? { id: reached.id, title: reached.title } : null };
}

/** Mirrors Core's MIN_SHAREABLE_STREAK_DAYS: a client-side hide only, Core re-checks it. */
export const MIN_SHAREABLE_STREAK_DAYS = 3;

// ── F3: a child's Mentor talks ─────────────────────────────────────────────

export type Severity = 'high' | 'medium' | 'low';
export interface SessionNarrative { topics: string[]; struggledTopic: string | null; struggleResolved: boolean; gradedCorrect: number | null; gradedTotal: number | null }
export interface MentorSession {
  id: string;
  intent: string;
  startedAt: string;
  endedAt: string | null;
  closeReason: string | null;
  turnCount: number;
  narrative: SessionNarrative | null;
}
export type SafetyFlag =
  | { source: 'session'; key: string; id: string; sessionId: string; turnSeq: number | null; category: string; severity: string; createdAt: string }
  | { source: 'placement'; key: string; id: string; category: string; severity: string; createdAt: string };
export interface MentorHistory { sessions: MentorSession[]; hasMore: boolean; flags: SafetyFlag[] }

function toNarrative(value: unknown): SessionNarrative | null {
  if (!isObject(value) || !arrayOf(value.topics, isString) || !isNullableString(value.struggledTopic) || typeof value.struggleResolved !== 'boolean') return null;
  return {
    topics: value.topics.slice(0, 2), struggledTopic: value.struggledTopic, struggleResolved: value.struggleResolved,
    gradedCorrect: isInt(value.gradedCorrect) ? value.gradedCorrect : null, gradedTotal: isInt(value.gradedTotal) ? value.gradedTotal : null,
  };
}

function toSession(value: unknown): MentorSession | null {
  if (!isObject(value) || !isString(value.id) || !isString(value.intent) || !isInstant(value.startedAt) || !isNullableInstant(value.endedAt)
    || !isNullableString(value.closeReason) || !isInt(value.turnCount)) return null;
  return { id: value.id, intent: value.intent, startedAt: value.startedAt, endedAt: value.endedAt, closeReason: value.closeReason,
    turnCount: value.turnCount, narrative: toNarrative(value.narrative) };
}

const SEVERITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

/**
 * Both flag provenances in ONE list, most severe first, then newest: a flag
 * raised while choosing a course is no less urgent for having no transcript.
 */
export function sortFlags(flags: SafetyFlag[]): SafetyFlag[] {
  return [...flags].sort((a, b) => {
    const rank = (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3);
    return rank !== 0 ? rank : Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
}

function toHistory(data: unknown): MentorHistory | null {
  if (!isObject(data) || !Array.isArray(data.sessions) || !Array.isArray(data.safetyFlags) || !Array.isArray(data.placementSafetyFlags)) return null;
  const sessions = data.sessions.map(toSession);
  if (!sessions.every((s): s is MentorSession => s !== null)) return null;
  const flags: SafetyFlag[] = [];
  for (const flag of data.safetyFlags) {
    if (!isObject(flag) || !isString(flag.id) || !isString(flag.session_id) || !(flag.turn_seq === null || isInt(flag.turn_seq))
      || !isString(flag.category) || !isString(flag.severity) || !isInstant(flag.created_at)) return null;
    flags.push({ source: 'session', key: `session:${flag.id}`, id: flag.id, sessionId: flag.session_id, turnSeq: flag.turn_seq as number | null,
      category: flag.category, severity: flag.severity, createdAt: flag.created_at });
  }
  for (const flag of data.placementSafetyFlags) {
    if (!isObject(flag) || !isString(flag.id) || !isString(flag.category) || !isString(flag.severity) || !isInstant(flag.created_at)) return null;
    flags.push({ source: 'placement', key: `placement:${flag.id}`, id: flag.id, category: flag.category, severity: flag.severity, createdAt: flag.created_at });
  }
  return { sessions, hasMore: data.hasMore === true, flags: sortFlags(flags) };
}

export async function fetchMentorHistory(transport: ConsoleTransport, kidId: string, offset = 0): Promise<Outcome<MentorHistory>> {
  const result = await transport(`/tutor/kids/${kid(kidId)}/sessions${offset > 0 ? `?offset=${offset}` : ''}`);
  if (result.error) return { ok: false, code: result.error.code };
  const history = toHistory(result.data);
  return history ? { ok: true, data: history } : { ok: false, code: 'INVALID_RESPONSE' };
}

/**
 * A board as the Tutor's transcript shows it: the drawn board (the Mentor
 * lane's own wire, rendered by its rebuilt renderer) when Core returned one
 * the renderer can draw, and always its caption, the fallback when it cannot.
 */
export interface BoardNote { kind: string; label: string | null; wire: TutorWhiteboardWire | null }
export type TranscriptBeat =
  | { kind: 'mentor' | 'child' | 'note'; id: string; seq: number; text: string; board: BoardNote | null; demonstrated: number[] }
  | { kind: 'activity'; id: string; seq: number; prompt: string; score: number | null; xpAwarded: number };

/** Probe words and numbers: every word is its own key, and a missing number reads "NaN", so a board with a hole in it is caught. */
const PROBE_WORDS = new Proxy({}, { get: (_target, key) => (key === 'step' ? { day: 'd{n}', week: 'w{n}', month: 'm{n}', year: 'y{n}' } : String(key)) }) as BoardWords;
const probeNumber = (value: number) => (typeof value === 'number' && Number.isFinite(value) ? String(value) : 'NaN');
const PROBE_FORMAT: BoardFormat = { number: probeNumber, money: probeNumber, percent: probeNumber };

/**
 * The board wire, validated with the Mentor lane's own model: a shape that
 * model draws (an unknown one yields no model), with a caption, whose every
 * row it can write (no missing field, no number that is not one). Anything
 * else is not drawn; its caption stays.
 */
export function boardWire(value: unknown): TutorWhiteboardWire | null {
  if (!isObject(value) || !isString(value.kind) || !isString(value.label)) return null;
  const wire = value as unknown as TutorWhiteboardWire;
  try {
    const model = boardModel(wire, PROBE_WORDS, PROBE_FORMAT) as ReturnType<typeof boardModel> | undefined;
    if (!model || !Array.isArray(model.rows)) return null;
    const sound = (text: unknown) => typeof text === 'string' && !/\bNaN\b|undefined|\[object Object\]/.test(text);
    return model.rows.length > 0 && model.rows.every((row) => sound(row.label) && sound(row.value)
      && (row.amount === undefined || Number.isFinite(row.amount))) ? wire : null;
  } catch {
    return null;
  }
}

const boardNote = (value: unknown): BoardNote | null => isObject(value) && isString(value.kind)
  ? { kind: value.kind, label: isString(value.label) && value.label.trim() !== '' ? value.label : null, wire: boardWire(value) } : null;

/** The signed coin steps a Mentor demonstrated on the money tray ("+10, -5"); a pause or a non-money step says nothing. */
function demonstratedSteps(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((step) => isObject(step) && typeof step.denomination === 'number' && Number.isFinite(step.denomination)
    ? [step.kind === 'remove' ? -step.denomination : step.denomination] : []);
}

/** Strips the lesson prompt's light markdown (emphasis, code ticks, headings) to plain words; the words themselves are kept. */
export function plainPrompt(markdown: string): string {
  return markdown.replace(/^#{1,6}\s+/gm, '').replace(/(\*\*|__|\*|_|`)(.+?)\1/g, '$2').replace(/\s+/g, ' ').trim();
}

/**
 * A talk in the order it happened: the turns by their own seq and the
 * activities served between them by time (an activity's seq is its own
 * per-session ordinal, never the seq of the turn that served it). The same
 * ordering rule the Mentor's replay uses; the answer key never travels.
 */
export function orderTranscript(turns: unknown[], segments: unknown[]): TranscriptBeat[] | null {
  type Entry = { seq: number; at: number; rank: number; beat: TranscriptBeat };
  const entries: Entry[] = [];
  for (const turn of turns) {
    if (!isObject(turn) || !isString(turn.id) || !isInt(turn.seq) || !isString(turn.text) || !isInstant(turn.created_at)) return null;
    const kind = turn.speaker === 'tutor' ? 'mentor' : turn.speaker === 'learner' ? 'child' : 'note';
    entries.push({ seq: turn.seq, at: Date.parse(turn.created_at), rank: 0, beat: {
      kind, id: `turn:${turn.id}`, seq: turn.seq, text: turn.text,
      board: kind === 'mentor' ? boardNote(turn.whiteboard) : null, demonstrated: kind === 'mentor' ? demonstratedSteps(turn.demonstrate) : [],
    } });
  }
  for (const segment of segments) {
    if (!isObject(segment) || !isString(segment.segmentId) || !isInt(segment.seq) || !isInstant(segment.createdAt)
      || !(segment.score === null || typeof segment.score === 'number') || !isInt(segment.xpAwarded)) return null;
    const payload = isObject(segment.segment) ? segment.segment : {};
    entries.push({ seq: segment.seq, at: Date.parse(segment.createdAt), rank: 1, beat: {
      kind: 'activity', id: `segment:${segment.segmentId}`, seq: segment.seq,
      prompt: isString(payload.prompt_md) ? plainPrompt(payload.prompt_md) : '', score: segment.score as number | null, xpAwarded: segment.xpAwarded,
    } });
  }
  entries.sort((a, b) => (a.rank === b.rank && a.seq !== b.seq) ? a.seq - b.seq : a.at !== b.at ? a.at - b.at : a.rank - b.rank);
  return entries.map((entry) => entry.beat);
}

export async function fetchTranscript(transport: ConsoleTransport, sessionId: string): Promise<Outcome<TranscriptBeat[]>> {
  const result = await transport(`/tutor/sessions/${encodeURIComponent(sessionId)}`);
  if (result.error) return { ok: false, code: result.error.code };
  const data = result.data;
  const beats = isObject(data) && Array.isArray(data.turns) && Array.isArray(data.segments) ? orderTranscript(data.turns, data.segments) : null;
  return beats ? { ok: true, data: beats } : { ok: false, code: 'INVALID_RESPONSE' };
}

// The parental approval gate on the Mentor's note about a child.

export interface MemoryProposal { id: string; proposed: string; expectedBefore: string | null; createdAt: string }
export interface MemoryNotes { proposals: MemoryProposal[]; current: string | null }

export function fetchMemoryNotes(transport: ConsoleTransport, kidId: string) {
  return call(transport, `/tutor/kids/${kid(kidId)}/memory-proposals`, (data): data is MemoryNotes => isObject(data) && isNullableString(data.current)
    && arrayOf(data.proposals, (p): p is MemoryProposal => isObject(p) && isString(p.id) && isString(p.proposed) && isNullableString(p.expectedBefore) && isInstant(p.createdAt)));
}

/** A decision's outcome as the Tutor must read it: applied, refused as out of date (or decided by someone else), or failed. */
export type MemoryDecision = 'approved' | 'rejected' | 'stale' | 'failed';

export async function decideMemoryNote(transport: ConsoleTransport, noteId: string, verdict: 'approved' | 'rejected'): Promise<MemoryDecision> {
  const result = await call(transport, `/tutor/memory-proposals/${encodeURIComponent(noteId)}/decision`,
    (data): data is { outcome: string } => isObject(data) && isString(data.outcome), { method: 'POST', body: { verdict } });
  if (result.ok) return verdict;
  return result.code === 'NOTE_OUT_OF_DATE' || result.code === 'ALREADY_DECIDED' ? 'stale' : 'failed';
}

// C.7: the learner disposition profile, read by the verified Tutor.

const HELP = ['independent', 'hint_seeking', 'tell_early', 'unknown'];
const PERSISTENCE = ['persists', 'disengages_early', 'unknown'];
const EXPLANATION = ['explains', 'needs_scaffold', 'unknown'];
const ADAPTATIONS = ['slower_pacing', 'more_examples', 'less_text', 'more_visual', 'repeat_before_advancing'];

export function fetchDisposition(transport: ConsoleTransport, kidId: string) {
  return call(transport, `/tutor/kids/${kid(kidId)}/disposition`, (data): data is DispositionSummaryData => isObject(data) && typeof data.exists === 'boolean'
    && (data.exists === false || (typeof data.current === 'boolean' && HELP.includes(data.helpStyle as string) && PERSISTENCE.includes(data.persistence as string)
      && EXPLANATION.includes(data.explanation as string) && arrayOf(data.persistentlyDeclined, (a): a is string => isString(a) && ADAPTATIONS.includes(a))
      && (data.typicalReplySeconds === null || typeof data.typicalReplySeconds === 'number'))));
}

export function resetDisposition(transport: ConsoleTransport, kidId: string) {
  return call(transport, `/tutor/kids/${kid(kidId)}/disposition`, (data): data is { reset: boolean } => isObject(data) && data.reset === true, { method: 'DELETE' });
}

// Class V artifacts: the savings plan and the boards the child kept.

export interface KeptBoards { plan: { board: BoardNote; updatedAt: string } | null; kept: { id: string; board: BoardNote; keptAt: string }[] }

export async function fetchKeptBoards(transport: ConsoleTransport, kidId: string): Promise<Outcome<KeptBoards>> {
  const [plan, notebook] = await Promise.all([
    call(transport, `/tutor/kids/${kid(kidId)}/plan`, (data): data is { plan: unknown } => isObject(data) && 'plan' in data),
    call(transport, `/tutor/kids/${kid(kidId)}/notebook`, (data): data is { entries: unknown[] } => isObject(data) && Array.isArray(data.entries)),
  ]);
  if (!plan.ok) return plan;
  if (!notebook.ok) return notebook;
  const rawPlan = plan.data.plan;
  const planBoard = isObject(rawPlan) && isInstant(rawPlan.updatedAt) ? boardNote(rawPlan.content) : null;
  const kept = notebook.data.entries.flatMap((entry) => {
    if (!isObject(entry) || !isString(entry.id) || !isInstant(entry.keptAt)) return [];
    const board = boardNote(entry.whiteboard);
    return board ? [{ id: entry.id, board, keptAt: entry.keptAt }] : [];
  });
  return { ok: true, data: { plan: planBoard && isObject(rawPlan) ? { board: planBoard, updatedAt: rawPlan.updatedAt as string } : null, kept } };
}
