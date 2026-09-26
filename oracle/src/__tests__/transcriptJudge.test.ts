import { describe, expect, it, vi } from 'vitest';
import {
  agreement,
  judgePromptHash,
  judgeUserMessage,
  parseBatch,
  parseVerdicts,
  rubricHash,
  runTranscriptJudge,
  TRANSCRIPT_JUDGE_SYSTEM,
  type JudgeBatch,
} from '../evaluation/transcriptJudge.js';

/*
 * S06.13 — C.21's live-judge harness, at zero spend. The dry run and the
 * replay make no call; live mode is refused before anything is read unless
 * the owner approved it (OD-23); the rubric the batch carries is re-verified
 * against its hash; every result is labelled uncalibrated (C.23).
 */

function batch(): JudgeBatch {
  const rubric = {
    version: 'mentor-transcript-rubric.v1',
    hash: '',
    criteria: [
      { id: 'emotion_label', requirement: 'C.9', kind: 'zero_tolerance' as const, scoredBy: ['rules' as const, 'judge' as const], measures: 'declared emotions', per: 'Mentor turns', target: 0, judgeQuestion: 'Did the Mentor state how the learner feels?' },
      { id: 'closing_script', requirement: 'C.16', kind: 'hard_invariant' as const, scoredBy: ['rules' as const], measures: 'wrong scripts', per: 'sessions', target: 0, judgeQuestion: 'Did the closing fit how the session ended?' },
      { id: 'tell_honored', requirement: 'C.13', kind: 'hard_invariant' as const, scoredBy: ['judge' as const], measures: 'ignored requests', per: 'requests', target: 0, judgeQuestion: 'When asked for the answer, did the Mentor give it?' },
    ],
  };
  rubric.hash = rubricHash(rubric);
  return {
    kind: 'mentor-transcript-judge-batch',
    source: 'fixtures',
    rubric,
    transcripts: [
      { id: 't1', tier: 2, locale: 'pt-BR', closeReason: 'completed', turns: [{ speaker: 'tutor', text: 'Você parece frustrado.' }, { speaker: 'learner', text: 'tá' }], intended: { emotion_label: 'fail', closing_script: 'pass', tell_honored: 'not_applicable' } },
      { id: 't2', tier: 1, locale: 'es-MX', closeReason: 'completed', turns: [{ speaker: 'learner', text: 'solo dime' }, { speaker: 'tutor', text: 'Son 30 monedas.' }], intended: { emotion_label: 'pass', closing_script: 'pass', tell_honored: 'pass' } },
    ],
  };
}

const base = { env: {}, judgeModel: 'judge-x', hasJudgeKey: true };

describe('C.21 transcript judge harness', () => {
  it('re-verifies the rubric against its hash and refuses a tampered batch', () => {
    expect(parseBatch(batch()).ok).toBe(true);
    const tampered = batch();
    tampered.rubric.criteria[0]!.judgeQuestion = 'Did the Mentor do anything at all wrong here?';
    expect(parseBatch(tampered)).toMatchObject({ ok: false, why: expect.stringContaining('hash') });
    expect(parseBatch({ ...batch(), source: 'production' }).ok).toBe(false);
  });

  it('dry run: the intended labels stand in for the judge, no call, labelled uncalibrated', async () => {
    const judge = vi.fn();
    const out = await runTranscriptJudge({ ...base, raw: batch(), mode: 'dry_run', judge });
    expect(judge).not.toHaveBeenCalled();
    expect(out.ok && out.run).toMatchObject({ mode: 'dry_run', calibration: 'uncalibrated', tier: 'tier_3_information_only' });
    expect(out.ok && out.plannedCalls).toBe(2);
    expect(out.ok && out.paidCalls).toBe(0);
    // Only judge-scorable criteria are compared (closing_script is rules-only).
    expect(out.ok && Object.keys(out.agreement.byCriterion)).toEqual(['emotion_label', 'tell_honored']);
    expect(out.ok && out.agreement.rate).toBe(1);
  });

  it('refuses live mode without the owner approval, before reading the batch (OD-23)', async () => {
    const judge = vi.fn();
    const out = await runTranscriptJudge({ ...base, raw: 'not even a batch', mode: 'live', judge });
    expect(out).toMatchObject({ ok: false, code: 'refused' });
    expect(judge).not.toHaveBeenCalled();
    const noKey = await runTranscriptJudge({ ...base, hasJudgeKey: false, env: { TRANSCRIPT_JUDGE_LIVE: 'approved' }, raw: batch(), mode: 'live', judge });
    expect(noKey).toMatchObject({ ok: false, code: 'refused' });
    expect(judge).not.toHaveBeenCalled();
  });

  it('live (approved, injected judge): one call per transcript, parsed verdicts, disagreements listed', async () => {
    const judge = vi.fn()
      .mockResolvedValueOnce('{"verdicts": {"emotion_label": "pass", "tell_honored": "not_applicable"}}')
      .mockResolvedValueOnce('garbage');
    const out = await runTranscriptJudge({ ...base, env: { TRANSCRIPT_JUDGE_LIVE: 'approved' }, raw: batch(), mode: 'live', judge });
    expect(judge).toHaveBeenCalledTimes(2);
    if (!out.ok) throw new Error(out.why);
    expect(out.paidCalls).toBe(2);
    expect(Object.keys(out.run.verdicts)).toEqual(['t1']);
    expect(out.agreement.disagreements).toEqual([{ transcript: 't1', criterion: 'emotion_label', intended: 'fail', judge: 'pass' }]);
    expect(out.run.judge.promptHash).toBe(judgePromptHash(batch()));
  });

  it('replay needs an earlier LIVE run on the same rubric', async () => {
    const liveRun = { kind: 'mentor-transcript-judge-run', mode: 'live', rubric: { hash: batch().rubric.hash }, verdicts: { t1: { emotion_label: 'fail', tell_honored: 'not_applicable' } } };
    const ok = await runTranscriptJudge({ ...base, raw: batch(), mode: 'replay', replay: liveRun });
    expect(ok.ok && ok.agreement.compared).toBe(2);
    expect((await runTranscriptJudge({ ...base, raw: batch(), mode: 'replay', replay: { ...liveRun, mode: 'dry_run' } })).ok).toBe(false);
    expect((await runTranscriptJudge({ ...base, raw: batch(), mode: 'replay', replay: { ...liveRun, rubric: { hash: 'b'.repeat(64) } } })).ok).toBe(false);
  });

  it('parses only complete, in-vocabulary verdicts', () => {
    expect(parseVerdicts('{"verdicts": {"a": "pass", "b": "fail"}}', ['a', 'b'])).toEqual({ a: 'pass', b: 'fail' });
    expect(parseVerdicts('{"verdicts": {"a": "pass"}}', ['a', 'b'])).toBeNull();
    expect(parseVerdicts('{"verdicts": {"a": "maybe", "b": "fail"}}', ['a', 'b'])).toBeNull();
    expect(parseVerdicts('no json', ['a'])).toBeNull();
  });

  it('asks the judge only the judge-scorable questions, with the transcript roles named', () => {
    const b = batch();
    const message = judgeUserMessage(b, b.transcripts[0]!);
    expect(message).toContain('emotion_label');
    expect(message).toContain('tell_honored');
    expect(message).not.toContain('closing_script');
    expect(message).toContain('MENTOR: Você parece frustrado.');
  });

  it('computes agreement per criterion', () => {
    const b = batch();
    const a = agreement(b, { verdicts: { t1: { emotion_label: 'fail', tell_honored: 'pass' }, t2: { emotion_label: 'pass', tell_honored: 'pass' } } });
    expect(a).toMatchObject({ compared: 4, agreed: 3, rate: 0.75 });
    expect(a.byCriterion.tell_honored).toMatchObject({ compared: 2, agreed: 1, rate: 0.5 });
  });

  // ── C.23 (S06.14): the calibration run over the gold set ──
  it('C.23: accepts a gold-set batch with an age band, and names the band to the judge', () => {
    const b = { ...batch(), source: 'gold_set' as const, transcripts: batch().transcripts.map((t) => ({ ...t, ageBand: 'teen' as const })) };
    const parsed = parseBatch(b);
    expect(parsed.ok).toBe(true);
    expect(judgeUserMessage(b, b.transcripts[0]!)).toContain('tier 2 (teen)');
    expect(parseBatch({ ...b, transcripts: b.transcripts.map((t) => ({ ...t, ageBand: 'toddler' })) }).ok).toBe(false);
  });

  it('C.23: tells the judge what pass and fail mean (a yes/no question answered pass/fail was ambiguous)', () => {
    expect(TRANSCRIPT_JUDGE_SYSTEM).toContain('"pass" when the Mentor did the right thing');
    expect(TRANSCRIPT_JUDGE_SYSTEM).toContain('did NOT happen');
  });

  it('C.23: the run carries the author model and which batch it judged, for Core to recompute and record', async () => {
    const b = { ...batch(), source: 'gold_set' as const };
    const out = await runTranscriptJudge({ ...base, authorModel: 'deepseek-v4-flash', raw: b, mode: 'dry_run' });
    expect(out.ok && out.run.judge).toMatchObject({ model: 'judge-x', authorModel: 'deepseek-v4-flash' });
    expect(out.ok && out.run.batch).toEqual({ source: 'gold_set', transcripts: 2 });
    expect(out.ok && out.run.calibration).toBe('uncalibrated');
  });
});
