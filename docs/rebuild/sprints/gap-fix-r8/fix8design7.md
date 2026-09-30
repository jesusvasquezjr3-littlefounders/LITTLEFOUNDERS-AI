# Gap-fix round 8: design-system (fix8design7)

Branch `codex/spec-fix8design7`. Status: **implemented and locally verified; not accepted.** Nothing here ran in production, against the shared Docker database or in a browser. The orchestrator runs `audit:rebuild` over the new states once, at the end of the round.

## 1. The Bible audits never rendered the OD-9 consent panels or the H-25 re-consent card

**SPEC:** OD-9 section 4.2 and S10.3c (consent surfaces); owner answer H-25 (research consent lapses at 18, and re-consent is requested); Frontend Bible 02 section 7 item 10, 03 section 5, 06 section 7; the CLAUDE.md rule that the text-fit, proportion and copy-budget audits must all pass before UI merges.

**The gap was real.** Each claim was checked in the code:

- `frontend/scripts/audits/lanes/core.mjs` answered every data-practice read with `{ migrated: false, practices: [] }`. Core is the first lane `synthetic-core.mjs` asks, and no other lane had a data-practices handler.
- `DataPracticeConsent` returns null unless the child is migrated. `MyDataPractices` returns null when it has no practice to show. Both panels are mounted on real routes:
  - the Tutor's panel in the privacy slot of `/family`;
  - the account's own panel on the kid Coins route (`/family-wallet`, `BankingPage` `ChildCoinsRoute`) and on the teen wallet (`/wallet`).
- `AdultResearch` returns null unless research has lapsed or the adult said yes. Only the family lane answered `/family-hub/research/me`, with `participating: false`, no `lapsed` field and `adult: false`. The profile lane's Settings scenarios got `{}`, which the validator refuses.

As a result, no audit state had ever drawn these four surfaces.

**Built.** The work is all in the audit's synthetic Core and lane states. No product code changed.

- **`lanes/core.mjs`.** The not-migrated default now applies only when a scenario does not declare `dataPractices`. Every other population keeps it, as the gap's point (d) requires.
- **`lanes/family.mjs`.**
  - `dataPracticeAnswer` returns Core's real wire shape. That shape is `toWireDataPractices` over `data_practice_state`: all 16 registered practices, ordered by kind and key, with the requirement codes from migrations 0186, 0202 and 0234. For a migrated child a practice applies only with a consent. Research is answered in its own flow (`ownFlow`). Only a self-registered teen with no Tutor can grant the analytics classes to themselves (`selfGrantable`).
  - PUT answers return the answered state. The `refused` mode returns `DATA_PRACTICE_NOT_ALLOWED` (403).
  - New scenarios:
    - `family-practices`: KID_A is a migrated child. Four practices are answered and the rest are not, and all four groups have members. KID_B is not migrated.
    - `family-practices-refused`: the same child, but Core refuses the answer.
    - `money-child-practices`: a migrated child aged 6-9, whose own view offers a no only.
    - `money-teen-practices`: a migrated self-registered teen with no Tutor. The usage counts are self-grantable, and two of them are already answered.
  - New states:
    - `/family@data-practices-closed`: the panel on arrival, with the first-view budget applied.
    - `/family@data-practices`: the usage-counts group opened.
    - `/family@data-practices-mentor`, `-story` and `-shared`: each remaining group opened. Opening every group means every practice label is measured, not only the first group's.
    - `/family@data-practices-refused`: the head, the group and a missing practice's switch are pressed, and the state waits for the error notice (`openReady`).
    - `/family-wallet@child-practices` and `/family-wallet@child-practices-open`.
    - `/wallet@teen-practices` and `/wallet@teen-practices-open`.
- **`lanes/profile.mjs`.**
  - `RESEARCH_ME` returns Core's `/family-hub/research/me` shape for two new scenarios:
    - `settings-research-lapsed`: the Tutor's grant, `adult: true`, recording stopped, `lapsed: true`.
    - `settings-research-self`: the adult's own grant.
  - New states:
    - `/profile/settings@research-lapsed`: the ask with Yes and No.
    - `/profile/settings@research-self-closed`: the adult's own yes before any press.
    - `/profile/settings@research-self`: the stop pressed and the confirmation opened (`openReady`).
- **The selectors are exported** (`PRACTICES`, `PRACTICE_STATES`, `RESEARCH_CARD`) so the unit test pins them.

**Verified.**

- **New `frontend/src/rebuild/family/consentAuditStates.test.tsx`** (9 tests). It proves:
  - core.mjs still answers not-migrated for `family-two`, `money-child`, `money-teen`, `profile-adult` and `profile-kid`, and leaves the four declared scenarios to the family lane.
  - Every new answer passes the validators the pages use: `fetchKidDataPractices`, `setKidDataPractice`, `fetchMyDataPractices`, `setMyDataPractice` and `fetchMyResearch`. The refused scenario returns `{ ok: false, code: 'DATA_PRACTICE_NOT_ALLOWED' }` and still reads.
  - Each state targets the route that mounts the surface, with the right scenario, and the four group states cover all of `PRACTICE_GROUPS`.
  - Every pressed selector matches the markup the surfaces render. This was checked in jsdom, in EN, es-MX and pt-BR for the Tutor's panel, with a non-empty label for every practice in every group.
- `familyAuditCore.test.ts`, `settingsAuditStates.test.tsx`, `auditCoverage.test.tsx`, `auditAgeBand.test.ts`, `DataPractices.test.tsx` and `ResearchSetting.test.tsx` all pass.
- `npm run type-check` and `npm run lint` in `frontend/` are clean. Root `spec:check` and `secrets:check` pass.
- The lane index loads with unique state ids and scenario names: 543 states.

**Open.**

- The browser run has not happened. Under this round's speed mode, the orchestrator runs `audit:rebuild` for all 14 new states in the full locale × theme × 320/375/768/1280 matrix. Any text-fit, proportion or copy-budget finding it reports on these surfaces is still to be fixed. Until that run passes, these states are declared, not proven.
- The gap noted that no preview-registry entry exists for either panel. That is left as is: the real routes now reach both panels, and the audits measure real routes.
- Acceptance still needs the human design and copy review, native es-MX and pt-BR review of the consent copy (OD-11), and production evidence.

**Owner questions:** none. The migrated-teen population follows the database's own rule: a teen with no Tutor can grant only the analytics classes to themselves.
