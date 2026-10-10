import { Router } from 'express';
import { z } from 'zod';
import { ApiError, isErrorCode, sendData } from '../lib/http.js';
import { describeError, log, toError } from '../lib/log.js';
import { authOf, type AuthMiddleware } from '../middleware/auth.js';
import { keyFor, type Limits } from '../services/limits.js';
import type { Mailer } from '../services/mailer.js';
import type { Unsubscribe } from '../services/unsubscribe.js';
import type { Vault } from '../services/vault.js';

/*
 * What a signed-in person sets about their own account. Every handler acts on the account of the
 * session and nothing else: no handler here takes a user id from the request.
 */
const AgeBody = z.object({ age: z.number().int(), guardianPermission: z.boolean().default(false) }).strict();
const UsernameBody = z.object({ username: z.string().trim().toLowerCase().max(40) }).strict();
const LocaleBody = z.object({ locale: z.enum(['en-US', 'es-MX', 'pt-BR']) }).strict();

/** A refusal from a database function, as the error to answer with. */
function refused(code: string | undefined): ApiError {
  return new ApiError(code && isErrorCode(code) ? code : 'INTERNAL');
}

export function createAccountRouter(deps: { vault: Vault; limits: Limits; auth: AuthMiddleware; mailer: Mailer; unsubscribe: Unsubscribe }): Router {
  const { vault, limits, auth, mailer, unsubscribe } = deps;
  const router = Router();

  /** The welcome email: once, when the account is complete, in the account's language, unless it unsubscribed. */
  async function welcome(userId: string): Promise<void> {
    const context = await vault.mailContext(userId);

    if (!context?.email || !context.productEmails) return;

    await mailer.send({ template: 'welcome', data: {} }, { to: context.email, locale: context.locale, userId, unsubscribe: unsubscribe.links(userId) });
  }

  router.use(auth.requireAuth);

  /*
   * The age step of sign-up (D-025, D-027). The age is recorded once and decides the account's type:
   * `child` under 18, `universal` from 18. Under 13 the person must tick that a parent or guardian
   * gave permission. The range and that rule are checked again in the database.
   */
  router.post('/age', async (req, res) => {
    const { userId } = authOf(req);

    await limits.consume('ipAccount', keyFor(req.ip ?? 'unknown'));

    const body = AgeBody.safeParse(req.body);

    if (!body.success) throw new ApiError('BAD_REQUEST');

    const outcome = await vault.declareAge(userId, body.data.age, body.data.guardianPermission);

    if (!outcome.ok) throw refused(outcome.error);

    sendData(res, { type: outcome.type ?? null, recorded: outcome.recorded ?? false });

    // The age is recorded once, so this runs once per account. The answer does not wait for it.
    if (outcome.recorded) void welcome(userId).catch((thrown: unknown) => log.error('mail.welcome.failed', describeError(toError(thrown))));
  });

  /*
   * The account's language is the one the person uses the site in: the frontend reports it when it
   * differs from what the account has (after signing in, and when the person changes it). Emails
   * are written in it.
   */
  router.put('/locale', async (req, res) => {
    const { userId } = authOf(req);

    await limits.consume('ipAccount', keyFor(req.ip ?? 'unknown'));

    const body = LocaleBody.safeParse(req.body);

    if (!body.success) throw new ApiError('BAD_REQUEST');

    const outcome = await vault.setLocale(userId, body.data.locale);

    if (!outcome.ok) throw refused(outcome.error);

    sendData(res, { locale: body.data.locale });
  });

  router.put('/username', async (req, res) => {
    const { userId } = authOf(req);

    await limits.consume('ipAccount', keyFor(req.ip ?? 'unknown'));

    const body = UsernameBody.safeParse(req.body);

    if (!body.success) throw new ApiError('USERNAME_INVALID');

    const outcome = await vault.setUsername(userId, body.data.username);

    if (!outcome.ok) throw refused(outcome.error);

    sendData(res, { username: outcome.username ?? body.data.username });
  });

  return router;
}
