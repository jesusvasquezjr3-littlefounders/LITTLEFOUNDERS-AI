-- mentor_quality_release_audits — the per-release manual audits of Appendix
-- C 1.2 get a data source, so the C.24 dashboard can breach on them
-- (GAP-FIX-R2 staff-ops; Product C.24, B.25, B.22, B.20).
-- @phase: expand
--
-- Three Appendix C engagement-health metrics are manual audits run per
-- release (Appendix C Part 3, Stage 3): the Dark-Pattern Audit Score (B.25),
-- the Variable-Ratio Mechanic Audit Pass Rate (B.22) and the Reward-Framing
-- Composition Rate (B.20). The consolidated dashboard listed them as
-- not_instrumented: nothing recorded their results.
--
-- release_audit_results holds one row per audit and release: pass or fail,
-- the finding count (a fail has at least one finding, a pass none) and the
-- reviewer. record_release_audit(p_actor, ...) is the one writer: the actor
-- must be a NAMED OWNER (mentor_quality_owner) of the role that owns the
-- signal (B.25 and B.22: safety_trust_lead; B.20: pedagogical_lead), a
-- release is audited once per kind, and the row and its audit_logs entry
-- ('mentor_quality.release_audit.recorded') land in one transaction. Core
-- serves it behind view_analytics; the evaluation loop reads the latest row
-- per kind and breaches on a fail or on an audit older than the release
-- cadence (mentorQuality.ts RELEASE_AUDIT_CADENCE_DAYS).

CREATE TABLE IF NOT EXISTS public.release_audit_results (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_kind     text NOT NULL CHECK (audit_kind IN ('dark_pattern', 'variable_ratio', 'reward_framing')),
    release_id     text NOT NULL CHECK (release_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'),
    result         text NOT NULL CHECK (result IN ('pass', 'fail')),
    finding_count  integer NOT NULL CHECK (finding_count BETWEEN 0 AND 10000),
    reviewer_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,  -- kept as the audit record when the account is erased (E.6)
    note           text CHECK (note IS NULL OR length(btrim(note)) BETWEEN 1 AND 600),
    recorded_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT release_audit_results_once UNIQUE (audit_kind, release_id),
    CONSTRAINT release_audit_results_findings CHECK ((result = 'fail') = (finding_count > 0))
);
CREATE INDEX IF NOT EXISTS release_audit_results_latest ON public.release_audit_results (audit_kind, recorded_at DESC);

ALTER TABLE public.release_audit_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.release_audit_results FROM anon, authenticated;
GRANT SELECT ON public.release_audit_results TO service_role;

-- An audit result is a record: never edited or removed. The one change let
-- through is the erasure of the reviewer's account nulling reviewer_id (E.6).
CREATE OR REPLACE FUNCTION public.reject_release_audit_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.reviewer_id IS NULL AND OLD.reviewer_id IS NOT NULL
       AND (to_jsonb(NEW) - 'reviewer_id') = (to_jsonb(OLD) - 'reviewer_id') THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'a recorded release audit is never edited or removed; record the next release instead';
END;
$$;
REVOKE ALL ON FUNCTION public.reject_release_audit_change() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS release_audit_results_append_only ON public.release_audit_results;
CREATE TRIGGER release_audit_results_append_only
    BEFORE UPDATE OR DELETE ON public.release_audit_results
    FOR EACH ROW EXECUTE FUNCTION public.reject_release_audit_change();

CREATE OR REPLACE FUNCTION public.record_release_audit(
    p_actor uuid, p_kind text, p_release_id text, p_result text, p_findings integer, p_note text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_role text := CASE p_kind WHEN 'dark_pattern' THEN 'safety_trust_lead' WHEN 'variable_ratio' THEN 'safety_trust_lead'
                               WHEN 'reward_framing' THEN 'pedagogical_lead' END;
    v_id uuid;
    v_note text := NULLIF(btrim(coalesce(p_note, '')), '');
BEGIN
    IF v_role IS NULL OR p_result NOT IN ('pass', 'fail') OR p_findings IS NULL OR p_findings < 0 OR p_findings > 10000
       OR (p_result = 'fail') <> (p_findings > 0) OR p_release_id IS NULL OR p_release_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
       OR length(coalesce(v_note, '')) > 600 THEN
        RETURN 'invalid';
    END IF;
    IF p_actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.mentor_quality_owner WHERE owner_role = v_role AND user_id = p_actor) THEN
        RETURN 'not_owner';
    END IF;
    INSERT INTO public.release_audit_results (audit_kind, release_id, result, finding_count, reviewer_id, note)
    VALUES (p_kind, p_release_id, p_result, p_findings, p_actor, v_note)
    ON CONFLICT (audit_kind, release_id) DO NOTHING
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
        RETURN 'duplicate';
    END IF;
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_actor, 'mentor_quality.release_audit.recorded', v_id::text,
            jsonb_build_object('kind', p_kind, 'release_id', p_release_id, 'result', p_result, 'findings', p_findings, 'owner_role', v_role));
    RETURN 'recorded';
END;
$$;
REVOKE ALL ON FUNCTION public.record_release_audit(uuid, text, text, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_release_audit(uuid, text, text, text, integer, text) TO service_role;
