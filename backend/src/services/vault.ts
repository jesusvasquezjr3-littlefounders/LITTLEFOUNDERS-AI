import { z } from 'zod';
import type { Config } from '../config.js';

/*
 * The database, reached through the gateway's REST interface with the service key. Core has no
 * privilege on any table: it can only run the `core_*` functions of
 * database/migrations/, each of which enforces its own rules. Every answer is
 * parsed before it is used.
 */
export const ROLES = ['universal', 'child', 'parent', 'admin', 'superadmin'] as const;
export type Role = (typeof ROLES)[number];

/** The four characters a person can choose as their mentor. */
export const MENTORS = ['zara', 'rho', 'liruf', 'dina'] as const;

const Context = z.object({
  active: z.boolean(),
  email: z.string().nullable(),
  username: z.string().nullable(),
  displayName: z.string(),
  locale: z.enum(['en-US', 'es-MX', 'pt-BR']),
  mentor: z.enum(MENTORS).nullable(),
  parentIntent: z.boolean(),
  ageDeclared: z.boolean(),
  roles: z.array(z.enum(ROLES)),
});

export type AccountContext = z.infer<typeof Context>;

const MailContext = z.object({ email: z.string().nullable(), locale: z.enum(['en-US', 'es-MX', 'pt-BR']), productEmails: z.boolean() });

export type MailContext = z.infer<typeof MailContext>;

const Outcome = z.object({ ok: z.boolean(), error: z.string().optional() });
const AgeOutcome = Outcome.extend({ type: z.enum(['child', 'universal']).nullish(), recorded: z.boolean().optional() });
const UsernameOutcome = Outcome.extend({ username: z.string().optional() });

export class VaultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VaultError';
  }
}

const TIMEOUT_MS = 8000;

export type Vault = ReturnType<typeof createVault>;

export function createVault(config: Config) {
  async function rpc(name: string, args: object): Promise<unknown> {
    let response: Response;

    try {
      response = await fetch(`${config.supabaseUrl}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: {
          apikey: config.supabaseServiceRoleKey,
          authorization: `Bearer ${config.supabaseServiceRoleKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(args),
        redirect: 'error',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new VaultError(`${name}: unreachable`);
    }

    if (!response.ok) throw new VaultError(`${name}: status ${response.status}`);

    const text = await response.text();

    return text === '' ? null : JSON.parse(text);
  }

  function parse<T>(name: string, schema: z.ZodType<T>, value: unknown): T {
    const parsed = schema.safeParse(value);

    if (!parsed.success) throw new VaultError(`${name}: unexpected answer`);

    return parsed.data;
  }

  return {
    /** Null when the account does not exist. */
    async sessionContext(userId: string, sessionId: string): Promise<AccountContext | null> {
      const value = await rpc('core_session_context', { p_user: userId, p_session: sessionId });

      return value === null ? null : parse('core_session_context', Context, value);
    },

    async declareAge(userId: string, age: number, guardianPermission: boolean) {
      return parse('core_declare_age', AgeOutcome, await rpc('core_declare_age', { p_user: userId, p_age: age, p_guardian_permission: guardianPermission }));
    },

    async syncBaseType(userId: string): Promise<void> {
      await rpc('core_sync_base_type', { p_user: userId });
    },

    /** The address behind a username, or null. Never tell a caller which of the two it was. */
    async emailForUsername(username: string): Promise<string | null> {
      return parse('core_email_for_username', z.string().nullable(), await rpc('core_email_for_username', { p_username: username }));
    },

    /** Whether an address already has an account. For Core's own bookkeeping only: never tell a caller. */
    async accountExists(email: string): Promise<boolean> {
      return parse('core_account_exists', z.boolean(), await rpc('core_account_exists', { p_email: email }));
    },

    async setUsername(userId: string, username: string) {
      return parse('core_set_username', UsernameOutcome, await rpc('core_set_username', { p_user: userId, p_username: username }));
    },

    /** The language an account's emails are written in and whether it takes the optional ones. Null when there is no such account. */
    async mailContext(userId: string): Promise<MailContext | null> {
      const value = await rpc('core_mail_context', { p_user: userId });

      return value === null ? null : parse('core_mail_context', MailContext, value);
    },

    async setLocale(userId: string, locale: string) {
      return parse('core_set_locale', Outcome, await rpc('core_set_locale', { p_user: userId, p_locale: locale }));
    },

    async setProductEmails(userId: string, wanted: boolean) {
      return parse('core_set_product_emails', Outcome, await rpc('core_set_product_emails', { p_user: userId, p_wanted: wanted }));
    },

    /** What the onboarding collected. A value left out is not changed. */
    async setProfile(userId: string, profile: { displayName?: string | undefined; mentor?: string | undefined; parentIntent?: boolean | undefined }) {
      return parse('core_set_profile', Outcome, await rpc('core_set_profile', {
        p_user: userId,
        p_display_name: profile.displayName ?? null,
        p_mentor: profile.mentor ?? null,
        p_parent_intent: profile.parentIntent ?? null,
      }));
    },

    async grantRole(actorId: string, targetId: string, role: string) {
      return parse('core_grant_role', Outcome, await rpc('core_grant_role', { p_actor: actorId, p_target: targetId, p_role: role }));
    },

    async revokeRole(actorId: string, targetId: string, role: string) {
      return parse('core_revoke_role', Outcome, await rpc('core_revoke_role', { p_actor: actorId, p_target: targetId, p_role: role }));
    },
  };
}
