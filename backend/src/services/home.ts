import { createHmac, hkdfSync } from 'node:crypto';
import type { Config } from '../config.js';
import type { AccountContext } from './vault.js';

/*
 * What the home page of a signed-in person is made of, decided here and not in the browser.
 *
 * THE COMPOSITION OF THE DAY (D-052). The stage of the home shows one composition of the mentors a
 * day: a person keeps it for the whole day and gets another one the next. It is chosen so that
 *
 *   - it is the same on every device of the person, because it depends only on who they are and on
 *     the day, never on the browser;
 *   - it does not repeat until every composition has been shown: the days are counted in cycles as
 *     long as the catalog, and inside a cycle the person goes through their own shuffle of it;
 *   - nothing is stored. No table says which days a person came in or what they saw: the order is
 *     computed from the account's id with a key only Core holds, so there is no history of a
 *     minor's visits to protect, keep or delete.
 *
 * The day is the person's own calendar day, which the browser reports and Core accepts only when it
 * is within a day of its own: all it can change is which picture is shown.
 *
 * The catalog is the list below. Each name is a pair of videos and posters the frontend serves from
 * `public/stage/loops/` (not `home/`, which is the address of the page itself) (frontend/scripts/home-catalog.mjs fails the frontend's build when the two
 * disagree). A composition is added at the end; removing one changes everybody's order from that day.
 */
export const COMPOSITIONS = [
  'exchange', 'vault', 'market', 'lemonade', 'piggybank', 'garden', 'startup', 'fair',
  'race', 'space', 'planet', 'jungle', 'sea', 'summit', 'treasure', 'balloon',
  'classroom', 'library', 'kitchen', 'camp', 'beach', 'funfair', 'concert',
  'timetravel', 'dinopark', 'detectives', 'arcade', 'heroes', 'western', 'magic',
] as const;

export type Composition = (typeof COMPOSITIONS)[number];

/** The places of the application, in the order of its menu. */
export const DESTINATIONS = ['home', 'learn', 'mentor', 'wallet', 'tasks', 'family'] as const;

export type Destination = (typeof DESTINATIONS)[number];

const DAY_MS = 24 * 60 * 60 * 1000;
// days are counted from here; any fixed day does
const EPOCH = Date.UTC(2026, 0, 1);
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The calendar day as a count of days, or null when the text is not a real date. */
function dayNumber(day: string): number | null {
  const match = DAY.exec(day);

  if (!match) return null;

  const [year, month, date] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const time = Date.UTC(year, month - 1, date);
  const back = new Date(time);

  // 2026-02-31 is not a day: Date would quietly roll it into March
  if (back.getUTCFullYear() !== year || back.getUTCMonth() !== month - 1 || back.getUTCDate() !== date) return null;

  return Math.round((time - EPOCH) / DAY_MS);
}

const dayText = (count: number): string => new Date(EPOCH + count * DAY_MS).toISOString().slice(0, 10);

export type Home = ReturnType<typeof createHome>;

export function createHome(config: Config) {
  // derived from the session secret for this one purpose, as the known-device and unsubscribe keys are
  const key = Buffer.from(hkdfSync('sha256', config.supabaseJwtSecret, 'littlefounders', 'home-composition-v1', 32));

  /** A person's own order of the catalog for one cycle: a shuffle driven by a keyed hash, the same every time it is asked. */
  function order(userId: string, cycle: number): Composition[] {
    const list: Composition[] = [...COMPOSITIONS];
    let block = Buffer.alloc(0);
    let used = 0;
    let round = 0;
    // an unbiased whole number below `bound`, from as many hash blocks as it takes
    const below = (bound: number): number => {
      const limit = 65536 - (65536 % bound);

      for (;;) {
        if (used + 2 > block.length) {
          block = createHmac('sha256', key).update(`${userId}:${cycle}:${round++}`, 'utf8').digest();
          used = 0;
        }

        const value = block.readUInt16BE(used);

        used += 2;

        if (value < limit) return value % bound;
      }
    };

    for (let i = list.length - 1; i > 0; i--) {
      const j = below(i + 1);
      const moved = list[i];
      const other = list[j];

      if (moved === undefined || other === undefined) continue;

      list[i] = other;
      list[j] = moved;
    }

    return list;
  }

  return {
    /**
     * The composition a person sees on a day. `claimedDay` is the calendar day the browser says it
     * is (YYYY-MM-DD); it is used when it is yesterday, today or tomorrow by Core's clock, which
     * covers every time zone, and Core's own day is used otherwise.
     */
    compositionOf(userId: string, claimedDay: string | undefined, now: Date = new Date()): { name: Composition; day: string; number: number; total: number } {
      const today = Math.floor((now.getTime() - EPOCH) / DAY_MS);
      const claimed = claimedDay === undefined ? null : dayNumber(claimedDay);
      const day = claimed !== null && Math.abs(claimed - today) <= 1 ? claimed : today;
      const size = COMPOSITIONS.length;
      const cycle = Math.floor(day / size);
      const place = ((day % size) + size) % size;
      const mine = order(userId, cycle);
      let name = mine[place];

      // The first day of a cycle must not show what the last day of the cycle before did: when the
      // two shuffles meet on the same composition, this cycle's first two change places.
      if (place <= 1) {
        const before = order(userId, cycle - 1)[size - 1];

        if (mine[0] === before) name = mine[1 - place];
      }

      // `number` of `total`: how far the person is through this round of the catalog, for the home to show
      return { name: name ?? COMPOSITIONS[0], day: dayText(day), number: place + 1, total: size };
    },

    /**
     * The destinations an account has. Family is for grown-ups: an account whose type is
     * `universal` (18 or over), a verified parent, or staff. This list only decides what the menu
     * shows; what a destination returns is checked again by its own routes.
     */
    /** What somebody with no account has: every place but Family, which needs a grown-up's account. */
    guestDestinations(): Destination[] {
      return DESTINATIONS.filter((destination) => destination !== 'family');
    },

    /**
     * The composition of the day for people with no account: one order of the catalog for all of
     * them, because there is nobody to tell apart and nothing is asked of them to do it.
     */
    guestCompositionOf(claimedDay: string | undefined): { name: Composition; day: string; number: number; total: number } {
      return this.compositionOf('guest', claimedDay);
    },

    destinationsOf(account: AccountContext): Destination[] {
      const isGrownUp = account.roles.some((role) => role === 'universal' || role === 'parent' || role === 'admin' || role === 'superadmin');

      return DESTINATIONS.filter((destination) => destination !== 'family' || isGrownUp);
    },
  };
}
