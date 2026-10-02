import { HORIZONTE_CAPABILITIES } from './contract';
import { HORIZONTE_FIXTURES } from './fixtures';
import type { HorizonteFixture, HorizonteLocale } from './types.generated';

export function horizonteFixture(pack: string, id: string): HorizonteFixture | null {
  return HORIZONTE_FIXTURES[pack]?.find((fixture) => fixture.id === id) ?? null;
}

/** One pack fixture staged as its own lesson document (preview, audit and tests only; the player never builds one). */
export function horizonteFixtureDocument(pack: string, id: string, locale: HorizonteLocale): Record<string, unknown> | null {
  const fixture = horizonteFixture(pack, id);
  if (!fixture) return null;
  const segment = fixture.segment(locale);
  const capabilities = (HORIZONTE_CAPABILITIES as Record<string, readonly string[]>)[String(segment.type)] ?? [];
  return {
    schema_version: 2, course_id: 'financial-education', pathway_id: `horizonte-${fixture.ageBand}`, chapter_id: `horizonte-${pack}`,
    lesson_id: `hz-${pack}-${fixture.id}`, version_id: 'rev-1', locale, age_band: fixture.ageBand, eligibility: fixture.eligibility,
    knowledge_component_ids: ['kc-horizonte-fixture'], adventure_scene_id: 'diorama-a', title: fixture.title[locale],
    required_capabilities: [...capabilities], segments: [segment],
  };
}

/** The attempt seed a seeded fixture is staged with, keyed by its segment id; none for a fixture without one. */
export function horizonteFixtureSeeds(pack: string, id: string, locale: HorizonteLocale): Readonly<Record<string, string>> | undefined {
  const fixture = horizonteFixture(pack, id);
  return fixture?.seed ? { [String(fixture.segment(locale).id)]: fixture.seed } : undefined;
}
