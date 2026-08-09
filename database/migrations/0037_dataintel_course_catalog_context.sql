-- 0037_dataintel_course_catalog_context.sql
--
-- Preserves published course metadata alongside each lesson in the read-only
-- Data Intel catalog feed. DuckDB remains a derived warehouse; this only
-- gives staff enough context to interpret course- and lesson-level evidence.

DROP VIEW IF EXISTS public.dataintel_lessons_sync;

CREATE OR REPLACE VIEW public.dataintel_lessons_sync AS
SELECT
  l.id AS lesson_id,
  l.slug,
  l.title->>'en-US' AS title_en,
  l.title->>'es-MX' AS title_es,
  l.title->>'pt-BR' AS title_pt,
  c.id AS course_id,
  c.slug AS course_slug,
  c.title->>'en-US' AS course_title_en,
  c.title->>'es-MX' AS course_title_es,
  c.title->>'pt-BR' AS course_title_pt,
  COALESCE(
    (SELECT jsonb_array_length(document->'segments')
     FROM public.lesson_documents ld
     WHERE ld.lesson_id = l.id AND ld.locale = 'en-US'
     LIMIT 1),
    0
  ) AS segment_count
FROM public.lessons l
JOIN public.topics t ON t.id = l.topic_id
JOIN public.sagas s ON s.id = t.saga_id
JOIN public.adventures a ON a.id = s.adventure_id
JOIN public.courses c ON c.id = a.course_id
WHERE l.status = 'published';

REVOKE ALL ON public.dataintel_lessons_sync FROM public, anon, authenticated;
GRANT SELECT ON public.dataintel_lessons_sync TO service_role;
