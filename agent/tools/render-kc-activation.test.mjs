import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {generateActivationManifest,validateActivationManifest,renderActivationSql} from './render-kc-activation.mjs';

const blueprint=JSON.parse(readFileSync(new URL('../../coursegen/curriculum-production/financial-education/complete-source/blueprint.json',import.meta.url),'utf8'));
const manifest=generateActivationManifest(blueprint);
test('production manifest covers all 294 lessons and exactly 236 distinct teaching bridges',()=>{
 assert.equal(manifest.expected_lessons,294);assert.equal(manifest.expected_teaching,236);
 assert.equal(new Set(manifest.activations.map(row=>row.key)).size,236);
 const reviews=new Set(blueprint.lessons.filter(row=>row.kind!=='teach').map(row=>row.lesson_id));
 assert.ok(manifest.activations.every(row=>!reviews.has(row.lesson_slug)));
 const saved=JSON.parse(readFileSync(new URL('../../database/seeds/kc_activation.financial-production.json',import.meta.url),'utf8'));
 assert.deepEqual(saved,manifest);
});
test('rejects an incomplete or ambiguous teaching curriculum',()=>{
 for(const mutate of [b=>b.lessons.splice(b.lessons.findIndex(r=>r.kind==='teach'),1),b=>b.skills.push(b.skills[0]),b=>b.lessons.push(b.lessons.find(r=>r.kind==='teach')),b=>b.publication_intent='draft',b=>b.lessons[0].unit_id='missing-unit']){
  const candidate=structuredClone(blueprint);mutate(candidate);assert.throws(()=>generateActivationManifest(candidate));
 }
});
test('rejects corrupted counts, duplicate bridges and unsafe identifiers',()=>{
 for(const mutate of [m=>m.expected_teaching--,m=>m.catalog.push(m.catalog[0]),m=>m.activations[1].key=m.activations[0].key,m=>m.activations[0].skill_key='other-course/topic',m=>m.activations[0].lesson_slug='unknown-lesson',m=>m.course_slug="unsafe';delete",m=>m.catalog[0].topic_slug="unsafe';delete"]){
  const candidate=structuredClone(manifest);mutate(candidate);assert.throws(()=>validateActivationManifest(candidate));
 }
});
test('SQL locks mutable release inputs and fails closed before activation',()=>{
 const sql=renderActivationSql(manifest);
 assert.match(sql,/BEGIN;[\s\S]*LOCK TABLE[\s\S]*lesson_stage3_review_items IN SHARE ROW EXCLUSIVE MODE/);
 for(const guard of ['forge_release_verification_refusal','forge_release_catalog_fingerprint',"t.kind='teaching'","tkc.role='teaches' AND tkc.is_primary","v.schema_version=2","v.locale=p.locale","v.lesson_id=p.lesson_id","v.document->'knowledge_component_ids'","p.locale IN ('en-US','es-MX','pt-BR')","l.status<>'archived'","parent.status<>'active'"]){
  assert.ok(sql.indexOf(guard)>0&&sql.indexOf(guard)<sql.indexOf('UPDATE public.kc'),guard);
 }
 assert.match(sql,/FROM lf_kc_activation x WHERE k.key=x.key AND \(k.status,k.skill_key\) IS DISTINCT FROM/);
 assert.doesNotMatch(sql,/\bDELETE\b|\bTRUNCATE\b|UPDATE public\.(learner_kc_mastery|kc_attempt)/);
 assert.match(sql,/IF v_changed>0 THEN[\s\S]*content.kc_catalog_activated/);
 assert.match(sql,/COMMIT;\s*$/);
});
