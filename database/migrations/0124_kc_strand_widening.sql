-- @phase: contract
-- @after-release: none — pure widening; every existing strand value remains valid and no running code writes the new ones.
-- Apply before running `npm run seed:kc` with the S05.3a graph; operator review is still required.
--
-- B.6 (S05.3a): the shared knowledge-component graph now covers every
-- published topic, including personal-finance habits, safety and community
-- topics (money_life) and the investing course (investing). 0052 allowed only
-- money_math and entrepreneurship. The conservative deployment classifier
-- treats any CHECK replacement as a contraction, so this is declared contract
-- and needs a human dispatch rather than auto-apply, like 0091.
--
-- The seed file loads every new KC as status 'draft': the Mentor reads only
-- active KCs (getActiveKcs, the kc RLS policy), so widening the vocabulary
-- and seeding changes nothing a learner or the Mentor sees until the owner
-- accepts the pathway policy and the KCs are activated in the seed file.
ALTER TABLE public.kc
    DROP CONSTRAINT IF EXISTS kc_strand_check,
    ADD CONSTRAINT kc_strand_check CHECK (strand IN (
        'money_math', 'entrepreneurship', 'money_life', 'investing'
    ));
