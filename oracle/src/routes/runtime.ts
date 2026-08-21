import { Router } from 'express';
import { z } from 'zod';
import { ok, fail } from '../lib/http.js';
import { moderationReadiness } from '../safety/moderation.js';
import { modelConfigured } from '../model/provider.js';
import { getVoiceProvider } from '../voice/index.js';

/*
 * Oracle's internal HTTP surface. Small on purpose: the real work happens on
 * the websocket, and everything about a learner lives in Core.
 */

export function runtimeRouter(liveSessions: () => number): Router {
  const router = Router();

  /**
   * Preflight, called by Core BEFORE it mints a session token.
   *
   * This exists because of a specific bad experience shape: without it, Core
   * happily mints a token, the browser opens the 3D stage, the assets load,
   * the socket connects — and only then does Oracle refuse because no
   * moderation judge is configured. The learner watched a thirty-second
   * loading sequence to be told no. Asking first turns that into an honest
   * message on the button.
   */
  const PreflightBody = z
    .object({ isMinor: z.boolean(), wantsVoice: z.boolean() })
    .strict();

  router.post('/preflight', (req, res) => {
    const parsed = PreflightBody.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid body');
    }

    const moderation = moderationReadiness(parsed.data.isMinor);
    const model = modelConfigured();
    const voice = getVoiceProvider().available;

    // The model is the only hard requirement. Voice is an enhancement
    // (/ORACLE.md §14) and moderation is only mandatory for a minor.
    const canStart = model && moderation.ready;

    return ok(res, {
      canStart,
      blockedBy: canStart ? null : !model ? 'MODEL_UNAVAILABLE' : (moderation.reason ?? 'UNKNOWN'),
      voiceAvailable: voice,
      // Honest about what the learner will actually get, so the UI can say
      // "you can type to the tutor today" instead of promising a microphone.
      microphoneAvailable: voice && parsed.data.wantsVoice,
    });
  });

  /** Operational read for the admin console. No learner data, by construction. */
  router.get('/status', (_req, res) =>
    ok(res, {
      liveSessions: liveSessions(),
      model: modelConfigured() ? 'configured' : 'missing',
      voice: getVoiceProvider().name,
      voiceAvailable: getVoiceProvider().available,
      moderationForMinors: moderationReadiness(true).ready ? 'ready' : 'unavailable',
    }),
  );

  return router;
}
