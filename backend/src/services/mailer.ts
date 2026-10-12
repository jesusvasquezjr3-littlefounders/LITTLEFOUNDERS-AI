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

/*
 * Whether emails are leaving at all. Core answers a request for a code before it sends it
 * (routes/auth.ts says why), so a person is told "sent" even when nothing can be sent. That is
 * right for one address and wrong for an outage: when the mail service cannot be reached, or
 * says its relay cannot be, three times running, the path is counted as down and Core says so
 * instead of promising a code. Nothing about an address goes into this: an email the relay
 * refused for one recipient (422) is that recipient's matter and is not counted, so nobody can
 * close the door on everybody by asking for codes to an address that bounces.
 */
const DOWN_AFTER = 3;
const DOWN_WINDOW_MS = 5 * 60 * 1000;
// while down, one request in a while is let through to find out whether it is back
const RETRY_EVERY_MS = 30 * 1000;

export type Mailer = ReturnType<typeof createMailer>;

export function createMailer(config: Config) {
  let failures: number[] = [];
  let lastProbeAt = 0;

  const failed = (): void => { failures = [...failures.filter((at) => Date.now() - at < DOWN_WINDOW_MS), Date.now()]; };

  return {
    /** True while the mail path looks down. Now and then it answers false once, so one request tries it again. */
    isDown(): boolean {
      const recent = failures.filter((at) => Date.now() - at < DOWN_WINDOW_MS);

      if (recent.length < DOWN_AFTER) return false;

      if (Date.now() - lastProbeAt > RETRY_EVERY_MS) {
        lastProbeAt = Date.now();

        return false;
      }

      return true;
    },

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

        if (response.ok) failures = [];
        else log.warn('mail.refused', { template: email.template, status: response.status });

        // 422 is one email the relay would not take; anything from 500 up is the mail path itself
        if (response.status >= 500) failed();

        return response.ok;
      } catch {
        failed();
        log.warn('mail.unreachable', { template: email.template });

        return false;
      }
    },
  };
}
