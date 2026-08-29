-- 0054_recall_excludes_flagged_turns.sql — episodic recall must never
-- resurface a turn the input classifier already flagged.
-- @phase: expand
--
-- FOUND BY ADVERSARIAL REVIEW, 2026-08-29. `search_tutor_turns` (migration
-- 0053) does a plain full-text search over EVERY row in `tutor_turns`,
-- including a learner utterance that was classified `personal_data`,
-- `self_harm`, `abuse_disclosure`, `grooming_pattern` or `injection_attempt`
-- and correctly kept out of that turn's own model call — the flag exists
-- precisely so nobody trusts that turn's text again. Nothing stopped a LATER
-- turn's recall query from finding and quoting it anyway: Oracle's
-- `recallOwnHistory` splices the excerpt into the very next prompt, and
-- `ORACLE.md §5`'s own injection fence is bypassed by construction there (a
-- separate, already-noted defect in `orchestrator.ts`, tracked alongside this
-- one) — meaning a home address a child typed and was correctly blocked from
-- ever reaching DeepSeek could still reach it weeks later, verbatim, the
-- moment the child asked "¿te acuerdas cuando te dije...?". This is exactly
-- the §1.9 harm the `personal_data` classifier rule exists to prevent, via a
-- path that never re-checked it.
--
-- THE FIX IS AT THE QUERY, NOT AT THE FENCE. Fencing a recalled excerpt (the
-- companion oracle-side fix) stops the MODEL from obeying it as an
-- instruction; it does not stop the PII from simply being present in the
-- request body a third party receives, which is the actual harm §1.9 names.
-- A flagged turn must be unreachable by recall at the SOURCE.
--
-- `NOT EXISTS` rather than a JOIN with a NULL check: `tutor_safety_flags`
-- rows are comparatively rare, so this the cheaper shape, and it reads as
-- exactly what it is — "no flag exists for this turn" — rather than a join
-- whose NULL-filtering intent has to be inferred from a WHERE clause below it.
CREATE OR REPLACE FUNCTION public.search_tutor_turns(
    p_user_id uuid,
    p_query   text,
    p_limit   int DEFAULT 3
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
           ts_rank(tt.text_tsv, websearch_to_tsquery('spanish', p_query)) AS rank
    FROM public.tutor_turns tt
    JOIN public.tutor_sessions ts ON ts.id = tt.session_id
    WHERE ts.user_id = p_user_id
      AND tt.text_tsv @@ websearch_to_tsquery('spanish', p_query)
      AND NOT EXISTS (
          SELECT 1
          FROM public.tutor_safety_flags sf
          WHERE sf.session_id = tt.session_id
            AND sf.turn_seq = tt.seq
      )
    ORDER BY rank DESC, tt.created_at DESC
    LIMIT LEAST(GREATEST(p_limit, 1), 10);
$$;

-- Unchanged from 0053 — CREATE OR REPLACE does not reset grants, but stating
-- them again costs nothing and keeps this file readable on its own.
REVOKE ALL ON FUNCTION public.search_tutor_turns(uuid, text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_tutor_turns(uuid, text, int) FROM anon;
REVOKE ALL ON FUNCTION public.search_tutor_turns(uuid, text, int) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.search_tutor_turns(uuid, text, int) TO service_role;
