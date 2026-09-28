// OD-11 / owner log §5 — the controlled glossary, as data (GAP-FIX-R1 learning).
//
// OD-11: translation is done by AI, working from the controlled glossary in
// section 5 of `docs/littlefounders-spec/product/13-OWNER-DECISION-LOG.md`.
// This module is that table as data (glossary.test.ts keeps it equal to the
// owner log's rows), the lines the translator is handed, and the re-gate that
// blocks a translated lesson on a never-use term.
//
// The re-gate follows the tone gate's allowances: a quoted term, or one
// preceded by a negation within four words ("it is not a bank"), is taught or
// examined, not voiced, and goes to Stage 3 review instead of blocking.
// Only unambiguous misuses are scanned: the AI called a Tutor, a bot or an
// assistant; a "streak freeze"; a chore called a job; the Wallet called a
// digital bank. Words a lesson legitimately teaches about ("bank",
// "money", "accept") stay translator guidance, not a block.

import type { ContentLocale } from './budgets.js';
import { foldText } from './text.js';

export interface GlossaryRow {
  concept: string;
  term: Record<ContentLocale, string>;
  neverUse: string;
}

/** Owner log §5, row for row (glossary.test.ts compares it with the markdown table). */
export const CONTROLLED_GLOSSARY: readonly GlossaryRow[] = [
  { concept: 'Verified parent', term: { 'en-US': 'Tutor', 'es-MX': 'Tutor', 'pt-BR': 'Tutor' }, neverUse: '(never for the AI)' },
  { concept: 'The AI character', term: { 'en-US': "Mentor (or the character's name)", 'es-MX': 'Mentor', 'pt-BR': 'Mentor' }, neverUse: 'Tutor, bot, assistant' },
  { concept: 'In-app currency', term: { 'en-US': 'coins', 'es-MX': 'monedas', 'pt-BR': 'moedas' }, neverUse: 'money, pesos, reais (it is a simulation)' },
  { concept: 'Chore', term: { 'en-US': 'task / chore', 'es-MX': 'tarea', 'pt-BR': 'tarefa' }, neverUse: 'job' },
  { concept: "Parent's approval", term: { 'en-US': 'approve', 'es-MX': 'aprobar', 'pt-BR': 'aprovar' }, neverUse: 'accept' },
  { concept: 'Savings / spending / sharing', term: { 'en-US': 'save / spend / share', 'es-MX': 'ahorrar / gastar / compartir', 'pt-BR': 'poupar / gastar / compartilhar' }, neverUse: 'invest (for the save pocket)' },
  { concept: 'Rest day', term: { 'en-US': 'rest day', 'es-MX': 'día de descanso', 'pt-BR': 'dia de descanso' }, neverUse: 'streak freeze (implies a purchase)' },
  // The owner log's concept cell also names the retired section name; the translator is never handed it (OD-28).
  { concept: 'The money section (OD-28)', term: { 'en-US': 'Wallet', 'es-MX': 'Cartera', 'pt-BR': 'Carteira' }, neverUse: 'bank, banking account' },
  { concept: 'Allowance (regional)', term: { 'en-US': 'allowance', 'es-MX': 'domingo / mesada (confirm regionally)', 'pt-BR': 'mesada' }, neverUse: '' },
  { concept: "The Mentor's 3D scene", term: { 'en-US': 'Diorama', 'es-MX': 'Diorama', 'pt-BR': 'Diorama' }, neverUse: '' },
  { concept: 'The Mentor screen', term: { 'en-US': "Mentor (the character's name in the learner's UI)", 'es-MX': 'Mentor', 'pt-BR': 'Mentor' }, neverUse: 'chatbot, bot, assistant' },
];

/** The translator's glossary block for one target market (injected into translationSystemPrompt). */
export function glossaryPromptLines(locale: ContentLocale): string {
  const rows = CONTROLLED_GLOSSARY.map((row) => `${row.concept} = "${row.term[locale]}"${row.neverUse ? ` (never: ${row.neverUse})` : ''}`);
  return `CONTROLLED GLOSSARY (OD-11, owner log section 5): use exactly these terms. ${rows.join('; ')}. ` +
    'The AI character is always the Mentor (or the character\'s name), never a Tutor, bot or assistant; "Tutor" means only the verified parent. ' +
    'Coins are play coins. A chore is a task, never a job. A rest day is never a "streak freeze". The money section is the Wallet, never a bank.';
}

type Misuse = 'ai-as-tutor' | 'bot-or-assistant' | 'streak-freeze' | 'chore-as-job' | 'wallet-as-bank';
interface NeverUse { misuse: Misuse; re: RegExp }

const NEVER_USE: Readonly<Record<ContentLocale, readonly NeverUse[]>> = {
  'en-US': [
    { misuse: 'ai-as-tutor', re: /\b(ai|virtual|digital|robot)\s+tutors?\b/ },
    { misuse: 'bot-or-assistant', re: /\b(chat)?bots?\b|\b(ai|virtual|digital)\s+assistants?\b/ },
    { misuse: 'streak-freeze', re: /\bstreak\s+freezes?\b/ },
    { misuse: 'chore-as-job', re: /\bjobs?\b/ },
    { misuse: 'wallet-as-bank', re: /\bdigital\s+bank(ing)?\b/ },
  ],
  'es-MX': [
    { misuse: 'ai-as-tutor', re: /\btutor(a|es)?\s+(de\s+ia|virtual|digital|robot)\b/ },
    { misuse: 'bot-or-assistant', re: /\b(chat)?bots?\b|\basistentes?\s+(de\s+ia|virtual(es)?|digital(es)?)\b/ },
    { misuse: 'streak-freeze', re: /\bcongela(r|dor)\s+(de\s+)?(la\s+)?racha\b/ },
    { misuse: 'wallet-as-bank', re: /\bbanca\s+digital\b|\bbanco\s+digital\b/ },
  ],
  'pt-BR': [
    { misuse: 'ai-as-tutor', re: /\btutor(a|es)?\s+(de\s+ia|virtual|digital|robo)\b/ },
    { misuse: 'bot-or-assistant', re: /\b(chat)?bots?\b|\bassistentes?\s+(de\s+ia|virtua(l|is)|digita(l|is))\b/ },
    { misuse: 'streak-freeze', re: /\bcongela(r|mento)\s+(de\s+)?(a\s+)?sequencia\b/ },
    { misuse: 'wallet-as-bank', re: /\bbanco\s+digital\b/ },
  ],
};

const NEGATIONS: Readonly<Record<ContentLocale, ReadonlySet<string>>> = {
  'en-US': new Set(['no', 'not', 'never', "isn't", "aren't", 'without', 'nor']),
  'es-MX': new Set(['no', 'nunca', 'sin', 'ni', 'jamas']),
  'pt-BR': new Set(['nao', 'nunca', 'sem', 'nem', 'jamais']),
};

export interface GlossaryFinding { misuse: Misuse; severity: 'block' | 'review'; phrase: string; excerpt: string }

/** Scans one translated string for never-use terms; quoted or negated uses go to review. */
export function scanGlossary(text: string, locale: ContentLocale): GlossaryFinding[] {
  const folded = foldText(text);
  const findings: GlossaryFinding[] = [];
  for (const rule of NEVER_USE[locale]) {
    const match = rule.re.exec(folded);
    if (!match) continue;
    const before = folded.slice(0, match.index).match(/[\p{L}\p{N}']+/gu) ?? [];
    const quoted = /["“«']\s*$/.test(folded.slice(Math.max(0, match.index - 2), match.index));
    const negated = before.slice(-4).some((word) => NEGATIONS[locale].has(word));
    findings.push({ misuse: rule.misuse, severity: quoted || negated ? 'review' : 'block', phrase: match[0], excerpt: text.length > 80 ? `${text.slice(0, 77)}...` : text });
  }
  return findings;
}

/** Every string inside a value (documents, payloads), for the re-gate. */
export function stringsIn(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => stringsIn(item, out));
  else if (value && typeof value === 'object') Object.values(value as Record<string, unknown>).forEach((item) => stringsIn(item, out));
  return out;
}

/** The re-gate over a translated document: one blocking message per never-use hit. */
export function glossaryProblems(document: unknown, locale: ContentLocale): string[] {
  return stringsIn(document).flatMap((text) => scanGlossary(text, locale).filter((finding) => finding.severity === 'block')
    .map((finding) => `glossary (OD-11): "${finding.phrase}" is a never-use term (${finding.misuse}); use the controlled glossary term. Text: "${finding.excerpt}"`));
}
