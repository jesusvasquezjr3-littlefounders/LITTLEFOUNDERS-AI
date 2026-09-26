-- share_gift_destinations — S07.4, part 2 of 5 (D.14): the Share pocket gets a
-- real destination the child can see actually happen. This part holds the
-- schema and its guards; share_gift_flows (part 3) holds the ledger guard, the
-- producing flows and the metric. Split so each payload stays well inside the
-- operator transport's single-argument limit on Windows.
-- @phase: contract
-- @after-release: none — the ledger reason CHECK is dropped and re-added (a
--   pure widening: share_gift, share_gift_returned). No write the current Core
--   makes becomes illegal. Apply with the Core release that ships the S07.4
--   routes, after family_money_events and before share_gift_flows, never
--   ahead of that release.
--
-- D.14 (Appendix G §1.4, §1.3): Save goes to goals and Spend to rewards, but
-- Share went nowhere, and a label that never cashes out teaches a child not to
-- trust the other labels either. The destination is family-chosen and real:
--
--   share_destinations  what the family will actually do (a charity, a gift for
--                       someone, a community action). A verified Tutor chooses
--                       it for a child in a family; a self-registered teen may
--                       choose their own (OD-3 Option B, no approval step).
--   share_gifts         the child directs Share coins to a destination
--                       (pledged; the coins leave Share at once), and whoever
--                       chose the destination records what really happened
--                       (given, with a required note the child reads), or
--                       returns the coins (returned; a Tutor must say why, the
--                       child may take a pledge back before it is given).
--
-- Honesty (D.7): coins are never sent anywhere. The Tutor turns the pledge into
-- a real action the family chooses; the product records the promise and what
-- was done, and never claims more.

CREATE TABLE IF NOT EXISTS public.share_destinations (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    holder_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    title          text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 60 AND title = btrim(title)),
    kind           text NOT NULL CHECK (kind IN ('charity', 'gift', 'community')),
    -- 'tutor': a verified guardian chose it and any verified guardian records
    -- the outcome. 'holder': a self-registered teen chose it for themself.
    chosen_by      text NOT NULL CHECK (chosen_by IN ('tutor', 'holder')),
    created_by     uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    status         text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at     timestamptz NOT NULL DEFAULT now(),
    archived_at    timestamptz,
    CONSTRAINT share_destination_archive_shape CHECK ((status = 'archived') = (archived_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_share_destinations_holder ON public.share_destinations (holder_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.share_gifts (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    holder_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    destination_id uuid NOT NULL REFERENCES public.share_destinations (id) ON DELETE CASCADE,
    amount         integer NOT NULL CHECK (amount BETWEEN 1 AND 1000),
    status         text NOT NULL DEFAULT 'pledged' CHECK (status IN ('pledged', 'given', 'returned')),
    pledged_at     timestamptz NOT NULL DEFAULT now(),
    settled_at     timestamptz,
    settled_by     uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    -- What really happened (given, required) or why the coins came back
    -- (returned by a Tutor, required). The child reads it on their history.
    note           text CHECK (note IS NULL OR (char_length(note) BETWEEN 1 AND 240 AND note = btrim(note))),
    CONSTRAINT share_gift_settle_shape CHECK ((status = 'pledged') = (settled_at IS NULL)),
    CONSTRAINT share_gift_given_note CHECK (status <> 'given' OR note IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_share_gifts_holder ON public.share_gifts (holder_user_id, pledged_at DESC);
CREATE INDEX IF NOT EXISTS idx_share_gifts_destination ON public.share_gifts (destination_id);

ALTER TABLE public.share_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_gifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS share_destinations_select_party ON public.share_destinations;
CREATE POLICY share_destinations_select_party ON public.share_destinations
    FOR SELECT USING (holder_user_id = auth.uid() OR public.is_verified_guardian_of(holder_user_id));
DROP POLICY IF EXISTS share_gifts_select_party ON public.share_gifts;
CREATE POLICY share_gifts_select_party ON public.share_gifts
    FOR SELECT USING (holder_user_id = auth.uid() OR public.is_verified_guardian_of(holder_user_id));

-- Browser roles never write; the service role writes only through the
-- functions below (they run as the owner), and never deletes.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.share_destinations, public.share_gifts FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.share_destinations, public.share_gifts FROM service_role;
GRANT SELECT ON public.share_destinations, public.share_gifts TO service_role;

-- ── Ledger: the Share-gift reasons and the pointer to the gift ──────────────
ALTER TABLE public.wallet_ledger
    ADD COLUMN IF NOT EXISTS share_gift_id uuid REFERENCES public.share_gifts (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_share_gift ON public.wallet_ledger (share_gift_id) WHERE share_gift_id IS NOT NULL;

alter table public.wallet_ledger drop constraint if exists wallet_ledger_reason_check;
alter table public.wallet_ledger add constraint wallet_ledger_reason_check
    check (reason in ('task_approved', 'goal_withdrawal', 'redemption', 'manual_adjustment', 'allowance', 'savings_bonus', 'self_income', 'personal_reward', 'goal_release', 'share_gift', 'share_gift_returned'));

-- ── Who may act on a destination's gifts ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.share_destination_steward(p_destination uuid, p_actor uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.share_destinations d
        WHERE d.id = p_destination AND p_actor IS NOT NULL AND (
            (d.chosen_by = 'holder' AND p_actor = d.holder_user_id)
            OR (d.chosen_by = 'tutor' AND public.family_is_verified_guardian(p_actor, d.holder_user_id))
        )
    );
$$;
REVOKE ALL ON FUNCTION public.share_destination_steward(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.share_destination_steward(uuid, uuid) TO service_role;

-- ── Guards, for every writer ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_share_destination()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_changed text[];
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF public.wallet_holder_kind(NEW.holder_user_id) IS NULL THEN
            RAISE EXCEPTION 'WALLET_HOLDER_REQUIRED' USING ERRCODE = 'P0001';
        END IF;
        IF NEW.status <> 'active' OR NEW.archived_at IS NOT NULL THEN
            RAISE EXCEPTION 'SHARE_DESTINATION_STATE_INVALID' USING ERRCODE = 'P0001';
        END IF;
        IF NOT ((NEW.chosen_by = 'holder' AND NEW.created_by = NEW.holder_user_id AND public.teen_wallet_holder(NEW.holder_user_id))
                OR (NEW.chosen_by = 'tutor' AND public.family_is_verified_guardian(NEW.created_by, NEW.holder_user_id))) THEN
            RAISE EXCEPTION 'SHARE_DESTINATION_FORBIDDEN' USING ERRCODE = 'P0001';
        END IF;
        IF (SELECT count(*) FROM public.share_destinations
            WHERE holder_user_id = NEW.holder_user_id AND status = 'active') >= 10 THEN
            RAISE EXCEPTION 'SHARE_DESTINATION_LIMIT' USING ERRCODE = 'P0001';
        END IF;
        RETURN NEW;
    END IF;
    v_changed := public.family_changed_columns(to_jsonb(OLD), to_jsonb(NEW));
    IF v_changed = '{}'::text[] OR public.family_only_nulled(v_changed, ARRAY['created_by'], to_jsonb(NEW)) THEN
        RETURN NEW;
    END IF;
    IF NOT (v_changed <@ ARRAY['status', 'archived_at'])
       OR NOT (OLD.status = 'active' AND NEW.status = 'archived' AND NEW.archived_at IS NOT NULL) THEN
        RAISE EXCEPTION 'SHARE_DESTINATION_TRANSITION_FORBIDDEN' USING ERRCODE = 'P0001',
            DETAIL = format('%s -> %s', OLD.status, NEW.status);
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_share_destination() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS share_destination_guard ON public.share_destinations;
CREATE TRIGGER share_destination_guard BEFORE INSERT OR UPDATE ON public.share_destinations
    FOR EACH ROW EXECUTE FUNCTION public.guard_share_destination();
DROP TRIGGER IF EXISTS share_destination_state_transition_audit ON public.share_destinations;
CREATE TRIGGER share_destination_state_transition_audit AFTER UPDATE OF status ON public.share_destinations
    FOR EACH ROW EXECUTE FUNCTION public.record_family_state_transition('status', 'id', 'holder_user_id');

CREATE OR REPLACE FUNCTION public.guard_share_gift()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_changed text[];
    v_dest    public.share_destinations%ROWTYPE;
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT * INTO v_dest FROM public.share_destinations WHERE id = NEW.destination_id;
        IF NOT FOUND OR v_dest.holder_user_id <> NEW.holder_user_id OR v_dest.status <> 'active' THEN
            RAISE EXCEPTION 'SHARE_DESTINATION_UNAVAILABLE' USING ERRCODE = 'P0001';
        END IF;
        IF public.wallet_holder_kind(NEW.holder_user_id) IS NULL THEN
            RAISE EXCEPTION 'WALLET_HOLDER_REQUIRED' USING ERRCODE = 'P0001';
        END IF;
        IF NEW.status <> 'pledged' OR NEW.settled_at IS NOT NULL OR NEW.settled_by IS NOT NULL OR NEW.note IS NOT NULL THEN
            RAISE EXCEPTION 'SHARE_GIFT_STATE_INVALID' USING ERRCODE = 'P0001';
        END IF;
        -- D.1: a freeze holds the child's own movements.
        IF NOT public.banking_movement_allowed(NEW.holder_user_id) THEN
            RAISE EXCEPTION 'ACCOUNT_FROZEN' USING ERRCODE = 'P0001';
        END IF;
        RETURN NEW;
    END IF;
    v_changed := public.family_changed_columns(to_jsonb(OLD), to_jsonb(NEW));
    IF v_changed = '{}'::text[] OR public.family_only_nulled(v_changed, ARRAY['settled_by'], to_jsonb(NEW)) THEN
        RETURN NEW;
    END IF;
    IF NOT (v_changed <@ ARRAY['status', 'settled_at', 'settled_by', 'note']) OR OLD.status <> 'pledged'
       OR NEW.status NOT IN ('given', 'returned') OR NEW.settled_at IS NULL THEN
        RAISE EXCEPTION 'SHARE_GIFT_TRANSITION_FORBIDDEN' USING ERRCODE = 'P0001',
            DETAIL = format('%s -> %s', OLD.status, NEW.status);
    END IF;
    IF NEW.status = 'given' THEN
        IF NOT public.share_destination_steward(NEW.destination_id, NEW.settled_by) OR NEW.note IS NULL THEN
            RAISE EXCEPTION 'SHARE_GIFT_FORBIDDEN' USING ERRCODE = 'P0001';
        END IF;
    ELSIF NEW.settled_by IS NOT DISTINCT FROM NEW.holder_user_id THEN
        -- The child takes back their own pledge: a movement of their own, so a
        -- freeze holds it.
        IF NOT public.banking_movement_allowed(NEW.holder_user_id) THEN
            RAISE EXCEPTION 'ACCOUNT_FROZEN' USING ERRCODE = 'P0001';
        END IF;
    ELSIF NOT public.share_destination_steward(NEW.destination_id, NEW.settled_by) OR NEW.note IS NULL THEN
        RAISE EXCEPTION 'SHARE_GIFT_FORBIDDEN' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_share_gift() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS share_gift_guard ON public.share_gifts;
CREATE TRIGGER share_gift_guard BEFORE INSERT OR UPDATE ON public.share_gifts
    FOR EACH ROW EXECUTE FUNCTION public.guard_share_gift();
DROP TRIGGER IF EXISTS share_gift_state_transition_audit ON public.share_gifts;
CREATE TRIGGER share_gift_state_transition_audit AFTER UPDATE OF status ON public.share_gifts
    FOR EACH ROW EXECUTE FUNCTION public.record_family_state_transition('status', 'id', 'settled_by');

-- At commit, a gift has exactly its ledger rows: one Share debit, plus one
-- matching credit once it is returned. A half-written gift is refused.
CREATE OR REPLACE FUNCTION public.check_share_gift_balanced()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_status text;
    v_amount int;
    v_debits int;
    v_debit  bigint;
    v_credits int;
    v_credit bigint;
BEGIN
    SELECT status, amount INTO v_status, v_amount FROM public.share_gifts WHERE id = NEW.id;
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    SELECT count(*) FILTER (WHERE reason = 'share_gift'), coalesce(sum(amount) FILTER (WHERE reason = 'share_gift'), 0),
           count(*) FILTER (WHERE reason = 'share_gift_returned'), coalesce(sum(amount) FILTER (WHERE reason = 'share_gift_returned'), 0)
    INTO v_debits, v_debit, v_credits, v_credit
    FROM public.wallet_ledger WHERE share_gift_id = NEW.id;
    IF v_debits <> 1 OR v_debit <> -v_amount
       OR (v_status = 'returned' AND (v_credits <> 1 OR v_credit <> v_amount))
       OR (v_status <> 'returned' AND v_credits <> 0) THEN
        RAISE EXCEPTION 'SHARE_GIFT_UNBALANCED' USING ERRCODE = 'P0001';
    END IF;
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.check_share_gift_balanced() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS share_gift_balanced ON public.share_gifts;
CREATE CONSTRAINT TRIGGER share_gift_balanced AFTER INSERT OR UPDATE ON public.share_gifts
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_share_gift_balanced();

SELECT 'share_gift_destinations_ok' AS sentinel;
