import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { SegmentBase } from '../lesson-contract/core/types.js';
import { stripAnswers } from './lessonDocument.js';
import { lexicalRiskSignals } from './pedagogy/contentRisk.js';
import { insertAuditLog, serviceRest } from './supabaseRest.js';
import { verifyGeneratedSegment } from './tutorLadder.js';

/*
 * Product C.6 — the curated activity-pack tier (ladder tier 2).
 *
 * `tutor_packs` has existed since migration 0047 with a reader
 * (`serveFromBank`) and no content, no authoring contract, no loader and no
 * publish path, so every request that missed a published lesson fell through
 * to live generation. This file is the contract every pack must meet before a
 * human may publish it, the canonical form it is stored and hashed in, and
 * the staff-side reads and writes.
 *
 * THE AUTHORING CONTRACT (`tutor-pack.v1`, written out in
 * docs/rebuild/mentor/LIVE-CONTENT-GOVERNANCE-POLICY.md §5):
 *
 *   target      a knowledge component (`kc_key`) or a catalog skill key, one
 *               age tier (never below the KC's `tier_min`) and one locale
 *   segments    4–12, of the pack types below, every id unique and prefixed
 *               `pack-`, every one passing the SAME deterministic gates as a
 *               live-generated item (shape, one correct option, a teaching
 *               rationale on every wrong option, the tier's vocabulary band,
 *               a key that re-executes to 100 with the real grader) — and,
 *               stricter than live, every key MUST verify (a pack item always
 *               pays XP) and every item MUST carry an explanation
 *   language    no link, email or phone number; a locale guard against a
 *               pack written in the wrong language
 *   risk        the author declares `standard` or `sensitive`; a pack whose
 *               own text trips the content-risk lexicon must declare
 *               `sensitive` (under-declaring is refused)
 *   release     loaded as `review`; only a staff member with manage_content
 *               publishes it, the contract re-runs on the STORED content at
 *               that moment, and the decision is in audit_logs
 *
 * Personalization happens at selection time, not generation time: the ladder
 * picks the pack item nearest the requested difficulty and never repeats one
 * within a session.
 */

export const PACK_CONTRACT = 'tutor-pack.v1';
export const PACK_TYPES = ['quiz_mcq', 'true_false', 'number_input', 'sort_buckets', 'order_steps'] as const;
export const PACK_LOCALES = ['en-US', 'es-MX', 'pt-BR'] as const;
export const PACK_DEMAND_PATTERNS = ['kc_without_catalog_content', 'catalog_type_gap', 'high_live_demand'] as const;
export const PACK_SOURCES = ['hand_authored', 'forge'] as const;
export const PACK_STATUSES = ['review', 'published', 'archived'] as const;
export const PACK_LIMITS = { minSegments: 4, maxSegments: 12 } as const;

const markdown = z.string().min(1).max(4000);
const id = z.string().min(1).max(64);
const idText = z.object({ id, text_md: markdown }).strict();

/*
 * Per-type payload contracts. MIRRORS the frontend Lesson Engine's own
 * schemas for these five types (frontend/src/lesson-engine/families/*
 * /schema.ts); `frontend/src/lesson-engine/curatedPacks.test.ts` parses every
 * seed pack item with the REAL frontend schema, so a drift fails there.
 */
const PAYLOADS: Record<(typeof PACK_TYPES)[number], z.ZodTypeAny> = {
  quiz_mcq: z
    .object({
      options: z
        .array(z.object({ id, text_md: markdown, rationale_md: markdown.optional() }).strict())
        .min(2)
        .max(6),
      shuffle: z.boolean().optional(),
    })
    .strict(),
  true_false: z
    .object({ statement_md: markdown, justifications: z.array(idText).min(2).max(4).optional() })
    .strict(),
  number_input: z
    .object({ unit: z.string().min(1).max(16).optional(), decimals_hint: z.number().int().min(0).max(4).optional() })
    .strict(),
  sort_buckets: z
    .object({
      buckets: z.array(z.object({ id, label: z.string().min(1).max(120) }).strict()).min(2).max(5),
      items: z.array(idText).min(4).max(16),
    })
    .strict(),
  order_steps: z
    .object({ items: z.array(idText).min(3).max(8), slots: z.number().int().min(2).max(8).optional() })
    .strict(),
};

export const PackSegmentSchema = z
  .object({
    id: z.string().regex(/^pack-[a-z0-9-]{3,58}$/, 'pack segment ids are `pack-` + kebab-case'),
    type: z.enum(PACK_TYPES),
    prompt_md: markdown,
    difficulty: z.number().int().min(1).max(5),
    xp: z.number().int().min(5).max(25),
    hints: z.array(z.string().min(1).max(300)).max(2).optional(),
    explanation_md: markdown,
    narrator: z
      .object({
        character: z.enum(['dina', 'liruf', 'rho', 'zara']),
        emotion: z.enum(['neutral', 'happy', 'excited', 'thinking', 'surprised', 'encouraging', 'proud']).optional(),
      })
      .strict()
      .optional(),
    payload: z.record(z.string(), z.unknown()),
    answer: z.record(z.string(), z.unknown()),
  })
  .strict();

export type PackSegment = z.infer<typeof PackSegmentSchema>;

/** One authored pack: the unit a human publishes. */
export const AuthoredPackSchema = z
  .object({
    tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    locale: z.enum(PACK_LOCALES),
    risk_category: z.enum(['standard', 'sensitive']),
    segments: z.array(z.unknown()).min(1).max(40),
  })
  .strict();

/** A pack source file: every pack for one target (all tiers and locales). */
export const PackSourceFileSchema = z
  .object({
    $comment: z.string().optional(),
    contract: z.literal(PACK_CONTRACT),
    kc_key: z.string().regex(/^[a-z0-9][a-z0-9_.-]{2,95}$/).optional(),
    skill_key: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,63}\/[a-z0-9][a-z0-9._-]{0,63}$/).optional(),
    demand_pattern: z.enum(PACK_DEMAND_PATTERNS),
    source: z.enum(PACK_SOURCES),
    packs: z.array(AuthoredPackSchema).min(1),
  })
  .strict()
  .refine((f) => (f.kc_key === undefined) !== (f.skill_key === undefined), 'a pack file targets exactly one of kc_key or skill_key');

export type PackSourceFile = z.infer<typeof PackSourceFileSchema>;
export type AuthoredPack = z.infer<typeof AuthoredPackSchema>;

// ── the contract ─────────────────────────────────────────────────────────────

const CONTACT = /(https?:\/\/|www\.|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|\+?\d[\d\s().-]{8,}\d)/i;

/*
 * A GUARD, not a language detector: counts function words that belong to the
 * wrong language. Three or more of them in one item is almost never a quote
 * or a name; it is a pack written (or pasted) in another language.
 */
const FOREIGN_MARKERS: Record<(typeof PACK_LOCALES)[number], RegExp> = {
  'en-US': /(?<![\p{L}])(el|los|las|que|para|una|não|você|uma|porque|cuánto|quanto|dinero|dinheiro)(?![\p{L}])/giu,
  'es-MX': /(?<![\p{L}])(the|and|you|your|what|which|não|você|uma|dinheiro|quanto)(?![\p{L}])/giu,
  'pt-BR': /(?<![\p{L}])(the|and|you|your|what|which|dinero|cuánto|usted|también|pero)(?![\p{L}])/giu,
};

function segmentProse(segment: PackSegment): string {
  const parts: string[] = [segment.prompt_md, segment.explanation_md, ...(segment.hints ?? [])];
  const walk = (value: unknown): void => {
    if (typeof value === 'string') parts.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(segment.payload);
  return parts.join('\n');
}

export interface PackValidation {
  ok: boolean;
  failures: string[];
  /** Lexical risk signals found in the pack's own text. */
  riskSignals: string[];
}

/**
 * The whole contract for one pack. `tierMin` is the target KC's `tier_min`
 * when known (the loader test reads it from the seed graph; the publish route
 * from the live `kc` table).
 */
export function validatePack(
  pack: AuthoredPack,
  options: { tierMin?: number | null } = {},
): PackValidation {
  const failures: string[] = [];
  const signals = new Set<string>();
  const segments = pack.segments;

  if (segments.length < PACK_LIMITS.minSegments || segments.length > PACK_LIMITS.maxSegments) {
    failures.push(`a pack carries ${PACK_LIMITS.minSegments}-${PACK_LIMITS.maxSegments} segments, not ${segments.length}`);
  }
  if (options.tierMin != null && pack.tier < options.tierMin) {
    failures.push(`tier ${pack.tier} is below the knowledge component's tier_min ${options.tierMin}`);
  }

  const ids = new Set<string>();
  for (const [index, raw] of segments.entries()) {
    const parsed = PackSegmentSchema.safeParse(raw);
    if (!parsed.success) {
      failures.push(`segment ${index}: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
      continue;
    }
    const segment = parsed.data;
    const where = `segment ${segment.id}`;
    if (ids.has(segment.id)) failures.push(`${where}: duplicate id`);
    ids.add(segment.id);

    const payload = PAYLOADS[segment.type].safeParse(segment.payload);
    if (!payload.success) {
      failures.push(`${where}: payload ${payload.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`);
    }

    // The SAME gates a live-generated item passes, and stricter: every pack
    // key must re-execute (a pack item always pays XP).
    const verification = verifyGeneratedSegment(segment as unknown as SegmentBase, pack.tier);
    for (const failure of verification.failures) failures.push(`${where}: ${failure}`);
    if (verification.failures.length === 0 && !verification.keyVerified) {
      failures.push(`${where}: the answer key does not re-execute with the real grader`);
    }

    const prose = segmentProse(segment);
    if (CONTACT.test(prose)) failures.push(`${where}: contains a link, an email address or a phone number`);
    const foreign = prose.match(FOREIGN_MARKERS[pack.locale]) ?? [];
    if (foreign.length >= 3) {
      failures.push(`${where}: reads as another language for ${pack.locale} (${[...new Set(foreign.map((f) => f.toLowerCase()))].join(', ')})`);
    }
    for (const s of lexicalRiskSignals(prose)) signals.add(s);
  }

  const riskSignals = [...signals];
  if (riskSignals.length > 0 && pack.risk_category !== 'sensitive') {
    failures.push(`the pack touches a sensitive topic (${riskSignals.join(', ')}) and must declare risk_category "sensitive"`);
  }
  return { ok: failures.length === 0, failures, riskSignals };
}

// ── the stored form ──────────────────────────────────────────────────────────

/** Deterministic JSON (sorted keys) so the content hash is stable. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export interface StoredPack {
  contract: typeof PACK_CONTRACT;
  segments: Record<string, unknown>[];
  answers: Record<string, Record<string, unknown>>;
}

/**
 * The `tutor_packs.pack` column: the learner-visible segments with their keys
 * stripped, and the keys beside them (the shape `serveFromBank` reads). The
 * column has no client read path at all (0047); stripping is belt and braces.
 */
export function toStoredPack(pack: AuthoredPack): StoredPack {
  const segments = pack.segments as PackSegment[];
  const stripped = stripAnswers({ segments }) as { segments: Record<string, unknown>[] };
  const answers: Record<string, Record<string, unknown>> = {};
  for (const segment of segments) answers[segment.id] = segment.answer;
  return { contract: PACK_CONTRACT, segments: stripped.segments, answers };
}

/** Re-assembles a stored pack into authored form (for re-validation at publish). */
export function fromStoredPack(
  stored: unknown,
  meta: { tier: number; locale: string; risk_category: string },
): AuthoredPack | null {
  const shape = stored as Partial<StoredPack> | null;
  if (!shape || !Array.isArray(shape.segments)) return null;
  const answers = shape.answers ?? {};
  const parsed = AuthoredPackSchema.safeParse({
    tier: meta.tier,
    locale: meta.locale,
    risk_category: meta.risk_category,
    segments: shape.segments.map((s) => {
      const segment = s as { id?: unknown };
      const key = typeof segment.id === 'string' ? answers[segment.id] : undefined;
      return key === undefined ? s : { ...s, answer: key };
    }),
  });
  return parsed.success ? parsed.data : null;
}

export function packContentHash(stored: StoredPack): string {
  return createHash('sha256').update(canonicalJson(stored)).digest('hex');
}

/** The ladder key for a pack target: a catalog skill key, or `kc:` + the KC key. */
export function packSkillKey(file: Pick<PackSourceFile, 'kc_key' | 'skill_key'>): string {
  return file.kc_key !== undefined ? `kc:${file.kc_key}` : (file.skill_key as string);
}

// ── staff reads and writes ───────────────────────────────────────────────────

export interface TutorPackAdminRow {
  id: string;
  skill_key: string;
  kc_key: string | null;
  tier: number;
  locale: string;
  pack: StoredPack;
  status: (typeof PACK_STATUSES)[number];
  pack_version: number;
  content_hash: string | null;
  source: string;
  demand_pattern: string | null;
  risk_category: 'standard' | 'sensitive';
  released_by: string | null;
  released_at: string | null;
  validated_at: string | null;
  updated_at: string;
}

const PACK_SELECT =
  'id,skill_key,kc_key,tier,locale,pack,status,pack_version,content_hash,source,demand_pattern,risk_category,released_by,released_at,validated_at,updated_at';

export async function listTutorPacks(status: (typeof PACK_STATUSES)[number] | null): Promise<TutorPackAdminRow[] | null> {
  const filter = status === null ? '' : `&status=eq.${status}`;
  return serviceRest<TutorPackAdminRow[]>(`/tutor_packs?select=${PACK_SELECT}${filter}&order=skill_key.asc,tier.asc,locale.asc&limit=500`);
}

export async function getTutorPack(packId: string): Promise<TutorPackAdminRow | null | undefined> {
  const rows = await serviceRest<TutorPackAdminRow[]>(`/tutor_packs?id=eq.${encodeURIComponent(packId)}&select=${PACK_SELECT}`);
  if (rows === null) return undefined;
  return rows[0] ?? null;
}

async function kcTierMin(kcKey: string | null): Promise<number | null | undefined> {
  if (kcKey === null) return null;
  const rows = await serviceRest<{ tier_min: number }[]>(`/kc?key=eq.${encodeURIComponent(kcKey)}&select=tier_min&limit=1`);
  if (rows === null) return undefined;
  return rows[0]?.tier_min ?? null;
}

/**
 * A staff decision on a pack. Publishing re-runs the whole contract on the
 * STORED content (never on what a client claims it is), and names the human
 * who released it. Archiving takes it out of the ladder at once.
 */
export async function setTutorPackStatus(input: {
  packId: string;
  status: (typeof PACK_STATUSES)[number];
  actorId: string;
}): Promise<
  | { ok: true; row: TutorPackAdminRow }
  | { ok: false; code: 'not_found' | 'unavailable' | 'invalid' | 'unchanged'; failures?: string[] }
> {
  const row = await getTutorPack(input.packId);
  if (row === undefined) return { ok: false, code: 'unavailable' };
  if (row === null) return { ok: false, code: 'not_found' };
  if (row.status === input.status) return { ok: false, code: 'unchanged' };

  const now = new Date().toISOString();
  let patch: Record<string, unknown> = { status: input.status, updated_at: now };
  if (input.status === 'published') {
    const tierMin = await kcTierMin(row.kc_key);
    if (tierMin === undefined) return { ok: false, code: 'unavailable' };
    const authored = fromStoredPack(row.pack, row);
    const validation = authored === null
      ? { ok: false, failures: ['the stored pack is not in the tutor-pack.v1 shape'] }
      : validatePack(authored, { tierMin });
    const hash = packContentHash(row.pack);
    if (row.content_hash !== null && row.content_hash !== hash) {
      validation.ok = false;
      validation.failures = [...validation.failures, 'the stored content no longer matches its recorded hash'];
    }
    if (!validation.ok) return { ok: false, code: 'invalid', failures: validation.failures };
    patch = { ...patch, released_by: input.actorId, released_at: now, validated_at: now, content_hash: hash };
  }

  // The status filter makes a stale second decision a no-op, not an overwrite.
  const updated = await serviceRest<TutorPackAdminRow[]>(
    `/tutor_packs?id=eq.${encodeURIComponent(input.packId)}&status=eq.${row.status}&select=${PACK_SELECT}`,
    { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch) },
  );
  if (updated === null) return { ok: false, code: 'unavailable' };
  const next = updated[0];
  if (!next) return { ok: false, code: 'unchanged' };
  await insertAuditLog(input.actorId, 'admin.tutor_pack.status', input.packId, {
    from: row.status,
    to: input.status,
    skillKey: row.skill_key,
    tier: row.tier,
    locale: row.locale,
    packVersion: row.pack_version,
    contentHash: next.content_hash,
  });
  return { ok: true, row: next };
}
