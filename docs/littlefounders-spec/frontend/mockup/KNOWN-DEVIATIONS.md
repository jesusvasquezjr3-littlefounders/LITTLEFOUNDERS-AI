# Known deviations in the mockup

**Status (21 September 2026):** K1–K39 are **resolved in the v2.1 mockup** (kept below as the change log). **K40–K42 are open and will stay open in the mockup**: they come from the owner's review of the v2.1 screenshots (OD-13, OD-14, OD-15) and describe things this mockup cannot or does not show. Do not copy them. They are listed in section 7.

**v2.1 status (20 September 2026):** **Items K1–K39 are resolved in the v2.1 mockup**; this file is kept as the change log of what v1 showed and why it changed. K13 (coverage) is a scope item: the v2.1 mockup adds the Mentor, child Tasks and Wallet, parent, staff content-review and Teaching-visuals screens, but it is still a visual reference, not the full screen inventory. Original status line of v2 follows.

**Previous status (v2, superseded by v2.1 above):** The mockup (`littlefounders-mockup.html`) is **unchanged from the v1 delivery** and stays the visual reference: how the product should look, space and move. It is **not** the v1 scope or the information architecture (owner decision OD-2). Every item below is something the mockup shows that contradicts the v2 Bible (`../frontend-bible/02`–`04`) or the owner decisions (`13-OWNER-DECISION-LOG.md`). **Do not copy any of these into the product.** Where this file, the Bible and the mockup disagree, the order of authority is: decision log, then Bible, then this file, then the mockup.

Each item was confirmed against the delivered file (rendered in Chromium or found in its CSS/JS), not taken from the review alone.

## 1. Scope, access and naming (OD-2, OD-3, OD-5, OD-6)

| # | Route | What the mockup shows | Rule or decision it breaks | Correct behaviour |
|---|---|---|---|---|
| K1 | `pricing` | A full pricing page: "Simple plans for every family", "Start free. Upgrade when you are ready.", a Monthly/Yearly toggle, plans Free ($0), Family ($8 per month, "Most popular", "Try Family") and School ("Custom", "Contact us"), FAQ "Is there a free plan? Yes. Start free and upgrade whenever you like." and "Can I cancel at any time?" | OD-5: pricing is parked, out of scope for v1 | No pricing route in v1. Marketing may say "free to start", never "always free". |
| K2 | all marketing routes (`landing`, `how`, `families`, `pricing`, `signup`, `login`, `notfound`) | "Pricing" in the top navigation and in the footer's Product column | OD-5 | Remove the link. |
| K3 | `families`, `notfound` | A "See pricing" button (next to "Create a family"; next to "Go home" on the 404) | OD-5 | Remove; the 404 offers ways back into the product only. |
| K4 | `pricing` | School plan: "For classrooms and clubs", "Class dashboards", "Bulk profiles" | OD-3: families only; no teacher or school roles, no class dashboards | No school or classroom product. |
| K5 | `signup` | "I am a…" picker with **Parent / Teen / Teacher** | OD-3 (no teacher role; a role is never self-declared into advanced features) | No teacher option. Adults and teens self-register; a child's account is created by the parent; Family, Wallet and Tasks unlock only through a verified parent and a guardian link. |
| K6 | `signup` | Name, email, password, role and consent only: **no date of birth, no age screen**, no guardian step | OD-3: every sign-up path captures age; minor safeguards follow age | An age screen on every path (email, Google, guest), before any account is created; under-13 goes to the parent-created or guest path with full minor safeguards. |
| K7 | `login` | A single "Email" field | OD-3: login accepts email **or username** | "Email or username" field; children sign in with the username and passphrase their parent created. |
| K8 | `home`, `family`, `me`, `staff`, `system` (app shell) | The learner's navigation has a tab labelled **"Tutor"** (EN, ES and PT) for the AI; the home card says "Ask Dr. Rho. Your tutor is ready to help" ("Tu tutor…", "Seu tutor…") | OD-6: "Tutor" means only the verified parent | The tab shows the learner's chosen Mentor character (Dr. Rho, Zara, Liruf or Dina): its name and avatar. Parent and staff views say "Mentor". Never call the AI a tutor. |
| K9 | `home` | Dr. Rho is the only character; there is no way to choose one | OD-6 | The learner chooses one of the four Mentor characters; that choice fills every Mentor slot (`02` §9.7). |
| K10 | `staff` | A "Family review" table of named families' chores with "Review" and "Remove" per family, plus a "Remove this family?" dialog that deletes profiles and progress | Staff do not review or approve families' chores in the product (chore approval is parent-only); browsing named families' chores is a data-minimisation problem | The staff console is about content publishing, permissions and audit (product requirements Block G), not family chores. Design it from the product's screen inventory. |
| K11 | `staff` | The staff table renders **inside the learner's app shell** (Learn / Tutor / Tasks / Wallet / Profile, with "Profile" marked current) | OD-3 and OD-4 (one design system, but separate experiences for learner, parent and staff) | The staff console has its own shell and navigation, built from the same tokens and components. |
| K12 | `family` | The child's app shell ("Tasks" tab, the child's coin balance and split) contains the parent-only **"Approve"** button on each chore, with the success-wipe animation | OD-3 (parent actions need a verified parent); `04` §4.2 note | "Approve" lives in the parent experience. The child sees the chore's status ("Waiting for approval", "Approved"). The success-wipe pattern itself is fine, in the parent's view. |
| K13 | all routes | The mockup covers about 10 of the product's 47 top-level screens; parent experience, Mentor stage, onboarding and age screen, settings, badge sharing, profile/social and the admin console are not designed | OD-2: the mockup is not the scope | Scope comes from the product's screen inventory and requirements, designed in this visual language. |

## 2. Gamification and motion (OD-1, OD-7; `02` D7, D9, §9)

| # | Route | What the mockup shows | Rule or decision it breaks | Correct behaviour |
|---|---|---|---|---|
| K14 | `lesson` | A **heart counter** (a `berry` chip with a heart icon and "3") in the lesson header | OD-1 / D9: no lives; rule 18 | No counter of any kind (not even ∞). The header holds the close button and the progress bar only. |
| K15 | `lesson` | Nothing happens after repeated misses beyond the per-answer hint | OD-1 / D9 | After several consecutive misses on the same skill, the Mentor character offers a guided review (an offer, never a penalty). |
| K16 | `lesson` | Every **correct answer** fires a confetti burst (about 26 pieces) from the Continue button and a **"+10 XP" floater** | OD-7 / D7, rule 17 | Bump + check mark + informational success banner. No confetti, no floater; XP is shown on the lesson-complete screen. |
| K17 | `landing` ("Try one right now" demo) | A correct demo answer fires confetti and "+10 XP" | OD-7 / D7 | Same as K16. |
| K18 | `family` | **Confirm split** fires confetti (32 pieces) and "+5 XP" | OD-7 / D7 | A confirmation: the split settles and a short status message states the result. No confetti, no XP floater. |
| K19 | `signup` | A successful sign-up fires confetti, then the toast "Account created. Welcome!" | OD-7 / D7 (sign-up is not on the milestone list) | The toast only. |
| K20 | all routes (CSS) | **Spring overshoot on routine UI**: `.btn` and `.icon-btn` release (`transform var(--dur-micro) var(--spring)`), answer rows and `.choice`, course cards, the select/correct `bump`, the arming pop (`.btn.arm`), the progress bar fill (`.8s var(--spring)`), accordion chevron, checkbox, switch knob, toast entry, and the streak-strip wave (`waveRise 520ms var(--ease-spring)`) | OD-7 / D7: spring is for the milestone list only; `04` §2 | Press: scale .97 in over `--dur-instant`, out over `--dur-micro`, `--ease-standard`. Bumps are keyframed on `--ease-standard`. Transitions use enter/exit/standard. Spring stays only on true milestones (e.g. the lesson-complete medal pop and stat tiles, which the mockup does correctly). |
| K21 | all routes (CSS) | Press-in duration hard-coded as `.06s` instead of a token | `02` §9.1, `04` §2 | `--dur-instant` (80 ms). |
| K22 | CSS `:root` | `--spring` is commented "overshoot: press release and reward pops only" while `--ease-spring` says "never routine UI"; the motion block header says "three tiers" for five tokens | F2/F3 wording | Five duration tokens in three categories; spring only on milestones. |

## 3. Visual system leftovers (`02` §3, §4.4, §9)

| # | Route | What the mockup shows | Rule it breaks | Correct behaviour |
|---|---|---|---|---|
| K23 | `system` | Stale v1 copy: "Chunky button states"; "Press physics: the 6 px ridge collapses to 1 px on press, then springs back. Gloss is fixed; shine is the only idle motion on a button"; state label "armed (shine)"; "one shining CTA per screen"; Inverse button "The ridge borrows the card's colour" | Flat system (`02` §9.1, §9.5, §10) | Flat buttons, scale press, a breathing glow on one CTA; the inverse button is a plain surface fill. |
| K24 | `system` | Each colour swatch draws a 6 px ridge band under the fill (`.sw .fill{box-shadow: inset 0 -6px 0 var(--rg)}`) | Flat system; `{hue}-ridge` has only two uses (`02` §3) | Show the ridge colour as a separate value, not as a relief edge. |
| K25 | `system` | The status-chip row includes the heart "3" lives chip | D9 | Remove. |
| K26 | `system` | The type specimen prints **"undefined"** as the sample text for `body-lg`, `body`, `label` and `caption` | Mockup bug (missing sample string) | Real sample text. |
| K27 | `system` | The static dialog specimen has a 2 px inset outline (`inset 0 0 0 2px outline`); the real dialog uses only the float shadow | `02` §4.4 (neutral surfaces are separated by shadow, never outline) | Shadow only. |
| K28 | app shell at ≥840 px | The sidebar is separated from the content by a 2 px `outline` line (`border-right`) | `02` §4.4, rule 2 | Separate by a surface step or a soft shadow. |
| K29 | `landing` (hero art stage) | The small `berry` avatar in the chat bubble has a 1.5 px inset ring in `berry-ridge` | `02` §4.4: a filled component never gets a border (the ridge-colour line is only for coin, medal and hexagon art) | No ring. |
| K30 | `me` ("Show resting state") | The "Streak resting" banner has a 2 px inset `sky-strong` outline, unlike every other banner | `02` §4.4 | Soft fill only, like the other banners (the state is already carried by colour, icon and copy). |
| K31 | CSS `:root`, `.btn.sm` | Dead v1 variables: `--depth: 6px` ("chunky ridge height"), `--depth: 4px` on small buttons; `--rg` / `--card-rg` are set on buttons and cards but never painted | `02` §3 (no `depth` tokens) | Do not port. |

## 4. Sample data and copy

These are placeholder content, not rules, but they are listed so nobody treats them as specification.

| # | Route | What the mockup shows | Problem | Correct behaviour |
|---|---|---|---|---|
| K32 | `result` | "You answered 9 of 10 correctly." after a lesson that has 4 exercises and only advances on a correct answer; Accuracy tile fixed at 90% | Internally inconsistent (the review described the accuracy as random 71–78%; in the delivered file it is a fixed 90%, and the only randomness is in the confetti) | Result data derived from the actual session. |
| K33 | `result` | "Today vs your best": Today 90%, Best 80% | A best lower than today's score | Best is at least today's value; a new best is stated as such. |
| K34 | `home` vs `me` | "Hi, Sofia!" on home, "Sofía" on the profile | Inconsistent sample name | One name. |
| K35 | `home`, app shell | The "Tutor" and "Wallet" tabs do nothing when pressed | Placeholder navigation | Every tab reaches its screen. |
| K36 | `landing` | The hero addresses the child ("Money skills, played like a game") and never uses the brand call to action "Become your child's Tutor" | Brand Law 1 (the parent is the hero), per the review | Parent-facing hero; brand copy from the product/brand team. |
| K37 | `login` | "Log in to keep your streak going." | Mild streak pressure (`02` §9.6 rule 4, no guilt-framed copy) | Neutral welcome copy. |
| K38 | `families` | "Ask before spending. Purchases wait for your approval." | Frames redemptions as shopping (brand Law 2, per the review); "purchases" is not glossary vocabulary | Glossary vocabulary (`02` §1.2): coins, spend, approve. |

## 5. Verified defect found by the v2 tools

| # | Route | What happens | Rule it breaks | Correct behaviour |
|---|---|---|---|---|
| K39 | `home`, Portuguese, 375 and 768 px, light and dark, under WCAG 1.4.12 text spacing | The course title "Investimento inteligente": the word "Investimento" is 145 px wide with the spacing overrides, in a 130–139 px column, and spills into the card's padding to its edge (12 hits in the v2 text-fit run; 0 with normal text) | Text Fit Contract (`02` §7, rules 5 and 9) | The course grid never makes a column narrower than its longest title word: reflow to one column instead (not a mid-word break, not smaller text). |

## 6. Reported but not found

- **Correction:** the stale comment *does* exist. In the exercise-slide section of the mockup's script, a comment reads "…proportionate on both phone and desktop widths — see 03-MOTION.md rationale". The motion document is `04-MOTION.md`. Cosmetic (a code comment, not UI copy); fix when the mockup is next edited.
- **A randomly generated accuracy on the result screen** (review section 2). Confirmed not a defect: the review captured the result screen while its numbers were still counting up (a 900 ms capture during the count-up animation), which produced intermediate values such as 71% and +37 XP. The final state is a fixed 90%; see K32.

## 7. Open deviations after the owner's review of v2.1 (21 September 2026)

These are not bugs to fix in the mockup. They mark what the product must do differently from what the mockup shows.

| # | Route | What the mockup shows | Rule or decision it breaks | Correct behaviour |
|---|---|---|---|---|
| K40 | most app routes, especially `signup`, `mentor`, `board`, `wallet`, `tasks`, `parent` | Copy over budget: 142 distinct findings across EN/ES/PT (59 in English). Examples: 22-word explanations under sign-up titles, 4–6-word buttons, a 33-word parent narrative, first views of 60–84 words | OD-13, `06-COPY-BUDGET.md` | Rewrite to the budgets in `06` §3 (examples in `06` §6). Full list: `COPY-BUDGET-FINDINGS.md`. Checked by `copy-budget-audit.reference.mjs`. |
| K41 | all routes | Generic stroke-icon sprite (42 symbols), letter avatars ("R", "Z", "L", "D"), flat placeholder coin and medal vectors, coloured icon discs on cards | OD-14, `07-ICONOGRAPHY-AND-VISUAL-ASSETS.md` | At most 24 system glyphs; every meaningful visual is our own asset in the house style; characters are renders of the real 3D models. Copy the slot, not the drawing. |
| K42 | `mentor` (and the Mentor card on `home`) | The Mentor as a chat screen: a thread of bubbles with letter avatars and personality text cards for choosing | OD-15, `08-MENTOR-STAGE.md` | The chosen 3D character on its Diorama as the dominant area; the speech plate holds one turn; reply chips and input below; the transcript as a secondary sheet. The legacy Mentor UI in the current app is deleted, not restyled. |

