import { Router } from 'express';
import { fail, ok } from '../lib/http.js';
import { gameAiDebriefEnabled } from '../game/config.js';
import { GameLineInputSchema } from '../game/schema.js';
import { runGameLine } from '../game/line.js';
import { modelConfigured } from '../model/provider.js';

/*
 * POST /api/v1/game/line — the one sealed line a Mentor says after a game race
 * (game/line.ts). Core is the only caller, with the internal key checked by the
 * /api/v1/game mount; it validates its own gates (the guardian's consent, the
 * per-learner daily cap) before it ever asks.
 *
 * The body is exactly four closed values and nothing else: a field the schema
 * does not name is a 400, never dropped. The answer is `{ text, costUsd }`, or a
 * 204 with no body when there is nothing to show: the switch is off, no model is
 * configured, the model or the moderation judge said no, or anything failed.
 * A 204 is not an error and never becomes one: the caller keeps its authored
 * line, and a child never waits on this.
 */
export function gameRouter(): Router {
  const router = Router();

  router.post('/line', async (req, res) => {
    const parsed = GameLineInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body');
    }
    if (!gameAiDebriefEnabled() || !modelConfigured()) return res.status(204).end();
    try {
      const line = await runGameLine(parsed.data);
      return line ? ok(res, { text: line.text, costUsd: line.costUsd }) : res.status(204).end();
    } catch {
      return res.status(204).end();
    }
  });

  return router;
}
