-- 0053_learner_memory.sql — the Tutor V4 learner memory: curated per-learner
-- stores with hard limits, an append-only write ledger, and full-text search
-- over the persisted transcripts (episodic memory).
-- @phase: expand
--
-- Authoritative design: /ORACLE.md §20 (V4, the bicameral tutor). Owner
-- decisions 2026-08-29: adopt the harness architecture as patterns; memory
-- stores AUTO-WRITE with an auditable ledger, and the parental approval gate
-- is documented as BLOCKING before rollout to real families.
--
-- WHAT THIS ADDS AND WHY.
--
--   learner_memory          Two small prose stores per learner — LEARNER
--                           (who this child is: interests, what motivates
--                           them, what to avoid) and PEDAGOGY (what teaching
--                           actually works with them). The HARD character
--                           limit is the design, not a constraint to relax:
--                           an unbounded memory becomes a landfill and stops
--                           being read; the limit forces the writer to decide
--                           what matters (the Hermes pattern). These ~500
--                           tokens are injected into every session and are
--                           the best token-for-token upgrade in the system.
--
--   learner_memory_ledger   Append-only record of every store write: who,
--                           when, from which session, content hashes before
--                           and after. This is the compensating control for
--                           auto-write — every belief the system holds about
--                           a child is traceable to the write that created
--                           it, and reversible by hand from the hashes.
--                           NO UPDATE/DELETE at policy level (audit_logs
--                           pattern). Deliberately NOT FK'd to
--                           tutor_sessions: sessions purge at 90 days and
--                           the audit trail must outlive them.
--
--   tutor_turns.text_tsv    Generated tsvector + GIN index — the episodic
--                           memory. "¿Te acuerdas del problema de las
--                           galletas?" becomes a ~20 ms indexed query with
--                           zero model cost, which is what makes literal
--                           recall affordable inside the conversation clock.
--                           Inherits the 90-day retention window by riding
--                           the same table, which is the intent: episodic
--                           memory forgets on the same schedule the
--                           transcripts do.
--
--   search_tutor_turns()    SECURITY DEFINER function for PostgREST /rpc/ —
--                           scoped to ONE user's own sessions by parameter,
--                           called only by Core with the service role. Uses
--                           websearch_to_tsquery so learner-shaped queries
--                           ("problema de las galletas") work as typed.
--
-- PRIVACY (relation to 0051). 0051 deliberately forbade storing prose derived
-- from transcript text in the session summary. These stores SUPERSEDE that
-- decision for exactly two bounded fields, by owner order (2026-08-29), with
-- compensating controls: the append-only ledger above, parental visibility by
-- RLS from day one (a verified guardian can SELECT their child's stores), and
-- the §1.9 content rules (no surnames, no locations) enforced at the writer.
-- The parental APPROVAL gate (§15.1 of the harness doc) is documented in
-- /ORACLE.md §20 as blocking before family rollout.

-- ────────────────────────────── learner_memory ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.learner_memory (
    user_id     uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    store       text NOT NULL CHECK (store IN ('learner', 'pedagogy')),
    content     text NOT NULL CHECK (char_length(content) > 0),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, store),
    -- The hard limits, per store. 1,400 chars of who-they-are; 2,200 of
    -- what-works. A writer that cannot fit must consolidate, not grow.
    CONSTRAINT learner_memory_limit CHECK (
        (store = 'learner'  AND char_length(content) <= 1400) OR
        (store = 'pedagogy' AND char_length(content) <= 2200)
    )
);

ALTER TABLE public.learner_memory ENABLE ROW LEVEL SECURITY;

-- The learner reads their own; a verified guardian reads their child's —
-- parental visibility is an invariant (§1.9), not a feature flag.
DROP POLICY IF EXISTS learner_memory_select_own ON public.learner_memory;
CREATE POLICY learner_memory_select_own ON public.learner_memory
    FOR SELECT USING (user_id = auth.uid() OR public.is_verified_guardian_of(user_id));
-- No INSERT/UPDATE/DELETE policies: only the service role writes.

-- ─────────────────────────── learner_memory_ledger ─────────────────────────

CREATE TABLE IF NOT EXISTS public.learner_memory_ledger (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid NOT NULL,
    store        text NOT NULL CHECK (store IN ('learner', 'pedagogy')),
    actor        text NOT NULL CHECK (char_length(actor) BETWEEN 1 AND 64),
    -- sha256 hex of the content before and after; before is NULL on first write.
    before_hash  text NULL CHECK (before_hash IS NULL OR before_hash ~ '^[0-9a-f]{64}$'),
    after_hash   text NOT NULL CHECK (after_hash ~ '^[0-9a-f]{64}$'),
    -- The session whose review produced the write. Plain uuid, NO foreign
    -- key: sessions purge at 90 days and this trail must outlive them.
    session_id   uuid NULL,
    created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learner_memory_ledger_user
    ON public.learner_memory_ledger (user_id, created_at DESC);

ALTER TABLE public.learner_memory_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS learner_memory_ledger_select_own ON public.learner_memory_ledger;
CREATE POLICY learner_memory_ledger_select_own ON public.learner_memory_ledger
    FOR SELECT USING (user_id = auth.uid() OR public.is_verified_guardian_of(user_id));
-- Append-only at policy level: no UPDATE/DELETE policy exists, and none may
-- ever be added (audit_logs pattern, §1.3).

-- ───────────────────── episodic memory: transcript FTS ─────────────────────

-- `spanish` covers es-MX, our primary locale; for en-US/pt-BR content the
-- match degrades to stemless term matching, which is still useful and still
-- indexed. A per-locale column per language would triple the index for two
-- locales with a fraction of the traffic.
ALTER TABLE public.tutor_turns
    ADD COLUMN IF NOT EXISTS text_tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('spanish', coalesce(text, ''))) STORED;

CREATE INDEX IF NOT EXISTS idx_tutor_turns_text_tsv
    ON public.tutor_turns USING gin (text_tsv);

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
    ORDER BY rank DESC, tt.created_at DESC
    LIMIT LEAST(GREATEST(p_limit, 1), 10);
$$;

-- Service-role only: PostgREST exposes /rpc/search_tutor_turns, and no
-- anon/authenticated grant exists — Core calls it with the service key and
-- scopes it to the session's own user.
REVOKE ALL ON FUNCTION public.search_tutor_turns(uuid, text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_tutor_turns(uuid, text, int) FROM anon;
REVOKE ALL ON FUNCTION public.search_tutor_turns(uuid, text, int) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.search_tutor_turns(uuid, text, int) TO service_role;
