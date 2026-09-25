import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadCatalogStrings,
  loadJsonDocuments,
  loadSeedCorpus,
  loadUiJson,
  loadUiSourceLiterals,
  parseSeedInserts,
} from '../contentGates/sources.js';
import { runContentGates, formatReport } from '../contentGates/runner.js';
import { localizeLesson, LocalizeContentGateError } from '../pipeline/localize.js';
import { buildDocument, buildFacts, buildTaxonomy } from './fixtures.js';
import type { ChatCompleteRequest, ChatCompleteResult } from '../providers/openaiChat.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(here, '../..');
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '..');
const SEED = path.join(REPO_ROOT, 'database/seeds/first-lemonade-stand-fixture.sql');
const RED_TEAM = path.join(PACKAGE_ROOT, 'src/contentGates/fixtures/red-team');

describe('seed fixture parser', () => {
  it('reads standard and E-escaped PostgreSQL literals, NULLs and doubled quotes', () => {
    const rows = parseSeedInserts(
      "INSERT INTO t (a, b, c, d) VALUES ('it''s', E'line\\nnext \\'q\\'', NULL, '{\"x\": 1}') ON CONFLICT DO NOTHING;",
    );
    expect(rows).toEqual([{ table: 't', row: { a: "it's", b: "line\nnext 'q'", c: null, d: '{"x": 1}' } }]);
  });
});

describe.skipIf(!existsSync(SEED))('the committed Forge corpus (database/seeds/first-lemonade-stand-fixture.sql)', () => {
  const corpus = loadSeedCorpus(SEED);

  it('loads every lesson document with its lesson slug, locale and age tier', () => {
    expect(corpus.courseSlug).toBe('first-lemonade-stand');
    expect(corpus.documents).toHaveLength(186); // 62 lessons × 3 locales
    expect(new Set(corpus.documents.map((d) => d.locale))).toEqual(new Set(['en-US', 'es-MX', 'pt-BR']));
    expect(corpus.documents.every((d) => d.tier === 'tier2')).toBe(true);
  });

  it('the narration model reproduces every recorded Echo audio manifest exactly (no drift)', () => {
    const report = runContentGates({ documents: corpus.documents, catalog: [], ui: [], uiLiterals: [] });
    const withAudio = corpus.documents.filter((d) => (d.recordedUnits ?? []).length > 0).length;
    expect(withAudio).toBeGreaterThan(100);
    expect(report.summary.narrationDriftDocuments).toBe(0);
    expect(report.summary.unclassifiedFields).toBe(0);
  });

  it('reports the legacy corpus honestly: it fails the new gates and the release check', () => {
    const report = runContentGates({ taxonomy: buildTaxonomy(), documents: corpus.documents, catalog: corpus.strings, ui: [], uiLiterals: [] });
    expect(report.summary.ok).toBe(false);
    expect(report.summary.blocking.redundancy).toBeGreaterThan(0);
    expect(report.summary.blocking.copyBudget).toBeGreaterThan(0);
    // The only tone hits are the red_flags scam artifact, which goes to review, not a block.
    expect(report.summary.blocking.tone).toBe(0);
    expect(report.summary.review.lessonTone).toBeGreaterThan(0);
    expect(formatReport(report)).toContain('Forge Gate Pass Rate');
  });
});

describe('catalog source', () => {
  it('reads learner-visible titles/descriptions per locale, parent tips and author briefs with the adventure tier', () => {
    const { strings, tiers } = loadCatalogStrings(path.join(PACKAGE_ROOT, 'curriculum/first-lemonade-stand'));
    expect(tiers).toEqual(['tier2']);
    const courseTitle = strings.filter((s) => s.path.startsWith('course.title.'));
    expect(courseTitle.map((s) => s.locale).sort()).toEqual(['en-US', 'es-MX', 'pt-BR']);
    expect(courseTitle.every((s) => s.role === 'heading')).toBe(true);
    expect(strings.some((s) => s.path.endsWith('parent_check') && s.role === 'body' && s.tier === 'tier2')).toBe(true);
    expect(strings.some((s) => s.path.endsWith('micro_objective') && s.role === 'brief')).toBe(true);
    expect(strings.some((s) => s.path.endsWith('.slug'))).toBe(false);
  });
});

describe('system/UI copy source', () => {
  it('scans every family-facing namespace and skips the staff console and legal disclosures', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'lf-ui-'));
    for (const locale of ['en-US', 'es-MX', 'pt-BR']) {
      mkdirSync(path.join(root, locale));
      writeFileSync(path.join(root, locale, 'errors.json'), JSON.stringify({ api: { A: 'No attempts left for this question.' } }));
      writeFileSync(path.join(root, locale, 'admin.json'), JSON.stringify({ ledger: 'Insufficient funds' }));
      writeFileSync(path.join(root, locale, 'marketing.json'), JSON.stringify({ legal: { terms: 'Insufficient funds' }, hero: 'Hi' }));
    }
    const strings = loadUiJson(root);
    expect(strings.map((s) => `${s.file} ${s.key}`)).toEqual([
      'en-US/errors.json api.A', 'en-US/marketing.json hero',
      'es-MX/errors.json api.A', 'es-MX/marketing.json hero',
      'pt-BR/errors.json api.A', 'pt-BR/marketing.json hero',
    ]);
    const report = runContentGates({ documents: [], catalog: [], ui: strings, uiLiterals: [] });
    expect(report.ui.tone.map((f) => f.where)).toEqual(['en-US/errors.json api.A']);
    expect(report.summary.ok).toBe(false);
  });

  it('the repository UI copy passes the Law 2 tone gate (the release check condition)', () => {
    const ui = loadUiJson(path.join(REPO_ROOT, 'frontend/src/i18n'));
    const literals = loadUiSourceLiterals(path.join(REPO_ROOT, 'frontend/src/rebuild'));
    expect(ui.length).toBeGreaterThan(1000);
    expect(literals.length).toBeGreaterThan(50);
    const report = runContentGates({ documents: [], catalog: [], ui, uiLiterals: literals });
    expect(report.ui.tone.map((f) => `${f.where}: ${f.phrase}`)).toEqual([]);
  });
});

describe('red-team samples through the content:gates runner', () => {
  it('every red-team lesson fails exactly its own gate and the compliant one passes', () => {
    const documents = loadJsonDocuments(RED_TEAM);
    expect(documents.map((d) => d.lesson).sort()).toEqual(['compliant-sample', 'red-team-b14', 'red-team-b18', 'red-team-od13']);
    const report = runContentGates({ taxonomy: buildTaxonomy(), documents, catalog: [], ui: [], uiLiterals: [] });
    const verdict = Object.fromEntries(report.documents.map((d) => [d.lesson, d.passed]));
    expect(verdict).toEqual({
      'compliant-sample': { redundancy: true, tone: true, copyBudget: true },
      'red-team-b18': { redundancy: false, tone: true, copyBudget: true },
      'red-team-b14': { redundancy: true, tone: false, copyBudget: true },
      'red-team-od13': { redundancy: true, tone: true, copyBudget: false },
    });
    expect(report.summary.passRate.redundancy).toBe('3/4 (75%)');
    expect(report.summary.ok).toBe(false);
  });
});

describe('localization re-gates the target locale', () => {
  const gateCtx = { taxonomy: buildTaxonomy(), tier: 'tier1', facts: buildFacts() };

  it('fails the slot, itemized, when a translation breaks the English budget or voice', async () => {
    const translate = async (req: ChatCompleteRequest): Promise<ChatCompleteResult> => {
      const map = JSON.parse(req.messages[req.messages.length - 1]!.content.split('\n').pop()!) as Record<string, string>;
      const out: Record<string, string> = {};
      for (const [key, value] of Object.entries(map)) out[key] = value === '¿Cuánto es 2 más 2?' ? 'Act now: what do two coins plus two more coins make when you put them together?' : value;
      return { content: JSON.stringify(out), promptTokens: 1, completionTokens: 1 };
    };
    const error = await localizeLesson(buildDocument(), 'en-US', gateCtx, { translate: translate as never }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LocalizeContentGateError);
    const gates = new Set((error as LocalizeContentGateError).problems.map((p) => p.gate));
    expect(gates).toEqual(new Set([11, 12, 13])); // over the caption, "act now", over the 6–9 prompt budget
  });
});
