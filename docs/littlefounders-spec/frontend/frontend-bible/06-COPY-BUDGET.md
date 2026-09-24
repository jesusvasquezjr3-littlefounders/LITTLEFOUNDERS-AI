# 06 · Copy Budget — say less, say it clearly

Status: **owner-mandated (OD-13, 21 September 2026). Non-negotiable.** Written in English because the file feeds an AI frontend agent. Where this file and `13-OWNER-DECISION-LOG.md` disagree, the log wins.

The owner reviewed the v2.1 screenshots and found **too much text in several elements**. The earlier rules only covered whether text *fits*: the Text Fit Contract (`02` §7) forbids clipping and the em-dash rule (`02` rule 16) covers tone. Nothing set a limit on *how much* text a screen may carry. This file sets that limit, with numbers an agent can check and a tool that checks them (`verification-tools/copy-budget-audit.reference.mjs`).

---

## 1. The rule in one line

**Every string does one job, in the fewest words that a child in that age band understands at first read. Detail goes behind a tap, into the Mentor's voice, or into the visual. It never goes into more words on the screen.**

## 2. Why (evidence, graded as in `01`)

| Claim | Source | Grade | What it means here |
|---|---|---|---|
| People scan pages; on an average page visit they read only a minority of the words (at most about 28%, likely closer to 20%). | Weinreich, Obendorf, Herder & Mayer (2008), *ACM Transactions on the Web* 2(1), browsing logs; analysed by Nielsen (2008) | B | Text beyond the first few words of each block is mostly not read. It costs space and hides the one sentence that matters. |
| Removing interesting but extraneous words and pictures improves learning (the coherence principle). | Mayer & Fiorella (2014), *Cambridge Handbook of Multimedia Learning*: the leaner version won in most experiments reviewed, with a large median effect | A | In lessons and on the board, extra explanation on screen does not help understanding and can hurt it. |
| Children's working memory is smaller than adults'. New content per lesson must be capped by age. | Product Appendix B; requirement B.17 | A | The same cap applies to interface text around the content: chrome must not compete with the lesson. |
| On-screen text that duplicates narration verbatim hurts learning (redundancy principle). | Product Appendix B; requirement B.18 | A | When the Mentor speaks, the screen shows a short caption, not a paragraph (see `08` §5). |
| Plain-language guidance: short sentences, common words, one idea per sentence. | GOV.UK content design guidance; plain-language practice | C | Expert consensus, not a controlled study. Used as a style rule. |
| The exact numbers in section 3. | Design judgement, calibrated on the v2.1 mockup and the owner's review | D | Treated as hard limits because the owner mandated brevity. Revisit with real usability data, never by adding words case by case. |

## 3. Budgets (English words; ES and PT get ×1.25, rounded up)

A **word** is any run of letters or digits ("25%", "Sofía's" and "60" each count as one). Budgets apply to what the user sees in one state of one screen.

### 3.1 Signed-in product, sign-up and log-in ("app")

| Role (`data-copy-role`) | What it is | Max words | Max sentences | Notes |
|---|---|---|---|---|
| `action` | Button or link-button label | **3** | — | Verb first: "Continue", "Add photo", "Invite a parent". No "my", no "please". |
| `heading` | Screen or card title | **6** | 1 | A noun phrase or a short question. No trailing explanation. |
| `body` | Subtitle, helper line, card text, banner text, empty state, error | **12** | 2 | One idea. If it needs "and", "so" or "because", it is probably two ideas: cut one or move it behind a tap. |
| `prompt` | A lesson or board question | **20** | 2 | Context plus the question. Ages 6–9: **12**. Numbers the learner needs stay; decoration goes. |
| `option` | Answer option, choice, picker value | **8** | 1 | Ages 6–9: **5**. |
| `mentor` | One Mentor turn on the stage (`08`) | **20** | 2 | Ages 6–9: **12**. One question per turn. |
| `narrative` | The parent's weekly story (B.10) | **30** | 2 | The one exception for parents: it is content, not chrome. Still one paragraph. |
| First view | Total words visible without scrolling on a 375 × 740 px screen (excluding `data`) | **40** | — | Ages 6–9: **25**. If a screen needs more, it needs a second step, not more text. |

### 3.2 Marketing site ("site")

| Role | Max words | Max sentences |
|---|---|---|
| `action` | 3 | — |
| `heading` | 8 | 1 (a two-part brand line counts as one heading) |
| `body` (per paragraph) | 25 | 2, and at most one paragraph per section |

### 3.3 Not counted

- `data`: user content, names, numbers, table cells, amounts, dates.
- `brand`: approved brand lines taken verbatim from `COSMIC_NARRATIVE.md` (for example "Become your child's Tutor"). Marked `data-copy-role="brand"`. New brand lines are the brand team's call, not the agent's.
- `legal`: mandated disclosures (consent, the share disclosure in F.3, age safeguards). These are never shortened below what the requirement demands. They use **layering** instead (section 4).

## 4. Where the extra detail goes (layering)

When a message is longer than its budget, the agent does **not** raise the budget. It chooses one of these, in this order:

1. **Cut.** Remove anything the user does not need to act *now*: reassurance, repetition, "you can change this later" (unless that is the point of the screen).
2. **Show it.** Replace words with the visual or state that already says it: an icon plus a word, a progress bar, a chip, a character pose, the board.
3. **Say it.** In learning surfaces, the Mentor says it (voice plus a short caption, `08` §5), within the Mentor budget.
4. **Put it behind a tap.** A "Why?" or "Details" link opens a sheet. The sheet may hold up to 60 words, in short paragraphs, and the legal text in full where required.

A summary line that stands in for a disclosure must still be true on its own. It is not allowed to hide the consequence behind the tap.

## 5. Writing rules (all surfaces)

1. One idea per string. One question per Mentor turn.
2. Verb-first actions, in the user's voice where it reads naturally ("Log in", "Add coins", "Ask Dina").
3. Common words from the controlled glossary (`02` §1.2). No jargon, no "simulation" wording on every screen. The simulation disclosure lives in one chip or banner per surface, not in every sentence.
4. No filler: "please", "simply", "just", "in order to", "so the right protections apply from the start".
5. No repetition of what the heading or the visual already says.
6. Numbers as digits ("3 lessons", not "three lessons").
7. No em dash (`02` rule 16), no exclamation marks in parent, staff or error copy, at most one per screen for learners.
8. Age register changes the *words*, not the budget upward: younger bands get **smaller** budgets (section 3.1).
9. Translations must meet the ×1.25 budget. If a translation cannot, the English source is rewritten shorter. The translated string is never truncated.

## 6. Before and after (from the v2.1 mockup)

These are examples of the method, not final copy. Final copy is written and AI-translated from the glossary (OD-11).

| Screen | v2.1 mockup (over budget) | Within budget |
|---|---|---|
| Sign-up, age | "We ask everyone who signs up, so the right protections apply from the start. Enter your own month and year of birth." (22) | "We use it to keep you safe." (7) |
| Sign-up, under 13 | "Accounts for children under 13 are created by a parent. They will give you a username and a passphrase to log in." (22) | "A parent creates your account." (5) + "Why?" sheet |
| Sign-up, under 13 action | "Try a lesson as a guest" (6) | "Try as guest" (3) |
| Landing action | "Try one lesson with your child" (6) | "Try a lesson" (3) |
| Lesson, guided review | "This one is tricky, and that is fine. Want to look at it together first? A short review with worked steps, then you try again." (25) | Mentor turn: "Tricky one. Want to see it together?" (7) |
| Guided review actions | "Review with Dr. Rho" (4) / "Keep trying on my own" (5) | "Show me" (2) / "I'll try" (2) |
| Tasks (child) | "A grown-up in your family checks each task and approves it. Then the coins go to your wallet." (18) | "A grown-up approves. Then you get the coins." (8) |
| Tasks (teen, no parent) | "Tasks and anything a parent approves need a parent or guardian linked to your account. Your personal wallet works without one." (21) | "Tasks need a linked parent." (5) |
| Tasks action | "Add a photo as proof" (5) | "Add photo" (2) |
| Teen wallet | "You manage this wallet yourself. No approval needed. Everything here is a simulation in coins." (15) | "Your wallet. No approval needed." (5) + the simulation chip |
| Board, discount | "Lock in my prediction" (4) | "Lock it in" (3) |
| Parent, weekly story | "This week Sofía practised saving for a goal and splitting coins between save, spend and share. She found "how many more do I need" tricky at first, then solved it on her own." (33) | "Sofía practised saving and splitting coins. "How many more do I need?" was tricky, then she solved it." (18) |
| Parent, coaching tip | "Keep everyday help at home unpaid and put coins on bonus tasks. It shows that some work is simply part of being a family." (24) | "Pay coins for bonus tasks only. Everyday help stays unpaid." (10) |
| Mentor screen intro | "Dr. Rho helps you think things through, one question at a time." (12, at the limit, but it repeats what the stage shows) | Removed. The stage and the character say it (`08`). |

## 7. How it is verified

- **Tool:** `verification-tools/copy-budget-audit.reference.mjs` measures every visible text block by role, per state and language, and the first-view total. It checks words and sentences. In production, components must declare `data-copy-role`, and the root must carry `data-age-band` (the tool then applies the 6–9 limits). With both declared, the tool measures roles exactly instead of guessing them. Without them, it infers only `action`, `heading`, `body`, `prompt` and `option`. The mockup declares roles only where the heuristics would be wrong (listed in `../mockup/COPY-BUDGET-FINDINGS.md`).
- **v2.1 mockup baseline:** 142 distinct findings across EN, ES and PT (59 in English), mostly on sign-up, the Mentor screen, the board, the wallet, tasks and the parent screen. The full list is in `../mockup/COPY-BUDGET-FINDINGS.md`. It is recorded as deviation **K40**: do not copy the mockup's strings.
- **Gate:** a new or translated string must pass the Text Fit audit **and** the Copy Budget audit before merge (`02` §7 item 10, extended).
- **Content pipeline:** lesson prompts, options and Mentor turns are content, authored in Forge. The same budgets become a Forge gate next to B.17 and B.18 (see the note on requirement B.18 in `13-OWNER-DECISION-LOG.md`, OD-13).
