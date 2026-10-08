#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;

export function validateActivationManifest(manifest) {
  if (manifest?.version !== 1 || manifest?.decision !== 'OD-22') throw new Error('invalid OD-22 activation manifest header');
  if (!Array.isArray(manifest.required_courses) || manifest.required_courses.length !== 1 || manifest.required_courses[0] !== 'financial-education') {
    throw new Error('OD-22 activation is limited to the financial-education release');
  }
  if (!Array.isArray(manifest.activations) || manifest.activations.length === 0) throw new Error('OD-22 activation manifest is empty');
  const keys = new Set();
  for (const item of manifest.activations) {
    if (!/^[a-z0-9][a-z0-9_.-]{2,95}$/.test(item?.key ?? '')) throw new Error(`invalid KC key: ${item?.key ?? ''}`);
    if (!/^financial-education\/[a-z0-9][a-z0-9-]{2,127}$/.test(item?.skill_key ?? '')) {
      throw new Error(`KC ${item.key} does not map to a financial-education topic`);
    }
    if (keys.has(item.key)) throw new Error(`duplicate KC key: ${item.key}`);
    keys.add(item.key);
  }
  return manifest;
}

export function renderActivationSql(input) {
  const manifest = validateActivationManifest(input);
  const values = manifest.activations.map(({ key, skill_key }) => `  (${quote(key)}, ${quote(skill_key)})`).join(',\n');
  const expected = manifest.activations.length;
  return `-- OD-22: activate only KCs with a live financial-education teaching bridge.
BEGIN;
LOCK TABLE public.kc, public.courses, public.adventures, public.sagas, public.topics,
  public.lessons, public.topic_knowledge_components IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE lf_od22_activation (key text PRIMARY KEY, skill_key text NOT NULL) ON COMMIT DROP;
INSERT INTO lf_od22_activation (key, skill_key) VALUES
${values};

DO $od22$
DECLARE
  v_changed integer := 0;
BEGIN
  IF (SELECT count(*) FROM lf_od22_activation) <> ${expected} THEN
    RAISE EXCEPTION 'OD-22 manifest row count changed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM lf_od22_activation a LEFT JOIN public.kc k ON k.key = a.key WHERE k.id IS NULL
  ) THEN
    RAISE EXCEPTION 'OD-22 activation references a missing KC';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.courses WHERE slug = 'financial-education' AND status = 'published'
  ) THEN
    RAISE EXCEPTION 'OD-22 activation refused: financial-education is not published';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM lf_od22_activation x
    WHERE 1 <> (
      SELECT count(*)
      FROM public.courses c
      JOIN public.adventures a ON a.course_id = c.id
      JOIN public.sagas s ON s.adventure_id = a.id
      JOIN public.topics t ON t.saga_id = s.id
      JOIN public.topic_knowledge_components tkc ON tkc.topic_id = t.id AND tkc.role = 'teaches'
      JOIN public.kc k ON k.id = tkc.kc_id AND k.key = x.key
      WHERE c.slug = split_part(x.skill_key, '/', 1)
        AND t.slug = split_part(x.skill_key, '/', 2)
        AND c.status = 'published' AND a.status = 'published'
        AND s.status = 'published' AND t.status = 'published'
        AND EXISTS (SELECT 1 FROM public.lessons l WHERE l.topic_id = t.id AND l.status = 'published')
    )
  ) THEN
    RAISE EXCEPTION 'OD-22 activation refused: a KC lacks exactly one live teaching bridge';
  END IF;

  UPDATE public.kc k
  SET status = 'active', skill_key = x.skill_key, updated_at = now()
  FROM lf_od22_activation x
  WHERE k.key = x.key
    AND (k.status, k.skill_key) IS DISTINCT FROM ('active', x.skill_key);
  GET DIAGNOSTICS v_changed = ROW_COUNT;

  IF v_changed > 0 THEN
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (NULL, 'content.kc_od22_activated', 'financial-education',
      jsonb_build_object('decision', 'OD-22', 'activated_or_repaired', v_changed, 'manifest_count', ${expected}));
  END IF;

  IF EXISTS (
    SELECT 1 FROM lf_od22_activation x JOIN public.kc k ON k.key = x.key
    WHERE k.status <> 'active' OR k.skill_key IS DISTINCT FROM x.skill_key
  ) THEN
    RAISE EXCEPTION 'OD-22 activation postcondition failed';
  END IF;
END
$od22$;
COMMIT;
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const manifestPath = fileURLToPath(new URL('../../database/seeds/kc_activation.od22.json', import.meta.url));
  process.stdout.write(renderActivationSql(JSON.parse(readFileSync(manifestPath, 'utf8'))));
}
