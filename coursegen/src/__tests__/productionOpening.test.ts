import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadV2Plans } from '../v2/plan.js';
import { checkInstructionalContract } from '../v2/instructionalContract.js';
import { emitV2Lesson } from '../v2/emit.js';

const root = new URL('../../curriculum-production/financial-education/', import.meta.url);
const read = (url: URL) => JSON.parse(readFileSync(url, 'utf8'));
const manifest = read(new URL('batch-manifest.json', root));
const sequence = read(new URL('../../curriculum-design/financial-education/lesson-sequence.json', root));
const briefs = read(new URL('../../curriculum-design/financial-education/opening-briefs.json', root)).briefs as Array<{ lesson_id: string; kc_reconciliation: { candidate: string } }>;
const loaded = loadV2Plans(fileURLToPath(new URL('course-plans/', root)));
const plans = loaded.flatMap(row => row.plan ? [row.plan] : []);

describe('partial production opening batch', () => {
  it('implements exactly the declared opening unit without claiming the remaining course', () => {
    expect(loaded.flatMap(row => row.errors)).toEqual([]);
    const expected = sequence.lessons.filter((row: { domain: string; kind: string }) => row.domain === 'usable-money');
    expect(plans.map(plan => plan.lesson_id)).toEqual(expected.map((row: { lesson_id: string }) => row.lesson_id));
    expect(manifest.authored_lessons).toBe(plans.length);
    expect(manifest.planned_course_slots).toBe(sequence.lessons.length);
    expect(manifest.authored_lessons).toBeLessThan(manifest.planned_course_slots);
    expect(manifest.whole_course_complete).toBe(false);
    expect(manifest.publication_authorized).toBe(false);
    expect(manifest.calibration_adoption).toHaveLength(3);
    expect(manifest.newly_authored_lessons).toHaveLength(8);
  });

  it('preserves the sequence objective, proposed prerequisites and narrow KC evidence in each playable draft', () => {
    const skills = new Map(briefs.map(brief => [brief.lesson_id, brief.kc_reconciliation.candidate.replace(/^finance\./, '')]));
    for (const plan of plans) {
      const design = sequence.lessons.find((row: { lesson_id: string }) => row.lesson_id === plan.lesson_id);
      if (design.kind === 'teach') {
        expect(plan.instruction?.objective.observable_action).toBe(design.objective);
        expect(plan.instruction?.objective.skill_id).toBe(skills.get(plan.lesson_id));
        expect(plan.instruction?.prerequisite_skills).toEqual(design.prerequisites.map((id: string) => skills.get(id)));
      } else {
        const retrieval = design.retrieve_objectives.map((id: string) => skills.get(id));
        expect(plan.instruction?.retrieval_skills).toEqual(retrieval);
        expect(retrieval).toContain(plan.instruction?.objective.skill_id);
        for (const skill of retrieval) {
          expect(plan.instruction?.evidence.some(item => item.skill_id === skill && plan.segments.some(segment => segment.id === item.segment_id && segment.grading === 'server' && ['practice', 'transfer'].includes(segment.teaching_role ?? '')))).toBe(true);
        }
      }
      expect(checkInstructionalContract(plan, true), plan.lesson_id).toEqual([]);
      for (const segment of plan.segments.filter(row => row.grading === 'server')) {
        const evidence = plan.instruction?.evidence.find(item => item.segment_id === segment.id);
        expect(segment.knowledge_component_id).toBe(`finance.${evidence?.skill_id}`);
      }
    }
  });

  it('emits every locale through the existing Forge gates with private numeric checks intact', () => {
    for (const plan of plans) {
      const result = emitV2Lesson(plan, { versionId: 'forge-production-opening-test', requireLessonDesign: true });
      expect(result.problems, plan.lesson_id).toEqual([]);
      expect(result.documents).toHaveLength(3);
    }
  });

  it('pins both draft files and adopted calibration sources instead of silently treating changed content as approved', () => {
    const hash = (url: URL) => createHash('sha256').update(readFileSync(url)).digest('hex');
    expect(manifest.design_hash).toBe(hash(new URL('../../curriculum-design/financial-education/lesson-sequence.json', root)));
    for (const row of manifest.lessons) expect(hash(new URL(`course-plans/${row.lesson_id}.json`, root))).toBe(row.sha256);
    for (const row of manifest.calibration_adoption) {
      expect(hash(new URL(`../../curriculum-recovery/financial-education/course-plans/${row.source_lesson_id}.json`, root))).toBe(row.source_sha256);
    }
  });
});
