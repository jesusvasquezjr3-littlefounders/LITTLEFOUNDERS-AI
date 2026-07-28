import type { SendRequest, SendResult } from './adapter.js';

export interface EmailLogEntry {
  id: string;
  to: string;
  subject: string;
  status: string;
  templateType: string;
  locale?: string;
  userId?: string;
  detail: Record<string, unknown>;
  createdAt: string;
}

const MAX_ENTRIES = 1000;
const entries: EmailLogEntry[] = [];

export function recordEmail(result: SendResult, req: SendRequest, extra?: { templateType?: string; locale?: string; userId?: string }): void {
  entries.push({
    id: result.id,
    to: req.to,
    subject: req.subject,
    status: result.status,
    templateType: extra?.templateType ?? 'transactional',
    locale: extra?.locale,
    userId: extra?.userId,
    detail: { html: !!req.html, text: !!req.text },
    createdAt: new Date().toISOString(),
  });
  if (entries.length > MAX_ENTRIES) entries.shift();
}

export function getEmailLogs(opts: { limit?: number; offset?: number } = {}): { entries: EmailLogEntry[]; total: number } {
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = opts.offset ?? 0;
  const sliced = entries.slice().reverse();
  return {
    entries: sliced.slice(offset, offset + limit),
    total: sliced.length,
  };
}

export function getEmailSummary(): { total: number; statuses: Record<string, number>; templates: Record<string, number> } {
  const statuses: Record<string, number> = {};
  const templates: Record<string, number> = {};
  for (const e of entries) {
    statuses[e.status] = (statuses[e.status] ?? 0) + 1;
    templates[e.templateType] = (templates[e.templateType] ?? 0) + 1;
  }
  return { total: entries.length, statuses, templates };
}
