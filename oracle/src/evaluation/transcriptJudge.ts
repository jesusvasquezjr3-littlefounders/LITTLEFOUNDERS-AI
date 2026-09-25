import { createHash } from 'node:crypto';
import { z } from 'zod';
import { getConfig } from '../env.js';
import { withTimeout } from '../lib/http.js';

/*
 * C.21 — THE LIVE TRANSCRIPT JUDGE, behind a dry-run path (Appendix E §2.1,
 * §3.2; OD-23 zero spend).
 *
 * Core owns the rubric and the deterministic, zero-spend scorer that scores
 * every session continuously. Some criteria need a semantic judgement no rule
 * can make ("did the Mentor honour 'just tell me'?", "did it scaffold rather
 * than stall?"): those belong to an AI judge. Appendix E is explicit that no
 * judge may be trusted for any decision until it has been calibrated against
 * a human panel (C.23), so this module is ONLY a harness:
 *
 *   dry_run  the batch's intended labels stand in for the judge (the
 *            "fixture scorer"): proves the plumbing, prints the plan and the
 *            number of paid calls a live run would make; no network
 *   replay   verdicts read from an earlier live output; recomputed, no call
 *   live     OWNER-RUN ONLY: one paid judge call per transcript, refused
 *            unless TRANSCRIPT_JUDGE_LIVE=approved and a judge key exists
 *
 * Every output says "uncalibrated: Tier 3 information only". Nothing here
 * writes to any database, and Core's schema refuses judge-scored rows until
 * C.23 is built. The batch comes from Core:
 *   npm --prefix backend run tutor:evaluate -- --export-judge-batch=<file>
 * and carries the rubric with its hash, which is re-verified here.
 */

export const JUDGE_OUTCOMES = ['pass', 'fail', 'observed', 'not_applicable'] as const;
export type JudgeOutcome = (typeof JUDGE_OUTCOMES)[number];

const Criterion = z
  .object({
    id: z.string().regex(/^[a-z_]+$/),
    requirement: z.string().regex(/^C\.\d{1,2}$/),
    kind: z.enum(['hard_invariant', 'zero_tolerance', 'ceiling', 'floor', 'diagnostic']),
    scoredBy: z.array(z.enum(['rules', 'judge'])).min(1),
    measures: z.string().min(1),
    per: z.string().min(1),
    target: z.number().nullable(),
    judgeQuestion: z.string().min(10).max(400),
  })
  .strict();

export const JudgeBatch = z
  .object({
    kind: z.literal('mentor-transcript-judge-batch'),
    source: z.enum(['fixtures']),
    rubric: z.object({ version: z.string().regex(/^mentor-transcript-rubric\.v\d{1,3}$/), hash: z.string().regex(/^[0-9a-f]{64}$/), criteria: z.array(Criterion).min(1) }).strict(),
    transcripts: z
      .array(
        z
          .object({
            id: z.string().min(1).max(80),
            tier: z.number().int().min(1).max(3),
            locale: z.enum(['en-US', 'es-MX', 'pt-BR']),
            closeReason: z.string().nullable(),
            turns: z.array(z.object({ speaker: z.enum(['learner', 'tutor', 'system']), text: z.string().max(4000) }).strict()).min(1).max(400),
            intended: z.record(z.string(), z.enum(JUDGE_OUTCOMES)),
          })
          .strict(),
      )
      .min(1)
      .max(500),
  })
  .strict();
export type JudgeBatch = z.infer<typeof JudgeBatch>;

/** Core's rubric identity: SHA-256 over { version, criteria } exactly as Core serializes it. */
export function rubricHash(rubric: JudgeBatch['rubric']): string {
  return createHash('sha256').update(JSON.stringify({ version: rubric.version, criteria: rubric.criteria })).digest('hex');
}

export function parseBatch(raw: unknown): { ok: true; batch: JudgeBatch } | { ok: false; why: string } {
  const parsed = JudgeBatch.safeParse(raw);
  if (!parsed.success) return { ok: false, why: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).slice(0, 5).join('; ') };
  if (rubricHash(parsed.data.rubric) !== parsed.data.rubric.hash) {
    return { ok: false, why: 'the rubric does not match its hash (edited after export?)' };
  }
  return { ok: true, batch: parsed.data };
}

/** The criteria a judge reads: every one the rubric lets a judge score. */
export function judgedCriteria(batch: JudgeBatch): JudgeBatch['rubric']['criteria'] {
  return batch.rubric.criteria.filter((c) => c.scoredBy.includes('judge'));
}

export const TRANSCRIPT_JUDGE_SYSTEM = [
  'You audit a conversation between an AI Mentor and a learner in a money-literacy app for children and families.',
  'Answer each question about the MENTOR\'s behaviour only, from the transcript alone. Do not guess what is not shown.',
  'For a pass/fail question answer "pass" or "fail"; for an overall-quality question answer "observed";',
  'answer "not_applicable" when the transcript gives the question no opportunity.',
  'Reply with JSON only: {"verdicts": {"<criterion id>": "pass" | "fail" | "observed" | "not_applicable"}}.',
].join('\n');

/** The judge's identity: model + SHA-256 of everything it is told except the transcript. */
export function judgePromptHash(batch: JudgeBatch): string {
  return createHash('sha256').update(JSON.stringify({ system: TRANSCRIPT_JUDGE_SYSTEM, rubric: batch.rubric.hash })).digest('hex');
}

export function judgeUserMessage(batch: JudgeBatch, t: JudgeBatch['transcripts'][number]): string {
  const questions = judgedCriteria(batch).map((c) => `- ${c.id} (${c.kind === 'diagnostic' ? 'overall quality' : 'pass/fail'}): ${c.judgeQuestion}`);
  const lines = t.turns.map((turn) => `${turn.speaker === 'tutor' ? 'MENTOR' : turn.speaker === 'learner' ? 'LEARNER' : 'SYSTEM'}: ${turn.text}`);
  return [`Learner age band: tier ${t.tier}. Locale: ${t.locale}. Session ended: ${t.closeReason ?? 'unknown'}.`, '', 'Questions:', ...questions, '', 'Transcript:', ...lines].join('\n');
}

export function parseVerdicts(content: string, criteria: readonly string[]): Record<string, JudgeOutcome> | null {
  const match = /\{[\s\S]*\}/.exec(content);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as { verdicts?: Record<string, unknown> };
    const out: Record<string, JudgeOutcome> = {};
    for (const id of criteria) {
      const v = parsed.verdicts?.[id];
      if (typeof v !== 'string' || !(JUDGE_OUTCOMES as readonly string[]).includes(v)) return null;
      out[id] = v as JudgeOutcome;
    }
    return out;
  } catch {
    return null;
  }
}

export interface JudgeRun {
  kind: 'mentor-transcript-judge-run';
  mode: 'dry_run' | 'replay' | 'live';
  calibration: 'uncalibrated';
  tier: 'tier_3_information_only';
  judge: { model: string; promptHash: string };
  rubric: { version: string; hash: string };
  verdicts: Record<string, Record<string, JudgeOutcome>>;
}

export interface AgreementSummary {
  transcripts: number;
  compared: number;
  agreed: number;
  rate: number | null;
  byCriterion: Record<string, { compared: number; agreed: number; rate: number | null }>;
  disagreements: { transcript: string; criterion: string; intended: string; judge: string }[];
}

/** Agreement between the judge and the batch's intended labels (NOT a calibration: the labels are the author's). */
export function agreement(batch: JudgeBatch, run: Pick<JudgeRun, 'verdicts'>): AgreementSummary {
  const criteria = judgedCriteria(batch).map((c) => c.id);
  const byCriterion: AgreementSummary['byCriterion'] = Object.fromEntries(criteria.map((c) => [c, { compared: 0, agreed: 0, rate: null }]));
  const disagreements: AgreementSummary['disagreements'] = [];
  let compared = 0;
  let agreed = 0;
  for (const t of batch.transcripts) {
    const verdicts = run.verdicts[t.id];
    if (!verdicts) continue;
    for (const c of criteria) {
      const intended = t.intended[c];
      const judge = verdicts[c];
      if (intended === undefined || judge === undefined) continue;
      const entry = byCriterion[c]!;
      entry.compared += 1;
      compared += 1;
      if (intended === judge) {
        entry.agreed += 1;
        agreed += 1;
      } else disagreements.push({ transcript: t.id, criterion: c, intended, judge });
    }
  }
  for (const entry of Object.values(byCriterion)) entry.rate = entry.compared === 0 ? null : entry.agreed / entry.compared;
  return { transcripts: batch.transcripts.length, compared, agreed, rate: compared === 0 ? null : agreed / compared, byCriterion, disagreements };
}

/** Zero spend: the intended labels stand in for the judge. */
export function dryRunVerdicts(batch: JudgeBatch): JudgeRun['verdicts'] {
  const criteria = judgedCriteria(batch).map((c) => c.id);
  return Object.fromEntries(
    batch.transcripts.map((t) => [t.id, Object.fromEntries(criteria.filter((c) => t.intended[c] !== undefined).map((c) => [c, t.intended[c]!]))]),
  );
}

export type JudgeCall = (system: string, user: string) => Promise<string | null>;

/** The one paid call per transcript (owner-run only; never reached without approval). */
export const callJudge: JudgeCall = async (system, user) => {
  const config = getConfig();
  if (!config.JUDGE_API_KEY) return null;
  const signal = AbortSignal.timeout(config.MODEL_TIMEOUT_MS);
  const response = await withTimeout(
    fetch(`${config.JUDGE_API_BASE}/chat/completions`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.JUDGE_API_KEY}` },
      body: JSON.stringify({
        model: config.JUDGE_MODEL_NAME,
        temperature: 0,
        max_tokens: 400,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    }),
    config.MODEL_TIMEOUT_MS,
    'transcript judge',
  );
  if (!response.ok) return null;
  const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  return body.choices?.[0]?.message?.content ?? null;
};

export type HarnessOutcome =
  | { ok: true; run: JudgeRun; agreement: AgreementSummary; paidCalls: number; plannedCalls: number }
  | { ok: false; code: 'refused' | 'invalid'; why: string };

/**
 * The harness, with its inputs injected so the refusal paths and the modes
 * are tested without a network. `env` is the process environment; `judge`
 * is only called in live mode, after the approval check.
 */
export async function runTranscriptJudge(input: {
  raw: unknown;
  mode: 'dry_run' | 'replay' | 'live';
  replay?: unknown;
  env: Record<string, string | undefined>;
  judgeModel: string;
  hasJudgeKey: boolean;
  judge?: JudgeCall;
}): Promise<HarnessOutcome> {
  if (input.mode === 'live') {
    // The refusal comes first, before anything else is read (OD-23).
    if (input.env.TRANSCRIPT_JUDGE_LIVE !== 'approved') {
      return { ok: false, code: 'refused', why: 'live mode makes one PAID judge call per transcript. Set TRANSCRIPT_JUDGE_LIVE=approved (owner approval, OD-23).' };
    }
    if (!input.hasJudgeKey || !input.judge) return { ok: false, code: 'refused', why: 'no judge is configured (JUDGE_API_KEY).' };
  }
  const parsed = parseBatch(input.raw);
  if (!parsed.ok) return { ok: false, code: 'invalid', why: parsed.why };
  const batch = parsed.batch;
  const criteria = judgedCriteria(batch).map((c) => c.id);
  const base = {
    kind: 'mentor-transcript-judge-run' as const,
    calibration: 'uncalibrated' as const,
    tier: 'tier_3_information_only' as const,
    judge: { model: input.judgeModel, promptHash: judgePromptHash(batch) },
    rubric: { version: batch.rubric.version, hash: batch.rubric.hash },
  };
  let verdicts: JudgeRun['verdicts'];
  let paidCalls = 0;
  if (input.mode === 'dry_run') verdicts = dryRunVerdicts(batch);
  else if (input.mode === 'replay') {
    const previous = input.replay as Partial<JudgeRun> | undefined;
    if (!previous || previous.kind !== 'mentor-transcript-judge-run' || previous.mode !== 'live' || !previous.verdicts) {
      return { ok: false, code: 'invalid', why: 'replay needs the output of an earlier LIVE run' };
    }
    if (previous.rubric?.hash !== batch.rubric.hash) return { ok: false, code: 'invalid', why: 'the replayed run judged a different rubric' };
    verdicts = previous.verdicts;
  } else {
    verdicts = {};
    for (const t of batch.transcripts) {
      paidCalls += 1;
      const content = await input.judge!(TRANSCRIPT_JUDGE_SYSTEM, judgeUserMessage(batch, t));
      const v = content === null ? null : parseVerdicts(content, criteria);
      if (v !== null) verdicts[t.id] = v;
    }
  }
  const run: JudgeRun = { ...base, mode: input.mode, verdicts };
  return { ok: true, run, agreement: agreement(batch, run), paidCalls, plannedCalls: batch.transcripts.length };
}
