import {describe,expect,it} from 'vitest';
import {kcSeedRows,parseSeedOptions,readSeedFiles,seedKcCatalog} from '../scripts/seed-kc-graph.js';
import type {RestFn} from '../services/pathway/topicKcSeed.js';
type RestInit = Parameters<RestFn>[1];

describe('KC metadata seeding preserves released operational identity',()=>{
 const {seed,activation}=readSeedFiles();
 const deferred=new Set(activation.activations.map(row=>row.key));
 it('keeps every operational field out of updates while retaining legacy insertion policy',()=>{
  const {insertRows,metadataRows}=kcSeedRows(seed.kcs,deferred);
  for(const row of metadataRows) for(const field of ['id','status','skill_key']) expect(row).not.toHaveProperty(field);
  for(const row of insertRows.filter(row=>deferred.has(row.key))){expect(row.status).toBe('draft');expect(row.skill_key).toBeNull();}
  expect(insertRows.find(row=>row.key.startsWith('finance.prod.'))?.status).toBe('draft');
 });
 it('a second seed cannot demote or retarget an already activated KC',async()=>{
  const kc=seed.kcs.find(row=>row.key.startsWith('finance.prod.'))!;
  const stored:Record<string,unknown>={id:'preserved-uuid',...kc,status:'active',skill_key:'financial-education/live-topic'};
  const rest:RestFn=async<T>(_path:string,init:RestInit)=>{
   if(init?.method==='POST') expect(init.headers?.Prefer).toContain('resolution=ignore-duplicates');
   else if(init?.method==='PATCH') Object.assign(stored,JSON.parse(init.body!));
   else throw Error('Unexpected write');
   return {} as T;
  };
  await seedKcCatalog(rest,[kc],deferred);await seedKcCatalog(rest,[kc],deferred);
  expect(stored).toMatchObject({id:'preserved-uuid',status:'active',skill_key:'financial-education/live-topic'});
 });
 it('stops on insert or metadata write failure',async()=>{
  const failed:RestFn=async()=>null;
  await expect(seedKcCatalog(failed,[seed.kcs[0]!],deferred)).rejects.toThrow('KC insert failed');
  const failedPatch:RestFn=async<T>(_path:string,init:RestInit)=>init?.method==='POST'?{} as T:null;
  await expect(seedKcCatalog(failedPatch,[seed.kcs[0]!],deferred)).rejects.toThrow('KC metadata update failed');
 });
 it('requires an explicit hierarchy option without changing the legacy default',()=>{
  expect(parseSeedOptions([])).toEqual({});expect(parseSeedOptions(['--hierarchy','release/hierarchy.rows.json'])).toEqual({hierarchyPath:'release/hierarchy.rows.json'});
  expect(()=>parseSeedOptions(['--unknown','file'])).toThrow();expect(()=>parseSeedOptions(['--hierarchy'])).toThrow();
 });
});
