import type { SendRequest, SendResult } from './adapter.js';
import { insertEmailLog, isVaultConfigured, listEmailLogs, summarizeEmailLogs } from '../db/emailLogsRepo.js';

/*
 * Courier's delivery history.
 *
 * Two writers, one store:
 *   - POST /api/v1/send      — mail we dispatch ourselves (templateType from
 *                              the caller, defaults to 'transactional').
 *   - POST /api/v1/logs      — mail captured by the Haraka SMTP plugin, i.e.
 *                              GoTrue auth mail (confirmation / recovery /
 *                              magic-link / invite / email-change), which
 *                              reaches the relay over SMTP and never touches
 *                              our HTTP API.
 *
 * Reads prefer the durable `email_logs` table (0021) and fall back to the
 * in-process ring buffer when Vault is unconfigured (dev/test) or unreachable.
 * The buffer alone was the old behaviour and is not sufficient in production:
 * it is wiped by every redeploy and every restart.
 */

export interface EmailLogEntry {
  /**
   * Identity of this LOG LINE — unique per row, used as the render key.
   * From Vault this is the table's uuid PK; from the ring buffer it is the
   * message id (the buffer has no other identity to offer).
   */
  id: string;
  /**
   * Identity of the EMAIL — the SMTP/provider Message-ID. This is the value an
   * operator correlates with SES logs, so it is surfaced separately rather
   * than overloading `id`.
   */
  messageId: string;
  to: string;
  subject: string;
  status: string;
  templateType: string;
  locale?: string;
  userId?: string;
  detail: Record<string, unknown>;
  createdAt: string;
}

export interface EmailLogPage {
  entries: EmailLogEntry[];
  total: number;
}

export interface EmailLogSummary {
  total: number;
  statuses: Record<string, number>;
  templates: Record<string, number>;
  locales?: Record<string, number>;
}


/** What the SMTP capture path (and any non-/send writer) supplies. */
export interface DeliveryRecord {
  messageId: string;
  to: string;
  subject: string;
  status?: string;
  templateType?: string;
  locale?: string;
  userId?: string;
  detail?: Record<string, unknown>;
}

const MAX_ENTRIES = 1000;
const entries: EmailLogEntry[] = [];

/** Ring-buffer append. Synchronous and always performed, Vault or not. */
function remember(entry: EmailLogEntry): void {
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.shift();
}

/**
 * Persist one delivery. Awaited by callers so the audit row is durable before
 * they answer, but it can never fail them: insertEmailLog swallows every error
 * and a Vault outage degrades to buffer-only, exactly as before 0021.
 */
export async function recordDelivery(input: DeliveryRecord): Promise<void> {
  const entry: EmailLogEntry = {
    id: input.messageId,
    messageId: input.messageId,
    to: input.to,
    subject: input.subject,
    status: input.status ?? 'queued',
    templateType: input.templateType ?? 'transactional',
    locale: input.locale,
    userId: input.userId,
    detail: input.detail ?? {},
    createdAt: new Date().toISOString(),
  };
  remember(entry);
  if (isVaultConfigured()) {
    const stored = await insertEmailLog(entry);
    if (!stored) {
      console.warn(`[courier] email_logs write-through failed for ${entry.id} — history kept in memory only`);
    }
  }
}

/** Convenience wrapper for the POST /api/v1/send path. */
export async function recordEmail(
  result: SendResult,
  req: SendRequest,
  extra?: { templateType?: string; locale?: string; userId?: string },
): Promise<void> {
  await recordDelivery({
    messageId: result.id,
    to: req.to,
    subject: req.subject,
    status: result.status,
    templateType: extra?.templateType,
    locale: extra?.locale,
    userId: extra?.userId,
    detail: { html: !!req.html, text: !!req.text },
  });
}

/** Newest-first page. Durable history when available, buffer otherwise. */
export async function getEmailLogs(opts: { limit?: number; offset?: number } = {}): Promise<EmailLogPage> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = opts.offset ?? 0;

  if (isVaultConfigured()) {
    const page = await listEmailLogs({ limit, offset });
    if (page) return page;
    console.warn('[courier] email_logs read failed — falling back to the in-memory buffer');
  }

  const newestFirst = entries.slice().reverse();
  return { entries: newestFirst.slice(offset, offset + limit), total: newestFirst.length };
}

/** Aggregate counts. Durable history when available, buffer otherwise. */
export async function getEmailSummary(): Promise<EmailLogSummary> {
  if (isVaultConfigured()) {
    const summary = await summarizeEmailLogs();
    if (summary) return summary;
    console.warn('[courier] email_logs summary failed — falling back to the in-memory buffer');
  }

  const statuses: Record<string, number> = {};
  const templates: Record<string, number> = {};
  const locales: Record<string, number> = {};
  for (const e of entries) {
    statuses[e.status] = (statuses[e.status] ?? 0) + 1;
    templates[e.templateType] = (templates[e.templateType] ?? 0) + 1;
    if (e.locale) {
      locales[e.locale] = (locales[e.locale] ?? 0) + 1;
    }
  }
  return { total: entries.length, statuses, templates, locales };
}

/** Test-only: drop the in-process buffer so cases start from a known state. */
export function resetEmailLogForTests(): void {
  entries.length = 0;
}
