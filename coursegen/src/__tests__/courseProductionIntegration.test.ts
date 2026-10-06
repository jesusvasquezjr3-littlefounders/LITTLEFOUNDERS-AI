import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { v2LessonPlanSchema, type V2LessonPlan } from '../v2/plan.js';
import { checkInstructionalContract } from '../v2/instructionalContract.js';

const entry = new URL('../../curriculum-production/financial-education/authoring/collect-production.mjs', import.meta.url);
const inventory = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e',
  `import {collectProduction} from ${JSON.stringify(entry.href)};console.log(JSON.stringify(collectProduction()));`],
{encoding:'utf8', maxBuffer:32 * 1024 * 1024}));
const graph = JSON.parse(readFileSync(new URL('../../../database/seeds/kc_graph.v1.json',import.meta.url),'utf8')) as { edges: string[][] };
const plans: V2LessonPlan[] = inventory.plans.map((raw: unknown) => v2LessonPlanSchema.parse(raw));

describe('shared production author integration', () => {
  it('keeps missing lessons explicit and every collected plan on the complete ordered design', () => {
    const authored = new Set(plans.map((plan: {lesson_id: string}) => plan.lesson_id));
    expect(authored.size).toBe(plans.length);
    const all = inventory.blueprint.lessons.map((row: {lesson_id:string}) => row.lesson_id);
    expect([...authored].every(id => all.includes(id))).toBe(true);
    expect(inventory.missingLessons).toEqual(all.filter((id:string) => !authored.has(id)));
    expect(plans.length + inventory.missingLessons.length).toBe(all.length);
  });

  it('reconciles canonical prerequisites without silently weakening shared KC edges', () => {
    const skills = new Map<string, {knowledge_component_id:string; prerequisites:string[]}>(inventory.blueprint.skills.map((row: {id:string;knowledge_component_id:string;prerequisites:string[]}) => [row.id,row]));
    for (const skill of skills.values()) {
      const required = graph.edges.filter(edge => edge[1] === skill.knowledge_component_id).map(edge => edge[0]);
      const declared = skill.prerequisites.map(key => skills.get(key)?.knowledge_component_id);
      for (const key of required) expect(declared,skill.knowledge_component_id).toContain(key);
    }
    for (const plan of plans) {
      expect(plan.instruction?.prerequisite_skills,plan.lesson_id).toEqual(skills.get(plan.instruction!.objective.skill_id)?.prerequisites);
      expect(checkInstructionalContract(plan,true),plan.lesson_id).toEqual([]);
    }
  });

  it('splits subject domains into playable chapters without changing lesson order', () => {
    const flattened = inventory.blueprint.units.flatMap((unit: {id:string}) => {
      const lessons = inventory.blueprint.lessons.filter((row: {unit_id:string}) => row.unit_id === unit.id);
      expect(lessons.length).toBeGreaterThanOrEqual(3);
      expect(lessons.length).toBeLessThanOrEqual(6);
      return lessons.map((row:{lesson_id:string}) => row.lesson_id);
    });
    expect(flattened).toEqual(inventory.blueprint.lessons.map((row:{lesson_id:string}) => row.lesson_id));
    for (const plan of plans) expect(plan.chapter_id).toBe(inventory.blueprint.lessons.find((row:{lesson_id:string}) => row.lesson_id === plan.lesson_id).unit_id);
  });

  it('reserves player labels when checking full story screens before compilation', () => {
    const guard = new URL('../../curriculum-production/financial-education/authoring/screen-copy.mjs', import.meta.url);
    const result = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e',
      `import {collectProduction} from ${JSON.stringify(entry.href)};
       import {storyCopyProblems} from ${JSON.stringify(guard.href)};
       const plans=collectProduction().plans;
       const clean=storyCopyProblems(plans);
       const plan=structuredClone(plans.find(p=>p.segments.some(s=>s.type==='story.branch.v2')));
       plan.segments=plan.segments.filter(s=>s.type==='story.branch.v2').slice(0,1);
       const copy=plan.segments[0].copy['en-US'];
       plan.title['en-US']='Two words';copy.prompt='Choose';copy.scene=Array(28).fill('word').join(' ');
       copy.options=[{label:'First'},{label:'Second'},{label:'Third'}];
       console.log(JSON.stringify({clean,overflow:storyCopyProblems([plan])}));`],
      {encoding:'utf8',maxBuffer:1024*1024}));
    expect(result.clean).toEqual([]);
    expect(result.overflow).toEqual([expect.objectContaining({locale:'en-US',words:41,limit:40})]);
  });

  it('refuses a complete-source write while any lesson or localized competence is missing', () => {
    if (!inventory.missingLessons.length && !inventory.missingTranslations.length) return;
    expect(() => execFileSync(process.execPath,[fileURLToPath(entry)],{stdio:'pipe'})).toThrow();
  });
});
