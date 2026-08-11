-- 0042_topic_prerequisites_and_placement_probe.sql — persist the competency-
-- graph projection COURSE_ENGINE.md §3.2 reserved for "the future
-- onboarding/placement phase". Mirrors 0016_topic_review_edges.sql exactly:
-- the catalog stays the source of truth, paths are RAW catalog slug paths
-- resolved at query time (never pre-resolved to ids, so a republish can't
-- go stale), and this is additive/default-safe.

ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS prerequisites jsonb NOT NULL DEFAULT '[]'::jsonb;

-- placement_probe shape (nullable — Core's placement algorithm treats a null
-- probe as "not yet authored", never a crash; see COURSE_ENGINE.md §3.2):
--   {"es-MX": {"prompt": "...", "options": ["...", "..."], "correctIndex": 0},
--    "en-US": {...}, "pt-BR": {...}}
-- Same per-locale-bundle idiom as topics.title/learning_objective.
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS placement_probe jsonb;
