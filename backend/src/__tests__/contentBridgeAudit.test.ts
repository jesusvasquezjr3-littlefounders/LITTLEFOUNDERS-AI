import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeFetch, type FakeDb } from './fakePostgrest.js';
import { auditContentBridge } from '../services/contentBridgeAudit.js';

/*
 * RUNBOOK.md Round 101 (adversarial review sweep tutor-review-sweep-101,
 * content-ladder-correctness dimension, MEDIUM): the bridge audit that
 * catches "a mapped skill_key no longer reaches published content" — the
 * EXACT class of defect that made the tutor unable to reach any published
 * lesson before RUNBOOK.md's original content-bridge fix — only ever ran as
 * a side effect of a human dispatching `seed:kc`. Nothing proved the audit
 * ITSELF actually catches the gap it exists for. These tests do, against the
 * real `resolveSkill` path (not a stub of it) via the shared fake PostgREST.
 */

const COURSE_ID = 'c0000000-0000-4000-8000-000000000001';
const TOPIC_HEALTHY = 'a0000000-0000-4000-8000-0000000000b1';
const TOPIC_EMPTY = 'a0000000-0000-4000-8000-0000000000b2';
const LESSON_ID = 'a0000000-0000-4000-8000-0000000000c1';

function makeDb(): FakeDb {
  return {
    courses: [{ id: COURSE_ID, slug: 'financial-education', status: 'published' }],
    topics: [
      // A topic that resolves AND carries a published lesson — the healthy bridge.
      {
        id: TOPIC_HEALTHY,
        slug: 'counting-coins',
        status: 'published',
        'sagas.adventures.course_id': COURSE_ID,
      },
      // A topic that resolves (published, real) but was archived down to zero
      // lessons — the "silent miss" this audit exists to catch, worse than a
      // null skill_key because the mapping LOOKS done.
      {
        id: TOPIC_EMPTY,
        slug: 'archived-topic',
        status: 'published',
        'sagas.adventures.course_id': COURSE_ID,
      },
    ],
    lessons: [{ id: LESSON_ID, topic_id: TOPIC_HEALTHY, status: 'published' }],
  };
}

let db: FakeDb;

beforeEach(() => {
  db = makeDb();
  vi.stubGlobal('fetch', createFakeFetch(db));
  // The audit is deliberately loud (console.log per KC); silence it here so
  // test output stays readable, without hiding the assertions below, which
  // check the STRUCTURED report and the thrown message, not the console.
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('auditContentBridge — a clean mapping', () => {
  it('passes without noise: no throw, nothing reported broken', async () => {
    const report = await auditContentBridge([
      { key: 'money.count-coins', skill_key: 'financial-education/counting-coins' },
    ]);
    expect(report.broken).toEqual([]);
    expect(report.mappedCount).toBe(1);
    expect(report.unmappedKeys).toEqual([]);
  });

  it('a deliberately-unmapped KC (skill_key: null) is reported separately, never as broken', async () => {
    const report = await auditContentBridge([
      { key: 'money.count-coins', skill_key: 'financial-education/counting-coins' },
      { key: 'money.no-content-yet', skill_key: null },
    ]);
    expect(report.broken).toEqual([]);
    expect(report.mappedCount).toBe(1);
    expect(report.unmappedKeys).toEqual(['money.no-content-yet']);
  });
});

describe('auditContentBridge — a deliberately-introduced gap', () => {
  it('fails when the skill_key resolves to a topic with ZERO published lessons', async () => {
    await expect(
      auditContentBridge([{ key: 'money.broken-bridge', skill_key: 'financial-education/archived-topic' }]),
    ).rejects.toThrow(/money\.broken-bridge -> financial-education\/archived-topic.*0 published lessons/s);
  });

  it('fails when the skill_key resolves to no published course\\/topic at all', async () => {
    await expect(
      auditContentBridge([{ key: 'money.ghost', skill_key: 'financial-education/does-not-exist' }]),
    ).rejects.toThrow(/money\.ghost -> financial-education\/does-not-exist.*no published course\/topic/s);
  });

  it('a single broken bridge in an otherwise-healthy batch is named ALONE — the clean one is never implicated', async () => {
    let error: Error | null = null;
    try {
      await auditContentBridge([
        { key: 'money.count-coins', skill_key: 'financial-education/counting-coins' },
        { key: 'money.broken-bridge', skill_key: 'financial-education/archived-topic' },
      ]);
    } catch (err) {
      error = err as Error;
    }
    expect(error).not.toBeNull();
    expect(error!.message).toContain('1 of 2 content bridges do not carry traffic');
    expect(error!.message).toContain('money.broken-bridge -> financial-education/archived-topic');
    expect(error!.message).not.toContain('money.count-coins');
  });
});
