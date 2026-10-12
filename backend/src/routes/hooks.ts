import { createHmac, timingSafeEqual } from 'node:crypto';
import express, { Router, type Request } from 'express';
import { z } from 'zod';
import type { Config } from '../config.js';
import { describeError, log, toError } from '../lib/log.js';
import { keyFor, type Limits } from '../services/limits.js';
import type { Mailer } from '../services/mailer.js';
import type { Unsubscribe } from '../services/unsubscribe.js';
import type { Vault } from '../services/vault.js';
import { CODE_LIFETIME_SECONDS } from './auth.js';

/*
 * Where the authentication service hands over an email it wants sent (its "send email" hook).
 * It still makes the one-time code and checks it; it no longer writes or sends the email. Core
 * receives the code here, picks the email and the account's language, and asks the mail service
 * for it. That is how a code arrives in the person's language and in our design.
 *
 * The caller is a server, not a browser, so the origin check does not apply. What proves the call
 * is the signature the authentication service puts on it (Standard Webhooks: an HMAC-SHA256 of the
 * id, the timestamp and the exact body, with a secret only the two services hold). A call without a
 * valid, recent signature is refused before its body is read as anything.
 *
 * The code passes through here in memory and is never logged or stored.
 */
const TOLERANCE_SECONDS = 5 * 60;

const Payload = z.object({
  user: z.object({
    id: z.uuid(),
    email: z.email().max(254),
    user_metadata: z.object({ locale: z.enum(['en-US', 'es-MX', 'pt-BR']).optional() }).optional(),
  }),
  email_data: z.object({
    token: z.string().regex(/^\d{6}$/),
    email_action_type: z.string().max(40),
  }),
});

// A new address confirms it with `signup`; an account that exists signs in with `magiclink`. The
// other kinds (recovery, invite, email change, reauthentication) belong to features that do not
// exist, so nothing is sent for them.
const TEMPLATE = { signup: 'sign-up-code', magiclink: 'sign-in-code' } as const;

function isKnownAction(action: string): action is keyof typeof TEMPLATE {
  return Object.hasOwn(TEMPLATE, action);
}

/** The answer shape the authentication service understands for a refusal. */
const refusal = (status: number, message: string) => ({ error: { http_code: status, message } });

export function createHooksRouter(deps: { config: Config; vault: Vault; mailer: Mailer; unsubscribe: Unsubscribe; limits: Limits }): Router {
  const { config, vault, mailer, unsubscribe, limits } = deps;
  const router = Router();
  // "v1,whsec_<base64>" is how the authentication service is given the secret; the key is the base64 part.
  const key = config.sendEmailHookSecret ? Buffer.from(config.sendEmailHookSecret.replace(/^v1,/, '').replace(/^whsec_/, ''), 'base64') : null;

  function signed(req: Request, body: Buffer): boolean {
    const id = req.get('webhook-id');
    const timestamp = req.get('webhook-timestamp');
    const signatures = req.get('webhook-signature');

    if (!key || !id || !timestamp || !signatures || !/^\d{1,12}$/.test(timestamp)) return false;
    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > TOLERANCE_SECONDS) return false;

    const expected = createHmac('sha256', key).update(`${id}.${timestamp}.`).update(body).digest();

    // The header may list several signatures (while a secret is being replaced): any one may match.
    return signatures.split(' ').some((entry) => {
      const [version, value] = entry.split(',');

      if (version !== 'v1' || !value) return false;

      const given = Buffer.from(value, 'base64');

      return given.length === expected.length && timingSafeEqual(given, expected);
    });
  }

  router.post('/send-email', express.raw({ type: 'application/json', limit: '64kb' }), async (req, res) => {
    const body: unknown = req.body;

    if (!key) return res.status(503).json(refusal(503, 'hook not configured'));
    if (!Buffer.isBuffer(body) || !signed(req, body)) return res.status(401).json(refusal(401, 'bad signature'));

    let json: unknown;

    try {
      json = JSON.parse(body.toString('utf8'));
    } catch {
      return res.status(400).json(refusal(400, 'bad body'));
    }

    const payload = Payload.safeParse(json);

    if (!payload.success) return res.status(400).json(refusal(400, 'bad body'));

    const { user, email_data: data } = payload.data;

    if (!isKnownAction(data.email_action_type)) {
      log.warn('hook.send_email.unsupported', { action: data.email_action_type });

      return res.status(422).json(refusal(422, 'this email is not sent'));
    }

    // A call is acted on once. A copy of a signed call, sent again inside the five minutes its
    // signature is good for, gets the answer of a call that went well and sends nothing.
    const callKey = keyFor(`hook:${req.get('webhook-id') ?? ''}`);

    if (!(await limits.allow('hookOnce', callKey))) return res.status(200).json({});

    try {
      // A brand-new account may not be readable yet (it is being created by the request that
      // triggered this call): then the language it was opened in travels with the call itself.
      const context = await vault.mailContext(user.id);
      const locale = context?.locale ?? user.user_metadata?.locale ?? 'en-US';
      const sent = await mailer.send(
        { template: TEMPLATE[data.email_action_type], data: { code: data.token, minutes: CODE_LIFETIME_SECONDS / 60 } },
        { to: user.email, locale, userId: user.id, unsubscribe: unsubscribe.links(user.id) },
      );

      if (!sent) {
        // The authentication service may try this same call again: let it.
        await limits.reset('hookOnce', callKey);

        return res.status(502).json(refusal(502, 'the email could not be sent'));
      }

      res.status(200).json({});
    } catch (thrown) {
      log.error('hook.send_email.failed', describeError(toError(thrown)));
      await limits.reset('hookOnce', callKey);
      res.status(500).json(refusal(500, 'the email could not be sent'));
    }
  });

  return router;
}
