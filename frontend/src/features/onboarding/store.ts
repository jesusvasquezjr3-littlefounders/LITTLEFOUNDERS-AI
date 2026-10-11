import { useSyncExternalStore } from 'react';
import * as z from 'zod/mini';

/*
 * What a person answered in the onboarding, before any account exists. It lives in this browser
 * only (`localStorage`, key `lf.onboarding`) and is never sent anywhere until the person creates an
 * account, and then only to Core as that account's own profile. It must never be put in an
 * analytics event, an address or a log line: for a child this is personal data, and it stays
 * outside the law's idea of "collected" only for as long as it stays on the device.
 *
 * It is kept for 30 days from the last answer and then forgotten, and the person can erase it
 * whenever they want (the notice on the home page, and the last step). A computer may be shared:
 * whoever creates an account days later may not be the person who answered. So the answers are
 * given to a new account without asking only in the same sitting (`isSameSitting`); later, the
 * sign-up asks the age with an empty field, and the answers are used only if the age typed is the
 * one that was kept.
 */
export const MENTORS = ['zara', 'rho', 'liruf', 'dina'] as const;

export type Mentor = (typeof MENTORS)[number];

export const PATHS = ['learner', 'parent'] as const;

export type Path = (typeof PATHS)[number];

export const MIN_AGE = 6;

export const MAX_AGE = 100;

export const ADULT_AGE = 18;

/** A first name or a nickname: letters, spaces, apostrophes, periods and hyphens, 40 at most. The database checks the same. */
export const NAME = /^\p{L}[\p{L}\p{M} '’.-]{0,39}$/u;

/** A period followed by two letters or more: a web address, not a name. "J.R." and "Dr. Ana" are fine. */
const LOOKS_LIKE_AN_ADDRESS = /\.\p{L}{2,}/u;

/** Words that would pass for the product or its staff, in the three languages. */
const RESERVED = /(^|[^\p{L}])(admin|administrator|administrador|moderator|moderador|support|soporte|suporte|staff|official|oficial|system|sistema|littlefounders|mentoria|mentorai)([^\p{L}]|$)|little[ .'’-]*founders/iu;

/** A name written with the right characters that still cannot be used. The database refuses the same ones. */
export function isReservedName(name: string): boolean {
  return LOOKS_LIKE_AN_ADDRESS.test(name) || RESERVED.test(name);
}

const Answers = z.object({
  version: z.literal(1),
  path: z.enum(PATHS),
  age: z.optional(z.number().check(z.int(), z.gte(MIN_AGE), z.lte(MAX_AGE))),
  name: z.optional(z.string().check(z.regex(NAME), z.refine((name) => !isReservedName(name)))),
  mentor: z.optional(z.enum(MENTORS)),
  /** The person reached the last step and chose "later". */
  finished: z.boolean(),
  savedAt: z.number(),
});

export type Answers = z.infer<typeof Answers>;

const KEY = 'lf.onboarding';

const KEEP_MS = 30 * 24 * 60 * 60 * 1000;

/** Marks the tab in which the onboarding was finished. It dies with the tab. */
const SITTING_KEY = 'lf.onboarding.sitting';

const SITTING_MS = 30 * 60 * 1000;

function sittingStartedAt(): number | null {
  try {
    const raw = window.sessionStorage.getItem(SITTING_KEY);

    return raw !== null && /^\d{1,16}$/.test(raw) ? Number(raw) : null;
  } catch {
    return null;
  }
}

/** The person typed, at sign-up, the same age the answers hold. In memory only: it lasts until the page is left. */
let ageConfirmed = false;

function markSitting(startedAt: number | null): void {
  try {
    if (startedAt === null) window.sessionStorage.removeItem(SITTING_KEY);
    else window.sessionStorage.setItem(SITTING_KEY, String(startedAt));
  } catch {
    // No storage: every sign-up asks the age, which is the careful side.
  }
}

const listeners = new Set<() => void>();

/** What was last read from storage, so the same text is not parsed twice and React gets a stable value. */
type Cached = { raw: string | null; value: Answers | null };

let cache: Cached = { raw: null, value: null };

function read(): Answers | null {
  let raw: string | null = null;

  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    // Storage can be blocked: the onboarding then works for this visit and remembers nothing.
    return cache.value;
  }

  if (raw === cache.raw) return cache.value;

  let value: Answers | null = null;

  if (raw !== null) {
    try {
      const parsed = Answers.safeParse(JSON.parse(raw));

      if (parsed.success && Date.now() - parsed.data.savedAt < KEEP_MS) value = parsed.data;
    } catch {
      value = null;
    }
  }

  cache = { raw, value };

  return value;
}

function write(next: Answers | null): void {
  cache = { raw: next ? JSON.stringify(next) : null, value: next };

  try {
    if (cache.raw === null) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, cache.raw);
  } catch {
    // Kept in memory for this visit only.
  }

  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

export const onboarding = {
  get: read,

  /** Starts on a path, keeping the answers already given when the path is the same. */
  begin(path: Path): Answers {
    const current = read();

    const next: Answers = current && current.path === path
      ? { ...current, finished: false, savedAt: Date.now() }
      : { version: 1, path, finished: false, savedAt: Date.now() };

    // The other path was walked before: what was already answered is not asked again.
    if (current && current.path !== path) {
      if (current.age !== undefined) next.age = current.age;

      if (current.name !== undefined) next.name = current.name;

      if (current.mentor !== undefined) next.mentor = current.mentor;
    }

    write(next);

    return next;
  },

  answer(patch: Partial<Pick<Answers, 'age' | 'name' | 'mentor' | 'finished' | 'path'>>): void {
    const current = read();

    if (!current) return;

    if (patch.finished === true) markSitting(Date.now());

    write({ ...current, ...patch, savedAt: Date.now() });
  },

  /**
   * True when the onboarding was finished in this tab within the last half hour: the person at the
   * screen is the one who answered. Only then are the answers given to a new account without asking.
   */
  isSameSitting(): boolean {
    const startedAt = sittingStartedAt();
    const elapsed = startedAt === null ? null : Date.now() - startedAt;

    return read()?.finished === true && elapsed !== null && elapsed >= 0 && elapsed < SITTING_MS;
  },

  /** The age was refused when the account was created: the sign-in window asks for it again. */
  forgetAge(): void {
    const current = read();

    if (!current) return;

    const { age: _age, ...rest } = current;

    write({ ...rest, savedAt: Date.now() });
  },

  /** The sign-up asked the age and got the one these answers hold: they are this person's. */
  confirmAge(): void {
    ageConfirmed = true;
  },

  /** True when the answers may be given to a new account: the same sitting, or the age was confirmed. */
  isOwnerPresent(): boolean {
    return ageConfirmed || this.isSameSitting();
  },

  clear(): void {
    ageConfirmed = false;
    markSitting(null);
    write(null);
  },
};

/** The answers kept in this browser, or null. Re-renders when they change, in this tab or another. */
export function useOnboardingAnswers(): Answers | null {
  return useSyncExternalStore(subscribe, read, () => null);
}
