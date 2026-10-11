---
title: F-003 Onboarding
status: draft
updated: 2026-10-11
---

# F-003 Onboarding

> What a person walks through after pressing one of the two buttons of the home page, before any account exists: who the mentors are, what the product gives them, and the choice to create the account now or later.

> **Status: draft.** The flow was approved by the owner on 2026-10-10 (D-037 to D-044 in [[DECISIONS]]) and is built and run end to end on a local stack. **Compositions:** the owner approved the first eighteen stills the same day; the two special ones (mini-games and Seeds) and the Seed's drawing were approved after one round of changes. All twenty-six compositions are approved and their loops are rendered. Not deployed.

## Summary

The home page's two buttons start two walks. "I just want to learn" is the learner's; "I'm a parent" is the parent's. Both happen before any account (D-021), one idea per screen, with one primary button that waits for an answer (D-020). The four mentors greet, ask the age and a name, the person chooses a mentor, and from then on that mentor shows what the product is. The last screen offers to create the account now, or later. Either way nothing is asked twice: the account, when it is created, receives what was answered.

What the screens describe (lessons, mini-games, MentorIA, Seeds, tasks, the family functions) is the product's promise, written for the onboarding. It does not define those features: each is designed in its own session.

## The two walks

Routes `/onboarding` and `/onboarding/parent`, outside the site's shell. The address carries the name of the step (`?step=`) and never an answer.

| # | Learner | Parent | Kind |
|---|---|---|---|
| 1 | `welcome`: the four mentors greet | `welcome` | value |
| 2 | `age` | `age` (under 18: `minor`, see below) | question |
| 3 | `name`: a first name or a nickname | `name` | question |
| 4 | `mentor`: choose one of four | `mentor` | question |
| 5 | `lessons` | `child`: what their child gets | value |
| 6 | `games` | `family`: add children, give tasks, set rewards | value |
| 7 | `mentoria`: questions, guidance, building ideas | `progress`: follow each child's learning | value |
| 8 | `seeds` | `suggestions`: a suggestion every day | value |
| 9 | `tasks` (only under 18) | | value |
| 10 | `join`: create the account now, or later | `join` | choice |

Rules of the walk (`frontend/src/features/onboarding/steps.ts`):

- **Age comes before the name**, and the question is neutral: one free numeric field, no default, and no hint of what an age changes. Outside 6 to 100 the person gets the friendly sentence of the sign-up window and the button stays disabled.
- **The language is not asked**: it is the language the site is showing (D-033).
- **A step cannot be skipped by its address**: the furthest step that opens is the first one still waiting for an answer.
- **The mentor speaks in the first person** after being chosen and uses the person's name. Before that the four speak as "we".
- **`tasks`** tells a person under 18 that tasks come from MentorIA or from their parent or guardian, that each task says which, and that a parent or guardian who joins them can see their progress. A child is told plainly, up front.
- **`minor`**: somebody under 18 who came in through "I'm a parent" is told kindly that this part is for parents and guardians and is taken to the learner's walk, which continues with the age they already gave (D-040).
- **`suggestions`** names the data: the suggestions are "based on what your child learns and practises on LittleFounders". The copy promises nothing the product will not do.
- The bar at the top moves fastest at the start; a plain linear bar does not reduce drop-off ([[RESEARCH-FOUNDATION]]).

## The mentors

Approved by the owner on 2026-10-10. Zara, Dr. Rho, Liruf and Dina are MentorIA ("MentorAI" in English, D-036): the choice screen says so in words, "an artificial intelligence, not a person".

| Mentor | Line shown |
|---|---|
| Zara | Curious and direct. She asks why until it all makes sense. |
| Dr. Rho | Patient and orderly. He explains with examples from everyday life. |
| Liruf | Playful and restless. He would rather try things than read about them. |
| Dina | Calm and attentive. She celebrates every step, however small. |

## Joining now or later

- **Now** opens the sign-up window ([[F-001-authentication]]) with both ways to create the account on offer, Google and a code by email. When the account exists, `features/onboarding/Handoff.tsx` gives it the age (so the window does not ask again), then the name, the mentor and, on the parent's walk, that the person came in as a parent. Then the answers are erased from the browser and the person is on the home page, signed in.
- **Under 13** the sign-up window still shows its age step, with the age already filled in, because the permission box is owed (D-025).
- **Later** returns to the home page. There is no application to land on yet (D-039). A notice there says that what was chosen is saved on this device, with two buttons: create the account, and erase it.
- **Coming in as a parent is a statement, not a type.** The account is an ordinary one with `parent_intent` set; the `parent` type is still granted only after verification (D-030). The database refuses the flag for an account under 18.
- **Answers are never written into somebody else's account.** The handoff acts only on an account that has neither a name nor a mentor; for any other account the answers left on the device are simply erased.

## What is kept on the device

`localStorage`, key `lf.onboarding` (`features/onboarding/store.ts`): the walk, the age, the name, the mentor and whether the last step was reached. D-038.

- It never leaves the browser until an account is created, and then goes only to Core as that account's own profile. For a child this is personal data, and it stays outside what the law calls "collected" only while it stays on the device ([[CHILD-SAFETY-AND-PRIVACY]]).
- It must never be put in an analytics event, an address or a log line. No onboarding analytics exist; if they are added they carry step counts and nothing else.
- It is forgotten 30 days after the last answer, and can be erased at any time from the notice on the home page. A device may be shared.

## Compositions

Every screen has a composition, played on one reusable set: **the mentors' studio** (`frontend/tools/render/onboarding-set.js`), described in [[CHARACTER-COMPOSITIONS]]. The four are together until a mentor is chosen; from then on the chosen mentor is alone on the set.

| Scene | Used by |
|---|---|
| `group-greet` | `welcome`, both walks |
| `group-attend` | `age`, `name`, `mentor`, `minor` |
| `<mentor>-look` | `lessons`, `suggestions` |
| `<mentor>-nod` | `mentoria`, `family`, `join` |
| `<mentor>-lean` | `tasks`, `progress` |
| `<mentor>-portrait` | the four cards of the choice |
| `<mentor>-games` | `games`: the mentor drives an open sports car flat out on a cut-out piece of race track (D-044); Dina rides standing in hers. Redone once after the owner's review (the characters ran into the car's surfaces, and Dina seated did not look organic). Approved |
| `<mentor>-seeds` | `seeds`: on the studio, a sunflower drops its Seeds into a jar and one large Seed floats in its own light (D-043, D-044). Approved. Also the parent's `child` screen, so the parent's walk does not show the same pose twice before its last screen |

Every scene is a looping video, 8 seconds at 24 frames a second, with a poster, made once per color mode on the page's own color (`frontend/public/onboarding/loops/`: 44 MP4 files of 180 to 510 KB, 13.4 MB in all, and 44 WebP posters; one video is loaded per screen). `StepArt.tsx` shows them through the same element as the landing's scenes, so the poster shows at once and stays for anybody who asked for less motion or less data. The four portraits of the choice cards are stills (`public/onboarding/stills/`). `npm run render:onboarding -- --loops` makes the loops (about an hour for all of them on the development machine); without `--loops` it makes stills, which is how a composition is shown to the owner before its loop is rendered.

## Layout

- On phones the composition is on top and the words under it. From 1024 px they sit side by side, the composition the larger of the two (up to 74 % of the screen's height), and the pair is centered in the height that is left.
- Choosing a mentor on a phone shows no group composition: the four cards already show the mentors, and with the group above them only two fit on the screen.
- A screen's title takes the focus when the screen arrives (a field does, where there is one), so a screen reader reads each screen from its title and the keyboard continues from there.

## Data model and API

`database/migrations/0003_onboarding.sql`: `profiles.mentor` (`zara`, `rho`, `liruf`, `dina`), `profiles.parent_intent`, and `core_set_profile`, which also writes `display_name` (a first name or nickname: letters, spaces, apostrophes, periods and hyphens, 40 at most). `core_session_context` now returns `mentor` and `parentIntent`.

| Method and path | Signed in | Body | Answers |
|---|---|---|---|
| `PUT /api/v1/account/profile` | yes | `{ displayName?, mentor?, parentIntent? }` | `{ saved }`; `NAME_INVALID`, `TARGET_NOT_ELIGIBLE` (parent intent under 18) |

`account` gains `mentor` and `parentIntent`.

## Locale strings

`frontend/src/i18n/<locale>/onboarding.json`, in the three languages, written to the humanizer rule. Seeds is "Sementes" in Portuguese, and the Portuguese wording for a parent or guardian is the one in `pt-BR/onboarding.json`; the owner confirmed both ([[GLOSSARY]]).

## How it was checked

- Walked in a real browser on the local stack: a 15-year-old in Spanish at 1440 px who creates the account at the end (the window closes without asking the age, the account has the name, the mentor, the `child` type and the language, and the browser keeps nothing); a parent of 41 in Portuguese at 390 px, dark, who chooses "later", sees the notice and erases; somebody of 16 who came in as a parent, in English at 320 px, taken to the learner's walk. No horizontal overflow on any screen.
- The impossible-age sentence, the disabled buttons, and that the address never carries an answer.
- `npm run audit:onboarding -- --matrix --account` (`frontend/tools/audit/onboarding.mjs`), without findings: both walks with the keyboard only, at 320, 390, 768 and 1440 px in the three languages, light and dark, 26 walks in all. On every screen: axe-core (WCAG 2.0 to 2.2 A and AA and best practices), where the focus lands, every target at least 48 px, no text cut, no sideways scroll, the composition present, named and playing, and nothing but the step's name in the address. Its first run found that the focus was lost between screens; that is fixed.
- The same run creates an account at the end as a child of 9: the window offers Google and the email code, the age step comes already filled in with 9 and waits for the permission box, and the account receives the name, the mentor, the `child` type and the language.
- Every loop file loads, lasts 8 seconds and plays, and its border is the page's color exactly in both modes.
- `npm run audit:signin` still passes; `type-check`, `lint` and `build` in `frontend/`; `type-check` and `lint` in `backend/`.

Not checked: a screen reader and a real phone (neither can be done from the development machine's tools), and Google's own round trip at the last step, which needs a Google client (T-019); Core answers the start of it correctly.

## Open points

- [x] The owner's approval of the first eighteen stills and of the four mentor lines (2026-10-10).
- [x] The owner's approval of the two special compositions and of the Seed's drawing (2026-10-10). Every screen of both walks was then captured for the owner (`frontend/audit-out/onboarding/screens/`, not tracked).
- [x] The loops of the approved compositions (rendered 2026-10-10: every file loads, lasts 8 seconds and plays, and its border matches the page color exactly in both modes).
- [x] The accessibility and keyboard audits on the route, the sign-up under 13 and every screen with its video (2026-10-10).
- [ ] A screen reader, a real phone, and Google's round trip at the last step (T-035, T-019).
- [ ] Counsel: answers of a child kept on the device before an account, and whether the service is "mixed audience" under COPPA ([[CHILD-SAFETY-AND-PRIVACY]]).
- [ ] Where the person lands after the onboarding once an application exists (D-039).

## Related

- [[DECISIONS]]
- [[F-001-authentication]]
- [[F-002-emails]]
- [[CHARACTER-COMPOSITIONS]]
- [[CHILD-SAFETY-AND-PRIVACY]]
- [[GLOSSARY]]
- [[RESEARCH-FOUNDATION]]
- [[FRONTEND-GUIDE]]
- [[BUILD-TASKS]]

Back to [[INDEX]].

## Update this document when

- A step, its words or its composition changes.
- What is kept on the device, or what the account receives, changes.
- A composition is approved or its loop is rendered.
