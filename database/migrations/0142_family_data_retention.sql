-- family_data_retention — S07.7, part 5 of 5 (D.21): the Block D retention
-- and deletion policy, enforced by the database and measured.
-- @phase: expand
--
-- The written policy is docs/operations/FAMILY-DATA-RETENTION.md and its
-- machine-readable registry docs/operations/block-d-retention.json; a gate
-- (agent/tools/check-block-d-retention.mjs) keeps the registry, the numbers
-- below, Core's constants and the Tutor-facing copy equal, and fails when a
-- Block D table is created without a retention class.
--
-- THE PERIODS (all proposals awaiting Product and Legal review, OD-10):
--   evidence   30 days after the Tutor's decision: a chore's photo exists to
--              approve the chore; after that it only keeps a child's image.
--   records    400 days (the bound learning_events and the Block D behaviour
--              stream already use): decisions and their reasons, decided
--              chores, answered reward requests, level requests and changes,
--              "talk about it" nudges, human reason scores, the transition
--              audit, settled Share gifts, Tutor coin corrections, answered
--              next-goal prompts, coaching deliveries and reflections.
--   invites    30 days after an invitation was used or expired (a token).
--   research   1,100 days for a research snapshot (the first phase's horizon).
-- The coin record itself (the ledger, pockets, goals, rewards, rules, the
-- streak's practised days and pauses, the bridge checklist, consents) is what
-- the child owns: it is kept while the account exists and erased with it.
--
-- HOW. family_retention_sweep() deletes what is past its period (whole rows,
-- never a partial edit of an immutable record; every reference to a deleted
-- row is an ON DELETE SET NULL or CASCADE the S07.1-S07.6 guards accept).
-- Photos live in Depot, outside PostgreSQL: family_evidence_due() lists them,
-- Core deletes each object, and family_evidence_cleared() clears the task's
-- pointer, the only update the task guard now lets through for a decided
-- chore. A decided chore whose photo is still stored is never deleted, so a
-- failed Depot call cannot orphan a photo. Core runs all of it nightly
-- (POST /api/v1/family-hub/internal/retention/run, .github/workflows/
-- family-retention.yml) and records each run.
--
-- MEASURED (Appendix H Part 1.4, Retention-Policy Compliance Audit, pass
-- every release): family_retention_compliance() counts, per class and table,
-- the rows still held past their period plus a two-day grace. Zero is a pass.

CREATE OR REPLACE FUNCTION public.family_retention_days(p_class text)
RETURNS int LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
    SELECT CASE p_class
        WHEN 'evidence' THEN 30
        WHEN 'records' THEN 400
        WHEN 'invites' THEN 30
        WHEN 'research' THEN 1100
    END;
$$;
REVOKE ALL ON FUNCTION public.family_retention_days(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_retention_days(text) TO service_role;

CREATE TABLE IF NOT EXISTS public.family_retention_runs (
    id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ran_at            timestamptz NOT NULL DEFAULT now(),
    removed           jsonb NOT NULL,
    evidence_cleared  integer CHECK (evidence_cleared >= 0),
    evidence_failed   integer CHECK (evidence_failed >= 0)
);
ALTER TABLE public.family_retention_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.family_retention_runs FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.family_retention_runs TO service_role;

-- ── A decided chore's photo pointer may be cleared, and nothing else ──────
-- The task guard (guard_task_state, unchanged) keeps every other update; its
-- UPDATE trigger skips exactly the retention clear: only the four evidence
-- columns change, all to NULL, on a chore decided more than 30 days ago.
DROP TRIGGER IF EXISTS task_state_guard ON public.tasks;
DROP TRIGGER IF EXISTS task_state_guard_update ON public.tasks;
CREATE TRIGGER task_state_guard BEFORE INSERT ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.guard_task_state();
CREATE TRIGGER task_state_guard_update BEFORE UPDATE ON public.tasks
    FOR EACH ROW WHEN (NOT (
        OLD.status IN ('approved', 'cancelled') AND OLD.decided_at < now() - interval '30 days'
        AND OLD.evidence_hash IS NOT NULL
        AND NEW.evidence_bucket IS NULL AND NEW.evidence_hash IS NULL AND NEW.evidence_ext IS NULL AND NEW.evidence_uploaded_at IS NULL
        AND (to_jsonb(OLD) - 'evidence_bucket' - 'evidence_hash' - 'evidence_ext' - 'evidence_uploaded_at')
          = (to_jsonb(NEW) - 'evidence_bucket' - 'evidence_hash' - 'evidence_ext' - 'evidence_uploaded_at')))
    EXECUTE FUNCTION public.guard_task_state();

-- Photos due for deletion. `shared` is true when another chore that is not
-- due still points at the same content-addressed object: then only the
-- pointer is cleared and the object stays for that chore.
CREATE OR REPLACE FUNCTION public.family_evidence_due(p_limit int DEFAULT 200)
RETURNS TABLE (task_id uuid, bucket text, hash text, ext text, shared boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT t.id, t.evidence_bucket, t.evidence_hash, t.evidence_ext,
           EXISTS (SELECT 1 FROM public.tasks o
                   WHERE o.id <> t.id AND o.evidence_bucket = t.evidence_bucket AND o.evidence_hash = t.evidence_hash
                     AND o.evidence_ext = t.evidence_ext
                     AND NOT (o.status IN ('approved', 'cancelled')
                              AND o.decided_at < now() - make_interval(days => public.family_retention_days('evidence'))))
    FROM public.tasks t
    WHERE t.evidence_hash IS NOT NULL AND t.status IN ('approved', 'cancelled')
      AND t.decided_at < now() - make_interval(days => public.family_retention_days('evidence'))
    ORDER BY t.decided_at
    LIMIT greatest(1, least(coalesce(p_limit, 200), 1000));
$$;
REVOKE ALL ON FUNCTION public.family_evidence_due(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_evidence_due(int) TO service_role;

CREATE OR REPLACE FUNCTION public.family_evidence_cleared(p_task uuid, p_bucket text, p_hash text, p_ext text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_count int;
BEGIN
    UPDATE public.tasks
        SET evidence_bucket = NULL, evidence_hash = NULL, evidence_ext = NULL, evidence_uploaded_at = NULL
        WHERE id = p_task AND evidence_bucket = p_bucket AND evidence_hash = p_hash AND evidence_ext = p_ext
          AND status IN ('approved', 'cancelled')
          AND decided_at < now() - make_interval(days => public.family_retention_days('evidence'));
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count = 1;
END;
$$;
REVOKE ALL ON FUNCTION public.family_evidence_cleared(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_evidence_cleared(uuid, text, text, text) TO service_role;

-- ── The sweep ──────────────────────────────────────────────────────────────
-- Runs only when the nightly job calls it, never while this migration is
-- applied (which deletes nothing, so it stays an expand migration).
CREATE OR REPLACE FUNCTION public.family_retention_sweep()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_records  timestamptz := now() - make_interval(days => public.family_retention_days('records'));
    v_invites  timestamptz := now() - make_interval(days => public.family_retention_days('invites'));
    v_research date := (now() - make_interval(days => public.family_retention_days('research')))::date;
    v_out      jsonb := '{}'::jsonb;
    v_n        bigint;
    v_run      bigint;
BEGIN
    WITH gone AS (DELETE FROM public.family_decisions WHERE created_at < v_records RETURNING 1) SELECT count(*) INTO v_n FROM gone;
    v_out := v_out || jsonb_build_object('family_decisions', v_n);
    -- A decided chore goes once its photo is gone (never orphaning a Depot object).
    WITH gone AS (DELETE FROM public.tasks WHERE status IN ('approved', 'cancelled') AND decided_at < v_records
                  AND evidence_hash IS NULL RETURNING 1) SELECT count(*) INTO v_n FROM gone;
    v_out := v_out || jsonb_build_object('tasks', v_n);
    WITH gone AS (DELETE FROM public.redemptions WHERE (status = 'denied' AND decided_at < v_records)
                  OR (status = 'fulfilled' AND fulfilled_at < v_records) RETURNING 1) SELECT count(*) INTO v_n FROM gone;
    v_out := v_out || jsonb_build_object('redemptions', v_n);
    WITH gone AS (DELETE FROM public.family_autonomy_requests WHERE status <> 'pending' AND decided_at < v_records RETURNING 1)
        SELECT count(*) INTO v_n FROM gone;
    v_out := v_out || jsonb_build_object('family_autonomy_requests', v_n);
    WITH gone AS (DELETE FROM public.family_autonomy_changes WHERE created_at < v_records RETURNING 1) SELECT count(*) INTO v_n FROM gone;
    v_out := v_out || jsonb_build_object('family_autonomy_changes', v_n);
    WITH gone AS (DELETE FROM public.family_autonomy_eligibility_log WHERE first_eligible_at < v_records RETURNING 1) SELECT count(*) INTO v_n FROM gone;
    v_out := v_out || jsonb_build_object('family_autonomy_eligibility_log', v_n);
    WITH gone AS (DELETE FROM public.family_talk_nudges WHERE status <> 'open' AND closed_at < v_records RETURNING 1) SELECT count(*) INTO v_n FROM gone;
    v_out := v_out || jsonb_build_object('family_talk_nudges', v_n);
    WITH gone AS (DELETE FROM public.family_denial_reason_scores WHERE scored_at < v_records RETURNING 1) SELECT count(*) INTO v_n FROM gone;
    v_out := v_out || jsonb_build_object('family_denial_reason_scores', v_n);
    WITH gone AS (DELETE FROM public.family_state_audit WHERE created_at < v_records RETURNING 1) SELECT count(*) INTO v_n FROM gone;
    v_out := v_out || jsonb_build_object('family_state_audit', v_n);
    WITH gone AS (DELETE FROM public.share_gifts WHERE status IN ('given', 'returned') AND settled_at < v_records RETURNING 1) SELECT count(*) INTO v_n FROM gone;
    v_out := v_out || jsonb_build_object('share_gifts', v_n);
    WITH gone AS (DELETE FROM public.wallet_guardian_actions WHERE created_at < v_records RETURNING 1) SELECT count(*) INTO v_n FROM gone;
    v_out := v_out || jsonb_build_object('wallet_guardian_actions', v_n);
    WITH gone AS (DELETE FROM public.goal_next_steps WHERE state IN ('set', 'declined') AND decided_at < v_records RETURNING 1) SELECT count(*) INTO v_n FROM gone;
    v_out := v_out || jsonb_build_object('goal_next_steps', v_n);
    WITH gone AS (DELETE FROM public.parent_coaching_deliveries WHERE period < v_records::date RETURNING 1) SELECT count(*) INTO v_n FROM gone;
    v_out := v_out || jsonb_build_object('parent_coaching_deliveries', v_n);
    WITH gone AS (DELETE FROM public.family_decision_reflections WHERE created_at < v_records RETURNING 1) SELECT count(*) INTO v_n FROM gone;
    v_out := v_out || jsonb_build_object('family_decision_reflections', v_n);
    WITH gone AS (DELETE FROM public.family_money_events WHERE created_at < v_records RETURNING 1) SELECT count(*) INTO v_n FROM gone;
    v_out := v_out || jsonb_build_object('family_money_events', v_n);
    WITH gone AS (DELETE FROM public.staff_insight_checks WHERE checked_at < v_records RETURNING 1) SELECT count(*) INTO v_n FROM gone;
    v_out := v_out || jsonb_build_object('staff_insight_checks', v_n);
    WITH gone AS (DELETE FROM public.guardian_invites WHERE (accepted_at IS NOT NULL AND accepted_at < v_invites)
                  OR (accepted_at IS NULL AND expires_at < v_invites) RETURNING 1) SELECT count(*) INTO v_n FROM gone;
    v_out := v_out || jsonb_build_object('guardian_invites', v_n);
    WITH gone AS (DELETE FROM public.family_research_snapshots WHERE period < v_research RETURNING 1) SELECT count(*) INTO v_n FROM gone;
    v_out := v_out || jsonb_build_object('family_research_snapshots', v_n);
    WITH gone AS (DELETE FROM public.family_retention_runs WHERE ran_at < v_records RETURNING 1) SELECT count(*) INTO v_n FROM gone;
    v_out := v_out || jsonb_build_object('family_retention_runs', v_n);

    INSERT INTO public.family_retention_runs (removed) VALUES (v_out) RETURNING id INTO v_run;
    INSERT INTO public.insights_maintenance_log (job, retain_days, removed)
        SELECT 'family_retention', public.family_retention_days('records'), sum(value::bigint) FROM jsonb_each_text(v_out);
    RETURN v_out || jsonb_build_object('run_id', v_run);
END;
$$;
REVOKE ALL ON FUNCTION public.family_retention_sweep() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_retention_sweep() TO service_role;

-- Core records what happened to the photos in the same run.
CREATE OR REPLACE FUNCTION public.record_family_evidence_purge(p_run bigint, p_cleared int, p_failed int)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_count int;
BEGIN
    IF p_cleared IS NULL OR p_failed IS NULL OR p_cleared < 0 OR p_failed < 0 THEN
        RAISE EXCEPTION 'RETENTION_RUN_INVALID' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.family_retention_runs SET evidence_cleared = p_cleared, evidence_failed = p_failed
        WHERE id = p_run AND evidence_cleared IS NULL;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count = 1;
END;
$$;
REVOKE ALL ON FUNCTION public.record_family_evidence_purge(bigint, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_family_evidence_purge(bigint, int, int) TO service_role;

-- ── Appendix H: Retention-Policy Compliance Audit ──────────────────────────
-- Rows still held past their period plus a two-day grace (the sweep runs
-- nightly). Every row is a violation; zero everywhere is a pass.
CREATE OR REPLACE FUNCTION public.family_retention_compliance()
RETURNS TABLE (data_class text, table_name text, retain_days int, overdue bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    WITH c AS (
        SELECT now() - make_interval(days => public.family_retention_days('records') + 2) AS records,
               now() - make_interval(days => public.family_retention_days('evidence') + 2) AS evidence,
               now() - make_interval(days => public.family_retention_days('invites') + 2) AS invites,
               (now() - make_interval(days => public.family_retention_days('research') + 2))::date AS research
    )
    SELECT v.data_class, v.table_name, public.family_retention_days(v.data_class), v.overdue FROM c, LATERAL (VALUES
        ('evidence', 'tasks.evidence', (SELECT count(*) FROM public.tasks t WHERE t.evidence_hash IS NOT NULL
            AND t.status IN ('approved', 'cancelled') AND t.decided_at < c.evidence)),
        ('records', 'family_decisions', (SELECT count(*) FROM public.family_decisions WHERE created_at < c.records)),
        ('records', 'tasks', (SELECT count(*) FROM public.tasks WHERE status IN ('approved', 'cancelled') AND decided_at < c.records)),
        ('records', 'redemptions', (SELECT count(*) FROM public.redemptions WHERE (status = 'denied' AND decided_at < c.records)
            OR (status = 'fulfilled' AND fulfilled_at < c.records))),
        ('records', 'family_autonomy_requests', (SELECT count(*) FROM public.family_autonomy_requests WHERE status <> 'pending' AND decided_at < c.records)),
        ('records', 'family_autonomy_changes', (SELECT count(*) FROM public.family_autonomy_changes WHERE created_at < c.records)),
        ('records', 'family_autonomy_eligibility_log', (SELECT count(*) FROM public.family_autonomy_eligibility_log WHERE first_eligible_at < c.records)),
        ('records', 'family_talk_nudges', (SELECT count(*) FROM public.family_talk_nudges WHERE status <> 'open' AND closed_at < c.records)),
        ('records', 'family_denial_reason_scores', (SELECT count(*) FROM public.family_denial_reason_scores WHERE scored_at < c.records)),
        ('records', 'family_state_audit', (SELECT count(*) FROM public.family_state_audit WHERE created_at < c.records)),
        ('records', 'share_gifts', (SELECT count(*) FROM public.share_gifts WHERE status IN ('given', 'returned') AND settled_at < c.records)),
        ('records', 'wallet_guardian_actions', (SELECT count(*) FROM public.wallet_guardian_actions WHERE created_at < c.records)),
        ('records', 'goal_next_steps', (SELECT count(*) FROM public.goal_next_steps WHERE state IN ('set', 'declined') AND decided_at < c.records)),
        ('records', 'parent_coaching_deliveries', (SELECT count(*) FROM public.parent_coaching_deliveries WHERE period < c.records::date)),
        ('records', 'family_decision_reflections', (SELECT count(*) FROM public.family_decision_reflections WHERE created_at < c.records)),
        ('records', 'family_money_events', (SELECT count(*) FROM public.family_money_events WHERE created_at < c.records)),
        ('records', 'staff_insight_checks', (SELECT count(*) FROM public.staff_insight_checks WHERE checked_at < c.records)),
        ('invites', 'guardian_invites', (SELECT count(*) FROM public.guardian_invites WHERE (accepted_at IS NOT NULL AND accepted_at < c.invites)
            OR (accepted_at IS NULL AND expires_at < c.invites))),
        ('research', 'family_research_snapshots', (SELECT count(*) FROM public.family_research_snapshots WHERE period < c.research)),
        ('records', 'family_retention_runs', (SELECT count(*) FROM public.family_retention_runs WHERE ran_at < c.records))
    ) AS v (data_class, table_name, overdue);
$$;
REVOKE ALL ON FUNCTION public.family_retention_compliance() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_retention_compliance() TO service_role;

CREATE OR REPLACE FUNCTION public.family_retention_last_run()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT jsonb_build_object('ran_at', r.ran_at, 'removed', r.removed, 'evidence_cleared', r.evidence_cleared, 'evidence_failed', r.evidence_failed)
    FROM public.family_retention_runs r ORDER BY r.id DESC LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.family_retention_last_run() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_retention_last_run() TO service_role;

SELECT 'migration_family_data_retention_ok' AS sentinel;
