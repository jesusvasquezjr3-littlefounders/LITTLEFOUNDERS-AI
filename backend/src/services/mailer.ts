import type { Config } from '../config.js';
import { log } from '../lib/log.js';

/*
 * Asks the mail service for one of its emails (email-server/src/mail/templates.ts). Core chooses
 * which email, for whom and in which language; the mail service owns every word and the design.
 * Nothing here is logged but the name of the email and how it went: never an address or a code.
 */
export type Locale = 'en-US' | 'es-MX' | 'pt-BR';

export type Email =
  | { template: 'sign-in-code' | 'sign-up-code'; data: { code: string; minutes: number } }
  | { template: 'welcome'; data: Record<string, never> };

export type Recipient = { to: string; locale: Locale; userId: string; unsubscribe: { page: string; oneClick: string } };

const TIMEOUT_MS = 8000;

export type Mailer = ReturnType<typeof createMailer>;

export function createMailer(config: Config) {
  return {
    /** True when the email was handed to the mail service. */
    async send(email: Email, recipient: Recipient): Promise<boolean> {
      if (!config.emailServerUrl || !config.internalApiKey) {
        log.warn('mail.not_configured', { template: email.template });

        return false;
      }

      try {
        const response = await fetch(`${config.emailServerUrl}/api/v1/send`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-internal-api-key': config.internalApiKey },
          body: JSON.stringify({ ...recipient, ...email }),
          redirect: 'error',
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });

        if (!response.ok) log.warn('mail.refused', { template: email.template, status: response.status });

        return response.ok;
      } catch {
        log.warn('mail.unreachable', { template: email.template });

        return false;
      }
    },
  };
}
