import {readFileSync} from 'node:fs';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {eligibleMentorKcs,eligibleMentorSkills} from '../services/pedagogy/kcEligibility.js';
import {serviceRest} from '../services/supabaseRest.js';
import {readAgeScreen} from '../services/ageScreen.js';
import type {KcRow} from '../services/pedagogy/kcData.js';
import {getActiveKcs,getKcEdges,getLearnerMastery,getMemoryCards,getCorrectStreaks,getMisconceptionsForKcs} from '../services/pedagogy/kcData.js';
import {buildSessionPlan} from '../services/pedagogy/sessionPlan.js';
import {buildTutorMap} from '../services/pedagogy/tutorMap.js';
vi.mock('../services/supabaseRest.js',()=>({serviceRest:vi.fn()}));
vi.mock('../services/ageScreen.js',()=>({readAgeScreen:vi.fn()}));
vi.mock('../services/pedagogy/mentorIntegrity.js',()=>({getMasteryRollbackKcKeys:async()=>new Set()}));
vi.mock('../services/pedagogy/kcData.js',async importOriginal=>({
 ...await importOriginal<typeof import('../services/pedagogy/kcData.js')>(),
 getActiveKcs:vi.fn(),getKcEdges:vi.fn(),getLearnerMastery:vi.fn(),getMemoryCards:vi.fn(),getCorrectStreaks:vi.fn(),getMisconceptionsForKcs:vi.fn(),
}));
const blueprint=JSON.parse(readFileSync(new URL('../../../coursegen/curriculum-production/financial-education/complete-source/blueprint.json',import.meta.url),'utf8')) as {lessons:Array<{kind:string;lesson_id:string;primary_skill:string}>};
const teaching=blueprint.lessons.filter(row=>row.kind==='teach');
const kcs=teaching.map(row=>({id:row.lesson_id,key:row.primary_skill,tier_min:3,skill_key:`financial-education/${row.lesson_id}`,
 strand:'money_life',title:{'en-US':row.lesson_id},objective:{'en-US':'Test objective'},p_l0:0.25,p_t:0.15,p_g:0.2,p_s:0.1})) as KcRow[];
const chapters=[{id:'adult-chapter',age_tier:'tier3',pathway_stage:'adult',eligibility_min_age:18,eligibility_max_age:null,courses:{slug:'financial-education'},sagas:[{topics:teaching.map(row=>({id:row.lesson_id,slug:row.lesson_id}))}]}];
describe('adult Mentor eligibility reuses stored age and chapter policy',()=>{
 beforeEach(()=>{
  vi.resetAllMocks();
  vi.mocked(readAgeScreen).mockResolvedValue({required:false,ageBand:'under_13',protectedOrigin:false} as Awaited<ReturnType<typeof readAgeScreen>>);
  vi.mocked(serviceRest).mockImplementation(async<T>(path:string)=> (path.startsWith('/adventures?')?chapters:[{birth_date:null}]) as T);
  vi.mocked(getActiveKcs).mockResolvedValue(kcs);
  vi.mocked(getKcEdges).mockResolvedValue([]);vi.mocked(getLearnerMastery).mockResolvedValue([]);
  vi.mocked(getMemoryCards).mockResolvedValue([]);vi.mocked(getCorrectStreaks).mockResolvedValue(new Map());vi.mocked(getMisconceptionsForKcs).mockResolvedValue([]);
 });
 it.each(['under_13','13_to_17',null] as const)('excludes all236 adult bridges for age evidence %s without changing unmapped history',async ageBand=>{
  vi.mocked(readAgeScreen).mockResolvedValue({required:ageBand===null,ageBand,protectedOrigin:false} as Awaited<ReturnType<typeof readAgeScreen>>);
  const historical={id:'legacy',key:'legacy',tier_min:1,skill_key:null} as KcRow;
  expect(await eligibleMentorKcs('learner',[...kcs,historical])).toEqual([historical]);
 });
 it('allows all236 for screened adults',async()=>{
  vi.mocked(readAgeScreen).mockResolvedValue({required:false,ageBand:'adult',protectedOrigin:false} as Awaited<ReturnType<typeof readAgeScreen>>);
  expect(await eligibleMentorKcs('learner',kcs)).toHaveLength(236);
 });
 it('protected origin overrides an adult declaration',async()=>{
  vi.mocked(readAgeScreen).mockResolvedValue({required:false,ageBand:'adult',protectedOrigin:true} as Awaited<ReturnType<typeof readAgeScreen>>);
  expect(await eligibleMentorKcs('learner',kcs)).toEqual([]);
 });
 it('fails closed on scope or profile read failures',async()=>{
  vi.mocked(serviceRest).mockResolvedValue(null);
  expect(await eligibleMentorKcs('learner',kcs)).toBeNull();
  vi.mocked(serviceRest).mockImplementation(async<T>(path:string)=> (path.startsWith('/adventures?')?chapters:null) as T);
  expect(await eligibleMentorKcs('learner',kcs)).toBeNull();
 });
 it('guards direct topic requests while leaving existing non-adult skill policy unchanged',async()=>{
  expect(await eligibleMentorSkills('learner',[`topic:${teaching[0]!.lesson_id}`,'legacy-course/child-topic'])).toEqual(new Set(['legacy-course/child-topic']));
 });
 it('a curated kc: alias cannot bypass the age restriction on its bound adult topic',async()=>{
  vi.mocked(serviceRest).mockImplementation(async<T>(path:string)=> (path.startsWith('/adventures?')?chapters:path.startsWith('/kc?')?[{key:kcs[0]!.key,skill_key:kcs[0]!.skill_key}]:[{birth_date:null}]) as T);
  expect(await eligibleMentorSkills('learner',[`kc:${kcs[0]!.key}`])).toEqual(new Set());
 });
 it('actual tier3 planner and map expose no adult KC to a minor, then expose eligible adult targets',async()=>{
  expect(await buildSessionPlan('learner',3,'en-US')).toEqual({plan:[],kcStates:[]});
  expect((await buildTutorMap('learner',3,'en-US'))?.nodes).toEqual([]);
  vi.mocked(readAgeScreen).mockResolvedValue({required:false,ageBand:'adult',protectedOrigin:false} as Awaited<ReturnType<typeof readAgeScreen>>);
  expect((await buildSessionPlan('learner',3,'en-US'))!.plan.length).toBeGreaterThan(0);
  expect((await buildTutorMap('learner',3,'en-US'))?.nodes).toHaveLength(236);
 });
});
