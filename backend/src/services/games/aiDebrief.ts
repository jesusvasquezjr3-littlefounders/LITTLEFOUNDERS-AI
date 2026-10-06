import { z } from 'zod';
import { getConfig } from '../../config.js';
import type { Band, LensKey, Mentor } from '../../games/runReport.js';

/*
 * Core's side of the one-line AI debrief (docs/games/KARTRUSH-INTEGRATION-DESIGN.md
 * section 4.2). Oracle owns the model call, the age-band register and the
 * moderation pass (oracle/src/game/line.ts); Core owns what must never reach
 * Oracle (the learner's identity, nickname, run times, anything free-form) and
 * the gates in front of the call: the operator switch, the guardian's consent
 * to the `game_ai_debrief` practice and the per-learner daily cap.
 *
 * What travels is exactly four closed values: the Mentor, the platform locale,
 * the age band and the lens key. Nothing about the learner can be added, and
 * Oracle's own strict schema refuses it again.
 *
 * EVERY failure returns null, and null means "show the authored line". The
 * debrief is an enhancement: Oracle down, slow, switched off, moderated away or
 * returning nonsense must never cost a child anything, least of all the pit
 * stop. The SPA waits a few seconds at most and keeps the authored line.
 */

/** Shorter than the Mentor's Oracle timeout: the pit stop must not wait on a model. */
const GAME_LINE_TIMEOUT_MS = 5_000;

export function aiDebriefEnabled(): boolean {
  return getConfig().GAME_AI_DEBRIEF === 'on' && getConfig().GAME_AI_DAILY_LINES > 0;
}

export interface GameLineRequest {
  mentor: Mentor;
  locale: 'en-US' | 'es-MX' | 'pt-BR';
  band: Band;
  lens: LensKey;
}

export interface GameLine {
  text: string;
  costUsd: number;
}

const Envelope = z.object({
  data: z.object({ text: z.string().min(1).max(280), costUsd: z.number().min(0).max(1) }).nullable(),
  error: z.object({ code: z.string(), message: z.string() }).nullable(),
});

/** Calls Oracle. Null on any failure, a 204 (Oracle's neutral fallback) or a switched-off Oracle. */
export async function requestGameLine(request: GameLineRequest): Promise<GameLine | null> {
  const { ORACLE_URL, ORACLE_INTERNAL_KEY } = getConfig();
  try {
    const res = await fetch(`${ORACLE_URL}/api/v1/game/line`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-api-key': ORACLE_INTERNAL_KEY },
      // Spread field by field: an extra property on `request` must not travel.
      body: JSON.stringify({ mentor: request.mentor, locale: request.locale, band: request.band, lens: request.lens }),
      signal: AbortSignal.timeout(GAME_LINE_TIMEOUT_MS),
    });
    if (res.status === 204 || !res.ok) return null;
    const parsed = Envelope.safeParse(await res.json());
    if (!parsed.success || parsed.data.error || !parsed.data.data) return null;
    return { text: parsed.data.data.text.trim(), costUsd: parsed.data.data.costUsd };
  } catch {
    return null;
  }
}
