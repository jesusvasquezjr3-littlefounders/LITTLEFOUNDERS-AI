-- 0077_task_evidence.sql — a kid can attach a photo as proof of work; a
-- parent sees it before approving.
-- @phase: expand
--
-- WHY THIS EXISTS. FAMILY_HUB.md's loop asked a parent to trust "done" on
-- their word alone. A photo turns "I did it" into something the parent can
-- actually look at before spending an approval — the same shape a real
-- chore chart already has (a kid holds up the clean room, the parent looks).
--
-- WHAT IS STORED, AND WHERE THE BYTES ACTUALLY LIVE. Only a pointer.
-- `evidence_bucket/hash/ext` is the same triple filebase's own `id` field
-- already returns (`${bucket}/${hash}.${ext}`, filebase/src/routes/files.ts) —
-- split into three columns instead of one string so the CHECK on `ext` can
-- reject anything that isn't a photo without parsing. The bytes are NEVER
-- written here and NEVER made `public` in Depot: a photo of a child's room,
-- homework or face is a materially different privacy class than a curated
-- achievement badge (§1.9), so it is stored `visibility: internal` and only
-- ever reaches a browser through Core's own re-authenticated proxy route
-- (backend/src/routes/tasks.ts, GET /:id/evidence) — never a raw Depot URL.
--
-- No RLS change needed: these are new nullable columns on a row the existing
-- tasks policies (0074) already scope correctly (assigned party or verified
-- guardian). Core reaches Depot with the service-role internal key either
-- way, exactly like every other filebase caller.

ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS evidence_bucket      text,
    ADD COLUMN IF NOT EXISTS evidence_hash         text,
    ADD COLUMN IF NOT EXISTS evidence_ext          text CHECK (evidence_ext IS NULL OR evidence_ext IN ('jpg', 'jpeg', 'png', 'webp')),
    ADD COLUMN IF NOT EXISTS evidence_uploaded_at  timestamptz;

SELECT 'migration_0077_ok' AS sentinel;
