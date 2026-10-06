import { z } from 'zod';
import type { V2LessonPlan } from './plan.js';
import { checkInstructionalContract } from './instructionalContract.js';

const id = z.string().regex(/^[a-z0-9][a-z0-9._:-]{1,100}$/);
export const courseBlueprintSchema = z.object({
  version: z.literal(1),
  publication_intent: z.enum(['calibration-only', 'release-candidate']).optional(),
  course_id: id,
  pathway_id: id,
  age_band: z.enum(['6-9', '10-12', '13-17', 'adult']),
  metadata: z.object({
    title: z.object({ 'en-US': z.string().min(1), 'es-MX': z.string().min(1), 'pt-BR': z.string().min(1) }).strict(),
    description: z.object({ 'en-US': z.string().min(1), 'es-MX': z.string().min(1), 'pt-BR': z.string().min(1) }).strict(),
    subject: z.enum(['money', 'math', 'science', 'economics', 'code', 'mixed']),
    position: z.number().int().nonnegative(), badge_asset: z.string().min(1), requires: z.array(z.string()).optional(),
  }).strict().optional(),
  scope: z.string().trim().min(30),
  excluded_scope: z.array(z.string().trim().min(5)),
  units: z.array(z.object({ id, title: z.object({ 'en-US': z.string().min(1), 'es-MX': z.string().min(1), 'pt-BR': z.string().min(1) }).strict(), objective: z.string().trim().min(15) }).strict()).min(1),
  sources: z.array(z.object({ url: z.string().url(), use: z.string().trim().min(10) }).strict()).min(1),
  skills: z.array(z.object({
    id, knowledge_component_id: id, domain: id,
    outcome: z.string().trim().min(15),
    prerequisites: z.array(id),
  }).strict()).min(1),
  lessons: z.array(z.object({
    lesson_id: id, primary_skill: id, unit_id: id,
    kind: z.enum(['teach', 'consolidate', 'capstone']),
    retrieve_skills: z.array(id),
  }).strict()).min(1),
}).strict();
export type CourseBlueprint = z.infer<typeof courseBlueprintSchema>;
export interface BlueprintFinding { code: string; message: string; lessonId?: string }

/** A course is a closed skill graph, not a count of JSON files. No mastery state is created here. */
export function checkCourseBlueprint(blueprint: CourseBlueprint, plans: V2LessonPlan[], knownKcs: ReadonlySet<string>, kcEdges?: readonly (readonly string[])[]): BlueprintFinding[] {
  const problems: BlueprintFinding[] = [];
  const fail = (code: string, message: string, lessonId?: string) => problems.push({ code, message, ...(lessonId ? { lessonId } : {}) });
  const skills = new Map(blueprint.skills.map(skill => [skill.id, skill]));
  const lessons = new Map(blueprint.lessons.map(lesson => [lesson.lesson_id, lesson]));
  const units = new Map(blueprint.units.map(unit => [unit.id, unit]));
  if (units.size !== blueprint.units.length) fail('duplicate-unit', 'Unit IDs must be unique.');
  const byId = new Map(plans.map(plan => [plan.lesson_id, plan]));
  const signatures = new Map<string, string>();
  for (const plan of plans) {
    const signature = JSON.stringify(plan.segments.map(segment => ({ type: segment.type, copy: segment.copy }))).toLowerCase().replace(/\d+(?:[.,]\d+)*/g, '#');
    const previous = signatures.get(signature);
    if (previous) fail('duplicate-lesson-content', `Lesson duplicates ${previous}, including copies that change only numbers.`, plan.lesson_id);
    else signatures.set(signature, plan.lesson_id);
  }
  if (skills.size !== blueprint.skills.length) fail('duplicate-skill', 'Skill IDs must be unique.');
  if (lessons.size !== blueprint.lessons.length || byId.size !== plans.length) fail('duplicate-lesson', 'Lesson IDs must be unique in the blueprint and authored plans.');
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const walk = (key: string): void => {
    if (visiting.has(key)) { fail('prerequisite-cycle', `Prerequisite cycle reaches ${key}.`); return; }
    if (visited.has(key)) return;
    const skill = skills.get(key);
    if (!skill) { fail('unknown-prerequisite', `Undefined skill ${key}.`); return; }
    visiting.add(key);
    for (const previous of skill.prerequisites) walk(previous);
    visiting.delete(key); visited.add(key);
  };
  for (const skill of blueprint.skills) {
    if (!knownKcs.has(skill.knowledge_component_id)) fail('unknown-kc', `${skill.id} must map to the existing shared KC graph.`);
    if (kcEdges) {
      const expected = kcEdges.filter(edge => edge[1] === skill.knowledge_component_id).map(edge => edge[0]).sort();
      const declared = new Set(skill.prerequisites.map(key => skills.get(key)?.knowledge_component_id));
      // Shared edges are required competencies, not a ban on extra contextual preparation.
      // All declared extras still pass the graph, earlier-teaching and plan-parity checks below.
      const missing = expected.filter(key => !declared.has(key));
      if (missing.length) fail('shared-prerequisite-drift', `${skill.id} omits shared KC prerequisites ${missing.join(', ')}; teach or explicitly reconcile the bridge before authoring.`);
    }
    if (new Set(skill.prerequisites).size !== skill.prerequisites.length) fail('duplicate-prerequisite', `${skill.id} repeats prerequisites.`);
    walk(skill.id);
  }
  const introduced = new Map<string, number>();
  const retrieved = new Set<string>();
  let previousUnit = -1;
  blueprint.lessons.forEach((lesson, position) => {
    if (lesson.kind === 'capstone' && new Set(lesson.retrieve_skills).size < 3) fail('isolated-capstone', 'A course capstone must apply at least three previously taught skills.', lesson.lesson_id);
    const unitPosition = blueprint.units.findIndex(unit => unit.id === lesson.unit_id);
    if (unitPosition < previousUnit) fail('unit-order', 'Units must be contiguous and ordered so generated runtime order preserves prerequisites.', lesson.lesson_id);
    previousUnit = unitPosition;
    if (!units.has(lesson.unit_id)) fail('unknown-unit', 'Lesson has no declared unit.', lesson.lesson_id);
    const skill = skills.get(lesson.primary_skill);
    const plan = byId.get(lesson.lesson_id);
    if (!skill) fail('unknown-skill', `Unknown primary skill ${lesson.primary_skill}.`, lesson.lesson_id);
    if (!plan) fail('missing-plan', 'Blueprint lesson has no authored plan; the course is incomplete.', lesson.lesson_id);
    else {
      if (plan.course_id !== blueprint.course_id || plan.pathway_id !== blueprint.pathway_id || plan.age_band !== blueprint.age_band) fail('wrong-pathway', 'Authored identity does not match the blueprint.', lesson.lesson_id);
      if (plan.chapter_id !== lesson.unit_id) fail('unit-drift', 'Authored chapter differs from the curriculum unit.', lesson.lesson_id);
      for (const finding of checkInstructionalContract(plan, true)) fail('instructional-contract', finding.message, lesson.lesson_id);
      if (plan.instruction?.objective.skill_id !== lesson.primary_skill) fail('objective-drift', 'Authored primary skill differs from the course objective.', lesson.lesson_id);
      if (plan.instruction?.kind !== lesson.kind) fail('kind-drift', 'Lesson teaching/review role differs from the curriculum.', lesson.lesson_id);
      if (plan.instruction && [...plan.instruction.retrieval_skills].sort().join('|') !== [...lesson.retrieve_skills].sort().join('|')) fail('retrieval-drift', 'Lesson and curriculum declare different retrieval skills.', lesson.lesson_id);
      if (skill && !plan.knowledge_component_ids.includes(skill.knowledge_component_id)) fail('kc-drift', 'The emitted lesson does not map to the skill shared KC.', lesson.lesson_id);
      if (skill && plan.instruction && [...skill.prerequisites].sort().join('|') !== [...plan.instruction.prerequisite_skills].sort().join('|')) fail('prerequisite-drift', 'Lesson and curriculum declare different prerequisites.', lesson.lesson_id);
      for (const item of plan.instruction?.evidence ?? []) {
        const segment = plan.segments.find(candidate => candidate.id === item.segment_id);
        const expectedKc = skills.get(item.skill_id)?.knowledge_component_id;
        if (segment?.grading === 'server' && (!expectedKc || segment.knowledge_component_id !== expectedKc || !plan.knowledge_component_ids.includes(expectedKc))) fail('item-kc-drift', `${item.segment_id} would credit a different skill than the one assessed.`, lesson.lesson_id);
      }
      for (const recall of lesson.retrieve_skills) {
        if (!plan.instruction?.evidence.some(item => item.skill_id === recall && plan.segments.some(segment => segment.id === item.segment_id && ['practice', 'transfer'].includes(segment.teaching_role ?? '')))) fail('missing-retrieval-evidence', `${recall} needs an actual independent retrieval exercise.`, lesson.lesson_id);
      }
    }
    for (const prerequisite of skill?.prerequisites ?? []) if (!introduced.has(prerequisite)) fail('untaught-prerequisite', `${prerequisite} has not been taught earlier.`, lesson.lesson_id);
    for (const recall of lesson.retrieve_skills) {
      const first = introduced.get(recall);
      // An intervening lesson is a structural floor, not a claim about elapsed-time spacing.
      if (first === undefined || position - first < 2) fail('unspaced-retrieval', `${recall} needs prior teaching and an intervening lesson.`, lesson.lesson_id);
      else retrieved.add(recall);
    }
    if (lesson.kind === 'teach') {
      if (introduced.has(lesson.primary_skill)) fail('duplicate-introduction', 'Use consolidate for a previously introduced skill.', lesson.lesson_id);
      else introduced.set(lesson.primary_skill, position);
    } else if (!introduced.has(lesson.primary_skill)) fail('untaught-assessment', 'Consolidation or capstone cannot introduce an untaught primary skill.', lesson.lesson_id);
  });
  for (const skill of blueprint.skills) {
    if (!introduced.has(skill.id)) fail('uncovered-skill', `${skill.id} has no teaching lesson.`);
    if (!retrieved.has(skill.id)) fail('unrevisited-skill', `${skill.id} has no later independent retrieval evidence.`);
  }
  for (const plan of plans) if (!lessons.has(plan.lesson_id)) fail('unplanned-lesson', 'Authored plan is absent from the blueprint.', plan.lesson_id);
  for (const unit of blueprint.units) {
    const count = blueprint.lessons.filter(lesson => lesson.unit_id === unit.id).length;
    if (!count) fail('empty-unit', `${unit.id} has no authored lesson allocation.`);
    else if (count < 3 || count > 6) fail('unit-size', `${unit.id} has ${count} lessons; a runtime chapter holds 3 to 6.`);
  }
  if (!blueprint.lessons.some(lesson => lesson.kind === 'capstone')) fail('missing-capstone', 'The course needs an integrated application after teaching.');
  return problems;
}
