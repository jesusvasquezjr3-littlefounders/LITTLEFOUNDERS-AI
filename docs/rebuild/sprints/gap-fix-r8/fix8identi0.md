# Gap-fix round 8: identity-site (fix8identi0)

Branch `codex/spec-fix8identi0`. Status: **implemented and locally verified; not accepted.** Nothing here ran in production or against the shared Docker database. No migration.

## 1. The FAQ and the refusal sheet say what the under-13 account paths do (A.1, A.2, A.3; Appendix M 1.4 FAQ-Claim Feature Parity, Part 3 Stage 4; OD-3 section 2)

**The gap was real.** The public FAQ answer `faq.items.ages.answer` said "Under 13, a Tutor creates the account" (es-MX "Antes de los 13, un Tutor crea la cuenta", pt-BR "Antes dos 13, um Tutor cria a conta"). Two code paths contradict it:

- **Guest upgrade.** `POST /auth/upgrade` (`backend/src/routes/auth.ts`) checks only `user.isGuest`. The refused child's guest session, created by `POST /auth/guest` with `under13Origin`, can therefore attach an email and password and keep a permanent account. The A.2 marker in `account_safety_origins` stays on the same `auth.users.id`. `backend/src/__tests__/ageUpgradeChain.test.ts` already proves the upgrade succeeds and the safeguards hold.
- **Google.** A first Google sign-in that declares under 13 keeps the account and is reclassified. `public.record_age_declaration` (latest definition in `0179_age_declaration_birth_month.sql`) calls `mark_under13_origin`.

The refusal sheet also told the same child "A parent can create your own account later" (`authSignup.whyParent`). One step later, onboarding offered "Save your progress?".

**Decision.** The SPEC sanctions both paths. A.2 says the flag "must persist through guest-to-account upgrade (B8)". A.3 says the Google under-13 account is reclassified with the same marker. So the copy was wrong, not the code. The lane took the recommended default and changed the copy. It did not use the stricter alternative, which would refuse the upgrade with `409 UNDER13_ORIGIN_GUEST`.

**Built.**

- **`frontend/src/i18n/{en-US,es-MX,pt-BR}/rebuild-site.json`:**
  - `faq.items.ages.answer`: "Kids and teens, 6 to 17. A Tutor can create a child's account; a child under 13 can also sign up, with the strictest safeguards."
    - EN is 25 words in 2 sentences, the site budget (06 §3.2).
    - es-MX and pt-BR carry the same statement within 31 words.
  - `authSignup.whyParent`: "You can save your progress later, with these same protections." es-MX and pt-BR say the same, on the app budget.
- **`docs/operations/block-d-controls.json`:** a new `retiredClaims` entry for `rebuild-site`. It lists every locale's phrasing of "under 13, a Tutor creates the account", "only a Tutor/parent creates" and "a parent can create your own account". The phrases are matched case-insensitively in every string of the namespace.
- **`agent/tools/check-no-unbacked-guarantee.mjs`:**
  - A retired claim can now name the `because` evidence that retired it: a file plus a string, or a SQL function plus a string.
  - This entry names three pieces of evidence:
    - the `/upgrade` route in `auth.ts`;
    - the upgrade test in `ageUpgradeChain.test.ts`;
    - the `mark_under13_origin` call in the latest `record_age_declaration`.
  - If any of them disappears, the gate fails and asks for the copy and the retirement to be reviewed together. One example is the owner choosing the stricter OD-3 reading later. The gate cannot silently keep a "protected account" promise the code no longer backs.

**Verified (local).**

- `node --test agent/tools/check-no-unbacked-guarantee.test.mjs`: 15 of 15 pass. The new test proves four failures:
  - the old es-MX FAQ answer;
  - the old en-US refusal line;
  - a renamed `/upgrade` route;
  - a later `record_age_declaration` without the marker.
- `node agent/tools/check-no-unbacked-guarantee.mjs`: OK on the live repository.
- Frontend: `src/rebuild/copy-budget/site.test.ts`, `src/rebuild/site/site.test.tsx` and `src/routes/auth/__tests__/AgeRefusal.test.tsx` pass.
- Also passing: frontend `type-check` and `lint`, root `spec:check` and `secrets:check`, and the i18n gate.

**Open.**

- Human and Legal review of the new FAQ wording (A.1 acceptance).
- The `faq_claim_parity` metric in `public.identity_metrics` still probes only the three legacy capabilities (second guardian, cancellation cascade, report tool). This claim is held by the repo gate above, not by the staff metric. Adding a fourth SQL probe would need a migration that replaces `identity_metrics`. It was left out as out of scope for a copy fix.
- `authSignup.refusedTitle` stays "A parent creates your account". Frontend Bible 06 §6 prescribes that exact string for the under-13 sign-up refusal. It is true of the refused email sign-up form, and the "Why?" sheet now says the child can save progress later.

## Owner questions

1. OD-3 section 2 lists "Children (under 13) who arrive alone" as guest mode only. A.2 and A.3 let that guest save a protected account, and the Google under-13 account is kept. This lane kept the code, the SPEC's recommended default, and fixed the copy. Does the owner prefer the stricter reading? That would refuse `POST /auth/upgrade` for an under-13 origin, skip onboarding's account step for it, and decide what a Google under-13 first sign-in becomes. If so, the gate above fails on purpose and the FAQ must be rewritten again.
2. Should the Bible 06 refusal title "A parent creates your account." be reworded? It reads as absolute next to the upgrade path.
