import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { AgeScreenState } from '../ageScreen.js';
import { BRIDGE_CATALOG, bridgeAudience, bridgeCandidates, topicNewlyCompleted } from './familyBridge.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const seeds = path.resolve(here, '../../../../database/seeds');
const graph = JSON.parse(readFileSync(path.join(seeds, 'kc_graph.v1.json'), 'utf8')) as { kcs: Array<{ key: string }> };
const map = JSON.parse(readFileSync(path.join(seeds, 'kc_topic_map.v1.json'), 'utf8')) as {
  courses: Array<{ course: string; topics: Array<{ path: string; teaches?: string[] }> }>;
};

const screened = (ageBand: AgeScreenState['ageBand'], over: Partial<AgeScreenState> = {}): AgeScreenState => ({ required: false, ageBand, protectedOrigin: false, ...over });

describe('who a bridge prompt is for (OD-3, Option B)', () => {
  it.each([
    ['parent-created 7-year-old with a verified Tutor', { roles: ['kid'], isGuest: false, age: screened('under_13'), hasVerifiedGuardian: true }, 'guardian'],
    ['linked teen of 15', { roles: [], isGuest: false, age: screened('13_to_17'), hasVerifiedGuardian: true }, 'guardian'],
    ['independent teen of 15', { roles: [], isGuest: false, age: screened('13_to_17'), hasVerifiedGuardian: false }, 'self'],
    ['refusal-path guest', { roles: [], isGuest: true, age: screened('under_13', { protectedOrigin: true }), hasVerifiedGuardian: false }, null],
    ['under-13 origin without a guest session', { roles: [], isGuest: false, age: screened('13_to_17', { protectedOrigin: true }), hasVerifiedGuardian: false }, null],
    ['child whose last Tutor link is gone', { roles: ['kid'], isGuest: false, age: screened('under_13'), hasVerifiedGuardian: false }, null],
    ['kid-role account declaring 13–17 without a guardian', { roles: ['kid'], isGuest: false, age: screened('13_to_17'), hasVerifiedGuardian: false }, null],
    ['adult learning for themselves', { roles: [], isGuest: false, age: screened('adult'), hasVerifiedGuardian: false }, null],
    ['verified-parent Tutor learning for themselves', { roles: ['parent'], isGuest: false, age: screened('adult'), hasVerifiedGuardian: false }, null],
    ['unscreened account', { roles: [], isGuest: false, age: { required: true, ageBand: null, protectedOrigin: false }, hasVerifiedGuardian: false }, null],
  ] as const)('%s', (_label, input, expected) => {
    expect(bridgeAudience({ ...input, roles: [...input.roles] })).toBe(expected);
  });
});

describe('the bridge catalog', () => {
  it('names only real components of the shared graph, each taught by at least one real curriculum topic', () => {
    const keys = new Set(graph.kcs.map((k) => k.key));
    const taught = new Map<string, number>();
    for (const course of map.courses) for (const topic of course.topics) for (const key of topic.teaches ?? []) taught.set(key, (taught.get(key) ?? 0) + 1);
    for (const { kcKey } of BRIDGE_CATALOG) {
      expect(keys.has(kcKey), kcKey).toBe(true);
      expect(taught.get(kcKey) ?? 0, `${kcKey} is taught by no topic`).toBeGreaterThan(0);
    }
    // Both actions are reachable from the real catalog.
    expect(new Set(BRIDGE_CATALOG.map((e) => e.action))).toEqual(new Set(['savings_goal', 'earning_task']));
  });

  it('maps a topic\'s components in its own order and ignores the rest', () => {
    expect(bridgeCandidates(['money.add-money', 'life.track-earnings', 'biz.saving-goal', 'life.track-earnings'])).toEqual([
      { kc_key: 'life.track-earnings', action: 'earning_task' },
      { kc_key: 'biz.saving-goal', action: 'savings_goal' },
    ]);
    expect(bridgeCandidates(['money.add-money'])).toEqual([]);
  });

  it('fires only on the completion that finishes a topic', () => {
    const passed = { state: 'passed', placementCredited: false };
    const open = { state: 'available', placementCredited: false };
    const credited = { state: 'locked', placementCredited: true };
    expect(topicNewlyCompleted([passed, open], [passed, passed])).toBe(true);
    expect(topicNewlyCompleted([credited, open], [credited, passed])).toBe(true);
    expect(topicNewlyCompleted([passed, passed], [passed, passed])).toBe(false);
    expect(topicNewlyCompleted([passed, open], [passed, open])).toBe(false);
    expect(topicNewlyCompleted([open], null)).toBe(false);
    expect(topicNewlyCompleted(null, [])).toBe(false);
  });
});
