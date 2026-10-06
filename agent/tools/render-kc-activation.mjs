#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';

const slug=/^[a-z0-9][a-z0-9-]{2,127}$/u;
const keyPattern=/^[a-z0-9][a-z0-9_.-]{2,95}$/u;
const quote=value=>`'${String(value).replaceAll("'","''")}'`;
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Pure generation from a reviewed blueprint; no database or provider access. */
export function generateActivationManifest(blueprint){
 if(blueprint?.version!==1||blueprint.publication_intent!=='release-candidate'||!slug.test(blueprint.course_id??''))throw Error('A release-candidate blueprint is required');
 if(!Array.isArray(blueprint.skills)||!Array.isArray(blueprint.lessons)||!Array.isArray(blueprint.units))throw Error('Incomplete blueprint');
 const skills=new Map(blueprint.skills.map(row=>[row.id,row]));
 const units=new Set(blueprint.units.map(row=>row.id));
 if(skills.size!==blueprint.skills.length||units.size!==blueprint.units.length)throw Error('Duplicate blueprint skills or units');
 const teaching=blueprint.lessons.filter(row=>row.kind==='teach');
 const taught=new Set(teaching.map(row=>row.primary_skill));
 if(taught.size!==teaching.length||taught.size!==skills.size||[...skills.keys()].some(id=>!taught.has(id)))throw Error('Each blueprint skill needs exactly one teaching lesson');
 for(const row of blueprint.lessons){
  if(!units.has(row.unit_id)||!skills.has(row.primary_skill)||!['teach','consolidate','capstone'].includes(row.kind))throw Error('Unknown lesson unit, skill or kind');
 }
 return validateActivationManifest({version:2,course_slug:blueprint.course_id,blueprint_sha256:digest(blueprint),
  expected_lessons:blueprint.lessons.length,expected_teaching:teaching.length,
  catalog:blueprint.lessons.map(row=>({adventure_slug:row.unit_id,saga_slug:row.unit_id,topic_slug:row.lesson_id,lesson_slug:row.lesson_id})),
  activations:teaching.map(row=>({key:skills.get(row.primary_skill).knowledge_component_id,
   skill_key:`${blueprint.course_id}/${row.lesson_id}`,adventure_slug:row.unit_id,saga_slug:row.unit_id,topic_slug:row.lesson_id,lesson_slug:row.lesson_id})),
 });
}

export function validateActivationManifest(manifest){
 if(manifest?.version!==2||!slug.test(manifest.course_slug??'')||!/^[a-f0-9]{64}$/u.test(manifest.blueprint_sha256??''))throw Error('Invalid production activation header');
 if(!Number.isInteger(manifest.expected_lessons)||!Number.isInteger(manifest.expected_teaching)||manifest.expected_teaching<1||manifest.expected_lessons<manifest.expected_teaching)throw Error('Invalid expected counts');
 if(!Array.isArray(manifest.catalog)||manifest.catalog.length!==manifest.expected_lessons||!Array.isArray(manifest.activations)||manifest.activations.length!==manifest.expected_teaching)throw Error('Manifest counts disagree');
 const pathOf=row=>[row.adventure_slug,row.saga_slug,row.topic_slug,row.lesson_slug].join('/');
 const catalog=new Set(),lessons=new Set();
 for(const row of manifest.catalog){
  if(['adventure_slug','saga_slug','topic_slug','lesson_slug'].some(field=>!slug.test(row[field]??'')))throw Error('Invalid catalog path');
  if(catalog.has(pathOf(row))||lessons.has(row.lesson_slug))throw Error('Duplicate catalog lesson');
  catalog.add(pathOf(row));lessons.add(row.lesson_slug);
 }
 const keys=new Set(),bridges=new Set();
 for(const row of manifest.activations){
  if(!keyPattern.test(row.key??'')||!catalog.has(pathOf(row))||row.skill_key!==`${manifest.course_slug}/${row.topic_slug}`||row.skill_key.length>128)throw Error('Invalid activation teaching bridge');
  if(keys.has(row.key)||bridges.has(pathOf(row)))throw Error('Duplicate activation KC or teaching bridge');
  keys.add(row.key);bridges.add(pathOf(row));
 }
 return manifest;
}

export function renderActivationSql(input){
 const m=validateActivationManifest(input);
 const paths=m.catalog.map(r=>`(${[r.adventure_slug,r.saga_slug,r.topic_slug,r.lesson_slug].map(quote).join(', ')})`).join(',\n');
 const rows=m.activations.map(r=>`(${[r.key,r.skill_key,r.adventure_slug,r.saga_slug,r.topic_slug,r.lesson_slug].map(quote).join(', ')})`).join(',\n');
 return `-- Activate the exact published teaching bridges; retain all historical identities and mastery.
-- Blueprint SHA-256: ${m.blueprint_sha256}
BEGIN;
LOCK TABLE public.kc, public.courses, public.adventures, public.sagas, public.topics,
 public.lessons, public.topic_knowledge_components, public.kc_edge,
 public.lesson_documents, public.lesson_document_versions, public.lesson_document_version_current,
 public.course_release_verifications, public.forge_release_gates, public.lesson_pedagogical_reviews,
 public.lesson_stage3_review_items IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE lf_kc_catalog (adventure_slug text, saga_slug text, topic_slug text, lesson_slug text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO lf_kc_catalog VALUES
${paths};
CREATE TEMP TABLE lf_kc_activation (key text PRIMARY KEY, skill_key text NOT NULL, adventure_slug text, saga_slug text, topic_slug text, lesson_slug text UNIQUE) ON COMMIT DROP;
INSERT INTO lf_kc_activation VALUES
${rows};

DO $activation$
DECLARE v_course uuid; v_changed integer; v_refusal text;
BEGIN
 IF (SELECT count(*) FROM public.courses WHERE slug=${quote(m.course_slug)} AND status='published') <> 1 THEN
  RAISE EXCEPTION 'Activation requires exactly one published course';
 END IF;
 SELECT id INTO v_course FROM public.courses WHERE slug=${quote(m.course_slug)} AND status='published';
 SELECT code INTO v_refusal FROM public.forge_release_verification_refusal(v_course) LIMIT 1;
 IF v_refusal IS NOT NULL THEN RAISE EXCEPTION 'Activation requires current release attestation: %',v_refusal; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.course_release_verifications v CROSS JOIN LATERAL jsonb_array_elements(v.checks) e
  WHERE v.course_id=v_course AND e->>'gate'='forge.release.lessons-complete'
   AND e->>'catalog_fingerprint'=public.forge_release_catalog_fingerprint(v_course)) THEN
  RAISE EXCEPTION 'Activation requires an attestation for this exact catalog';
 END IF;
 IF (SELECT count(*) FROM lf_kc_catalog)<>${m.expected_lessons} OR (SELECT count(*) FROM lf_kc_activation)<>${m.expected_teaching} THEN
  RAISE EXCEPTION 'Activation manifest count mismatch';
 END IF;
 IF EXISTS (SELECT 1 FROM lf_kc_catalog x WHERE 1<>(
  SELECT count(*) FROM public.courses c JOIN public.adventures a ON a.course_id=c.id
  JOIN public.sagas s ON s.adventure_id=a.id JOIN public.topics t ON t.saga_id=s.id JOIN public.lessons l ON l.topic_id=t.id
  WHERE c.id=v_course AND a.slug=x.adventure_slug AND s.slug=x.saga_slug AND t.slug=x.topic_slug AND l.slug=x.lesson_slug
   AND c.status='published' AND a.status='published' AND s.status='published' AND t.status='published' AND l.status='published'
 )) OR (SELECT count(*) FROM public.lessons l JOIN public.topics t ON t.id=l.topic_id
  JOIN public.sagas s ON s.id=t.saga_id JOIN public.adventures a ON a.id=s.adventure_id
  WHERE a.course_id=v_course AND l.status<>'archived')<>${m.expected_lessons} THEN
  RAISE EXCEPTION 'The complete published catalog differs from the activation source';
 END IF;
 IF EXISTS (SELECT 1 FROM public.lessons l JOIN public.topics t ON t.id=l.topic_id
  JOIN public.sagas s ON s.id=t.saga_id JOIN public.adventures a ON a.id=s.adventure_id
  WHERE a.course_id=v_course AND l.status='published' AND public.stage3_release_refusal(l.id) IS NOT NULL) THEN
  RAISE EXCEPTION 'Activation requires current passing Stage 3 review of every published lesson';
 END IF;
 IF EXISTS (SELECT 1 FROM lf_kc_activation x WHERE 1<>(
  SELECT count(*) FROM public.kc k JOIN public.topic_knowledge_components tkc ON tkc.kc_id=k.id
  JOIN public.topics t ON t.id=tkc.topic_id JOIN public.sagas s ON s.id=t.saga_id
  JOIN public.adventures a ON a.id=s.adventure_id JOIN public.lessons l ON l.topic_id=t.id
  WHERE a.course_id=v_course AND k.key=x.key AND a.slug=x.adventure_slug AND s.slug=x.saga_slug
   AND t.slug=x.topic_slug AND l.slug=x.lesson_slug AND t.kind='teaching'
   AND tkc.role='teaches' AND tkc.is_primary AND l.status='published'
   AND (SELECT count(*) FROM public.lesson_document_version_current p
    JOIN public.lesson_document_versions v ON v.id=p.document_version_id AND v.lesson_id=p.lesson_id AND v.locale=p.locale
    WHERE p.lesson_id=l.id AND p.locale IN ('en-US','es-MX','pt-BR')
     AND v.schema_version=2 AND v.document->>'lesson_id'=l.id::text AND v.document->>'locale'=p.locale
     AND v.document->'knowledge_component_ids' @> jsonb_build_array(k.key))=3
 )) THEN RAISE EXCEPTION 'A KC lacks its exact published teaching lesson and three current v2 locales'; END IF;
 IF EXISTS (SELECT 1 FROM public.kc_edge e JOIN public.kc child ON child.id=e.dependent_kc_id
  JOIN public.kc parent ON parent.id=e.prerequisite_kc_id JOIN lf_kc_activation x ON x.key=child.key
  WHERE parent.status<>'active' AND NOT EXISTS (SELECT 1 FROM lf_kc_activation y WHERE y.key=parent.key)) THEN
  RAISE EXCEPTION 'An activation prerequisite is neither active nor included';
 END IF;
 UPDATE public.kc k SET status='active',skill_key=x.skill_key,updated_at=now()
 FROM lf_kc_activation x WHERE k.key=x.key AND (k.status,k.skill_key) IS DISTINCT FROM ('active',x.skill_key);
 GET DIAGNOSTICS v_changed=ROW_COUNT;
 IF EXISTS (SELECT 1 FROM lf_kc_activation x LEFT JOIN public.kc k ON k.key=x.key
  WHERE k.id IS NULL OR k.status<>'active' OR k.skill_key IS DISTINCT FROM x.skill_key) THEN
  RAISE EXCEPTION 'Activation postcondition failed';
 END IF;
 IF v_changed>0 THEN
  INSERT INTO public.audit_logs(actor_id,action,subject,detail) VALUES(NULL,'content.kc_catalog_activated',${quote(m.course_slug)},
   jsonb_build_object('blueprint_sha256',${quote(m.blueprint_sha256)},'activated_or_repaired',v_changed,'manifest_count',${m.expected_teaching},'operator',session_user,'source','render-kc-activation.mjs'));
 END IF;
END
$activation$;
COMMIT;
`;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [mode,file,...extra]=process.argv.slice(2);
 if(extra.length||!file||!['--blueprint','--manifest'].includes(mode))throw Error('Usage: render-kc-activation.mjs --blueprint <blueprint.json> | --manifest <activation.json>');
 const value=JSON.parse(readFileSync(fileURLToPath(pathToFileURL(file)),'utf8'));
 process.stdout.write(mode==='--blueprint'?`${JSON.stringify(generateActivationManifest(value),null,2)}\n`:renderActivationSql(value));
}
