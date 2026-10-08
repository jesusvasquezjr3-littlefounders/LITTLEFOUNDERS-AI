import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { makeLesson, examples, choice, percent } from '../../../../curriculum-recovery/financial-education/authoring/assemble.mjs';
export const sequence = JSON.parse(readFileSync(new URL('../../../../curriculum-design/financial-education/lesson-sequence.json', import.meta.url)));
export const T = text => text.split('|');
export const E = (id, title, text) => examples(id, T(title), T(text));
export const I = input => ({ input });
export const op = (op, a, b) => ({ op, args: [a, b] });
export const C = constant => ({ constant });
const opening = ['cash.direction','cash.received','cash.balance','cash.commitment','cash.reserved','cash.timing','cash.borrowing','cash.transfer','cash.uncertain'];
export const skillFor = id => id.startsWith('fe-production-usable-money-') ? opening[Number(id.split('-').at(-1))] : `production.${id.replace('fe-production-', '').replaceAll('-', '.')}`;
export function Q(id, role, scene, prompt, options, feedback, hint, proof) {
  const scenes = T(scene), prompts = T(prompt), answers = options.map(T), met = T(feedback), retry = T(hint);
  const result = choice(id, role, 'pending', 0, scenes.map((s,i)=>[prompts[i],s,answers.map(a=>a[i]),met[i],retry[i]]));
  if (proof) result.numeric_proof = { source:'scene', visible_inputs:proof[0], expression:proof[1] };
  return result;
}
export function grid(id, role, rate, prompt) {
  return percent(id,role,100,rate,T(prompt).map((p,i)=>[p,T('The selected percentage represents the stated share.|El porcentaje elegido representa la parte indicada.|A porcentagem escolhida representa a parte informada.')[i],T('The whole grid represents one hundred equal parts.|La cuadrícula completa representa cien partes iguales.|A grade inteira representa cem partes iguais.')[i]]));
}
export function lesson(domain, number, title, relevance, misconception, segments) {
  const id=`fe-production-${domain}-${String(number).padStart(2,'0')}`, design=sequence.lessons.find(x=>x.lesson_id===id);
  if (!design || design.kind!=='teach') throw new Error(`Unknown teaching lesson ${id}`);
  const result=makeLesson({number,slug:id,unit:`fe-production-${domain}`,title:T(title),skill:skillFor(id),prerequisites:design.prerequisites.map(skillFor),outcome:design.objective,misconception,relevance:T(relevance),numeracy:'The worked examples introduce the required operation; every assessed task retains its own amounts and assumptions.',segments});
  result.lesson_id=id; return result;
}
export function review(domain, number, title, relevance, segments, targets) {
  const id=`fe-production-${domain}-review-${number}`, design=sequence.lessons.find(x=>x.lesson_id===id);
  const primary=targets.at(-1), primaryDesign=sequence.lessons.find(x=>x.lesson_id===primary);
  const evidenceSkills=Object.fromEntries(segments.filter(x=>x.grading==='server').map((x,i)=>[x.id,skillFor(targets[i])]));
  for(const target of design.retrieve_objectives) if(!targets.includes(target)) throw new Error(`Missing retrieval ${target}`);
  const result=makeLesson({number,slug:id,unit:`fe-production-${domain}`,title:T(title),skill:skillFor(primary),prerequisites:primaryDesign.prerequisites.map(skillFor),retrieve:design.retrieve_objectives.map(skillFor),outcome:'Apply the previously taught financial relationships to the visible constraints of a new situation.',misconception:'Reuse an earlier answer without checking the current quantities, units and conditions.',relevance:T(relevance),numeracy:'All required quantities remain on the current board.',segments,evidenceSkills,kind:'consolidate'});
  result.lesson_id=id;return result;
}
export function write(plans) {
  const directory=new URL('./plans/',import.meta.url); mkdirSync(directory,{recursive:true});
  for(const p of plans) writeFileSync(new URL(`${p.lesson_id}.json`,directory),JSON.stringify(p,null,2)+'\n');
  const proposed=plans.filter(p=>p.instruction.kind==='teach').map(p=>({lesson_id:p.lesson_id,key:p.knowledge_component_ids[0],description:p.brief,status:'draft',prerequisite_lesson_ids:sequence.lessons.find(x=>x.lesson_id===p.lesson_id).prerequisites,proposed_prerequisite_keys:p.instruction.prerequisite_skills.map(x=>`finance.${x}`)}));
  writeFileSync(new URL('./proposed-skills.json',import.meta.url),JSON.stringify(proposed,null,2)+'\n');
  console.log(JSON.stringify({plans:plans.length,graded:plans.reduce((n,p)=>n+p.segments.filter(s=>s.grading==='server').length,0)}));
}
