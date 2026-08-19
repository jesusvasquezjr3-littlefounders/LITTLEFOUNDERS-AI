/*
 * author-localize — the es-MX → {en-US, pt-BR} string freeze, for a subagent
 * translator instead of DeepSeek.
 *
 * THE POINT OF THIS SCRIPT IS WHAT IT DOES *NOT* LET THE TRANSLATOR TOUCH.
 * A subagent asked to "translate this lesson" would re-emit the whole document
 * and quietly renumber an id, round a number, or reword an answer key — and the
 * three locales would stop being the same lesson. So the translator never sees
 * a document: `extract` hands it a FLAT index → string map containing only
 * learner-visible text (ids, numbers, enums, answer keys and every
 * NON_VISIBLE_KEY are excluded by `indexVisibleStrings`), and `inject` puts the
 * translations back at the exact recorded paths. Structural parity across the
 * three locales is therefore mechanical, not a thing we hope the agent got
 * right.
 *
 * Both halves are the SAME primitives `localizeLesson` uses — see localize.ts.
 *
 * Usage:
 *   npx tsx src/scripts/author-localize.ts extract --course <slug> --dir <d>
 *   npx tsx src/scripts/author-localize.ts inject  --course <slug> --dir <d>
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { loadCourseCatalog } from '../catalog/loader.js';
import { enumerateSlots, type Slot } from '../pipeline/run.js';
import { resolveRegister } from '../pipeline/register.js';
import { lessonDocumentSchema, type LessonDocumentParsed } from '../contract/schema.js';
import {
  indexVisibleStrings,
  applyTranslatedStrings,
  describeReinjectionIssues,
  translationSystemPrompt,
} from '../pipeline/localize.js';
import { runVocabularyGate } from '../pipeline/gates.js';
import { runReadabilityGate } from '../pipeline/readability.js';

const TARGET_LOCALES = ['en-US', 'pt-BR'] as const;
type TargetLocale = (typeof TARGET_LOCALES)[number];

/**
 * Types whose ANSWER IS AN ORDER of tokens the learner assembles into prose.
 * The string freeze protects the order — and that is exactly the problem here.
 */
const ORDERED_PROSE_TYPES = new Set(['build_sentence']);

/**
 * THE DEFECT THIS EXISTS FOR (found 2026-08-17, on a real translated lesson).
 *
 * `build_sentence` grades the ORDER of word tiles. The freeze hands the
 * translator the tiles ALONE, with no order and no sentence — so a translator
 * can return ten perfectly good words that, reassembled in the frozen order,
 * are not a sentence. Observed: "¿Qué es lo que más te cuesta de vender aquí?"
 * came back as "What is the thing for you hardest about selling here?".
 *
 * Nothing else catches it. The gates see a structurally perfect segment (valid
 * tiles, real ids, complete order). The judge reads the es-MX document, where
 * the sentence is fine. The defect exists only in the TRANSLATION, only once
 * the tiles are laid out in the key's order — which nothing ever did.
 *
 * Grammaticality is not decidable here, so this does not fail the run. It does
 * the one thing that was actually missing: it makes the assembled sentence
 * VISIBLE, per locale, in the report and on stdout. An invisible defect becomes
 * a line someone reads.
 */
function assembleOrderedProse(document: LessonDocumentParsed): Array<{ segmentId: string; sentence: string }> {
  const out: Array<{ segmentId: string; sentence: string }> = [];
  for (const segment of document.segments) {
    if (!ORDERED_PROSE_TYPES.has(segment.type)) continue;
    const payload = (segment as { payload?: { tokens?: Array<{ id: string; text_md?: string }> } }).payload;
    const answer = (segment as { answer?: { order?: string[] } }).answer;
    if (!payload?.tokens || !answer?.order) continue;
    const byId = new Map(payload.tokens.map((t) => [t.id, t.text_md ?? '']));
    out.push({ segmentId: segment.id, sentence: answer.order.map((id) => byId.get(id) ?? `«${id}»`).join(' ') });
  }
  return out;
}

interface SlotReport {
  slotId: string;
  out: string;
  ok: boolean;
}

function parseArgs(argv: string[]): { command: 'extract' | 'inject'; course: string; dir: string } {
  const command = argv[0];
  if (command !== 'extract' && command !== 'inject') {
    throw new Error('author-localize: first argument must be "extract" or "inject"');
  }
  let course: string | undefined;
  let dir: string | undefined;
  for (let i = 1; i < argv.length; i++) {
    const value = argv[i + 1];
    const take = (name: string): string => {
      if (value === undefined || value.startsWith('--')) throw new Error(`author-localize: ${name} requires a value`);
      i++;
      return value;
    };
    if (argv[i] === '--course') course = take('--course');
    else if (argv[i] === '--dir') dir = take('--dir');
    else throw new Error(`author-localize: unknown flag "${argv[i]}"`);
  }
  if (!course || !dir) throw new Error('author-localize: --course and --dir are required');
  return { command, course, dir };
}

/** Only slots that already cleared the contract + all 9 gates are localizable. */
function validatedSlots(dir: string): Array<{ slotId: string; out: string; stem: string }> {
  const reportPath = join(dir, 'report.json');
  if (!existsSync(reportPath)) {
    throw new Error('author-localize: report.json is missing — run author-validate.ts first');
  }
  const report = JSON.parse(readFileSync(reportPath, 'utf8')) as { slots: SlotReport[] };
  return report.slots
    .filter((s) => s.ok)
    .map((s) => ({ slotId: s.slotId, out: s.out, stem: s.out.replace(/^out\//, '').replace(/\.es-MX\.json$/, '') }));
}

function readSourceDocument(dir: string, out: string) {
  const parsed = lessonDocumentSchema.safeParse(JSON.parse(readFileSync(join(dir, out), 'utf8')));
  if (!parsed.success) {
    throw new Error(`author-localize: ${out} no longer parses against the contract — re-run author-validate.ts`);
  }
  return parsed.data;
}

function extract(course: string, dir: string): void {
  const slots = validatedSlots(dir);
  if (slots.length === 0) throw new Error('author-localize: no validated slots to localize');
  const i18n = join(dir, 'i18n');
  mkdirSync(i18n, { recursive: true });

  for (const locale of TARGET_LOCALES) {
    writeFileSync(
      join(i18n, `_TRANSLATE.${locale}.md`),
      [
        `# Translation rules — es-MX → ${locale}`,
        '',
        'These are the platform rules, verbatim. They are binding.',
        '',
        translationSystemPrompt(locale),
        '',
        '## What you are given',
        '',
        'A flat JSON object of `"index": "source string"`. The index keys are positional — NEVER add, drop, reorder or renumber a key.',
        'You will not see the document. You do not need to: ids, numbers, answer keys and enum values are deliberately excluded, and they are re-injected around your translations automatically.',
        '',
        '## What you return',
        '',
        `A file with EXACTLY the same keys, values translated into ${locale}. Strict JSON object, nothing else in the file.`,
        '',
        'A string that is only a number, a code, or a single symbol is usually a label that still needs translating in context — translate the words, leave the digits alone.',
        '',
      ].join('\n'),
      'utf8',
    );
  }

  let strings = 0;
  const todo: Array<{ slotId: string; stem: string; source: string; targets: Record<string, string>; count: number }> = [];
  for (const slot of slots) {
    const document = readSourceDocument(dir, slot.out);
    const { indexMap } = indexVisibleStrings(document);
    const sourceFile = `i18n/${slot.stem}.source.json`;
    writeFileSync(join(dir, sourceFile), `${JSON.stringify(indexMap, null, 2)}\n`, 'utf8');
    strings += Object.keys(indexMap).length;
    todo.push({
      slotId: slot.slotId,
      stem: slot.stem,
      source: sourceFile,
      targets: Object.fromEntries(TARGET_LOCALES.map((l) => [l, `i18n/${slot.stem}.${l}.json`])),
      count: Object.keys(indexMap).length,
    });
  }

  writeFileSync(join(dir, 'i18n', 'todo.json'), `${JSON.stringify({ course, slots: todo }, null, 2)}\n`, 'utf8');
  console.log(`author-localize extract: ${slots.length} slot(s), ${strings} visible string(s) per locale → ${dir}/i18n`);
}

function inject(course: string, dir: string): void {
  const load = loadCourseCatalog(join('curriculum', course));
  const { taxonomy } = load.course;
  if (!taxonomy) throw new Error('author-localize: course taxonomy failed to load');
  const register = resolveRegister(taxonomy, 'kid');
  const slotsById = new Map<string, Slot>(enumerateSlots(load.course.adventures).map((s) => [s.slotId, s]));

  const slots = validatedSlots(dir);
  const results: Array<{
    slotId: string;
    locale: TargetLocale;
    ok: boolean;
    problems: string[];
    /** Strings that could not be made to fit and fell back to the es-MX source. */
    untranslatedFallbacks: number;
    readabilityWarnings: number;
    /** Ordered-prose segments reassembled in their answer order — READ THESE. */
    assembledProse?: Array<{ segmentId: string; sentence: string }>;
  }> = [];

  for (const slot of slots) {
    const source = readSourceDocument(dir, slot.out);
    const tier = slotsById.get(slot.slotId)!.tier;

    for (const locale of TARGET_LOCALES) {
      const translatedPath = join(dir, `i18n/${slot.stem}.${locale}.json`);
      const base = { slotId: slot.slotId, locale, untranslatedFallbacks: 0, readabilityWarnings: 0 };
      if (!existsSync(translatedPath)) {
        results.push({ ...base, ok: false, problems: [`no translation file at i18n/${slot.stem}.${locale}.json`] });
        continue;
      }

      const translated = JSON.parse(readFileSync(translatedPath, 'utf8')) as Record<string, string>;
      // A fresh index per locale: `applyTranslatedStrings` mutates its clone.
      const index = indexVisibleStrings(source);
      const expected = Object.keys(index.indexMap);
      const missing = expected.filter((k) => typeof translated[k] !== 'string');
      if (missing.length > 0) {
        results.push({
          ...base,
          ok: false,
          problems: [`translation is missing ${missing.length} key(s): ${missing.slice(0, 10).join(', ')}`],
        });
        continue;
      }

      let parsed = applyTranslatedStrings(index, locale, translated);
      let fallbacks = 0;
      if (!parsed.success) {
        /*
         * Same last-resort as localize.ts: a field that still breaks the schema
         * after translation (almost always a length overflow) falls back to its
         * es-MX source string, which is guaranteed to fit because it already
         * did. One untranslated string is a far smaller defect than losing the
         * lesson — but it is REPORTED, never silent, because "shipped in the
         * wrong language" is exactly the kind of thing that hides behind a
         * green run.
         */
        const feedback = describeReinjectionIssues(
          index,
          parsed.error.issues as unknown as { path: PropertyKey[]; code: string; message: string; maximum?: unknown }[],
          (i) => translated[String(i)] ?? '',
        );
        const patched = { ...translated };
        for (const stringIndex of feedback.keys()) {
          patched[String(stringIndex)] = index.extracted[stringIndex]!.value;
          fallbacks++;
        }
        parsed = applyTranslatedStrings(indexVisibleStrings(source), locale, patched);
      }

      if (!parsed.success) {
        results.push({
          ...base,
          ok: false,
          untranslatedFallbacks: fallbacks,
          problems: parsed.error.issues.slice(0, 6).map((i) => `${i.path.join('.')}: ${i.message}`),
        });
        continue;
      }

      // Forbidden-vocabulary lists are per-locale, so this gate genuinely has
      // to run again on the translation (localize.ts does the same).
      const vocab = register.vocabularyGates ? runVocabularyGate(parsed.data, taxonomy, tier) : [];
      if (vocab.length > 0) {
        results.push({
          ...base,
          ok: false,
          untranslatedFallbacks: fallbacks,
          problems: vocab.slice(0, 6).map((p) => `vocabulary: ${p.message}`),
        });
        continue;
      }

      /*
       * Readability is per tier×LOCALE, and the pipeline does not re-run it
       * after translation — so this is reported as a WARNING, not a failure.
       * Holding subagent translations to a bar the shipped corpus never had to
       * clear would block the run on a difference in process, not in quality.
       */
      const readability = runReadabilityGate(parsed.data, tier);

      const assembledProse = assembleOrderedProse(parsed.data);

      writeFileSync(join(dir, `out/${slot.stem}.${locale}.json`), `${JSON.stringify(parsed.data, null, 2)}\n`, 'utf8');
      results.push({
        ...base,
        ok: true,
        problems: [],
        untranslatedFallbacks: fallbacks,
        readabilityWarnings: readability.length,
        ...(assembledProse.length > 0 ? { assembledProse } : {}),
      });
    }
  }

  writeFileSync(join(dir, 'i18n', 'inject-report.json'), `${JSON.stringify({ course, results }, null, 2)}\n`, 'utf8');

  const ok = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  const fallbacks = ok.reduce((n, r) => n + r.untranslatedFallbacks, 0);
  const readability = ok.reduce((n, r) => n + r.readabilityWarnings, 0);
  console.log(`author-localize inject: ${ok.length}/${results.length} locale bundle(s) written`);
  if (fallbacks > 0) console.log(`  ${fallbacks} string(s) fell back to the es-MX source (would not fit the schema after translation)`);
  if (readability > 0) console.log(`  ${readability} readability warning(s) — informational, the pipeline does not gate on these post-translation`);

  /*
   * Printed, not gated: grammaticality is not decidable here. What WAS missing
   * is that nobody ever looked. A `build_sentence` translated tile-by-tile can
   * reassemble, in the frozen answer order, into something that is not a
   * sentence — and every other check passes it. Read these.
   */
  const prose = ok.filter((r) => r.assembledProse && r.assembledProse.length > 0);
  if (prose.length > 0) {
    console.log('\n  ORDERED-PROSE CHECK — each sentence as the learner assembles it. Read them; a translation can be word-perfect and still not be a sentence:');
    for (const r of prose) {
      for (const p of r.assembledProse!) {
        console.log(`    [${r.locale}] ${r.slotId.split('/').pop()} / ${p.segmentId}\n      ${p.sentence}`);
      }
    }
  }
  for (const r of failed) {
    console.log(`\n  FAIL ${r.slotId} [${r.locale}]`);
    for (const p of r.problems) console.log(`    ${p}`);
  }
  if (failed.length > 0) process.exitCode = 1;
}

function main(): void {
  const { command, course, dir } = parseArgs(process.argv.slice(2));
  if (command === 'extract') extract(course, dir);
  else inject(course, dir);
}

main();
