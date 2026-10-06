import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const designRoot = new URL('../../curriculum-design/financial-education/', import.meta.url);
const scope = JSON.parse(readFileSync(new URL('scope.json', designRoot), 'utf8'));
const { buildSequence, checkSequence } = await import(new URL('build-sequence.mjs', designRoot).href);
const { objectives } = await import(new URL('objectives.mjs', designRoot).href);
const { requirements } = await import(new URL('dependencies.mjs', designRoot).href);

describe('production curriculum planning boundaries', () => {
  it('covers every declared domain without counting calibration or retrieval reservations as playable lessons', () => {
    const result = buildSequence(scope);
    expect([...new Set(result.lessons.map((lesson: { domain: string }) => lesson.domain))]).toEqual(scope.domains.map((domain: { id: string }) => domain.id));
    expect(result.playable_lessons).toBe(0);
    expect(result.production_release_authorized).toBe(false);
    expect(result.calibration.included_in_production_count).toBe(false);
    expect(checkSequence(result)).toEqual([]);
  });

  it('rejects a prerequisite that will only be taught later', () => {
    expect(() => buildSequence(scope, objectives, { ...requirements, money: requirements.money.replace(/^0/, 'math.1') })).toThrow('untaught objective');
  });

  it('rejects an omitted domain or an objective lacking explicit dependency design', () => {
    const missing = { ...objectives };
    delete missing['credit-records'];
    expect(() => buildSequence(scope, missing)).toThrow('exactly match');
    expect(() => buildSequence(scope, { ...objectives, 'usable-money': [...objectives['usable-money'], 'Choose a specific action for a newly introduced financial task.'] })).toThrow('dependency declaration');
  });

  it('detects loss of retrieval coverage and premature retrieval', () => {
    const result = buildSequence(scope);
    result.lessons.forEach((lesson: { retrieve_objectives: string[] }) => { lesson.retrieve_objectives = []; });
    expect(checkSequence(result).some((finding: string) => finding.includes('no later retrieval'))).toBe(true);
    const premature = buildSequence(scope);
    premature.lessons[1].retrieve_objectives = [premature.lessons[0].lesson_id];
    expect(checkSequence(premature).some((finding: string) => finding.includes('intervening lesson'))).toBe(true);
  });

  it('rejects duplicate objective text instead of padding the catalog', () => {
    const copy = structuredClone(objectives);
    copy['usable-money'][1] = copy['usable-money'][0];
    expect(() => buildSequence(scope, copy)).toThrow('duplicate objective');
  });

  it('keeps the saved sequence identical to its authored source', () => {
    const saved = JSON.parse(readFileSync(new URL('lesson-sequence.json', designRoot), 'utf8'));
    expect(saved).toEqual(buildSequence(scope));
  });

  it('maps every opening teaching brief to draft shared KCs with all required prerequisites taught first', () => {
    const design = buildSequence(scope);
    const { briefs } = JSON.parse(readFileSync(new URL('opening-briefs.json', designRoot), 'utf8')) as {
      briefs: Array<{ lesson_id: string; kc_reconciliation: { candidate: string; status: string } }>;
    };
    const graph = JSON.parse(readFileSync(new URL('../../../database/seeds/kc_graph.v1.json', import.meta.url), 'utf8')) as {
      kcs: Array<{ key: string; status: string; skill_key: string | null }>; edges: string[][];
    };
    const byLesson = new Map(briefs.map(brief => [brief.lesson_id, brief.kc_reconciliation.candidate]));
    const opening = design.lessons.filter((lesson: { domain: string; kind: string }) => lesson.domain === 'usable-money' && lesson.kind === 'teach') as Array<{ lesson_id: string; prerequisites: string[] }>;
    expect(briefs.map(brief => brief.lesson_id)).toEqual(opening.map(lesson => lesson.lesson_id));
    const seen = new Set<string>();
    for (const lesson of opening) {
      const kc = byLesson.get(lesson.lesson_id)!;
      expect(graph.kcs.find(row => row.key === kc)).toMatchObject({ status: 'draft', skill_key: null });
      const required = graph.edges.filter(edge => edge[1] === kc).map(edge => edge[0]);
      const declared = lesson.prerequisites.map(id => byLesson.get(id));
      for (const prerequisite of required) {
        expect(declared, lesson.lesson_id).toContain(prerequisite);
        expect(seen.has(prerequisite), lesson.lesson_id).toBe(true);
      }
      seen.add(kc);
    }
  });
});
