// THE RUN-LEVEL KILL SWITCHES — the two errors that must ESCAPE every catch.
//
//  1. `BudgetExceededError`. `checkBudget()` runs before every paid call, but a kill
//     switch only exists if the error PROPAGATES: run.ts stops scheduling new slots,
//     published slots stay published, the rest stay resumable. A per-item catch that
//     degrades it to "skip this one" is exactly what defeated FORGE_MAX_USD_PER_RUN —
//     a run past its cap kept walking every remaining target, paid for each, and
//     reported the cap as enforced. The slot must NOT be marked 'failed' either: a
//     budget stop is not a content failure, and recording it as one would send the
//     outer retry to re-draw a perfectly good slot.
//
//  2. A FATAL provider error (401 / 402 / 403). A dead credential or an empty balance
//     is not a slot-level problem. A real Forge run hit DeepSeek "Insufficient
//     Balance" and then burned 2.17M tokens / ~$10 failing all 62 slots three times
//     each before exiting. The run must abort on the FIRST one, with ONE clear cause.
//
// Also pinned: the per-run budget is HYDRATED from the run's own ledger.jsonl (the
// caps are per-RUN, not per-invocation, and a long run needs several invocations), and
// `--budget-usd` may only ever LOWER a cap — an operator flag can tighten a ceiling,
// never buy headroom the config did not grant.
//
// Every provider boundary is a mock. Nothing here spends anything.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { stringify } from 'yaml';

import { runGeneration, namespaceRunId } from '../pipeline/run.js';
import { resetConfigCache } from '../env.js';
import type { RunCheckpoint } from '../pipeline/checkpoint.js';

const COURSE = 'budget-course';
const TOPIC = 'adv-uno/saga-uno/tema-uno';
const SLOT_A = `${TOPIC}/reparte-la-mesada`;
const SLOT_B = `${TOPIC}/lanza-la-alcancia`;

/** Placeholder credentials: each VALUE starts with `test-`, the exemption
 *  agent/tools/check-secrets.sh recognizes (/AGENTS.md §1.14). A paid run refuses
 *  without them, and these tests must reach the stage that spends. */
const KEYS: Record<string, string> = {
  DEEPSEEK_API_KEY: 'test-deepseek-key-placeholder',
  QWEN_API_KEY: 'test-qwen-key-placeholder',
  PICTUREGEN_URL: 'http://prism.test',
  PICTUREGEN_INTERNAL_KEY: 'test-prism-internal-key-placeholder',
  SUPABASE_URL: 'http://vault.test',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key-placeholder',
};
const saved: Record<string, string | undefined> = {};

let curriculumRoot: string;
let coursegenRoot: string;
let runsRoot: string;

function writeGameCatalog(root: string): void {
  const dir = path.join(root, COURSE);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, 'games.yaml'),
    stringify({
      schema_version: 1,
      course: COURSE,
      games: [
        {
          topic_path: TOPIC,
          slug: 'reparte-la-mesada',
          mechanic: 'sorter',
          micro_objective: 'Separar lo que necesito de lo que quiero.',
          skin_brief: 'Un mercado de barrio con cajas de madera.',
          difficulty: 1,
          tier: 1,
        },
        {
          topic_path: TOPIC,
          slug: 'lanza-la-alcancia',
          mechanic: 'launcher',
          micro_objective: 'Guardar una parte antes de gastar.',
          skin_brief: 'Una feria con globos de papel.',
          difficulty: 2,
          tier: 1,
        },
      ],
    }),
  );
}

function writeCourseCatalog(root: string): void {
  const dir = path.join(root, COURSE);
  mkdirSync(path.join(dir, 'adventures'), { recursive: true });
  writeFileSync(
    path.join(dir, 'catalog.yaml'),
    stringify({
      schema_version: 1,
      course: { slug: COURSE, subject: 'money', authoring_locale: 'es-MX' },
      adventures: [{ file: 'adventures/01-a.yaml' }],
    }),
  );
  writeFileSync(
    path.join(dir, 'adventures/01-a.yaml'),
    stringify({
      schema_version: 1,
      adventure: { position: 1, slug: 'adv-uno', age_tier: 'tier1' },
      sagas: [{ position: 1, slug: 'saga-uno', topics: [{ position: 1, slug: 'tema-uno' }] }],
    }),
  );
}

/** Seeds runs/<run-id>/ledger.jsonl with spend that already blew every cap. */
function seedExhaustedLedger(runId: string, usd = 9_999): void {
  const runDir = path.join(runsRoot, runId);
  mkdirSync(runDir, { recursive: true });
  writeFileSync(
    path.join(runDir, 'ledger.jsonl'),
    `${JSON.stringify({
      ts: '2026-07-30T00:00:00.000Z',
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      operation: 'author',
      prompt_tokens: 1000,
      completion_tokens: 1000,
      images: 0,
      est_usd: usd,
    })}\n`,
    'utf8',
  );
}

function options(runId: string, extra: Record<string, unknown> = {}) {
  return {
    course: COURSE,
    runId,
    curriculumRoot,
    runsRoot,
    coursegenCurriculumRoot: coursegenRoot,
    ...extra,
  } as Parameters<typeof runGeneration>[0];
}

beforeEach(() => {
  for (const [key, value] of Object.entries(KEYS)) {
    saved[key] = process.env[key];
    process.env[key] = value;
  }
  resetConfigCache();

  curriculumRoot = mkdtempSync(path.join(tmpdir(), 'arcade-budget-curr-'));
  coursegenRoot = mkdtempSync(path.join(tmpdir(), 'arcade-budget-forge-'));
  runsRoot = mkdtempSync(path.join(tmpdir(), 'arcade-budget-runs-'));
  writeGameCatalog(curriculumRoot);
  writeCourseCatalog(coursegenRoot);
});

afterEach(() => {
  for (const key of Object.keys(KEYS)) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  resetConfigCache();
  for (const dir of [curriculumRoot, coursegenRoot, runsRoot]) rmSync(dir, { recursive: true, force: true });
  vi.unstubAllGlobals();
});

describe('the budget kill switch', () => {
  it('a run already at its cap ABORTS instead of continuing, and asks for nothing', async () => {
    const runId = namespaceRunId('budget-1');
    seedExhaustedLedger(runId);
    const fetchTrap = vi.fn(() => {
      throw new Error('a run past its budget cap made a provider call');
    });
    vi.stubGlobal('fetch', fetchTrap);

    const summary = await runGeneration(options('budget-1'));

    expect(summary.stoppedOnBudget).toBe(true);
    expect(summary.published).toHaveLength(0);
    // The over-cap run pays for NOTHING — not one plan call to discover it is broke.
    expect(fetchTrap).not.toHaveBeenCalled();
    // The ledger's own record of prior spend survives into the summary.
    expect(summary.usdUsed).toBeGreaterThan(summary.budget.maxUsd);
  });

  it('is NOT swallowed into a per-slot failure — no slot is marked failed by a budget stop', async () => {
    const runId = namespaceRunId('budget-2');
    seedExhaustedLedger(runId);
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('unreachable');
      }),
    );

    const summary = await runGeneration(options('budget-2'));

    // A budget stop is not a content failure: marking the slot 'failed' would send the
    // outer retry to re-draw a perfectly good slot, and would hide the real cause.
    expect(summary.failed).toEqual([]);
    expect(summary.escalated).toEqual([]);
    // Every enumerated slot is still ACCOUNTED FOR — the honest bucket for a slot the
    // pool never reached (Forge's summary used to drop them entirely).
    expect([...summary.notAttempted].sort()).toEqual([SLOT_B, SLOT_A].sort());
    expect(summary.slotsEnumerated).toBe(2);

    // Nothing was written as failed, so every slot stays resumable exactly as it was.
    // (A run that stops on the very first budget check may not have written a
    // checkpoint at all — which is the same statement, more strongly.)
    const checkpointPath = path.join(runsRoot, runId, 'checkpoint.json');
    if (existsSync(checkpointPath)) {
      const checkpoint = JSON.parse(readFileSync(checkpointPath, 'utf8')) as RunCheckpoint;
      expect(Object.values(checkpoint.slots).filter((slot) => slot.state === 'failed')).toEqual([]);
    }
  });

  it('hydrates the cap from the run ledger — the caps are per-RUN, not per-invocation', async () => {
    const runId = namespaceRunId('budget-3');
    // Below the cap: the run proceeds far enough to make a provider call, which proves
    // the same seeding mechanism does NOT abort a run that is merely partway through.
    seedExhaustedLedger(runId, 0.01);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: null, error: { code: 'X', message: 'no balance' } }), {
        status: 402,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const summary = await runGeneration(options('budget-3'));

    expect(summary.stoppedOnBudget).toBe(false);
    expect(summary.usdUsed).toBeCloseTo(0.01, 10);
    expect(fetchMock).toHaveBeenCalled();
  });

  it('--budget-usd only ever LOWERS the cap, never raises it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('unreachable');
      }),
    );

    const tightened = await runGeneration(options('budget-4', { dryRun: true, maxUsdOverride: 0.01 }));
    expect(tightened.budget.maxUsd).toBe(0.01);

    const attemptedRaise = await runGeneration(options('budget-5', { dryRun: true, maxUsdOverride: 1_000_000 }));
    // The config's scaled ceiling wins — an operator flag cannot buy headroom.
    expect(attemptedRaise.budget.maxUsd).toBeLessThan(1_000_000);
  });
});

describe('a fatal provider error', () => {
  it('aborts the whole run on the FIRST 402 instead of re-failing every slot N times', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Insufficient Balance' } }), {
        status: 402,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const summary = await runGeneration(options('fatal-1', { noImages: true }));

    expect(summary.fatalProviderError).toMatch(/402/);
    expect(summary.published).toHaveLength(0);
    // ONE clear cause, not N derived symptoms: no slot is marked failed, and the
    // ARCADE_SLOT_ATTEMPTS loop never re-draws against a dead credential.
    expect(summary.failed).toEqual([]);
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(summary.slotsEnumerated);
    expect(summary.stoppedOnBudget).toBe(false);
  });
});
