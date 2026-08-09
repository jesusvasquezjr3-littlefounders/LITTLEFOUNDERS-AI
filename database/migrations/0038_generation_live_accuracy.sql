-- 0038_generation_live_accuracy.sql — make live generation progress complete
-- and resume-safe. The live monitor must distinguish successful, failed and
-- skipped terminal slots; otherwise a resumed run can report false progress
-- or remain active forever after a slot was intentionally skipped.

ALTER TABLE public.generation_runs_live
  ADD COLUMN IF NOT EXISTS skipped_slots integer NOT NULL DEFAULT 0;

ALTER TABLE public.generation_heartbeat_snapshots
  ADD COLUMN IF NOT EXISTS skipped_slots integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.generation_runs_live.skipped_slots IS
  'Terminal slots skipped without publication; included in processed progress.';

COMMENT ON COLUMN public.generation_heartbeat_snapshots.skipped_slots IS
  'Terminal slots skipped without publication; included in processed progress.';
