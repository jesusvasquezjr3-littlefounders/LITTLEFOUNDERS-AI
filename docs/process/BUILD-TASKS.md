---
title: Build tasks
status: scaffold
updated: 2026-10-12
---

# Build tasks

> The working task list: what is open, in progress and done.

> **Status: scaffold.** The structure is set; nothing below that is not marked as current state has been decided. Fill it in with the owner, then change the status to `draft` and, once approved, `accepted`.

## Role

Gives agents and humans one place to see what to do next. Each task is small, has an ID, and links to its requirements document. It is not a log of past work; that is the [[CHANGELOG]].

## Read this when

- Picking the next piece of work.
- Closing a task.

## To define

- [ ] Task format: ID, title, status, links, acceptance criteria.
- [ ] Open tasks grouped by phase.

## Open tasks

> **Scope decided by the owner on 2026-10-10.** The avatar work (T-022, T-023) waits until features need it: the foundations are built. Later the same day the owner opened the work on the platform itself, in this order: sign-in, sign-up and user types (built: [[F-001-authentication]]), then the emails (built: [[F-002-emails]]), then the onboarding (flow built, compositions in approval: [[F-003-onboarding]]). Other open tasks wait unless one of those needs them.

| ID | Task | Status | Notes |
|---|---|---|---|
| T-001 | Clean the landing page so it passes `npm run lint:slop`, then add that check to CI | open | The owner asked to be reminded. 173 spacing findings are auto-fixable; about 36 type findings need manual changes. |
| T-003 | Restore the legal pages (terms and privacy) before any production release | open | They were removed with the restart. |
| T-004 | Decide how backups move off the `filebase` service, or keep that service running | open | The backup workflows depend on it. |
| T-005 | Fix the GitHub ruleset on `main` that requires a check which no longer exists | open |  |
| T-006 | Wire the landing calls to action once the first feature exists | done | 2026-10-10: each starts the onboarding on its own walk ([[F-003-onboarding]]). |
| T-009 | Bring Bencho blocks into the product one at a time as screens need them | open | Procedure and licence in [[UI-LIBRARIES]]; nothing to unblock. |
| T-010 | Cut the frontend payload further, if it ever matters | open | Measured 2026-10-09: 289 KB gzip of JavaScript for the landing (React DOM 84, app 131, Motion 49, i18n 17.5, router 7, page 10) plus a lazy 77 KB chunk of icon data. React DOM and Motion are not reducible (Cojeev and Bklit import the full Motion). Stable libraries are now split into their own chunks for caching. Revisit with real pages and measured load times; see [[PERFORMANCE-AND-SCALING]]. |
| T-011 | Run a real screen reader (NVDA on Windows, VoiceOver on a Mac or phone) and a phone pass over the landing | open | The axe and keyboard audit is done and recorded in [[UI-LIBRARIES]]; what only a person with that equipment can confirm is left. |
| T-012 | The application's own icons: draw them, and replace the library icons of the screens that exist | open | The owner's rule of 2026-10-11 (D-054): every icon and symbol is our own, a 2D picture in full color with no outlines, a Lottie file, alive, with micro-interactions. The system is built (rule 4 in [[FRONTEND-GUIDE]]) and nine icons are drawn and **approved by the owner on 2026-10-11** as the style every new one follows ([[ICON-SYSTEM]] has the rules and the steps). **Replaced on 2026-10-12, by the owner's order:** every library icon of the site, the sign-in window, the onboarding, the 404 page and the Cojeev components that carry one is now ours (seven new icons: `sun`, `moon`, `account`, `signout`, `mail`, `warning`, `check`), and `lucide` and `morphicons` are uninstalled with the library's icon data. Left: the owner's approval of those seven; the icons each feature needs, as it is built; the Seed as a Lottie icon (today it is an SVG with a CSS animation). |
| T-013 | Decide with the owner which surfaces are young-child surfaces (76 px targets) and which age bands the product uses | open | Directive 4 in [[RESEARCH-FOUNDATION]]. |
| T-014 | Talk to parents: test the landing words and the age ranges, and collect real quotes (with consent) for the page | open | From the advisor call; see [[LANDING-MESSAGING]]. Nothing is invented in the meantime. |
| T-015 | Decide what an active user is and break usage down by age segment; decide who each return-visit message goes to, the parent or the child | open | From the same call. Product and analytics, not landing text. |
| T-016 | Fill the footer: the address of each social profile and of the terms and privacy pages in `frontend/src/lib/footerLinks.ts`, and the links that go under About us, Product and Behind the scenes once their pages exist | open | Until then the marks and legal entries are shown but are not links. The social marks are simple glyphs drawn in `components/icons/social.tsx`; which networks to show is the owner's call. Related: T-003, T-012. |
| T-018 | Review the character pose catalog with the owner and decide the role of Liruf, Dina, Zara and Rho in marketing, UI and UX | open | Starting list and open questions are in [[CHARACTER-POSES]] (status draft). No character code returns from the archive until this is decided and a screen needs it. |
| T-019 | Check Google sign-in end to end | open | The window is wired ([[F-001-authentication]]); the code by email was run end to end. Google was checked up to the redirect and the refusals, because the local stack has no Google keys. Read through on 2026-10-12: a sign-in that Google completes now goes into the application (the place the person was going, or `/home`), whose guard asks a new account what it still owes; before, it left the person on the site. Still to do: run it once with a test client (steps in [[ENVIRONMENT-SETUP]]) or on a preview before production. |
| T-020 | Check the age step with counsel | open | Built on 2026-10-10 ([[F-001-authentication]]): the age step accepts 6 to 100, the permission checkbox shows under 13 and is required there, an impossible age gets a friendly sentence, and the age decides the account's type (D-025, D-027, D-030). Left: the owner's confirmation that the checkbox shows under 13 and not under 18, and the check with counsel before production. Inputs and sources in [[CHILD-SAFETY-AND-PRIVACY]]; confirm with counsel before production. |
| T-021 | Design and build the emails, in the three languages, and recreate the `email_logs` migration | done | Built 2026-10-10: one design, six emails (three of them sent today), the account's language, unsubscribing, `0002_email.sql`. [[F-002-emails]]. What is left is in T-025, T-031 and T-032. |
| T-022 | Review the four avatars alive (`npm run dev`, then `/dev/avatars`) and approve or correct each against its canon | open | Built and running (D-015). The owner approved the likeness; remaining judgement is of the motion. |
| T-023 | Avatars next (the expression catalog and the mouth dictionary are done): the generated voice (provider, cost, child-safety rules, timing into the avatar), profile views for large head turns, a text equivalent wherever an avatar carries meaning, and the first real screen that uses the floating avatar | open | See the limits in [[CHARACTER-AVATARS]]. Words in a bubble are locale strings; nothing the avatar does is recorded or sent. |
| T-024 | Loading window, what is left: wire it where something waits (nothing does yet), decide which character shows when (random, per context or per visitor), decide whether a long wait creeps from 80 to about 92 % (the research says a hold at the end feels slower), and whether to ship a WebP fallback | open | Built and approved (D-017): `LoadingWindow`, `/dev/loading`, the 8 sheets in `public/loading/` and `npm run render:loading`. Defaults taken and listed in [[FRONTEND-GUIDE]] ("The loading window"). |
| T-007 | Define the security baseline with the owner and fill [[SECURITY-GUIDE]] and [[CHILD-SAFETY-AND-PRIVACY]] | open |  |
| T-025 | Deploy F-001 and F-002 | open | On the owner's decision to publish, and not before T-036 is closed. Before it: look at the emails in real mail programs (Gmail, Outlook, Apple Mail, both color modes). What changes on each production service, and the order, is in the rollout sections of [[F-001-authentication]] and [[F-002-emails]] (the frontend's email images go out first; the closed gateway goes out together with Core and the frontend). |
| T-026 | Plan and rehearse the migration of the production accounts into the new identity tables | open | Rename `kid` to `child`, give minors who are `universal` today the `child` type, drop `bigfounder` after checking nobody holds it, carry the age records over, and decide with the owner how the previous child accounts (username and password, no real address) sign in (D-030). First find which of the previous version's migrations production really has. A dump of the previous local database is in `database/backups/` (not tracked) to rehearse on. |
| T-027 | A second factor for `admin` and `superadmin` | open | Staff sign in like everybody else today (a code by email, or Google). Raise it with the owner before any staff screen exists. |
| T-028 | Remove accounts that asked for a code and never entered it | open | Asking for a code with a new address creates an unconfirmed account. They are harmless and limited per visitor and per address, but they should not accumulate. |
| T-029 | The rest of an account's life: changing the email, closing the account, exporting its data, correcting an age | open | None is built. Each touches a minor's data: design with the owner ([[CHILD-SAFETY-AND-PRIVACY]]). |
| T-030 | Update `database/scripts/disposable-stack.sh` to the new local settings | open | It still writes the previous version's settings (automatic confirmation, anonymous accounts). Needed before any security tool is pointed at a disposable stack ([[ai-pentesting]]). |
| T-031 | Decide how long a line of the mail delivery history is kept, and delete older ones | done | 2026-10-10: 90 days, by a nightly job in the database, and an account's lines are deleted with it (D-047, `0004_mail_least_privilege.sql`). The owner can change the number. [[F-002-emails]]. |
| T-032 | Footer of the emails: links for the social marks, and a postal address | open | The marks have no links by the owner's decision, for now. A postal address is required by anti-spam law for promotional email in several countries; needed before the first promotional email. [[F-002-emails]]. |
| T-033 | Onboarding compositions: render the loops of the approved stills | done | Rendered 2026-10-10: 22 scenes, both color modes, shown by `StepArt.tsx`. [[F-003-onboarding]], [[CHARACTER-COMPOSITIONS]]. |
| T-034 | Onboarding compositions for mini-games and Seeds, and the Seed's drawing | done | Approved by the owner on 2026-10-10 after one round of changes (D-043, D-044). Their loops are part of T-033. |
| T-035 | Finish checking the onboarding | open | Done 2026-10-10 with `npm run audit:onboarding`: accessibility and keyboard on every screen of both walks, the sign-up under 13, every loop. Left: a screen reader and a real phone, by a person; Google's round trip at the last step waits for T-019. [[F-003-onboarding]]. |
| T-036 | Before any push or any deployment: what is left of the security review of 2026-10-10 | open | **The owner's rule (2026-10-10): nothing is pushed and nothing goes to production until every line here is closed.** The review's ten findings and its follow-ups are fixed and checked on the local stack ([[SECURITY-GUIDE]]). Fixed in the second round: actions pinned by commit, and approval required for every outside contributor's fork pull request (set in the repository on GitHub); visitors counted by IPv6 /64 and mailboxes by their real name; a piece of work before a code is sent, and an allowance of emails reserved for existing accounts; the same answer and timing whatever was typed; no name or username before the age; the relay sends nothing without TLS, verifies the smarthost's certificate and never delivers by itself; a hook call acted on once; unsubscribe tokens that expire; `react-router-dom` 7; display-name rules; no address in the mail service's logs. **Still open, each one a blocker:** (1) set `MAIL_SERVICE_KEY` on the gateway and the mail service in production and remove the service key from the mail service ([[F-002-emails]], rollout); (2) confirm in production that `GOTRUE_RATE_LIMIT_EMAIL_SENT` is well above `NEW_ADDRESS_CODES_PER_HOUR` (300), and `TRUST_PROXY_HOPS` against the real proxy chain; (3) confirm after the first push that the deploy workflows ran only for the push (the fix cannot be exercised before); (4) look at the site in production with its security headers in the three languages and with analytics accepted: the policy was walked locally, where the trackers do not load in an automated browser; (5) decide with the owner whether sign-up needs a wall stronger than the piece of work (a CAPTCHA is a third party on a site for children); (6) `audit_log` keeps the permission record of an account after it is deleted, and a closed account can be opened again with the same address and another age: both belong to the account's life (T-029) and are decided before accounts can be closed; (7) the mail service's HTTP API has no limit of its own behind the internal key; (8) counsel's reading of analytics on a site for children (D-048) together with T-020. |
| T-037 | Build the signed-in application's structure, step by step (D-051) | open | **Built on 2026-10-11, steps 1 to 4; not committed (the owner asked to hold commits) and not reviewed by the owner yet.** What exists and how it was checked is in [[F-004-application]]. **1, clean and prepare:** done: the discarded prototypes and what only they used are deleted, the round-shapes rule is in the radius tokens, the application's own icons exist ([[ICON-SYSTEM]]). **2, backend:** done: `GET /api/v1/home` in Core (the menu an account has, the composition of the day, the cards); it stores nothing. **3, the application's skeleton:** done: the layout with the sidebar and the dock, the session guard, the destinations with an empty state, the words in three languages; the prototype (`/dev/app`) is deleted and stays in the history at `8896e664`. **4, the home:** done as far as there is something real to show: the stage with the composition of the day and the pile face down with no cards. **5, check and close:** done: `type-check`, `lint`, `build`, the checks with real sessions, axe-core, the keyboard walk and reduced motion; left: a screen reader and a real phone by a person, the owner's review, the commit. **Left for the features:** the pile's mechanics with the first card, focus mode with Learn, the floating mentor in its own session. |
| T-038 | The thirty compositions of the home page (D-052, D-053) | open | Before the rest of T-037, by the owner's order. **Approved by the owner and rendered on 2026-10-11:** the thirty loops are in `frontend/public/stage/loops/` for both color modes ([[CHARACTER-COMPOSITIONS]] lists them, what each was held to and how they were checked; a composition takes about six minutes to render). **Left:** the owner has not watched the videos yet; the page's use of them (step 4 of T-037) and Core's choice of the day's composition (step 2). The videos are 33 MB of plain files in the repository, not in Git LFS, like the onboarding's; decide with the owner before the catalog grows with seasons. The stage of the chosen home was drawn 320 px wide in the prototype; four characters in a full setting need more room, so the home's layout is adjusted to these pictures in step 4 of T-037. |

## Related

- [[F-001-authentication]]

- [[IMPLEMENTATION-PLAN]]
- [[UI-LIBRARIES]]
- [[TECHNICAL-REQUIREMENTS]]
- [[AI-WORKFLOW]]
- [[CHANGELOG]]
- [[TESTING-GUIDE]]

Back to [[INDEX]].

## Update this document when

- A task is opened, started or finished.
