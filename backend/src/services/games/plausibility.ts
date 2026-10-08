import type { RunReport } from '../../games/runReport.js';

/*
 * Plausibility, not trust (docs/games/KRV1-CONTRACT.md section 3, design 6.2).
 *
 * The game is a sensor: a report is bounds-checked and stored as `reported`,
 * never as proof. These checks only refuse a report that no real race could
 * produce (a lap faster than the physical minimum, laps that do not add up to
 * the finish, a best lap that is not the fastest lap). Races award nothing, so
 * the aim is clean records, not an anti-cheat arms race; a client that
 * fabricates numbers can change its own bests and nothing else.
 *
 * Enums, ranges and the run key's shape are the zod schema's job and have
 * already passed when this runs.
 */

/** No track's lap can be shorter than this, whatever the kart (the physical minimum for the shortest circuit). */
export const MIN_LAP_MS = 20_000;
/** The finish time may differ from the sum of the laps by the crossing and replay rounding. */
export const FINISH_SUM_TOLERANCE_MS = 3_000;

/** The reasons a report is refused; codes only, never echoed text. */
export type Implausible =
  | 'lap_too_fast'
  | 'finish_too_fast'
  | 'finish_not_sum_of_laps'
  | 'best_lap_not_fastest';

export function implausibleReason(report: Pick<RunReport, 'finishMs' | 'bestLapMs' | 'lapMs'>): Implausible | null {
  const { finishMs, bestLapMs, lapMs } = report;
  if (lapMs.some((lap) => lap < MIN_LAP_MS)) return 'lap_too_fast';
  if (finishMs < MIN_LAP_MS * lapMs.length) return 'finish_too_fast';
  const sum = lapMs.reduce((total, lap) => total + lap, 0);
  if (Math.abs(finishMs - sum) > FINISH_SUM_TOLERANCE_MS) return 'finish_not_sum_of_laps';
  if (bestLapMs !== Math.min(...lapMs)) return 'best_lap_not_fastest';
  return null;
}
