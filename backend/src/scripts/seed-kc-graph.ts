#!/usr/bin/env node
/*
 * `npm run seed:kc` — loads the Tutor v3 knowledge-component graph
 * (database/seeds/kc_graph.v1.json) into Vault via the service role.
 *
 * Idempotent by construction: KCs upsert by `key`, misconceptions by
 * (kc_id, code), edges by their primary key with duplicates ignored. Running
 * it twice changes nothing the second time. It REFUSES a cyclic seed before
 * writing anything — the prerequisite graph is a DAG and the frontier
 * computation in sessionPlan.ts assumes it, so a cycle here would surface as
 * "no KC is ever available" for a learner, far from its cause.
 *
 * Operator tool, not CI (needs credentials), same posture as placement:verify:
 *   SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… npm run seed:kc
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { z } from 'zod';
import { serviceRest } from '../services/supabaseRest.js';
import { resolveSkill } from '../services/tutorLadder.js';

const Localized = z.record(z.enum(['en-US', 'es-MX', 'pt-BR']), z.string().min(1));

const SeedSchema = z.object({
  version: z.literal(1),
  kcs: z.array(
    z.object({
      key: z.string().regex(/^[a-z0-9][a-z0-9_.-]{2,95}$/),
      strand: z.enum(['money_math', 'entrepreneurship']),
      tier_min: z.number().int().min(1).max(3),
      p_l0: z.number().min(0).max(1),
      p_t: z.number().min(0).max(1),
      p_g: z.number().min(0).max(0.3),
      p_s: z.number().min(0).max(0.1),
      title: Localized,
      objective: Localized,
      skill_key: z.string().max(128).nullable().optional(),
    }),
  ),
  edges: z.array(z.tuple([z.string(), z.string()])),
  misconceptions: z.array(
    z.object({
      kc: z.string(),
      code: z.string().regex(/^[a-z0-9][a-z0-9_.-]{2,95}$/),
      description: Localized,
      remediation_hint: Localized,
      distractor_patterns: z.record(z.string(), z.unknown()).default({}),
    }),
  ),
});

function assertAcyclic(keys: Set<string>, edges: Array<[string, string]>): void {
  const adj = new Map<string, string[]>();
  for (const [from, to] of edges) {
    if (!keys.has(from)) throw new Error(`edge references unknown KC "${from}"`);
    if (!keys.has(to)) throw new Error(`edge references unknown KC "${to}"`);
    adj.set(from, [...(adj.get(from) ?? []), to]);
  }
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (node: string, trail: string[]): void => {
    const s = state.get(node);
    if (s === 'done') return;
    if (s === 'visiting') throw new Error(`cycle detected: ${[...trail, node].join(' -> ')}`);
    state.set(node, 'visiting');
    for (const next of adj.get(node) ?? []) visit(next, [...trail, node]);
    state.set(node, 'done');
  };
  for (const key of keys) visit(key, []);
}

async function main(): Promise<void> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const seedPath = path.resolve(here, '../../../database/seeds/kc_graph.v1.json');
  const seed = SeedSchema.parse(JSON.parse(readFileSync(seedPath, 'utf8')));

  const keys = new Set(seed.kcs.map((k) => k.key));
  if (keys.size !== seed.kcs.length) throw new Error('duplicate KC keys in seed');
  assertAcyclic(keys, seed.edges);
  for (const m of seed.misconceptions) {
    if (!keys.has(m.kc)) throw new Error(`misconception "${m.code}" references unknown KC "${m.kc}"`);
  }

  // 1) Upsert the KC catalog by key.
  const kcRows = seed.kcs.map((k) => ({
    key: k.key,
    strand: k.strand,
    tier_min: k.tier_min,
    p_l0: k.p_l0,
    p_t: k.p_t,
    p_g: k.p_g,
    p_s: k.p_s,
    title: k.title,
    objective: k.objective,
    skill_key: k.skill_key ?? null,
    status: 'active',
  }));
  const kcRes = await serviceRest<unknown>('/kc?on_conflict=key', {
    method: 'POST',
    headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
    body: JSON.stringify(kcRows),
  });
  if (kcRes === null) throw new Error('kc upsert failed — is the 0052 migration applied?');

  // 2) Resolve key -> id.
  const idRows = await serviceRest<Array<{ id: string; key: string }>>('/kc?select=id,key&limit=1000');
  if (!idRows) throw new Error('could not read back kc ids');
  const idByKey = new Map(idRows.map((r) => [r.key, r.id]));
  for (const key of keys) {
    if (!idByKey.has(key)) throw new Error(`kc "${key}" missing after upsert`);
  }

  // 3) Edges — insert, ignore duplicates. (Removed edges are an authoring
  // pass with its own review, never a silent delete from a seed run.)
  const edgeRows = seed.edges.map(([from, to]) => ({
    prerequisite_kc_id: idByKey.get(from),
    dependent_kc_id: idByKey.get(to),
  }));
  const edgeRes = await serviceRest<unknown>('/kc_edge?on_conflict=prerequisite_kc_id,dependent_kc_id', {
    method: 'POST',
    headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' },
    body: JSON.stringify(edgeRows),
  });
  if (edgeRes === null) throw new Error('kc_edge insert failed');

  // 4) Misconceptions — upsert by (kc_id, code).
  const misRows = seed.misconceptions.map((m) => ({
    kc_id: idByKey.get(m.kc),
    code: m.code,
    description: m.description,
    remediation_hint: m.remediation_hint,
    distractor_patterns: m.distractor_patterns,
  }));
  const misRes = await serviceRest<unknown>('/misconception?on_conflict=kc_id,code', {
    method: 'POST',
    headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
    body: JSON.stringify(misRows),
  });
  if (misRes === null) throw new Error('misconception upsert failed');

  console.log(
    `seed:kc OK — ${seed.kcs.length} KCs, ${seed.edges.length} edges, ${seed.misconceptions.length} misconceptions (idempotent upsert)`,
  );

  await auditContentBridge(seed);
}

/**
 * THE BRIDGE AUDIT — does each mapped KC actually reach published content?
 *
 * `kc.skill_key` is the ONLY thing connecting the knowledge graph to the
 * catalog. While it was null on all 28 rows the tutor could not reach tier 1
 * or tier 2 for anything, so EVERY activity fell through to live generation —
 * the most fragile rung of the ladder — and the first activity of the first
 * real session failed in front of the owner with "that activity is no longer
 * ready". A null here is a deliberate, readable gap. A WRONG value is worse
 * than null: the ladder tries, misses, falls through to generation anyway, and
 * the mapping reads as done while carrying nothing.
 *
 * So this checks the thing that actually matters, in two steps rather than
 * one. `resolveSkill` proves the course and topic exist and are PUBLISHED.
 * That is not enough: a topic can resolve perfectly and still hold zero
 * published lessons, and `serveFromCatalog` would then return null on every
 * request — a bridge that exists and carries no traffic, which is exactly the
 * silent-miss shape this whole defect had. So the lesson count is checked too.
 *
 * It runs AFTER the upserts because they are idempotent: a red audit is a
 * report about data that is already in place, and the fix is to correct the
 * mapping and run this again.
 */
async function auditContentBridge(seed: z.infer<typeof SeedSchema>): Promise<void> {
  const mapped = seed.kcs.filter((k) => k.skill_key);
  const unmapped = seed.kcs.length - mapped.length;
  console.log(`\nContent bridge — ${mapped.length} mapped, ${unmapped} deliberately unmapped:`);

  const broken: string[] = [];
  for (const kc of mapped) {
    const skillKey = kc.skill_key as string;
    const skill = await resolveSkill(skillKey);
    if (!skill) {
      broken.push(`${kc.key} -> ${skillKey} (no published course/topic)`);
      console.log(`  DEAD  ${kc.key} -> ${skillKey}`);
      continue;
    }
    const lessons = await serviceRest<{ id: string }[]>(
      `/lessons?topic_id=eq.${encodeURIComponent(skill.topicId)}&status=eq.published&select=id`,
    );
    const count = lessons?.length ?? 0;
    if (count === 0) {
      broken.push(`${kc.key} -> ${skillKey} (topic resolves but has 0 published lessons)`);
      console.log(`  EMPTY ${kc.key} -> ${skillKey}`);
      continue;
    }
    console.log(`  ok    ${kc.key} -> ${skillKey} (${count} published lesson(s))`);
  }

  /*
   * The unmapped KCs are a standing authoring task, not an error, so the
   * candidates are printed whenever any exist — not only when something
   * BREAKS. Five knowledge components have no published topic that teaches
   * them and therefore fall through to live generation on every request; the
   * list below is what someone would need to close that, and keeping it behind
   * a failure meant it was only ever seen by accident.
   */
  if (unmapped > 0 || broken.length > 0) {
    await suggestAlternatives(new Set(mapped.map((k) => k.skill_key as string)));
  }

  if (broken.length > 0) {
    throw new Error(
      `${broken.length} of ${mapped.length} content bridges do not carry traffic:\n  ${broken.join('\n  ')}`,
    );
  }
  console.log(`\nbridge OK — all ${mapped.length} mapped KCs reach published lessons.`);
}

main().catch((err) => {
  console.error(`seed:kc FAILED: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});

/**
 * WHAT TO REPOINT A BROKEN BRIDGE AT.
 *
 * Without this the operator is guessing: the curriculum YAML in the repo lists
 * every topic an author ever wrote, but the 2026-08-21 prune archived 771
 * lessons, so a slug can be perfectly real, perfectly published, and hold
 * nothing. Two mappings in the first run of this audit were exactly that, and
 * finding replacements by editing the seed and re-running is a two-minute
 * round trip per guess.
 *
 * So on failure the tool prints GROUND TRUTH instead: topics that actually
 * have published lessons right now, ranked by how many, minus the ones already
 * spoken for. Counting from the lessons side is what makes it one pair of
 * queries rather than one per topic — 328 round trips would be its own reason
 * not to run it.
 *
 * This is a hint, never an answer: it cannot know which topic TEACHES the
 * knowledge component. The audit above is still the thing that decides, and it
 * re-checks whatever is chosen through the same `resolveSkill` path the tutor
 * uses at runtime.
 */
async function suggestAlternatives(alreadyMapped: Set<string>): Promise<void> {
  /*
   * EVERY FAILURE HERE IS ANNOUNCED. The first version of this helper ended
   * two of its paths with a bare `return` on a null query result, and that is
   * precisely what happened on its first real run: the `id=in.(...)` list of
   * ~200 UUIDs made a URL long enough for PostgREST to reject, the result was
   * null, and the function returned having printed NOTHING — a diagnostic that
   * failed silently while diagnosing a defect whose whole nature was failing
   * silently (§1.14). Hence the course-scoped query below instead of a giant
   * id list, and hence a printed reason on every path that gives up.
   */
  const courses = await serviceRest<{ id: string }[]>(
    '/courses?slug=eq.financial-education&status=eq.published&select=id&limit=1',
  );
  const courseId = courses?.[0]?.id;
  if (!courseId) {
    console.log('\n(cannot suggest: the financial-education course did not resolve)');
    return;
  }

  const topics = await serviceRest<{ id: string; slug: string }[]>(
    `/topics?status=eq.published&select=id,slug,sagas!inner(adventures!inner(course_id))` +
      `&sagas.adventures.course_id=eq.${encodeURIComponent(courseId)}&limit=2000`,
  );
  if (!topics || topics.length === 0) {
    console.log('\n(cannot suggest: no published topics came back for the course)');
    return;
  }

  const lessons = await serviceRest<{ topic_id: string }[]>(
    '/lessons?status=eq.published&select=topic_id&limit=5000',
  );
  if (!lessons || lessons.length === 0) {
    console.log('\n(cannot suggest: no published lessons came back)');
    return;
  }

  const perTopic = new Map<string, number>();
  for (const l of lessons) perTopic.set(l.topic_id, (perTopic.get(l.topic_id) ?? 0) + 1);

  const free = topics
    .map((t) => ({ slug: t.slug, count: perTopic.get(t.id) ?? 0 }))
    .filter((t) => t.count > 0 && !alreadyMapped.has(`financial-education/${t.slug}`))
    .sort((a, b) => b.count - a.count);

  console.log(
    `\n${topics.length} published topics in the course; ${free.length} have lessons and are unmapped:`,
  );
  for (const t of free.slice(0, 60)) console.log(`  ${String(t.count).padStart(3)}  ${t.slug}`);
  if (free.length > 60) console.log(`  … and ${free.length - 60} more`);
}
