# 01 — Product Architecture: Screens, Navigation and Information Architecture

This document lists every screen of the web application, grouped by domain. For each screen it gives the business purpose, the actions available, the data displayed, and how the screen fits into navigation. It ends with the navigation hierarchy and every entry, exit and redirect rule.

All screens are available in English (US), Spanish (Mexico) and Portuguese (Brazil), and in light, dark and "auto" themes. The layout is designed for both phone and desktop widths.

---

## 1. Layout families ("chrome")

The application has five visual frames. Each screen belongs to exactly one.

| Frame | Used by | Contents |
|---|---|---|
| **Marketing frame** | Public pages, OAuth landing, parent verification | Top bar (logo, How it works, Families, FAQ, language picker, theme toggle). For visitors it shows "Sign up" and "Start free"; for signed-in users, "Continue where you left off". Footer (tagline, contact, Terms, Privacy, rights notice). Cookie-preferences link. |
| **Authentication frame** | Login, signup, forgot password, reset password | Minimal frame with a mentor character illustration and no marketing navigation. |
| **App shell** | Signed-in product screens and staff console | Desktop: a collapsible sidebar with product sections, a "Staff" group for staff only, a language picker, a theme toggle and sign-out. Phone: a bottom tab bar, with a horizontal sub-menu on staff pages. Includes a "Family plan" upgrade card for users who are not verified parents. |
| **Full-screen immersive layers** | Onboarding, account upgrade, placement quiz, lesson player, AI Tutor stage, badge landing | No navigation chrome. Each layer has its own exit control. |
| **Error / not found** | Unmatched addresses, failed screen loads | Stand-alone message with recovery actions. |

---

## 2. Screen inventory

### 2.1 Public marketing domain (no account needed)

| # | Screen | Address | Purpose | User actions | Data displayed | Navigation context |
|---|---|---|---|---|---|---|
| M1 | **Landing (home)** | `/` | Main acquisition page: "Financial learning for the digital economy and smart investing". | **Start free** (creates a guest session and opens onboarding; if already signed in, the button reads "Continue where you left off" and opens Learn). **I already have an account** (goes to Login). Log in / Sign up links. Language and theme switches. | Hero with animated diorama video, the statistic "67% of adults never learned to manage money in time" (source: S&P Global FinLit Survey), legacy message, mentor journey, family message, final call to action "Free to start. Free to stay." | Entry point. Prerendered for search engines in all three languages. |
| M2 | **How it works** | `/how-it-works` | Explains the pedagogy ("We do not give lessons. We give decisions."). | Interactive decision demo (a choice between buying candy and saving for a bike, showing the consequence of each). Start free. | Four-mentor section, "start without an account" section with a streak/lessons/coins mock-up, closing call to action. | Top-bar link. Prerendered. |
| M3 | **Families** | `/families` | Parent-oriented page: "Here, you decide." | Create your Tutor account (goes to signup), or "Go to my family panel" when signed in as a parent. Reveal a sample tutor exchange. Interactive chore demo (Save / Spend / Share). | Illustrative family panel (two sample children with coins, streak, a pending redemption and a consent toggle), full-transcript visibility, the memory approval concept, "microphone off by default", the banking simulation ("Practice banking, not a bank account"), the territory map, privacy commitments, and four steps: create account → verify → add child → linked. | Top-bar link. Prerendered. |
| M4 | **FAQ** | `/faq` | Answers pre-decision questions. | Filter by category (All, Getting started, Tutor account & family, The AI Tutor, Money & rewards, Privacy & safety, Support). Expand answers. Email us. Create your Tutor account. | About 25 questions and answers. Support contact address. | Top-bar link. Prerendered. |
| M5 | **Terms & Conditions** | `/legal/terms` | Legal terms. | Read. Switch language. | 20 clauses: definitions; object and nature of the platform; user and account types; registration; child accounts and parental control; educational experiences, simulations and metrics; educational nature and exclusion of financial services; artificial intelligence and personalization; viewing other users' information; user attention, reports and incidents; intellectual property; personal data; suspension/restriction/termination; limitation of liability; modifications; effectiveness; severability; no waiver; applicable law (Mexican federal law, Mexico City courts); contact. | Footer link. Prerendered. |
| M6 | **Privacy Notice** | `/legal/privacy` | Privacy notice. | Read. Open cookie preferences. | 8 sections: controller identity (a Mexico City entity, with a privacy email); data collected and minimization; purposes; AI and child privacy; access/rectification/cancellation/opposition rights and consent revocation; cookies and measurement; transfers and security; modifications. | Footer and cookie-banner link. Prerendered. |
| M7 | **Badge landing** | `/badge/{token}` | Public page for a shared child achievement. Growth loop. | Call to action to start/sign up. The page records a "badge link clicked" acquisition event (with cookie consent). | Child's first name, achievement label and badge image. Link previews in messaging apps show the same data. | Reached only through a shared link. The share link carries a campaign tag "badge-share". Full-screen, no chrome. Not-found state for unknown tokens. |
| M8 | **Cookie consent banner** (overlay) | All pages | Collects consent for optional measurement. | Accept optional; Reject optional; Configure preferences (necessary: always on; first-party attribution: optional; optional measurement: optional); reopen from the footer's "Cookie preferences". | Explanations of each category, with a link to the Privacy Notice. | Shown on first visit to public pages until a choice is made. |

### 2.2 Authentication and identity domain

| # | Screen | Address | Purpose | User actions | Data displayed | Navigation / guards |
|---|---|---|---|---|---|---|
| A1 | **Login** | `/login` | Sign in. | Enter **email or child username** and password (show/hide). Sign in. "Continue with Google" (shown only when enabled). "Forgot your password?". "Create an account". | Error banner mapped to the specific reason (wrong credentials, email not confirmed, too many attempts, etc.). | Guest-only. A user with a real (non-guest) session is sent to Learn. A guest session may still open Login, to sign into another account. After success the user goes to the page that originally required sign-in, otherwise to Learn. |
| A2 | **Sign up** | `/signup` | Create an adult account. | Name, email, password (at least 8 characters), date of birth (day/month/year, "we check it and do not keep it"), checkbox "I'm a parent or legal guardian" (intent to become a Tutor). Create account. Continue with Google. | "Everyone starts with a free universal account." Age-block state for under-13s: "An adult has to create this one", with a "Keep going without an account" button that starts a guest session. "Check your inbox" confirmation state when email confirmation is required. | Guest-only (same rule as Login). After success, parent-intent users go to Verify Parent; others go to Learn. |
| A3 | **Forgot password** | `/forgot-password` | Request a reset link. | Enter email, send. Back to sign in. | Neutral confirmation: "If {email} has an account, we sent a link…" | Guest-only. |
| A4 | **Reset password** | `/reset-password` | Complete recovery from the emailed link. | Enter a new password (at least 8 characters) and update. Go to sign in. Request a new link. | Success state, or "Link expired" state. | Not guarded. It works from any device state because it relies on the link itself. |
| A5 | **OAuth callback** | `/auth/callback` | Completes Google sign-in. | None. Automatic. "Back to sign in" on error. | "Signing you in…" or "Sign-in didn't finish". | Destination of the identity provider. Afterwards goes to Learn. Records a signup or login completion event depending on whether the account is new. |
| A6 | **Upgrade account (save your progress)** | `/upgrade-account` | Attach an email and password to the current guest account. All progress is kept. | Email, password. "Save my account". "Not now" (back to Learn). "Log in instead". | Explains that the streak and progress stay the same. | Requires a session. Non-guests are redirected to Learn. |
| A7 | **Verify parent ("Become a Tutor")** | `/verify-parent` | Upgrade from universal to verified parent. | Intro: three steps, "I am ready" / "Not now". Given name(s), surname(s), date of birth, document type (National ID, Passport, Driver's license), photo of the ID (JPEG, PNG or WebP, up to 8 MB, drag-and-drop). "Verify my identity". Retry. "Write to us" for help. | Privacy note: the photo is checked in memory and discarded. Result states: success ("You're a Tutor now!", with a Tutor badge and a link to home); failure, listing each failed check (unreadable, name mismatch, date mismatch, expired); "You're already a Tutor". | Requires a session. Reached from signup (parent intent), from locked navigation items, and from the upgrade card. Shown inside the marketing frame. |

### 2.3 First-run domain

| # | Screen | Address | Purpose | User actions | Data displayed | Navigation / guards |
|---|---|---|---|---|---|---|
| O1 | **Onboarding** | `/onboarding` | One-time guest setup in five steps, each narrated by a mentor character. | Step 1 Welcome ("Get started"). Step 2 Name (required). Step 3 Date of birth (optional). Step 4 "Where did you hear about us?" (friend, social media, internet search, app store, school, ad, somewhere else; optional). Step 5 "Shall we save your progress?": "Create my account" or "Later". Back / Continue / Skip. Voice on/off. Replay the narration. | Progress "Step n of 5". Character speech bubbles. | Requires a session. Unfinished guests are forced here from any app screen. Finishing grants a day-1 streak. "Create my account" leads to Upgrade account; "Later" leads to Learn. Already-completed users are sent to Learn. |

### 2.4 Learning domain (app shell)

| # | Screen | Address | Purpose | User actions | Data displayed | Navigation / guards |
|---|---|---|---|---|---|---|
| L1 | **Learn (home)** | `/learn` | Home after sign-in. Course shelf. | Pick a course in the carousel (previous/next/go to). "Continue lesson n" (opens the featured course's current lesson), or "Explore course". Filter by track (All, Entrepreneurship, Financial Literacy, Saving & Investment). The filter appears only when more than 6 courses are published. | Greeting with the learner's name. Course cards: title, badge art, lessons passed / total, progress, "ACTIVE COURSE" or "NEXT IN YOUR PATH", "Still being built" notice. Empty state "Nothing here yet". The featured course is the first one in progress, otherwise the first unfinished one. | Default landing for every signed-in user. |
| L2 | **Course path** | `/learn/{courseSlug}` | A course's chapters and lessons. | Open a lesson that is available, current or completed. Jump to "My lesson". Open the territory map. | Course title, overall progress, in-progress notice. Chapters with "n of m lessons" and a CURRENT marker. Each lesson shows its state (locked / available / start here / completed), minutes and XP. Locked chapters show "Finish lesson n to unlock". | If the course still requires its placement quiz, the user is redirected to Placement. |
| L3 | **Territory map** | `/learn/{courseSlug}/territory` | A visual map of the course's topics by mastery. | Back to the path. Open review topics. | Themed scene per adventure (archipelago, forest, city, valley, kingdom, cosmos). Topic states: Completed, Review due, In progress, Not started. "n review due" counter. Locked territories. Course progress. | Linked from the course path. |
| L4 | **Placement quiz** | `/learn/{courseSlug}/placement` | Finds the learner's starting point in a course. | Welcome: "Get started" or "I'd rather start from scratch". Optional free-text "What do you already know?" (only for learners with a known age of 12 or older), or "Just ask me questions instead". Multiple-choice questions with an "I don't know this yet" option. Result: "Start here". "This feels too advanced" opens an adjuster: "A bit earlier", "From the beginning", "Leave it as it is". | "Question n of about m". Narration by Dr. Rho and Zara. Result: starting further in (with the number of skipped lessons and "Topic x of y") or from the beginning. Note when capped by an unmet prerequisite. | Full-screen. Requires a session and completed onboarding. After committing, opens the starting lesson (or the course). If placement was already completed, the user goes to the course. |
| L5 | **Lesson player** | `/learn/lesson/{lessonId}` | Plays one lesson. | Start lesson. Answer each exercise; Check; Try again; Hint; Skip for now (unsupported exercise types only); Continue; Listen again (audio); Exit lesson. Finish on the results screen. Retry saving if confirmation fails. | Intro (minutes, number of challenges). Progress bar, "Step n of m", combo counter ("n in a row"), hearts (only if the lesson enables them), hints left. Feedback (perfect / great / almost / try again). Correct-answer reveal once attempts run out. Results: "Lesson complete!" or "Good effort!", score out of 100, XP earned, time, day streak, best streak, "New best!", "Today's superpower" and "Your next quest". A full-screen streak celebration appears on the first lesson passed that day. | Full-screen. Requires a session. It does not require onboarding, so deep links work. Exit returns to the originating course or to Learn. Placement-required lessons redirect to Placement. Locked lessons show an error. Progress within the tab is recoverable after a reload. |

### 2.5 AI Tutor domain

| # | Screen | Address | Purpose | User actions | Data displayed | Navigation / guards |
|---|---|---|---|---|---|---|
| T1 | **AI Tutor stage** | `/tutor` | The conversational tutor on a 3D island. It has several internal layers (below). | See the layers. "Leave" at any time. | Loading veil "Your island is arriving…"; "The tutor is resting" when unavailable. | Full-screen. Requires a session and completed onboarding. Available to every signed-in role, including guests and children. |
| T1a | — *Personalize layer* | (within T1) | First visit or "My island". | Choose the tutor character (Dina, Liruf, Rho, Zara). Invite or dismiss a companion character. Choose the island (two dioramas). Choose the lighting (auto, dawn, day, dusk, night). Set a nickname (1–24 characters; the real name is rejected). Choose learning adaptations (slower pacing, more examples, less text, more visual, repeat before advancing). Done. | Catalog of characters and islands. Which characters lip-sync. | Saved to the server. |
| T1b | — *Introduce / offers layer* | (within T1) | Choose what to do today. | "Keep going with {topic}" (continue), "My courses" (course topic), "Practise {topic}" (a weak skill), "Where to start" (diagnostic), one of four fixed FAQs ("What is saving?", "Why do prices change?", "What is a budget?", "How does borrowing work?"), "Ask me anything" (open chat). Tick "talk out loud" when allowed. Open the learning map. Open the plan & notebook. Open past sessions (replays). | Greeting with the nickname. Voice availability notices (a grown-up must allow the microphone; talking isn't available; not offered to children yet). The daily limit notice ("You've used today's tutor time. Come back {time}"). | Offers come from the server. The start button is disabled when the tutor cannot start. |
| T1c | — *Conversation layer* | (within T1) | Live tutoring. | Type and send, or hold-to-talk (also the Space key). Interrupt the tutor. Edit the last message. "Explain differently". Accept or decline an adaptation offer ("Yes please" / "No thanks"). Do activities in a side panel (Check). Keep a whiteboard drawing in the notebook. Finish. Start over. | Captions and transcript. Tutor emotion, gesture and speech. Whiteboard visuals (about 45 kinds of instrument). Demonstration animations. Roleplay scene. Lesson step dots ("step n of m"). Minutes left and wrapping-up notice. Activity feedback with "+XP" or "practice only". Reconnecting notice. | Time-boxed (a soft limit at 15 minutes, a hard limit at 25; staff are exempt). |
| T1d | — *Closing layer* | (within T1) | Session end. | Start again, or leave. | "What we did" summary. "Saved. You can listen again any time." Safety stop: "We stopped here — Go find that grown-up now." | — |
| T1e | — *Replay layer* | (within T1) | Replay a past conversation. | Play/pause, previous/next line, jump, from start, "talk instead". | Transcript with activities and demonstrations. Lines without audio are marked. | From the session history. |
| T1f | — *Learning map overlay* | (within T1) | Knowledge-graph map of skills. | Open/close. Continue or review a suggested skill (disabled during a session). | Skills with states: Not open yet, Ready to learn, In progress, Mastered, Time to review. "Opens after {skill}". Review count for today. | Read-only while a conversation is running. |
| T1g | — *Plan & notebook panel* | (within T1) | The learner's saved plan and kept whiteboards. | View. | "Savings plan & kept boards", when the plan was last updated, the number of kept boards, and a last-session recap (minutes, XP). | — |

### 2.6 Family, tasks and banking domain (app shell)

| # | Screen | Address | Purpose | User actions | Data displayed | Guards |
|---|---|---|---|---|---|---|
| F1 | **Family** | `/family` | The parent's family panel. | Add a child (first name, username, passphrase, optional date of birth). Manage a child: change name, change passphrase, remove permanently by typing the child's username. Toggle "Share usage insights" (analytics consent) per child. View territory. Read tutor conversations. | Child cards: name, @username, LF Coin wallet total, chore streak, number of chores awaiting approval, consent state. Empty state "No kids linked yet". After creating a child: "All set — {name} can sign in with {username} and the passphrase you chose." Privacy notes. | Parent (Tutor) only. Others are redirected to Learn, and the navigation item shows as locked. |
| F2 | **Child's territory** | `/family/{kidId}/territory` | See one child's progress in a course. | Choose a course. "Share achievement" for a completed course badge, the current streak (at least 3 days) or a reached savings goal ("Share '{goal}'"). The link is copied or shared through the device. | The same course map the child sees, computed from the child's progress. Stats: XP earned, lessons completed, day streak, best streak. | Parent only. The child must be one of the parent's verified children. Viewing records a "parent report viewed" event. |
| F3 | **Child's tutor conversations** | `/family/{kidId}/tutor` | Guardian oversight of the AI Tutor. | Read or hide each transcript. Load older conversations. Approve or reject pending memory notes. Allow or turn off the microphone for the child. | Sessions: date, message count, "Still talking with the tutor right now", end reason in plain language, and a narrative ("Practiced X", "Found X tricky at first…", "Answered c of t activities correctly"). "Worth your attention" safety flags sorted by urgency, including flags raised during course selection. "What the tutor remembers": the current note, suggested replacements and out-of-date markers. Microphone state (allowed since a date / off / paused by policy / not offered yet). The retention note: "Conversations are kept for 90 days and then deleted automatically." | Parent only, and a verified guardian of that child. |
| F4 | **Tasks** | `/tasks` | Chores and rewards. It renders one of two boards depending on role. | *See the parent and child boards below.* | — | Parent or child only. Universal users see the item as locked. |
| F4-P | — *Parent task board* | (within F4) | Assign and approve chores; run the reward catalog. | New task (for a child, what needs doing, LF Coins reward 1–500, repeats just once / every week, optional "Require a photo before I can approve"). Approve (disabled if a required photo is missing). Cancel, with an optional reason. View a child's wallet and goals. Reward catalog: add a reward (title, cost), turn it on or off. Approve or deny redemption requests. | Counters: To approve, To decide, Coins awarded. Task list with status (Open, Waiting for your approval, Approved, Cancelled), recurrence badge and evidence photo. Empty states, including "Link a child first → Go to Family". Link to Digital Banking. | — |
| F4-K | — *Child task board* | (within F4) | Do chores and manage rewards. | Mark done. Add or replace a photo. "Sort your reward": split into Save / Spend / Share, optionally sending Save coins to a goal. New goal (title, LF Coins target, icon: star, game, toy, book, bike, trip, gift). Archive a goal. Redeem a catalog reward. | Chore list (To do, Waiting for approval, Ready to sort!, Cancelled). Wallet (Save / Spend / Share). Goals with progress and "Goal reached!". Rewards ("Not enough LF Coins yet"). My requests. Recent activity (earned, spent, adjustment). Chore streak. Link to Digital Banking. | — |
| F5 | **Digital Banking** | `/banking` | An educational banking simulation. It renders one of two views depending on role. | *See below.* | — | Parent or child only. |
| F5-K | — *Child banking home* | (within F5) | The child's account. | Freeze or unfreeze the card. Rename the account. Choose the card colour. Sort a pending allowance ("Your allowance arrived!") into Save / Spend / Share. View the monthly statement (previous/next month). Create or archive goals. Go to Tasks to redeem. | Account name, card design and number, Frozen badge ("You froze this card" / "A parent froze this card"), balances, spending limit ("{used} of {cap} used", weekly or monthly), ledger reasons (Allowance, "Bonus your family added"). Statement: earned, spent, saved, entries. "Your account isn't open yet" when none. | — |
| F5-P | — *Parent banking control panel* | (within F5) | Configure a child's account. | Choose a child. Open an account (nickname, card design). Freeze or unfreeze. Allowance: on/off, amount (1–1,000), every week / two weeks / month, day of week or month. Spending limit: on/off, resets weekly or monthly, cap. Savings bonus: on/off, percent (0–20%). Decide pending redemptions. | Current rules, spending status, redemptions awaiting a decision. The copy says the bonus is "not a bank interest rate". | — |

### 2.7 Profile and social domain (app shell)

| # | Screen | Address | Purpose | User actions | Data displayed | Guards |
|---|---|---|---|---|---|---|
| P1 | **My profile** | `/profile` | The user's own public identity and stats. | Edit the cover (10 colour presets). Edit the avatar. Claim a @username. Open settings. Copy an invite ("Follow me on LittleFounders… littlefounders.ai/@username"). Open followers and following. | Cover, avatar, name, @username, member since, Tutor badge. Learning stats (day streak, lessons completed, followers, following, XP points, minutes learned). Course badges earned ("Milestones you earned by completing every lesson in a course"). | Any signed-in user. |
| P2 | **Avatar editor** | `/profile/avatar` | Build a cartoon avatar. | Choose options per section (top/hair, hair colour, skin, eyes, eyebrows, mouth, facial hair, clothing, clothing colour, accessories). Randomize. Save (returns to the profile). Back. | Live preview. | Any signed-in user. |
| P3 | **Settings** | `/profile/settings` | Account preferences. | Name, username (3–20 characters a–z/0–9/_, which becomes littlefounders.ai/@you), language, date of birth, Save. Change email (new email plus current password; a confirmation link is sent). Change password (current plus new). Unblock blocked accounts. A guest banner "Browsing as a guest → Create my account". | Email (with pending-change notice), blocked accounts list. | Any signed-in user. |
| P4 | **My followers** | `/profile/followers` | Who follows me. | Open profiles. | List (name, @username, avatar). Empty state. | Any signed-in user. |
| P5 | **Who I follow** | `/profile/following` | Who I follow. | Unfollow. Open profiles. | List. Empty state. | Any signed-in user. |
| P6 | **Public profile** | `/@{username}` | Another user's profile. | Follow / Following (toggle). Block (a second tap confirms within 4 seconds; blocking returns the user to Learn). "Edit my profile" when viewing oneself. | Cover, avatar, name, @username, member since, Tutor badge, follower counts, learning stats, course badges. "This profile doesn't exist" (also shown when either party blocked the other). | Any signed-in user. An address that does not start with "@" redirects to Learn. Shown inside the app shell. |
| P7 | **Public followers** | `/@{username}/followers` | Another user's followers. | Open profiles. | List. | Same visibility rules as P6. |
| P8 | **Public following** | `/@{username}/following` | Who another user follows. | Open profiles. | List. | Same as P6. |

### 2.8 Staff console domain (app shell, "Staff" group)

All staff screens require the Admin or Superadmin role. For anyone else they are hidden (not shown as locked), and direct access redirects to Learn.

| # | Screen | Address | Purpose | Main actions | Data displayed |
|---|---|---|---|---|---|
| S1 | **Overview** | `/admin` | "Everything at a glance." | Quick navigation to every section. Review call to action. | KPIs: users, staff, courses live, lessons in review, lessons live, audit events. Content status. Role distribution. Service health summary. Learning-retention curves (first-attempt scores on review lessons by days since practice, and the weakest topics). |
| S2 | **Content** | `/admin/content` | "Manage courses and review kid-facing lessons before they go live." | Publish, unpublish (to draft) or archive a course. The publish action runs the release check, which explains refusals. Open course details. Open the lesson **review queue**: preview a lesson rendered in each language, inspect components and audio, **approve** (publish) or **reject** (return to draft). **Live tutor activities** queue: approve or reject AI-generated activities (answer keys visible), inspect the raw data. | Course table (title, slug, subject, status, structure counts, published lesson counts), hierarchy summary, lessons by status, review queue count, lesson metadata (difficulty, XP, duration, number of exercises, languages, schema version). |
| S3 | **Users** | `/admin/users` | "Everyone on the platform and their roles." | Search and filter. Change the timeline range and metric (daily or cumulative). | User list (name, username, locale, created, date of birth, roles). Statistics by role, locale and age. Signup timeline (signups, cumulative, daily average, peak, change). |
| S4 | **Emails** | `/admin/emails` | "Transactional email delivery history." | Refresh. Search and filter logs (text, status, template). Change the trend window. | Total sent, success and failure rates, pending, active templates, top locale, daily trend, log rows (recipient, subject, status, template, message id, time). |
| S5 | **Analytics** | `/admin/analytics` | "Platform analytics and service health." | Choose a period (Today, 7 days, 30 days, This month, 6 months, 12 months, This year, All time, Custom). Apply filters. Choose breakdown dimensions. Export reports (PDF, CSV, XLSX) for Marketing, Sales, Frontend or Full audiences. Export behavioural data (CSV, XLSX). Manage **internal traffic**: exclude this device, exclude detected staff addresses or networks, revoke an exclusion. | Web analytics (visitors, pageviews, bounce rate, visit duration, trend, breakdowns incl. a world map by country and region). Behavioural analytics on adult surfaces (pageviews, visitors, visits, bounces, average time, 13 dimensions). Coverage note on staff exclusion. "Audience — our own data" (daily sessions: anonymous, registered, staff). Usage. **System health** (monitored services, up/down, latency, uptime). |
| S6 | **Intelligence** | `/admin/intel` | "Consent-aware product, retention, and learning evidence for better decisions." Warehouse console. | Tabs: Home, Trends, Funnels, Learning, Retention, Segments, People, Experiments, Alerts, Settings. Create funnels, segments, experiments and alerts. Export to CSV or XLSX. | KPIs, trends, activation and custom funnels, cohorts and retention curves, learner skill states and content health, churn risk, anomalies, forecasts, paths, experiments with significance, staff-exclusion share. |
| S7 | **Generation** | `/admin/generation` | "How the agentic pipeline behaved on every course generation." | Tabs: Live Monitor, Run History, Analytics, Coach. Select a run. Compare two runs. Open slot details. | Live progress by stage (pending, planning, writing, judging, authoring, simulating, localizing, images, publishing, published, skipped), costs, tokens, images, a failure heatmap, judge rubric scores, durations, a timeline, and coach diagnostics. |
| S8 | **Insights** | `/admin/insights` | "First-party learning and usage signals." | Tabs: Overview, Acquisition, Learning, Sessions. Filters. Export raw events (CSV or JSON, paged). | KPIs, surfaces, exercise calibration, cohorts, activation funnel, velocity, drop-off, adoption, sessions, engagement, families and consent coverage. |
| S9 | **Audit log** | `/admin/audit` | "Append-only record of privileged actions." | Search. Filter by action, actor, subject and date. Page through. Open the detail modal. Copy the actor id. | Event id, time, action, actor, subject, detail. Totals, unique actors, top action, last event. |
| S10 | **Roles & Access** | `/admin/roles` | Grant and revoke roles and staff permissions. | Find a user (by name/username, at least 2 characters). Grant a role (parent, kid, bigfounder, admin, superadmin). Revoke a role. Grant or revoke permissions (manage users, manage content, view analytics, manage support). | Role holders with roles, permissions and last change. Counts. |

Notes:

- **S8 Insights** exists as a route but does **not** appear in the staff navigation menu. It is reached only by direct address.
- **S10** is visible only to Superadmins. Admins do not see it, and direct access redirects them to Learn.

### 2.9 System screens

| # | Screen | Address | Purpose | Actions |
|---|---|---|---|---|
| X1 | **Not found** | any unmatched address | Explains that the page does not exist. The address stays in the browser (no redirect). | Go back; Back to Learn (signed in) or Home. |
| X2 | **Screen failed to load** | any lazily-loaded screen | Shown when part of the app cannot download, typically after a new release while a tab was open. | Reload (fixes stale versions); Go home (Learn for the lesson player). |

### 2.10 Development-only screens (not in production builds)

Lesson Lab (every exercise type, with hearts on/off), Lesson View, 3D Scene Lab (asset budget measurement), Pose Lab (character animation library), Learn Lab per course, Audience Lab, Analytics Notices Lab, and Tutor Lab (tutor surfaces with sample data). None of these can be reached in production.

---

## 3. Navigation hierarchy (information architecture)

```
Public
├── Home (/)
├── How it works
├── Families
├── FAQ
├── Legal
│   ├── Terms & Conditions
│   └── Privacy Notice
├── Badge landing (/badge/{token})            [shared-link only]
└── Authentication
    ├── Login ── Forgot password ── (email) ── Reset password
    ├── Sign up ── (email confirmation) ── Verify parent
    └── Google sign-in ── OAuth callback

First run (guest)
└── Onboarding ── Upgrade account (optional)

Signed-in app shell
├── Learn
│   ├── Course path
│   │   ├── Placement quiz (full-screen, one time per course)
│   │   ├── Territory map
│   │   └── Lesson player (full-screen)
├── AI Tutor (full-screen stage: personalize / offers / conversation / closing / replay / map / plan)
├── Tasks            [parent: parent board | kid: child board | others: locked → Verify parent]
├── Banking          [parent: control panel | kid: banking home | others: locked → Verify parent]
├── Family           [parent only | others: locked → Verify parent]
│   ├── Child territory
│   └── Child tutor conversations
├── Profile
│   ├── Avatar editor
│   ├── Settings
│   ├── Followers
│   └── Following
├── Public profiles (/@username, /followers, /following)
└── Staff (admin & superadmin only; hidden otherwise)
    ├── Overview
    ├── Content (+ review queue, live tutor activities)
    ├── Users
    ├── Emails
    ├── Analytics (+ system health, internal traffic)
    ├── Intelligence
    ├── Generation
    ├── Audit log
    ├── Roles & Access (superadmin only)
    └── Insights (not in menu)
```

**Primary navigation (sidebar or tab bar), in order:** Learn, AI Tutor, Tasks, Banking, Family, Profile.

- Items needing a role the user lacks are shown **locked**, with a "Tutor" badge and the hint "Verify your identity to unlock this as a Tutor — tap to start". Tapping opens Verify Parent.
- Tasks and Banking unlock for **either** a parent or a child. Family unlocks only for a parent.
- The Staff group is appended for Admin/Superadmin.

---

## 4. Entry points, exit points and redirect rules

### 4.1 Entry points

| Entry | Lands on |
|---|---|
| Organic/direct visit | Home (prerendered page in the visitor's language) |
| Marketing campaign or badge share link | Badge landing (shared links), or any public page. First-landing campaign tags are captured once (with consent). |
| Email confirmation link | The authentication server confirms, then returns to the app |
| Password recovery link | Reset password |
| Email-change confirmation link | Settings |
| Google sign-in | OAuth callback, then Learn |
| Returning signed-in user | Any bookmarked app address (the session is restored from browser storage) |
| Child | Login with username and passphrase, then Learn |

### 4.2 Guards and redirects (evaluated in this order where they stack)

| Rule | Condition | Result |
|---|---|---|
| Restoring session | Session not yet read from storage | Nothing is shown (avoids a flash of the wrong page) |
| Requires sign-in | No session | Redirect to Login, remembering the requested address and state. After login the user returns there. |
| Guest-only pages | Real (non-guest) session opening Login, Sign up or Forgot password | Redirect to Learn |
| Requires onboarding | Guest session that has not completed onboarding, opening any app-shell screen, Placement or AI Tutor | Redirect to Onboarding |
| Onboarding already done | Completed user opening Onboarding | Redirect to Learn |
| Upgrade for non-guests | Real account opening Upgrade account | Redirect to Learn |
| Role gate | Missing the required role for Tasks, Banking, Family, family sub-screens or staff screens | Redirect to Learn |
| Placement gate | Course (or lesson) whose placement quiz was not taken | Course path and Lesson player redirect to Placement |
| Placement already done | Placement opened after committing | Redirect to the course path |
| Placement committed | Commit succeeded | Open the starting lesson (or the course) |
| Signup success | Parent-intent checked | Verify parent. Otherwise Learn. |
| Onboarding finished | "Create my account" | Upgrade account. "Later": Learn. |
| Public profile address | Not starting with "@" | Redirect to Learn |
| Blocking a user | After blocking from their profile | Redirect to Learn |
| Sign-out | Any | Session and local lesson checkpoints cleared, go to Home |
| Lesson exit | From the player | Back to the originating course if known, otherwise Learn |
| Unmatched address | Any | Not-found screen (no redirect) |

### 4.3 Exit points

- **Sign out** (sidebar) clears the session, the cached course shelf and the lesson recovery checkpoints, and returns to Home.
- **Leave** (AI Tutor) and **Exit lesson** (player) return to the app shell.
- **External exits:** support email links, legal pages, and native share sheets for badges and profile invites.
