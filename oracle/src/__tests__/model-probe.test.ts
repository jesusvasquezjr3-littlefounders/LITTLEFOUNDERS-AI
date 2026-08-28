import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { modelReachable, resetModelProbe } from '../model/provider.js';

/*
 * The preflight probe (/ORACLE.md §14). Exists because of a measured outage:
 * on 2026-08-24 the shared DeepSeek account ran out of balance, and because
 * readiness only checked that a key STRING existed, preflight said yes and
 * every turn then failed in front of the learner. The probe's contract:
 * definitive refusals block, transients do not, and it costs at most one tiny
 * call a minute.
 */

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  resetModelProbe();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const { resetConfigCache } = await import('../env.js');
  process.env.MODEL_API_KEY = 'test-model-key-0123';
  resetConfigCache();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.MODEL_API_KEY;
  resetModelProbe();
  const { resetConfigCache } = await import('../env.js');
  resetConfigCache();
});

describe('the model probe', () => {
  it('answers unconfigured with NO network call when there is no key', async () => {
    delete process.env.MODEL_API_KEY;
    const { resetConfigCache } = await import('../env.js');
    resetConfigCache();

    expect(await modelReachable()).toBe('unconfigured');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('blocks on a DEFINITIVE refusal — the out-of-balance 402 that shipped', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 402 }));
    expect(await modelReachable()).toBe('blocked');
  });

  it('stays available through a transient — a slow provider must not flap the tutor off', async () => {
    fetchMock.mockRejectedValue(new Error('socket hang up'));
    expect(await modelReachable()).toBe('ok');
    fetchMock.mockResolvedValue(new Response('{}', { status: 500 }));
    resetModelProbe();
    expect(await modelReachable()).toBe('ok');
  });

  it('caches the verdict, so preflight polling costs one probe a minute at most', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    await modelReachable();
    await modelReachable();
    await modelReachable();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
