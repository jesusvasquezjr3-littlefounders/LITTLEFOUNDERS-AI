import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildTutorMap } from '../services/pedagogy/tutorMap.js';

/*
 * Found by adversarial review, round 37 (2026-08-30, MEDIUM). `buildTutorMap`
 * used to fill `continueTarget` by calling `buildSessionPlan`, which
 * independently RE-FETCHED the same four tables (`kc`, `kc_edge`,
 * `learner_kc_mastery`, `memory_card`) `buildTutorMap` had just read
 * successfully — purely to answer "what would today's session open with".
 * That doubled the read cost of the map route, and collapsed two different
 * things into the identical `continueTarget: null`: a learner who genuinely
 * has nothing to continue, and the redundant re-fetch itself failing on a
 * table the map's OWN read of the exact same table had just succeeded
 * against. `buildTutorMap` now calls the planner's pure ranking
 * (`rankPlanKcs`) directly, over the rows it already holds.
 */

const USER = '22222222-2222-4222-8222-222222222222';

const KC_A = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  key: 'financial-education.a',
  strand: 'money_math',
  title: { 'es-MX': 'A' },
  objective: { 'es-MX': 'Objetivo A' },
  tier_min: 1,
  p_l0: 0.3,
  p_t: 0.2,
  p_g: 0.2,
  p_s: 0.1,
  skill_key: null,
};

function stubKcRest(opts: { restFailures?: string[] } = {}) {
  const calls: { url: string; method: string }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push({ url, method });
      for (const fragment of opts.restFailures ?? []) {
        if (url.includes(fragment)) return Promise.resolve(new Response(null, { status: 500 }));
      }
      if (url.includes('/rest/v1/kc?')) return Promise.resolve(jsonRes([KC_A]));
      if (url.includes('/rest/v1/kc_edge')) return Promise.resolve(jsonRes([]));
      if (url.includes('/rest/v1/learner_kc_mastery')) return Promise.resolve(jsonRes([]));
      if (url.includes('/rest/v1/memory_card')) return Promise.resolve(jsonRes([]));
      if (url.includes('/rest/v1/misconception')) return Promise.resolve(jsonRes([]));
      return Promise.resolve(jsonRes([]));
    }),
  );
  return calls;
}

function jsonRes(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

afterEach(() => vi.unstubAllGlobals());

describe('buildTutorMap fills continueTarget WITHOUT a redundant second fetch', () => {
  it('reads each of the four tables exactly once, and never touches misconception at all', async () => {
    const calls = stubKcRest();

    const map = await buildTutorMap(USER, 2, 'es-MX');

    expect(map).not.toBeNull();
    expect(map?.continueTarget).toMatchObject({ kcKey: 'financial-education.a', reason: 'frontier' });

    const kcCalls = calls.filter((c) => c.url.includes('/rest/v1/kc?'));
    const edgeCalls = calls.filter((c) => c.url.includes('/rest/v1/kc_edge'));
    const masteryCalls = calls.filter((c) => c.url.includes('/rest/v1/learner_kc_mastery'));
    const cardCalls = calls.filter((c) => c.url.includes('/rest/v1/memory_card'));
    expect(kcCalls).toHaveLength(1);
    expect(edgeCalls).toHaveLength(1);
    expect(masteryCalls).toHaveLength(1);
    expect(cardCalls).toHaveLength(1);
    // continueTarget never surfaces misconceptions — no reason to fetch them.
    expect(calls.some((c) => c.url.includes('/rest/v1/misconception'))).toBe(false);
  });

  it('still returns a real, populated map even when the OLD redundant fetch would have failed', async () => {
    // Simulated by making a SECOND identical call to any of the four tables
    // fail — impossible for the current code to trigger (it only calls each
    // once), which is exactly the point: this failure mode no longer exists.
    let kcCallCount = 0;
    const calls: { url: string }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        calls.push({ url });
        if (url.includes('/rest/v1/kc?')) {
          kcCallCount += 1;
          if (kcCallCount > 1) return Promise.resolve(new Response(null, { status: 500 }));
          return Promise.resolve(jsonRes([KC_A]));
        }
        if (url.includes('/rest/v1/kc_edge')) return Promise.resolve(jsonRes([]));
        if (url.includes('/rest/v1/learner_kc_mastery')) return Promise.resolve(jsonRes([]));
        if (url.includes('/rest/v1/memory_card')) return Promise.resolve(jsonRes([]));
        return Promise.resolve(jsonRes([]));
      }),
    );

    const map = await buildTutorMap(USER, 2, 'es-MX');

    expect(map).not.toBeNull();
    expect(map?.continueTarget).not.toBeNull();
    expect(kcCallCount).toBe(1);
  });
});
