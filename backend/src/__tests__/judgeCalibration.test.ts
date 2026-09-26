import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from './helpers.js';
import {
  CALIBRATION_FLOORS,
  CALIBRATION_QUESTIONS,
  cohenKappa,
  computeJudgeCalibration,
  fleissKappa,
  JUDGE_REGISTRY,
  judgeTrust,
  modelFamily,
  panelLabel,
  recordCalibration,
  TRANSCRIPT_JUDGE_QUESTIONS,
  verifyStage3,
  type CalibrationRecordRow,
  type CalibrationRunInput,
  type JudgeLabel,
} from '../services/pedagogy/judgeCalibration.js';
import {
  GOLD_QUESTIONS,
  goldId,
  goldLength,
  TRANSCRIPT_GOLD_SET,
  TRANSCRIPT_GOLD_SET_HASH,
  TRANSCRIPT_GOLD_SET_VERSION,
} from '../services/pedagogy/transcriptGoldSet.js';
import { TRANSCRIPT_RUBRIC_HASH } from '../services/pedagogy/transcriptRubric.js';
import {
  dryRunComputation,
  goldBatch,
  parseTranscriptRating,
  ratingSheetMarkdown,
  ratingTemplate,
  transcriptCalibrationInput,
} from '../scripts/judge-calibration.js';
import { evaluateSignals, type QualitySources } from '../services/pedagogy/mentorQuality.js';

/*
 * C.23 — the calibration process for every automated evaluation judge
 * (Appendix E §2.1, §3.2; Appendix F §1.3). The statistics, the weakest-
 * stratum rule, the bias checks, the refusals, the trust over time, Stage 3
 * gating, the gold set and its blind panel export, and the record path.
 */

const HASH = 'a'.repeat(64);
const NOW = new Date('2026-09-25T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

type Labels = Record<string, Record<string, JudgeLabel>>;
const intended = (): Labels => Object.fromEntries(TRANSCRIPT_GOLD_SET.map((t) => [t.id, { ...t.intended }]));
const panel = (labels: Labels = intended()) => [
  { rater: 'rater-a', source: 'human_panel', labels },
  { rater: 'rater-b', source: 'human_panel', labels: structuredClone(labels) },
  { rater: 'rater-c', source: 'human_panel', labels: structuredClone(labels) },
];

function goldInput(over: Partial<CalibrationRunInput> & { verdicts?: Labels } = {}): CalibrationRunInput {
  const { verdicts, ...rest } = over;
  return {
    judgeId: 'transcript_judge',
    kind: 'calibration',
    seedSet: {
      version: TRANSCRIPT_GOLD_SET_VERSION,
      hash: TRANSCRIPT_GOLD_SET_HASH,
      items: TRANSCRIPT_GOLD_SET.map((t) => ({ id: t.id, stratum: t.stratum, length: goldLength(t) })),
    },
    ratings: panel(),
    judge: { model: 'qwen3-max', promptHash: HASH, mode: 'live', authorModel: 'deepseek-v4-flash', verdicts: verdicts ?? intended() },
    ...rest,
  };
}

/** The judge's verdicts with `change` applied to the matching (item, question) pairs. */
function judgeWith(pick: (id: string, q: string, stratum: string) => boolean, to: (was: JudgeLabel) => JudgeLabel): Labels {
  const v = intended();
  for (const t of TRANSCRIPT_GOLD_SET) for (const q of GOLD_QUESTIONS) if (pick(t.id, q, t.stratum)) v[t.id]![q] = to(v[t.id]![q]!);
  return v;
}

describe('C.23 statistics', () => {
  it('Fleiss kappa: perfect agreement is 1, a coin-flip panel is near 0, unanimous single label is reported as 1', () => {
    expect(fleissKappa([['pass', 'pass'], ['fail', 'fail'], ['pass', 'pass'], ['fail', 'fail']])).toBeCloseTo(1);
    expect(fleissKappa([['pass', 'fail'], ['fail', 'pass'], ['pass', 'pass'], ['fail', 'fail']])).toBeCloseTo(0);
    expect(fleissKappa([['pass', 'pass'], ['pass', 'pass']])).toBe(1);
  });

  it('Cohen kappa corrects for chance: always-pass on a 90/10 set agrees 90% and scores 0', () => {
    const truth: JudgeLabel[] = [...Array(9).fill('pass'), 'fail'];
    const always: JudgeLabel[] = Array(10).fill('pass');
    expect(cohenKappa(truth, always)).toBeCloseTo(0);
    expect(cohenKappa(truth, truth)).toBe(1);
  });

  it('the panel label is the majority; a tie with a fail is a fail; a pass/n.a. tie is not applicable', () => {
    expect(panelLabel(['pass', 'pass', 'fail'])).toBe('pass');
    expect(panelLabel(['pass', 'fail'])).toBe('fail');
    expect(panelLabel(['pass', 'not_applicable'])).toBe('not_applicable');
    expect(panelLabel(['pass', 'fail', 'not_applicable'])).toBe('fail');
  });

  it('names model families for the self-enhancement check', () => {
    expect(modelFamily('deepseek-v4-flash')).toBe('deepseek');
    expect(modelFamily('deepseek-chat')).toBe('deepseek');
    expect(modelFamily('qwen3-max')).toBe('qwen');
    expect(modelFamily('gpt-4o-mini')).toBe('openai');
    expect(modelFamily('claude-sonnet')).toBe('anthropic');
    expect(modelFamily('some-house-model')).toBe('unknown');
    expect(modelFamily(null)).toBe('unknown');
  });
});

describe('C.23 the registry and the pre-registered standard', () => {
  it('registers every judge that may gate anything, with its gate and its approval variable', () => {
    expect(Object.keys(JUDGE_REGISTRY).sort()).toEqual(['live_content_judge', 'transcript_judge']);
    expect(JUDGE_REGISTRY.live_content_judge).toMatchObject({ requirement: 'C.5', questions: ['approve'], strata: ['standard', 'sensitive'], liveApprovalEnv: 'CONTENT_JUDGE_CALIBRATION_LIVE' });
    expect(JUDGE_REGISTRY.transcript_judge).toMatchObject({ requirement: 'C.21', strata: ['routine', 'hard'], liveApprovalEnv: 'TRANSCRIPT_JUDGE_LIVE' });
  });

  it('calibrates the transcript judge on the judge-scorable pass/fail rubric criteria only (a diagnostic has nothing to agree on)', () => {
    expect([...TRANSCRIPT_JUDGE_QUESTIONS].sort()).toEqual([...GOLD_QUESTIONS].sort());
    expect(TRANSCRIPT_JUDGE_QUESTIONS).not.toContain('scaffold_quality');
    expect(TRANSCRIPT_JUDGE_QUESTIONS).not.toContain('praise_specificity');
    for (const q of GOLD_QUESTIONS) expect(CALIBRATION_QUESTIONS).toContain(q);
  });

  it('never runs any judge below the floors, and keeps the S06.12 bar for the content judge', () => {
    for (const def of Object.values(JUDGE_REGISTRY)) {
      expect(def.standard.interRaterAgreement).toBeGreaterThanOrEqual(0.85);
      expect(def.standard.interRaterKappa).toBeGreaterThanOrEqual(0.6);
      expect(def.standard.judgeAgreement).toBeGreaterThanOrEqual(0.9);
      expect(def.standard.judgeKappa).toBeGreaterThanOrEqual(0.7);
      expect(def.standard.lengthBiasMaxGap).toBeLessThanOrEqual(0.15);
      expect(def.standard.maxAgeDays).toBeLessThanOrEqual(35);
      expect(def.cadence).toBe('monthly');
    }
    expect(JUDGE_REGISTRY.live_content_judge.standard).toMatchObject({ minItemsPerStratum: 20, minPerLabel: 5 });
    expect(CALIBRATION_FLOORS).toMatchObject({ interRaterAgreement: 0.85, judgeAgreement: 0.9 });
  });
});

describe('C.23 the transcript gold set', () => {
  it('has unique ids, three locales, both strata and every age band', () => {
    const ids = TRANSCRIPT_GOLD_SET.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(TRANSCRIPT_GOLD_SET.map((t) => t.locale))).toEqual(new Set(['en-US', 'es-MX', 'pt-BR']));
    expect(new Set(TRANSCRIPT_GOLD_SET.map((t) => t.stratum))).toEqual(new Set(['routine', 'hard']));
    expect(new Set(TRANSCRIPT_GOLD_SET.map((t) => t.ageBand))).toEqual(new Set(['child', 'teen', 'adult']));
  });

  it('gives every question at least 10 applicable transcripts per stratum, with at least 4 of each label (an always-same judge fails)', () => {
    for (const q of GOLD_QUESTIONS) {
      for (const stratum of ['routine', 'hard'] as const) {
        const scoped = TRANSCRIPT_GOLD_SET.filter((t) => t.stratum === stratum && t.intended[q] !== 'not_applicable');
        expect(scoped.length, `${q}/${stratum}`).toBeGreaterThanOrEqual(10);
        expect(scoped.filter((t) => t.intended[q] === 'pass').length, `${q}/${stratum} passes`).toBeGreaterThanOrEqual(4);
        expect(scoped.filter((t) => t.intended[q] === 'fail').length, `${q}/${stratum} fails`).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('never marks controlling language applicable to a child, and says coins, never money words', () => {
    for (const t of TRANSCRIPT_GOLD_SET) {
      if (t.ageBand === 'child') expect(t.intended.controlling_language, t.id).toBe('not_applicable');
      else expect(t.intended.controlling_language, t.id).not.toBe('not_applicable');
      expect(t.intended.emotion_label, t.id).not.toBe('not_applicable');
      expect(t.turns.join(' '), t.id).not.toMatch(/\b(dollars?|pesos?|reais|real)\b/i);
    }
  });
});

describe('C.23 computing a calibration', () => {
  it('the zero-spend dry run exercises everything and is never recordable', () => {
    const r = dryRunComputation();
    expect(r.scope).toEqual([...GOLD_QUESTIONS]);
    expect(r.recordable).toBe(false);
    expect(r.verdict).toBe('failed');
    expect(r.refusals.join()).toContain('not from the human panel');
    expect(r.refusals.join()).toContain('not obtained live');
  });

  it('passes a live judge that agrees with a panel that agrees with itself, on every question', () => {
    const r = computeJudgeCalibration(goldInput());
    expect(r).toMatchObject({ recordable: true, verdict: 'passed', failureReasons: [], interRaterAgreement: 1, interRaterKappa: 1, sameFamily: false });
    expect(r.scope).toEqual([...GOLD_QUESTIONS]);
    expect(r.strata).toHaveLength(12);
    expect(r.strata.every((s) => s.passed)).toBe(true);
  });

  it('an always-pass judge calibrates nothing (kappa and the fail items catch it)', () => {
    const r = computeJudgeCalibration(goldInput({ verdicts: judgeWith(() => true, (was) => (was === 'not_applicable' ? was : 'pass')) }));
    expect(r.scope).toEqual([]);
    expect(r.verdict).toBe('failed');
    expect(r.failureReasons).toContain('no_question_calibrated');
  });

  it('is weakest-case aware: a judge perfect on routine transcripts but wrong on hard emotion claims loses that question only', () => {
    // Three false alarms on hard transcripts: the question's kappa over both
    // strata still clears 0.70, so ONLY the per-stratum rule can exclude it.
    const flipped = TRANSCRIPT_GOLD_SET.filter((t) => t.stratum === 'hard' && t.intended.emotion_label === 'pass').slice(0, 3).map((t) => t.id);
    const verdicts = judgeWith((id, q) => q === 'emotion_label' && flipped.includes(id), () => 'fail');
    const r = computeJudgeCalibration(goldInput({ verdicts }));
    const hard = r.strata.find((s) => s.question === 'emotion_label' && s.stratum === 'hard')!;
    const routine = r.strata.find((s) => s.question === 'emotion_label' && s.stratum === 'routine')!;
    expect(hard.questionKappa).toBeGreaterThanOrEqual(0.7);
    expect(routine.passed).toBe(true);
    expect(hard.passed).toBe(false);
    expect(hard.agreement).toBeLessThan(0.9);
    expect(r.scope).not.toContain('emotion_label');
    expect(r.scope).toHaveLength(5);
    expect(r.verdict).toBe('passed');
  });

  it('counts a false alarm against the judge (a flagged clean pair is a disagreement)', () => {
    const verdicts = judgeWith((id, q) => q === 'tell_honored' && [goldId('r02-es-reveal-unasked'), goldId('r03-pt-wrong-called-right')].includes(id), () => 'fail');
    const r = computeJudgeCalibration(goldInput({ verdicts }));
    const routine = r.strata.find((s) => s.question === 'tell_honored' && s.stratum === 'routine')!;
    expect(routine.items).toBe(13);
    expect(r.disagreements.filter((d) => d.question === 'tell_honored')).toHaveLength(2);
  });

  it('fails a panel that does not agree with itself, whatever the judge does', () => {
    const noisy = judgeWith((id) => parseInt(id.slice(-1), 16) % 2 === 0, (was) => (was === 'pass' ? 'fail' : was === 'fail' ? 'pass' : was));
    const r = computeJudgeCalibration(goldInput({ ratings: [panel()[0]!, { rater: 'rater-b', source: 'human_panel', labels: noisy }] }));
    expect(r.failureReasons).toContain('inter_rater_below_threshold');
    expect(r.verdict).toBe('failed');
  });

  it('refuses a judge of the same model family as the author (self-enhancement bias)', () => {
    const r = computeJudgeCalibration(goldInput({ judge: { model: 'deepseek-chat', promptHash: HASH, mode: 'live', authorModel: 'deepseek-v4-flash', verdicts: intended() } }));
    expect(r.sameFamily).toBe(true);
    expect(r.failureReasons).toContain('self_enhancement_risk');
    expect(r.verdict).toBe('failed');
  });

  it('refuses a judge whose agreement depends on the length of the item (verbosity bias)', () => {
    const lengths = TRANSCRIPT_GOLD_SET.map(goldLength).sort((a, b) => a - b);
    const longCut = lengths[Math.floor((lengths.length * 2) / 3)]!;
    // Wrong on every applicable label of the longest third only.
    const verdicts = judgeWith(
      (id, q) => goldLength(TRANSCRIPT_GOLD_SET.find((t) => t.id === id)!) >= longCut && q !== 'emotion_label',
      (was) => (was === 'pass' ? 'fail' : was === 'fail' ? 'pass' : was),
    );
    const r = computeJudgeCalibration(goldInput({ verdicts }));
    expect(r.lengthBiasGap).toBeGreaterThan(0.15);
    expect(r.failureReasons).toContain('verbosity_bias');
  });

  it('refuses to record a dry run, a replay, author labels, one rater, the same rater twice, or a missing verdict', () => {
    const refusals = (over: Partial<CalibrationRunInput> & { verdicts?: Labels }) => computeJudgeCalibration(goldInput(over)).refusals.join(' | ');
    expect(refusals({ judge: { model: 'm', promptHash: HASH, mode: 'replay', authorModel: null, verdicts: intended() } })).toContain('not obtained live');
    expect(refusals({ ratings: [{ rater: 'author', source: 'author_intended', labels: intended() }, panel()[1]!] })).toContain('not from the human panel');
    expect(refusals({ ratings: [panel()[0]!] })).toContain('two human raters');
    expect(refusals({ ratings: [panel()[0]!, { ...panel()[1]!, rater: 'RATER-A' }] })).toContain('different rater');
    const missing = intended();
    delete missing[goldId('r01-en-clean-tell')]!.tell_honored;
    expect(refusals({ verdicts: missing })).toContain(`${goldId('r01-en-clean-tell')} / tell_honored`);
    expect(refusals({ judge: { model: 'm', promptHash: 'short', mode: 'live', authorModel: null, verdicts: intended() } })).toContain('SHA-256');
  });

  it('a spot check re-verifies the same judge identity, and failing one question of the calibrated scope fails it', () => {
    const verifies = { id: 'cal-1', model: 'qwen3-max', promptHash: HASH, scope: [...GOLD_QUESTIONS] };
    const ok = computeJudgeCalibration(goldInput({ kind: 'spot_check', verifies }));
    expect(ok).toMatchObject({ recordable: true, verdict: 'passed' });
    expect(ok.thresholds.minItemsPerStratum).toBe(JUDGE_REGISTRY.transcript_judge.standard.spotCheck.minItemsPerStratum);
    const other = computeJudgeCalibration(goldInput({ kind: 'spot_check', verifies: { ...verifies, promptHash: 'b'.repeat(64) } }));
    expect(other.refusals.join()).toContain('different judge identity');
    const lost = computeJudgeCalibration(
      goldInput({ kind: 'spot_check', verifies, verdicts: judgeWith((_i, q) => q === 'hint_repeat', (was) => (was === 'fail' ? 'pass' : was)) }),
    );
    expect(lost.failureReasons).toContain('spot_check_scope_lost');
    expect(lost.verdict).toBe('failed');
    expect(computeJudgeCalibration(goldInput({ kind: 'spot_check' })).refusals.join()).toContain('names the calibration');
  });

  it('the content judge answers pass or fail only', () => {
    const r = computeJudgeCalibration({
      judgeId: 'live_content_judge',
      kind: 'calibration',
      seedSet: { version: 'x', hash: HASH, items: [{ id: 'one', stratum: 'standard', length: 10 }] },
      ratings: [
        { rater: 'a', source: 'human_panel', labels: { one: { approve: 'not_applicable' } } },
        { rater: 'b', source: 'human_panel', labels: { one: { approve: 'pass' } } },
      ],
      judge: { model: 'qwen3-max', promptHash: HASH, mode: 'live', authorModel: null, verdicts: { one: { approve: 'pass' } } },
    });
    expect(r.refusals.join()).toContain('pass or fail only');
  });
});

// ── trust over time ──────────────────────────────────────────────────────────

const row = (over: Partial<CalibrationRecordRow>): CalibrationRecordRow => ({
  id: 'cal-1',
  judge_id: 'transcript_judge',
  kind: 'calibration',
  verifies_calibration_id: null,
  judge_model: 'qwen3-max',
  judge_prompt_hash: HASH,
  seed_set_version: TRANSCRIPT_GOLD_SET_VERSION,
  verdict: 'passed',
  scope: ['tell_honored', 'hint_repeat'],
  created_at: daysAgo(3),
  ...over,
});

describe('C.23 trust over time (Appendix F §1.3)', () => {
  it('uncalibrated without a row; passed when fresh; stale after the cadence', () => {
    expect(judgeTrust('transcript_judge', [], NOW).state).toBe('uncalibrated');
    const fresh = judgeTrust('transcript_judge', [row({})], NOW);
    expect(fresh).toMatchObject({ state: 'passed', scope: ['tell_honored', 'hint_repeat'], dueSoon: false });
    expect(fresh.dueAt).toBe(new Date(Date.parse(daysAgo(3)) + 35 * 86_400_000).toISOString());
    expect(judgeTrust('transcript_judge', [row({ created_at: daysAgo(36) })], NOW).state).toBe('stale');
    expect(judgeTrust('transcript_judge', [row({ created_at: daysAgo(30) })], NOW).dueSoon).toBe(true);
  });

  it('a failed recalibration un-trusts a judge that passed before', () => {
    expect(judgeTrust('transcript_judge', [row({ id: 'cal-2', verdict: 'failed', created_at: daysAgo(1) }), row({})], NOW).state).toBe('failed');
  });

  it('a failed spot check requires a new calibration (the automatic recalibration trigger); a new pass restores trust', () => {
    const spot = row({ id: 'spot-1', kind: 'spot_check', verifies_calibration_id: 'cal-1', verdict: 'failed', created_at: daysAgo(1) });
    expect(judgeTrust('transcript_judge', [spot, row({})], NOW).state).toBe('recalibration_required');
    const again = row({ id: 'cal-2', created_at: daysAgo(0.5) });
    expect(judgeTrust('transcript_judge', [again, spot, row({})], NOW).state).toBe('passed');
  });

  it('a passed spot check re-verifies (the cadence restarts from it)', () => {
    const spot = row({ id: 'spot-1', kind: 'spot_check', verifies_calibration_id: 'cal-1', created_at: daysAgo(5) });
    const t = judgeTrust('transcript_judge', [spot, row({ created_at: daysAgo(40) })], NOW);
    expect(t.state).toBe('passed');
    expect(t.verifiedAt).toBe(daysAgo(5));
  });

  it('never lets one judge vouch for another, and reports the end of the monthly first year', () => {
    expect(judgeTrust('live_content_judge', [row({})], NOW).state).toBe('uncalibrated');
    expect(judgeTrust('transcript_judge', [row({})], NOW).firstYearEndsAt).toBe(new Date(Date.parse(daysAgo(3)) + 365 * 86_400_000).toISOString());
  });
});

describe('C.23 Stage 3 of a Tier 2 change (Appendix F Part 3)', () => {
  const claim = { judgeId: 'transcript_judge', calibrationId: 'cal-1', judgeModel: 'qwen3-max', judgePromptHash: HASH, scoredAt: daysAgo(1), criteria: ['tell_honored'] };

  it('lets a calibrated, fresh judge gate only on criteria in its scope', () => {
    expect(verifyStage3(claim, [row({})])).toEqual({ mayGate: true });
    const outside = verifyStage3({ ...claim, criteria: ['tell_honored', 'emotion_label'] }, [row({})]);
    expect(outside).toMatchObject({ mayGate: false });
    expect(JSON.stringify(outside)).toContain('emotion_label');
  });

  it('routes to Stage 4 when the judge was uncalibrated or stale at scoring time, or is not the calibrated identity', () => {
    expect(verifyStage3(claim, [])).toMatchObject({ mayGate: false });
    expect(verifyStage3(claim, [row({ created_at: daysAgo(50) })])).toMatchObject({ mayGate: false });
    expect(verifyStage3({ ...claim, judgePromptHash: 'b'.repeat(64) }, [row({})])).toMatchObject({ mayGate: false });
    expect(verifyStage3({ ...claim, judgeId: 'live_content_judge' }, [row({})])).toMatchObject({ mayGate: false });
    expect(verifyStage3({ ...claim, criteria: [] }, [row({})])).toMatchObject({ mayGate: false });
  });

  it('a calibration recorded AFTER the scoring cannot vouch for it', () => {
    expect(verifyStage3({ ...claim, scoredAt: daysAgo(10) }, [row({ created_at: daysAgo(3) })])).toMatchObject({ mayGate: false });
  });
});

describe('C.23 the panel export is blind, and the run is checked against the gold set', () => {
  it('the rating template and the sheet carry no intended label and no author note', () => {
    const template = JSON.stringify(ratingTemplate());
    expect(template).not.toContain('"pass"');
    expect(template).not.toContain('"fail"');
    expect(template).toContain(TRANSCRIPT_GOLD_SET_HASH);
    const sheet = ratingSheetMarkdown();
    for (const t of TRANSCRIPT_GOLD_SET) {
      expect(sheet).not.toContain(t.why);
      expect(sheet).not.toContain(t.key);
      expect(t.id).toMatch(/^gold-[0-9a-f]{8}$/);
    }
    expect(JSON.stringify(goldBatch())).not.toContain(TRANSCRIPT_GOLD_SET[0]!.key);
    expect(sheet).not.toMatch(/\b(routine|hard)\b/);
    expect(sheet).toContain('Fail when:');
  });

  it('parses a complete rating file and refuses another gold-set version, a missing label or an unknown transcript', () => {
    const filled = { ...ratingTemplate(), rater: 'Ana', labels: intended() };
    expect(parseTranscriptRating(filled)).toMatchObject({ ok: true });
    expect(parseTranscriptRating({ ...filled, seedSet: { version: 'old', hash: HASH } })).toMatchObject({ ok: false });
    const missing = intended();
    delete missing[goldId('h27-es-child-later')]!.tell_honored;
    expect(parseTranscriptRating({ ...filled, labels: missing })).toMatchObject({ ok: false });
    expect(parseTranscriptRating({ ...filled, labels: { ...intended(), ghost: {} } })).toMatchObject({ ok: false });
  });

  it('builds the input from a LIVE gold-set run on the current rubric, and refuses anything else', () => {
    const run = { kind: 'mentor-transcript-judge-run', mode: 'live', judge: { model: 'qwen3-max', promptHash: HASH, authorModel: 'deepseek-v4-flash' }, rubric: { hash: TRANSCRIPT_RUBRIC_HASH }, batch: { source: 'gold_set' }, verdicts: intended() };
    const ratings = panel().slice(0, 2);
    const built = transcriptCalibrationInput(run, ratings, 'calibration');
    expect(built.ok).toBe(true);
    if (built.ok) expect(computeJudgeCalibration(built.input)).toMatchObject({ recordable: true, verdict: 'passed' });
    expect(transcriptCalibrationInput({ ...run, batch: { source: 'fixtures' } }, ratings, 'calibration')).toMatchObject({ ok: false });
    expect(transcriptCalibrationInput({ ...run, rubric: { hash: HASH } }, ratings, 'calibration')).toMatchObject({ ok: false });
    expect(transcriptCalibrationInput({ kind: 'other' }, ratings, 'calibration')).toMatchObject({ ok: false });
  });

  it('exports the gold set as a judge batch on the current rubric, with the age band', () => {
    const batch = goldBatch();
    expect(batch).toMatchObject({ kind: 'mentor-transcript-judge-batch', source: 'gold_set' });
    expect(batch.rubric.hash).toBe(TRANSCRIPT_RUBRIC_HASH);
    expect(batch.transcripts).toHaveLength(TRANSCRIPT_GOLD_SET.length);
    // Oracle's strict schema admits exactly these keys.
    for (const t of batch.transcripts) expect(Object.keys(t).sort()).toEqual(['ageBand', 'closeReason', 'id', 'intended', 'locale', 'tier', 'turns']);
  });
});

describe('C.23 recording (service role, fetch-stubbed PostgREST)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('records through the checking function with every number and threshold, then audits', async () => {
    const calls: { url: string; body: string }[] = [];
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = decodeURIComponent(String(input));
      calls.push({ url, body: String(init?.body ?? '') });
      if (url.includes('/rpc/record_mentor_judge_calibration')) return Promise.resolve(jsonResponse(200, 'new-id'));
      if (url.includes('/audit_logs')) return Promise.resolve(new Response(null, { status: 201 }));
      throw new Error(`unexpected ${url}`);
    }));
    const result = computeJudgeCalibration(goldInput());
    const outcome = await recordCalibration({ result, seedSet: { version: TRANSCRIPT_GOLD_SET_VERSION, hash: TRANSCRIPT_GOLD_SET_HASH }, judge: { model: 'qwen3-max', promptHash: HASH, authorModel: 'deepseek-v4-flash' }, verifiesId: null, recordedBy: 'owner', note: 'first panel calibration' });
    expect(outcome).toEqual({ ok: true, id: 'new-id' });
    const body = JSON.parse(calls[0]!.body) as { p_calibration: Record<string, unknown>; p_strata: Record<string, unknown>[] };
    expect(body.p_calibration).toMatchObject({ judge_id: 'transcript_judge', kind: 'calibration', verdict: 'passed', threshold_agreement: 0.9, threshold_judge_kappa: 0.7, min_items_per_stratum: 10, same_family: false });
    expect(body.p_strata).toHaveLength(12);
    expect(calls[1]!.url).toContain('/audit_logs');
    expect(calls[1]!.body).toContain('mentor.judge_calibration.recorded');
  });

  it('refuses a non-recordable run without touching the database, and surfaces a database refusal', async () => {
    const fetchSpy = vi.fn(() => Promise.resolve(jsonResponse(400, { message: 'the claimed scope {} is not the scope the strata support' })));
    vi.stubGlobal('fetch', fetchSpy);
    const dry = await recordCalibration({ result: dryRunComputation(), seedSet: { version: 'v', hash: HASH }, judge: { model: 'm', promptHash: HASH, authorModel: null }, verifiesId: null, recordedBy: 'x', note: 'dry run attempt' });
    expect(dry.ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    const refused = await recordCalibration({ result: computeJudgeCalibration(goldInput()), seedSet: { version: 'v', hash: HASH }, judge: { model: 'm', promptHash: HASH, authorModel: null }, verifiesId: null, recordedBy: 'x', note: 'tampered numbers' });
    expect(refused).toMatchObject({ ok: false });
    expect(JSON.stringify(refused)).toContain('not the scope the strata support');
  });
});

describe('C.23 on the Mentor-quality dashboard (C.24)', () => {
  const base = (judgeCalibrations: CalibrationRecordRow[] | null): QualitySources => ({
    now: NOW, rubricHash: TRANSCRIPT_RUBRIC_HASH, sessions: [], scores: [], priorScores: [], firings: [], endSignals: [], alliance: [], allianceBaseline: [],
    renegotiations: [], trajectory: [], routing: [], dialogue: [], ladder: [], liveGate: { calibration: 'passed', suspended: [] }, judgeCalibrations,
    killSwitchAudit: [], completeness: { active: 0, current: 0 }, kcAttempts: [], retention: [],
  });
  const reading = (src: QualitySources) => evaluateSignals(src);

  it('is on target only while the transcript judge is calibrated and fresh', () => {
    const ok = reading(base([row({})]));
    expect(ok.readings.find((r) => r.id === 'transcript_judge.agreement')).toMatchObject({ status: 'ok', value: 1 });
    expect(ok.anomalies.some((a) => a.signalId === 'transcript_judge.agreement')).toBe(false);
    for (const rows of [[], [row({ created_at: daysAgo(40) })], [row({ id: 's', kind: 'spot_check', verifies_calibration_id: 'cal-1', verdict: 'failed', created_at: daysAgo(1) }), row({})]]) {
      const r = reading(base(rows));
      expect(r.readings.find((x) => x.id === 'transcript_judge.agreement')!.status).toBe('breach');
      expect(r.anomalies.find((a) => a.signalId === 'transcript_judge.agreement')).toMatchObject({ owner: 'safety_trust_lead', severity: 'urgent' });
    }
  });

  it('an unreadable calibration log is unavailable, never calm; the Tier-Compliance Audit and canary rate are external tools', () => {
    const r = reading(base(null));
    expect(r.readings.find((x) => x.id === 'transcript_judge.agreement')!.status).toBe('unavailable');
    expect(r.readings.find((x) => x.id === 'governance.tier_compliance')!.status).toBe('external');
    expect(r.readings.find((x) => x.id === 'canary.regression_rate')!.status).toBe('external');
  });
});
