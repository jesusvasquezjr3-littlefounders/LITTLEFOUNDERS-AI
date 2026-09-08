-- 0078_task_hardening.sql — three fixes from the 2026-09-08 deep audit of
-- the Family Hub (tasks/wallet/goals/evidence): a cancellation a kid can see
-- a reason for, a parent-settable "this task needs a photo" gate, and a
-- database-level backstop on who may ever set the evidence_* pointer.
-- @phase: expand
--
-- WHY cancel_reason. A parent cancelling a task with an already-uploaded
-- evidence photo (backend/src/routes/tasks.ts POST /:id/cancel) previously
-- gave the kid no explanation — the task and its photo simply vanished from
-- their list. Optional, short, kid-facing.
--
-- WHY requires_evidence. Today an evidence photo (0077) is always optional —
-- a parent can approve any task with nothing attached. This lets a parent
-- opt a specific task INTO requiring one; enforcement lives in Core
-- (POST /:id/approve), not here, matching how every other task-state
-- transition in this schema is enforced at the service layer (0074's own
-- comment on tasks_update_party).
--
-- WHY the trigger. tasks_update_party (0074) is a row-visibility policy, not
-- a column-legality one — by design, per that migration's own comment, every
-- other transition is enforced by Core. But evidence_* is different: it is
-- the one thing that must be traceable to an ACTUAL upload through
-- evidence.ts, never merely asserted. Core always writes with the service
-- role today (§1.5), which already bypasses RLS entirely, so this trigger
-- changes nothing observable now — it exists so that IF tasks ever became
-- reachable by an authenticated JWT directly (the same class of "the
-- exception was known and written down, but nothing enforced it" gap
-- /AGENTS.md §1.14 already has two named incidents about), a kid could not
-- set their own evidence_bucket/hash/ext to point at an arbitrary object
-- that was never actually uploaded through this task's own flow.

ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS cancel_reason     text CHECK (cancel_reason IS NULL OR length(cancel_reason) <= 240),
    ADD COLUMN IF NOT EXISTS requires_evidence boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.forbid_client_evidence_write()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
        IF NEW.evidence_bucket IS DISTINCT FROM OLD.evidence_bucket
           OR NEW.evidence_hash IS DISTINCT FROM OLD.evidence_hash
           OR NEW.evidence_ext IS DISTINCT FROM OLD.evidence_ext
           OR NEW.evidence_uploaded_at IS DISTINCT FROM OLD.evidence_uploaded_at
        THEN
            RAISE EXCEPTION 'evidence_* columns may only be written by the service role';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_forbid_client_evidence_write ON public.tasks;
CREATE TRIGGER trg_forbid_client_evidence_write
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.forbid_client_evidence_write();

SELECT 'migration_0078_ok' AS sentinel;
