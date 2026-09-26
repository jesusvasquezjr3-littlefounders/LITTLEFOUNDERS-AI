#!/usr/bin/env node
/*
 * `npm run seed:kc` — loads the Tutor v3 knowledge-component graph
 * (database/seeds/kc_graph.v1.json) into Vault via the service role, then
 * the B.6 topic → KC map (database/seeds/kc_topic_map.v1.json) into
 * topic_knowledge_components. Order of operations for the S05.3a graph:
 * apply the B.6 data-layer and kc_strand_widening migrations first; the new
 * KCs load as `draft` and change nothing the Mentor serves until activated.
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
 *
 * The content-bridge audit this runs at the end
 * (services/contentBridgeAudit.ts) also runs on its own, against whatever is
 * CURRENTLY live rather than this seed file — see `npm run
 * audit:content-bridge` (scripts/audit-content-bridge.ts) and
 * `.github/workflows/tutor-content-bridge.yml`.
 *
 * `main()` runs only when THIS FILE is the process entrypoint (see the guard
 * below, `verify-placement.ts`'s own established idiom in this same
 * directory) — never merely because something imported this module. Found
 * live during the per-KC content-pools authoring pass (kc.skill_key mapping
 * coverage, 2026-09-01): a standalone verification script imported this file
 * ONLY for its exported pure helpers (`SeedSchema`, `assertAcyclic`,
 * `assertTierOrder`), to validate an edited seed against production
 * read-only — and the bare import ALSO re-ran the real upsert against
 * production as an unguarded side effect, merely because evaluating this
 * module's top level unconditionally called `main()`. The write happened to
 * be idempotent and land the already-reviewed, correct seed content, so no
 * harm followed — but the hazard is real and this module invites exactly the
 * import that triggers it, since `seedKcGraph.test.ts` already imports these
 * same helpers on every `npm test` run (safe only because the test env's
 * `SUPABASE_URL` is the unroutable `http://supabase.test` sentinel — a
 * property of the test environment, not of this file).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { z } from 'zod';
import { serviceRest } from '../services/supabaseRest.js';
import { auditContentBridge } from '../services/contentBridgeAudit.js';
import { KcTopicMapSchema, deriveTopicKcLinks, summarizeKcTopicMap, validateKcTopicMap } from '../services/pathway/kcTopicMap.js';
import { seedTopicKcLinks } from '../services/pathway/topicKcSeed.js';

const Localized = z.record(z.enum(['en-US', 'es-MX', 'pt-BR']), z.string().min(1));

/**
 * The KC strands. `money_life` and `investing` arrived with the B.6 topic map
 * (S05.3a) and need the kc_strand_widening migration before this seed runs.
 */
export const KC_STRANDS = ['money_math', 'entrepreneurship', 'money_life', 'investing'] as const;

export const SeedSchema = z.object({
  $comment: z.string().optional(),
  version: z.literal(1),
  kcs: z.array(
    z.object({
      key: z.string().regex(/^[a-z0-9][a-z0-9_.-]{2,95}$/),
      strand: z.enum(KC_STRANDS),
      /**
       * `draft` KCs are catalogued but invisible to the Mentor and to clients
       * (getActiveKcs and the kc RLS policy read only `active`). The S05.3a
       * additions stay draft until the owner accepts the B.6 pathway policy
       * (OD-22); activation is an edit here, never a manual SQL update, because
       * the next seed run would otherwise put a hand-activated row back.
       */
      status: z.enum(['draft', 'active']).default('active'),
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

export function assertAcyclic(keys: Set<string>, edges: Array<[string, string]>): void {
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

/**
 * A prerequisite can never require a HIGHER tier than the KC it unlocks.
 *
 * Found by adversarial review, round 52 (2026-08-30, HIGH): the edge
 * `money.savings-plan-math` (tier 2) -> `biz.saving-goal` (tier 1) survived
 * `assertAcyclic` (it is not a cycle) and every other gate, but
 * `sessionPlan.ts`'s `buildSessionPlan` filters to `tier_min <= tier` BEFORE
 * walking the graph — so for a tier-1 learner the prerequisite is invisible
 * and the edge silently does nothing, while for a tier-2/3 learner it gates
 * a genuinely SIMPLER concept ("set a goal and decide how much to keep
 * aside") behind a harder, later one ("work out how many weeks it takes"),
 * inverting the intended teaching order either way. Every edge in this graph
 * is authored to teach easier ideas before harder ones; a prerequisite that
 * needs a HIGHER tier than its dependent is never intentional, so this is an
 * unconditional refusal, the same posture `assertAcyclic` already takes for
 * a cycle.
 */
export function assertTierOrder(kcs: readonly { key: string; tier_min: number }[], edges: Array<[string, string]>): void {
  const tierByKey = new Map(kcs.map((k) => [k.key, k.tier_min]));
  for (const [from, to] of edges) {
    const prereqTier = tierByKey.get(from);
    const dependentTier = tierByKey.get(to);
    if (prereqTier !== undefined && dependentTier !== undefined && prereqTier > dependentTier) {
      throw new Error(
        `tier inversion: "${from}" (tier ${prereqTier}) is a prerequisite for "${to}" (tier ${dependentTier}) — ` +
          'a prerequisite can never require a HIGHER tier than the KC it unlocks',
      );
    }
  }
}

/**
 * A draft KC can never be a prerequisite of an active one (B.6, S05.3a).
 *
 * The Mentor's planner drops edges whose ends are not both active, so today a
 * draft prerequisite is inert. The day the drafts are activated, though, such
 * an edge would suddenly RE-GATE an active KC that learners are already
 * working on: its prerequisite would start at the prior (p_l0) and push it off
 * every learner's frontier. Activation must only ADD reachable ground, so the
 * seed refuses the edge up front instead of leaving it for activation day.
 */
export function assertDraftsDoNotGateActive(
  kcs: readonly { key: string; status: 'draft' | 'active' }[],
  edges: Array<[string, string]>,
): void {
  const statusByKey = new Map(kcs.map((k) => [k.key, k.status]));
  for (const [from, to] of edges) {
    if (statusByKey.get(from) === 'draft' && statusByKey.get(to) === 'active') {
      throw new Error(`draft KC "${from}" would gate active KC "${to}" on activation — point new edges only into new KCs`);
    }
  }
}

export function readSeedFiles(): { seed: z.infer<typeof SeedSchema>; map: ReturnType<typeof KcTopicMapSchema.parse> } {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const seed = SeedSchema.parse(JSON.parse(readFileSync(path.resolve(here, '../../../database/seeds/kc_graph.v1.json'), 'utf8')));
  const map = KcTopicMapSchema.parse(JSON.parse(readFileSync(path.resolve(here, '../../../database/seeds/kc_topic_map.v1.json'), 'utf8')));
  return { seed, map };
}

async function main(): Promise<void> {
  const { seed, map } = readSeedFiles();

  const keys = new Set(seed.kcs.map((k) => k.key));
  if (keys.size !== seed.kcs.length) throw new Error('duplicate KC keys in seed');
  assertAcyclic(keys, seed.edges);
  assertTierOrder(seed.kcs, seed.edges);
  assertDraftsDoNotGateActive(seed.kcs, seed.edges);
  for (const m of seed.misconceptions) {
    if (!keys.has(m.kc)) throw new Error(`misconception "${m.code}" references unknown KC "${m.kc}"`);
  }
  // The course map must agree with the graph BEFORE anything is written.
  const mapIssues = validateKcTopicMap(map, seed.kcs);
  if (mapIssues.length > 0) {
    throw new Error(`kc_topic_map.v1.json disagrees with the graph: ${mapIssues.map((i) => `${i.code}: ${i.message}`).join('; ')}`);
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
    status: k.status,
  }));
  const kcRes = await serviceRest<unknown>('/kc?on_conflict=key', {
    method: 'POST',
    headers: { Prefer: 'return=minimal,resolution=merge-duplicates' },
    body: JSON.stringify(kcRows),
  });
  if (kcRes === null) throw new Error('kc upsert failed — are the 0052 migration and the B.6 kc_strand_widening migration applied?');

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
    `seed:kc OK — ${seed.kcs.length} KCs (${seed.kcs.filter((k) => k.status === 'active').length} active), ` +
      `${seed.edges.length} edges, ${seed.misconceptions.length} misconceptions (idempotent upsert)`,
  );

  // 5) The B.6 topic → KC map (topic_knowledge_components, 0123). Topics the
  // live catalog does not have are reported, not invented; published topics
  // the map does not cover are the coverage failure this step exists to find.
  const summary = summarizeKcTopicMap(map);
  const report = await seedTopicKcLinks(serviceRest, deriveTopicKcLinks(map), idByKey, map.version);
  console.log(
    `seed:kc topic map — ${summary.topics} topics in the map (${summary.teachingTopics} teaching, ${summary.reviewTopics} review), ` +
      `${report.written} links written, ${report.missingTopics.length} map topics not in this catalog, ${report.staleLinks} stale links kept`,
  );
  if (report.unmappedPublished.length > 0) {
    console.error(
      `::error::${report.unmappedPublished.length} published topic(s) have no KC mapping: ${report.unmappedPublished.slice(0, 20).join(', ')}`,
    );
    process.exitCode = 1;
  }

  // THE BRIDGE AUDIT — moved to services/contentBridgeAudit.ts (RUNBOOK.md
  // Round 105) so it can ALSO run standalone, on a schedule, against whatever
  // is currently live in Vault (`npm run audit:content-bridge`), independent
  // of a human remembering to re-seed. It runs AFTER the upserts above
  // because they are idempotent: a red audit is a report about data that is
  // already in place, and the fix is to correct the mapping and run this
  // again.
  // Only ACTIVE KCs have a Mentor bridge to audit; drafts are catalogued, not served.
  await auditContentBridge(seed.kcs.filter((k) => k.status === 'active').map((k) => ({ key: k.key, skill_key: k.skill_key ?? null })));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => {
    console.error(`::error::seed:kc FAILED: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  });
}
