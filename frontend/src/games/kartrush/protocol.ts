/*
 * The `kr.v1` protocol, host side: every message the LittleFounders SPA and
 * KartRush exchange over the transferred `MessagePort`, each with a strict,
 * hand-written validator. It mirrors `docs/games/KRV1-CONTRACT.md` §1 and §2,
 * which wins wherever another document disagrees.
 *
 * HAND-MIRRORED, NEVER IMPORTED. The SPA, Core and the game share no code (the
 * repo convention: wire shapes are copied, and a parity gate keeps the copies
 * honest). `KRV1_MANIFEST` below is the machine-checkable copy of the field
 * lists; a test pins it to `docs/games/krv1.manifest.json` and the validators
 * to the manifest, and the cross-repo parity script reads it as well.
 *
 * WHY STRICT. The port carries data written by a different origin's code, so
 * the vocabulary is closed: an unknown `t`, a wrong `v`, an extra field, a
 * wrong type or an out-of-range number is REJECTED and nothing is coerced,
 * clamped or defaulted on the way in. The same validators run on what the host
 * is about to send, so a bug here can only produce a dropped message, never a
 * malformed one on the wire.
 */

export const KR_PROTOCOL = 'kr.v1';
export const KR_VERSION = 1;

/** The four drivers: the game's `CharacterId`, LittleFounders' Mentor and the wire value are the same ids. */
export const KR_CHARACTERS = ['rho', 'zara', 'liruf', 'dina'] as const;
export type Mentor = typeof KR_CHARACTERS[number];

/** The game's own locale ids. The platform's are `en-US`, `es-MX`, `pt-BR` (`toGameLocale`). */
export const KR_LOCALES = ['en', 'es', 'pt'] as const;
export type GameLocale = typeof KR_LOCALES[number];

export const KR_MODES = ['single', 'timeTrial', 'practice'] as const;
export type GameMode = typeof KR_MODES[number];

export const KR_SPEED_CLASSES = ['100cc', '150cc', '200cc'] as const;
export type SpeedClass = typeof KR_SPEED_CLASSES[number];

/** The six circuits, verified against KartRush `REAL_TRACK_IDS` (src/data/tracks) on 2026-10-06. */
export const KR_TRACK_IDS = ['jungleNeck', 'boulevard', 'fossilFire', 'factory', 'saltBay', 'glacier'] as const;
export type TrackId = typeof KR_TRACK_IDS[number];

export const KR_ERROR_CODES = ['webgl', 'boot', 'race', 'unknown'] as const;
export type GameErrorCode = typeof KR_ERROR_CODES[number];

/** The pit-stop lens keys, chosen by Core (contract §5); the SPA only reads them. */
export const KR_LENSES = ['item_hold', 'drift_patient', 'drift_early', 'steady', 'swingy', 'neutral'] as const;
export type LensKey = typeof KR_LENSES[number];

export const KR_REPLIES = ['a', 'b', 'unsure'] as const;
export type Reply = typeof KR_REPLIES[number];

export interface StartSpec {
  readonly mode: GameMode;
  readonly trackId: TrackId;
  readonly character: Mentor;
  readonly speedClass: SpeedClass;
}

/** The learner's own game data, relayed between the game and Core. Opaque to the host. */
export type SaveData = Readonly<Record<string, unknown>>;

/* ------------------------------------------------------------------ host -> game */

export interface LfInit {
  readonly t: 'lf.init'; readonly v: 1;
  readonly sessionRef: string; readonly locale: GameLocale; readonly mentor: Mentor;
  readonly muted: boolean; readonly reducedMotion: boolean; readonly startLabel: string;
  readonly save: { readonly revision: number; readonly data: SaveData | null };
  readonly start: StartSpec;
}
export interface LfStart { readonly t: 'lf.start'; readonly v: 1; readonly start: StartSpec }
export interface LfPause { readonly t: 'lf.pause'; readonly v: 1 }
export interface LfResume { readonly t: 'lf.resume'; readonly v: 1 }
export interface LfMute { readonly t: 'lf.mute'; readonly v: 1; readonly muted: boolean }
export interface LfEnd { readonly t: 'lf.end'; readonly v: 1 }
export type HostMessage = LfInit | LfStart | LfPause | LfResume | LfMute | LfEnd;

/** The one window message that carries the port. */
export const LF_HELLO = { t: 'lf.hello', v: 1 } as const;

/* ------------------------------------------------------------------ game -> host */

export interface KrReady { readonly t: 'kr.ready'; readonly v: 1; readonly build: string }
export interface KrRunStarted {
  readonly t: 'kr.runStarted'; readonly v: 1;
  readonly runKey: string; readonly mode: GameMode; readonly trackId: TrackId; readonly character: Mentor;
}
export interface RunLens {
  readonly itemHoldMs: number; readonly boxesPassedWhileHolding: number; readonly itemsUsed: number;
  readonly driftReleases: { readonly t0: number; readonly t1: number; readonly t2: number; readonly t3: number };
  readonly recoveries: number;
}
/** What Core receives, exactly (POST .../runs takes this body, without the envelope). */
export interface RunReport {
  readonly runKey: string; readonly mode: 'single' | 'timeTrial'; readonly trackId: TrackId; readonly character: Mentor;
  readonly kartBody: string; readonly speedClass: SpeedClass; readonly finished: true;
  readonly finishMs: number; readonly bestLapMs: number; readonly lapMs: readonly number[]; readonly rank: number;
  readonly lens: RunLens;
}
export interface KrRunFinished extends RunReport { readonly t: 'kr.runFinished'; readonly v: 1 }
export interface KrRunEnded { readonly t: 'kr.runEnded'; readonly v: 1; readonly runKey: string }
export interface KrSave { readonly t: 'kr.save'; readonly v: 1; readonly revision: number; readonly data: SaveData }
export interface KrPauseRequested { readonly t: 'kr.pauseRequested'; readonly v: 1 }
export interface KrExitRequested { readonly t: 'kr.exitRequested'; readonly v: 1 }
export interface KrError { readonly t: 'kr.error'; readonly v: 1; readonly code: GameErrorCode }
export type GameMessage = KrReady | KrRunStarted | KrRunFinished | KrRunEnded | KrSave | KrPauseRequested | KrExitRequested | KrError;

/* ------------------------------------------------------------------ manifest */

/**
 * The field lists of the contract, in the same shape as `docs/games/krv1.manifest.json`
 * (envelope fields `t` and `v` are implied). Keep this literal plain: the parity
 * script reads it, and `protocol.test.ts` compares it to the JSON file.
 */
export const KRV1_MANIFEST = {
  'protocol': 'kr.v1',
  'hostToGame': {
    'lf.init': ['sessionRef', 'locale', 'mentor', 'muted', 'reducedMotion', 'startLabel', 'save', 'start'],
    'lf.start': ['start'],
    'lf.pause': [],
    'lf.resume': [],
    'lf.mute': ['muted'],
    'lf.end': [],
  },
  'gameToHost': {
    'kr.ready': ['build'],
    'kr.runStarted': ['runKey', 'mode', 'trackId', 'character'],
    'kr.runFinished': ['runKey', 'mode', 'trackId', 'character', 'kartBody', 'speedClass', 'finished', 'finishMs', 'bestLapMs', 'lapMs', 'rank', 'lens'],
    'kr.runEnded': ['runKey'],
    'kr.save': ['revision', 'data'],
    'kr.pauseRequested': [],
    'kr.exitRequested': [],
    'kr.error': ['code'],
  },
  'startSpec': ['mode', 'trackId', 'character', 'speedClass'],
  'lens': ['itemHoldMs', 'boxesPassedWhileHolding', 'itemsUsed', 'driftReleases', 'recoveries'],
  'driftReleases': ['t0', 't1', 't2', 't3'],
} as const;

/* ------------------------------------------------------------------ validation primitives */

export type ParseResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: string };

function fail<T>(reason: string): ParseResult<T> {
  return { ok: false, reason };
}

/** A plain object: not an array, not a class instance (so a `Map`, `Date` or `Error` never passes). */
export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Null when `obj` carries exactly the keys in `allowed`; otherwise the reason it does not. */
function keySetProblem(obj: Record<string, unknown>, allowed: readonly string[]): string | null {
  for (const key of Object.keys(obj)) if (!allowed.includes(key)) return `unexpected field "${key}"`;
  for (const key of allowed) if (!Object.prototype.hasOwnProperty.call(obj, key)) return `missing field "${key}"`;
  return null;
}

function isIntInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

/** Length in code points, so a character outside the BMP counts once. */
function codePointLength(value: string): number {
  return Array.from(value).length;
}

const SESSION_REF = /^[A-Za-z0-9_-]{8,64}$/;
const MAX_MS = 1_800_000;
/** Contract §2: `kr.save.data` is at most 64 KB serialized. */
export const KR_SAVE_MAX_BYTES = 64 * 1024;

/** UTF-8 size of the JSON form of `value`; `null` when it cannot be serialized (a cycle, a BigInt). */
export function serializedBytes(value: unknown): number | null {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return null;
  }
}

function isRunKey(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 8 && value.length <= 64;
}

/** Checks the `{ t, v }` envelope and the exact key set of one message. */
function openEnvelope(raw: Record<string, unknown>, type: string, fields: readonly string[]): ParseResult<Record<string, unknown>> {
  if (raw.v !== KR_VERSION) return fail(`unsupported protocol version ${JSON.stringify(raw.v)}`);
  const problem = keySetProblem(raw, ['t', 'v', ...fields]);
  return problem ? fail(`${type}: ${problem}`) : { ok: true, value: raw };
}

export function parseStartSpec(raw: unknown): ParseResult<StartSpec> {
  if (!isPlainRecord(raw)) return fail('start must be an object');
  const problem = keySetProblem(raw, KRV1_MANIFEST.startSpec);
  if (problem) return fail(`start: ${problem}`);
  if (!oneOf(raw.mode, KR_MODES)) return fail('start.mode is not a known mode');
  if (!oneOf(raw.trackId, KR_TRACK_IDS)) return fail('start.trackId is not a known track');
  if (!oneOf(raw.character, KR_CHARACTERS)) return fail('start.character is not a known character');
  if (!oneOf(raw.speedClass, KR_SPEED_CLASSES)) return fail('start.speedClass is not a known speed class');
  return { ok: true, value: { mode: raw.mode, trackId: raw.trackId, character: raw.character, speedClass: raw.speedClass } };
}

/* ------------------------------------------------------------------ host -> game */

function parseInit(raw: Record<string, unknown>): ParseResult<LfInit> {
  const opened = openEnvelope(raw, 'lf.init', KRV1_MANIFEST.hostToGame['lf.init']);
  if (!opened.ok) return opened;
  const { sessionRef, locale, mentor, muted, reducedMotion, startLabel, save } = raw;
  if (typeof sessionRef !== 'string' || !SESSION_REF.test(sessionRef)) return fail('lf.init.sessionRef must be 8..64 characters of [A-Za-z0-9_-]');
  if (!oneOf(locale, KR_LOCALES)) return fail('lf.init.locale is not en|es|pt');
  if (!oneOf(mentor, KR_CHARACTERS)) return fail('lf.init.mentor is not a known character');
  if (typeof muted !== 'boolean') return fail('lf.init.muted must be a boolean');
  if (typeof reducedMotion !== 'boolean') return fail('lf.init.reducedMotion must be a boolean');
  if (typeof startLabel !== 'string') return fail('lf.init.startLabel must be a string');
  const labelLength = codePointLength(startLabel);
  if (labelLength < 1 || labelLength > 24) return fail('lf.init.startLabel must be 1..24 characters');
  if (!isPlainRecord(save)) return fail('lf.init.save must be an object');
  const saveProblem = keySetProblem(save, ['revision', 'data']);
  if (saveProblem) return fail(`lf.init.save: ${saveProblem}`);
  if (!isIntInRange(save.revision, 0, Number.MAX_SAFE_INTEGER)) return fail('lf.init.save.revision must be an integer >= 0');
  if (save.data !== null && !isPlainRecord(save.data)) return fail('lf.init.save.data must be an object or null');
  const start = parseStartSpec(raw.start);
  if (!start.ok) return fail(`lf.init.${start.reason}`);
  return { ok: true, value: { t: 'lf.init', v: 1, sessionRef, locale, mentor, muted, reducedMotion, startLabel, save: { revision: save.revision, data: save.data }, start: start.value } };
}

/** Validates one message the host is about to send (and, in the game's copy, one it receives). Never throws. */
export function parseHostMessage(raw: unknown): ParseResult<HostMessage> {
  if (!isPlainRecord(raw)) return fail('message must be an object');
  const type = raw.t;
  switch (type) {
    case 'lf.init': return parseInit(raw);
    case 'lf.start': {
      const opened = openEnvelope(raw, 'lf.start', KRV1_MANIFEST.hostToGame['lf.start']);
      if (!opened.ok) return opened;
      const start = parseStartSpec(raw.start);
      return start.ok ? { ok: true, value: { t: 'lf.start', v: 1, start: start.value } } : fail(`lf.start.${start.reason}`);
    }
    case 'lf.pause': case 'lf.resume': case 'lf.end': {
      const opened = openEnvelope(raw, type, []);
      return opened.ok ? { ok: true, value: { t: type, v: 1 } } : opened;
    }
    case 'lf.mute': {
      const opened = openEnvelope(raw, 'lf.mute', KRV1_MANIFEST.hostToGame['lf.mute']);
      if (!opened.ok) return opened;
      return typeof raw.muted === 'boolean' ? { ok: true, value: { t: 'lf.mute', v: 1, muted: raw.muted } } : fail('lf.mute.muted must be a boolean');
    }
    default: return fail(`unknown message type ${JSON.stringify(type)}`);
  }
}

/* ------------------------------------------------------------------ game -> host */

function parseLens(raw: unknown): ParseResult<RunLens> {
  if (!isPlainRecord(raw)) return fail('lens must be an object');
  const problem = keySetProblem(raw, KRV1_MANIFEST.lens);
  if (problem) return fail(`lens: ${problem}`);
  if (!isIntInRange(raw.itemHoldMs, 0, MAX_MS)) return fail('lens.itemHoldMs must be an integer 0..1800000');
  if (!isIntInRange(raw.boxesPassedWhileHolding, 0, 200)) return fail('lens.boxesPassedWhileHolding must be an integer 0..200');
  if (!isIntInRange(raw.itemsUsed, 0, 200)) return fail('lens.itemsUsed must be an integer 0..200');
  if (!isIntInRange(raw.recoveries, 0, 200)) return fail('lens.recoveries must be an integer 0..200');
  const drift = raw.driftReleases;
  if (!isPlainRecord(drift)) return fail('lens.driftReleases must be an object');
  const driftProblem = keySetProblem(drift, KRV1_MANIFEST.driftReleases);
  if (driftProblem) return fail(`lens.driftReleases: ${driftProblem}`);
  // The contract bounds the four counters only as `int`. A race cannot release more drifts than its
  // length in milliseconds, so the ceiling that bounds finishMs is a sanity cap, the game's own choice too.
  for (const tier of KRV1_MANIFEST.driftReleases) {
    if (!isIntInRange(drift[tier], 0, MAX_MS)) return fail(`lens.driftReleases.${tier} must be an integer >= 0`);
  }
  return {
    ok: true,
    value: {
      itemHoldMs: raw.itemHoldMs, boxesPassedWhileHolding: raw.boxesPassedWhileHolding, itemsUsed: raw.itemsUsed,
      driftReleases: { t0: drift.t0 as number, t1: drift.t1 as number, t2: drift.t2 as number, t3: drift.t3 as number },
      recoveries: raw.recoveries,
    },
  };
}

/** The report fields without the envelope, validated; used for the message and for any later re-check. */
function parseReportFields(raw: Record<string, unknown>, label: string): ParseResult<RunReport> {
  if (!isRunKey(raw.runKey)) return fail(`${label}.runKey must be a string of 8..64 characters`);
  if (!oneOf(raw.mode, ['single', 'timeTrial'] as const)) return fail(`${label}.mode must be single|timeTrial`);
  if (!oneOf(raw.trackId, KR_TRACK_IDS)) return fail(`${label}.trackId is not a known track`);
  if (!oneOf(raw.character, KR_CHARACTERS)) return fail(`${label}.character is not a known character`);
  if (typeof raw.kartBody !== 'string' || raw.kartBody.length < 1 || raw.kartBody.length > 24) return fail(`${label}.kartBody must be a string of 1..24 characters`);
  if (!oneOf(raw.speedClass, KR_SPEED_CLASSES)) return fail(`${label}.speedClass is not a known speed class`);
  if (raw.finished !== true) return fail(`${label}.finished must be true`);
  if (!isIntInRange(raw.finishMs, 1, MAX_MS)) return fail(`${label}.finishMs must be an integer 1..1800000`);
  if (!isIntInRange(raw.bestLapMs, 1, Number.MAX_SAFE_INTEGER)) return fail(`${label}.bestLapMs must be a positive integer`);
  const lapMs = raw.lapMs;
  if (!Array.isArray(lapMs) || lapMs.length < 1 || lapMs.length > 5) return fail(`${label}.lapMs must have 1..5 entries`);
  for (const lap of lapMs) if (!isIntInRange(lap, 1, Number.MAX_SAFE_INTEGER)) return fail(`${label}.lapMs entries must be positive integers`);
  if (!isIntInRange(raw.rank, 1, 8)) return fail(`${label}.rank must be an integer 1..8`);
  const lens = parseLens(raw.lens);
  if (!lens.ok) return fail(`${label}.${lens.reason}`);
  return {
    ok: true,
    value: {
      runKey: raw.runKey, mode: raw.mode, trackId: raw.trackId, character: raw.character, kartBody: raw.kartBody, speedClass: raw.speedClass,
      finished: true, finishMs: raw.finishMs, bestLapMs: raw.bestLapMs, lapMs: [...(lapMs as number[])], rank: raw.rank, lens: lens.value,
    },
  };
}

/** Validates one message arriving on the port from the game. Never throws; a failure is dropped and logged by the caller. */
export function parseGameMessage(raw: unknown): ParseResult<GameMessage> {
  if (!isPlainRecord(raw)) return fail('message must be an object');
  const type = raw.t;
  switch (type) {
    case 'kr.ready': {
      const opened = openEnvelope(raw, 'kr.ready', KRV1_MANIFEST.gameToHost['kr.ready']);
      if (!opened.ok) return opened;
      if (typeof raw.build !== 'string' || raw.build.length < 1 || raw.build.length > 40) return fail('kr.ready.build must be a string of 1..40 characters');
      return { ok: true, value: { t: 'kr.ready', v: 1, build: raw.build } };
    }
    case 'kr.runStarted': {
      const opened = openEnvelope(raw, 'kr.runStarted', KRV1_MANIFEST.gameToHost['kr.runStarted']);
      if (!opened.ok) return opened;
      if (!isRunKey(raw.runKey)) return fail('kr.runStarted.runKey must be a string of 8..64 characters');
      if (!oneOf(raw.mode, KR_MODES)) return fail('kr.runStarted.mode is not a known mode');
      if (!oneOf(raw.trackId, KR_TRACK_IDS)) return fail('kr.runStarted.trackId is not a known track');
      if (!oneOf(raw.character, KR_CHARACTERS)) return fail('kr.runStarted.character is not a known character');
      return { ok: true, value: { t: 'kr.runStarted', v: 1, runKey: raw.runKey, mode: raw.mode, trackId: raw.trackId, character: raw.character } };
    }
    case 'kr.runFinished': {
      const opened = openEnvelope(raw, 'kr.runFinished', KRV1_MANIFEST.gameToHost['kr.runFinished']);
      if (!opened.ok) return opened;
      const report = parseReportFields(raw, 'kr.runFinished');
      return report.ok ? { ok: true, value: { t: 'kr.runFinished', v: 1, ...report.value } } : report;
    }
    case 'kr.runEnded': {
      const opened = openEnvelope(raw, 'kr.runEnded', KRV1_MANIFEST.gameToHost['kr.runEnded']);
      if (!opened.ok) return opened;
      return isRunKey(raw.runKey) ? { ok: true, value: { t: 'kr.runEnded', v: 1, runKey: raw.runKey } } : fail('kr.runEnded.runKey must be a string of 8..64 characters');
    }
    case 'kr.save': {
      const opened = openEnvelope(raw, 'kr.save', KRV1_MANIFEST.gameToHost['kr.save']);
      if (!opened.ok) return opened;
      if (!isIntInRange(raw.revision, 0, Number.MAX_SAFE_INTEGER)) return fail('kr.save.revision must be an integer >= 0');
      if (!isPlainRecord(raw.data)) return fail('kr.save.data must be an object');
      const bytes = serializedBytes(raw.data);
      if (bytes === null) return fail('kr.save.data cannot be serialized');
      if (bytes > KR_SAVE_MAX_BYTES) return fail('kr.save.data exceeds 64 KB serialized');
      return { ok: true, value: { t: 'kr.save', v: 1, revision: raw.revision, data: raw.data } };
    }
    case 'kr.pauseRequested': case 'kr.exitRequested': {
      const opened = openEnvelope(raw, type, []);
      return opened.ok ? { ok: true, value: { t: type, v: 1 } } : opened;
    }
    case 'kr.error': {
      const opened = openEnvelope(raw, 'kr.error', KRV1_MANIFEST.gameToHost['kr.error']);
      if (!opened.ok) return opened;
      return oneOf(raw.code, KR_ERROR_CODES) ? { ok: true, value: { t: 'kr.error', v: 1, code: raw.code } } : fail('kr.error.code is not webgl|boot|race|unknown');
    }
    default: return fail(`unknown message type ${JSON.stringify(type)}`);
  }
}

/** The report body Core receives: the validated fields with no envelope. */
export function reportBody(message: KrRunFinished): RunReport {
  const { t: _t, v: _v, ...report } = message;
  return report;
}

/** The platform locale as the game names it (contract §1). */
export function toGameLocale(locale: 'en-US' | 'es-MX' | 'pt-BR'): GameLocale {
  return locale === 'es-MX' ? 'es' : locale === 'pt-BR' ? 'pt' : 'en';
}
