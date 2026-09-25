import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/*
 * C.5 / Appendix E §2.1/§3.2 — the calibration harness for the live-content
 * judge (`content/generate.ts`'s `judgeCandidate`).
 *
 * The judge's approvals are trusted at NO sampling rate until it has been
 * compared with a human panel on a seed set of items whose quality the panel
 * rated. This module assembles that comparison; Core recomputes and records
 * it (`npm --prefix backend run tutor:live-content-report --
 * --record-calibration=<file>`), and REFUSES anything that is not:
 *   - rated by at least two raters from the human panel (`source:
 *     "human_panel"`), and
 *   - judged LIVE by the real judge (a paid call per item: owner-run, OD-23).
 *
 * Zero-spend modes, for building and checking the pipeline:
 *   dry_run   the judge's "verdict" is the seed author's intended label (not
 *             a model); proves the plumbing, records nothing
 *   replay    verdicts read from a file of an earlier live run; useful to
 *             recompute, never recordable as a new calibration
 */

export type SeedLabel = 'pass' | 'fail';
export type SeedCategory = 'standard' | 'sensitive';

export interface SeedItem {
  id: string;
  category: SeedCategory;
  tier: 1 | 2 | 3;
  locale: 'en-US' | 'es-MX' | 'pt-BR';
  /** The AUTHOR's intended label — never a human-panel rating. */
  intended: SeedLabel;
  defect: string | null;
  segment: Record<string, unknown>;
}

export interface SeedSet {
  version: string;
  items: SeedItem[];
}

export interface RatingSet {
  rater: string;
  source: 'human_panel' | 'author_intended';
  labels: Record<string, SeedLabel>;
}

export interface CalibrationFile {
  seedSet: SeedSet;
  ratings: RatingSet[];
  judge: { model: string; promptHash: string; mode: 'live' | 'replay' | 'dry_run'; verdicts: Record<string, SeedLabel> };
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SEED_SET_PATH = path.join(HERE, 'seed-set.json');

export function readSeedSet(file = SEED_SET_PATH): SeedSet {
  const raw = JSON.parse(readFileSync(file, 'utf8')) as SeedSet;
  return { version: raw.version, items: raw.items };
}

/** Structural checks the calibration relies on (Core re-checks what it records). */
export function seedSetProblems(seed: SeedSet, minPerCategory = 20): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const item of seed.items) {
    if (ids.has(item.id)) problems.push(`duplicate item id ${item.id}`);
    ids.add(item.id);
    if (item.intended === 'fail' && !item.defect) problems.push(`${item.id}: an intended fail names its defect`);
    if (item.intended === 'pass' && item.defect) problems.push(`${item.id}: an intended pass has no defect`);
  }
  for (const category of ['standard', 'sensitive'] as const) {
    const scoped = seed.items.filter((i) => i.category === category);
    if (scoped.length < minPerCategory) problems.push(`${category}: ${scoped.length} item(s), fewer than ${minPerCategory}`);
    const fails = scoped.filter((i) => i.intended === 'fail').length;
    // A set of only good (or only bad) items cannot tell a judge that
    // approves everything from one that reads.
    if (fails === 0 || fails === scoped.length) problems.push(`${category}: needs both intended passes and intended fails`);
  }
  return problems;
}

/** The author's intended labels as a rating set — clearly NOT the human panel. */
export function authorIntendedRatings(seed: SeedSet): RatingSet {
  return {
    rater: 'seed-author',
    source: 'author_intended',
    labels: Object.fromEntries(seed.items.map((i) => [i.id, i.intended])),
  };
}

/** Parses a human rating file; refuses labels for unknown items or missing items. */
export function parseRatingSet(raw: unknown, seed: SeedSet): { ok: true; rating: RatingSet } | { ok: false; why: string } {
  const r = raw as Partial<RatingSet> | null;
  if (!r || typeof r.rater !== 'string' || r.rater.trim() === '') return { ok: false, why: 'a rating file names its rater' };
  if (r.source !== 'human_panel' && r.source !== 'author_intended') return { ok: false, why: `unknown source ${String(r.source)}` };
  const labels = r.labels ?? {};
  const known = new Set(seed.items.map((i) => i.id));
  for (const id of Object.keys(labels)) if (!known.has(id)) return { ok: false, why: `label for unknown item ${id}` };
  for (const item of seed.items) {
    const label = labels[item.id];
    if (label !== 'pass' && label !== 'fail') return { ok: false, why: `${r.rater}: no pass/fail label for ${item.id}` };
  }
  return { ok: true, rating: { rater: r.rater, source: r.source, labels } };
}

/** The dry-run "judge": the author's intended label. Never recordable (mode dry_run). */
export function dryRunVerdicts(seed: SeedSet): Record<string, SeedLabel> {
  return Object.fromEntries(seed.items.map((i) => [i.id, i.intended]));
}

/** A preview of what Core will compute (Core's number is the one recorded). */
export function previewAgreement(file: CalibrationFile): {
  interRater: number | null;
  byCategory: Record<SeedCategory, { n: number; agreement: number }>;
} {
  const items = file.seedSet.items;
  let agree = 0;
  let pairs = 0;
  const human = new Map<string, SeedLabel>();
  for (const item of items) {
    const labels = file.ratings.map((r) => r.labels[item.id]);
    const passes = labels.filter((l) => l === 'pass').length;
    human.set(item.id, passes * 2 > labels.length ? 'pass' : 'fail');
    for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
      pairs += 1;
      if (labels[i] === labels[j]) agree += 1;
    }
  }
  const by = (category: SeedCategory) => {
    const scoped = items.filter((i) => i.category === category);
    const hits = scoped.filter((i) => file.judge.verdicts[i.id] === human.get(i.id)).length;
    return { n: scoped.length, agreement: scoped.length === 0 ? 0 : hits / scoped.length };
  };
  return { interRater: pairs === 0 ? null : agree / pairs, byCategory: { standard: by('standard'), sensitive: by('sensitive') } };
}
