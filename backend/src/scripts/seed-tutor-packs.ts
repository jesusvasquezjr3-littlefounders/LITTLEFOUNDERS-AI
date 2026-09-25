#!/usr/bin/env node
/*
 * `npm run seed:tutor-packs` — loads the curated activity packs (C.6) from
 * database/seeds/tutor_packs/*.json into `tutor_packs`, as `review`.
 *
 *   --check   validate every pack against the tutor-pack.v1 contract and the
 *             knowledge-component graph, print the plan, write nothing (no
 *             credentials needed; this is what the tests and CI run)
 *   (none)    the same validation, then upsert by (skill_key, tier, locale):
 *             an unchanged pack (same content hash) is left alone; a changed
 *             one gets its content replaced, its version bumped and its
 *             status RESET to `review` with the release cleared — a human
 *             re-publishes it. A published pack is never silently changed.
 *
 * It never publishes. Publishing is a staff decision in the console
 * (`POST /admin/tutor/packs/:id/status`), which re-runs the contract on the
 * stored content and records who released it.
 *
 * Operator tool (service role), same posture as seed:kc:
 *   SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… npm run seed:tutor-packs
 *
 * Zero spend: the packs are hand-authored files; nothing here calls a model.
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { serviceRest } from '../services/supabaseRest.js';
import {
  packContentHash,
  packSkillKey,
  PackSourceFileSchema,
  toStoredPack,
  validatePack,
  type PackSourceFile,
  type StoredPack,
} from '../services/tutorPacks.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PACK_DIR = path.resolve(HERE, '../../../database/seeds/tutor_packs');
export const KC_GRAPH = path.resolve(HERE, '../../../database/seeds/kc_graph.v1.json');

export interface PlannedPack {
  file: string;
  skillKey: string;
  kcKey: string | null;
  tier: number;
  locale: string;
  riskCategory: 'standard' | 'sensitive';
  demandPattern: PackSourceFile['demand_pattern'];
  source: PackSourceFile['source'];
  stored: StoredPack;
  contentHash: string;
  segments: number;
}

/**
 * Reads and validates every pack source file. Returns the plan, or the list
 * of every failure found (all of them, not the first).
 */
export function planPacks(dir = PACK_DIR, graphPath = KC_GRAPH): { plan: PlannedPack[]; failures: string[] } {
  const graph = JSON.parse(readFileSync(graphPath, 'utf8')) as { kcs: { key: string; tier_min: number }[] };
  const tierMin = new Map(graph.kcs.map((k) => [k.key, k.tier_min]));
  const failures: string[] = [];
  const plan: PlannedPack[] = [];
  const seenTargets = new Set<string>();
  const seenIds = new Set<string>();

  for (const name of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(path.join(dir, name), 'utf8'));
    } catch (error) {
      failures.push(`${name}: not JSON (${error instanceof Error ? error.message : String(error)})`);
      continue;
    }
    const parsed = PackSourceFileSchema.safeParse(raw);
    if (!parsed.success) {
      failures.push(`${name}: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
      continue;
    }
    const file = parsed.data;
    if (file.kc_key !== undefined && !tierMin.has(file.kc_key)) {
      failures.push(`${name}: kc_key "${file.kc_key}" is not in the knowledge-component graph`);
      continue;
    }
    const skillKey = packSkillKey(file);
    for (const pack of file.packs) {
      const where = `${name} [tier ${pack.tier}, ${pack.locale}]`;
      const target = `${skillKey}|${pack.tier}|${pack.locale}`;
      if (seenTargets.has(target)) failures.push(`${where}: a second pack for the same skill, tier and locale`);
      seenTargets.add(target);
      const validation = validatePack(pack, { tierMin: file.kc_key !== undefined ? tierMin.get(file.kc_key) : null });
      for (const failure of validation.failures) failures.push(`${where}: ${failure}`);
      for (const segment of pack.segments as { id?: string }[]) {
        if (typeof segment.id !== 'string') continue;
        if (seenIds.has(segment.id)) failures.push(`${where}: segment id ${segment.id} is used by another pack`);
        seenIds.add(segment.id);
      }
      const stored = toStoredPack(pack);
      plan.push({
        file: name,
        skillKey,
        kcKey: file.kc_key ?? null,
        tier: pack.tier,
        locale: pack.locale,
        riskCategory: pack.risk_category,
        demandPattern: file.demand_pattern,
        source: file.source,
        stored,
        contentHash: packContentHash(stored),
        segments: pack.segments.length,
      });
    }
  }
  return { plan, failures };
}

interface ExistingRow {
  id: string;
  content_hash: string | null;
  pack_version: number;
  status: string;
}

async function load(plan: PlannedPack[]): Promise<{ inserted: number; updated: number; unchanged: number; failed: number }> {
  const totals = { inserted: 0, updated: 0, unchanged: 0, failed: 0 };
  for (const item of plan) {
    const existing = await serviceRest<ExistingRow[]>(
      `/tutor_packs?skill_key=eq.${encodeURIComponent(item.skillKey)}&tier=eq.${item.tier}&locale=eq.${encodeURIComponent(item.locale)}&select=id,content_hash,pack_version,status&limit=1`,
    );
    if (existing === null) {
      totals.failed += 1;
      console.error(`  ! ${item.skillKey} t${item.tier} ${item.locale}: could not read`);
      continue;
    }
    const row = existing[0];
    const content = {
      pack: item.stored,
      kc_key: item.kcKey,
      content_hash: item.contentHash,
      source: item.source,
      demand_pattern: item.demandPattern,
      risk_category: item.riskCategory,
    };
    if (!row) {
      const res = await serviceRest<unknown>('/tutor_packs', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ skill_key: item.skillKey, tier: item.tier, locale: item.locale, status: 'review', pack_version: 1, ...content }),
      });
      if (res === null) totals.failed += 1;
      else totals.inserted += 1;
      continue;
    }
    if (row.content_hash === item.contentHash) {
      totals.unchanged += 1;
      continue;
    }
    // Changed content goes back to review: a human re-publishes it.
    const res = await serviceRest<unknown>(`/tutor_packs?id=eq.${encodeURIComponent(row.id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        ...content,
        pack_version: row.pack_version + 1,
        status: 'review',
        released_by: null,
        released_at: null,
        validated_at: null,
        updated_at: new Date().toISOString(),
      }),
    });
    if (res === null) totals.failed += 1;
    else {
      totals.updated += 1;
      if (row.status === 'published') console.warn(`  ~ ${item.skillKey} t${item.tier} ${item.locale}: content changed, UNPUBLISHED for re-review`);
    }
  }
  return totals;
}

async function main(): Promise<void> {
  const check = process.argv.includes('--check');
  const { plan, failures } = planPacks();
  console.log(`Curated activity packs: ${plan.length} pack(s), ${plan.reduce((n, p) => n + p.segments, 0)} segment(s)`);
  for (const item of plan) {
    console.log(`  ${item.skillKey}  tier ${item.tier}  ${item.locale}  ${item.segments} segments  ${item.riskCategory}  ${item.contentHash.slice(0, 12)}`);
  }
  if (failures.length > 0) {
    console.error(`\n${failures.length} contract failure(s):`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  if (check) {
    console.log('\nOK: every pack meets tutor-pack.v1 (nothing written: --check).');
    return;
  }
  const totals = await load(plan);
  console.log(`\nLoaded as review: ${totals.inserted} new, ${totals.updated} changed (back to review), ${totals.unchanged} unchanged, ${totals.failed} failed.`);
  console.log('Publish each pack from the staff console after reading it (POST /admin/tutor/packs/:id/status).');
  if (totals.failed > 0) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
