#!/usr/bin/env node
// tutor:packs — Money Moments operator CLI (Oracle v1).
//
//   npm run tutor:packs -- --sync-situations            (free: YAML → Vault)
//   npm run tutor:packs -- --generate [--confirm]       (PAID: fill missing packs)
//
// Packs land as status='review' — publishing is a HUMAN flip (same blocking
// kid-safety gate as lessons, /AGENTS.md §1.9). Generation is idempotent by
// construction: an existing (situation, tier, locale) row is never re-paid.

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { loadSituations, generatePack, validatePack, type Situation } from '../tutor/moneyMoments.js';
import { vaultSelect, vaultUpsert } from '../vault/restClient.js';
import { UsageLedger } from '../providers/usage.js';
import { requireGenerationKeys } from '../env.js';
import type { ReadabilityLocale } from '../pipeline/readability.js';

const SITUATIONS_YAML = path.join('curriculum', 'money-moments', 'situations.yaml');
/** The platform's kid-tier vocabulary source of record (COURSE_ENGINE.md §3). */
const TAXONOMY_YAML = path.join('curriculum', 'financial-education', 'taxonomy.yaml');
const LOCALES: ReadabilityLocale[] = ['es-MX', 'en-US', 'pt-BR'];

export async function syncSituations(situations: Situation[]): Promise<number> {
  const rows = situations.map((s) => ({
    id: s.id,
    icon: s.icon,
    title: s.title,
    description: s.description,
    tiers: s.tiers,
    position: s.position,
  }));
  await vaultUpsert('tutor_situations', rows, 'id');
  return rows.length;
}

interface PackRow {
  situation_id: string;
  tier: string;
  locale: string;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const situations = loadSituations(SITUATIONS_YAML);

  if (args.includes('--sync-situations')) {
    const n = await syncSituations(situations);
    console.log(`[tutor:packs] synced ${n} situation(s) to Vault`);
    return;
  }

  if (!args.includes('--generate')) {
    console.log('usage: npm run tutor:packs -- --sync-situations | --generate [--confirm]');
    return;
  }

  const taxonomy = parseYaml(readFileSync(TAXONOMY_YAML, 'utf8')) as {
    age_tiers: Record<string, { forbidden_vocabulary: Record<string, string[]> }>;
  };

  const existing = await vaultSelect<PackRow>('/tutor_packs?select=situation_id,tier,locale');
  const have = new Set(existing.map((p) => `${p.situation_id}|${p.tier}|${p.locale}`));
  const missing: { situation: Situation; tier: string; locale: ReadabilityLocale }[] = [];
  for (const situation of situations) {
    for (const tier of situation.tiers) {
      for (const locale of LOCALES) {
        if (!have.has(`${situation.id}|${tier}|${locale}`)) missing.push({ situation, tier, locale });
      }
    }
  }
  console.log(`[tutor:packs] ${missing.length} pack(s) missing of ${situations.length} situations × tiers × ${LOCALES.length} locales`);
  if (!args.includes('--confirm')) {
    console.log('[tutor:packs] dry run — pass --confirm to generate (PAID). Nothing was written.');
    return;
  }

  requireGenerationKeys();
  const ledger = new UsageLedger(path.join('runs', 'tutor-packs'));
  await ledger.hydrate();

  let written = 0;
  const failures: string[] = [];
  for (const { situation, tier, locale } of missing) {
    const key = `${situation.id}/${tier}/${locale}`;
    try {
      ledger.checkBudget();
      const pack = await generatePack(situation, tier, locale, { ledger });
      const langKey = locale.slice(0, 2);
      const forbidden = taxonomy.age_tiers[tier]?.forbidden_vocabulary[langKey] ?? [];
      const problems = validatePack(pack, locale, forbidden);
      if (problems.length > 0) {
        failures.push(`${key}: ${problems.join('; ')}`);
        continue;
      }
      await vaultUpsert(
        'tutor_packs',
        [{ situation_id: situation.id, tier, locale, pack, status: 'review' }],
        'situation_id,tier,locale',
      );
      written += 1;
      console.log(`[tutor:packs] ✓ ${key} (review)`);
    } catch (err) {
      failures.push(`${key}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log(`[tutor:packs] wrote ${written}, failed ${failures.length}; tokens=${ledger.tokens} usd=$${ledger.usd.toFixed(4)}`);
  for (const f of failures.slice(0, 10)) console.error(`  ${f}`);
  if (failures.length > 0) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => {
    console.error('[tutor:packs] fatal:', err);
    process.exitCode = 1;
  });
}
