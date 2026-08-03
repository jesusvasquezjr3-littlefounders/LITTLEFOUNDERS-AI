-- 0032_lesson_illustration_style.sql — style-aware image inheritance.
--
-- Prism invalidates its request cache when the illustration identity changes,
-- but Forge also has a zero-cost inheritance path from previously published
-- lesson documents. Without a durable style marker that path could reattach
-- pre-v5/pre-v6 art to a new lesson and silently bypass the current flat-vector
-- + white-canvas contract. NULL deliberately means "legacy/unknown" and is
-- never eligible for inheritance.

alter table public.lesson_documents
  add column if not exists illustration_style_version text;

comment on column public.lesson_documents.illustration_style_version is
  'Forge illustration identity used for this document; NULL is legacy/unknown and cannot be inherited into a newer run.';
