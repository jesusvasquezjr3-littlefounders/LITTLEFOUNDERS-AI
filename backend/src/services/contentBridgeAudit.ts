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
     * SEARCHED MORE THAN ONCE — WHAT WAS FOUND, RECORDED SO THE NEXT PASS
     * DOES NOT REPEAT EITHER THE GAP OR THE METHOD THAT MISSED ONE.
     *
     * On 2026-08-29 sixty published topics that had lessons and were not
     * already spoken for were read against these FIVE, at the blueprint level
     * (`concept_md`/`learning_objective`), and none looked like a match. A
     * wider per-KC content-pools pass on 2026-09-01 read all 327 published
     * financial-education topics — not just sixty — and this time verified
     * every real candidate against its actual `lesson_documents` segments
     * instead of the blueprint summary alone. That caught one the first pass
     * missed: `si-me-sobra-que-me-doy`'s blueprint frames it as a spending
     * DECISION ("choose a small treat with what's left"), but both of its
     * published lessons carry an explicit `number_input` segment computing
     * the remainder — "Rho paid 7 of the 10 he had, how many are left?" and
     * "Zara had 10, spent 4 then 3, how much is left?" — exactly
     * `money.subtract-money`'s objective. It is mapped now.
     *
     * The remaining FOUR were RE-verified this pass, not re-asserted: each
     * one's strongest textual lead was read at the real-lesson level and
     * ruled out on substance.
     * `money.fraction-of-amount`'s best lead (`celebro-cuando-ahorro` /
     * its `llegue-a-la-mitad` lesson) uses "halfway" only as a milestone
     * comparison — the learner sorts savers as below/at/above a GIVEN
     * halfway point, and separately makes a GIVEN coin amount; nothing asks
     * for half/a third/a quarter of an amount to be computed.
     * `money.percent-intro` has zero occurrences of "percent" / "porcentaje"
     * / "%" / "porcentagem" anywhere in any topic's slug, three-locale title,
     * `concept_md`, three-locale `learning_objective`, or `key_vocabulary` —
     * the concept is not authored anywhere in the catalog yet.
     * `biz.goods-vs-services`'s best lead (`servicios-publicos-y-su-costo`)
     * is entirely about PUBLIC-service/tax funding (streetlights, clean
     * water, trash pickup), not the commercial "does this business sell a
     * thing, or sell help/work" distinction the KC actually asks for.
     * `biz.risk-and-reward`'s best financial-education lead
     * (`comparo-dos-metas-de-ahorro`) prioritizes between two CERTAIN savings
     * goals — no chance of loss involved — and entrepreneurship's own
     * `radar-de-riesgos` adventure was also read end to end (all 30 topics)
     * despite its name: tier4 (ages 12-18, a different audience from every
     * other mapping in this graph, which is exclusively financial-education
     * tier1/tier2), and about contract literacy and business ethics, not
     * probabilistic risk-versus-reward tradeoffs — ruled out on substance,
     * not only on age band.
     *
     * The false friends already on record still stand:
     * `si-no-me-alcanza-que-cambio` and `es-un-buen-cambio` are "cambio" as
     * in BARTER, not as in money returned, and mapping either to
     * `money.subtract-money` would have served a lesson about swapping toys
     * to a child asking what is left from fifty pesos.
     *
     * So the remaining four are a CONTENT gap, not a mapping one, and closing
     * them means authoring new topics. Until then they fall through to live
     * generation on every request, which is exactly what the null admits.
     * THE METHOD LESSON: a blueprint's `concept_md`/`learning_objective` is a
     * narrative summary, never the graded activity — verify a candidate
     * against its real `lesson_documents` segments before ruling it in OR
     * out, because the summary can misdescribe either direction.
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
