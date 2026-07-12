/*
 * Pure document-matching logic: OCR text vs applicant-declared data.
 * No I/O, no logging — OCR text carries PII and must never leave this
 * function's scope (parent-id-check/AGENTS.md: strictest PII handling).
 */

export interface ApplicantData {
  givenNames: string;
  surnames: string;
  /** ISO date, yyyy-mm-dd */
  birthDate: string;
}

export interface MatchChecks {
  documentReadable: boolean;
  nameMatch: boolean;
  birthDateMatch: boolean;
  notExpired: boolean;
}

export interface MatchResult {
  verified: boolean;
  checks: MatchChecks;
}

/** Uppercase, strip diacritics, collapse whitespace. */
export function normalize(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9/\-. ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Levenshtein distance capped at `max + 1` (early-exit band). */
function levenshtein(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr: number[] = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      const val = Math.min((prev[j] ?? Infinity) + 1, (curr[j - 1] ?? Infinity) + 1, (prev[j - 1] ?? Infinity) + cost);
      curr[j] = val;
      rowMin = Math.min(rowMin, val);
    }
    if (rowMin > max) return max + 1;
    prev = curr;
  }
  return prev[b.length] ?? max + 1;
}

/** Does `token` appear in `words` (exact, or 1 edit away for tokens ≥5 chars)? */
function tokenFound(token: string, words: string[]): boolean {
  const tolerance = token.length >= 5 ? 1 : 0;
  return words.some((w) => levenshtein(token, w, tolerance) <= tolerance);
}

/**
 * Every meaningful name token (≥3 chars — skips DE/LA/DOS connectors) must be
 * present in the OCR text, with 1-edit tolerance on longer tokens to absorb
 * OCR noise. IDs print names in varying order, so order is not checked.
 */
export function namesMatch(text: string, givenNames: string, surnames: string): boolean {
  const words = text.split(' ');
  const tokens = normalize(`${givenNames} ${surnames}`)
    .split(' ')
    .filter((t) => t.length >= 3);
  if (tokens.length === 0) return false;
  return tokens.every((t) => tokenFound(t, words));
}

const MONTH_ABBREV: Record<string, string[]> = {
  '01': ['ENE', 'JAN'],
  '02': ['FEB'],
  '03': ['MAR'],
  '04': ['ABR', 'APR'],
  '05': ['MAY', 'MAI'],
  '06': ['JUN'],
  '07': ['JUL'],
  '08': ['AGO', 'AUG'],
  '09': ['SEP', 'SET'],
  '10': ['OCT', 'OUT'],
  '11': ['NOV'],
  '12': ['DIC', 'DEC', 'DEZ'],
};

/** All the ways `yyyy-mm-dd` plausibly prints on an ID document. */
function dateRepresentations(iso: string): string[] {
  const yyyy = iso.slice(0, 4);
  const mm = iso.slice(5, 7);
  const dd = iso.slice(8, 10);
  const reps = [
    `${dd}/${mm}/${yyyy}`,
    `${dd}-${mm}-${yyyy}`,
    `${dd}.${mm}.${yyyy}`,
    `${dd} ${mm} ${yyyy}`,
    `${mm}/${dd}/${yyyy}`,
    `${yyyy}-${mm}-${dd}`,
    `${dd}${mm}${yyyy}`,
    `${yyyy}${mm}${dd}`,
  ];
  for (const abbrev of MONTH_ABBREV[mm] ?? []) {
    reps.push(`${dd} ${abbrev} ${yyyy}`, `${dd}/${abbrev}/${yyyy}`, `${dd}-${abbrev}-${yyyy}`, `${dd}${abbrev}${yyyy}`);
  }
  return reps;
}

export function birthDateFound(text: string, isoBirthDate: string): boolean {
  const compact = text.replace(/ /g, '');
  return dateRepresentations(isoBirthDate).some(
    (rep) => text.includes(rep) || compact.includes(rep.replace(/ /g, '')),
  );
}

/**
 * Expiry: the document must still be valid. Two signals, either suffices:
 *  1. A fully-dated string in the future (dd/mm/yyyy, yyyy-mm-dd …).
 *  2. A standalone plausible year ≥ the current year (Mexican INE prints
 *     "VIGENCIA <yyyy>" — valid through the END of that year).
 * No year found at all → NOT valid (failing open is forbidden).
 * Years belonging to the birth date are excluded from signal 2.
 */
export function documentNotExpired(text: string, isoBirthDate: string, today = new Date()): boolean {
  const currentYear = today.getFullYear();
  const birthYear = Number(isoBirthDate.slice(0, 4));

  const fullDates = [...text.matchAll(/\b(\d{2})[/\-.](\d{2})[/\-.](\d{4})\b/g), ...text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)];
  for (const m of fullDates) {
    const year = Number(m[3]?.length === 4 ? m[3] : m[1]);
    if (year > birthYear && year >= currentYear) return true;
  }

  const years = [...text.matchAll(/\b(19\d{2}|20\d{2})\b/g)].map((m) => Number(m[1]));
  return years.some((y) => y !== birthYear && y >= currentYear && y <= currentYear + 40);
}

/** Enough legible signal to trust the OCR at all. */
export function isReadable(text: string): boolean {
  const letters = text.replace(/[^A-Z]/g, '').length;
  return text.length >= 40 && letters >= 25;
}

export function matchDocument(rawText: string, applicant: ApplicantData, today = new Date()): MatchResult {
  const text = normalize(rawText);
  const checks: MatchChecks = {
    documentReadable: isReadable(text),
    nameMatch: namesMatch(text, applicant.givenNames, applicant.surnames),
    birthDateMatch: birthDateFound(text, applicant.birthDate),
    notExpired: documentNotExpired(text, applicant.birthDate, today),
  };
  return {
    verified: checks.documentReadable && checks.nameMatch && checks.birthDateMatch && checks.notExpired,
    checks,
  };
}
