-- 0040_learning_events_conflict_target.sql — fix the client_event_id
-- idempotency index so PostgREST's on_conflict= can actually target it.
--
-- Production incident 2026-08-10. `0036` created
-- learning_events_client_event_id_unique as a PARTIAL unique index
-- (`WHERE client_event_id IS NOT NULL`). Postgres will only let
-- `ON CONFLICT (client_event_id)` infer a partial index if the ON CONFLICT
-- clause repeats the exact same WHERE predicate — and PostgREST's
-- `on_conflict=client_event_id` query param has no way to express that; it
-- always generates the unqualified form. Every POST /api/v1/events insert
-- (`insertLearningEvents`, `?on_conflict=client_event_id`) has therefore
-- failed since 0036 landed, with Postgres error 42P10 ("there is no unique
-- or exclusion constraint matching the ON CONFLICT specification") —
-- verified by reproducing the exact insert directly against Vault. Core
-- maps any non-2xx from Vault to null the same as an outage, so every
-- client's periodic analytics flush surfaced as a 502 in production logs,
-- indistinguishable from an infrastructure failure (which is where the
-- investigation started before landing here).
--
-- Fix: an ORDINARY (non-partial) unique index. Postgres unique indexes
-- already treat NULL as distinct from every other value, including other
-- NULLs (multiple NULL rows never violate uniqueness) — so dropping the
-- `WHERE client_event_id IS NOT NULL` predicate loses no guarantee the
-- partial index had. It only adds one thing: an unqualified index
-- `ON CONFLICT (client_event_id)` can actually infer.

DROP INDEX IF EXISTS public.learning_events_client_event_id_unique;

CREATE UNIQUE INDEX IF NOT EXISTS learning_events_client_event_id_unique
  ON public.learning_events (client_event_id);
