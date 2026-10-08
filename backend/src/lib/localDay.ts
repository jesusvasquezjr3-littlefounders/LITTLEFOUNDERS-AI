/*
 * The learner-local day boundary, shared by every daily cap (the Mentor's sessions
 * in routes/tutor.ts, the games' sessions in routes/games.ts). Moved here from
 * routes/tutor.ts so a second caller does not import that whole route module;
 * routes/tutor.ts re-exports it, so its callers and tests are unchanged. One
 * change on the way: the offset ignores the fractional second, so a boundary is
 * an exact local midnight and not midnight plus whatever millisecond `now` had.
 */

/**
 * Start of "today" in the calendar day the LEARNER experiences, not the
 * server's UTC day.
 *
 * Found by adversarial review, round 34 (2026-08-30, MEDIUM-HIGH,
 * systematic — not a rare boundary case). This used to be a plain
 * `Date.UTC(...)` midnight, and UTC midnight falls in the afternoon or
 * evening local time for all three of this platform's locales (roughly
 * 13:00-21:00 depending on locale and DST). So an entirely ordinary
 * morning session and evening session, both on the SAME local calendar
 * day, were treated as two different cap windows — letting a third or
 * fourth session through on what is, for that learner, still today. This
 * was reachable through completely ordinary use, every day, for the large
 * majority of the real user base, not an edge case near a boundary.
 *
 * There is no stored per-user timezone (a bigger feature than this fix
 * adds), so the locale maps to one representative IANA zone — an
 * approximation for `en-US`, which spans several US timezones, but still
 * strictly more correct than a UTC boundary for the other two locales, and
 * no worse than UTC was for the one it cannot represent precisely.
 */
const LOCALE_TIMEZONE: Record<'en-US' | 'es-MX' | 'pt-BR', string> = {
  'es-MX': 'America/Mexico_City',
  'pt-BR': 'America/Sao_Paulo',
  'en-US': 'America/New_York',
};

/**
 * `daysAhead` (default 0, "today") lets the SAME offset-derivation serve the
 * daily cap's own reset instant: `daysAhead: 1` is "tomorrow's local
 * midnight" — the exact moment `MAX_SESSIONS_PER_DAY` allows another session,
 * because `sinceIso` above is this same function's `daysAhead: 0`. `Date.UTC`
 * accepts an out-of-range day and rolls the month/year forward correctly, so
 * a request on the last day of the month needs no special case.
 *
 * Reuses `now`'s own UTC offset for the target day rather than recomputing
 * it for that day specifically — the same approximation this function's own
 * header comment already accepts for `daysAhead: 0` (no DST-transition-day
 * correction). A SESSION_LIMIT reset estimate off by an hour on the handful
 * of nights a locale's clocks change is a UI approximation, not a cap
 * enforcement bug — the cap itself is still enforced against the real
 * boundary computed fresh on the request that matters.
 */
export function startOfLocalDayIso(
  locale: 'en-US' | 'es-MX' | 'pt-BR',
  now: Date = new Date(),
  daysAhead = 0,
): string {
  const timeZone = LOCALE_TIMEZONE[locale];
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  // The clock reading `now` HAS in `timeZone`, reinterpreted as if it were
  // UTC, reveals that zone's current UTC offset — derived from `now` itself
  // rather than a fixed table, so it is correct across a DST transition.
  // `% 24` guards against `Intl`'s documented midnight-as-"24" quirk under
  // `hour12: false`.
  const asIfUtcMs = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  // Whole seconds only: the formatted clock has none, so a fractional second in `now` would leak into the boundary.
  const offsetMs = asIfUtcMs - Math.floor(now.getTime() / 1000) * 1000;
  const localMidnightUtcMs =
    Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + daysAhead, 0, 0, 0) - offsetMs;
  return new Date(localMidnightUtcMs).toISOString();
}

export type PlatformLocale = 'en-US' | 'es-MX' | 'pt-BR';

/** The platform locale a profile value stands for; anything unknown is the default, es-MX (as the Mentor's). */
export function normalizeLocale(raw: string | null | undefined): PlatformLocale {
  return raw === 'en-US' || raw === 'pt-BR' ? raw : 'es-MX';
}

const PLATFORM_LOCALES: readonly PlatformLocale[] = ['en-US', 'es-MX', 'pt-BR'];

/**
 * The earliest of the three platform zones' day boundaries, for daily caps a
 * learner could otherwise reset by changing their own profile locale (the day
 * boundary comes from the locale, and a child can change it). Using the
 * earliest start makes the window the longest one any locale would see, so
 * switching to a "later" zone near midnight can never open a fresh day, and
 * `daysAhead: 1` (the reset instant shown to the child) is the earliest next
 * start, matching the window the count actually uses. The Mentor's own cap
 * keeps `startOfLocalDayIso` as it was.
 */
export function earliestLocalDayStartIso(now: Date = new Date(), daysAhead = 0): string {
  return PLATFORM_LOCALES.map((locale) => startOfLocalDayIso(locale, now, daysAhead)).sort()[0]!;
}
