import { makeLesson, examples, choice } from './assemble.mjs';
import { blueprint } from './outline.mjs';
// Transpose explicitly authored fields; no translation or content generation occurs here.
export const item = (id, role, answer, prompt, scene, options, met, retry) => choice(id, role, '', answer,
  [0, 1, 2].map(i => [prompt[i], scene[i], options[i], met[i], retry[i]]));
export const example = examples;
export function lesson(number, title, outcome, misconception, relevance, segments, evidenceSkills = {}) {
  const entry = blueprint.lessons.find(row => row.lesson_id.startsWith(`fe-solid-${number}-`));
  const skill = blueprint.skills.find(row => row.id === entry.primary_skill);
  return makeLesson({ number, slug: entry.lesson_id.slice(12), unit: entry.unit_id, title,
    skill: entry.primary_skill, prerequisites: skill.prerequisites, retrieve: entry.retrieve_skills,
    kind: entry.kind, outcome, misconception, relevance, segments, evidenceSkills,
    numeracy: 'Use only the stated quantities, dates and conditions; distinguish a modeled result from a guarantee.' });
}
