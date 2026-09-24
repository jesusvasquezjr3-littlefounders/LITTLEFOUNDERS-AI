# LittleFounders — Product Audit: Executive Summary

**Document set:** Product audit of the LittleFounders platform (10 files, `00` to `09`).
**Audit basis:** Behavior as defined by the platform's executable logic, data schema, service configuration and scheduled-job definitions. Marketing copy and legal text shown to users are reported as *what the product states*, and are compared with implemented behavior where the two differ.
**Audit posture:** Descriptive only. This set records what exists and how it behaves. It does not recommend changes.

---

## 1. Platform overview

LittleFounders is a gamified financial-literacy and entrepreneurship learning platform for children, teenagers and their families. It combines five product pillars:

1. **Story-driven courses.** A catalog of courses (financial education, entrepreneurship, investing, plus a short starter course) organized as *Course → Adventure → Saga → Topic → Lesson*. Lessons are interactive sequences of 57 kinds of exercises (stories, quizzes, number input, sorting, money manipulatives, analysis, branching stories, simple coding/robot puzzles). The server grades them. Four recurring mentor characters (Dina, Liruf, Dr. Rho and Zara) narrate, with audio in three languages.
2. **An AI Tutor.** A conversational tutor rendered as a 3D character on a personalized "island". Learners talk to it by typing or, where permitted, by voice. The tutor explains, draws on a visual whiteboard, runs short practice activities, remembers learners across sessions and adapts its teaching strategy. Guardians can read every conversation, and must approve what the tutor remembers about a child.
3. **Family Hub (Tasks & Rewards).** Verified parents ("Tutors" in product vocabulary) assign real-world chores worth an in-app currency called **LF Coins**. Children mark chores done, optionally with a photo as proof. After a parent approves, the child splits the reward into **Save / Spend / Share**. Children can also set savings goals and redeem coins against a parent-defined reward catalog.
4. **Digital Banking (simulation).** An educational banking layer over the LF Coin wallet. It provides a named account and card, freeze/unfreeze, an automatic allowance, a parent-paid weekly savings bonus, spending limits and monthly statements. The product explicitly presents this as a simulation, not a bank account.
5. **Verified parental control.** Adults become parents only by verifying a government ID. Only verified parents can create child accounts. Every child account must stay linked to at least one verified guardian. Guardians control analytics consent, microphone consent and tutor memory approval, and see the child's learning territory, chores, wallet and tutor transcripts.

Around these pillars sit a public marketing site, a guest ("try without an account") mode, onboarding, a per-course adaptive placement quiz, a social layer (public profiles, follow and block), shareable achievement badges, a staff console, and a large internal analytics and operations stack.

### Inferred core value proposition

"Financial learning for the digital economy and smart investing" for families. Children learn money skills by **making decisions inside stories**, not by watching lessons. A conversational AI tutor complements the courses. Parents keep full visibility and control, and the platform can be started free without an account.

### Markets and languages

- Three locales everywhere: **English (US)**, **Spanish (Mexico)** and **Portuguese (Brazil)**. Spanish (Mexico) is the content authoring language, and the other two are produced by controlled translation.
- The data controller named in the Privacy Notice is a Mexico City entity. The Terms are governed by Mexican federal law.
- The product is free. No billing, subscription, payment or pricing capability exists anywhere in the platform.

---

## 2. Key assumptions made during this audit

1. **Working copy is the subject of the audit.** The audited codebase includes uncommitted changes that make lesson grading and lesson completion atomic and replay-safe: per-run completion receipts, per-attempt grading receipts and a lesson recovery checkpoint in the browser. These are documented as current behavior.
2. **Production configuration is inferred from defaults.** Where a behavior depends on deployment settings (for example, whether email confirmation is required at signup, whether the voice provider is enabled, or whether Google sign-in is enabled), the audit describes the configurable behavior and the default value. It does not claim to know the live production values.
3. **"Tutor" means verified parent.** The data layer calls this role *parent*. The user interface calls it *Tutor*. The AI product is called the *AI Tutor*. This document uses "parent (Tutor)" for the role and "AI Tutor" for the conversational product.
4. **Content volumes come from the curriculum catalogs.** Counts of adventures, topics and lessons are taken from the authoring catalogs (course blueprints). The number of lessons actually published in production depends on generation and human release, and cannot be determined from the codebase.
5. **Development-only screens are excluded from product counts.** Eight laboratory/QA screens exist only in development builds. They are listed separately and are not counted as product screens.
6. **Operator tools are treated as part of the platform.** Command-line and scheduled operator tools (content generation, narration, migrations, backups, audits) have no end-user UI but define how the product is operated. They are documented in the jobs and configuration files.
7. **A third-party game project referenced only in operational notes is out of scope.** No part of the audited application references it.

---

## 3. High-level system architecture (business terms)

The platform is a set of independently deployed services that talk to each other over a private network with a shared internal credential. Only four surfaces face the public internet: the web application, the Core API, the authentication/data gateway and the media download service. The AI Tutor's live conversation channel is also public (see below), and the observability trackers are loaded by browsers.

| Component (internal name) | Business role | Public? |
|---|---|---|
| **Web Application** | Single-page app: marketing site, learner app, family and parent tools, staff console. Hosted on a CDN. | Yes |
| **Core API ("Core")** | The only backend the web app calls. It owns authentication brokering, roles, learning, grading, placement, family, tasks, banking, profiles, AI Tutor session management, and the staff console data. | Yes |
| **Data Store & Identity ("Vault")** | Self-hosted relational database with an authentication server, a data API with row-level security, realtime notifications and a gateway. | Yes (authentication and gateway) |
| **AI Tutor Runtime ("Oracle")** | Runs live tutor conversations over a websocket: language model calls, safety moderation, voice synthesis and recognition, pedagogy controller and spend control. | One websocket channel |
| **Course Generation ("Forge")** | Operator-run pipeline that writes, checks, judges, translates, illustrates and stages lessons for human review. | No |
| **Lesson Audio ("Echo")** | Text-to-speech narration of lessons in three languages, with per-character voices. | No |
| **Image Generation ("Prism")** | Generates and verifies lesson illustrations, cache-first. | No |
| **Guardian Identity Check ("Guardian")** | Local OCR comparison of a parent's typed details against a photo of their ID. The image is never stored. | No |
| **Transactional Email ("Courier")** | SMTP relay for authentication emails, forwarding to Amazon SES, with a delivery log. | No |
| **Media Storage ("Depot")** | Content-addressed file storage for audio, images, 3D scenes, badges, evidence photos and backups. | Public downloads only |
| **Analytics Warehouse ("Data Intel")** | Analytical warehouse (DuckDB) fed from the operational data every 5 minutes. Serves the staff "Intelligence" console, learner skill-state estimates and A/B experiments. | No |
| **Observability ("Pulse")** | Self-hosted Plausible (web analytics), Umami (behavioral analytics) and Uptime Kuma (service health). | Trackers and status only |

Trust boundaries:

- **Browser to Core.** The browser sends the user's session token. Core verifies the token locally and applies role and guardianship checks. The data store also enforces row-level security.
- **Core to internal services.** Calls carry a shared internal key, compared in constant time.
- **Browser to AI Tutor Runtime.** The browser opens a websocket with a single-use, 60-second session token that Core signs. The runtime never sees the user's normal session token.
- **Staff console.** Data from the observability and analytics systems passes through Core. Their credentials never reach the browser.

---

## 4. Product domains and modules

| # | Domain | Summary |
|---|---|---|
| 1 | Public marketing & SEO | Landing, How it works, Families, FAQ, Terms, Privacy, shareable badge landing, prerendered multilingual pages, cookie consent |
| 2 | Identity & access | Guest sessions, email/password signup with age screen, Google sign-in (optional), login by email or child username, password recovery/change, email change, guest-to-account upgrade |
| 3 | Onboarding | Five-step, character-narrated, one-time guest onboarding |
| 4 | Guardian verification | ID-based upgrade from universal account to verified parent (Tutor) |
| 5 | Learning catalog & course map | Course shelf, course path, unlock rules, territory map with spaced-review states, course badges |
| 6 | Placement | Per-course adaptive placement quiz with optional AI-read free-text intake, skip-ahead credits |
| 7 | Lesson engine & grading | Lesson player, 57 exercise types in 8 families, server grading, hints, attempts, hearts, XP, streaks, recovery checkpoint |
| 8 | AI Tutor | Personalization (character, companion, island, time of day, nickname, adaptations), offers, live conversation, activities, whiteboard, roleplay, learning map, plan & notebook, history & replay, daily limits |
| 9 | AI Tutor pedagogy | Knowledge-component graph, mastery estimation, spaced repetition, misconceptions, strategy controller, content ladder (catalog → curated bank → live generation) |
| 10 | AI Tutor safety & privacy | Input classification, output moderation, safety flags to guardians, voice consent, memory approval, 90-day retention |
| 11 | Family management | Create/rename/rotate passphrase/delete child accounts, analytics consent, child territory, tutor transcripts, share badges |
| 12 | Family Hub: tasks & rewards | Chores, evidence photos, approvals, reward allocation, goals, reward catalog, redemptions, chore streaks |
| 13 | Digital Banking | Accounts, cards, freeze, allowance, savings bonus, spending limits, statements, pending credits |
| 14 | Profiles & social | Own profile, avatar editor, cover presets, settings, public profiles, follow/unfollow, block/unblock |
| 15 | Achievements | Course completion badges, shareable achievement badges (course, streak, savings goal) |
| 16 | Staff console | Overview, content release, lesson moderation, tutor live-activity review, users, emails, web/behavior analytics, internal-traffic exclusions, service health, first-party insights, intelligence warehouse, generation monitoring, audit log, roles and permissions |
| 17 | Content production (operator) | Course generation, quality gates, AI judge, localization, illustration, narration, release verification |
| 18 | Analytics & experimentation | First-party event beacon, consent gating, acquisition attribution, rollups, warehouse, experiments, anomalies, churn risk, forecasts, alerts |
| 19 | Operations | Scheduled retention, backups, drift probes, rollups, curation reports, deployment and migration automation |

---

## 5. Totals

| Measure | Count | Notes |
|---|---|---|
| **Product screens (routes)** | **45** | 8 marketing/public, 4 authentication, 3 standalone full-screen flows (onboarding, account upgrade, placement), 13 signed-in app screens, 10 staff console screens, 3 public-profile screens, 1 badge landing, 1 lesson player, 1 AI Tutor stage, 1 "not found". There are also 8 development-only laboratory screens. |
| **Core API endpoints** | **194** | 193 route handlers plus a health check. Staff console 61, AI Tutor 34 (20 user-facing, 14 runtime-only), Tasks 25, Banking 20, Profiles 14, Authentication 13, Family 9, Learning 7, Placement 4, and one each for events, public analytics decision, public badge, onboarding and verification. A pass-through proxy exposes the warehouse's endpoints to staff. |
| **Other service endpoints** | **75** | AI Tutor Runtime 4 HTTP plus 1 websocket; Analytics Warehouse 49 plus health; Media Storage 6; Email 5 (plus an SMTP relay); Lesson Audio 4; Image Generation 2; Guardian 2; Course Generation 1 (health only; its work runs as operator tools). |
| **Data entities (operational store)** | **74** | Current stored entities, excluding the identity server's own user records. 80 were created over the platform's history, and 6 were later removed: families and family members, and a retired 4-table game engine. About 30 analytical views, 11 core warehouse tables and 8 warehouse feature tables sit on top. |
| **User roles** | **6** | Universal, Parent (displayed as "Tutor"), Kid, Bigfounder, Admin, Superadmin. Plus 4 staff permissions (manage users, manage content, view analytics, manage support), and 2 derived session states (guest, anonymous visitor). |
| **Third-party integrations** | **15** | DeepSeek (language model); Alibaba Cloud Model Studio/DashScope (Qwen judge/moderation models, image generation, image verification, speech synthesis); Inworld (tutor voice synthesis and recognition); Amazon SES (email delivery); Google Sign-In; Google Analytics 4; Google Fonts; Plausible; Umami; Uptime Kuma; Railway (hosting); Vercel (web hosting, CDN, DNS); GitHub Actions (automation); Redis (shared rate-limit, token and speech-cache store); IndexNow (search-engine notification). Local libraries (OCR, avatars, analytics engine, 3D) call no external service. |
| **Scheduled / async jobs** | **25+** | 9 scheduled production workflows, 2 in-process warehouse workers (every 5 min), 12 deployment pipelines triggered by CI, 2 manual operator workflows, plus about 20 operator command-line tools and several request-triggered background tasks. |
| **Analytics event types** | **35** | A closed vocabulary, enforced identically by the API and the data store. Three game events were retired together with the game engine. |
| **Lesson exercise types** | **57** | In 8 families. |
| **Courses in the curriculum** | **4** | 1,312 + 544 + 544 + 62 lesson blueprints; 25 adventures; 122 sagas; 882 topics. |

---

## 6. Notable observations (current-state facts)

These are factual observations of the current state, derived from comparing behaviors across components. Each is detailed in the referenced document.

1. **Placement results may not be storable for most placement methods.** The data store accepts three placement-method values. The placement logic records four different values, and only one of them is among the accepted three (the "no probe content" fallback). As defined, a placement committed through the adaptive quiz, or adjusted or reset by the learner, is rejected when stored, and the learner receives a generic "could not record placement" error. (03, 02)
2. **Family-engagement staff insight is out of step with its data view.** The view was redefined per child (guardians, tasks created/approved). The staff endpoint still expects the earlier per-family shape, so that endpoint answers "unavailable". (07)
3. **Card freeze is recorded but not enforced.** The child UI says freezing "blocks new redemption requests". No server-side rule checks the freeze state, and a child can also unfreeze an account a parent froze. (02, 05)
4. **"Minor" means "holds the kid role".** Guests (the path offered to under-13s who are refused signup) and self-registered 13–17 teens hold only the universal role. They are therefore not treated as minors by the AI Tutor's microphone consent gate, its fail-closed moderation posture, or first-party analytics consent. (05, 06, 07)
5. **Several public FAQ statements have no corresponding capability.** Linking a second verified guardian to an existing child, suspending child accounts when a parent account is cancelled, and an in-product report tool are stated in the FAQ. No such capability exists in the platform. (02, 05)
6. **Declared-but-unused capabilities.** The "bigfounder" role gates nothing. Warehouse alerts record triggers but deliver no webhook or email. The "fulfilled" redemption state is never set. The guardian-link states "pending", "rejected" and "revoked" are never produced. Two analytics events (`task_view`, `tutor_open`) have no emitter. The personalization and experiment-exposure learner endpoints have no caller in the web app. (03, 04, 07)
7. **The staff "Insights" screen exists but is not in the staff navigation menu.** It is reachable only by direct address. (01)
8. **Signup language is not kept.** New adult and guest accounts start with English (US) as their language of record, because the language chosen at signup is not copied to the profile. The app shell follows the profile language, so the interface switches to English until the user picks a language. (09, 02)
9. **Children use the same Settings screen as adults.** A signed-in child can change their own password, request an email change, and edit their profile username. The sign-in username stays the one the parent chose. (02)
10. **The data layer permits direct writes that the API constrains.** The data store's row-level rules let certain parties update chores, savings goals, redemptions, banking accounts and profiles directly through the public data gateway. These direct writes are not bound by the state transitions and values the Core API enforces. All money movements remain service-only. (05)
11. **Some mechanisms exist without a feeding process.** The curated tutor activity bank (the second tier of the tutor content ladder) has no creation or release flow. Asynchronous warehouse export jobs are never processed. (03, 07)

---

## 7. How to read this document set

| File | Content |
|---|---|
| 01-PRODUCT-ARCHITECTURE | Every screen, navigation and redirect |
| 02-USER-FLOWS | Every user journey with branches, errors and edge cases |
| 03-DATA-MODEL | Every entity, relationship, rule and lifecycle |
| 04-API-SURFACE | Every endpoint with purpose, inputs, outputs, access and errors |
| 05-PERMISSIONS-AND-ROLES | Roles, permission matrix, guardianship model and role assignment |
| 06-INTEGRATIONS | External providers, data flows, webhooks and email |
| 07-ANALYTICS-AND-METRICS | Events, consent gates, metrics, warehouse, reports and experiments |
| 08-ASYNC-JOBS | Scheduled, triggered and operator jobs |
| 09-CONFIGURATION | Settings, switches, defaults and environment differences |
