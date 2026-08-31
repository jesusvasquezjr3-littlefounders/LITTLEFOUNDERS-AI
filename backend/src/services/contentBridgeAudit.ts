import { serviceRest } from './supabaseRest.js';
import { resolveSkill } from './tutorLadder.js';

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
 * THIS FILE USED TO LIVE INSIDE `seed-kc-graph.ts` and ran ONLY as a side
 * effect of `npm run seed:kc` — which, in production, only ever happened when
 * a human dispatched `tutor-deploy.yml`'s `seed-kc` step. That made the audit
 * exactly as strong as remembering to re-run it, and nothing re-checked the
 * bridge when the CATALOG moved instead of the graph: a course unpublished, a
 * topic's lessons archived, a lesson's skill tags edited — none of those touch
 * `database/seeds/kc_graph.v1.json`, so none of them would ever prompt anyone
 * to re-seed. Found by adversarial review sweep tutor-review-sweep-101
 * (content-ladder-correctness dimension), MEDIUM, closed round 105
 * (2026-08-31) — see RUNBOOK.md.
 *
 * It is now called from two places, both idempotent and read-mostly:
 *  1. `seed-kc-graph.ts`'s `main()`, right after the seed's own upserts land —
 *     the audit reports on data that is already in place, from the SEED file.
 *  2. `scripts/audit-content-bridge.ts`, standalone, reading the CURRENTLY
 *     active `kc` rows straight out of Vault (via `getActiveKcs()`) rather
 *     than the seed file — so it needs nothing the seed step needs beyond
 *     Supabase credentials, and can run on a schedule against production
 *     (`.github/workflows/tutor-content-bridge.yml`) independent of whether
 *     anyone has touched the KC graph recently.
 */
export interface ContentBridgeKc {
  key: string;
  skill_key: string | null;
}

export interface ContentBridgeReport {
  mappedCount: number;
  unmappedKeys: string[];
  broken: string[];
}

export async function auditContentBridge(kcs: readonly ContentBridgeKc[]): Promise<ContentBridgeReport> {
  const mapped = kcs.filter((k) => k.skill_key);
  const unmappedKcs = kcs.filter((k) => !k.skill_key);
  const unmapped = unmappedKcs.length;
  console.log(`\nContent bridge — ${mapped.length} mapped, ${unmapped} deliberately unmapped:`);
  if (unmapped > 0) {
    /*
     * SEARCHED, AND THE ANSWER WAS NO — recorded so nobody repeats it.
     *
     * On 2026-08-29 all sixty published topics that have lessons and are not
     * already spoken for were read against these five. Nothing teaches them.
     * The nearest misses are false friends worth naming: `si-no-me-alcanza-que-cambio`
     * and `es-un-buen-cambio` are "cambio" as in BARTER, not as in money
     * returned, and mapping either to `money.subtract-money` would serve a
     * lesson about swapping toys to a child asking what is left from fifty
     * pesos.
     *
     * So this is a CONTENT gap, not a mapping one, and closing it means
     * authoring. Until then these fall through to live generation on every
     * request, which is exactly what the null is admitting.
     */
    console.log(`  (${unmappedKcs.map((k) => k.key).join(', ')} — no published topic teaches these)`);
  }

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

  return { mappedCount: mapped.length, unmappedKeys: unmappedKcs.map((k) => k.key), broken };
}

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
export async function suggestAlternatives(alreadyMapped: Set<string>): Promise<void> {
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
