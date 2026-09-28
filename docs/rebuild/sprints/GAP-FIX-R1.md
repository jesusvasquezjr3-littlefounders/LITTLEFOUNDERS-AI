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
