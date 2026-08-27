import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PLAUSIBLE_PERIODS,
  fillDailySeries,
  getPlausibleBreakdown,
  getPlausibleOverview,
  resetPulseForTests,
  resolveRange,
  todayInZone,
  type PlausiblePeriod,
} from '../services/pulse.js';
import { jsonResponse } from './helpers.js';

/*
 * The window this console reports on, asserted against the window the upstream
 * actually answers for.
 *
 * Every test here exists because of one production defect, found by an outside
 * reader of our own exports on 2026-08-25 and root-caused on 2026-08-27.
 * `resolveRange` computed its bounds locally, in UTC, then handed Plausible the
 * literal preset string `"6mo"` and let Plausible resolve it independently, in
 * the site's timezone, by different rules. Plausible answered for February
 * through July. Core believed the window ran to today. `fillDailySeries` padded
 * the gap, and the console reported that nobody had visited the site in August.
 *
 * The whole class was invisible to the existing suite for one reason worth
 * naming: every range test used `custom` ranges, where Core's bounds are
 * explicit dates and therefore correct by construction. Not one exercised a
 * preset — the only shape where the two systems could disagree. The tests
 * asserted that Core agreed with itself.
 */

const SITE_TZ = 'America/Mexico_City';

/** 2026-08-13T15:30Z — same calendar day in UTC and in Mexico City. */
const NOON_UTC = Date.UTC(2026, 7, 13, 15, 30);

/**
 * 2026-08-14T02:00Z, which is still 2026-08-13 in Mexico City.
 *
 * The six hours a day where a UTC-resolved window runs one day ahead of the
 * data. In production this made "today" render as a zero-traffic day on every
 * range, permanently — a small, constant lie that is exactly the kind a
 * reader treats as a real drop.
 */
const AFTER_MIDNIGHT_UTC = Date.UTC(2026, 7, 14, 2, 0);

const DAY_MS = 86_400_000;
const asDay = (value: string): number => Date.parse(`${value}T00:00:00Z`);

describe('resolveRange — the window we ask for', () => {
  it('never hands Plausible a preset shorthand, only explicit dates', () => {
    // The fix, stated as an invariant: one system resolves the window and both
    // use it. A shorthand reintroduced here is the original defect returning.
    for (const period of PLAUSIBLE_PERIODS) {
      const resolved = resolveRange({ kind: 'preset', period }, NOON_UTC, SITE_TZ);
      expect(Array.isArray(resolved.dateRange), `${period} must resolve to a date pair`).toBe(true);
      for (const bound of resolved.dateRange) {
        expect(bound, `${period} bound ${bound}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it('ends every window on today, in the SITE timezone', () => {
    const today = todayInZone(SITE_TZ, NOON_UTC);
    for (const period of PLAUSIBLE_PERIODS) {
      const resolved = resolveRange({ kind: 'preset', period }, NOON_UTC, SITE_TZ);
      expect(resolved.to, `${period} must run to today`).toBe(today);
    }
  });

  it('resolves against the site timezone rather than UTC', () => {
    // 02:00Z on the 14th is still the 13th in Mexico City. Asking Plausible
    // about the 14th returns nothing for it, which then padded to a zero.
    expect(todayInZone(SITE_TZ, AFTER_MIDNIGHT_UTC)).toBe('2026-08-13');
    expect(resolveRange({ kind: 'preset', period: '30d' }, AFTER_MIDNIGHT_UTC, SITE_TZ).to).toBe('2026-08-13');
  });

  it('includes the CURRENT month in 6mo and 12mo', () => {
    // The regression itself. Plausible reads these as complete calendar months
    // only and stops at the end of last month; an operator asking for "the last
    // 6 months" on 13 August means a window that contains August.
    const sixMonths = resolveRange({ kind: 'preset', period: '6mo' }, NOON_UTC, SITE_TZ);
    expect(sixMonths.dateRange).toEqual(['2026-03-01', '2026-08-13']);

    const twelveMonths = resolveRange({ kind: 'preset', period: '12mo' }, NOON_UTC, SITE_TZ);
    expect(twelveMonths.dateRange).toEqual(['2025-09-01', '2026-08-13']);
  });

  it('never lets the comparison window overlap the window it compares against', () => {
    /*
     * The second defect that fell out of the first. `6mo` reported a
     * period-over-period delta whose "previous" window (2025-09-04 to
     * 2026-02-28) contained all of February, while the window it was compared
     * against actually STARTED on 1 February. February was counted on both
     * sides of its own comparison.
     */
    for (const period of PLAUSIBLE_PERIODS) {
      const resolved = resolveRange({ kind: 'preset', period }, NOON_UTC, SITE_TZ);
      if (!resolved.previous) {
        expect(period, 'only all-time has no comparison').toBe('all');
        continue;
      }
      const [prevFrom, prevTo] = resolved.previous;
      expect(asDay(prevTo), `${period}: comparison must end before the window starts`).toBeLessThan(
        asDay(resolved.from),
      );
      // Adjacent, so no day falls between the two windows and goes unreported.
      expect(asDay(prevTo)).toBe(asDay(resolved.from) - DAY_MS);
      // Equal length, or the delta compares differently sized windows.
      expect(asDay(prevTo) - asDay(prevFrom)).toBe(asDay(resolved.to) - asDay(resolved.from));
    }
  });

  it('keys the cache by the RESOLVED dates, not by the label', () => {
    // `30d` means different days on different days. Keyed by the label alone,
    // a cached answer outlives the window it describes.
    const monday = resolveRange({ kind: 'preset', period: '30d' }, NOON_UTC, SITE_TZ);
    const tuesday = resolveRange({ kind: 'preset', period: '30d' }, NOON_UTC + DAY_MS, SITE_TZ);
    expect(monday.key).not.toBe(tuesday.key);
  });
});

describe('fillDailySeries — padding is only honest inside the answered window', () => {
  it('reports a quiet day as zero rather than as a missing day', () => {
    const resolved = resolveRange({ kind: 'custom', from: '2026-08-01', to: '2026-08-04' }, NOON_UTC, SITE_TZ);
    const filled = fillDailySeries([{ date: '2026-08-02', visitors: 3, pageviews: 9 }], resolved);
    expect(filled.map((p) => p.date)).toEqual(['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04']);
    expect(filled.map((p) => p.visitors)).toEqual([0, 3, 0, 0]);
  });

  it('pads a preset window to today, so the chart cannot end early', () => {
    const resolved = resolveRange({ kind: 'preset', period: '7d' }, NOON_UTC, SITE_TZ);
    const filled = fillDailySeries([{ date: '2026-08-08', visitors: 2, pageviews: 4 }], resolved);
    expect(filled[0]?.date).toBe('2026-08-07');
    expect(filled[filled.length - 1]?.date).toBe('2026-08-13');
  });

  it('keeps a row that falls outside the window instead of deleting real traffic', () => {
    // Filling is a floor on what is DRAWN, never a filter on what was MEASURED.
    const resolved = resolveRange({ kind: 'custom', from: '2026-08-02', to: '2026-08-03' }, NOON_UTC, SITE_TZ);
    const filled = fillDailySeries([{ date: '2026-07-30', visitors: 9, pageviews: 11 }], resolved);
    expect(filled.map((p) => p.date)).toContain('2026-07-30');
  });
});

/*
 * The upstream's own account of its answer, which this service used to discard.
 */
describe('what Plausible says about its answer', () => {
  const ranges: Record<string, unknown> = {};
  /** Every date_range that went out, in order — the aggregate is queried twice. */
  let sentRanges: unknown[] = [];

  function stubPlausible(meta: unknown, echoedRange: [string, string] | null): void {
    sentRanges = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: { body?: string }) => {
        const body = JSON.parse(init?.body ?? '{}') as { dimensions?: string[]; date_range?: [string, string]; filters?: unknown };
        ranges[body.dimensions?.[0] ?? 'aggregate'] = body.date_range;
        ranges.filters = body.filters;
        sentRanges.push(body.date_range);
        return Promise.resolve(
          jsonResponse(200, {
            results: [{ dimensions: body.dimensions?.length ? ['x'] : [], metrics: [10, 20, 30, 40] }],
            meta,
            query: { date_range: echoedRange ?? body.date_range },
          }),
        );
      }),
    );
  }

  beforeEach(() => {
    resetPulseForTests();
    vi.stubEnv('PLAUSIBLE_URL', 'http://plausible.test');
    vi.stubEnv('PLAUSIBLE_API_KEY', 'plausible-key-0123456789');
    vi.stubEnv('PLAUSIBLE_SITE_ID', 'littlefounders.ai');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    resetPulseForTests();
  });

  it('carries the imports verdict instead of dropping it', async () => {
    /*
     * A breakdown summing to 48 under a headline of 1,120 is not wrong, it is
     * INCOMPLETE — and only this field can say which. Discarding it is how an
     * outside reviewer came to report that dimensional tracking had been
     * switched on late, when nothing had been switched on at all.
     */
    stubPlausible(
      {
        imports_included: false,
        imports_skip_reason: 'unsupported_query',
        imports_warning: 'Imported stats are not included in the results because query parameters are not supported.',
      },
      null,
    );
    const overview = await getPlausibleOverview({ kind: 'preset', period: '6mo' });
    expect(overview?.imports.importsIncluded).toBe(false);
    expect(overview?.imports.importsSkipReason).toBe('unsupported_query');
    expect(overview?.imports.importsWarning).toContain('Imported stats are not included');
  });

  it('treats an absent verdict as "not included", never as a silent yes', async () => {
    stubPlausible({}, null);
    const overview = await getPlausibleOverview({ kind: 'preset', period: '30d' });
    expect(overview?.imports.importsIncluded).toBe(false);
  });

  it('raises no drift when the echoed window matches the requested one', async () => {
    stubPlausible({ imports_included: true }, null);
    const overview = await getPlausibleOverview({ kind: 'preset', period: '6mo' });
    expect(overview?.rangeDrift).toBeNull();
  });

  it('REPORTS a window mismatch rather than relabelling the chart', async () => {
    /*
     * The assertion that was missing. In production this exact disagreement —
     * asked to today, answered to the end of last month — went undetected for
     * two weeks because nothing ever compared the two. It is normally a no-op,
     * which is the point: it costs nothing and it is the only thing that
     * notices a site timezone change, an API semantics change, or a future
     * refactor that reintroduces a shorthand.
     */
    stubPlausible({ imports_included: true }, ['2026-02-01', '2026-07-31']);
    const overview = await getPlausibleOverview({ kind: 'preset', period: '6mo' });
    expect(overview?.rangeDrift).not.toBeNull();
    expect(overview?.rangeDrift?.answeredFor).toEqual(['2026-02-01', '2026-07-31']);
    expect(overview?.rangeDrift?.askedFor[1]).toBe(todayInZone(SITE_TZ));
  });

  it('applies the allowlist to the session dimension a breakdown is grouped by', async () => {
    /*
     * `ACQUISITION_SCOPE` filters `event:page` — the page a pageview happened
     * on. `visit:entry_page` describes where a SESSION began, and a session
     * satisfies an event-level filter as soon as ANY of its events match. So a
     * visitor who landed on `/` and then worked in the staff console reported
     * an entry page of `/admin/analytics` inside a report headed "public
     * marketing traffic only". Measured over twelve months before this fix: 7
     * of 11 entry-page rows and 11 of 17 exit-page rows were out of boundary.
     */
    stubPlausible({ imports_included: false, imports_skip_reason: 'unsupported_query' }, null);
    await getPlausibleBreakdown({ kind: 'preset', period: '30d' }, 'entry_page', 10);

    const filters = JSON.stringify(ranges.filters);
    expect(filters, 'the entry-page dimension must be scoped to itself').toContain('visit:entry_page');
    expect(filters, 'the always-on event scope must survive alongside it').toContain('event:page');
  });

  it('leaves non-session dimensions on the always-on scope alone', async () => {
    stubPlausible({ imports_included: true }, null);
    await getPlausibleBreakdown({ kind: 'preset', period: '30d' }, 'source', 10);
    const filters = JSON.stringify(ranges.filters);
    expect(filters).toContain('event:page');
    expect(filters).not.toContain('visit:entry_page');
  });

  it('sends the same resolved dates to the series and the headline aggregate', async () => {
    // Two halves of one panel describing different windows is the defect this
    // whole file is about, in miniature. Three queries go out — the headline
    // aggregate, the daily series, and the comparison aggregate — and only the
    // first two may describe the current window.
    stubPlausible({ imports_included: true }, null);
    const period: PlausiblePeriod = '6mo';
    const resolved = resolveRange({ kind: 'preset', period });
    await getPlausibleOverview({ kind: 'preset', period });

    expect(ranges['time:day']).toEqual(resolved.dateRange);
    expect(sentRanges).toContainEqual(resolved.dateRange);
    expect(sentRanges).toContainEqual(resolved.previous);
  });
});
