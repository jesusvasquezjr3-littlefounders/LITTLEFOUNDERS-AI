# Gap-fix round 5

Lane records for the fifth gap-fix round of the SPEC migration. Each lane
appends its own section. Statuses follow the ledger: implementation, local
verification, acceptance and release are separate, and nothing here is
accepted or released.

## Checkpoint F5-identity-site

Branch `codex/spec-fix5identity`. Four audited gaps. All four were checked in
the code first and all four were real.

### What was built

| # | SPEC clause | What was built | Where |
|---|---|---|---|
| 1 | A.1 (FAQ "twoParents"); Appendix M 1.4; D.3 / OD-3 Option B; Law 5 | A Tutor invite link is now `/join/TOKEN`, a landing on the sign-in shell that needs no role. It keeps the token in router state (`from`) and in a small store (`auth/pendingInvite.ts`: localStorage, because the confirmation email opens a new tab; bounded by the invite's 7-day life; a malformed token is never stored; cleared on accept, on an invalid or expired invite and on sign-out, so a shared device never hands it to the next account). Each person gets one step: a signed-out visitor or guest is offered sign-up (Tutor intent preselected) or log-in; a signed-in adult who is not a Tutor sees "Verify your ID to accept" with one brand action to `/verify-parent` (or "Use another account"); a parent-created child is told the link is for an adult; a malformed link asks for a new one; a verified Tutor is sent straight to `/family?join=TOKEN`. Log-in, sign-up (with or without email confirmation), the Google callback and the signed-in redirect of the guest-only pages continue to the pending invite; `/verify-parent`'s success links to `/family?join=TOKEN` ("Open the invite"). An old `/family?join=` link opened by a non-Tutor goes to the landing instead of Learn with the token dropped. The mint panel and the teen's "Invite a parent" link both produce `/join/TOKEN`. The landing never shows the child's name or any account detail: preview and accept stay inside Core's verified-parent boundary (no Core change) | `frontend/src/auth/pendingInvite.ts` (+ test), `frontend/src/app-routes/JoinInvitePage.tsx`, `frontend/src/rebuild/identity/JoinInviteScreen.tsx`, `app-routes/site.tsx`, `app-routes/family.tsx`, `app-shell/PublicLayouts.tsx`, `auth/AuthContext.tsx`, `auth/RequireGuest.tsx`, `routes/auth/{Login,Signup,AuthCallback,VerifyParent}Page.tsx`, `rebuild/identity/VerifyParentScreen.tsx`, `routes/app/family/GuardianInvitePanel.tsx`, `routes/app/wallet/TeenWalletPage.tsx`, copy `authJoin`, `authVerify.openInvite`, `pageTitle.joinInvite` (EN/es-MX/pt-BR); tests `app-routes/__tests__/JoinInvite.test.tsx`, `GuardianInvitePanel.test.tsx`, `AuthContext.test.tsx`, `AuthRecipe.test.tsx` |
| 2 | Bible 02 §7 item 10 and rule 19; 06 §7; 03 §5 | Audit states for every identity state the audits never rendered: `verify-minor` and the W2S.3 offline copy (`login-offline`, `signup-offline`) as identity previews; the age question's `askTutor` and `error` states on a real route (`/learn@age-ask-tutor`, `/learn@age-error`) and as previews; the H.1 first-session teen analytics disclosure sheet (`/learn@teen-analytics-disclosure`) and the undecided two-answer Settings card (`/profile/settings@teen-undecided`), reachable through the synthetic Core's new `analyticsDisclosed` and `ageScreenError` scenario fields; four `/join/:token` states (signed-out, verify, child, invalid). `auditCoverage.test.tsx` pins every identity preview view and age-screen state to an audited state | `frontend/scripts/audits/lanes/site.mjs`, `lanes/profile.mjs`, `scripts/audits/synthetic-core.mjs`, `src/rebuild/preview/registry/site.tsx`, `src/app-routes/__tests__/auditCoverage.test.tsx` |
| 3 | Bible 03 §3.3 (7:5 hero, portrait 4:5 art allowed to overlap); 07 §1 class B; 02 D12 | Three portrait 4:5 hero scenes rendered locally at zero spend from the real runtime models on Diorama A in catalogue poses (Dina `ambient.idle.happy` on Landing, Dr. Rho `teach.explain` on How it works, Zara `greet.nod` on Families), light and dark, WebP 1x/2x/3x plus a PNG fallback, no text (OCR clean). `SiteHeroArt` serves the page's colour mode with a translated alt; `SiteHero overlap` keeps the 7:5 copy:art split and lets the art reach into the next section on wide screens; on a phone it sits small above the copy. The four-Mentor cast moved into the Landing's Mentors section. 24 files registered as class B `scenes` drafts awaiting the owner's style review | `frontend/scripts/render-site-hero.mjs`, `frontend/public/rebuild/site-hero/`, `src/rebuild/assets/manifest.json`, `src/rebuild/site/{blocks.tsx,site.css,Landing.tsx,HowItWorks.tsx,Families.tsx}`, copy `siteHeroArt` (3 locales) |
| 4 | OD-27 (3); A.1; OD-18 / C.4 | The llms brief says what the product does: the Tutor reads their child's Mentor conversations and approves what the Mentor remembers; a teen's story choices stay private. "Everything their child does" and "a permanent property of the product" are gone. `check-seo-surface.mjs` refuses a total-visibility claim ("see everything", "everything their child does", "permanent property") in llms.txt and llms-full.txt in every locale, with a mutation test on the shipped files | `frontend/scripts/seo/build-seo.mjs`, `agent/tools/check-seo-surface.mjs` (+ test) |

### Verification (local)

- Frontend `npm run type-check` and `npm run lint` clean.
- Focused vitest: `src/routes/auth`, `src/auth`, `GuardianInvitePanel`,
  `src/app-routes/__tests__` (including `JoinInvite.test.tsx`, every hop:
  landing, Family route, log-in, sign-up with and without confirmation,
  Google return, signed-in redirect, verification, and the refused
  populations: child, invalid token, non-Tutor never reaching accept),
  `src/rebuild/{site,identity,assets,preview}`: all green. The asset gate test
  first failed on the WebP srcSet (paths were not literal); fixed and re-run
  green.
- Root `spec:check` (legacy UI gate, asset gate with OCR: 379 class B assets,
  no text in any raster), `secrets:check`, `check-i18n.sh`: pass. The invite
  route adapter moved from `routes/auth/` to `app-routes/` because the legacy
  UI freeze refuses new files under `src/routes/`.
- Earlier in the lane: the new identity audit states in item 2 passed text
  fit, proportion and copy budget (3 locales x 2 modes x 4 widths); the SEO
  gate and its mutation test pass.

### Open

- Not run here (speed mode, orchestrator's end-of-round run): the `/join`
  audit states and the site hero states through the three audits,
  `verify-identity.mjs` (two new journeys: signed-out visitor and signed-in
  adult, each to the accepted invite), `verify-teen-wallet.mjs` (updated link
  shape) and `verify-public-site.mjs`.
- The optional read-only Core preview of an invite for a not-yet-verified
  adult was not built: the landing shows no child data at all, the
  conservative default. Owner question below.
- The hero scenes are drafts until the owner's style review (07 §7).

### Owner questions

- Should a signed-in, age-screened adult who is not yet a verified Tutor see
  who invited them (inviter-safe fields only) before verifying? Default
  implemented: no, nothing about the family is shown before verification.
- Hero casting: Dina on Landing, Dr. Rho on How it works, Zara on Families.
  Default implemented: one Mentor per page so the heroes do not repeat.
