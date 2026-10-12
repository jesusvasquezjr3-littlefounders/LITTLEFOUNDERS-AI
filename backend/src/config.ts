import { z } from 'zod';

/*
 * Environment, validated once at boot: Core crashes on a bad value, never at request time.
 *
 * The names are the ones production already has (docs/operations/ENVIRONMENT-SETUP.md), so the
 * keys configured there keep working. The optional ones at the end are new and have safe defaults.
 */
const Env = z.object({
  // Fails closed: only the exact words 'development' and 'test' relax anything. A missing value, a
  // typo or whatever the platform injects counts as production, so a mistake here can only make
  // Core stricter (Secure cookies, https, shared counters), never weaker. Local: backend/.env sets it.
  NODE_ENV: z.string().optional().transform((value) => (value === 'development' || value === 'test' ? value : 'production')),
  PORT: z.coerce.number().int().positive().default(4000),

  // The one browser origin allowed to call Core, and where a person lands after signing in.
  FRONTEND_URL: z.url().default('http://localhost:5173'),

  // The Supabase gateway (Kong). Authentication is at /auth/v1 and the database functions at /rest/v1.
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  SUPABASE_JWT_SECRET: z.string().min(16),

  // Counters for rate limits and code attempts. Required in production (checked below).
  REDIS_URL: z.string().min(1).optional(),

  // The mail service and the key it expects from another service (email-server/). Required in
  // production: without them no code can be emailed.
  EMAIL_SERVER_URL: z.url().optional(),
  INTERNAL_API_KEY: z.string().min(16).optional(),

  // New. The secret the authentication service signs its "send email" hook with: the same value as
  // its GOTRUE_HOOK_SEND_EMAIL_SECRETS ("v1,whsec_" and a base64 key). Required in production.
  SEND_EMAIL_HOOK_SECRET: z.string().regex(/^v1,whsec_[A-Za-z0-9+/=]{24,}$/).optional(),

  // New, optional.
  // The address a browser reaches Core at. Unset: the frontend's own origin, which proxies /api to
  // Core, so the session cookies are first-party.
  PUBLIC_API_ORIGIN: z.url().optional(),
  // The issuer the authentication service writes into its tokens. Unset: SUPABASE_URL + /auth/v1.
  SUPABASE_JWT_ISSUER: z.string().min(1).optional(),
  // How many proxies sit between the visitor and Core, so the visitor's address is read correctly.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
  // Codes an hour that may go to addresses with no account yet, for the whole service. Keep it
  // well under the authentication service's GOTRUE_RATE_LIMIT_EMAIL_SENT: the difference is what
  // stays reserved for people who already have an account.
  NEW_ADDRESS_CODES_PER_HOUR: z.coerce.number().int().min(1).max(100000).default(300),
  // Development only: the limits that count how often something is asked for are a hundred times
  // wider, so a developer and the audit tools on one machine do not lock each other out. The limits
  // on guessing a code stay as they are. Core refuses to start with this set anywhere else.
  RELAXED_LIMITS: z.enum(['true', 'false']).default('false'),
});

export type Config = Readonly<{
  env: 'development' | 'test' | 'production';
  isProduction: boolean;
  port: number;
  frontendOrigin: string;
  publicApiOrigin: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  supabaseJwtSecret: string;
  supabaseJwtIssuer: string;
  redisUrl: string | undefined;
  emailServerUrl: string | undefined;
  internalApiKey: string | undefined;
  sendEmailHookSecret: string | undefined;
  trustProxyHops: number;
  newAddressCodesPerHour: number;
  relaxedLimits: boolean;
}>;

/** An origin is scheme, host and port: no path, no trailing slash. */
function originOf(url: string): string {
  return new URL(url).origin;
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
  const parsed = Env.parse(source);
  const isProduction = parsed.NODE_ENV === 'production';
  const relaxedLimits = parsed.RELAXED_LIMITS === 'true';

  // fails closed with NODE_ENV: a missing or misspelled environment is production, and this stops there
  if (relaxedLimits && parsed.NODE_ENV !== 'development') throw new Error('RELAXED_LIMITS is for development only: remove it');
  const frontendOrigin = originOf(parsed.FRONTEND_URL);
  const publicApiOrigin = originOf(parsed.PUBLIC_API_ORIGIN ?? parsed.FRONTEND_URL);
  const supabaseUrl = parsed.SUPABASE_URL.replace(/\/+$/, '');

  if (isProduction) {
    // Without shared counters a code could be guessed without limit, so production does not boot.
    if (!parsed.REDIS_URL) throw new Error('REDIS_URL is required in production');

    // Signing in is a code by email: production does not boot unable to send one.
    for (const name of ['EMAIL_SERVER_URL', 'INTERNAL_API_KEY', 'SEND_EMAIL_HOOK_SECRET'] as const) {
      if (!parsed[name]) throw new Error(`${name} is required in production`);
    }

    // Session cookies are Secure and host-bound in production; they cannot work over http.
    for (const origin of [frontendOrigin, publicApiOrigin, supabaseUrl]) {
      if (!origin.startsWith('https://')) throw new Error(`production needs https, got ${origin}`);
    }
  }

  return Object.freeze({
    env: parsed.NODE_ENV,
    isProduction,
    port: parsed.PORT,
    frontendOrigin,
    publicApiOrigin,
    supabaseUrl,
    supabaseAnonKey: parsed.SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: parsed.SUPABASE_SERVICE_ROLE_KEY,
    supabaseJwtSecret: parsed.SUPABASE_JWT_SECRET,
    supabaseJwtIssuer: parsed.SUPABASE_JWT_ISSUER ?? `${supabaseUrl}/auth/v1`,
    redisUrl: parsed.REDIS_URL,
    emailServerUrl: parsed.EMAIL_SERVER_URL?.replace(/\/+$/, ''),
    internalApiKey: parsed.INTERNAL_API_KEY,
    sendEmailHookSecret: parsed.SEND_EMAIL_HOOK_SECRET,
    trustProxyHops: parsed.TRUST_PROXY_HOPS,
    newAddressCodesPerHour: parsed.NEW_ADDRESS_CODES_PER_HOUR,
    relaxedLimits,
  });
}
