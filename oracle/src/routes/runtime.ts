import { Router } from 'express';
import { z } from 'zod';
import { ok, fail } from '../lib/http.js';
import { getConfig } from '../env.js';
import { moderationReadiness } from '../safety/moderation.js';
import { modelConfigured } from '../model/provider.js';
import { getVoiceProvider } from '../voice/index.js';
import { pregeneratedCount, pregeneratedGeneratedAt } from '../voice/pregenerated.js';

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
      microphoneAvailable:
        voice && parsed.data.wantsVoice && (!parsed.data.isMinor || getConfig().TUTOR_VOICE_FOR_MINORS),
      /*
       * Reported separately from `microphoneAvailable` because the REASON
       * differs and the copy differs with it: "a grown-up needs to allow it"
       * is a different message from "we are not offering this yet", and
       * telling a family the wrong one wastes their time.
       */
      minorVoicePolicy: getConfig().TUTOR_VOICE_FOR_MINORS ? 'allowed' : 'blocked',
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
      /*
       * How many fixed lines this instance can speak for FREE.
       *
       * Reported because a missing manifest is otherwise invisible: everything
       * still works, every line is still spoken, and every one of them is
       * billed again. `0` on a deployment with a voice provider means
       * `npm run speech:pregenerate` has never been run here (/ORACLE.md §15.1).
       */
      pregeneratedLines: pregeneratedCount(),
      pregeneratedAt: pregeneratedGeneratedAt(),
      speechCacheScope: getConfig().SPEECH_CACHE_SCOPE,
    }),
  );

  return router;
}
