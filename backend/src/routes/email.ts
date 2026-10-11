import { Router, type Request } from 'express';
import { z } from 'zod';
import { ApiError, sendData } from '../lib/http.js';
import { visitorKey, type Limits } from '../services/limits.js';
import type { Unsubscribe } from '../services/unsubscribe.js';
import type { Vault } from '../services/vault.js';

/*
 * Stopping the optional emails from the link at the bottom of one, without signing in. The token in
 * the link is the whole permission (services/unsubscribe.ts). Two doors, because there are two
 * kinds of caller:
 *
 *   - the /unsubscribe page of the site, which a person opens and where they press a button. Opening
 *     the link changes nothing by itself, so a mail scanner that follows links unsubscribes nobody;
 *   - a mail program's own "unsubscribe" button (RFC 8058), which posts to the one-click address
 *     with no page and no origin. That route is mounted before the origin check (app.ts).
 *
 * Both answer the same for a token of an account that does not exist any more.
 */
const Token = z.string().min(20).max(200);
const PageBody = z.object({ token: Token, subscribed: z.boolean().default(false) }).strict();

export function createEmailRouter(deps: { vault: Vault; limits: Limits; unsubscribe: Unsubscribe }): Router {
  const { vault, limits, unsubscribe } = deps;
  const router = Router();

  router.post('/unsubscribe', async (req, res) => {
    await limits.consume('ipAccount', visitorKey(req.ip));

    const body = PageBody.safeParse(req.body);
    const userId = body.success ? unsubscribe.verify(body.data.token) : null;

    if (!body.success || !userId) throw new ApiError('BAD_REQUEST');

    await vault.setProductEmails(userId, body.data.subscribed);
    sendData(res, { subscribed: body.data.subscribed });
  });

  return router;
}

/** The one-click door. It reads the token from the address and ignores the body a mail program sends. */
export function createOneClickRouter(deps: { vault: Vault; limits: Limits; unsubscribe: Unsubscribe }): Router {
  const { vault, limits, unsubscribe } = deps;
  const router = Router();

  router.post('/unsubscribe/one-click', async (req: Request, res) => {
    await limits.consume('ipAccount', visitorKey(req.ip));

    const token = Token.safeParse(req.query.token);
    const userId = token.success ? unsubscribe.verify(token.data) : null;

    if (!userId) throw new ApiError('BAD_REQUEST');

    await vault.setProductEmails(userId, false);
    sendData(res, { subscribed: false });
  });

  return router;
}
