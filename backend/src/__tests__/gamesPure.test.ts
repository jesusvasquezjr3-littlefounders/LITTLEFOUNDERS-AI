import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DriftReleases, DRIFT_FIELDS, Lens, LENS_FIELDS, LENS_KEYS, RunReport, RUN_REPORT_FIELDS, TRACK_IDS } from '../games/runReport.js';
import { earliestLocalDayStartIso, normalizeLocale, startOfLocalDayIso } from '../lib/localDay.js';
import { selectLens, metricsOf } from '../services/games/lens.js';
import { capsFor, dailySessionCap, sessionState } from '../services/games/limits.js';
import { FINISH_SUM_TOLERANCE_MS, implausibleReason, MIN_LAP_MS } from '../services/games/plausibility.js';

/*
 * The pure parts of the games feature, table-driven: the lens selection
 * (docs/games/KRV1-CONTRACT.md section 5), the plausibility rules and play
 * limits (section 3), and the run-report schema pinned to the contract manifest.
 */

const lens = (overrides: Partial<{ hold: number; box: number; used: number; t0: number; t1: number; t2: number; t3: number; rec: number }> = {}) => ({
  itemHoldMs: overrides.hold ?? 0,
  boxesPassedWhileHolding: overrides.box ?? 0,
  itemsUsed: overrides.used ?? 0,
  driftReleases: { t0: overrides.t0 ?? 0, t1: overrides.t1 ?? 0, t2: overrides.t2 ?? 0, t3: overrides.t3 ?? 0 },
  recoveries: overrides.rec ?? 0,
});

describe('selectLens — first match wins', () => {
  const steadyLaps = [60_000, 60_000, 60_000];
  const swingyLaps = [60_000, 70_000, 60_000];
  it.each([
    ['holding an item through two boxes', lens({ box: 2 }), steadyLaps, 'item_hold'],
    ['one box passed is not enough for item_hold', lens({ box: 1 }), steadyLaps, 'steady'],
    ['a tier-3 drift release', lens({ t3: 1 }), steadyLaps, 'drift_patient'],
    ['three early (tier-0) releases', lens({ t0: 3 }), steadyLaps, 'drift_early'],
    ['two early releases are not enough', lens({ t0: 2 }), steadyLaps, 'steady'],
    ['laps within 4%', lens(), [60_000, 61_000, 62_400], 'steady'],
    ['laps exactly 4% apart are still steady', lens(), [50_000, 51_000, 52_000], 'steady'],
    ['laps just over 4% apart are neither', lens(), [50_000, 51_000, 52_100], 'neutral'],
    ['laps 10% apart are swingy', lens(), [50_000, 52_000, 55_000], 'swingy'],
    ['laps just under 10% apart are neutral', lens(), [50_000, 52_000, 54_900], 'neutral'],
    ['a wide spread', lens(), swingyLaps, 'swingy'],
    ['two laps never read as steady or swingy', lens(), [60_000, 90_000], 'neutral'],
    ['a single lap', lens(), [90_000], 'neutral'],
    ['five steady laps', lens(), [60_000, 60_100, 60_000, 60_200, 60_000], 'steady'],
  ])('%s -> %s', (_label, l, lapMs, expected) => {
    expect(selectLens({ lens: l, lapMs })).toBe(expected);
  });

  it.each([
    ['item_hold beats drift_patient', lens({ box: 3, t3: 2, t0: 5 }), steadyLaps, 'item_hold'],
    ['drift_patient beats drift_early', lens({ t3: 1, t0: 4 }), steadyLaps, 'drift_patient'],
    ['drift_early beats steady', lens({ t0: 3 }), steadyLaps, 'drift_early'],
    ['drift_early beats swingy', lens({ t0: 3 }), swingyLaps, 'drift_early'],
    ['drift_patient beats swingy', lens({ t3: 1 }), swingyLaps, 'drift_patient'],
  ])('precedence: %s', (_label, l, lapMs, expected) => {
    expect(selectLens({ lens: l, lapMs })).toBe(expected);
  });

  it('can only return a lens the contract names, and every one of them is reachable', () => {
    const seen = new Set([
      selectLens({ lens: lens({ box: 2 }), lapMs: steadyLaps }), selectLens({ lens: lens({ t3: 1 }), lapMs: steadyLaps }),
      selectLens({ lens: lens({ t0: 3 }), lapMs: steadyLaps }), selectLens({ lens: lens(), lapMs: steadyLaps }),
      selectLens({ lens: lens(), lapMs: swingyLaps }), selectLens({ lens: lens(), lapMs: [60_000] }),
    ]);
    expect([...seen].sort()).toEqual([...LENS_KEYS].sort());
  });

  it('metricsOf is a flat, numeric-only row (the database accepts nothing else)', () => {
    const metrics = metricsOf(lens({ hold: 4100, box: 2, used: 3, t0: 1, t1: 2, t2: 3, t3: 4, rec: 5 }));
    expect(metrics).toEqual({
      itemHoldMs: 4100, boxesPassedWhileHolding: 2, itemsUsed: 3, driftT0: 1, driftT1: 2, driftT2: 3, driftT3: 4, recoveries: 5,
    });
    expect(Object.values(metrics).every((v) => typeof v === 'number')).toBe(true);
    expect(Object.keys(metrics).every((k) => /^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(k))).toBe(true);
  });
});

describe('implausibleReason', () => {
  const ok = { finishMs: 93_000, bestLapMs: 30_000, lapMs: [30_000, 31_000, 32_000] };
  it('accepts a coherent race', () => expect(implausibleReason(ok)).toBeNull());
  it.each([
    ['a lap under 20 s', { ...ok, lapMs: [19_999, 31_000, 42_000], bestLapMs: 19_999 }, 'lap_too_fast'],
    ['a lap of exactly 20 s is allowed', { finishMs: 60_000, bestLapMs: 20_000, lapMs: [20_000, 20_000, 20_000] }, null],
    ['a finish under 20 s per lap', { finishMs: 59_000, bestLapMs: 20_000, lapMs: [20_000, 20_000, 20_000] }, 'finish_too_fast'],
    ['a finish 3 s above the sum is allowed', { ...ok, finishMs: 96_000 }, null],
    ['a finish 3 s below the sum is allowed', { ...ok, finishMs: 90_000 }, null],
    ['a finish over 3 s above the sum', { ...ok, finishMs: 96_001 }, 'finish_not_sum_of_laps'],
    ['a finish over 3 s below the sum', { ...ok, finishMs: 89_999 }, 'finish_not_sum_of_laps'],
    ['a best lap that is not the minimum (slower)', { ...ok, bestLapMs: 31_000 }, 'best_lap_not_fastest'],
    ['a best lap that is not the minimum (faster than any lap)', { ...ok, bestLapMs: 29_000 }, 'best_lap_not_fastest'],
  ])('%s', (_label, report, expected) => {
    expect(implausibleReason(report)).toBe(expected);
  });
  it('states the contract numbers', () => {
    expect(MIN_LAP_MS).toBe(20_000);
    expect(FINISH_SUM_TOLERANCE_MS).toBe(3_000);
  });
});

describe('play limits', () => {
  it.each([
    [25, 15, 25], [20, 15, 20], [19, 14, 19], [10, 5, 10], [6, 1, 6], [5, 1, 5],
  ])('a hard stop of %i minutes has a soft break at %i', (hard, soft, hardMinutes) => {
    expect(capsFor(hard)).toEqual({ softMs: soft * 60_000, hardMs: hardMinutes * 60_000, idleMs: 600_000 });
  });

  it('never exceeds the platform ceiling nor drops below the floor, whatever it is given', () => {
    expect(capsFor(60).hardMs).toBe(25 * 60_000);
    expect(capsFor(1).hardMs).toBe(5 * 60_000);
    expect(dailySessionCap({ maxSessionsPerDay: 9, maxSessionMinutes: 25 })).toBe(2);
    expect(dailySessionCap({ maxSessionsPerDay: 0, maxSessionMinutes: 25 })).toBe(0);
    expect(dailySessionCap({ maxSessionsPerDay: -3, maxSessionMinutes: 25 })).toBe(0);
  });

  it.each([
    [0, 0, 'ok'], [899, 0, 'ok'], [900, 0, 'soft'], [1499, 0, 'soft'], [1500, 0, 'hard'],
    [100, 600_000, 'ok'], [100, 600_001, 'idle'], [1500, 900_000, 'hard'], [900, 700_000, 'idle'],
  ])('%i active seconds with a %i ms gap is %s (25-minute session)', (activeSeconds, idleGapMs, expected) => {
    expect(sessionState({ activeSeconds, maxSessionMinutes: 25, idleGapMs })).toBe(expected);
  });
});

describe('the run-report schema is the contract', () => {
  const manifest = JSON.parse(readFileSync(fileURLToPath(new URL('../../../docs/games/krv1.manifest.json', import.meta.url)), 'utf8'));
  const sorted = (a: readonly string[]) => [...a].sort();

  it('lists exactly the fields of the manifest, and the zod shapes list exactly the same', () => {
    expect(sorted(RUN_REPORT_FIELDS)).toEqual(sorted(manifest.gameToHost['kr.runFinished']));
    expect(sorted(Object.keys(RunReport.shape))).toEqual(sorted(RUN_REPORT_FIELDS));
    expect(sorted(LENS_FIELDS)).toEqual(sorted(manifest.lens));
    expect(sorted(Object.keys(Lens.shape))).toEqual(sorted(LENS_FIELDS));
    expect(sorted(DRIFT_FIELDS)).toEqual(sorted(manifest.driftReleases));
    expect(sorted(Object.keys(DriftReleases.shape))).toEqual(sorted(DRIFT_FIELDS));
  });

  it('names the six KartRush tracks the contract lists', () => {
    expect([...TRACK_IDS]).toEqual(['jungleNeck', 'boulevard', 'fossilFire', 'factory', 'saltBay', 'glacier']);
  });
});

describe('the learner-local day (shared with the Mentor\'s cap)', () => {
  it('moves at the learner\'s midnight, not the server\'s UTC midnight', () => {
    // 22:30 in Mexico City (UTC-6) is already the next UTC day; the local day began at 06:00Z the day before.
    expect(startOfLocalDayIso('es-MX', new Date('2026-10-06T04:30:00.000Z'))).toBe('2026-10-05T06:00:00.000Z');
    expect(startOfLocalDayIso('es-MX', new Date('2026-10-06T07:00:00.000Z'))).toBe('2026-10-06T06:00:00.000Z');
    expect(startOfLocalDayIso('es-MX', new Date('2026-10-06T07:00:00.000Z'), 1)).toBe('2026-10-07T06:00:00.000Z');
  });
  it.each([
    ['mid-afternoon UTC', '2026-10-06T18:00:00.000Z'],
    ['just before Mexico City midnight', '2026-10-06T05:59:00.000Z'],
    ['just after Mexico City midnight', '2026-10-06T06:01:00.000Z'],
    ['between the zones\' midnights (Sao Paulo already tomorrow, New York not yet)', '2026-10-06T03:30:00.000Z'],
    ['the small hours in New York', '2026-10-06T07:30:00.000Z'],
    ['a month end', '2026-10-31T23:30:00.000Z'],
  ])('the earliest window start is the minimum of the three zones (%s)', (_label, iso) => {
    const now = new Date(iso);
    const locales = ['en-US', 'es-MX', 'pt-BR'] as const;
    const starts = locales.map((l) => startOfLocalDayIso(l, now));
    expect(earliestLocalDayStartIso(now)).toBe([...starts].sort()[0]);
    const next = locales.map((l) => startOfLocalDayIso(l, now, 1));
    expect(earliestLocalDayStartIso(now, 1)).toBe([...next].sort()[0]);
    // The window opens no later than any single locale's day, and the reset instant is after the window start.
    for (const start of starts) expect(earliestLocalDayStartIso(now) <= start).toBe(true);
    expect(earliestLocalDayStartIso(now, 1) > earliestLocalDayStartIso(now)).toBe(true);
  });

  it('a locale switch near a boundary cannot move the window later', () => {
    // 04:30Z: in Mexico City it is still 22:30 of the 5th; in Sao Paulo already 01:30 of the 6th.
    const now = new Date('2026-10-06T04:30:00.000Z');
    expect(startOfLocalDayIso('es-MX', now)).toBe('2026-10-05T06:00:00.000Z');
    expect(startOfLocalDayIso('pt-BR', now)).toBe('2026-10-06T03:00:00.000Z');
    expect(earliestLocalDayStartIso(now) <= startOfLocalDayIso('es-MX', now)).toBe(true);
    expect(earliestLocalDayStartIso(now) <= startOfLocalDayIso('pt-BR', now)).toBe(true);
  });

  it('maps a profile locale, defaulting to the platform default', () => {
    expect(normalizeLocale('en-US')).toBe('en-US');
    expect(normalizeLocale('pt-BR')).toBe('pt-BR');
    expect(normalizeLocale('fr-FR')).toBe('es-MX');
    expect(normalizeLocale(null)).toBe('es-MX');
  });
});
