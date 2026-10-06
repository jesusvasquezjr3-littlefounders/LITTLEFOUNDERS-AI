import { KR_CHARACTERS, KR_MODES, KR_TRACK_IDS, type GameMode, type Mentor, type SpeedClass, type StartSpec, type TrackId } from './protocol';

/*
 * What the learner picks in the Garage, and the one place it is remembered.
 *
 * Only the closed vocabulary is ever stored or read back: a hand-edited or
 * stale entry (a track that was renamed, a speed class the embed does not
 * offer) falls back to the default for that field instead of reaching the
 * game. Storage is a per-device convenience, so every read and write is
 * guarded: a private window, blocked site data or a full quota must leave the
 * Garage working with its defaults.
 */

/** The embed offers 100cc and 150cc only (contract §1). */
export const SELECTABLE_SPEEDS = ['100cc', '150cc'] as const satisfies readonly SpeedClass[];
export type SelectableSpeed = typeof SELECTABLE_SPEEDS[number];

export interface Selection {
  circuit: TrackId;
  mode: GameMode;
  /** The kart's driver. Not the Mentor who speaks: that is the learner's own Mentor. */
  driver: Mentor;
  speed: SelectableSpeed;
}

export const GARAGE_STORAGE_KEY = 'lf.kartrush.garage.v1';

export const DEFAULT_SELECTION: Selection = { circuit: 'jungleNeck', mode: 'single', driver: 'rho', speed: '100cc' };

export interface GaragePrefs {
  selection: Selection;
  muted: boolean;
  /** The learner has chosen a driver here before: their own choice, not the Mentor default. */
  rememberedDriver: boolean;
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? value as T : fallback;
}

/**
 * The remembered choice, over the defaults. `chosenMentor` is the learner's own
 * Mentor (the default driver); a remembered driver of their own wins over it.
 */
export function readGaragePrefs(storage: Pick<Storage, 'getItem'> | null, chosenMentor: Mentor | null): GaragePrefs {
  const fallback: Selection = { ...DEFAULT_SELECTION, driver: chosenMentor ?? DEFAULT_SELECTION.driver };
  let stored: unknown = null;
  try {
    const raw = storage?.getItem(GARAGE_STORAGE_KEY);
    stored = raw ? JSON.parse(raw) : null;
  } catch {
    stored = null;
  }
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return { selection: fallback, muted: false, rememberedDriver: false };
  const record = stored as Record<string, unknown>;
  return {
    selection: {
      circuit: pick(record.circuit, KR_TRACK_IDS, fallback.circuit),
      mode: pick(record.mode, KR_MODES, fallback.mode),
      driver: pick(record.driver, KR_CHARACTERS, fallback.driver),
      speed: pick(record.speed, SELECTABLE_SPEEDS, fallback.speed),
    },
    muted: record.muted === true,
    rememberedDriver: typeof record.driver === 'string' && (KR_CHARACTERS as readonly string[]).includes(record.driver),
  };
}

/** The driver is stored only once the learner picked one: until then it follows their Mentor, even if that changes. */
export function writeGaragePrefs(storage: Pick<Storage, 'setItem'> | null, prefs: Pick<GaragePrefs, 'selection' | 'muted'>, includeDriver: boolean): void {
  try {
    const { driver, ...rest } = prefs.selection;
    storage?.setItem(GARAGE_STORAGE_KEY, JSON.stringify({ ...rest, ...(includeDriver ? { driver } : {}), muted: prefs.muted }));
  } catch {
    /* A per-device convenience: nothing depends on it being saved. */
  }
}

/** The storage the browser offers, or null when even touching it throws (some privacy modes). */
export function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function startSpecOf(selection: Selection): StartSpec {
  return { mode: selection.mode, trackId: selection.circuit, character: selection.driver, speedClass: selection.speed };
}
