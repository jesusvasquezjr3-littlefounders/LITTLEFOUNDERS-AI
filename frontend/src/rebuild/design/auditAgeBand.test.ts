import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

/*
 * GAP-FIX-R4 (Bible 06 §7, 06 §3.1, 02 D11 and rule 19): in production the
 * root carries data-age-band, so a 6-9 learner's pages are measured at the
 * 6-9 limits (first view 25, prompt 12, option 5, mentor 12). The copy-budget
 * audit reads the band from the nearest [data-age-band]; a real route signed
 * in as a 6-9 learner that reports no young block was budgeted as an adult
 * page, and the rule below makes that a finding instead of a silent pass.
 * The measurements run in a real browser (scripts/audit-rebuild.mjs); this pins
 * the rule, its wiring and the states that feed it.
 */
const frontend = resolve(__dirname, '../../..');
const read = (path: string) => readFileSync(resolve(frontend, path), 'utf8');
const load = <T>(path: string) => import(/* @vite-ignore */ pathToFileURL(resolve(frontend, path)).href) as Promise<T>;

type Block = { role: string; text: string; words: number; sentences: number; top: number; young: boolean; site: boolean; fold: boolean };
type Finding = [string, string];
type Rules = { copyFindings: (result: unknown, state: unknown, locale: string, options: { firstView: boolean; band?: string }) => Finding[] };
type AuditState = { id: string; entry: string; scenario?: string | null; path?: string; query?: Record<string, string> };
type Lanes = { LANE_STATES: AuditState[]; LANE_SCENARIOS: Record<string, { ageBand?: string | null }> };

const block = (young: boolean, words = 3, extra: Partial<Block> = {}): Block =>
  ({ role: 'body', text: 'word '.repeat(words).trim(), words, sentences: 1, top: 10, young, site: false, fold: true, ...extra });
const state = { id: 'app:/learn/rhythm@child', budget: 'app', firstView: true };
const types = (findings: Finding[]) => findings.map(([type]) => type);

describe('the 6-9 band on audited real routes (06 §7)', () => {
  it('reports a 6-9 learner page with no young block, and nothing once the band is on the root', async () => {
    const { copyFindings } = await load<Rules>('scripts/audits/rules.mjs');
    const adultReading = { blocks: [block(false), block(false)], modal: false, dashes: [] };
    expect(types(copyFindings(adultReading, state, 'en-US', { firstView: false, band: '6-9' }))).toEqual(['age-band-missing']);
    const youngReading = { blocks: [block(true), block(true)], modal: false, dashes: [] };
    expect(copyFindings(youngReading, state, 'en-US', { firstView: false, band: '6-9' })).toEqual([]);
    // Any other band, no band (a signed-out route), or a page with no text: nothing to say about the band.
    expect(copyFindings(adultReading, state, 'en-US', { firstView: false, band: '13-17' })).toEqual([]);
    expect(copyFindings(adultReading, state, 'en-US', { firstView: false })).toEqual([]);
    expect(copyFindings({ blocks: [], modal: false, dashes: [] }, state, 'en-US', { firstView: false, band: '6-9' })).toEqual([]);
  });

  it('caps the first view at 25 words for a young page and at 40 for an adult one (06 §3.1)', async () => {
    const { copyFindings } = await load<Rules>('scripts/audits/rules.mjs');
    const thirty = (young: boolean) => ({ blocks: Array.from({ length: 6 }, () => block(young, 5)), modal: false, dashes: [] });
    expect(copyFindings(thirty(true), state, 'en-US', { firstView: true, band: '6-9' })).toEqual([['first-view-words', '30/25']]);
    expect(copyFindings(thirty(false), state, 'en-US', { firstView: true })).toEqual([]);
    // The young prompt limit is 12 words, not the adult 20.
    const prompt = { blocks: [block(true, 14, { role: 'prompt' })], modal: false, dashes: [] };
    expect(types(copyFindings(prompt, state, 'en-US', { firstView: false, band: '6-9' }))).toEqual(['prompt-words']);
  });

  it('is fed the band of the scenario each authenticated state is signed in as', () => {
    expect(read('scripts/audit-rebuild.mjs')).toMatch(/const band = state\.scenario \? SCENARIOS\[state\.scenario\]\?\.ageBand : undefined;/);
    expect(read('scripts/audit-rebuild.mjs')).toMatch(/copyFindings\(res, state, locale, \{ firstView: width === 375, band \}\)/);
  });

  it('audits the journal and the rhythm on their real routes for a 6-9 child', () => {
    // The lane files resolve fixtures by file URL, so they load in Node itself, as the audit driver loads them.
    const script = "const m = await import('./scripts/audits/lanes/index.mjs'); console.log(JSON.stringify({ LANE_STATES: m.LANE_STATES, LANE_SCENARIOS: m.LANE_SCENARIOS }));";
    const { LANE_STATES, LANE_SCENARIOS } = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { cwd: frontend, encoding: 'utf8' })) as Lanes;
    const youngRoutes = LANE_STATES.filter((entry) => entry.entry === 'app' && entry.scenario && LANE_SCENARIOS[entry.scenario]?.ageBand === '6-9');
    const paths = new Set(youngRoutes.map((entry) => entry.path));
    for (const path of ['/learn', '/learn/journal', '/learn/rhythm']) expect(paths).toContain(path);
  });
});

describe('the learner shell root carries the band (06 §7)', () => {
  it('passes the band from the signed-in shells through ShellRoot to RebuildRoot', () => {
    expect(read('src/app-shell/ShellRoot.tsx')).toMatch(/<RebuildRoot theme=\{theme\} locale=\{locale\} ageBand=\{ageBand\}>/);
    const layouts = read('src/app-shell/AppLayouts.tsx');
    expect(layouts).toMatch(/<ShellRoot ageBand=\{kind === 'tutor' \? 'adult' : learnerBand\}>/);
    expect(layouts).toMatch(/<ShellRoot ageBand="adult">/);
  });

  it('declares the band on the journal and the rhythm themselves', () => {
    for (const view of ['src/rebuild/learning/DecisionJournalView.tsx', 'src/rebuild/learning/LearningRhythmView.tsx']) {
      expect(read(view)).toMatch(/data-age-band=\{ageBand\}/);
    }
    for (const route of ['src/routes/app/learn/DecisionJournalRoute.tsx', 'src/routes/app/learn/LearningRhythmRoute.tsx']) {
      expect(read(route)).toMatch(/ageBand=\{ageBand\}/);
    }
  });
});
