import { createHash, randomBytes } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { Config } from '../config.js';
import { ApiError, sendData } from '../lib/http.js';
import { describeError, log, toError } from '../lib/log.js';
import { authOf, type AuthMiddleware } from '../middleware/auth.js';
import type { Cookies } from '../services/cookies.js';
import type { Gotrue, Session } from '../services/gotrue.js';
import type { KnownDevices } from '../services/knownDevice.js';
import type { TokenVerifier } from '../services/tokens.js';
import type { Challenges } from '../services/challenge.js';
import { keyFor, visitorKey, type Limits } from '../services/limits.js';
import type { AccountContext, Vault } from '../services/vault.js';

/*
 * Sign-in and sign-up. There is no password anywhere: a person proves who they are with a
 * six-digit code sent to their email address (valid 15 minutes, used once), or with Google.
 * Entering a code for an address nobody has used yet creates the account, so signing in and
 * signing up are the same two steps.
 *
 * Two rules shape every handler here:
 *   - an answer never tells whether an address or a username has an account, by what it says or by
 *     how long it takes;
 *   - every counter is taken before the thing it protects is attempted.
 */
export const CODE_LENGTH = 6;
export const CODE_LIFETIME_SECONDS = 15 * 60;
export const RESEND_AFTER_SECONDS = 60;

const LOCALES = ['en-US', 'es-MX', 'pt-BR'] as const;
const USERNAME = /^[a-z0-9_]{3,20}$/;

// An identifier is an email address or a username. It is trimmed and lower-cased before anything else.
const Identifier = z.string().trim().toLowerCase().min(3).max(254);

const CodeRequestBody = z.object({
  identifier: Identifier,
  locale: z.enum(LOCALES).default('en-US'),
  // The work done before asking (services/challenge.ts).
  challenge: z.string().min(20).max(120),
  solution: z.string().regex(/^[0-9a-z]{1,16}$/),
}).strict();
const CodeVerifyBody = z.object({ identifier: Identifier, code: z.string().regex(/^\d{6}$/) }).strict();
const GoogleStartQuery = z.object({ mode: z.enum(['popup', 'redirect']).default('redirect') });
const GoogleCallbackQuery = z.object({ code: z.string().min(8).max(512).optional() });

type Target = { kind: 'email'; email: string } | { kind: 'username'; email: string | null; username: string };

/*
 * The mailbox an address delivers to, for counting only (the email still goes to what was typed).
 * `name+anything@` reaches the mailbox of `name@` at most providers, and Gmail also ignores the
 * dots, so without this one mailbox would have as many counters as it has spellings.
 */
function mailbox(email: string): string {
  const at = email.lastIndexOf('@');
  const domain = email.slice(at + 1);
  const name = email.slice(0, at).split('+')[0] ?? '';

  return `${domain === 'gmail.com' || domain === 'googlemail.com' ? name.replaceAll('.', '') : name}@${domain === 'googlemail.com' ? 'gmail.com' : domain}`;
}

/** What the frontend may know about the signed-in account. */
function accountView(userId: string, account: AccountContext) {
  const type = account.roles.includes('child') ? 'child' : account.roles.includes('universal') ? 'universal' : null;

  return {
    id: userId,
    email: account.email,
    username: account.username,
    displayName: account.displayName,
    locale: account.locale,
    mentor: account.mentor,
    parentIntent: account.parentIntent,
    roles: account.roles,
    type,
    // An account without a declared age has no type yet and must go through the age step first.
    needsAge: !account.ageDeclared,
  };
}

export function createAuthRouter(deps: { config: Config; gotrue: Gotrue; vault: Vault; cookies: Cookies; knownDevices: KnownDevices; challenges: Challenges; limits: Limits; auth: AuthMiddleware; verifyToken: TokenVerifier }): Router {
  const { config, gotrue, vault, cookies, knownDevices, challenges, limits, auth, verifyToken } = deps;
  const router = Router();

  const clientKey = (req: Request): string => visitorKey(req.ip);

  async function resolve(identifier: string): Promise<Target | null> {
    if (identifier.includes('@')) {
      return z.email().max(254).safeParse(identifier).success ? { kind: 'email', email: identifier } : null;
    }

    if (!USERNAME.test(identifier)) return null;

    return { kind: 'username', email: await vault.emailForUsername(identifier), username: identifier };
  }

  /*
   * Two counter keys per request. `typed` is what the person typed, an address or a username: its
   * limits are the ones a caller can see (a 429). `account` is the address the code goes to,
   * whichever way it was named: its limits hold silently. If a refusal on one identifier could be
   * seen through the other, filling a username's counter and probing an address would tell which
   * address the username belongs to.
   *
   * Both come in two sets, `stranger` and `known`. A browser that has signed in to the account
   * before (services/knownDevice.ts) counts in the `known` set, which nobody else can spend. Without
   * that, somebody who knows a child's username could use up the account's guesses and emails on
   * purpose and lock the child out for a day without the child being told why.
   */
  type Scope = 'stranger' | 'known';

  const SCOPES: readonly Scope[] = ['stranger', 'known'];

  const scopeOf = (req: Request, target: Target): Scope => (target.email && knownDevices.knows(req, target.email) ? 'known' : 'stranger');
  const typedKey = (target: Target, scope: Scope): string => keyFor(`${scope}:${target.kind === 'email' ? `email:${mailbox(target.email)}` : `username:${target.username}`}`);
  const accountKey = (target: Target, scope: Scope): string | null => (target.email ? keyFor(`${scope}:account:${mailbox(target.email)}`) : null);

  /** A new code replaces the old one for everybody, so the attempts on it start again in both sets. */
  async function resetAttemptsPerCode(target: Target): Promise<void> {
    for (const scope of SCOPES) {
      await limits.reset('attemptsPerCode', typedKey(target, scope));

      const account = accountKey(target, scope);

      if (account) await limits.reset('attemptsPerCode', account);
    }
  }

  /** Stores the session in cookies and answers with the account. */
  async function startSession(req: Request, res: Response, session: Session, sessionId: string): Promise<void> {
    await vault.syncBaseType(session.userId);

    const account = await vault.sessionContext(session.userId, sessionId);

    if (!account?.active) throw new ApiError('SESSION_EXPIRED');

    cookies.setSession(res, session);
    if (account.email) knownDevices.remember(req, res, account.email);
    sendData(res, { account: accountView(session.userId, account) });
  }

  // ---------------------------------------------------------------------------------------------
  // One-time code by email
  // ---------------------------------------------------------------------------------------------

  /*
   * The piece of work a browser does before it asks for a code (services/challenge.ts). Handing
   * one out costs Core nothing and stores nothing.
   */
  router.get('/challenge', async (req, res) => {
    await limits.consume('ipSession', clientKey(req));
    sendData(res, { challenge: challenges.issue(), difficulty: challenges.difficulty });
  });

  router.post('/code', async (req, res) => {
    await limits.consume('ipCodeRequest', clientKey(req));

    const body = CodeRequestBody.safeParse(req.body);

    if (!body.success) throw new ApiError('BAD_REQUEST');

    // The work is checked first and the challenge is spent, whatever comes next: one request, one challenge.
    if (!challenges.accepts(body.data.challenge, body.data.solution) || !(await limits.allow('challengeOnce', keyFor(body.data.challenge)))) {
      throw new ApiError('PROOF_REQUIRED');
    }

    const target = await resolve(body.data.identifier);

    if (!target) throw new ApiError('BAD_REQUEST');

    const scope = scopeOf(req, target);
    const typed = typedKey(target, scope);

    // One email a minute and five an hour per identifier, whoever asks. They apply to an identifier
    // nobody owns too, so they say nothing about whether it exists.
    await limits.consume('codeCooldown', typed);
    await limits.consume('codeHourly', typed);

    // Answer first, send afterwards, whatever was typed. A username that exists and one that does
    // not, an address with an account and one without, an address that just got a code through its
    // username and one that did not: all take the same time and get the same answer. The price is
    // that a failure to send is not told to the person; it is logged, and they can ask again.
    sendData(res, { sent: true, codeLength: CODE_LENGTH, expiresInSeconds: CODE_LIFETIME_SECONDS, resendAfterSeconds: RESEND_AFTER_SECONDS });

    const { email } = target;
    const account = accountKey(target, scope);

    if (!email || !account) return;

    void (async () => {
      // The address already got a code less than a minute ago (asked for another way): that code
      // is still good, so nothing new is sent.
      if (!(await limits.allow('codeCooldown', account)) || !(await limits.allow('codeHourly', account))) return;

      // Only an address typed in full can open an account; a username never does.
      const createAccount = target.kind === 'email';

      // New addresses share one allowance an hour for the whole service, so a flood of made-up
      // addresses cannot use up the emails of people who already have an account.
      if (createAccount && !(await vault.accountExists(email)) && !(await limits.allow('newAddressHourly', 'all'))) {
        return log.warn('auth.code.new_address_ceiling');
      }

      const result = await gotrue.sendCode(email, { createAccount, locale: body.data.locale });

      if (!result.ok) return log.warn('auth.code.send_failed', { failure: result.failure, by: target.kind });

      // A new code starts with a clean set of attempts; the old code no longer works.
      await resetAttemptsPerCode(target);
    })().catch((thrown: unknown) => log.error('auth.code.send_failed', describeError(toError(thrown))));
  });

  router.post('/code/verify', async (req, res) => {
    await limits.consume('ipCodeVerify', clientKey(req));

    const body = CodeVerifyBody.safeParse(req.body);

    if (!body.success) throw new ApiError('CODE_INVALID');

    const target = await resolve(body.data.identifier);

    if (!target) throw new ApiError('CODE_INVALID');

    const scope = scopeOf(req, target);
    const typed = typedKey(target, scope);
    const account = accountKey(target, scope);

    // Count the attempt before making it. Two requests racing with the same code cannot both slip
    // under the limit, because taking a point is atomic.
    await limits.consume('attemptsPerCode', typed, 'TOO_MANY_ATTEMPTS');
    await limits.consume('attemptsDaily', typed, 'TOO_MANY_ATTEMPTS');

    // The address's own attempts count too, silently, however it was named: five per code in all.
    // Once they are used up the code is simply wrong, whatever is typed.
    const exhausted = account !== null
      && (!(await limits.allow('attemptsPerCode', account)) || !(await limits.allow('attemptsDaily', account)));

    // Worth seeing in the logs: somebody is guessing at one account. No address, no username.
    if (exhausted) log.warn('auth.code.attempts_exhausted', { scope });

    // An identifier nobody owns, or an address out of attempts, is still checked against the
    // authentication service with an address that cannot exist, so it fails the same way and in the
    // same time as a wrong code.
    const email = target.email && !exhausted ? target.email : `${typed}@unknown.invalid`;
    const result = await gotrue.verifyCode(email, body.data.code);

    if (!result.ok) {
      if (result.failure === 'unavailable') throw new ApiError('UNAVAILABLE');

      throw new ApiError('CODE_INVALID');
    }

    for (const key of new Set([typed, account ?? typed])) {
      await limits.reset('attemptsPerCode', key);
      await limits.refund('attemptsDaily', key);
    }

    await startSession(req, res, result.value, await sessionIdOf(result.value.accessToken));
  });

  // ---------------------------------------------------------------------------------------------
  // Session
  // ---------------------------------------------------------------------------------------------

  router.get('/session', auth.requireAuth, (req, res) => {
    const { userId, account } = authOf(req);

    sendData(res, { account: accountView(userId, account) });
  });

  router.post('/refresh', async (req, res) => {
    await limits.consume('ipSession', clientKey(req));

    const refreshToken = cookies.refreshToken(req);

    if (!refreshToken) throw new ApiError('UNAUTHENTICATED');

    const result = await gotrue.refresh(refreshToken);

    if (!result.ok) {
      if (result.failure === 'unavailable') throw new ApiError('UNAVAILABLE');

      // A refresh token that was already used, revoked or expired: the session is over.
      cookies.clearSession(res);

      throw new ApiError('SESSION_EXPIRED');
    }

    await startSession(req, res, result.value, await sessionIdOf(result.value.accessToken));
  });

  router.post('/sign-out', async (req, res) => {
    let accessToken = cookies.accessToken(req);
    const refreshToken = cookies.refreshToken(req);

    // The cookies go whatever happens next: signing out must always work from the person's side.
    cookies.clearSession(res);

    // The access cookie leaves the browser when its token expires (about an hour), while the session
    // and its refresh token live on at the authentication service. Ending the session needs a
    // token that is still good, so one is obtained with the refresh token and used at once: a copy
    // of the refresh token taken earlier must not outlive the person's sign-out.
    if (!accessToken && refreshToken) {
      const refreshed = await gotrue.refresh(refreshToken);

      if (refreshed.ok) accessToken = refreshed.value.accessToken;
      else if (refreshed.failure === 'unavailable') log.warn('auth.sign_out.unavailable');
    }

    if (accessToken) {
      const result = await gotrue.signOut(accessToken);

      if (!result.ok && result.failure === 'unavailable') log.warn('auth.sign_out.unavailable');
    }

    sendData(res, { signedOut: true });
  });

  // ---------------------------------------------------------------------------------------------
  // Google
  // ---------------------------------------------------------------------------------------------

  router.get('/providers', async (_req, res) => {
    sendData(res, { google: await googleEnabled() });
  });

  /*
   * Starts a Google sign-in. The browser is sent to Google through the authentication service with
   * a challenge; the secret that answers it stays in a cookie in this browser. Only the browser
   * that started the sign-in can finish it, so a link prepared by somebody else cannot sign a
   * person in to the wrong account.
   */
  router.get('/google/start', async (req, res) => {
    await limits.consume('ipSession', clientKey(req));

    const query = GoogleStartQuery.safeParse(req.query);
    const mode = query.success ? query.data.mode : 'redirect';

    if (!(await googleEnabled())) return res.redirect(303, finishUrl(mode, 'unavailable'));

    const verifier = randomBytes(48).toString('base64url');
    const challenge = createHash('sha256').update(verifier, 'ascii').digest('base64url');

    cookies.setOAuthState(res, { verifier, mode });
    res.redirect(303, gotrue.googleAuthorizeUrl({ redirectTo: `${config.publicApiOrigin}/api/v1/auth/google/callback`, codeChallenge: challenge }));
  });

  router.get('/google/callback', async (req, res) => {
    const state = cookies.oauthState(req);

    cookies.clearOAuthState(res);

    const mode = state?.mode ?? 'redirect';
    const query = GoogleCallbackQuery.safeParse(req.query);

    // No state: this browser did not start a sign-in. No code: the person cancelled, or Google refused.
    if (!state || !query.success || !query.data.code) return res.redirect(303, finishUrl(mode, 'cancelled'));

    const result = await gotrue.exchangeOAuthCode(query.data.code, state.verifier);

    if (!result.ok) return res.redirect(303, finishUrl(mode, result.failure === 'unavailable' ? 'unavailable' : 'failed'));

    await vault.syncBaseType(result.value.userId);
    cookies.setSession(res, result.value);
    res.redirect(303, finishUrl(mode, 'ok'));
  });

  // The answer is the same for a minute: this is asked on every page that shows the sign-in window.
  let googleCache: { value: boolean; until: number } | null = null;

  async function googleEnabled(): Promise<boolean> {
    if (googleCache && googleCache.until > Date.now()) return googleCache.value;

    const value = await gotrue.googleEnabled();

    googleCache = { value, until: Date.now() + 60_000 };

    return value;
  }

  /** The frontend page that closes the popup, or carries on in the same tab. It gets a result word, never a token. */
  function finishUrl(mode: 'popup' | 'redirect', result: 'ok' | 'cancelled' | 'failed' | 'unavailable'): string {
    const url = new URL('/auth/callback', config.frontendOrigin);

    url.searchParams.set('mode', mode);
    url.searchParams.set('result', result);

    return url.toString();
  }

  /** The session a freshly issued token belongs to. The token came straight from the authentication service. */
  async function sessionIdOf(accessToken: string): Promise<string> {
    const claims = await verifyToken(accessToken);

    if (!claims) throw new ApiError('UNAVAILABLE');

    return claims.sessionId;
  }

  return router;
}
