# 06 — Integrations

This document lists every third-party service and external system the platform depends on. For each it gives the business purpose, the data exchanged and its direction, and the conditions under which it is used. It then covers webhooks and callbacks, federated identity, email and notifications, and the internal service-to-service integrations.

---

## 1. Inventory of external services

| # | Provider | Category | Used by | Business purpose |
|---|---|---|---|---|
| 1 | **DeepSeek** (language model API) | Generative AI | AI Tutor Runtime; Course Generation | Tutor conversation replies, placement free-text reading, post-session memory review, live activity authoring; lesson planning/writing/translation in course generation |
| 2 | **Alibaba Cloud Model Studio / DashScope** (Qwen models, international endpoint) | Generative AI (text, image, vision, speech) | AI Tutor Runtime; Course Generation; Image Generation; Lesson Audio | Independent safety judge for tutor replies; independent judge for live tutor activities; lesson quality judge and fallback author in course generation; illustration generation; illustration prompt crafting and visual verification; lesson narration (text-to-speech and cloned character voices) |
| 3 | **Inworld** | Voice AI | AI Tutor Runtime | Tutor speech synthesis (per character and language) and speech recognition of learners' spoken answers |
| 4 | **Amazon SES** (via the platform's own mail relay) | Email delivery | Transactional Email | Delivery of authentication emails |
| 5 | **Google — Sign-In (OAuth)** | Federated identity | Authentication server | "Continue with Google", when enabled |
| 6 | **Google Analytics 4** | Web analytics | Web application | Optional marketing measurement on public pages |
| 7 | **Google Fonts** | Web assets | Web application | Web typography loaded by browsers |
| 8 | **Plausible Community Edition** (self-hosted) | Web analytics | Web app (tracker); Core API (reports) | Privacy-focused public-page analytics and staff reports. It can import historical Google Analytics data. |
| 9 | **Umami** (self-hosted) | Product analytics | Web app (tracker); Core API (reports) | Behavioral analytics on adult surfaces |
| 10 | **Uptime Kuma** (self-hosted) | Monitoring | Core API (staff health view) | Service up/down status, latency, uptime |
| 11 | **Railway** | Cloud hosting | All backend services, data store, analytics stack | Hosting, private networking, persistent volumes, remote shell access for scheduled jobs |
| 12 | **Vercel** | Web hosting / CDN / DNS | Web application | Static hosting, rewrites, edge function for badge previews, DNS zone for all domains |
| 13 | **GitHub Actions** | Automation | Operations | Continuous integration, deployments, scheduled production jobs |
| 14 | **Redis** (managed) | Shared cache | Core API, AI Tutor Runtime, Analytics Warehouse | Shared rate-limit counters, single-use token ledger, parked tutor sessions, speech cache, warehouse response cache |
| 15 | **IndexNow** | Search engine notification | Operator tool | Notify search engines of updated public pages |

Local libraries that call no external service:
- **Tesseract OCR** (runs inside the Guardian service; ID images never leave the platform);
- **DiceBear** avatar styles (rendered in the browser);
- **DuckDB** (embedded analytics engine);
- **three.js** (3D rendering in the browser);
- **Lottie** (animations);
- the self-hosted identity and data platform (Postgres, authentication server, data API, realtime, gateway).

---

## 2. AI and machine-learning integrations in detail

### 2.1 AI Tutor conversation (DeepSeek, OpenAI-compatible chat API)

- **Direction:** the platform sends data to DeepSeek and receives the reply.
- **Model:** a chat model chosen at deployment. The operator tooling requires a non-reasoning model; the default configured value is DeepSeek's "flash" model, and provisioning keeps the chosen model.
- **Data sent per turn (the session context is limited by a strict schema to exactly 14 fields):**
  - nickname (never the real name);
  - age tier 1–3 (never the date of birth);
  - language, tutor character and intent;
  - adaptations;
  - course/topic titles;
  - up to 12 skill-mastery estimates;
  - up to 40 recent turns of this conversation;
  - the lesson plan state;
  - up to 3 previous-session summaries (topic, skills, outcome, graded counts, days ago);
  - the pedagogy state (strategy, scaffolding, objective, mode, misconception hint);
  - the currently open activity;
  - the learner memory notes (learner and pedagogy).

  The learner's latest message is sent wrapped as untrusted data, together with system notes (deterministic answer verification, recall excerpts, the chosen teaching strategy, wrap-up instructions).
- **Data received:** the tutor's reply as structured output: speech text, emotion, gesture, next step, optional whiteboard (numbers are recomputed by the platform), demonstration, roleplay scene, pointer and plan save.
- **Controls:**
  - a 20-second timeout;
  - a per-instance **daily spend ceiling** (USD 20 by default; an alert at 50%; new sessions refused when it is reached);
  - per-session time and turn budgets;
  - costs are recorded per session.
- **Also used for:**
  - **placement free-text intake** (course outline, age band, learner text; returns a prior estimate and a reflection);
  - **post-session review** (the session transcript, rewritten into memory notes);
  - **live activity authoring** (skill, difficulty, framing, allowed exercise types, recent tutor lines).

### 2.2 AI safety judge (Qwen via DashScope)

- **Direction:** outbound, request and response.
- **Model:** default "qwen3-max".
- **Tutor reply moderation:** each candidate tutor reply, optionally with a few of the tutor's own recent lines, is judged for harm categories: sexual, violence, self-harm, hate, dangerous instructions, personal information, secrecy, contact details, off-platform redirection. For **child accounts** a missing or failed judgment refuses the reply. For others, deterministic checks decide in that case.
- **Live activity judge:** judges generated activities before the platform re-verifies them with its own graders.
- **Placement intake safety** runs in the same moderation path.

### 2.3 Speech (Inworld)

- **Synthesis:** tutor lines are sent as text with a per-character, per-language voice (12 voice identifiers: 4 characters × 3 languages) and model "inworld-tts-1". The service returns audio and word timings, used for captions and lip-sync. The audio is stored in the platform's media storage.
- **Recognition:** learner audio (when the microphone is allowed) is sent for transcription, with automatic language detection. Any inferred voice profile the provider may return (emotion, accent, style) is **discarded**.
- **Availability:** voice is off unless a provider is configured (default: none). Minors additionally need guardian consent and the minors' voice policy (off by default).
- **Cost controls:**
  - speech cache: scripted lines by default, 180-day lifetime;
  - pre-generated audio for fixed lines;
  - a 15-second timeout.

### 2.4 Course generation (DeepSeek and Qwen)

- **Author:** DeepSeek's "pro" model writes lesson plans and documents. Qwen is the automatic fallback when DeepSeek fails (enabled by default).
- **Judge:** Qwen "qwen3-max" scores each lesson on a 9-dimension rubric (child safety, age fit, concreteness, pedagogy, cognitive engagement, feedback quality, distractor quality, narrative quality, naturalness).
- **Localization:** the model translates only learner-visible strings. Numbers, identifiers and answer keys are frozen.
- **Data sent:** catalog and topic content only. **No learner data** is involved.
- **Cost controls:** per run (5 million tokens / USD 50 by default), per lesson (150,000 tokens / USD 0.25), retries (3), and a price table for cost accounting.

### 2.5 Illustrations (Qwen image models)

- **Generation:** "qwen-image-max", square images (1328×1328), converted to WebP.
- **Prompt crafting:** "qwen-plus" turns a lesson label and context into an illustration prompt.
- **Verification:** "qwen-vl-plus" checks that the image is pictorial (up to 3 verifications). A white-background check applies to object tiles.
- **Cache-first:** identical prompts are never regenerated.
- **Concurrency and retries:** 1 generation at a time, up to 4 attempts, a 120-second timeout.

### 2.6 Lesson narration (Qwen text-to-speech)

- **Model:** "qwen3-tts-flash", plus a voice-clone model for character voices.
- **Default voices per language:** Jennifer (English), Li (Spanish), Ryan (Portuguese). Optional cloned character voices per language exist for Dina, Liruf, Rho and Zara.
- **Output:** 48 kbps MP3, stored in media storage and referenced from the lesson's audio manifest.
- **Data sent:** lesson prompts, story lines, key ideas, choices, hints and explanations. **Never answers or learner data.**

---

## 3. Federated identity (OAuth / SSO)

| Aspect | Detail |
|---|---|
| Provider | **Google** only |
| Enablement | Server-side, on the authentication server. The web app shows the button only when the Core API reports Google as enabled. No web-app release is needed to enable it. |
| Flow | The Core API returns the authentication server's authorize address, with a return address at the web app's `/auth/callback`. The authentication server handles the Google exchange and returns session tokens to the callback. |
| Account creation | New Google users get a profile named from the Google profile (display name, full name or name), the universal role and zeroed stats. No date-of-birth screen applies. |
| Signup attribution | Recorded when the web app reports the signup/login completion event with the visitor id |
| Enterprise SSO | The gateway exposes the standard single-sign-on (SAML) metadata and assertion routes of the identity platform. **No SSO provider is configured or used by the product.** |
| Allowed return addresses | The web app's OAuth callback, password reset and settings pages |

---

## 4. Email and notifications

### 4.1 Delivery path

```
Authentication server ──SMTP──► Transactional Email service (Haraka relay, accepts only private-network senders)
                                  ├──► Amazon SES relay (port 587, authenticated) ──► recipient
                                  └──► delivery log entry (message id, recipient, subject, status "relayed", template "auth")
```

- The sender identity defaults to "LittleFounders <noreply@littlefounders.ai>".
- Outside production the email engine defaults to a no-op mode (nothing is sent).
- Deliverability relies on DNS records for the sending domain (DKIM, SPF/MX for the mail-from domain, DMARC) held in the web host's DNS zone.

### 4.2 Email types and triggers

| Email | Trigger | Landing |
|---|---|---|
| **Signup confirmation** | Email signup when the authentication server requires confirmation | Returns to the app to finish sign-in |
| **Password recovery** | "Forgot password" | Reset password page |
| **Email change confirmation** | Settings → change email (sent to the new address, and to the old one if the server is configured for secure changes) | Settings |
| **Magic link** | Template available. No product flow triggers it. | — |
| **Invitation** | Template available. No product flow triggers it. | — |

All five templates are branded HTML pages hosted with the web app.

### 4.3 Direct send API
The email service exposes an internal "send email" operation (recipient, subject, HTML/text, template type, language, user), logged with status. **No product flow currently calls it.** Only authentication emails are sent today.

### 4.4 Other notification channels
- **No push notifications, SMS or in-app notification center exists.**
- In-product notices are shown on screen only: "allowance arrived", pending approvals counters, safety flags on the guardian page.
- Warehouse **alerts** can be configured with a "webhook" or "email" channel, but triggering an alert only records it in the alert history. **No webhook call or email is sent.**
- Operational alerting is limited to failing scheduled jobs (visible as failed automation runs) and the Uptime Kuma status. The AI Tutor spend-ceiling alert is written to the service log.

---

## 5. Webhooks and callbacks

| Endpoint | Direction | Trigger | Data | Action |
|---|---|---|---|---|
| `/auth/callback` (web app) | Inbound browser redirect from the authentication server | Completion of Google sign-in | Session tokens in the address fragment | Establish the session, load the profile, record signup/login completion |
| Authentication server verify/callback routes | Inbound from email links and Google | Email confirmation, recovery, email change, OAuth | One-time tokens | Confirm, create a recovery session, or finish OAuth; then redirect to the app |
| Delivery-log intake (email service, internal) | Internal: from the relay to the email service | Every relayed message | Message id, recipient, subject, status, template | Store a delivery log entry |
| Realtime channel "live generation progress" | Outbound push to staff browsers | Changes to live generation counters | Run counters (no personal data) | Live refresh of the Generation console |

**No third-party inbound webhooks** exist: no payment provider, no email-provider events (bounces and complaints from SES are not ingested), no analytics provider callbacks. **No outbound webhooks** are sent to third parties.

---

## 6. Analytics and observability providers — data flows

| Provider | Loaded where / when | Data sent | Consent and exclusions |
|---|---|---|---|
| **Plausible** | Browser, **public marketing pages only** (home, how it works, families, FAQ, legal, badge), **only for visitors without a session**, only with cookie consent | Page views; marketing goals (guest start, signup-CTA click, secondary CTA) | Not loaded for excluded networks, bots, automated browsers or opted-out devices. Its own ignore flag is set when excluded. |
| **Umami** | Browser: anonymous visitors on marketing pages (with consent) **and signed-in parents** on product pages. **Never children, never the staff console.** | Page views (no automatic tracking; explicit page views); marketing goals | Same exclusions. Its own disable flag is set when excluded. |
| **Google Analytics 4** | Browser: anonymous visitors on marketing pages with cookie consent; never children | Page views and marketing goals | Same exclusions. Google cookies are deleted if consent is refused. |
| **Core API ← Plausible / Umami / Kuma** | Server-side reads for the staff console (60-second cache) | Statistics, breakdowns, series, monitor status | Provider credentials stay server-side. The console answers "not configured" when a provider is absent. |
| **First-party beacon → Core API** | Browser, all surfaces | See 07 | Consent-gated for children. Dropped for excluded networks and bots. |

---

## 7. Hosting, storage and delivery integrations

| Integration | Purpose | Notes |
|---|---|---|
| **Railway** | Hosts the Core API, AI Tutor Runtime, Course Generation, Lesson Audio, Guardian, Email, Media Storage, Image Generation, Analytics Warehouse, the data store (database and gateway) and the observability stack | Private networking between services. Persistent volumes for the database, media and backups. The course generation, lesson audio, image generation and analytics warehouse services scale to zero when idle. The AI Tutor Runtime is always warm (it holds live connections). |
| **Vercel** | Hosts the web application | Prerendered public pages. Every other address serves the app shell (not indexed). The badge address runs an edge function that injects link-preview tags. Long-lived caching for assets. Holds the DNS zone for all platform domains (web app, API, identity, media and tracker subdomains). |
| **Media Storage (self-hosted)** | Stores lesson audio, illustrations, 3D scene and character models, badge images, tutor speech, chore photos, and database backups | Public files are world-readable with 1-year immutable caching. Private files (chore photos) are readable only through the platform. Content-addressed. |
| **GitHub Actions** | CI/CD and scheduled jobs | See 08 |
| **Search engines** | Discovery | Prerendered multilingual pages with language alternates. IndexNow submissions. Social preview cards. |

---

## 8. Internal service-to-service integrations

| From → To | Purpose | Data | Failure behavior |
|---|---|---|---|
| Core → **Guardian** | ID verification | Names, date of birth, ID image (in memory) → four check results | Service unavailable → the verification fails (never passes) |
| Core → **AI Tutor Runtime** | Preflight, placement intake | Minor flag, wants voice / course outline, age band, learner text | Preflight failure → the tutor cannot start. Intake failure → deterministic placement. |
| AI Tutor Runtime → **Core** | Session context, turns, flags, memory, recall, activities, verification, voice checks, close, cost, consent | See 04 §9 | Degrades per call. Missing context never becomes an empty profile. |
| Core → **Media Storage** | Chore photos (private), badge rendering, retention deletion of tutor audio | Image bytes / badge parameters / file paths | Failure → the request is refused (never a placeholder) |
| AI Tutor Runtime → **Media Storage** | Store tutor speech (public; per session or shared scripted) | Audio | Voice degrades to text |
| Core → **Analytics Warehouse** | Staff intelligence (proxy), learner skill states, experiment exposure | Queries | Staff console shows "unavailable". The tutor proceeds with "intelligence degraded". |
| Core → **Email service** | Staff delivery logs and summary | Queries | Staff console shows "unavailable" |
| Core → **Plausible / Umami / Kuma** | Staff analytics and health | Queries | "Not configured" / "upstream failed" |
| Course Generation → **Image Generation** | Illustrations | Labels, context, purpose | Retry, or continue without images, per run options |
| Course Generation → **data store** | Publish lessons (review status), telemetry, release attestations | Lesson documents, answer keys, run/slot metrics | Stage checkpoints allow resuming |
| Lesson Audio → **data store / Media Storage** | Narration manifests and audio files | Text units → MP3 | The row stays pending; the retry reuses the cache |
| Analytics Warehouse → **data store** | 5-minute incremental sync from service-only views | Events, attempts, users (with staff flag), lessons, sessions, adult conversions | Sync errors recorded; data quality view shows staleness |
| Authentication server → **Email service** | Authentication emails | Rendered emails | — |
| Scheduled jobs → **Core / data store / Media Storage** | Retention, backups, rollups, audits | See 08 | A failing job shows as a failed automation run |

All internal calls authenticate with a shared internal key (constant-time comparison) and travel over the hosting provider's private network. The AI Tutor websocket uses a separate signing secret, so that a leaked session token cannot call internal APIs.

---

## 9. Data residency and third-party exposure summary (as implemented)

| Data category | Leaves the platform to | Notes |
|---|---|---|
| Child's name, email, address, date of birth | **Never** sent to AI providers | Only the nickname (checked not to contain the real name) and an age tier/band |
| Learner conversation text | DeepSeek (replies), Qwen (moderation judge) | Wrapped as untrusted input. Personal-data patterns in learner input block the turn before the model is called. |
| Learner voice | Inworld (recognition), when the microphone is allowed | Voice-profile inferences discarded |
| Tutor speech text | Inworld (synthesis) | — |
| ID document image | **Never** leaves the platform (local OCR) | Not stored |
| Lesson content | DeepSeek, Qwen (generation, judging, narration, images) | No learner data |
| Web-analytics page views | Plausible and Umami (self-hosted), Google Analytics (third party) | Consent-gated; public pages only for Plausible and GA; never children for Umami and GA |
| Authentication emails | Amazon SES | Recipient address, email content |
| Google sign-in | Google | Standard OAuth exchange |
