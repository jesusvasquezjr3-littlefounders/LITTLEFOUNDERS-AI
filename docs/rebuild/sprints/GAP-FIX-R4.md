# Gap-fix round 4

Lane records for the fourth gap-fix round of the SPEC migration. Each lane
appends its own section. Statuses follow the ledger: implementation, local
verification, acceptance and release are separate, and nothing here is
accepted or released.

## Checkpoint F4-design-system

Branch `codex/spec-fix4designsy`. Two audited gaps in the design-system area.
Both were checked in the code first and both were real.

### What was built

1. **The learner's age band on the app root** (Bible 06 §7, 06 §3.1, 02 D11
   and rule 19). `ShellRoot` never passed an `ageBand`, so no mounted shell
   root carried `data-age-band`, and a 6-9 child's journal and rhythm were
   budgeted as adult pages (40 first-view words instead of 25).
   - `frontend/src/app-shell/useLearnerBand.ts` reads Core's register
     (`GET /learn/register`, B.23) once per account for the learner shell; the
     youngest band while unknown or when Core cannot answer, remembered across
     the shell's remounts. `AppShellLayout` passes it through `ShellRoot` to
     `RebuildRoot` (and the environment); the Tutor console and the staff
     console carry `adult`.
   - `DecisionJournalView` and `LearningRhythmView` declare `data-age-band`
     (their routes read the band the shell resolved; the preview passes its
     `age`). The lesson route's opening, recall and refusal screens now carry
     the learner's band too (they carried none; found by the new rule).
   - Audit rule `age-band-missing` (`scripts/audits/rules.mjs`, fed the
     scenario's band by `audit-rebuild.mjs`): a real route signed in as a 6-9
     learner that measures no young block is a finding. New state
     `/learn/journal@child`; the synthetic journal answer now says
     `sharedWithTutor` for a parent-created child under 13 (OD-27 (3)).
   - Copy fixed to the 6-9 first view: the journal's Tutor line is now
     "Your Tutor sees your choices." (26 to 23 words, EN).
2. **Four mounted screens in no audit state** (02 §7 item 10, 06 §7, 03 §5).
   - `learn.mjs`: `/learn/together` ready, empty, reached (independent teen)
     and closed (parent-created teen, no Tutor opt-in), plus previews
     `together@13-17` and `together-closed@13-17`.
   - `staff.mjs`: `/admin/age-corrections` queue, request sheet (superadmin and
     a `manage_users`-only admin) and empty queue.
   - `core.mjs`: `/account-deletion` scheduled, held, kept (one press),
     signed out after confirming and deleted, plus preview `account-deletion`
     processing, unavailable and loading on the screen layout. The router
     hand-off states use a new driver field `pushState` (router state pushed
     once the app has mounted, as `navigate(path, { state })` does).
   - `site.mjs`: `/badge/:token` expired and ready, signed out (new scenario
     field `signedOut`: Core answered for a visitor with no session). The ready
     state is declared only until the route's retirement date
     (`BADGE_LINK_ROUTE_RETIRES_AT`), after which every link reads as expired.
   - The synthetic Core answers `/learn/register` for any scenario from its
     age and `/auth/me` carries a scenario's `accountDeletion`.
   - Findings fixed: goals together exceeded the 40-word first view (58, 41,
     46 and 54 words) and the closed body joined two ideas (16 words). The
     intro and rules became one line ("Just your group. No scores, no chat."),
     the invitation card lost the repeated "With {names}" line, the members
     subhead went (the list keeps its accessible name), and asking, removing,
     reporting and leaving sit behind one "Manage goal" disclosure (06 §3.1:
     a second step, not more text); the closed hint is its own line. The badge
     page's two body strings were over 12 words and its text was centred on a
     single-state screen; both copy strings were shortened and the text is
     left-aligned.
   - A defect the audit found: a signed-in reload of `/account-deletion`
     rendered before Core's `/auth/me` answered and bounced the holder to the
     public landing page. `AccountDeletionStatus` now waits for `meLoaded`.
   - **Gate**: `src/app-routes/__tests__/auditCoverage.test.tsx` builds the
     route table from the same fragments `App.tsx` mounts and fails when a
     mounted route has no real-route audit state (react-router decides where
     each state's address lands) unless it carries a written reason (three
     redirects). It runs in the frontend suite, so in CI and in
     `release:readiness` (`test:all`).

### Verification (local)

- `npm run audit:rebuild` over the 26 new or changed states, full matrix
  (3 locales x 2 modes x 320/375/768/1280): text fit 2,496, proportion 624,
  copy budget 624 configurations; after the badge fix, 0 findings and no JS
  errors. The 33 real routes signed in as a 6-9 learner, copy budget at
  375 px EN: 0 findings after the lesson-layer fix (4 states had reported
  `age-band-missing`).
- Frontend `type-check`, `lint`; focused vitest (43 files, 342 tests: app
  shell, app routes, audit rules, together, journal, rhythm, learn routes,
  account deletion, copy-budget suites, site, marketing, account, preview).
- Root `spec:check`, `secrets:check`, `bash agent/tools/check-i18n.sh`: pass.

### Decisions taken with the SPEC's conservative default (owner questions)

- The badge-link page is audited at the app budget (it renders on the
  single-state shell, like the not-found and suspended screens), not the site
  budget (whose 3:1 hero ratio fits a marketing page). Its copy also fits the
  site budget the unit copy test applies.
- Goals together keeps its management actions one press away behind "Manage
  goal" rather than splitting the page into more steps.

### Migrations

None.

### Open items

- The full `audit:rebuild` matrix over every state (386) was not re-run by the
  lane; the orchestrator's merge gate runs it. The shell band now applies to
  every learner page, so a 6-9 page that relied on an absent band would show
  up there (none did among the 33 young real routes measured).
- `audit:rebuild` itself (dev server plus Chrome) is still not a step of
  `release-readiness.sh` or CI; the route-coverage test guarantees the state
  exists, not that the run happened.
