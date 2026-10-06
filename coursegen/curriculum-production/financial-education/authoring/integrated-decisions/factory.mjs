import { makeLesson } from '../../../../curriculum-recovery/financial-education/authoring/assemble.mjs';
import { sequence } from '../factory.mjs';
export { Q, numeric, input, subtract, add } from '../factory.mjs';

export function capstone(number, resolveSkill, title, relevance, misconception, author) {
  const lessonId = `fe-production-integrated-decisions-${String(number).padStart(2, '0')}`;
  const design = sequence.lessons.find(row => row.lesson_id === lessonId);
  const references = design.retrieve_objectives;
  const skills = references.map(resolveSkill);
  if (skills.some(skill => !skill)) throw new Error(`Unmapped capstone retrieval: ${lessonId}`);
  const primaryDesign = sequence.lessons.find(row => row.lesson_id === references[0]);
  const { segments, evidence } = author(skills);
  const plan = makeLesson({ number, slug: `integrated-decisions-${number}`, unit: 'fe-production-integrated-decisions',
    title, relevance, misconception, skill: skills[0], kind: 'capstone',
    prerequisites: [...new Set(primaryDesign.prerequisites.map(resolveSkill))], retrieve: skills,
    outcome: design.objective,
    numeracy: 'Use the explicitly stated totals, deadlines and constraints. Earlier financial arithmetic is retrieved; no current rate or legal entitlement is implied.',
    segments, evidenceSkills: Object.fromEntries(evidence.map((skillIndex, index) => [segments[index].id, skills[skillIndex]])),
  });
  plan.lesson_id = lessonId;
  plan.instruction.delayed_retrieval.fresh_context = 'Retrieve this competence through the shared review system in another household scenario with different constraints.';
  return plan;
}
