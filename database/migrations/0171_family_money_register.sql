-- family_money_register — S07.6, part 1 of 2 (D.12): the age register every
-- Family Hub and Digital Banking surface is presented in.
-- @phase: expand
--
-- Parts, applied in this order after the S07.5 migrations: family_money_register
-- (this file) and family_engagement_insight (D.6). Rationale and evidence:
-- docs/rebuild/sprints/S07-FAMILY-AND-WALLET.md (S07.6).
--
-- WHY THE DATABASE DECIDES. D.12 extends B.23's three registers (young child,
-- tween-teen transition, teen) to this Block, and says D.11's fixed bonus for
-- younger children is "a specific instance of this general age-differentiation
-- mandate", so the two must be "one coherent age-band design". The only way to
-- make them coherent by construction is one decision in one place: the teen
-- register is exactly the children the bonus framing already gives a
-- percentage (savings_bonus_framing = 'percent', S07.3), and the split below
-- that is by age alone. Every minor safeguard follows age, never role (OD-3).
--
--   young       6-9, and every child whose age is not known (the most legible
--               presentation; the same conservative default D.11 and D.17 use)
--   transition  10-12: the "graduation" band of B.23 (Appendix G §1.5: a grasp
--               of what a bank does emerges around 10-11; a percentage of a
--               balance is reachable with concrete scaffolding)
--   teen        13-17, and a self-registered teen (their locked declaration)
--
-- No wallet holder, no register: an adult, a guest, staff and an unlinked
-- account under 13 get NULL, and Core refuses them before any presentation.

CREATE OR REPLACE FUNCTION public.family_money_register(p_user uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
    v_age int;
BEGIN
    IF p_user IS NULL OR public.wallet_holder_kind(p_user) IS NULL THEN
        RETURN NULL;
    END IF;
    IF public.savings_bonus_framing(p_user) = 'percent' THEN
        RETURN 'teen';
    END IF;
    v_age := public.family_child_age(p_user);
    IF v_age IS NOT NULL AND v_age >= 10 THEN
        RETURN 'transition';
    END IF;
    RETURN 'young';
END;
$$;
REVOKE ALL ON FUNCTION public.family_money_register(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_money_register(uuid) TO service_role;

-- ── Appendix H (Threshold Recalibration Log, D.12): how many wallet holders
-- read each register. Counts only, never an identity. A recalibration of the
-- 10- and 13-year cutoffs starts from this distribution and the D.11
-- comprehension proxy, not from a guess.
CREATE OR REPLACE FUNCTION public.family_money_register_distribution()
RETURNS TABLE (register text, holders bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
    WITH holders AS (
        SELECT DISTINCT user_id FROM public.user_roles WHERE role = 'kid'
        UNION
        SELECT user_id FROM public.account_age_declarations WHERE declared_age_band = '13_to_17'
    ),
    registered AS (
        SELECT public.family_money_register(h.user_id) AS register FROM holders h
    )
    SELECT r.name, count(g.register)
    FROM (VALUES (1, 'young'), (2, 'transition'), (3, 'teen')) AS r (ord, name)
    LEFT JOIN registered g ON g.register = r.name
    GROUP BY r.ord, r.name
    ORDER BY r.ord;
$$;
REVOKE ALL ON FUNCTION public.family_money_register_distribution() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.family_money_register_distribution() TO service_role;

select 'migration_family_money_register_ok' as sentinel;
