-- 0056_recall_locale_aware_fts.sql — episodic recall's full-text search
-- stops hardcoding Spanish regardless of the session's actual locale.
-- @phase: expand
--
-- FOUND BY ADVERSARIAL REVIEW, 2026-08-30. 0053's own comment already named
-- this trade-off deliberately: "`spanish` covers es-MX, our primary locale;
-- for en-US/pt-BR content the match degrades to stemless term matching,
-- which is still useful and still indexed." Measured against a real local
-- Postgres, that claim does not hold. `to_tsvector('spanish', 'remember')`
-- produces the stem `rememb`, but `to_tsvector('spanish', 'remembered')`
-- produces the stem `remember` — TWO DIFFERENT stems for the SAME English
-- root depending on inflection, because the Spanish snowball stemmer is
-- actively mistransforming English (and Portuguese) words, not merely
-- leaving them unstemmed. A query built from one inflection cannot find
-- text stored in another, even under the identical config both actually
-- run — so recall for `en-US`/`pt-BR` sessions is not "degraded", it is
-- unpredictably broken, invisible in production because a failed/empty
-- recall degrades to the turn we already had (`oracle/AGENTS.md`, "V4 —
-- the harness subsystems"). On a platform whose recall trigger phrase list
-- (`RECALL_TRIGGER`, oracle/src/tutor/orchestrator.ts) is deliberately
-- trilingual, this silently defeated the feature for two of three locales.
--
-- THE FIX. `text_tsv` can no longer be a GENERATED column: the correct FTS
-- config for a row depends on `tutor_sessions.locale`, a SIBLING table a
-- generated expression cannot read. It becomes a plain column, maintained
-- by a BEFORE trigger that looks the session's locale up and picks the
-- matching Postgres text-search configuration. `search_tutor_turns` gains
-- the SAME mapping for the query side, keyed on the CALLING session's own
-- locale (the language a "¿te acuerdas...?"/"do you remember...?" question
-- is actually asked in), defaulting to `es-MX` for a caller that has not
-- been updated to send it yet — the same "expand-safe either side of the
-- code" contract 0053/0054 already use, since `search_tutor_turns` degrades
-- any RPC failure (a stale caller sending a 3-argument call still resolves
-- via the default) to an empty result, never an error a learner can see.
--
-- `tutor_fts_config` is IMMUTABLE and total over every locale this schema's
-- own CHECK constraints allow (`en-US`, `es-MX`, `pt-BR`) plus a safe
-- default for anything else, so it is usable both inside the generated-
-- column-turned-trigger and inside the search function without duplicating
-- the mapping.

CREATE OR REPLACE FUNCTION public.tutor_fts_config(p_locale text)
RETURNS regconfig
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE p_locale
        WHEN 'en-US' THEN 'english'::regconfig
        WHEN 'pt-BR' THEN 'portuguese'::regconfig
        ELSE 'spanish'::regconfig
    END;
$$;

-- Converts the generated column into an ordinary one, IN PLACE — keeps the
-- column, its data and its GIN index; only the "how is this computed" rule
-- changes, from an expression to a trigger. Idempotent: a second run finds
-- no expression to drop and is a no-op.
ALTER TABLE public.tutor_turns
    ALTER COLUMN text_tsv DROP EXPRESSION IF EXISTS;

CREATE OR REPLACE FUNCTION public.tutor_turns_set_text_tsv()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_locale text;
BEGIN
    SELECT locale INTO v_locale FROM public.tutor_sessions WHERE id = NEW.session_id;
    NEW.text_tsv := to_tsvector(public.tutor_fts_config(v_locale), coalesce(NEW.text, ''));
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tutor_turns_set_text_tsv ON public.tutor_turns;
CREATE TRIGGER trg_tutor_turns_set_text_tsv
    BEFORE INSERT OR UPDATE OF text, session_id ON public.tutor_turns
    FOR EACH ROW EXECUTE FUNCTION public.tutor_turns_set_text_tsv();

-- Backfill: every row's tsvector was computed under the old always-Spanish
-- rule (DROP EXPRESSION preserves the stored values, it does not
-- recompute them). Idempotent — re-running lands on the same values.
UPDATE public.tutor_turns tt
SET text_tsv = to_tsvector(public.tutor_fts_config(ts.locale), coalesce(tt.text, ''))
FROM public.tutor_sessions ts
WHERE ts.id = tt.session_id;

-- The old 3-argument function is replaced outright rather than kept as a
-- second overload: keeping it would mean the hardcoded-Spanish query path
-- stays silently reachable forever alongside the fixed one.
DROP FUNCTION IF EXISTS public.search_tutor_turns(uuid, text, int);

CREATE FUNCTION public.search_tutor_turns(
    p_user_id uuid,
    p_query   text,
    p_limit   int DEFAULT 3,
    p_locale  text DEFAULT 'es-MX'
)
RETURNS TABLE (
    session_id  uuid,
    seq         integer,
    speaker     text,
    turn_text   text,
    said_at     timestamptz,
    rank        real
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT tt.session_id,
           tt.seq,
           tt.speaker,
           tt.text,
           tt.created_at,
           ts_rank(tt.text_tsv, websearch_to_tsquery(public.tutor_fts_config(p_locale), p_query)) AS rank
    FROM public.tutor_turns tt
    JOIN public.tutor_sessions ts ON ts.id = tt.session_id
    WHERE ts.user_id = p_user_id
      AND tt.text_tsv @@ websearch_to_tsquery(public.tutor_fts_config(p_locale), p_query)
      AND NOT EXISTS (
          SELECT 1
          FROM public.tutor_safety_flags sf
          WHERE sf.session_id = tt.session_id
            AND sf.turn_seq = tt.seq
      )
    ORDER BY rank DESC, tt.created_at DESC
    LIMIT LEAST(GREATEST(p_limit, 1), 10);
$$;

REVOKE ALL ON FUNCTION public.search_tutor_turns(uuid, text, int, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_tutor_turns(uuid, text, int, text) FROM anon;
REVOKE ALL ON FUNCTION public.search_tutor_turns(uuid, text, int, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.search_tutor_turns(uuid, text, int, text) TO service_role;

REVOKE ALL ON FUNCTION public.tutor_fts_config(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tutor_fts_config(text) FROM anon;
REVOKE ALL ON FUNCTION public.tutor_fts_config(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.tutor_fts_config(text) TO service_role;
