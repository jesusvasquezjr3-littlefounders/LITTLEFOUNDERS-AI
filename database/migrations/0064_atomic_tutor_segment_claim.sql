-- 0064_atomic_tutor_segment_claim.sql — the content ladder's seq claim and
-- duplicate-serve check were a plain, non-atomic read, so a concurrent
-- winner's perfectly valid catalog hit was discarded as a manufactured 502.
-- @phase: expand
--
-- FOUND BY ADVERSARIAL REVIEW SWEEP tutor-review-sweep-101
-- (content-ladder-correctness dimension), 2026-08-31 (HIGH), independently
-- verified. `POST /api/v1/tutor/segments` (backend/src/routes/tutor.ts) read
-- "segments already served" with a plain SELECT, computed the next `seq` as
-- `served.length` in application code, ran the ENTIRE three-tier content
-- ladder (catalog -> bank -> KC-prerequisite fallback -> frontier fallback)
-- against that one snapshot, and only THEN inserted the chosen candidate
-- with a SEPARATE, unconditional POST carrying the stale `seq`. Two
-- concurrent segment requests for the same session — a double-tap on the
-- "next activity" control, a flaky-connection retry, or Oracle re-requesting
-- a segment after a turn that raced a resume — both read the identical
-- "already served" snapshot, both run the identical DETERMINISTIC ladder
-- (the tier-1 rotation is seeded on the session id, never on wall-clock
-- time — `hashSeed(session.id)`), and both independently pick the SAME
-- catalog or bank candidate at the SAME computed `seq`.
--
-- `tutor_segments` has carried `UNIQUE (session_id, seq)` since
-- `0047_tutor_oracle.sql`, so the constraint itself was never silently
-- violated — but the LOSER's insert was rejected outright by PostgREST,
-- `insertTutorSegment` returned null exactly as it does on any other
-- transport failure, and the route answered a perfectly valid,
-- correctly-selected catalog hit with `502 DATA_UNAVAILABLE`,
-- indistinguishable from a real outage. The identical shape existed a
-- second time in the SAME file, sharing the SAME insert helper: `POST
-- /segments/verify` (tier 3) computed its own `seq` with a separate plain
-- read (`countSessionSegments`) and is fixed by this same migration for the
-- same reason, with no wire or behaviour change of its own.
--
-- WHY THIS IS NOT THE `award_tutor_xp` (0055) / `start_tutor_session_checked`
-- (0057) SHAPE. Those move an entire read-compare-write into ONE Postgres
-- function because the "content" being compared is arithmetic Postgres can
-- do itself. Here the CANDIDATE is chosen by a multi-step Node process —
-- three ladder tiers, each doing its own PostgREST round trips against
-- `lessons`, `lesson_documents`, published packs and the KC graph — that
-- cannot run inside a plpgsql function. So, matching
-- `write_learner_memory_checked` (0059)'s answer to the identical
-- constraint, the fix does NOT move selection into Postgres; it makes the
-- FINAL claim — "assign this candidate the next seq, but only if nobody
-- already served this exact segment to this session" — one atomic,
-- serialized compare-and-claim, and leaves the CALLER responsible for
-- re-running its own ladder selection against the freshly current exclusion
-- set on a reported conflict, rather than trusting its own stale read.
--
-- `insert_tutor_segment_checked` recomputes BOTH the next `seq` and the
-- "already served" membership test fresh, inside a single
-- `pg_advisory_xact_lock`. The lock is keyed on the SESSION, not the
-- learner: the invariant this protects (`UNIQUE (session_id, seq)`, and the
-- "never serve the same segment twice" rule the exclusion set already
-- states in application code but never enforced atomically) is scoped to
-- one session, and two concurrent sessions for the same learner — which
-- `start_tutor_session_checked`'s own daily cap does not forbid within a
-- single day — must never wait on each other here. A fourth, distinct salt
-- from `award_tutor_xp` (0), `start_tutor_session_checked` (1) and the
-- learner-memory pair (2, shared by `write_learner_memory_checked` and
-- `write_learner_memory_pair_checked`), so none of the four existing atomic
-- paths ever contends with this one, or with each other.
--
-- An EMPTY result set means "a concurrent request already claimed this
-- exact segment for this session" — the caller re-runs its own ladder
-- selection against the now-current exclusion set and retries, landing on
-- the next genuinely distinct candidate rather than a 502. A non-empty
-- result is the inserted row, exactly as a plain `INSERT ... RETURNING`
-- would have been.
CREATE OR REPLACE FUNCTION public.insert_tutor_segment_checked(
    p_session_id    uuid,
    p_source_key    text,
    p_origin        text,
    p_lesson_id     uuid,
    p_segment_type  text,
    p_payload       jsonb,
    p_answer        jsonb,
    p_key_verified  boolean,
    p_provenance    jsonb,
    p_review_status text
)
RETURNS SETOF public.tutor_segments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_next_seq int;
BEGIN
    -- Session-keyed, not learner-keyed — see the migration header above for
    -- why. Held for the rest of this transaction, released automatically on
    -- commit/rollback.
    PERFORM pg_advisory_xact_lock(hashtextextended(p_session_id::text, 3));

    -- Recomputed fresh, INSIDE the lock — never trust the caller's own
    -- pre-ladder snapshot, which is exactly what raced under concurrency.
    -- NULL p_source_key (defensive; every real segment carries a non-empty
    -- `id`) skips the check rather than matching every row via `= NULL`,
    -- which is never true in SQL and would silently disable the guard.
    IF p_source_key IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.tutor_segments
        WHERE session_id = p_session_id AND payload ->> 'id' = p_source_key
    ) THEN
        -- A concurrent winner already served this exact candidate to this
        -- session. Report it as a genuine conflict rather than inserting a
        -- silent duplicate at a different seq — the caller re-selects.
        RETURN;
    END IF;

    SELECT COALESCE(MAX(seq) + 1, 0)
    INTO v_next_seq
    FROM public.tutor_segments
    WHERE session_id = p_session_id;

    RETURN QUERY
    INSERT INTO public.tutor_segments (
        session_id, seq, origin, lesson_id, segment_type, payload, answer,
        key_verified, provenance, review_status
    ) VALUES (
        p_session_id, v_next_seq, p_origin, p_lesson_id, p_segment_type,
        p_payload, p_answer, p_key_verified, p_provenance, p_review_status
    )
    RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.insert_tutor_segment_checked(
    uuid, text, text, uuid, text, jsonb, jsonb, boolean, jsonb, text
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.insert_tutor_segment_checked(
    uuid, text, text, uuid, text, jsonb, jsonb, boolean, jsonb, text
) FROM anon;
REVOKE ALL ON FUNCTION public.insert_tutor_segment_checked(
    uuid, text, text, uuid, text, jsonb, jsonb, boolean, jsonb, text
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.insert_tutor_segment_checked(
    uuid, text, text, uuid, text, jsonb, jsonb, boolean, jsonb, text
) TO service_role;
