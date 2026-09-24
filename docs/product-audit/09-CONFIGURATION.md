# 09 — Configuration

This document lists every configurable behavior of the platform: feature switches, environment-dependent behavior, user-configurable settings, parent-configurable settings, staff/admin-configurable settings, content-level configuration, and the hard-coded business constants that act as fixed configuration. Default values and their business impact are stated for each.

Settings are described by their business meaning. Where a value is fixed in the platform's logic rather than configurable, it is marked **fixed**.

---

## 1. Feature switches and policy flags

| Switch | Scope | Default | Business effect |
|---|---|---|---|
| **Voice for minors** | AI Tutor Runtime | **Off** | While off: children cannot use the tutor's microphone, guardians **cannot record** microphone consent ("not offering the microphone to children yet"), and the offer screen explains that voice is paused "while we finish the safety paperwork". Revoking an existing consent is always possible. |
| **Voice provider** | AI Tutor Runtime | **None** (options: Inworld / none) | With none, the tutor does not speak or listen (text only). Operator provisioning keeps the current choice unless deliberately changed. |
| **Tutor pedagogical brain** | Core | **On** | Enables the knowledge-component graph, mastery tracking, spaced repetition, the session plan and the learning map. If off, or if the graph is not seeded, the tutor behaves conversationally without those features and the map is empty. |
| **Speech cache** | AI Tutor Runtime | On; scope **scripted lines only** (option: all lines); lifetime 180 days | Reduces voice cost by reusing synthesized audio |
| **Live tutor activity review sampling** | Core | **15%** | The share of AI-generated tutor activities queued for human review. 0% is allowed. |
| **Google sign-in** | Authentication server | Deployment-dependent | Shows "Continue with Google" only when enabled. No web-app release is needed. |
| **Email confirmation at signup** | Authentication server | Development: auto-confirm on. Production: deployment-dependent. | Decides whether signup returns a session or "Check your inbox" |
| **Anonymous (guest) accounts** | Authentication server | Enabled (development configuration) | Required for "Start free" |
| **Email engine** | Email service | **No-op** outside production; **relay** in production | Outside production no email is actually sent |
| **Course generation fallback to the secondary model** | Course Generation | On | If the primary author model fails, the secondary model writes the lesson |
| **Narration on service start** | Lesson Audio | Off | When on, the audio service narrates all pending lessons at startup |
| **Analytics device opt-out** | Web app (per browser) | Off | A device-level switch that blocks all trackers on that browser |
| **Third-party tracker configuration** | Web app build | Plausible and Umami script addresses, Umami site id, Google Analytics measurement id | A tracker whose setting is absent is not loaded |
| **Observability stack** | Core | Optional | When Plausible, Umami or Kuma settings are absent, the corresponding staff panels answer "not configured". The product itself is unaffected. |
| **Course "still being built" notice** | Per course (operator) | Off | Shows a "Still being built" badge and notice on the course, for missing narration or illustrations |

---

## 2. Environment-based behavior differences

| Behavior | Development / test | Production |
|---|---|---|
| Laboratory screens (lesson lab, scene/pose lab, tutor lab, learn lab, analytics labs) | Available | **Not included** |
| Rate-limit counters | In-memory, per process | Shared store, so limits hold across instances. If the store is down, requests are allowed. |
| Email sending | No-op (logged only) | Relayed to Amazon SES |
| Email auto-confirmation and anonymous users | On (local stack) | As configured on the production identity server |
| AI Tutor Runtime | May run without a model (the tutor reports unavailable) | Model, judge and (optionally) voice configured |
| Seeded users | Six sample accounts (universal, parent, kid, bigfounder, admin, superadmin), with a linked demo family and the starter course | None |
| Web analytics | The tracker addresses point at the production observability hosts by default in the web-app template | Production trackers |
| Automated browsers | Excluded from all trackers (in every environment) | Same |
| Scale-to-zero | — | Course generation, lesson audio, image generation and the analytics warehouse sleep when idle. The Core API, AI Tutor Runtime, email, media and data store stay warm. |
| Schema changes | Applied locally from scratch | Additive changes are applied automatically on merge. Narrowing or removing changes require a manual, confirmed run. |
| Deployments | Local | Each service deploys automatically when its CI passes on the main branch |

---

## 3. User-configurable settings (any signed-in user)

| Setting | Where | Values | Default | Effect |
|---|---|---|---|---|
| Display name | Settings / onboarding | 1–80 characters | From signup / Google / onboarding | Greeting, profile, badges (first word only) |
| Username | Settings | 3–20, a–z 0–9 _ (unique) | None | Public profile address `@username`, invite sharing |
| Language of record | Settings, app language picker | English (US), Spanish (Mexico), Portuguese (Brazil) | **English (US)** at the data level | Interface language, and the language lessons are served in (fallback Spanish (Mexico)); tutor session language; parent narrative language |
| Interface language (public pages) | Language picker, browser language | Same 3 | Browser language, otherwise English (US) | Public pages. When signed in, the app shell switches to the profile language. |
| Theme | Theme toggle | Auto / Light / Dark | Auto | Per browser (not synced to the account) |
| Date of birth | Settings / onboarding / placement | Past date after 1900 (optional) | None | Age tier for the tutor (≤ 7 / 8–9 / ≥ 10; unknown → middle tier); eligibility for placement free-text intake (12+); staff demographics |
| Avatar | Avatar editor | Cartoon option set (about 11 options) | Unset (seed-based) | Profile and lists |
| Cover | Cover picker | 10 colour presets | None | Profile header |
| Password / email | Settings | Password 8–128; valid email | — | Credential changes (current password required) |
| Blocked users | Settings / public profiles | — | — | Visibility and follow restrictions |
| Cookie consent | Consent banner / preferences | Accept / reject optional (necessary always on) | Unset (nothing optional loads) | Attribution identifier, Plausible, Umami, Google Analytics on public pages |
| Sidebar collapsed | App shell | On/off | Expanded | Per browser |
| **AI Tutor preferences** | Tutor personalize layer | Tutor character (Dina / Liruf / Rho / Zara), companion (any other character or none), island (2), lighting (auto / dawn / day / dusk / night), nickname (1–24, not the real name), adaptations (slower pacing, more examples, less text, more visual, repeat before advancing) | Rho, with Liruf as companion, island A, auto lighting, no nickname ("Explorer" is used), no adaptations | Persona, scene, how the tutor addresses the learner and how it teaches |
| AI Tutor caption size and voice volume | Tutor stage | Preferences | — | Accessibility |
| Placement adjustments | Placement result | Start earlier / from the beginning / keep | Keep | Starting point in a course (never later than earned) |

---

## 4. Parent-configurable settings (per child)

| Setting | Values | Default | Effect |
|---|---|---|---|
| Child's display name, date of birth | 1–80; optional date | As created | Greeting, age tier |
| Child's passphrase | 8–72 | Set at creation | Sign-in |
| Child's language | 3 languages | Chosen at creation | Lessons, interface |
| **Usage analytics consent** | On / off | **Off** | Whether the child's usage events are recorded |
| **Microphone consent** (AI Tutor) | Allow / off (allow only while voice for minors is on) | **Off** | Whether the child can talk to the tutor |
| **Tutor memory approvals** | Approve / reject each proposal | Pending | What the tutor remembers about the child |
| Chore settings (per task) | Reward 1–500 LF Coins, once/weekly, due date, requires photo | Once, no photo | Earning rules |
| Reward catalog | Items with a cost of 1–500, on/off | Empty | What children can redeem |
| **Allowance** | 1–1,000 LF Coins; weekly / every 2 weeks / monthly; day of week (Sun–Sat) or day of month (1–28); on/off | None | Automatic pending credits |
| **Spending limit** | Weekly / monthly cap ≥ 1; on/off | None | Redemption requests beyond the cap are refused |
| **Savings bonus** | 0–20% weekly on the Save balance; on/off | None | Weekly bonus credited to Save |
| Account nickname and card design | 1–40 characters; indigo / emerald / violet / amber / sunrise / ocean | "My Account", indigo | Presentation |
| Freeze card | On / off | Off | Displayed state only (not enforced) |

---

## 5. Staff-configurable settings (admin console)

| Setting | Who | Effect |
|---|---|---|
| Course status: publish (release check) / draft / archive | Admin, Superadmin | Learner visibility of a whole course hierarchy |
| Lesson status: approve (publish) / reject (draft) | Admin, Superadmin | The human review gate for lessons |
| Live tutor activity verdicts | Admin, Superadmin | Quality record of AI-generated activities |
| **Internal-traffic exclusions** | Admin, Superadmin | Networks (address or range; IPv4 no broader than /16, IPv6 no broader than /32) whose traffic is not measured, from now on |
| Analytics report parameters | Admin, Superadmin | Period, audience, rows, filters, report language |
| Warehouse segments, funnels, experiments, alerts | Admin, Superadmin | Saved analyses, A/B experiments, alert rules (recorded only) |
| **Roles** (parent, kid, bigfounder, admin, superadmin) and **staff permissions** | **Superadmin** | Access control (subject to data-store rules) |

---

## 6. Content-level configuration (authored, per lesson or course)

| Setting | Level | Values | Default | Effect |
|---|---|---|---|---|
| Pass threshold | Lesson | 1–100 | **70** | Score needed to pass and unlock the next lesson |
| Hint penalty | Lesson | 0–50% per hint | **10%** (compounding) | Score reduction per revealed hint |
| Maximum attempts per exercise | Lesson | 1–3 | **2** | Retries per exercise per play-through; the answer is revealed after the last |
| Hearts | Lesson | 1–5 or none | **None** | When set, each final wrong answer costs a heart; 0 hearts ends the lesson as failed |
| Estimated minutes, objectives, cast | Lesson | 1–30 min; 1–6 objectives; 1–4 characters | — | Lesson intro, narration voices |
| Exercise XP and difficulty | Exercise | XP 0–50; difficulty 1–5 | — | Score weighting and XP |
| Hints per exercise | Exercise | 0–2 | — | Help available |
| Course subject, badge art, position, prerequisites | Course | Subject: money, math, science, economics, code, mixed | — | Shelf presentation and badges (course prerequisites are stored but not enforced) |
| Adventure theme and age tier | Adventure | Archipelago / forest / city / valley / kingdom / cosmos; tier 1–4 | — | Territory scene; authoring vocabulary level |
| Topic kind, review-of, prerequisites, placement question | Topic | Teaching / spaced review / interleaved review / review quest | Teaching | Review-due states, placement search and caps |
| Knowledge-component mastery parameters | Knowledge component | Prior 0.25, learn 0.15, guess ≤ 0.30, slip ≤ 0.10 (defaults) | — | Mastery estimation |

---

## 7. Fixed business constants (not configurable without a new release)

| Constant | Value |
|---|---|
| Minimum signup age (email signup) | **13 years** (date of birth discarded) |
| Minimum age for guardian verification | **18 years** |
| Placement free-text intake eligibility | Stored age **≥ 12** (age bands 12–14, 15–17, 18+) |
| Placement quiz length | ≤ **10** questions, including **2** confirmation questions |
| Children per parent | **10** |
| Chore reward / catalog cost ceiling | **500** LF Coins |
| Savings goal target ceiling | **100,000** LF Coins |
| Allowance ceiling | **1,000** LF Coins |
| Savings bonus ceiling | **20%** |
| Shareable streak minimum | **3 days** |
| AI Tutor sessions per day | **2** per learner (local day by language region: Mexico City, São Paulo, New York); staff unlimited |
| AI Tutor XP per day | **120** |
| Tutor activity hint penalty | **10%** per hint (max 2 hints) |
| Tutor activity pass mark | **70** |
| AI Tutor socket token lifetime | **60 seconds**, single use |
| AI Tutor retention | **90 days** |
| Retention-sweep staleness threshold | **36 hours** |
| Usage-event retention | **400 days** |
| Backup retention | **30 days** |
| Parent verification attempts | **5 per hour** |
| Evidence and ID photo size | **8 MB** (JPEG/PNG/WebP) |
| Media file size | **25 MB** |
| Nickname length | 1–24 |
| Username format | 3–20 of a–z, 0–9, _ |
| Password / passphrase length | 8–128 (adult) / 8–72 (child) |
| Staff session exemption (tutor) | 8-hour sessions, 5,000 turns, unlimited daily sessions (the spend ceiling, moderation and consent still apply) |
| Rate limits | See 04 §1.4 |

---

## 8. Runtime-configurable operational parameters (deployment settings)

| Parameter | Default | Effect |
|---|---|---|
| **AI Tutor model** | DeepSeek "flash" chat model (the operator provisions the production choice; it must be non-reasoning) | Conversation quality, cost, latency |
| **AI Tutor judge / moderation model** | Qwen "qwen3-max" | Safety moderation and live activity judging |
| AI Tutor voice model and voices | "inworld-tts-1"; 12 voice identifiers (4 characters × 3 languages) | Tutor voices |
| Tutor session soft / hard time budget | **15 / 25 minutes** (hard must exceed soft) | Wrap-up and end of conversation |
| Tutor maximum turns per session | **120** | Session end |
| Tutor idle timeout | **10 minutes** | Connection closed |
| Tutor resume grace | **90 seconds** | Reconnection window |
| Tutor learner input considered | **600 characters** per turn | Length of the message the model sees |
| Tutor concurrent sessions per instance | **200** | Capacity refusals beyond this |
| Tutor handshake rate | **100 per minute** per network | Connection refusals |
| Tutor model / voice / Core timeouts | **20 s / 15 s / 8 s** | Failure handling |
| **Tutor daily spend ceiling** | **USD 20** per instance; alert at **50%** | New sessions refused at the ceiling. With several instances the effective ceiling multiplies. |
| Core → Tutor Runtime timeout | 8 s | Preflight and intake |
| Core → Warehouse timeout | 30 s | Staff intelligence |
| Web analytics site timezone | America/Mexico_City | Day boundaries in web analytics reports |
| Kuma status page | "pulse" | Which status page is read |
| Warehouse sync interval | **5 minutes** | Freshness of Intelligence and skill states |
| Course generation author / judge models | DeepSeek "pro" / Qwen "qwen3-max" | Lesson quality and cost |
| Course generation caps | 5,000,000 tokens and USD 50 per run; 150,000 tokens and USD 0.25 per lesson; 3 attempts per lesson; concurrency 2; 16,384-token documents; timeouts 120 s (chat), 180 s (fallback and images), 30 s (data store); max 3 images per request | Spend control |
| Course generation cost table | DeepSeek input 0.000435, cached 0.0000036, output 0.00087 USD per 1k tokens; Qwen input 0.0016, cached 0.00032, output 0.0064; USD 0.075 per image | Cost accounting |
| Image generation | Model "qwen-image-max", 1328×1328, prompt model "qwen-plus", vision check "qwen-vl-plus", 4 attempts, 3 verifications, 1 concurrent, 120 s timeout, WebP quality 82 | Illustration quality and cost |
| Narration | Model "qwen3-tts-flash" (+ voice-clone model); default voices Jennifer / Li / Ryan; 48 kbps MP3; concurrency 2; optional cap on speech calls per run | Narration quality and cost |
| OCR languages | Spanish + English + Portuguese | ID document reading |
| Email sender | "LittleFounders <noreply@littlefounders.ai>" | From address |
| Media storage file size | 25 MB | Upload ceiling |

---

## 9. Dynamic behavior that changes at runtime

| Dynamic factor | How it changes behavior |
|---|---|
| Roles held (re-read on every request) | Unlocks or locks navigation, boards and endpoints immediately after a grant or revoke |
| Guardian consent state | Analytics collection starts or stops immediately. Microphone availability is re-checked at connection time. |
| Minors' voice policy | Consent collection and child microphone use turn on or off without a web-app release |
| Enabled OAuth providers | The login button appears or disappears |
| Internal-traffic registry | Trackers stop loading for newly excluded networks; events are dropped on arrival |
| Tutor runtime health (model, moderation, voice) | The offer screen's start button and voice options |
| Daily spend accumulation | New tutor sessions refused once the ceiling is reached |
| Daily caps (sessions, XP) | Refusals with an exact reset time |
| Knowledge graph seeded or not | Learning map and pedagogy features on or off |
| Content status and release attestation | Which courses and lessons learners see |
| Course "in progress" flag | Notice shown or hidden |
| Warehouse skill states | Weak-skill offers in the tutor |
| Lesson document revisions | Invalidate local lesson checkpoints; require a fresh course verification before release |
| Observability configuration | Staff analytics panels available or "not configured" |

---

## 10. Language and localization configuration

- **Supported languages:** English (US), Spanish (Mexico), Portuguese (Brazil). All interface text, legal text, email templates, lesson documents, badge labels, narration and SEO pages exist in all three.
- **Authoring language:** Spanish (Mexico). The other two are produced by controlled translation in which numbers, identifiers and answer keys are frozen.
- **Fallback order for lessons:** the profile language → Spanish (Mexico) → any available.
- **Fallback for the interface:** browser language → English (US).
- **Canonical public language for search engines:** English (US), with alternates for the other two.
- **Currencies in tutor visuals:** MXN, USD, BRL.
- **Local-day computation** (streaks, tutor caps): streaks use the learner's device date. Tutor caps use a representative time zone per language region.

**Observation:** a new adult or guest account's language of record starts as English (US), because the signup language is not copied to the profile. Since the app shell follows the profile language, a user who signed up or onboarded in Spanish or Portuguese sees the interface switch to English until they choose a language, after which the choice persists. Child accounts store the language the parent chose.
