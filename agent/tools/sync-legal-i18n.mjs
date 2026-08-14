/*
 * Regenerates the `legal.terms` i18n subtree in all three locales from the
 * authoritative documents in /LEGAL/ (AGENTS.md §1.8).
 *
 * WHY THIS EXISTS
 * §1.8 requires the i18n legal sections to hold EXACT parity with the /LEGAL/
 * documents, "character-for-character, no summarization, no paraphrasing".
 * They did not. The Spanish document was transcribed in full (95 keys) while
 * English and Portuguese carried an older, ABRIDGED rendering (68 keys each) —
 * a one-line summary per definition instead of the clause itself. Three
 * locales were therefore serving three materially different contracts, and the
 * key-parity gate had been failing on exactly this for weeks.
 *
 * Generating all three from their own source document makes parity structural:
 * one parser, three documents, the same chapter/paragraph derivation. It
 * cannot drift again without the documents themselves drifting, which is what
 * §1.8 actually wants to protect.
 *
 * NOT A TRANSLATOR. Each locale is generated from the document already written
 * in that language by counsel. This script never invents legal text; if a
 * document is missing a chapter, the run FAILS rather than filling the gap
 * from another language.
 *
 * Run: npm run legal:sync   (then commit both the docs and the locales)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

const SOURCES = {
  'es-MX': 'LEGAL/TERMINOSyCONDICIONES.md',
  'en-US': 'LEGAL/TERMSANDCONDITIONS.md',
  'pt-BR': 'LEGAL/TERMOSDECONDIÇÕES.md',
};

/**
 * Parse a terms document into ordered chapters.
 *
 * `### N. TITLE` opens a chapter; every following blank-line-separated block is
 * one paragraph, until the next chapter. `####` sub-headings are kept INLINE
 * with their block rather than dropped: they carry meaning ("1. Risk
 * Situations") and losing them would silently change what a clause says.
 */
function parseChapters(markdown) {
  const lines = markdown.split('\n');
  const chapters = [];
  let current = null;
  let buffer = [];

  const flush = () => {
    const text = buffer.join('\n').trim();
    buffer = [];
    if (text && current) current.paragraphs.push(text);
  };

  for (const line of lines) {
    const chapter = /^###\s+(\d+)\.\s+(.+?)\s*$/.exec(line);
    if (chapter) {
      flush();
      current = { number: Number(chapter[1]), title: `${chapter[1]}. ${chapter[2]}`, paragraphs: [] };
      chapters.push(current);
      continue;
    }
    // A horizontal rule separates chapters in these documents and is not content.
    if (/^---\s*$/.test(line)) {
      flush();
      continue;
    }
    if (line.trim() === '') {
      flush();
      continue;
    }
    buffer.push(line);
  }
  flush();
  return chapters;
}

/** Markdown emphasis is presentation; the viewer renders plain text. */
function toPlainText(text) {
  return text
    .replace(/\*\*(.+?)\*\*/gs, '$1')
    .replace(/^####\s+/gm, '')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

const parsed = {};
for (const [locale, relative] of Object.entries(SOURCES)) {
  const markdown = readFileSync(resolve(root, relative), 'utf8');
  parsed[locale] = parseChapters(markdown);
}

// Structural parity is asserted, never assumed: a locale that lost a chapter
// must break the build rather than quietly publish a shorter contract.
const counts = Object.fromEntries(Object.entries(parsed).map(([locale, chapters]) => [locale, chapters.length]));
const distinct = new Set(Object.values(counts));
if (distinct.size !== 1) {
  console.error('legal:sync FAILED — the documents disagree on chapter count:', counts);
  process.exit(1);
}

for (const [locale, chapters] of Object.entries(parsed)) {
  for (const chapter of chapters) {
    if (chapter.paragraphs.length === 0) {
      console.error(`legal:sync FAILED — ${locale} chapter ${chapter.number} has no body`);
      process.exit(1);
    }
  }
}

let report = [];
for (const [locale, chapters] of Object.entries(parsed)) {
  const path = resolve(root, `frontend/src/i18n/${locale}/marketing.json`);
  const json = JSON.parse(readFileSync(path, 'utf8'));
  const terms = json.legal.terms;

  // Preserve the framing copy (title/subtitle/preamble) and replace the body.
  for (const key of Object.keys(terms)) {
    if (/^c\d+$/.test(key)) delete terms[key];
  }

  let paragraphs = 0;
  for (const chapter of chapters) {
    const entry = { title: toPlainText(chapter.title) };
    chapter.paragraphs.forEach((paragraph, index) => {
      entry[`p${index + 1}`] = toPlainText(paragraph);
    });
    paragraphs += chapter.paragraphs.length;
    terms[`c${chapter.number}`] = entry;
  }

  writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`);
  report.push(`${locale}: ${chapters.length} chapters, ${paragraphs} paragraphs`);
}

console.log('legal:sync OK');
for (const line of report) console.log(`  ${line}`);
