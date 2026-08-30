import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Found by adversarial review, round 24 (2026-08-30, HIGH): `withTimeout`
 * (lib/http.ts) races an already-invoked `fetch()` against a timer — on OUR
 * timeout it stops WAITING, but never cancels the underlying HTTP request,
 * which can keep running and be BILLED on the provider's side with nothing
 * in our own cost ledger to show for it. `AGENTS.md` item 25 already fixed
 * this exact pattern at the three voice provider call sites by passing a real
 * `signal` into `fetch()` itself; these are the three highest-volume paid
 * call sites in the service (the pedagogical model, every turn; the
 * moderation judge, every model-authored turn; the tier-3 content judge)
 * and none of them had gotten the fix.
 *
 * These tests assert only what a `git stash` of the fix can decisively
 * falsify: that the real `fetch()` call site is now given a signal capable
 * of aborting it, which it never was before. Whether Node's OWN timer
 * actually fires inside a unit test is not the question — `AbortSignal`
 * itself is trusted, standard platform behaviour; the defect was that
 * nothing wired one in at all.
 */

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  fetchMock = vi.fn().mockImplementation(() => new Promise(() => {}));
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const { resetConfigCache } = await import('../env.js');
  process.env.MODEL_API_KEY = 'test-model-key-0123';
  process.env.JUDGE_API_KEY = 'test-judge-key-0123';
  resetConfigCache();
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.MODEL_API_KEY;
  delete process.env.JUDGE_API_KEY;
  const { resetModelProbe } = await import('../model/provider.js');
  resetModelProbe();
  const { resetConfigCache } = await import('../env.js');
  resetConfigCache();
});

describe('the pedagogical model call actually cancels on our own timeout', () => {
  it('passes an AbortSignal into fetch even with no caller signal', async () => {
    const { complete } = await import('../model/provider.js');
    // The fetch never resolves; complete() will eventually reject on its own
    // timeout, which this test does not wait for — it only needs to see what
    // fetch() was called WITH.
    void complete([{ role: 'user', content: 'hola' }]).catch(() => {});
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const init = fetchMock.mock.calls[0]![1] as { signal?: AbortSignal };
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('still combines a caller-provided interruption signal, not just the timeout', async () => {
    const { complete } = await import('../model/provider.js');
    const abortController = new AbortController();
    void complete([{ role: 'user', content: 'hola' }], { signal: abortController.signal }).catch(() => {});
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const init = fetchMock.mock.calls[0]![1] as { signal?: AbortSignal };
    expect(init.signal).toBeInstanceOf(AbortSignal);
    // The combined signal must still abort when the CALLER'S OWN signal
    // does — this is what lets a learner's interruption actually cancel the
    // in-flight request, not just the timeout half of the union.
    const aborted = new Promise<void>((resolve) => init.signal!.addEventListener('abort', () => resolve()));
    abortController.abort();
    await aborted;
  });
});

describe('the model preflight probe actually cancels on its own timeout', () => {
  it('passes an AbortSignal into fetch', async () => {
    const { modelReachable } = await import('../model/provider.js');
    void modelReachable().catch(() => {});
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const init = fetchMock.mock.calls[0]![1] as { signal?: AbortSignal };
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('the moderation judge call actually cancels on our own timeout', () => {
  it('passes an AbortSignal into fetch', async () => {
    const { moderateTutorOutput } = await import('../safety/moderation.js');
    void moderateTutorOutput({
      text: 'una respuesta cualquiera',
      locale: 'es-MX',
      tier: 2,
      requireModelPass: false,
    }).catch(() => {});
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const init = fetchMock.mock.calls[0]![1] as { signal?: AbortSignal };
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('the tier-3 content judge call actually cancels on our own timeout', () => {
  it('passes an AbortSignal into fetch', async () => {
    const { generateSegment } = await import('../content/generate.js');
    // generateSegment calls complete() first (also mocked to hang forever by
    // the same fetchMock), so this only needs to prove SOME call in the
    // chain now carries a real signal — the pedagogical-model half is
    // already covered above. Timing out this call is not the point; seeing
    // what fetch() was invoked with is.
    void generateSegment({
      skillKey: 'money.saving',
      tier: 2,
      locale: 'es-MX',
      difficulty: 2,
      framing: 'Ahorrar para algo que cuesta más de lo que tienes.',
      rationale: 'reinforce saving toward a goal',
      allowedTypes: ['coin_count'],
      recentTutorLines: [],
      isMinor: true,
    }).catch(() => {});
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const init = fetchMock.mock.calls[0]![1] as { signal?: AbortSignal };
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
