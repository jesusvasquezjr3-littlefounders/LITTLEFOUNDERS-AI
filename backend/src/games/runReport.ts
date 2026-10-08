import { z } from 'zod';

/*
 * The kr.v1 run report, Core's copy (docs/games/KRV1-CONTRACT.md section 2).
 *
 * Hand-mirrored with the game protocol in the SPA (frontend/src/games/kartrush/
 * protocol.ts) and pinned to docs/games/krv1.manifest.json by
 * agent/tools/check-game-protocol-parity.mjs (npm run games:parity). The field
 * lists below are literal arrays on purpose: the gate reads them as text, and
 * runReport.test.ts asserts they equal the zod shapes, so neither can drift.
 *
 * A report carries no identifier, no free text and no input stream; every
 * value is a bounded enum or integer. The schema is strict: an unknown field
 * is refused, never dropped.
 */

export const GAME_IDS = ['kartrush'] as const;
export const MENTORS = ['rho', 'zara', 'liruf', 'dina'] as const;
/** Verified against KartRush's REAL_TRACK_IDS (src/data/tracks/index.ts), 2026-10-06. */
export const TRACK_IDS = ['jungleNeck', 'boulevard', 'fossilFire', 'factory', 'saltBay', 'glacier'] as const;
/** Verified against KartRush's KART_BODIES (src/data/karts.ts), 2026-10-06. The SPA keeps kartBody a plain string; only Core is closed. */
export const KART_BODIES = ['fossilRunner', 'stoneHauler', 'brassCoupe', 'sparkplug', 'driftFrame', 'circuitCrown'] as const;
export const SPEED_CLASSES = ['100cc', '150cc', '200cc'] as const;
/** A practice lap is never reported (it is not a result), so it is not a value here. */
export const RUN_MODES = ['single', 'timeTrial'] as const;
export const LENS_KEYS = ['item_hold', 'drift_patient', 'drift_early', 'steady', 'swingy', 'neutral'] as const;
export const BANDS = ['6-9', '10-12', '13-17', 'adult'] as const;

export type Mentor = (typeof MENTORS)[number];
export type LensKey = (typeof LENS_KEYS)[number];
export type Band = (typeof BANDS)[number];

export const RUN_REPORT_FIELDS = [
  'runKey', 'mode', 'trackId', 'character', 'kartBody', 'speedClass', 'finished',
  'finishMs', 'bestLapMs', 'lapMs', 'rank', 'lens',
] as const;
export const LENS_FIELDS = ['itemHoldMs', 'boxesPassedWhileHolding', 'itemsUsed', 'driftReleases', 'recoveries'] as const;
export const DRIFT_FIELDS = ['t0', 't1', 't2', 't3'] as const;

const MAX_MS = 1_800_000;
const Ms = z.number().int().min(1).max(MAX_MS);
const Count = z.number().int().min(0).max(200);

export const DriftReleases = z.object({
  t0: Count,
  t1: Count,
  t2: Count,
  t3: Count,
}).strict();

export const Lens = z.object({
  itemHoldMs: z.number().int().min(0).max(MAX_MS),
  boxesPassedWhileHolding: Count,
  itemsUsed: Count,
  driftReleases: DriftReleases,
  recoveries: Count,
}).strict();

export const RunKey = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/);

export const RunReport = z.object({
  runKey: RunKey,
  mode: z.enum(RUN_MODES),
  trackId: z.enum(TRACK_IDS),
  character: z.enum(MENTORS),
  kartBody: z.enum(KART_BODIES),
  speedClass: z.enum(SPEED_CLASSES),
  finished: z.literal(true),
  finishMs: Ms,
  bestLapMs: Ms,
  lapMs: z.array(Ms).min(1).max(5),
  rank: z.number().int().min(1).max(8),
  lens: Lens,
}).strict();

export type RunReport = z.infer<typeof RunReport>;
