import { z } from 'zod';
import { readAgeScreen } from '../ageScreen.js';
import { serviceRest } from '../supabaseRest.js';
import { chapterOpensForAge, chapterPolicy, learnerAgeEvidence, type AgeEvidence, type ChapterPolicy } from '../pathway/pathwayPolicy.js';
import type { KcRow } from './kcData.js';

const AdultChapters = z.array(z.object({
  id: z.string(), age_tier: z.string(), pathway_stage: z.literal('adult'),
  eligibility_min_age: z.number(), eligibility_max_age: z.number().nullable(),
  courses: z.object({ slug: z.string() }),
  sagas: z.array(z.object({ topics: z.array(z.object({ id: z.string(), slug: z.string() })) })),
}));
const Profiles = z.array(z.object({ birth_date: z.string().nullable() })).max(1);
const Aliases = z.array(z.object({ key: z.string(), skill_key: z.string().nullable() }));

/** Adult chapter eligibility is independent of the Mentor's three teaching tiers.
 * Other chapters retain their existing early-stage policy; unmapped KCs remain
 * usable. All age evidence stays inside Core, outside the Oracle context.
 */
export function adultSkillAllowed(skillKey: string, scope: ReadonlyMap<string, ChapterPolicy>, age: AgeEvidence): boolean {
  const policy = scope.get(skillKey);
  return !policy || chapterOpensForAge(age, policy);
}

export async function eligibleMentorSkills(userId: string, skillKeys: readonly string[]): Promise<Set<string> | null> {
  const keys = new Set(skillKeys);
  if (!keys.size) return keys;
  const scope = new Map<string, ChapterPolicy>();
  // The authoritative adult hierarchy also covers old persisted sessions and
  // direct skill requests, not only the currently active KC list.
  for (let offset = 0; ; offset += 1000) {
    const rows = AdultChapters.safeParse(await serviceRest<unknown>(
      `/adventures?pathway_stage=eq.adult&select=id,age_tier,pathway_stage,eligibility_min_age,eligibility_max_age,courses!inner(slug),sagas(topics(id,slug))&order=id.asc&limit=1000&offset=${offset}`,
    ));
    if (!rows.success) return null;
    for (const chapter of rows.data) {
      const policy = chapterPolicy(chapter);
      if (!policy) return null;
      for (const saga of chapter.sagas) for (const topic of saga.topics) {
        scope.set(`${chapter.courses.slug}/${topic.slug}`, policy);
        scope.set(`topic:${topic.id}`, policy);
      }
    }
    if (rows.data.length < 1000) break;
  }
  const aliases = [...keys].filter(key => key.startsWith('kc:'));
  if (aliases.length) {
    const rows = Aliases.safeParse(await serviceRest<unknown>(`/kc?key=in.(${aliases.map(key => encodeURIComponent(key.slice(3))).join(',')})&select=key,skill_key&limit=1000`));
    if (!rows.success) return null;
    for (const row of rows.data) {
      const policy = row.skill_key ? scope.get(row.skill_key) : undefined;
      if (policy) scope.set(`kc:${row.key}`, policy);
    }
  }
  if (![...keys].some(key => scope.has(key))) return keys;
  const [screen, profiles] = await Promise.all([
    readAgeScreen(userId),
    serviceRest<unknown>(`/profiles?user_id=eq.${encodeURIComponent(userId)}&select=birth_date&limit=1`),
  ]);
  const profile = Profiles.safeParse(profiles);
  if (!screen || !profile.success || !profile.data[0]) return null;
  const age = learnerAgeEvidence({ birthDate: screen.required ? null : profile.data[0].birth_date,
    declaredBand: screen.required ? null : screen.ageBand, protectedOrigin: screen.protectedOrigin });
  return new Set([...keys].filter(key => adultSkillAllowed(key, scope, age)));
}

export async function eligibleMentorKcs(userId: string, kcs: readonly KcRow[]): Promise<KcRow[] | null> {
  const skills = await eligibleMentorSkills(userId, kcs.flatMap(k => k.skill_key ? [k.skill_key] : []));
  return skills === null ? null : kcs.filter(k => !k.skill_key || skills.has(k.skill_key));
}
