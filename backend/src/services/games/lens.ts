import type { LensKey, RunReport } from '../../games/runReport.js';

/*
 * The Decision Lens: which one observation the pit stop leads with
 * (docs/games/KRV1-CONTRACT.md section 5). Server-side and deterministic, in
 * one place, so the client never chooses what is said about a race.
 *
 * It is a profile for narrating, never a grade: a racing decision has no keyed
 * answer, so nothing here touches mastery, XP, coins or a streak. First match
 * wins, in this order.
 */

/** Laps within 4% of each other read as steady; 10% or more apart read as swingy. */
const STEADY_SPREAD = 0.04;
const SWINGY_SPREAD = 0.1;

export function selectLens(report: Pick<RunReport, 'lapMs' | 'lens'>): LensKey {
  const { lens, lapMs } = report;
  if (lens.boxesPassedWhileHolding >= 2) return 'item_hold';
  if (lens.driftReleases.t3 >= 1) return 'drift_patient';
  if (lens.driftReleases.t0 >= 3) return 'drift_early';
  if (lapMs.length >= 3) {
    const fastest = Math.min(...lapMs);
    const spread = (Math.max(...lapMs) - fastest) / fastest;
    if (spread <= STEADY_SPREAD) return 'steady';
    if (spread >= SWINGY_SPREAD) return 'swingy';
  }
  return 'neutral';
}

/** The numeric-only metrics row stored beside a run (database: game_metrics_valid). */
export function metricsOf(lens: RunReport['lens']): Record<string, number> {
  return {
    itemHoldMs: lens.itemHoldMs,
    boxesPassedWhileHolding: lens.boxesPassedWhileHolding,
    itemsUsed: lens.itemsUsed,
    driftT0: lens.driftReleases.t0,
    driftT1: lens.driftReleases.t1,
    driftT2: lens.driftReleases.t2,
    driftT3: lens.driftReleases.t3,
    recoveries: lens.recoveries,
  };
}
