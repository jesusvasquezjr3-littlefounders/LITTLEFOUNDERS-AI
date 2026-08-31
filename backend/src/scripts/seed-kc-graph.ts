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
 *
 * The content-bridge audit this runs at the end
 * (services/contentBridgeAudit.ts) also runs on its own, against whatever is
 * CURRENTLY live rather than this seed file — see `npm run
 * audit:content-bridge` (scripts/audit-content-bridge.ts) and
 * `.github/workflows/tutor-content-bridge.yml`.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { z } from 'zod';
import { serviceRest } from '../services/supabaseRest.js';
import { auditContentBridge } from '../services/contentBridgeAudit.js';

const Localized = z.record(z.enum(['en-US', 'es-MX', 'pt-BR']), z.string().min(1));

export const SeedSchema = z.object({
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

async function main(): Promise<void> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const seedPath = path.resolve(here, '../../../database/seeds/kc_graph.v1.json');
  const seed = SeedSchema.parse(JSON.parse(readFileSync(seedPath, 'utf8')));

  const keys = new Set(seed.kcs.map((k) => k.key));
  if (keys.size !== seed.kcs.length) throw new Error('duplicate KC keys in seed');
  assertAcyclic(keys, seed.edges);
  assertTierOrder(seed.kcs, seed.edges);
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

  // THE BRIDGE AUDIT — moved to services/contentBridgeAudit.ts (RUNBOOK.md
  // Round 101) so it can ALSO run standalone, on a schedule, against whatever
  // is currently live in Vault (`npm run audit:content-bridge`), independent
  // of a human remembering to re-seed. It runs AFTER the upserts above
  // because they are idempotent: a red audit is a report about data that is
  // already in place, and the fix is to correct the mapping and run this
  // again.
  await auditContentBridge(seed.kcs.map((k) => ({ key: k.key, skill_key: k.skill_key ?? null })));
}

main().catch((err) => {
  console.error(`::error::seed:kc FAILED: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
