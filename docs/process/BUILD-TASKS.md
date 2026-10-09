---
title: Build tasks
status: scaffold
updated: 2026-10-09
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

| ID | Task | Status | Notes |
|---|---|---|---|
| T-001 | Clean the landing page so it passes `npm run lint:slop`, then add that check to CI | open | The owner asked to be reminded. 173 spacing findings are auto-fixable; about 36 type findings need manual changes. |
| T-002 | Adapt `database/scripts/local-stack.sh` to an empty `database/migrations/` | open | It loops over migration and seed paths that no longer exist. |
| T-003 | Restore the legal pages (terms and privacy) before any production release | open | They were removed with the restart. |
| T-004 | Decide how backups move off the `filebase` service, or keep that service running | open | The backup workflows depend on it. |
| T-005 | Fix the GitHub ruleset on `main` that requires a check which no longer exists | open |  |
| T-006 | Wire the landing calls to action once the first feature exists | open | They render and do nothing. |
| T-009 | Bring Bencho blocks into the product one at a time as screens need them | open | Procedure and licence in [[UI-LIBRARIES]]; nothing to unblock. |
| T-010 | Cut the frontend payload further, if it ever matters | open | Measured 2026-10-09: 289 KB gzip of JavaScript for the landing (React DOM 84, app 131, Motion 49, i18n 17.5, router 7, page 10) plus a lazy 77 KB chunk of icon data. React DOM and Motion are not reducible (Cojeev and Bklit import the full Motion). Stable libraries are now split into their own chunks for caching. Revisit with real pages and measured load times; see [[PERFORMANCE-AND-SCALING]]. |
| T-011 | Run a real screen reader (NVDA on Windows, VoiceOver on a Mac or phone) and a phone pass over the landing | open | The axe and keyboard audit is done and recorded in [[UI-LIBRARIES]]; what only a person with that equipment can confirm is left. |
| T-012 | Define how the product's own icons are drawn and audited (format, grid, review, registry) and draw the first set when a feature needs it | open | Rule 4 in [[FRONTEND-GUIDE]]; today there are none and utility icons come from the libraries. |
| T-013 | Decide with the owner which surfaces are young-child surfaces (76 px targets) and which age bands the product uses | open | Directive 4 in [[RESEARCH-FOUNDATION]]. |
| T-014 | Talk to parents: test the landing words and the age ranges, and collect real quotes (with consent) for the page | open | From the advisor call; see [[LANDING-MESSAGING]]. Nothing is invented in the meantime. |
| T-015 | Decide what an active user is and break usage down by age segment; decide who each return-visit message goes to, the parent or the child | open | From the same call. Product and analytics, not landing text. |
| T-016 | Fill the footer: the address of each social profile and of the terms and privacy pages in `frontend/src/lib/footerLinks.ts`, and the links that go under About us, Product and Behind the scenes once their pages exist | open | Until then the marks and legal entries are shown but are not links. The social marks are simple glyphs drawn in `components/icons/social.tsx`; which networks to show is the owner's call. Related: T-003, T-012. |
| T-018 | Review the character pose catalog with the owner and decide the role of Liruf, Dina, Zara and Rho in marketing, UI and UX | open | Starting list and open questions are in [[CHARACTER-POSES]] (status draft). No character code returns from the archive until this is decided and a screen needs it. |
| T-019 | Wire the sign-in window: Google, email or username, and create account, in `frontend/src/lib/authRoutes.ts` (placeholders now) | open | The window and the topbar button are built (frontend only). Until a target is set each action shows a toast. Needs the authentication feature to be designed ([[SECURITY-GUIDE]], [[CHILD-SAFETY-AND-PRIVACY]] for under-age accounts); routes are in English (D-011). |
| T-020 | Design how a 12-year-old signs up and how consent is given for them (the legal inputs name 13 as the line for managing an account alone), and the registration process for children under 12 | open | The 12 to 18 range is decided and final (D-013); this is about the sign-up flow, not the range. Inputs and sources in [[CHILD-SAFETY-AND-PRIVACY]]; confirm with counsel before production. |
| T-021 | Rebuild the authentication email templates (confirmation, magic link, recovery, invite, email change) in the three languages, and recreate the `email_logs` migration when the database schema is designed | open | The mail service is restored (D-014) but the templates and their texts were deleted with the frontend. Words follow the humanizer rule and the colors the tokens. Parental-consent mail for minors depends on T-020. |
| T-022 | Character avatars: answer the open questions in [[CHARACTER-AVATARS]], then rebuild Rho as a 2D vector head in Rive, dotLottie and our own SVG runtime, measure, and decide the format | open | Plan only; nothing built. |
| T-007 | Define the security baseline with the owner and fill [[SECURITY-GUIDE]] and [[CHILD-SAFETY-AND-PRIVACY]] | open |  |

## Related

- [[IMPLEMENTATION-PLAN]]
- [[UI-LIBRARIES]]
- [[TECHNICAL-REQUIREMENTS]]
- [[AI-WORKFLOW]]
- [[CHANGELOG]]
- [[TESTING-GUIDE]]

Back to [[INDEX]].

## Update this document when

- A task is opened, started or finished.
