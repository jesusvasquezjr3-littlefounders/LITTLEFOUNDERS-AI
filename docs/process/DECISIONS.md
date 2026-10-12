---
title: Decision log
status: scaffold
updated: 2026-10-12
---

# Decision log

> Why things are the way they are: one short record per decision made by the owner.

> **Status: scaffold.** The structure is set; nothing below that is not marked as current state has been decided. Fill it in with the owner, then change the status to `draft` and, once approved, `accepted`.

## Role

Stops agents and humans from re-litigating settled questions or silently reversing them. Only decisions the owner has made are recorded; a proposal is not a decision.

## Read this when

- Before proposing a change that might contradict an earlier choice.
- After the owner decides something that has lasting effect.

## To define

- [ ] Entry format: ID, date, status (accepted or superseded), context, decision, consequences.

## Entries

### D-001: Restart from zero

Date: 2026-10-09. Status: accepted.

Everything of the previous version was deleted except the landing page, the 3D characters, the pinned Supabase setup and Pulse. Every feature is designed again with the owner. The previous version is the git tag `archive/pre-restart-2026-10-09`, kept for data migration and history only.

### D-002: Single branch, local commits

Date: 2026-10-09. Status: accepted.

Work happens on `main` only. Commits stay local until the owner pushes, because a push deploys.

### D-003: 3D files in Git LFS

Date: 2026-10-09. Status: accepted.

The Mentor character models in `glb/` and `frontend/public/scenes/` are tracked with Git LFS and must not be deleted or overwritten without the owner asking.

### D-004: Analytics

Date: 2026-10-09. Status: accepted.

Plausible, Umami and Google Analytics 4 stay, loaded only after consent.

### D-005: Security tooling

Date: 2026-10-09. Status: accepted.

The anti-slop lint rules and the Strix security skills and references are installed. Shannon and Strix themselves are not installed and the idea was cancelled.

### D-006: Documentation system

Date: 2026-10-09. Status: accepted.

Documentation lives under `docs/`, is written in English, is interlinked with Obsidian-style wikilinks, and is checked for links and freshness before every commit.

### D-007: Mandatory UI libraries

Date: 2026-10-09. Status: accepted.

The interface is built with seven libraries, non-negotiable: Bklit UI, Motion, Sileo, 000h by Cojeev, Bencho, Morphicons and Thinking Orbs (Morphicons left on 2026-10-12: D-054 makes every icon our own, and the owner ordered the last library icons replaced). Where tokens or the stack had to change to fit them, they changed at once: the frontend moved to React 19, Tailwind CSS v4 and shadcn, and the hand-written design system was deleted and replaced. No other component, chart, toast, animation or icon-morph library is added without the owner. Details and rules: [[UI-LIBRARIES]] (accepted, with the per-library roles approved by the owner on 2026-10-09).

### D-008: Writing and design skills

Date: 2026-10-09. Status: accepted.

`humanizer` is the standing standard for every word a person reads (rule 12 in [[CLAUDE]]). `impeccable` and the taste-skill design skills are installed but run only when the owner invokes them. Understand-Anything and os-taxonomy were reviewed and not installed. Details and pinned versions: [[AI-WORKFLOW]].

### D-009: The five frontend rules

Date: 2026-10-09. Status: accepted.

Non-negotiable for every screen: (1) all text through i18n in en-US, es-MX and pt-BR, nothing hardcoded; (2) desktop and mobile each optimized, on clear grids; (3) text is never cut or overflowed; (4) the product's own audited icons for features and main actions, libraries for the rest; (5) design from evidence: the literature, graded, in [[RESEARCH-FOUNDATION]]. Rules and how they are checked: [[FRONTEND-GUIDE]].

### D-010: Frontend audit tools in the repository

Date: 2026-10-09. Status: accepted.

The frontend audit scripts (accessibility, keyboard, layout, grid, scene framing, color, screenshots) live in `frontend/tools/audit/` as developer tools, run by hand with `npm run audit:*`. They are not a CI gate and not a test suite, so rule 5 in [[CLAUDE]] (no test suites or gates unless the owner asks) stands for those. Method and thresholds: [[FRONTEND-TOOLKIT]].

### D-011: Every route path is in English

Date: 2026-10-09. Status: accepted.

Every route path in the platform is in English, whatever the interface language: `/sign-up`, never `/crear-cuenta`. Only the words on screen are translated ([[FRONTEND-GUIDE]] rule 1). Sign-in is not a page: it is a window opened from the topbar ([[F-001-authentication]]); the one page it uses, where a Google sign-in comes back, is `/auth/callback`.

### D-012: Rules for character compositions

Date: 2026-10-09. Status: accepted.

Scenes with the characters follow one set of rules (true scale with Dina large, bright light in both modes, no visible edges, no collisions, delivered as video, rendered from the artist sources, at most 30 % of a window's height), written in [[CHARACTER-COMPOSITIONS]], and are rendered with the tools in `frontend/tools/render/`. `three` is a development dependency for those tools only.

### D-013: The platform is for ages 12 to 18

Date: 2026-10-09. Status: superseded by D-027 on 2026-10-10 (the line is 13, and younger people are admitted by D-025).

The owner set the product audience at 12 to 18 years old, final: 12 is the youngest age served, not 13. The platforms the product is compared with (Scratch, Code.org, Khan Academy) let teenagers from 13 manage their own account and require a parent or guardian for younger children, so the sign-up of 12-year-olds is a design item (T-020), not a reason to move the line. The landing says "ages 12 to 18" and the first skill starts at 12. Children under 12 are not served until the owner designs a different registration process, after looking at how existing learning platforms register young users. Legal inputs the owner supplied (not yet confirmed with counsel) are recorded in [[CHILD-SAFETY-AND-PRIVACY]].

### D-014: The mail service is restored

Date: 2026-10-09. Status: accepted.

The previous version's mail service (`email-server/`, called Courier: an Express HTTP API and a Haraka SMTP relay to Amazon SES) is restored from the archive tag because it was working in production, and rebuilding it would cost time in tests and in environment variables, locally and in production. It exceeds the "restart from zero" rule on purpose, as the Supabase and Pulse setups did. What came back is the service, its two workflows and the local `.env` (from the saved copy; not tracked). What did not: the `email_logs` migration (the database has no schema, so history is kept in memory until it is recreated), the authentication email templates and their translated texts (T-021), and anything that called the service. Comments that pointed at removed code were corrected.

### D-015: Character avatars are an own SVG rig

Date: 2026-10-10. Status: accepted.

The in-product avatars of Rho, Zara, Liruf and Dina are layered 2D vector drawings (head and shoulders) with named parts, moved by a small own rig and a React component (`frontend/src/features/avatars`), not by Rive or dotLottie, not in 3D and not from video. The owner approved the likeness and chose the floating-avatar use. Details, tools and limits: [[CHARACTER-AVATARS]]. The 3D shape of each character (viewed turned) governs every drawing.

### D-016: Universal frontend behaviors

Date: 2026-10-10. Status: accepted.

The owner defined eleven behaviors that every page has, not only the landing: smooth animation on scroll, button micro-interactions, hover states, a custom favicon, a back-to-top button, a loading screen and skeletons, transitions between pages, speed optimization, a custom 404 page, breadcrumbs and a fixed call to action on phones (Sign in, because it is the quickest). The favicon is the compact logo. The 404 page is a composition with Rho and Liruf kneeling back to back, small in the frame, heads low, under a small red "Error 404" with a warning mark, with a plain sentence and one button to `/`. The rules and where each lives are in [[FRONTEND-GUIDE]] ("Interaction, motion and page furniture"); the 404 scene is in [[CHARACTER-COMPOSITIONS]].

### D-017: The loading window

Date: 2026-10-10. Status: accepted.

Inside the platform, a wait is shown in a window like the sign-in window (Cojeev's Dialog surface, the product's tokens; no glass, no percentage): a bar that fills from empty to 80 % in two seconds and holds, a character running on the bar's leading edge, and one word under it in bold capitals. The four characters run it. The runner is an AVIF sprite sheet per character and per color mode (8 files, 26 to 52 KB each), not 24 baked animations, because the word, the window and the colors are live. The owner chose the format after seeing the measurements and approved the four previews. Details, the measurements and the references: [[FRONTEND-GUIDE]], "The loading window".

### D-018: The reference mapping is the input for product decisions

Date: 2026-10-10. Status: accepted.

The owner mapped six learning products (Mimo, Brilliant, Duolingo, Finanz, GoHenry, Astra AI) in the private repository `LittleFounders-AI/reference-mapping-for-littlefounders` and the first product decisions (D-019 to D-027) come from reading it in full. It is a reference, not a specification: its evidence is uneven (the two finance products were mapped from public pages only), so a pattern taken from it is named with the product it came from, and nothing time-based or server-side in it is treated as a known rule.

### D-019: A mistake is never punished

Date: 2026-10-10. Status: accepted.

A wrong answer is treated as part of learning, in words and in mechanics. The reference for the tone is Brilliant ("If you're not making mistakes, you're not learning"). No mechanic limits learning because of mistakes: no lives, hearts, energy or waiting time, and nothing is sold or earned back to keep learning after an error.

### D-020: One primary button per screen

Date: 2026-10-10. Status: accepted.

Every screen has a single primary button, and it stays disabled until the person has given an answer.

### D-021: Value before data

Date: 2026-10-10. Status: accepted.

Choosing to join shows the whole onboarding before any account is asked for. The experience is immersive and low in cognitive load, and a person sees the value within the first 5 to 10 seconds of using the platform. Registration is never presented as a requirement: it is the way to keep progress permanently and to reach advanced functions.

### D-022: Rewards arrive one idea per screen

Date: 2026-10-10. Status: accepted.

After a lesson, each reward has its own screen, in order: lesson completed, then streak, then goal, then league. What each of those is (rules, numbers, and what a league shows about other people) is designed with its feature.

### D-023: No commercial pressure, and a free layer for everything

Date: 2026-10-10. Status: accepted.

Every product of the platform is available for free through a free layer. Advanced functions (the AI, advanced family functions) will sit behind a paywall, and the paywall is built only once the product is declared ready in its first version. Nothing pressures a person to pay: no countdowns, no repeated offers, no offer placed in the way of learning.

### D-024: The currency is Seeds

Date: 2026-10-10. Status: accepted.

The official currency of LittleFounders is Seeds ("Semillas" in Spanish). How Seeds are earned and used is designed with the features that need them; they never represent real money (rule 8 in [[CLAUDE]]). The term is in [[GLOSSARY]].

### D-025: Self-declared permission at sign-up

Date: 2026-10-10. Status: accepted.

The product is aimed at people aged 13 and over (D-027). So that a younger person who signs up meets no friction, the age step uses a self-declared checkbox like Astra AI's ("I confirm I have my parent's or guardian's permission") instead of a verified parental-consent process, and the product does not promise verified consent anywhere: not in the interface, not in the terms and not in the privacy text. The age step accepts 6 to 100, so children from 6 to 12 are admitted this way. This closes the sign-up design of T-020. Taken by default, change it if the owner wants: the checkbox appears for a declared age under 13. An age outside 6 to 100 (200, 1000) is a chance for a friendly joke in the interface, to be designed with the sign-up screen. To confirm with counsel before production: a self-declared checkbox is not verifiable parental consent, which COPPA requires in the United States for children under 13 ([[CHILD-SAFETY-AND-PRIVACY]]).

### D-026: Finance content comes later

Date: 2026-10-10. Status: accepted.

No finance content is written yet. It is made later, as the functionality is developed one feature at a time.

### D-027: The platform is for ages 13 and over

Date: 2026-10-10. Status: accepted. Supersedes D-013.

The owner moved the line from 12 to 13 to follow the United States COPPA line, the same one the platforms the product is compared with use (Scratch, Code.org, Khan Academy). The product is designed for people aged 13 and over; the landing, its search description and the first two skills say 13 ("ages 13 to 18", "From age 13") in the three languages. Younger people are not turned away at sign-up: D-025 admits them from age 6 with self-declared permission.

### D-028: The browser talks to one backend, and the session is a cookie

Date: 2026-10-10. Status: accepted.

The owner chose a backend of our own (Core, in `backend/`: Node 24, TypeScript, Express and Zod, like the mail service) as the only server the browser calls. Core talks to the authentication service and to the database; the browser reaches neither, and the gateway is closed to everything but Core's key. The session lives in cookies the page's JavaScript cannot read, not in browser storage as the previous version kept it. Design and the review against the security checklists: [[F-001-authentication]], [[SECURITY-GUIDE]].

### D-029: No passwords

Date: 2026-10-10. Status: accepted.

A person signs in with Google (the account chooser opens in its own window) or with a one-time code sent to their email, typed after giving their email or their username. The code is used once and expires after 15 minutes. Signing up is the same code: there is no password to create, remember or recover. The emails that carry the code are designed afterwards (T-021).

### D-030: The five user types

Date: 2026-10-10. Status: accepted.

`superadmin`, `admin`, `parent` (a verified parent: the verification, KYC, is a later feature), `child` (an account whose declared age is under 18) and `universal` (18 or over). They are the previous version's types, so production data can be migrated, with three changes the owner approved: the stored name `kid` becomes `child`; `child` now means under 18 by age, where `kid` meant "created by a verified parent", so minors who are `universal` in production become `child` in the migration; and the unused sixth type `bigfounder` is dropped (after checking that no account holds it). What happens to the previous version's child accounts, which sign in with a password and have no real email address, is decided at the migration (T-026). Rules and tables: [[F-001-authentication]].

### D-031: Production's environment variable names are kept

Date: 2026-10-10. Status: accepted.

The new version reads the variables production already has, under the same names, so the keys that work there (Google, Amazon SES, Supabase) are not re-entered or rotated by the change of version. The names were read from the production services on 2026-10-10 (names only, with the owner's permission) and are listed in [[ENVIRONMENT-SETUP]]. New settings get new names; an existing name is never repurposed.

### D-032: The emails are our own, written and sent by our services

Date: 2026-10-10. Status: accepted.

Every email has the brand's own design and words. The authentication service keeps making and checking the one-time code but no longer writes or sends mail: it hands the code to Core, signed, Core chooses the email and the language, and the mail service builds it and relays it through Amazon SES. How it was built, and the alternative that was tried and dropped, is in [[F-002-emails]].

### D-033: An account's language is the language the person uses the site in

Date: 2026-10-10. Status: accepted.

The language is stored with the account, and every email is sent in it. To keep joining free of friction nobody is asked for it: a new account takes the language the site was showing at that moment, and it follows the person when they change the site's language while signed in. Three languages exist: English, Spanish and Portuguese.

### D-034: One email design, with the characters looking up at the reader

Date: 2026-10-10. Status: accepted.

Every email has, in this order: the logo, a picture of the characters, the message, a button or a code, a closing line, a pale yellow box of notes and advice, the logo in black, the social logos (without links for now), the rights line and "Unsubscribe". Everything is centered, with the frontend's typeface, colors and button. The picture is the four characters close together seen from above, only their heads turned up, the rest of each body as it is; a light file. It must feel immersive like the scenes in the product: no colored background and no border around it (the first version, on a yellow panel, was rejected). The basic emails are designed now, and later emails reuse the format. The owner approved the built design on 2026-10-10.

### D-035: "Unsubscribe" stops the optional emails, never the ones about the account

Date: 2026-10-10. Status: accepted.

The owner asked for an "Unsubscribe" link in every email, and confirmed what it stops after seeing it built: emails that are not about the account (the welcome, later news). Emails that are part of using the account, such as a sign-in code, always arrive. Details: [[F-002-emails]].

### D-036: The AI is a mentor, "MentorIA"; a tutor is a child's parent or guardian

Date: 2026-10-10. Status: accepted.

The characters follow a mentor model: the one a person chooses accompanies them through the whole experience. The AI behind them is always called **MentorIA**, and is never called a tutor. "Tutor" means only the adult responsible for a child (parent or tutor, "padre o tutor"). The two words are never interchanged, in the interface, in the copy or in the documents: a task, for example, is given either by MentorIA or by the child's parent or tutor, and the text always says which. In English the name is written **MentorAI**: every language gets a professional translation, not a transliteration. The terms are in [[GLOSSARY]].

### D-037: The onboarding is two walks, and the person chooses a mentor in it

Date: 2026-10-10. Status: accepted.

The home page's two buttons start the onboarding: "I'm a parent" for somebody who wants a parent or guardian's account, "I just want to learn" for an account that becomes a child's or a universal one by the age given. It presents the platform and its value step by step and collects the first data (name, age, the language automatically). The person chooses their mentor in it and can change it later; the four mentors are together at the start, and from the choice on the chosen one accompanies the person. At the end the person is offered to join, and decides whether to create the account now or later. What the screens say about lessons, mini-games, MentorIA, Seeds, tasks and the family functions is for the onboarding only and defines none of those features. Design: [[F-003-onboarding]].

### D-038: What is answered before an account stays on the device

Date: 2026-10-10. Status: accepted.

If the person chooses "later", their answers are kept in the browser, so a later sign-up does not ask again. They are kept for 30 days and can be erased at any time with a visible control, because a device may be shared.

### D-039: After "later" the person returns to the home page

Date: 2026-10-10. Status: superseded by D-056 on 2026-10-11, when the application existed.

There is no dashboard or application to arrive at yet. Until there is, "later" returns to the home page, with a discreet notice that what was chosen is saved on this device. Where the onboarding leads is decided when the application is started.

### D-040: Somebody under 18 on the parent's walk is taken to the learner's

Date: 2026-10-10. Status: accepted.

A person who comes in through "I'm a parent" and gives an age under 18 is led kindly to the learner's walk. An account that comes in as a parent is an ordinary account with that intent recorded; the verification that makes it a `parent` comes later (D-030).

### D-041: Compositions of the onboarding: one reusable set, approved as stills, loops afterwards

Date: 2026-10-10. Status: accepted.

Every step of the onboarding has a composition, delivered as a looping video. To keep the cost down the compositions are reusable: in most steps the mentor does something simple (agrees with a nod, looks toward the options up and down, leans in), and only the steps that need it (mini-games, Seeds) get a highly composed scene where the mentor does a specific thing in a specific setting. The opening composition, with the four together, is the same for both walks. The owner approves each composition one by one as a still image, and only then is its loop rendered. All of them are played on one reusable set with lamps and good light, built to the characters' sizes and proportions; the characters must look enthusiastic (the first drafts, standing and turning their heads, were rejected), cast shadows on the set, and have visual effects.

### D-042: Rho and Liruf never raise their elbows or hands

Date: 2026-10-10. Status: accepted.

Because of a defect left by the program that generated their 3D models, which shows in renders, Rho and Liruf may not raise their elbows or hands in any composition made from now on. Everything else on them may move freely. The defect is not to be fixed, and the compositions that already exist are not regenerated. The rule is in [[CHARACTER-COMPOSITIONS]] and is enforced by the scene code.

### D-043: A Seed is a sunflower seed

Date: 2026-10-10. Status: accepted.

The Seed of LittleFounders (D-024) is drawn as a sunflower seed, and it has to be styled well in 3D and in 2D (SVG or Lottie), because it is the product's currency and will be seen everywhere. The first drawing (a pointed teardrop, a deep indigo shell with cream stripes and a golden edge) is `frontend/src/components/icons/seed.tsx` in 2D and `frontend/tools/render/seed-model.js` in 3D; the owner approved it the same day, together with the Seeds composition.

### D-044: The two special compositions of the onboarding

Date: 2026-10-10. Status: accepted.

Only two steps of the onboarding have a composition of their own; every other step uses the reusable poses on the studio (D-041). **Mini-games:** the mentor in an open sports car (no roof), driving flat out, or with the illusion of it, on a small cut-out piece of race track. **Seeds:** a composition that shows the Seeds themselves (D-043). After the owner approves these two, every screen of the onboarding is shown to the owner one by one, for both walks.

On the same day the owner approved the eighteen stills made so far (the group's two, and the three poses and the portrait of each mentor), the four mentor lines, and the Portuguese words for Seeds ("Sementes") and for a guardian (as written in the Portuguese locale file).

### D-045: A browser that has signed in to an account has its own allowance of guesses

Date: 2026-10-10. Status: accepted (taken in the security review the owner ordered fixed; the numbers are the starting values).

The counters that protect a one-time code are kept per account, whoever is guessing. Alone, that let a stranger who knows a child's username spend the account's guesses and emails on purpose and lock the child out for a day, silently. Every such counter now exists twice: a browser that has signed in to the account before proves it with a cookie the page cannot read (`lf_kd`, a keyed hash that names nobody and grants no access) and counts in a set nobody else can spend. The alternatives were a longer code, which changes the approved window and emails, and counting per visitor address, which a guesser with many addresses defeats. A new device is still in the strangers' set. Details: [[RATE-LIMITING-AND-ABUSE]].

### D-046: Onboarding answers reach a new account without asking only in the same sitting

Date: 2026-10-10. Status: accepted (taken in the security review; it changes D-038 in one point).

The answers given before an account exists stay in the browser for 30 days (D-038), and a computer may be shared. An age of 13 or more was recorded for whoever created an account next, with no question: an 8-year-old signing up after an older sibling would have been recorded as that age, with no permission box. Now the answers are handed over without asking only in the tab where the onboarding was finished, within half an hour. Later, the sign-up asks the age with an empty field, and the answers are used only when the age typed is the one they hold; otherwise they are erased. The cost is one question for a person who comes back another day. [[F-003-onboarding]].

### D-047: The mail delivery history is kept 90 days

Date: 2026-10-10. Status: accepted by default, change it if the owner wants (it closes T-031).

A line of `email_logs` holds an address, some of them minors'. A line is removed 90 days after it was written, by a nightly job in the database, and an account that is deleted takes its lines with it at once. Ninety days is long enough to answer "did my code arrive?" and to see a delivery problem build up. The mail service reaches the table with a role of its own that can do nothing else; the service key is not given to it. [[F-002-emails]].

### D-048: Google Analytics collects

Date: 2026-10-10. Status: accepted (the owner's decision, asked by the security review).

Google Analytics 4 stays next to Plausible and Umami (D-004) and collects for every visitor who accepts the optional cookies, whatever their age. The review had asked whether it should load at all on a site children use. What limits it: it loads only after consent, it is never given a query string, and it does not load on the pages whose address carries something private. Counsel's reading of consent given by a child is open with the age step (T-020).

### D-049: A code is sent after a piece of work, and after the answer

Date: 2026-10-10. Status: accepted by default in the second round of the security review, change it if the owner wants.

Two things about asking for a code by email. A browser does a small piece of work first (a hash puzzle of about a tenth of a second), so that asking by the thousand costs a script computing time; it was chosen over a CAPTCHA because it puts no third party on a page children use and asks nothing of the person, knowing it is weaker. And Core answers before it sends, whatever was typed, so that the time an answer takes says nothing about an address or a username; the cost is that a failure to send is no longer told to the person. With it, codes to addresses that have no account share an hourly allowance, so a flood of made-up addresses cannot stop existing accounts from signing in. [[RATE-LIMITING-AND-ABUSE]].

### D-050: Nothing is pushed or deployed until the security list is closed

Date: 2026-10-10. Status: accepted (the owner's rule).

What the security review of 2026-10-10 left open is kept as one list, T-036 in [[BUILD-TASKS]], and every line of it is a blocker: no push and no deployment until it is closed.

### D-051: The home is a pile of playing cards beside a stage

Date: 2026-10-11. Status: accepted (the owner's choice among prototypes).

After three rounds of prototypes of the signed-in application (a page of the dev server, since replaced by the application itself) the owner chose its structure. The home page is a stage (a composition of the mentors) beside a pile of real playing cards, face down, with its top card turned over: the top card is what comes next and holds its one button, and passing it turns over the next one. Around it: on a desktop a sidebar that can be collapsed, on a phone a dock of icons with no words. Every shape is round and soft, with no vertices, and that holds for the whole platform. The destinations are Learn (the games live inside it), Mentor (the place to see and set up MentorIA, not the conversation), Wallet, Tasks, and Family for an adult's account; administration is a later session. Their paths are `/home`, `/learn`, `/mentor`, `/wallet`, `/tasks` and `/family`, and a person with a session lands on `/home`. A card is shown only when the feature behind it exists, so the home grows one feature at a time and never shows what does not work. There is one design, for people aged 13 and over (D-027); younger people are admitted but nothing is redrawn for them. It is built in steps the owner approves one by one (T-037 in [[BUILD-TASKS]]); each feature is its own later session.

### D-052: The home shows a different composition every day

Date: 2026-10-11. Status: accepted (the owner's decision).

The stage of the home page shows one composition a day: the first time a person comes in on a day one is drawn at random for them and stays for 24 hours, and the next day another one is drawn. There are thirty to start with, each rendered for both color modes, and the catalog is made to grow (seasons and special dates later). Every one shows the four mentors together doing something in a setting of its own, highly produced, with effects. Core chooses the composition, not the browser, so it is the same on every device of a person and does not repeat until all have been seen. For this family the limit of "about six elements" in [[CHARACTER-COMPOSITIONS]] does not apply; that nothing collides and nothing touches a character still does. Each is approved as a still first (D-041): a pilot of three sets the level, then batches of five or six. The list and the state of each are in T-038 of [[BUILD-TASKS]].

### D-053: Nods to popular culture are generic

Date: 2026-10-11. Status: accepted (proposed by the agent, approved by the owner with the plan of compositions).

A composition may wink at a famous film or game through its setting and its action (a car that travels in time, a school of magic with floating candles). It never shows a recognizable character, logo, costume or name: those are somebody's property, and this is a commercial product for minors. Anything closer than a generic homage goes to counsel first.

### D-054: Every icon is our own, in color, a Lottie file, and alive

Date: 2026-10-11. Status: accepted (the owner's rule, stated as absolute for all iconography and symbology of the platform).

The application has its own system of icons. An icon is a 2D composition in full color, with no outlines, kept as a Lottie file (`*.json`); it has to feel in motion (a streak is a flame that burns, not a still drawing of a fire) and it has micro-interactions. The owner rejected a first set drawn as two-tone line icons for being plain and "dead". No icon comes from an icon library any more: this replaces the earlier rule that only the icons that identify the product were our own, and it leaves Morphicons (D-007) without a role once the existing screens are migrated (T-012; done on 2026-10-12, and the package was removed). The player is `lottie-web` in its light build, added as a dependency for this and chosen because it draws SVG and contains no `eval`, so the Content-Security-Policy stays as it is; the player that needs WebAssembly was not used for that reason. The owner approved the nine icons of the second set the same day. How an icon is drawn and moves, and the steps to make a new one, are in [[ICON-SYSTEM]]; the engineering is in rule 4 of [[FRONTEND-GUIDE]].

### D-055: No tracker inside the signed-in application

Date: 2026-10-11. Status: accepted by default while the application was built, change it if the owner wants.

Plausible, Umami and Google Analytics load and count on the site's public pages after the visitor accepts (D-048). They do not load or see anything on the paths of the signed-in application (`/home`, `/learn`, `/mentor`, `/wallet`, `/tasks`, `/family`): most of the people there are minors, and what a child does inside the product is not handed to a third party by default (rule 8 of the repository). Measuring the product itself, with what and under which consent, is decided with the owner and counsel as its own feature (T-015, T-036). [[F-004-application]].

### D-056: After "later" the person comes into the application as a guest

Date: 2026-10-11. Status: accepted (the owner: "later" must not leave the person on the landing page). Supersedes D-039.

D-021 says registration is never a requirement. So somebody who walks the onboarding and chooses "later" goes into the application, to `/home`, greeted by the name they gave and with the mentor they chose. What makes them a guest is in their own browser only: the onboarding's answers (D-038, 30 days, erasable at any time). Core knows nothing about a guest: it gives them the menu without Family and one composition of the day that is the same for every guest. The application tells a guest that what they chose is kept on this device, with the way to create the account and the way to erase it; creating it gives the answers to the new account and they stay where they are. On the site, a guest sees the green "Keep learning" button like anybody who has a way in. A visitor who never walked the onboarding is still sent to sign in. What a guest can do inside each feature, and what is kept of it, is decided with that feature: nothing a guest does is stored by Core. [[F-004-application]], [[F-003-onboarding]].

### D-057: Wider request limits in development only

Date: 2026-10-11. Status: accepted (the owner asked for the option that keeps production safe and local work fast).

Core's limits are the same code and the same numbers everywhere. One setting, `RELAXED_LIMITS=true`, makes the limits that count how often something is asked for a hundred times wider (codes per network address and per email address, session and account calls, reads), so that a developer and the audit tools on one machine do not lock each other out. It is honored only when `NODE_ENV` is exactly `development`: with any other value, or none, Core refuses to start while it is set, so it cannot reach production by mistake. The limits that guard a code against guessing (five tries per code, thirty a day per address) and the things that happen once are never widened. The authentication service keeps its own minute between two emails to one address. [[RATE-LIMITING-AND-ABUSE]], [[ENVIRONMENT-SETUP]].

### D-058: Fail safe is a priority of the project

Date: 2026-10-12. Status: accepted (the owner: safe fails must be a documented priority; erasing a guest's answers asks for confirmation with a warning).

Whatever goes wrong, and whatever a person presses by mistake, they keep what they had. It is rule 16 of `CLAUDE.md`, and it is how a design is judged before it is called finished:

- **Erasing asks first.** An action that erases something or cannot be undone opens a window that says what will be lost. The button that keeps everything has the focus, so Enter or a careless press keeps it; Escape and a press outside keep it too. The button that erases is the quiet one.
- **A failure loses nothing.** When a call fails, what the person typed or chose stays where it was, and the screen says what happened and what they can do.
- **In doubt, refuse.** Where an account or a child's data is at stake, a check that cannot be made refuses instead of letting through (the limits that fail closed in [[RATE-LIMITING-AND-ABUSE]], `NODE_ENV` read as production unless it says otherwise).
- **Nobody is left stuck.** Every screen has a way on and a way back.

The first use is the guest's notice: "erase it" asks before erasing ([[F-004-application]]).

### D-059: The new version goes to production now, from zero

Date: 2026-10-12. Status: accepted (the owner's decision), and carried out the same day.

The bases of the platform are built, and production holds no product and no real user: its accounts are tests and guests. So the new version is deployed now, to see everything work in the real environment before the advanced features are built. This lifts D-050 for this deployment: the lines of T-036 that can only be closed in production are closed there and reported, and the ones that are decisions stay open and are named below.

- **From zero.** Nothing in the production database is worth keeping. It is backed up first and then started again with the new migrations; the previous accounts are not carried over (T-026 is no longer needed).
- **What exists stays as it is.** No existing production variable is changed or removed, Google's sign-in keys above all. The new version only adds the variables it needs.
- **A copy of the keys.** Every production service's variables were saved on 2026-10-12 on the owner's computer, outside the repository and outside any synced folder, readable by the owner's user only, because some (the AI services') will be used again. No value is in the repository or in any document.
- **Accepted for now:** no legal pages (T-003), no reading by counsel of the age step, of analytics and of the guest entry for a child under 13 (T-020, T-036), and Google's sign-in not yet run end to end (T-019). Until the privacy notice is published the address is not announced or shared.

## Related

- [[F-001-authentication]]
- [[SECURITY-GUIDE]]
- [[ENVIRONMENT-SETUP]]
- [[RESEARCH-FOUNDATION]]
- [[GLOSSARY]]
- [[CHILD-SAFETY-AND-PRIVACY]]
- [[UI-LIBRARIES]]
- [[F-001-authentication]]
- [[F-002-emails]]
- [[F-003-onboarding]]
- [[CHARACTER-COMPOSITIONS]]
- [[PRODUCT-REQUIREMENTS]]
- [[ARCHITECTURE]]
- [[SYSTEM-DESIGN]]
- [[IMPLEMENTATION-PLAN]]
- [[AI-WORKFLOW]]

Back to [[INDEX]].

## Update this document when

- The owner makes a decision with lasting effect, or reverses one.
