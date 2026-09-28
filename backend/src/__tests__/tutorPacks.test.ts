import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { jsonResponse } from './helpers.js';
import { planPacks, PACK_DIR } from '../scripts/seed-tutor-packs.js';
import {
  canonicalJson,
  fromStoredPack,
  packContentHash,
  setTutorPackStatus,
  toStoredPack,
  validatePack,
  type AuthoredPack,
  type TutorPackAdminRow,
} from '../services/tutorPacks.js';

/*
 * C.6 — the curated activity-pack tier: the tutor-pack.v1 contract, the seed
 * packs authored at zero spend, the stored form, and the human release gate.
 */

const MCQ = {
  id: 'pack-test-t2-en-1',
  type: 'quiz_mcq',
  prompt_md: 'Which is more: half of 12 coins or a quarter of 12 coins?',
  difficulty: 2,
  xp: 10,
  explanation_md: 'Half of 12 is 6 coins; a quarter is 3.',
  payload: {
    options: [
      { id: 'a', text_md: 'Half' },
      { id: 'b', text_md: 'A quarter', rationale_md: 'More parts make smaller parts.' },
      { id: 'c', text_md: 'The same', rationale_md: '6 and 3 are different.' },
    ],
  },
  answer: { correct_option_id: 'a' },
};
const NUM = {
  id: 'pack-test-t2-en-2',
  type: 'number_input',
  prompt_md: 'What is a third of 15 coins?',
  difficulty: 2,
  xp: 15,
  explanation_md: '15 in 3 equal parts is 5.',
  payload: { unit: 'coins' },
  answer: { value: 5, tolerance: 0 },
};
const TF = {
  id: 'pack-test-t2-en-3',
  type: 'true_false',
  prompt_md: 'True or false?',
  difficulty: 2,
  xp: 10,
  explanation_md: '8 in 4 equal parts is 2.',
  payload: { statement_md: 'A quarter of 8 coins is 2 coins.' },
  answer: { is_true: true },
};
const SORT = {
  id: 'pack-test-t2-en-4',
  type: 'sort_buckets',
  prompt_md: 'Sort each sale.',
  difficulty: 2,
  xp: 15,
  explanation_md: 'A thing you keep; a service is work done for you.',
  payload: {
    buckets: [{ id: 'thing', label: 'A thing' }, { id: 'service', label: 'A service' }],
    items: [
      { id: 'i1', text_md: 'A toy car' },
      { id: 'i2', text_md: 'Washing a bike' },
      { id: 'i3', text_md: 'A cookie' },
      { id: 'i4', text_md: 'A haircut' },
    ],
  },
  answer: { assignments: { i1: 'thing', i2: 'service', i3: 'thing', i4: 'service' } },
};

const pack = (segments: unknown[], over: Partial<AuthoredPack> = {}): AuthoredPack => ({
  tier: 2,
  locale: 'en-US',
  risk_category: 'standard',
  segments,
  ...over,
});
const GOOD = pack([MCQ, NUM, TF, SORT]);

describe('C.6 the seed packs (hand-authored, zero spend)', () => {
  it('every seed pack meets tutor-pack.v1: 21 packs, 84 segments, 4 knowledge components with no published topic', () => {
    const { plan, failures } = planPacks();
    expect(failures).toEqual([]);
    expect(plan).toHaveLength(21);
    expect(plan.reduce((n, p) => n + p.segments, 0)).toBe(84);
    expect(new Set(plan.map((p) => p.kcKey))).toEqual(
      new Set(['biz.goods-vs-services', 'money.fraction-of-amount', 'money.percent-intro', 'biz.risk-and-reward']),
    );
    // Every target has all three locales for every tier it covers.
    const targets = new Map<string, Set<string>>();
    for (const p of plan) {
      const key = `${p.skillKey}|${p.tier}`;
      targets.set(key, (targets.get(key) ?? new Set()).add(p.locale));
    }
    for (const [key, locales] of targets) expect([...locales].sort(), key).toEqual(['en-US', 'es-MX', 'pt-BR']);
  });

  it('never targets a tier below the knowledge component\'s tier_min', () => {
    const graph = JSON.parse(readFileSync(path.resolve(PACK_DIR, '../kc_graph.v1.json'), 'utf8')) as { kcs: { key: string; tier_min: number }[] };
    const tierMin = new Map(graph.kcs.map((k) => [k.key, k.tier_min]));
    for (const p of planPacks().plan) expect(p.tier).toBeGreaterThanOrEqual(tierMin.get(p.kcKey!)!);
  });

  it('targets exactly the knowledge components the ladder could only generate for', () => {
    const graph = JSON.parse(readFileSync(path.resolve(PACK_DIR, '../kc_graph.v1.json'), 'utf8')) as { kcs: { key: string; skill_key: string | null; status?: string }[] };
    // A draft KC (the S05.3a B.6 widening) is never served (Core reads status=active only), so the ladder never reaches it.
    const uncovered = graph.kcs.filter((k) => k.skill_key === null && (k.status ?? 'active') === 'active').map((k) => k.key).sort();
    const covered = [...new Set(planPacks().plan.map((p) => p.kcKey))].sort();
    expect(covered).toEqual(uncovered);
  });

  it('refuses a seed directory with a broken pack, naming every failure', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'packs-'));
    writeFileSync(path.join(dir, 'x.json'), JSON.stringify({
      contract: 'tutor-pack.v1', kc_key: 'money.percent-intro', demand_pattern: 'kc_without_catalog_content', source: 'hand_authored',
      packs: [pack([MCQ, NUM, TF, SORT], { tier: 2 }), pack([MCQ, NUM, TF, SORT], { tier: 2 })],
    }));
    const { failures } = planPacks(dir);
    expect(failures.join('\n')).toContain('below the knowledge component\'s tier_min 3');
    expect(failures.join('\n')).toContain('a second pack for the same skill, tier and locale');
    expect(failures.join('\n')).toContain('is used by another pack');
  });

  it('refuses a KC that is not in the graph and a file targeting two things', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'packs-'));
    writeFileSync(path.join(dir, 'a.json'), JSON.stringify({ contract: 'tutor-pack.v1', kc_key: 'money.invented', demand_pattern: 'kc_without_catalog_content', source: 'hand_authored', packs: [GOOD] }));
    writeFileSync(path.join(dir, 'b.json'), JSON.stringify({ contract: 'tutor-pack.v1', kc_key: 'money.percent-intro', skill_key: 'a/b', demand_pattern: 'kc_without_catalog_content', source: 'hand_authored', packs: [GOOD] }));
    const failures = planPacks(dir).failures.join('\n');
    expect(failures).toContain('not in the knowledge-component graph');
    expect(failures).toContain('exactly one of kc_key or skill_key');
  });
});

describe('C.6 the tutor-pack.v1 contract (each rule proven to bite)', () => {
  it('accepts a well-formed pack', () => {
    expect(validatePack(GOOD)).toEqual({ ok: true, failures: [], riskSignals: [] });
  });

  it.each([
    ['too few segments', pack([MCQ, NUM, TF]), 'carries 4-12 segments'],
    ['a key that is wrong', pack([{ ...MCQ, answer: { correct_option_id: 'z' } }, NUM, TF, SORT]), 'exactly once'],
    ['a wrong option with no teaching rationale', pack([{ ...MCQ, payload: { options: [{ id: 'a', text_md: 'Half' }, { id: 'b', text_md: 'A quarter' }] } }, NUM, TF, SORT]), 'teaching rationale'],
    ['a number key that does not re-execute', pack([MCQ, { ...NUM, answer: { value: 5 } }, TF, SORT]), 'own key scores'],
    ['percentages at tier 1', pack([MCQ, { ...NUM, prompt_md: 'What is 10% of 20 coins?' }, TF, SORT], { tier: 1 }), 'tier 1 vocabulary'],
    ['a duplicate segment id', pack([MCQ, { ...NUM, id: MCQ.id }, TF, SORT]), 'duplicate id'],
    ['an id outside the pack- namespace', pack([{ ...MCQ, id: 'seg-1' }, NUM, TF, SORT]), 'pack-'],
    ['a type outside the pack allowlist', pack([{ ...MCQ, type: 'coin_count' }, NUM, TF, SORT]), 'type'],
    ['no explanation', pack([{ ...MCQ, explanation_md: undefined }, NUM, TF, SORT]), 'explanation_md'],
    ['a link', pack([{ ...MCQ, prompt_md: 'See https://example.com for help' }, NUM, TF, SORT]), 'link'],
    ['a phone number', pack([{ ...MCQ, explanation_md: 'Call 555 123 4567 8.' }, NUM, TF, SORT]), 'phone'],
    ['a malformed sort payload', pack([MCQ, NUM, TF, { ...SORT, payload: { buckets: [{ id: 'x', label: 'X' }], items: SORT.payload.items } }]), 'payload'],
    ['English in an es-MX pack', pack([MCQ, NUM, TF, SORT], { locale: 'es-MX' }), 'reads as another language'],
    ['an under-declared sensitive topic', pack([{ ...MCQ, prompt_md: 'Her parents are divorced. Which is more: half or a quarter of 12 coins?' }, NUM, TF, SORT]), 'must declare risk_category "sensitive"'],
  ])('refuses %s', (_name, candidate, expected) => {
    const result = validatePack(candidate);
    expect(result.ok).toBe(false);
    expect(result.failures.join('\n')).toContain(expected);
  });

  it('accepts a sensitive topic that is declared sensitive', () => {
    const sensitive = pack([{ ...MCQ, prompt_md: 'Her parents are divorced. Which is more: half or a quarter of 12 coins?' }, NUM, TF, SORT], { risk_category: 'sensitive' });
    expect(validatePack(sensitive)).toMatchObject({ ok: true, riskSignals: ['family_conflict'] });
  });

  it('enforces tier_min when the target is known', () => {
    expect(validatePack(GOOD, { tierMin: 3 }).failures.join()).toContain('tier_min 3');
    expect(validatePack(GOOD, { tierMin: 2 }).ok).toBe(true);
  });
});

describe('C.6 the stored form', () => {
  it('strips every key from the learner-visible segments and keeps them beside', () => {
    const stored = toStoredPack(GOOD);
    expect(JSON.stringify(stored.segments)).not.toContain('correct_option_id');
    expect(JSON.stringify(stored.segments)).not.toContain('"answer"');
    expect(stored.answers[MCQ.id]).toEqual({ correct_option_id: 'a' });
  });

  it('round-trips to the authored form, so the contract re-runs on what is stored', () => {
    const stored = toStoredPack(GOOD);
    const back = fromStoredPack(stored, { tier: 2, locale: 'en-US', risk_category: 'standard' });
    expect(back).not.toBeNull();
    expect(validatePack(back!).ok).toBe(true);
    expect(fromStoredPack({ nope: true }, { tier: 2, locale: 'en-US', risk_category: 'standard' })).toBeNull();
  });

  it('hashes canonically: key order does not matter, content does', () => {
    const stored = toStoredPack(GOOD);
    const reordered = JSON.parse(canonicalJson(stored)) as typeof stored;
    expect(packContentHash(reordered)).toBe(packContentHash(stored));
    expect(packContentHash(toStoredPack(pack([{ ...MCQ, prompt_md: 'Changed?' }, NUM, TF, SORT])))).not.toBe(packContentHash(stored));
  });
});

describe('C.6 the human release gate (setTutorPackStatus)', () => {
  const ACTOR = '22222222-2222-4222-8222-222222222222';
  const PACK_ID = '77777777-7777-4777-8777-777777777777';
  const row = (over: Partial<TutorPackAdminRow> = {}): TutorPackAdminRow => {
    const stored = toStoredPack(GOOD);
    return {
      id: PACK_ID, skill_key: 'kc:money.fraction-of-amount', kc_key: 'money.fraction-of-amount', tier: 2, locale: 'en-US',
      pack: stored, status: 'review', pack_version: 1, content_hash: packContentHash(stored), source: 'hand_authored',
      demand_pattern: 'kc_without_catalog_content', risk_category: 'standard', released_by: null, released_at: null,
      validated_at: null, updated_at: '2026-09-24T00:00:00Z', ...over,
    };
  };

  function stubPacks(current: TutorPackAdminRow, calls: { url: string; method: string; body?: string }[], tierMin = 2) {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push({ url, method, body: init?.body as string | undefined });
      if (url.includes('/rest/v1/tutor_packs') && method === 'GET') return Promise.resolve(jsonResponse(200, [current]));
      if (url.includes('/rest/v1/rpc/set_tutor_pack_status')) {
        const args = JSON.parse(String(init?.body)) as { p_from: string; p_to: string; p_actor: string; p_content_hash: string | null };
        // The database's own guard: a stale `from` changes nothing (NULL).
        if (args.p_from !== current.status || args.p_from === args.p_to) return Promise.resolve(jsonResponse(200, null));
        const published = args.p_to === 'published';
        return Promise.resolve(jsonResponse(200, {
          ...current, status: args.p_to,
          ...(published ? { released_by: args.p_actor, content_hash: args.p_content_hash, released_at: '2026-09-27T00:00:00Z' } : {}),
        }));
      }
      if (url.includes('/rest/v1/kc?')) return Promise.resolve(jsonResponse(200, [{ tier_min: tierMin }]));
      if (url.includes('/rest/v1/audit_logs')) return Promise.resolve(new Response(null, { status: 201 }));
      throw new Error(`unexpected ${method} ${url}`);
    }));
  }
  afterEach(() => vi.unstubAllGlobals());

  it('publishes after re-running the contract on the STORED content, naming the human who released it', async () => {
    const calls: { url: string; method: string; body?: string }[] = [];
    stubPacks(row(), calls);
    const result = await setTutorPackStatus({ packId: PACK_ID, status: 'published', actorId: ACTOR });
    expect(result).toMatchObject({ ok: true, row: { status: 'published', released_by: ACTOR } });
    // G.3: one call records the decision AND its audit row (set_tutor_pack_status);
    // the stale-decision guard is the `from` Core read.
    const rpc = calls.find((c) => c.url.includes('/rpc/set_tutor_pack_status'))!;
    expect(JSON.parse(rpc.body!)).toMatchObject({ p_pack_id: PACK_ID, p_from: 'review', p_to: 'published', p_actor: ACTOR, p_content_hash: packContentHash(toStoredPack(GOOD)) });
    expect(calls.some((c) => c.url.includes('audit_logs'))).toBe(false);
  });

  it('refuses to publish stored content that breaks the contract', async () => {
    const broken = toStoredPack(pack([{ ...MCQ, answer: { correct_option_id: 'z' } }, NUM, TF, SORT]));
    const calls: { url: string; method: string; body?: string }[] = [];
    stubPacks(row({ pack: broken, content_hash: packContentHash(broken) }), calls);
    const result = await setTutorPackStatus({ packId: PACK_ID, status: 'published', actorId: ACTOR });
    expect(result).toMatchObject({ ok: false, code: 'invalid' });
    expect(calls.some((c) => c.url.includes('/rpc/set_tutor_pack_status'))).toBe(false);
  });

  it('refuses to publish content that no longer matches its recorded hash', async () => {
    const calls: { url: string; method: string; body?: string }[] = [];
    stubPacks(row({ content_hash: 'f'.repeat(64) }), calls);
    const result = await setTutorPackStatus({ packId: PACK_ID, status: 'published', actorId: ACTOR });
    expect(result).toMatchObject({ ok: false, code: 'invalid' });
    expect((result as { failures: string[] }).failures.join()).toContain('recorded hash');
  });

  it('refuses a pack below the live KC tier_min', async () => {
    const calls: { url: string; method: string; body?: string }[] = [];
    stubPacks(row(), calls, 3);
    expect(await setTutorPackStatus({ packId: PACK_ID, status: 'published', actorId: ACTOR })).toMatchObject({ ok: false, code: 'invalid' });
  });

  it('archives without re-validation, and a repeated decision is a no-op', async () => {
    const calls: { url: string; method: string; body?: string }[] = [];
    stubPacks(row({ status: 'published' }), calls);
    expect((await setTutorPackStatus({ packId: PACK_ID, status: 'archived', actorId: ACTOR })).ok).toBe(true);
    expect(await setTutorPackStatus({ packId: PACK_ID, status: 'published', actorId: ACTOR })).toMatchObject({ ok: false, code: 'unchanged' });
  });

  it('reports unavailable, never success, when the decision cannot be confirmed', async () => {
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/rest/v1/tutor_packs')) return Promise.resolve(jsonResponse(200, [row({ status: 'published' })]));
      if (url.includes('/rest/v1/rpc/set_tutor_pack_status')) return Promise.resolve(jsonResponse(500, { code: 'XX000', message: 'audit store unavailable' }));
      throw new Error(`unexpected ${init?.method ?? 'GET'} ${url}`);
    }));
    expect(await setTutorPackStatus({ packId: PACK_ID, status: 'archived', actorId: ACTOR })).toMatchObject({ ok: false, code: 'unavailable' });
  });
});
