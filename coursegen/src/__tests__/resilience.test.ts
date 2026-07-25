import { describe, expect, it } from 'vitest';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describeParamMismatch, isSlotDone, newRunCheckpoint, setSlotState, type RunParams } from '../pipeline/checkpoint.js';
import { UsageLedger } from '../providers/usage.js';

/*
 * Mass-generation resilience. Every case here is a confirmed finding from the
 * 2026-07-25 audit of what a 1000+ lesson, multi-day, multi-invocation run does
 * that a 62-lesson run never did.
 */

const params = (over: Partial<RunParams> = {}): RunParams => ({
  course: 'first-lemonade-stand',
  locales: ['es-MX', 'en-US', 'pt-BR'],
  noImages: false,
  register: 'kid',
  ...over,
});

describe('checkpoint: a resume must be provably compatible', () => {
  it('accepts identical parameters', () => {
    expect(describeParamMismatch(params(), params())).toBeNull();
  });

  it('ignores locale ORDER (a set, not a sequence)', () => {
    expect(describeParamMismatch(params({ locales: ['pt-BR', 'es-MX', 'en-US'] }), params())).toBeNull();
  });

  it('detects a narrowed locale set — the case that locked 1000 lessons to one locale', () => {
    const msg = describeParamMismatch(params({ locales: ['es-MX'] }), params());
    expect(msg).toContain('locales');
  });

  it('detects --no-images → full, which published a visual-first course with no images', () => {
    expect(describeParamMismatch(params({ noImages: true }), params())).toContain('noImages');
  });

  it('detects a register switch, which never creates the adult course', () => {
    expect(describeParamMismatch(params({ register: 'adult' }), params())).toContain('register');
  });

  it('treats a params-less (legacy) checkpoint as unknown, never as a match', () => {
    expect(describeParamMismatch(undefined, params())).toContain('predates');
  });
});

describe('checkpoint: dry-run is not done', () => {
  it('a dry-run slot is NOT treated as published, so the real run still does the work', () => {
    let cp = newRunCheckpoint('r1', 'c1', params());
    cp = setSlotState(cp, 'a/b/c/d', 'dry-run', { data: { dryRun: true } });
    expect(isSlotDone(cp, 'a/b/c/d')).toBe(false);
  });

  it('a published slot IS done', () => {
    let cp = newRunCheckpoint('r1', 'c1', params());
    cp = setSlotState(cp, 'a/b/c/d', 'published');
    expect(isSlotDone(cp, 'a/b/c/d')).toBe(true);
  });
});

describe('ledger: the per-RUN budget survives the resumes a long run requires', () => {
  it('replays ledger.jsonl so totals are cumulative, not per-process', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'forge-ledger-'));
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, 'ledger.jsonl'),
      [
        JSON.stringify({ provider: 'deepseek', prompt_tokens: 1000, completion_tokens: 500, est_usd: 0.01 }),
        JSON.stringify({ provider: 'qwen', prompt_tokens: 2000, completion_tokens: 1000, est_usd: 0.02 }),
      ].join('\n') + '\n',
      'utf8',
    );
    const ledger = new UsageLedger(dir);
    expect(ledger.tokens).toBe(0); // before hydration
    await ledger.hydrate();
    expect(ledger.tokens).toBe(4500);
    expect(ledger.usd).toBeCloseTo(0.03, 6);
  });

  it('tolerates a truncated final line (process killed mid-append) instead of refusing to resume', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'forge-ledger-'));
    await writeFile(
      path.join(dir, 'ledger.jsonl'),
      JSON.stringify({ prompt_tokens: 100, completion_tokens: 100, est_usd: 0.005 }) + '\n{"prompt_tokens":50,"comple',
      'utf8',
    );
    const ledger = new UsageLedger(dir);
    await ledger.hydrate();
    expect(ledger.tokens).toBe(200);
  });

  it('starts at zero when there is no ledger yet', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'forge-ledger-'));
    const ledger = new UsageLedger(dir);
    await ledger.hydrate();
    expect(ledger.tokens).toBe(0);
  });

  it('enforces the caps it was handed, so a work-scaled budget actually binds', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'forge-ledger-'));
    await writeFile(path.join(dir, 'ledger.jsonl'), JSON.stringify({ prompt_tokens: 900, completion_tokens: 200, est_usd: 1 }) + '\n', 'utf8');
    const ledger = new UsageLedger(dir);
    await ledger.hydrate({ maxTokens: 1000, maxUsd: 999 });
    expect(() => ledger.checkBudget()).toThrow(/tokens/);
    const roomy = new UsageLedger(dir);
    await roomy.hydrate({ maxTokens: 10_000, maxUsd: 999 });
    expect(() => roomy.checkBudget()).not.toThrow();
  });
});
