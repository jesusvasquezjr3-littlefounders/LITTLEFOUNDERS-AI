# Gap-fix round 1

Audited SPEC gaps closed after wave 3, one section per lane. Statuses follow the migration rule: implemented and locally verified is not accepted. Nothing here is accepted, released or deployed, and nothing was pushed.

## Family (`codex/spec-fix1family`)

### F1-family.1: the money section is the Wallet in every label (OD-28 glossary)

**Gap (confirmed in code).** The verified parent's `/banking` tab read "Coins" / "Monedas" / "Moedas" and a linked teen's "Family coins"; the Tutor page's H1 was "Coins" and the linked teen's "Family coins". Only a parent-created child saw "Wallet". The glossary gate refused only the retired name and a bare "Banking", so the mismatch passed.

**Built.**
- Copy, all three locales: `appShell.nav.coins` is "Wallet" / "Cartera" / "Carteira" (the Tutor's tab, one word so the 375 px bar does not wrap more than recorded in W2F.2); `appShell.nav.familyCoins`, `familyCoins.title` and `childCoins.titleFamily` are "Family wallet" / "Cartera familiar" / "Carteira da família"; the failure, refusal and verification titles of both screens name the wallet.
- Path: the family Wallet moved from `/banking` to `/family-wallet` (the glossary avoids "bank"). `frontend/src/rebuild/banking/walletPath.ts` holds the path; the three navigation slots, the Family console, Tasks links and the route read it; `/banking` redirects and keeps `?child=`. API paths (`/api/v1/banking/*`) are unchanged: no person reads them.
- Gate: `agent/tools/check-wallet-glossary.mjs` section 4 requires the Wallet term in every navigation label and page, failure and refusal title of `/family-wallet` and `/wallet` (a missing key is refused), and refuses a Wallet navigation slot whose path says "bank".

**Verified.** Glossary gate mutation tests (23, five new refusals); `familyWalletPath.test.tsx` (redirect keeps the child, every slot on the new path); navigation, app shell, family console, tasks, coins and copy-budget unit tests; `spec:check`, i18n gate, type-check and lint.

**Remains.** Native copy review of the new terms; the family audit's money states now open `/family-wallet` (not rerun in this lane; the orchestrator runs the matrix at merge).

### F1-family.2: the Tutor sees every drawn board in a child's Mentor talks (Block D oversight, Product 10 §1.9, OD-9)

**Gap (confirmed in code).** F3 (`ChildMentorTalks.tsx`) printed only each board's caption; `consoleApi.ts` reduced a board to `{ kind, label }` and dropped the wire Core already sends on transcript turns, the savings plan and the kept boards, although the Mentor lane's renderer (`mentor/screen/MentorBoard.tsx`) now exists. W2-FAMILY-AND-WALLET recorded this as an OD-9 reduction against the legacy guardian transcript.

**Built.**
- `consoleApi.ts`: `BoardNote` keeps `wire` (the Mentor lane's `TutorWhiteboardWire`) beside the caption. `boardWire()` validates it with the Mentor lane's own `boardModel`: a shape the model draws (an unknown shape yields no model), a caption, and every row writable (no missing field, no value that is not a number). Anything else keeps the caption alone.
- `ChildMentorTalks.tsx`: the transcript (from a talk and from a flag) and the kept boards and savings plan render `<MentorBoard readOnly>` with the page locale's `mentorScreen.board` copy, titled by the caption; a render failure falls back to the caption (error boundary). Heading levels follow the page outline (h3 under a section, h4 inside a talk).
- `MentorBoard.tsx` gains `readOnly` (a class II shape, such as grab, fill, what-if or your turn, is drawn as its rows with every value written and no control) and `headingLevel`; `TeachingChartBoard.tsx` gains `headingLevel`. Defaults keep the Mentor stage and lesson player unchanged.
- Family audit: the transcript and plan fixtures now use real wire shapes; new scenario `family-mentor-boards` and state `/family/:kid/tutor@boards` (a talk with a drawn goal bar and a read-only your-turn board, and a kept board).

**Verified.** `consoleApi.test.ts` (every Mentor board fixture in three locales passes the validator; unknown shape, no caption, old shape, non-number and missing figure refused), `ChildMentorTalks.test.tsx` (drawn board with its caption as an h4 title and its figures; class II board read-only with no control; undrawable boards keep their caption; kept boards drawn); family, Mentor, learning and copy-budget suites (999 tests); type-check, lint, `spec:check`.

**Remains.** The new audit state was not run in this lane (the orchestrator's matrix at merge); native review of the board words is the Mentor lane's.

### F1-family.3: no card-shaped number is minted, stored or served (D.7)

**Gap (confirmed in code).** Core's `generateDisplayNumber()` minted `LF-1234-5678` on every account insert, `toWireAccount` served `displayNumber` on the account routes, and `banking_accounts.display_number` stayed `NOT NULL`. The rebuilt UI only dropped the field in its API layer; NO-UNBACKED-GUARANTEE.md left the removal open.

**Built.**
- Core: `generateDisplayNumber` removed; `insertBankingAccount` sends only the row; `BANKING_ACCOUNT_FIELDS` and `BankingAccountRow` no longer name the column; `toWireAccount` no longer returns `displayNumber` (`backend/src/services/supabaseRest.ts`, `backend/src/routes/banking.ts`).
- Migrations (lane numbers; the orchestrator renumbers at merge): `banking_display_number_optional` (expand; drops the NOT NULL, guarded so a chain replay after the drop is a no-op) and `banking_display_number_drop` (contract, `@after-release` the Core release above): redefines `guard_banking_account_state()` without the column (a PL/pgSQL body naming a dropped column fails at run time), redefines `social_messaging_surfaces()` without the reviewed name `text:banking_accounts.display_number` (removed from SOCIAL-GOVERNANCE.md §2.2 too), then drops the column. The 0121 and 0178 copies of the scan are history; 0192 was the live one.
- Verifiers that seed an account insert the number only while the column exists (`number_columns()` in six `database/scripts/verify-*-postgres.py`).
- Docs: the open line in NO-UNBACKED-GUARANTEE.md is closed; `block-d-controls.json` `simulation` names the Core select list as enforcement and the new Core test as proof. Fixtures (`moneyFixtures.ts`, `BankingPage.test.tsx`, the family audit, three verify scripts) no longer carry `displayNumber`; `CoinAccount.test.tsx` keeps its refusal of a card that carries a number.

**Verified.** Core `banking.test.ts` (the insert body carries no number; neither a parent nor a child read serves one, even from a row stored before the drop; the select list does not name the column), `choreStreakBonus`, `moneyPresentation` (151 tests); `database` npm test (migration numbering, phase gate: 147 expand / 47 contract, lifecycle); native PostgreSQL 17.6 on a lane cluster (port 15760) over the WHOLE chain (`LF_PG_FULL_CHAIN=1`): seven verifiers green: family state machine, account erasure, social governance (the E.10 messaging scan finds nothing unreviewed after the drop), teen wallet, money habits, autonomy decisions and family governance. Run in parallel they exhausted Windows client ports (connection refused, empty psql errors); run one at a time they pass. The `railway-migrate` test inside `database` npm test was still running (contended by several lanes) when the lane closed; every other part of that script passed; `guardrails:check`, `no-unbacked-guarantee`, type-check, lint.

**Remains.** `database/types/database.ts` still lists `display_number`: `db:types` needs the Supabase CLI and a local stack, neither available to this lane (the shared Docker database is off limits); regenerate at integration. Deploy order: Core first, then the contract migration (the expand one may go either side).

### Owner questions and defaults (family)

- **Tutor tab wording.** Default taken: the Tutor's tab is "Wallet" and the page title "Family wallet" (a Tutor has no personal wallet, OD-3; one word keeps the 375 px tab bar from wrapping further). The owner may prefer "Family wallet" on the tab too.
- **Path.** Default taken: `/family-wallet`, with `/banking` redirecting (the glossary avoids "bank"; `/wallet` is the independent teen's). API paths stay `/api/v1/banking/*`.

### F1-family-finish: lane summary

**Closed in code (implemented and locally verified, not accepted):** the three audited family gaps. (1) OD-28 glossary: the money section reads Wallet / Cartera / Carteira in every label and title, at `/family-wallet` (`/banking` redirects), pinned by the glossary gate. (2) Block D oversight (Product 10 §1.9, OD-9): the Tutor's view of a child's Mentor talks draws every board read-only with the Mentor lane's renderer, validated at the API edge. (3) D.7: Core no longer mints, stores or serves the card-shaped account number; expand and contract migrations remove the column.

**Finish pass.** Synced with `codex/spec-migration-s02` (already up to date). Adversarial sweep: no `displayNumber`/`display_number` left in any service source outside refusal tests; no rebuilt route opens `/banking` (only API paths `/api/v1/banking/*`); the rebuilt console imports only shared controls and the Mentor lane's board; every new element carries `data-copy-role`. Authorization is unchanged at the server: the boards travel on the existing guardian-only transcript endpoints, and D.7 is a removal.

**Verified once at lane end.** frontend and backend type-check and lint green; root `spec:check`, `secrets:check`, `tools:test` and the i18n gate green. Full unit suites under 100% CPU from parallel lanes: frontend 2849/2862 and backend reds were timeouts in files this lane did not touch; each passed when rerun alone, except `backend/src/__tests__/analytics.test.ts` "does not invent years of leading zeros for all-time", which fails deterministically because it reads the real clock (40 days from its 2026-08-20 fixture to 28 Sep 2026, against a bound of 40). It is not lane code and was left for the owner of that test. `database` npm test: see the lane's final report.

**Open.** `database/types/database.ts` still lists `banking_accounts.display_number` (regenerate with `db:types` at integration; no Supabase CLI or stack here). Deploy order for D.7: Core first, then `banking_display_number_drop`. The new audit state `/family/:kid/tutor@boards` and the `/family-wallet@*` states were not run through the audit matrix. Native copy review of Cartera familiar / Carteira da família and of the read-only board words.
