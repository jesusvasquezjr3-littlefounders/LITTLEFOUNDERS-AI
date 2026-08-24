-- 0048_course_in_progress_notice.sql — lets a course say, on its own card and
-- on its own path, that it is still being built.
--
-- WHY THIS IS A FLAG AND NOT A DERIVED FACT. Entrepreneurship and Investing are
-- going live with 414 and 416 lessons of finished, judged, trilingual text and
-- with ZERO narration and ZERO illustrations — verified against production, not
-- assumed: 0 of 1,242 and 0 of 1,248 locale documents carry audio, and a 25-doc
-- sample of each found 0 illustrated segments, against financial-education's
-- 1,425 of 1,425 narrated and 29% illustrated. A learner who meets that with no
-- warning concludes the product is broken, and they are not wrong to.
--
-- It could have been derived from asset coverage. It is not, on purpose: "we
-- are still working on this" is an EDITORIAL statement about intent, and a
-- derived one would switch itself off the moment a backfill crossed some
-- threshold nobody chose, on content nobody had looked at. An operator turns
-- this off when the course is actually ready.
--
-- Additive and default-safe: every existing course keeps `false`, so nothing
-- that is finished starts apologising for itself.

ALTER TABLE public.courses
    ADD COLUMN IF NOT EXISTS in_progress boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.courses.in_progress IS
    'True while a published course is still missing production assets (narration, '
    'illustrations). The learner-facing catalog shows a short "still being built" '
    'notice. Operator-set: turn it off when the course is genuinely complete.';
