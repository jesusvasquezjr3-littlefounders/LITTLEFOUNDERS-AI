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
