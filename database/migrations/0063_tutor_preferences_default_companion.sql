-- 0063_tutor_preferences_default_companion.sql — a brand-new learner's FIRST
-- preferences save must persist the documented default companion, never NULL.
-- @phase: expand
--
-- FOUND BY ADVERSARIAL REVIEW SWEEP tutor-review-sweep-92 (onboarding
-- dimension), HIGH. `tutor_preferences.companion` (0047) carries no DEFAULT —
-- only `character` does (`DEFAULT 'rho'`) — while `upsertTutorPreferences`
-- (backend/src/services/tutorData.ts) sends a PARTIAL body:
-- `{user_id, ...patch, updated_at}`, whatever `patch` happens to include.
-- Through `on_conflict=user_id, resolution=merge-duplicates`, PostgREST turns
-- an omitted field into a column simply absent from the INSERT's target
-- list, so it lands on the column's own DEFAULT — 'rho' for `character`, and
-- (nothing declared, until this migration) NULL for `companion`.
--
-- That collides with the SERVICE layer's own documented default:
-- `getTutorPreferences` returns `{character: 'rho', companion: 'liruf', ...}`
-- for a learner who has never saved anything — the pairing the onboarding
-- picker shows before a single tap. `PersonalizeInWorld.tsx`'s `chooseTutor`
-- sends ONLY `{character: id}` on the very first pick, unless the newly
-- chosen character happens to collide with the CURRENT companion — so
-- nearly every brand-new account's first-ever `PUT /preferences` (picking a
-- tutor character, the routine first onboarding action) INSERTs a row with
-- `companion = NULL`, silently and permanently discarding the documented
-- default the moment ANY field other than `companion` itself is first
-- saved. Once that row exists, `getTutorPreferences`'s synthetic default
-- never applies again (`rows[0] ?? default` — `rows[0]` now exists), so the
-- companion a learner was shown before saving anything quietly disappears
-- from the island and never returns unless they separately discover and use
-- the companion picker.
--
-- THE FIX. `companion` gets the same treatment `character`/`diorama`/
-- `backdrop`/`adaptations` already have: a real column DEFAULT, so an
-- OMITTED field lands on the documented default on a genuine INSERT.
-- Crucially, this does not touch the partial-UPDATE path at all:
-- `resolution=merge-duplicates` only ever references `EXCLUDED.<col>` for
-- columns present in the CALLER's own JSON body, so a field omitted from a
-- second-or-later save still leaves the existing stored value untouched on
-- the update branch, exactly as before — this migration cannot resurrect a
-- companion a learner has since, deliberately, cleared. Verified against a
-- real local Postgres instance: a first save touching only `character`
-- lands with `companion = 'liruf'` (was NULL before this migration); a
-- later save that touches only `diorama` leaves an already-chosen companion
-- exactly as it was; an explicit `companion: null` on a first save is still
-- honored as NULL (an explicit value always wins over a column DEFAULT,
-- before any trigger below even runs).
--
-- The one wrinkle a plain DEFAULT cannot express: `companion` MUST differ
-- from `character` (`tutor_preferences_companion_differs`, 0047), and the
-- default companion IS one of the four selectable characters — so a
-- first-ever save that picks Liruf as the TUTOR (`character = 'liruf'`)
-- without also naming a companion would default `companion` into 'liruf'
-- too and fail that CHECK outright, trading a silent NULL for a hard 502 on
-- exactly the combination that most needs to succeed. (The shipped picker
-- already avoids this — `chooseTutor` sends an explicit `companion: null`
-- whenever the newly chosen character collides with the current companion —
-- but nothing downstream of Core should depend on a specific client
-- happening to do that.) The trigger below closes exactly that gap and
-- nothing more: it only runs on a genuine INSERT (the update branch of an
-- upsert never re-derives NEW from the table DEFAULT — see above), and it
-- only overrides a companion that took the new DEFAULT and now collides
-- with the character just chosen — in which case there is no valid
-- non-null default left, so it stays NULL (a documented, legitimate "no
-- companion" state — /ORACLE.md: "Companion: any other character, or
-- none") rather than raising a constraint violation. Verified: an explicit
-- collision (`character = companion` both given outright) still correctly
-- fails the CHECK, unaffected by this trigger — the fallback only fires for
-- the DEFAULT-vs-character collision, never for a genuine explicit one.
--
-- Deliberately NOT backfilling existing NULL rows: a NULL companion already
-- has two indistinguishable causes after the fact — this bug, and a learner
-- who explicitly removed their companion via the picker's own toggle
-- (`toggleCompanion`, which sends `companion: null` on purpose) — and
-- guessing which is which for an existing row would silently overwrite a
-- real, deliberate choice for some unknown fraction of them. This migration
-- only changes what a FUTURE first-ever save persists.

ALTER TABLE public.tutor_preferences
    ALTER COLUMN companion SET DEFAULT 'liruf';

CREATE OR REPLACE FUNCTION public.tutor_preferences_default_companion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only the documented-default collision: an OMITTED companion took the
    -- column's new DEFAULT ('liruf') and the character just chosen for THIS
    -- row is also 'liruf'. An explicit companion, an explicit null, or a
    -- default that does not collide all pass through untouched.
    IF NEW.companion = 'liruf' AND NEW.character = 'liruf' THEN
        NEW.companion := NULL;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tutor_preferences_default_companion ON public.tutor_preferences;
CREATE TRIGGER trg_tutor_preferences_default_companion
    BEFORE INSERT ON public.tutor_preferences
    FOR EACH ROW EXECUTE FUNCTION public.tutor_preferences_default_companion();
