import enLegal from '../../i18n/en-US/legal.json';
import esLegal from '../../i18n/es-MX/legal.json';
import ptLegal from '../../i18n/pt-BR/legal.json';
import type { Locale } from '../design/copyBudget';

/*
 * The Terms and the Privacy Notice (M5, M6) as documents. Their text is
 * Legal's (OD-10: Legal updates the Terms once the migration is done), so it
 * lives in its own file per locale (`i18n/<locale>/legal.json`), apart from
 * the budgeted interface copy, and is rendered whole as `legal` copy (06
 * §3.3: mandated text is never shortened). This module only turns the file
 * into ordered sections: every paragraph a clause has, in order, stopping at
 * the first gap (the legacy viewer once rendered an allowlist of paragraphs
 * and silently dropped 48 of them).
 */

export type LegalDoc = 'terms' | 'privacy';
const FILES = { 'en-US': enLegal, 'es-MX': esLegal, 'pt-BR': ptLegal } as const;
const SECTION_IDS: Record<LegalDoc, readonly string[]> = {
  terms: Array.from({ length: 20 }, (_, index) => `c${index + 1}`),
  privacy: Array.from({ length: 8 }, (_, index) => `s${index + 1}`),
};

export interface LegalSection { id: string; title: string; paragraphs: string[] }
export interface LegalDocument {
  doc: LegalDoc;
  title: string;
  subtitle: string;
  preamble: string;
  sections: LegalSection[];
  lastUpdated: string;
  company: string;
  officialNotice: string;
  address: string;
  email: string;
  contact: string;
  /** The Privacy Notice's closing blocks: cookies and measurement, the reader's controls, and whom to ask. */
  privacyExtras: { cookiesTitle: string; cookiesBody: string; controlsTitle: string; controlsBody: string; contactTitle: string; contactBody: string } | null;
}

type Clause = Record<string, string>;

export function legalDocument(locale: Locale, doc: LegalDoc): LegalDocument {
  const file = FILES[locale];
  const source = file[doc] as unknown as Record<string, string | Clause>;
  const sections = SECTION_IDS[doc].flatMap((id) => {
    const clause = source[id];
    if (!clause || typeof clause === 'string') return [];
    const paragraphs: string[] = [];
    for (let index = 1; typeof clause[`p${index}`] === 'string' && clause[`p${index}`]; index += 1) paragraphs.push(clause[`p${index}`]!);
    return [{ id, title: clause.title ?? id, paragraphs }];
  });
  const privacy = file.privacy;
  return {
    doc,
    title: String(source.title),
    subtitle: String(source.subtitle),
    preamble: String(source.preamble),
    sections,
    lastUpdated: file.meta.lastUpdated,
    company: file.meta.company,
    officialNotice: file.meta.officialNotice,
    address: file.meta.address,
    email: file.meta.email,
    contact: file.contact,
    privacyExtras: doc === 'privacy' ? {
      cookiesTitle: privacy.cookiesTitle, cookiesBody: privacy.cookiesBody, controlsTitle: privacy.controlsTitle,
      controlsBody: privacy.controlsBody, contactTitle: privacy.contactTitle, contactBody: privacy.contactBody,
    } : null,
  };
}

/** Case- and accent-insensitive: "politica" finds "política". */
export function normalizeForSearch(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();
}

export function matchingSections(sections: readonly LegalSection[], query: string): LegalSection[] {
  const needle = normalizeForSearch(query.trim());
  if (!needle) return [...sections];
  return sections.filter((section) => normalizeForSearch([section.title, ...section.paragraphs].join(' ')).includes(needle));
}
