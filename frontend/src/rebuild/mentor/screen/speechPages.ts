import { copyLimit, wordCount, type AgeBand, type Locale } from '../../design/copyBudget';

/*
 * The speech plate holds the Mentor's CURRENT turn only, as a caption within
 * the Copy Budget (Frontend Bible 08 §2 layer 3, §5; 06 §3: the `mentor` role,
 * 20 words and 2 sentences, 12 words for ages 6–9, x1.25 in Spanish and
 * Portuguese).
 *
 * A live turn is written by the model and can be longer. It is never cut and
 * never ends in an ellipsis (02 D1): it is shown as consecutive caption pages,
 * each within the budget, broken at sentence ends first, then at clause
 * punctuation, then between words. The learner moves to the next page; the
 * transcript keeps the whole turn.
 */

const SENTENCE = /(?<=[.!?…])\s+/u;
const CLAUSE = /(?<=[,;:])\s+/u;

/** Words, keeping their trailing punctuation. */
const tokens = (text: string) => text.split(/\s+/u).filter(Boolean);

/* Honorifics are not sentence ends ("Hi, I'm Dr. Rho." is one sentence), as the Copy Budget itself counts them. */
const HONORIFIC = /\b(Dr|Dra|Mr|Mrs|Ms|Sr|Sra)\.\s/gu;
const KEEP = '\uE000';

function sentencesOf(text: string): string[] {
  return text.replace(/\s+/gu, ' ').trim().replace(HONORIFIC, `$1.${KEEP}`).split(SENTENCE).filter(Boolean)
    .map((sentence) => sentence.split(KEEP).join(' '));
}

/** One sentence, cut into pieces of at most `limit` words: at clause punctuation when it can, between words when it must. */
function splitSentence(sentence: string, limit: number): string[] {
  if (wordCount(sentence) <= limit) return [sentence];
  const out: string[] = [];
  let current = '';
  for (const clause of sentence.split(CLAUSE)) {
    const joined = current ? `${current} ${clause}` : clause;
    if (wordCount(joined) <= limit) { current = joined; continue; }
    if (current) out.push(current);
    if (wordCount(clause) <= limit) { current = clause; continue; }
    // A clause longer than the budget: between words.
    current = '';
    for (const word of tokens(clause)) {
      const next = current ? `${current} ${word}` : word;
      if (wordCount(next) > limit && current) { out.push(current); current = word; } else current = next;
    }
  }
  if (current) out.push(current);
  return out;
}

export function speechLimit(locale: Locale, ageBand: AgeBand): number {
  return copyLimit('mentor', { locale, ageBand, surface: 'app' }) ?? 20;
}

/** The caption pages of one turn: each at most two sentences and the band's word budget. */
export function speechPages(text: string, locale: Locale, ageBand: AgeBand): string[] {
  const limit = speechLimit(locale, ageBand);
  const pieces = sentencesOf(text).flatMap((sentence) => splitSentence(sentence, limit));
  const pages: string[] = [];
  let page = '';
  let sentences = 0;
  for (const piece of pieces) {
    const joined = page ? `${page} ${piece}` : piece;
    if (page && (wordCount(joined) > limit || sentences >= 2)) { pages.push(page); page = piece; sentences = 1; continue; }
    page = joined;
    sentences += 1;
  }
  if (page) pages.push(page);
  return pages;
}
