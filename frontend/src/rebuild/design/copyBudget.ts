/** Binding contract: Frontend Bible 06, sections 3–5. */
export type CopyRole = 'action' | 'heading' | 'body' | 'prompt' | 'option' | 'mentor' | 'narrative' | 'data' | 'brand' | 'legal';
export type Locale = 'en-US' | 'es-MX' | 'pt-BR';
export type AgeBand = '6-9' | '10-12' | '13-17' | 'adult';
export type CopyContext = { locale: Locale; ageBand: AgeBand; surface: 'app' | 'site' };

const app = { action: 3, heading: 6, body: 12, prompt: 20, option: 8, mentor: 20, narrative: 30 };
const sentences = { heading: 1, body: 2, prompt: 2, option: 1, mentor: 2, narrative: 2 };

export function wordCount(text: string): number {
  return text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

export function copyLimit(role: CopyRole, context: CopyContext): number | null {
  if (role === 'data' || role === 'brand' || role === 'legal') return null;
  let limit = app[role];
  if (context.surface === 'site') {
    if (role === 'heading') limit = 8;
    if (role === 'body') limit = 25;
  } else if (context.ageBand === '6-9') {
    if (role === 'mentor' || role === 'prompt') limit = 12;
    if (role === 'option') limit = 5;
  }
  return Math.ceil(limit * (context.locale === 'en-US' ? 1 : 1.25));
}

export function firstViewLimit(context: CopyContext): number | null {
  if (context.surface === 'site') return null;
  return Math.ceil((context.ageBand === '6-9' ? 25 : 40) * (context.locale === 'en-US' ? 1 : 1.25));
}

/** Reports defects; never truncates a string or rewrites a disclosure. */
export function checkCopy(text: string, role: CopyRole, context: CopyContext): string[] {
  const limit = copyLimit(role, context);
  if (limit === null) return [];
  const issues: string[] = [];
  if (wordCount(text) > limit) issues.push('word-budget');
  // Honorifics and decimal numbers are not sentence boundaries.
  const normalized = text.replace(/\b(?:Dr|Mr|Mrs|Ms|Sr|Sra|Dra)\./gu, '').replace(/(\d)\.(?=\d)/gu, '$1');
  const count = normalized.split(/[.!?…]+(?:\s|$)/u).filter((part) => /[\p{L}\p{N}]/u.test(part)).length;
  if (role in sentences && count > sentences[role as keyof typeof sentences]) issues.push('sentence-budget');
  if (text.includes('—')) issues.push('em-dash');
  return issues;
}
