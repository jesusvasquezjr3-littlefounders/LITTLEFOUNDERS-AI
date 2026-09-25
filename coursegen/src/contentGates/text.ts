// Text measurement shared by the Forge content gates (B.14, B.18, OD-13).
//
// Word and sentence counting deliberately mirror the Frontend Bible's
// reference tool (docs/littlefounders-spec/frontend/verification-tools/
// copy-budget-audit.reference.mjs), so a string that passes here is measured
// the same way when the rebuilt app renders it: "a word is any run of letters
// or digits ('25%', "Sofía's" and '60' each count as one)" (Bible 06 §3).

const COMBINING_DIACRITICS_RE = new RegExp('[\\u0300-\\u036f]', 'g');

/** MarkdownLite (**bold**, *italic*, `code`, "- " lists, ==highlight==) down to the text a reader sees. */
export function plainText(markdown: string): string {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => (line.startsWith('- ') ? line.slice(2) : line))
    .map((line) =>
      line
        .replace(/==([^=\n]+)==/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .trim(),
    )
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const WORD_RE = /[\p{L}\p{N}][\p{L}\p{N}'’.,%$-]*/gu;

/** Bible 06 word count (identical expression to the reference audit). */
export function countWords(text: string): number {
  return (text.trim().match(WORD_RE) ?? []).length;
}

/** Bible 06 sentence count (identical split to the reference audit). */
export function countSentences(text: string): number {
  const cleaned = text.replace(/\b(Dr|Mr|Mrs|Ms|Sr|Sra|Srta|St)\./g, '$1').trim();
  return cleaned
    .split(/(?<=[\p{L}\p{N}]{2}[.!?…]|[.!?…]["”])\s+(?=[\p{Lu}¿¡"“])/u)
    .filter((sentence) => countWords(sentence) > 0).length;
}

/** Lower-case, diacritics removed: the comparison form used by the tone lexicon and the redundancy matcher. */
export function foldText(text: string): string {
  return text.normalize('NFD').replace(COMBINING_DIACRITICS_RE, '').toLowerCase();
}

/** Comparison tokens: folded letter/digit runs, punctuation dropped. */
export function tokens(text: string): string[] {
  return foldText(plainText(text)).match(/[\p{L}\p{N}]+/gu) ?? [];
}

/** A short excerpt for a report line. */
export function excerpt(text: string, max = 90): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}
