-- allowance_requests — a child in a family asks for a bigger allowance, in the
-- child's own words (a closed reason and a short note), and the verified Tutor
-- answers: yes (the allowance becomes the asked amount) or "not yet" with a
-- reason code and an actionable reason (D.18), and a date when the answer is
-- "later".
-- @phase: expand
--
-- Why: the only money a child could ask for was a reward from a catalogue. A
-- kids' bank lets a child say "I would like more", and the answer matters as
-- much as the question: a "no" without a way forward teaches nothing. This
-- reuses the rules the other family decisions already follow (one open
-- request at a time, a Tutor's refusal is never "not now", every decision is
-- audited) and moves no coins by itself: coins keep arriving the way an
-- allowance arrives, as a payout the child splits (D.13). Practice coins only.
--
-- Rationale: docs/littlefounders-spec D.17, D.18; docs/rebuild/sprints/S07.

CREATE TABLE IF NOT EXISTS public.allowance_requests (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kid_user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    -- the allowance when the child asked, and what they asked for
    from_amount     integer NOT NULL CHECK (from_amount BETWEEN 1 AND 1000),
    amount          integer NOT NULL CHECK (amount BETWEEN 2 AND 1000),
    reason_kind     text NOT NULL CHECK (reason_kind IN ('saving_goal', 'more_needs', 'worked_more', 'other')),
    note            text CHECK (note IS NULL OR (char_length(note) BETWEEN 1 AND 120 AND note = btrim(note))),
    status          text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'denied', 'withdrawn')),
    created_at      timestamptz NOT NULL DEFAULT now(),
    decided_at      timestamptz,
    decided_by      uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    decision_code   text CHECK (decision_code IN ('later_date', 'not_suitable', 'talk_first')),
    decision_reason text CHECK (decision_reason IS NULL OR char_length(decision_reason) BETWEEN 12 AND 240),
    revisit_on      date,
    CONSTRAINT allowance_request_asks_more CHECK (amount > from_amount),
    CONSTRAINT allowance_request_decided_shape CHECK ((status = 'requested') = (decided_at IS NULL)),
    CONSTRAINT allowance_request_denial_shape CHECK (
        (status = 'denied' AND decision_code IS NOT NULL AND decision_reason IS NOT NULL AND (decision_code = 'later_date') = (revisit_on IS NOT NULL))
        OR (status <> 'denied' AND decision_code IS NULL AND decision_reason IS NULL AND revisit_on IS NULL)
    )
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_allowance_request_open ON public.allowance_requests (kid_user_id) WHERE status = 'requested';
CREATE INDEX IF NOT EXISTS idx_allowance_requests_kid ON public.allowance_requests (kid_user_id, created_at DESC);

ALTER TABLE public.allowance_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allowance_requests_select_party ON public.allowance_requests;
CREATE POLICY allowance_requests_select_party ON public.allowance_requests
    FOR SELECT USING (kid_user_id = auth.uid() OR public.is_verified_guardian_of(kid_user_id));

-- Browser roles never write; the service role writes only through the functions below.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.allowance_requests FROM anon, authenticated, service_role;
GRANT SELECT ON public.allowance_requests TO service_role;

-- The child asks. Only a child in a family with an active allowance, for more
-- than it is now, one request at a time.
CREATE OR REPLACE FUNCTION public.allowance_request_create(p_kid uuid, p_amount int, p_reason_kind text, p_note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_rule public.allowance_rules%ROWTYPE;
    v_note text := nullif(btrim(coalesce(p_note, '')), '');
    v_id   uuid;
BEGIN
    IF p_kid IS NULL OR p_amount IS NULL OR p_amount NOT BETWEEN 2 AND 1000
       OR p_reason_kind IS NULL OR p_reason_kind NOT IN ('saving_goal', 'more_needs', 'worked_more', 'other')
       OR (v_note IS NOT NULL AND char_length(v_note) > 120) THEN
        RAISE EXCEPTION 'ALLOWANCE_REQUEST_INVALID' USING ERRCODE = 'P0001';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(p_kid::text, 1));
    IF NOT public.family_child_in_family(p_kid) THEN
        RAISE EXCEPTION 'WALLET_HOLDER_REQUIRED' USING ERRCODE = 'P0001';
    END IF;
    SELECT * INTO v_rule FROM public.allowance_rules WHERE kid_user_id = p_kid AND active;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'ALLOWANCE_NONE' USING ERRCODE = 'P0001';
    END IF;
    IF p_amount <= v_rule.amount THEN
        RAISE EXCEPTION 'ALLOWANCE_REQUEST_INVALID' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.allowance_requests WHERE kid_user_id = p_kid AND status = 'requested') THEN
        RAISE EXCEPTION 'ALLOWANCE_REQUEST_OPEN' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.allowance_requests (kid_user_id, from_amount, amount, reason_kind, note)
    VALUES (p_kid, v_rule.amount, p_amount, p_reason_kind, v_note)
    RETURNING id INTO v_id;
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_kid, 'banking.allowance_requested', p_kid::text, jsonb_build_object('request_id', v_id, 'from', v_rule.amount, 'amount', p_amount));
    RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.allowance_request_create(uuid, int, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.allowance_request_create(uuid, int, text, text) TO service_role;

-- The child changes their mind before it is answered.
CREATE OR REPLACE FUNCTION public.allowance_request_withdraw(p_request uuid, p_kid uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    IF p_request IS NULL OR p_kid IS NULL THEN
        RAISE EXCEPTION 'ALLOWANCE_REQUEST_INVALID' USING ERRCODE = 'P0001';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(p_kid::text, 1));
    UPDATE public.allowance_requests SET status = 'withdrawn', decided_at = now(), decided_by = p_kid
    WHERE id = p_request AND kid_user_id = p_kid AND status = 'requested';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'ALLOWANCE_REQUEST_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_kid, 'banking.allowance_request_withdrawn', p_kid::text, jsonb_build_object('request_id', p_request));
    RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.allowance_request_withdraw(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.allowance_request_withdraw(uuid, uuid) TO service_role;

-- A verified Tutor answers. Yes: the allowance becomes the asked amount (never
-- lower than it is now). Not yet: a reason code from the closed set, a reason
-- that says what the child can do next, and a date from tomorrow to 90 days
-- ahead only when the answer is "later" (D.18).
CREATE OR REPLACE FUNCTION public.allowance_request_decide(p_request uuid, p_actor uuid, p_approve boolean, p_code text, p_reason text, p_revisit date)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_req    public.allowance_requests%ROWTYPE;
    v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
BEGIN
    IF p_request IS NULL OR p_actor IS NULL OR p_approve IS NULL THEN
        RAISE EXCEPTION 'ALLOWANCE_REQUEST_INVALID' USING ERRCODE = 'P0001';
    END IF;
    SELECT * INTO v_req FROM public.allowance_requests WHERE id = p_request;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'ALLOWANCE_REQUEST_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(v_req.kid_user_id::text, 1));
    IF NOT public.family_is_verified_guardian(p_actor, v_req.kid_user_id) THEN
        RAISE EXCEPTION 'ALLOWANCE_REQUEST_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    SELECT * INTO v_req FROM public.allowance_requests WHERE id = p_request FOR UPDATE;
    IF v_req.status <> 'requested' THEN
        RAISE EXCEPTION 'ALLOWANCE_REQUEST_DECIDED' USING ERRCODE = 'P0001';
    END IF;
    IF p_approve THEN
        UPDATE public.allowance_rules SET amount = greatest(amount, v_req.amount) WHERE kid_user_id = v_req.kid_user_id AND active;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'ALLOWANCE_NONE' USING ERRCODE = 'P0001';
        END IF;
        UPDATE public.allowance_requests SET status = 'approved', decided_at = now(), decided_by = p_actor WHERE id = p_request;
    ELSE
        IF p_code IS NULL OR p_code NOT IN ('later_date', 'not_suitable', 'talk_first') OR v_reason IS NULL THEN
            RAISE EXCEPTION 'DECISION_REASON_REQUIRED' USING ERRCODE = 'P0001';
        END IF;
        IF NOT public.family_reason_actionable(v_reason) THEN
            RAISE EXCEPTION 'DECISION_REASON_NOT_ACTIONABLE' USING ERRCODE = 'P0001';
        END IF;
        IF (p_code = 'later_date') <> (p_revisit IS NOT NULL) OR (p_revisit IS NOT NULL AND (p_revisit <= current_date OR p_revisit > current_date + 90)) THEN
            RAISE EXCEPTION 'DECISION_REVISIT_INVALID' USING ERRCODE = 'P0001';
        END IF;
        UPDATE public.allowance_requests SET status = 'denied', decided_at = now(), decided_by = p_actor,
               decision_code = p_code, decision_reason = v_reason, revisit_on = p_revisit
        WHERE id = p_request;
    END IF;
    INSERT INTO public.audit_logs (actor_id, action, subject, detail)
    VALUES (p_actor, 'banking.allowance_request_decided', v_req.kid_user_id::text,
            jsonb_build_object('request_id', p_request, 'approved', p_approve, 'amount', v_req.amount, 'code', p_code));
    RETURN CASE WHEN p_approve THEN 'approved' ELSE 'denied' END;
END;
$$;
REVOKE ALL ON FUNCTION public.allowance_request_decide(uuid, uuid, boolean, text, text, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.allowance_request_decide(uuid, uuid, boolean, text, text, date) TO service_role;

SELECT 'allowance_requests_ok' AS sentinel;
