import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CONTENT_GAP_MIN_ATTEMPTS,
  COVERAGE_GAP_MIN_EVIDENCE,
  COVERAGE_GAP_MIN_LEARNERS,
  EDGE_REVIEW_MIN_LEARNERS,
  diagnoseCuration,
  parseSkillMisconceptionRef,
  renderCurationMarkdown,
  type CurationInput,
} from '../services/pedagogy/tutorCurator.js';

/*
 * THE SKILL/KC CURATOR — propose-only diagnosis over the KC graph, the
 * misconception catalog, the pedagogical skill catalogue and real attempt
 * aggregates. These fixtures are SYNTHETIC (this test suite runs with no
 * database), built to the exact shapes `services/pedagogy/kcData.ts`'s real
 * aggregate readers return — see `curate-tutor-skills.ts` for the thin,
 * untested-here I/O wrapper that fetches the real thing.
 */

const KC_COIN = '11111111-1111-4111-8111-111111111111';
const KC_CHANGE = '22222222-2222-4222-8222-222222222222';
const KC_PERCENT = '33333333-3333-4333-8333-333333333333';

function baseInput(over: Partial<CurationInput> = {}): CurationInput {
  return {
    kcs: [
      { id: KC_COIN, key: 'money.coin-recognition', skillKey: 'financial-education/cofre' },
      { id: KC_CHANGE, key: 'money.make-change-counting-up', skillKey: null },
    ],
    edges: [],
    misconceptions: [{ id: 'mc-1', kcId: KC_COIN, code: 'bigger-coin-worth-more' }],
    skills: [{ name: 'counterexample-confront', misconceptions: ['bigger-coin-worth-more'] }],
    masteryByKc: [],
    misconceptionEvidence: [],
    ...over,
  };
}

describe('diagnoseCuration — summary', () => {
  it('counts KCs, skills, and distinct misconception codes (a code shared by two KCs counts once)', () => {
    const report = diagnoseCuration(
      baseInput({
        misconceptions: [
          { id: 'mc-1', kcId: KC_COIN, code: 'counts-coins-not-value' },
          { id: 'mc-2', kcId: KC_CHANGE, code: 'counts-coins-not-value' }, // same code, different KC — real shape (UNIQUE is (kc_id, code))
        ],
        skills: [{ name: 'error-as-data', misconceptions: ['counts-coins-not-value'] }],
      }),
    );
    expect(report.summary.misconceptionCodeCount).toBe(1);
    expect(report.summary.coveredCodeCount).toBe(1);
  });
});

describe('diagnoseCuration — dead skill references (CHECK 1)', () => {
  it('flags a misconception code a skill names that does not exist anywhere in the catalog', () => {
    const report = diagnoseCuration(
      baseInput({
        skills: [{ name: 'counterexample-confront', misconceptions: ['bigger-coin-worth-more', 'made-up-code'] }],
      }),
    );
    const action = report.actions.find((a) => a.tag === 'dead-reference:counterexample-confront');
    expect(action).toBeDefined();
    expect(action?.evidence).toContain('made-up-code');
    expect(action?.evidence).not.toContain('bigger-coin-worth-more'); // the REAL code must not be reported as dead
  });

  it('never flags a skill whose codes all exist in the catalog', () => {
    const report = diagnoseCuration(baseInput());
    expect(report.actions.some((a) => a.tag.startsWith('dead-reference:'))).toBe(false);
  });

  it('reproduces the real defect this tool found on its first run against this repository, frozen against future drift of the source file', () => {
    // A snapshot of oracle/skills/moves/counterexample-confront.md's real
    // frontmatter as of 2026-09-01 — copied here rather than read live so
    // this regression test does not depend on whether that file has since
    // been fixed (see the spawned follow-up task for the actual fix).
    const skill = parseSkillMisconceptionRef(
      [
        '---',
        'name: counterexample-confront',
        'description: Let a wrong rule collide with a case where it visibly fails',
        'strategies: [REMEDIATE]',
        'misconceptions: [adds-instead-of-counts-up, more-parts-means-more, longer-number-is-bigger]',
        'mastery_min: 0.25',
        'mastery_max: 0.7',
        'tiers: [1, 2, 3]',
        'priority: 8',
        'once_per_session: true',
        '---',
        'Body text, irrelevant to this check.',
      ].join('\n'),
      'counterexample-confront.md',
    );
    // The 32 real codes cataloged in database/seeds/kc_graph.v1.json as of
    // the same date include "adds-instead-of-counts-up" but NOT the other two.
    const realCatalogCodes = new Set(['adds-instead-of-counts-up', 'bigger-coin-worth-more', 'counts-coins-not-value']);
    const report = diagnoseCuration(
      baseInput({
        misconceptions: [...realCatalogCodes].map((code, i) => ({ id: `mc-real-${i}`, kcId: KC_COIN, code })),
        skills: [skill],
      }),
    );
    const action = report.actions.find((a) => a.tag === 'dead-reference:counterexample-confront');
    expect(action).toBeDefined();
    expect(action?.evidence).toContain('more-parts-means-more');
    expect(action?.evidence).toContain('longer-number-is-bigger');
    expect(action?.evidence).not.toContain('adds-instead-of-counts-up, more'); // the real code is not itself reported dead
  });
});

describe('diagnoseCuration — coverage gaps (CHECK 2)', () => {
  it('flags a misconception with enough real evidence and no covering skill', () => {
    expect(COVERAGE_GAP_MIN_LEARNERS).toBeGreaterThan(0);
    const report = diagnoseCuration(
      baseInput({
        skills: [], // nothing covers "bigger-coin-worth-more"
        misconceptionEvidence: [
          { misconceptionId: 'mc-1', learnerCount: COVERAGE_GAP_MIN_LEARNERS, totalEvidenceCount: 9, resolvedCount: 1 },
        ],
      }),
    );
    const action = report.actions.find((a) => a.tag === 'coverage-gap:bigger-coin-worth-more');
    expect(action).toBeDefined();
    expect(action?.evidence).toContain(`${COVERAGE_GAP_MIN_LEARNERS} learner`);
  });

  it('never flags a misconception that already has a covering skill, however much evidence exists', () => {
    const report = diagnoseCuration(
      baseInput({
        skills: [{ name: 'counterexample-confront', misconceptions: ['bigger-coin-worth-more'] }],
        misconceptionEvidence: [{ misconceptionId: 'mc-1', learnerCount: 50, totalEvidenceCount: 200, resolvedCount: 0 }],
      }),
    );
    expect(report.actions.some((a) => a.tag.startsWith('coverage-gap:'))).toBe(false);
  });

  it('does not flag a misconception below BOTH volume thresholds — not enough signal to prioritize yet', () => {
    const report = diagnoseCuration(
      baseInput({
        skills: [],
        misconceptionEvidence: [{ misconceptionId: 'mc-1', learnerCount: 1, totalEvidenceCount: 1, resolvedCount: 0 }],
      }),
    );
    expect(report.actions.some((a) => a.tag.startsWith('coverage-gap:'))).toBe(false);
  });

  it('ranks multiple gaps by total evidence, most-common first', () => {
    const report = diagnoseCuration(
      baseInput({
        misconceptions: [
          { id: 'mc-1', kcId: KC_COIN, code: 'small-gap' },
          { id: 'mc-2', kcId: KC_COIN, code: 'big-gap' },
        ],
        skills: [],
        misconceptionEvidence: [
          { misconceptionId: 'mc-1', learnerCount: COVERAGE_GAP_MIN_LEARNERS, totalEvidenceCount: COVERAGE_GAP_MIN_EVIDENCE, resolvedCount: 0 },
          { misconceptionId: 'mc-2', learnerCount: 40, totalEvidenceCount: 90, resolvedCount: 0 },
        ],
      }),
    );
    const tags = report.actions.filter((a) => a.tag.startsWith('coverage-gap:')).map((a) => a.tag);
    expect(tags).toEqual(['coverage-gap:big-gap', 'coverage-gap:small-gap']);
  });
});

describe('diagnoseCuration — content gaps (CHECK 3)', () => {
  it('flags an unmapped KC receiving enough real attempts to fall through to tier 3 repeatedly', () => {
    expect(CONTENT_GAP_MIN_ATTEMPTS).toBeGreaterThan(0);
    const report = diagnoseCuration(
      baseInput({
        masteryByKc: [
          { kcId: KC_CHANGE, learnerCount: 4, totalAttempts: CONTENT_GAP_MIN_ATTEMPTS, totalCorrect: 2, avgPKnown: 0.4 },
        ],
      }),
    );
    const action = report.actions.find((a) => a.tag === 'content-gap:money.make-change-counting-up');
    expect(action).toBeDefined();
    expect(action?.evidence).toContain(`${CONTENT_GAP_MIN_ATTEMPTS} attempt`);
  });

  it('never flags a KC that already has a mapped skill_key, however unmapped-shaped its attempt volume looks', () => {
    const report = diagnoseCuration(
      baseInput({
        masteryByKc: [{ kcId: KC_COIN, learnerCount: 20, totalAttempts: 100, totalCorrect: 80, avgPKnown: 0.7 }],
      }),
    );
    expect(report.actions.some((a) => a.tag.startsWith('content-gap:'))).toBe(false);
  });

  it('does not flag an unmapped KC with too little real traffic to prioritize yet', () => {
    const report = diagnoseCuration(
      baseInput({
        masteryByKc: [{ kcId: KC_CHANGE, learnerCount: 1, totalAttempts: 1, totalCorrect: 1, avgPKnown: 0.9 }],
      }),
    );
    expect(report.actions.some((a) => a.tag.startsWith('content-gap:'))).toBe(false);
  });
});

describe('diagnoseCuration — questionable prerequisite edges (CHECK 4)', () => {
  it('flags an edge where the dependent is NOT clearly harder than its prerequisite, with enough samples on both ends', () => {
    const report = diagnoseCuration(
      baseInput({
        edges: [{ prerequisiteKcId: KC_COIN, dependentKcId: KC_PERCENT }],
        kcs: [
          { id: KC_COIN, key: 'money.coin-recognition', skillKey: 'x' },
          { id: KC_PERCENT, key: 'money.percent-intro', skillKey: 'y' },
        ],
        masteryByKc: [
          { kcId: KC_COIN, learnerCount: EDGE_REVIEW_MIN_LEARNERS, totalAttempts: 50, totalCorrect: 30, avgPKnown: 0.5 }, // 60%
          { kcId: KC_PERCENT, learnerCount: EDGE_REVIEW_MIN_LEARNERS, totalAttempts: 50, totalCorrect: 40, avgPKnown: 0.7 }, // 80% — MORE accurate than its own "prerequisite"
        ],
      }),
    );
    const action = report.actions.find((a) => a.tag === 'edge-review:money.coin-recognition->money.percent-intro');
    expect(action).toBeDefined();
    expect(action?.evidence).toContain('60%');
    expect(action?.evidence).toContain('80%');
  });

  it('never flags an edge that shows the expected ordering (prerequisite clearly easier than the dependent)', () => {
    const report = diagnoseCuration(
      baseInput({
        edges: [{ prerequisiteKcId: KC_COIN, dependentKcId: KC_PERCENT }],
        kcs: [
          { id: KC_COIN, key: 'money.coin-recognition', skillKey: 'x' },
          { id: KC_PERCENT, key: 'money.percent-intro', skillKey: 'y' },
        ],
        masteryByKc: [
          { kcId: KC_COIN, learnerCount: EDGE_REVIEW_MIN_LEARNERS, totalAttempts: 50, totalCorrect: 45, avgPKnown: 0.8 }, // 90%
          { kcId: KC_PERCENT, learnerCount: EDGE_REVIEW_MIN_LEARNERS, totalAttempts: 50, totalCorrect: 20, avgPKnown: 0.3 }, // 40%
        ],
      }),
    );
    expect(report.actions.some((a) => a.tag.startsWith('edge-review:'))).toBe(false);
  });

  it('stays silent on a suspicious-looking edge when either end has too few learners to trust', () => {
    const report = diagnoseCuration(
      baseInput({
        edges: [{ prerequisiteKcId: KC_COIN, dependentKcId: KC_PERCENT }],
        kcs: [
          { id: KC_COIN, key: 'money.coin-recognition', skillKey: 'x' },
          { id: KC_PERCENT, key: 'money.percent-intro', skillKey: 'y' },
        ],
        masteryByKc: [
          { kcId: KC_COIN, learnerCount: 1, totalAttempts: 2, totalCorrect: 0, avgPKnown: 0.1 }, // 0% — looks damning, but n=1
          { kcId: KC_PERCENT, learnerCount: 1, totalAttempts: 2, totalCorrect: 2, avgPKnown: 0.9 }, // 100%
        ],
      }),
    );
    expect(report.actions.some((a) => a.tag.startsWith('edge-review:'))).toBe(false);
  });
});

describe('renderCurationMarkdown', () => {
  it('states the propose-only contract and includes every action with its evidence', () => {
    const report = diagnoseCuration(
      baseInput({
        skills: [],
        misconceptionEvidence: [{ misconceptionId: 'mc-1', learnerCount: 10, totalEvidenceCount: 20, resolvedCount: 0 }],
      }),
    );
    const md = renderCurationMarkdown('2026-09-01', report);
    expect(md).toContain('PROPOSE-ONLY');
    expect(md).toContain('coverage-gap:bigger-coin-worth-more');
    expect(md).toContain('evidence:');
  });

  it('says so plainly when nothing is actionable, rather than an empty section', () => {
    const md = renderCurationMarkdown('2026-09-01', diagnoseCuration(baseInput()));
    expect(md).toContain('Nothing actionable surfaced');
  });
});

describe('parseSkillMisconceptionRef', () => {
  it('parses a real-shaped skill file', () => {
    const skill = parseSkillMisconceptionRef(
      ['---', 'name: error-as-data', 'misconceptions: [counts-coins-not-value, mixes-units]', '---', 'Body.'].join('\n'),
      'error-as-data.md',
    );
    expect(skill).toEqual({ name: 'error-as-data', misconceptions: ['counts-coins-not-value', 'mixes-units'] });
  });

  it('returns an empty misconceptions list for a generic skill with no misconceptions: line at all', () => {
    const skill = parseSkillMisconceptionRef(['---', 'name: socratic-one-question', 'strategies: [SOCRATIC]', '---', 'Body.'].join('\n'), 'f.md');
    expect(skill.misconceptions).toEqual([]);
  });

  it('throws a clear error when the file has no name: line, rather than silently returning a blank skill', () => {
    expect(() => parseSkillMisconceptionRef(['---', 'strategies: [SOCRATIC]', '---', 'Body.'].join('\n'), 'broken.md')).toThrow(
      /broken\.md/,
    );
  });

  it('parses the REAL counterexample-confront.md file from the sibling oracle/ package unchanged', () => {
    // Genuinely reads the live file (both packages are checked out side by
    // side in this monorepo, in dev and in CI alike — see
    // curate-tutor-skills.ts's own comment on why this path is safe). This
    // proves the parser handles the ACTUAL format in production, not only a
    // hand-written approximation of it; it deliberately asserts only
    // STRUCTURE (name, and that misconceptions is a non-empty string array)
    // rather than the exact code list, so it does not break if that file's
    // content is edited later — the frozen regression above covers the
    // specific defect this tool found.
    const realFile = path.resolve(
      fileURLToPath(new URL('.', import.meta.url)),
      '../../../oracle/skills/moves/counterexample-confront.md',
    );
    const skill = parseSkillMisconceptionRef(readFileSync(realFile, 'utf8'), 'counterexample-confront.md');
    expect(skill.name).toBe('counterexample-confront');
    expect(skill.misconceptions.length).toBeGreaterThan(0);
    for (const code of skill.misconceptions) expect(typeof code).toBe('string');
  });
});
