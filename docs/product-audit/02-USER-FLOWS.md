# 02 — User Flows

This document describes every user journey the platform supports. For each flow it gives the actors, preconditions, steps, decision points, postconditions, error states and edge cases.

**Conventions**

- *Learner* means any signed-in person using learning features: guest, universal adult or teen, child, or parent.
- *Parent (Tutor)* means an account holding the verified parent role. *Child* means an account holding the kid role.
- Server messages are quoted where the user sees them.
- Every error is returned with a stable code, which the app translates into a friendly message (see 04 for the full code list).
- **Billing / subscription:** the platform has no billing, payment, subscription or plan-management flow. The product is free ("Free to start. Free to stay."). No payment data is ever requested.

---

## A. Visitor and acquisition flows

### A1. First visit and cookie consent

- **Actors:** anonymous visitor.
- **Preconditions:** none.
- **Steps**
  1. The visitor opens a public page. Public pages are served prerendered in the visitor's language for search engines and link previews. The app then takes over.
  2. The app asks the Core API whether this visitor's network is excluded from analytics (internal staff traffic) or looks like a bot. The answer is cached for the browser session. An exclusion is also remembered on the device.
  3. The consent banner appears with three categories: **Necessary** (always on), **First-party attribution** (an anonymous identifier), and **Optional measurement** (privacy-focused analytics plus, when enabled, Google Analytics).
  4. The visitor chooses **Accept optional**, **Reject optional**, or **Configure preferences**.
- **Decision points**
  - *Accept:* a consent cookie is stored for 400 days. An anonymous visitor identifier is created (400 days). The campaign/referrer context of the first landing is captured. Web analytics (Plausible, Google Analytics) and behavioral analytics (Umami) start on marketing pages. The first-party beacon records page views, call-to-action clicks, scroll depth (25/50/75/100%) and session end.
  - *Reject:* the refusal is stored. Any existing visitor identifier and Google Analytics cookies are deleted. Nothing optional loads.
  - *Excluded network, bot or automated browser:* no tracker loads and events are silently dropped, regardless of consent.
- **Postconditions:** the consent choice persists. It can be reopened from "Cookie preferences" in the footer.
- **Edge cases:** if the exclusion check is unavailable, the device's previous exclusion decision is kept; otherwise the visitor is treated as not excluded. A per-device analytics opt-out also exists and blocks all trackers on that browser.

### A2. Start free as a guest

- **Actors:** anonymous visitor (any age).
- **Preconditions:** no real session in this browser.
- **Steps**
  1. The visitor presses **Start free** on the Home, How it works or Families page (a marketing goal "guest_start" is recorded with consent).
  2. The app asks Core to create a guest session. The authentication server creates a real but anonymous user.
  3. The database automatically creates a profile with an empty name, the **universal** role, and zeroed learning statistics.
  4. The app stores the session tokens in the browser and opens **Onboarding** (C1).
- **Alternative paths**
  - If a session already exists, the button reads "Continue where you left off" and opens Learn.
  - "I already have an account" opens Login. "Sign up" opens Signup.
- **Error states:** guest creation fails ("We couldn't start your session, please try again") when the authentication server is unreachable or the account-creation rate limit is exceeded (30 per 15 minutes per network).
- **Edge cases:** no data is collected at this step. A guest is a full account from the platform's point of view, and it keeps all progress if later upgraded (B8).

### A3. Open a shared achievement badge

- **Actors:** anyone who receives a badge link (typically a relative or friend).
- **Preconditions:** a parent created a badge share (F5).
- **Steps**
  1. The recipient opens `/badge/{token}?utm_campaign=badge-share`. Link-preview crawlers receive a page title and image showing the child's first name and achievement.
  2. The page loads the badge publicly (first name, achievement type, label, image). No sign-in is needed.
  3. A "badge link clicked" acquisition event is recorded, with consent. The campaign tag becomes the visitor's first-landing attribution.
  4. A call to action invites the visitor to start.
- **Error states:** an unknown or malformed token shows "not found".
- **Privacy:** the only personal data exposed is the child's first name (the first word of their display name, at most 40 characters). There is no surname, age or photo.

---

## B. Identity and access flows

### B1. Adult email signup

- **Actors:** visitor or guest who wants a permanent account.
- **Preconditions:** no real (non-guest) session. A guest may still sign up for a *different, new* account, but the upgrade flow (B8) is the path that keeps guest progress.
- **Steps**
  1. Open **Sign up**. Enter name (1–80), email, password (8–128), date of birth, and optionally tick "I'm a parent or legal guardian".
  2. Core validates the input and computes the age in whole calendar years.
  3. **Age screen:**
     - age ≥ 120 or an impossible date → "That date of birth is not valid".
     - age < 13 → refused with the code for "An adult has to create this account". The page switches to "An adult has to create this one", offering **Keep going without an account** (starts a guest session, A2).
     - age ≥ 13 → continue.
  4. The date of birth is **discarded**. It is never stored or forwarded.
  5. Core asks the authentication server to create the user, passing the name, locale and parent intent as account metadata. The database creates the profile (name from the metadata), the **universal** role and the learning statistics.
  6. If the visitor had an anonymous visitor identifier (consent given), the signup is **attributed** to that visitor's acquisition source (first conversion wins; never for children).
  7. **Branch — email confirmation:**
     - *Auto-confirm enabled:* a session is returned and the user is signed in.
     - *Confirmation required:* no session is returned. The page shows "Check your inbox — We sent a confirmation link to {email}". The authentication server sends the confirmation email through the platform's mail relay.
  8. Funnel events are recorded (signup start, submit and complete) if analytics is allowed.
  9. **Navigation:** parent intent → Verify parent (B11); otherwise → Learn.
- **Postconditions:** a universal account exists. Parent intent is only a recorded wish; it grants nothing.
- **Error states:** email already registered; invalid input; too many attempts (30 per 15 minutes per network); authentication service unreachable.
- **Edge cases**
  - Signing up does not complete onboarding (onboarding applies only to guests).
  - The chosen locale is kept only as identity metadata. The profile's language of record starts as **English (US)**, and the app shell switches the interface to that language on the first visit until the user picks another language (see 03 and 09).

### B2. Login

- **Actors:** any account holder, including children.
- **Steps**
  1. Open **Login** and enter an **email or username**, plus a password.
  2. An identifier without "@" is treated as a **child username**. Core converts it to the child's internal sign-in address (a non-deliverable synthetic address derived from the username).
  3. The authentication server validates the credentials and returns a session. The browser stores it.
  4. The app loads the user's profile, roles, avatar, onboarding state and analytics permission.
  5. The user is sent to the page that originally required sign-in, or to Learn.
- **Error states:** wrong credentials ("That email and password don't match"); email not confirmed ("Confirm your email first"); too many attempts (10 per 15 minutes per network, shared with other credential operations); service unreachable.
- **Edge cases**
  - A guest session may open Login to switch to an existing account. Doing so replaces the guest session; guest progress is not merged.
  - An empty identifier is rejected.

### B3. Google sign-in

- **Preconditions:** Google is enabled on the authentication server. The button appears only when Core reports the provider as enabled.
- **Steps**
  1. **Continue with Google** → Core returns the provider authorization address → the browser goes to Google → then to the authentication server → then to `/auth/callback`, carrying session tokens.
  2. The callback page establishes the session and loads the profile.
  3. Core reports whether the account was created within the last 2 minutes. The app records either "signup complete" or "login complete".
  4. Navigation → Learn.
- **Postconditions:** a new account gets its display name from the Google profile name, the universal role and zeroed statistics. **No age screen applies** to Google signups.
- **Error states:** "Sign-in didn't finish — We couldn't complete your sign-in" with a link back to Login.

### B4. Session refresh and expiry

- Access tokens are refreshed automatically when fewer than 60 seconds of validity remain. Concurrent refreshes are de-duplicated.
- An expired or invalid refresh token ends the session ("Session expired — sign in again"). The user is treated as signed out and protected screens redirect to Login.
- A temporary failure keeps the current session so the next call can retry.
- Refreshes count against the credential rate limit.

### B5. Logout

- **Steps:** Sign out → the app clears the session, the cached course shelf and all lesson recovery checkpoints, then asks Core to revoke the session (best effort) → Home.
- **Edge case:** logging out clears lesson checkpoints for every learner on that device, to prevent cross-account leakage.

### B6. Password recovery

- **Steps**
  1. **Forgot password** → enter email → Core asks the authentication server to send a recovery email. The link returns to `/reset-password`.
  2. The page always says "If {email} has an account, we sent a link", so account existence is never revealed.
  3. The user opens the email link. The authentication server verifies it and returns to **Reset password** with a special recovery session.
  4. The user enters a new password (at least 8 characters). Core accepts it **only** if the session was created by a verified recovery/one-time link. An ordinary session is refused.
  5. Done: "Password updated" → "Go to sign in".
- **Error states:** the link is invalid or expired ("Link expired" → "Request a new link"); the session was not established by a recovery link (forbidden); rate limit exceeded (10 per 15 minutes).

### B7. Change password and change email (Settings)

- **Change password:** current password plus a new one (8–128). Core re-verifies the current password by performing a real sign-in, then updates it. Wrong current password → "Current password is incorrect".
- **Change email:** new email plus current password (re-verified). The authentication server sends a confirmation link to the new address, and the address changes only after confirmation. The UI shows "Confirm the change from the link we sent to {email}". The confirmation returns to Settings.
- Both operations use the credential rate limit.

### B8. Upgrade a guest to a permanent account ("Save your progress")

- **Preconditions:** a guest session.
- **Entry points:** onboarding step 5 "Create my account"; the Settings guest banner.
- **Steps**
  1. Enter email and password (at least 8).
  2. Core attaches the email and password to the **same** user identity, so all progress, streaks and profile data carry over. It then refreshes the session so it is no longer marked as a guest.
  3. The signup is attributed to the visitor's acquisition source (if a consented visitor identifier exists).
  4. Navigation → Learn.
- **Alternatives:** "Not now" → Learn. "Log in instead" → Login (switching accounts; guest progress is not merged).
- **Error states:** the account is not a guest ("This account already has a permanent identity"); email already in use; the email/password was attached but the session refresh failed ("sign in again"); rate limit exceeded.
- **Edge case:** **no age screen applies to the guest-to-account upgrade.** The guest path is the one offered to under-13s refused at signup.

### B9. Onboarding — see C1

### B10. Child sign-in

- Children do not sign up. A parent creates their account (F1). The child signs in with the **username** and **passphrase** the parent chose, on the regular Login page (B2).
- The parent can reset the child's passphrase at any time (F2). The Settings screen applies no role distinction, so a signed-in child can also change their own password (knowing the current one), request an email change, and edit their profile username (see I1). The username the child signs in with never changes, because it is tied to the account's internal sign-in address.

### B11. Become a Tutor (guardian identity verification)

- **Actors:** a signed-in adult (universal role).
- **Entry points:** after signup with parent intent; the "Become a Tutor" upgrade card; any locked navigation item.
- **Preconditions:** the account does not already hold the parent role.
- **Steps**
  1. The intro screen lists three steps: type details → photograph the ID → the photo is never stored. "I am ready".
  2. Enter given name(s), surname(s) and date of birth (the applicant must be 18 or older), choose the document type (national ID, passport, driver's license), and attach a photo (JPEG/PNG/WebP, up to 8 MB).
  3. Core forwards the typed data and the image to the **Guardian** service, which keeps nothing.
  4. Guardian reads the image with on-premise OCR (Spanish, English, Portuguese) and runs four checks:
     - **Document readable:** at least 40 characters of text, including at least 25 letters.
     - **Name matches:** every name word of 3 or more letters appears in the document. Words of 5 or more letters tolerate one character difference.
     - **Date of birth matches:** the date appears in any common format, including month abbreviations in all three languages.
     - **Not expired:** a date or year that is not the birth year appears, is not in the past, and is within 40 years.
  5. **Branch — verified (all four checks pass):** Core stores a verification record (names, date of birth, document type, the four check results) and grants the **parent** role. The role grant is logged automatically in the audit log. The UI shows "You're a Tutor now!"
  6. **Branch — not verified:** an audit entry "parent verification failed" is written with only the true/false check results. The UI lists each failed check with advice, offers a retry, and after repeated failure shows "Write to us".
- **Error states:** already verified; more than **5 attempts per hour** per user; image missing or of the wrong type; "We couldn't read that photo" (document unreadable); verification service unavailable (never treated as a pass).
- **Postconditions:** the parent role unlocks Family, Tasks and Banking.
- **Edge cases**
  - The image is processed in memory by both services and never written anywhere.
  - Document type is recorded but not checked against the image.
  - A stored verification can technically be marked "revoked", but no flow does this.

---

## C. First-run flows

### C1. Guest onboarding

- **Preconditions:** a guest session that has not yet completed onboarding. Guests are forced here from any app screen until they finish.
- **Steps (each narrated by a mentor with optional voice)**
  1. **Welcome** (Dina): "Get started".
  2. **Name** (Liruf): required, 1–80 characters.
  3. **Date of birth:** optional. It must be a past date after 1900. It is stored on the profile and later used for age-appropriate content, the tutor's age band, and placement eligibility.
  4. **How did you hear about us?** (Dr. Rho): optional. Friend/family, social media, internet search, app store, school, ad, or somewhere else.
  5. **Save your progress?** (Zara): "Create my account" or "Later".
- **On completion:** Core saves the name and date of birth, starts or continues the **day streak** (day 1 for a new learner, using the learner's calendar date), and records the onboarding answers. The onboarding record is written last so a partial failure can be retried safely.
- **Navigation:** "Create my account" → Upgrade account (B8). "Later" → Learn.
- **Error states:** onboarding already complete; the service was unable to save (retry).
- **Edge cases:** real (non-guest) accounts are never sent to onboarding, whatever their age.

---

## D. Learning flows

### D1. Browse the course shelf

- **Steps**
  1. Open **Learn**. Core returns every published course with lesson count, adventure count, progress (passed/total, where lessons skipped by placement count as passed), badge art, subject and the "still being built" flag.
  2. The app features the first course in progress (otherwise the first unfinished course), and loads that course's current chapter to offer "Continue lesson n".
  3. The learner opens a course (a "course opened" event is recorded).
- **Error states:** if a single course cannot be assembled it is silently dropped from the shelf. If all fail, the shelf shows an error rather than an empty list.
- **Edge cases:** track filters (Entrepreneurship, Financial Literacy, Saving & Investment) appear only when more than 6 courses are published.

### D2. Course path and unlock rules

- **Lesson states** are computed only by the server, using the global order: adventure → saga → topic → lesson position.
  - *Passed:* the learner passed it, or it was skipped by placement.
  - *Current:* the first lesson that is not passed.
  - *Available:* a lesson before the current one that is not passed (only possible if content was reordered after progress existed).
  - *Locked:* everything after the current lesson.
- **Adventure states:** locked until every lesson of the previous adventure is passed; then available; completed when all its own lessons are passed.
- **Topic states (territory map):** not started, in progress, completed, and **review due** (a completed topic cited by a *review topic* whose lessons are not all passed yet).
- **Placement gate:** until the learner commits the course's placement quiz, the course is marked "placement required". Opening the course or any of its lessons redirects to Placement.

### D3. Course placement quiz

- **Actors:** any signed-in learner who has completed onboarding.
- **Preconditions:** a published course that has not been placed yet.
- **Steps**
  1. **Welcome:** "Let's find your starting point", or **"I'd rather start from scratch"** (skips the quiz and commits the start of the course).
  2. **Optional conversational intake.** Offered only if the learner's **stored** date of birth shows an age of 12 or more (unknown ages never see it). The learner writes "What do you already know about this?" (up to 4,000 characters), or chooses "Just ask me questions instead". Core converts the date of birth to an **age band** (12–14, 15–17, 18+) and sends the text, the course outline and the band to the AI Tutor Runtime. The runtime returns a *prior* (the estimated fraction of the course already known) and a short reflection. Any failure silently falls back to the questions.
     - *Safety branch:* if the text is flagged as harmful (for example self-harm or abuse disclosure), the learner sees the same neutral response, but a **placement safety flag** (category and severity only, never the text) is stored and becomes visible to the child's guardian.
  3. **Self-reported signals** (optional): claimed level (new/some/confident), education level (preschool to adult), age.
  4. **Adaptive questions.** The server holds no quiz state; the client resends all answers at every step. The server picks the next topic probe with a binary search over the course's teaching topics. The signals and the intake prior only choose where the **first** question lands. At most 10 questions are asked, including 2 confirmation questions below the estimated frontier. A wrong answer always outweighs a right one ("I don't know this yet" counts as wrong). Answers are graded on the server against keys the client never sees.
  5. **Result:** "You're starting further in", with "We're skipping n lessons you've already got" and "Topic x of y", or "You're starting from the beginning". A note appears when a hard prerequisite capped the placement.
  6. **Adjust (optional):** "This feels too advanced" → "A bit earlier" / "From the beginning" / "Leave it as it is". Moving later than the earned position is impossible; the server clamps it.
  7. **Commit:** the server recomputes the result from the answers, stores the placement, stores a **placement credit** for every skipped lesson, and saves the date of birth if it was newly given. The app opens the starting lesson.
- **Postconditions:** credited lessons count as passed for unlocking, progress bars and course badges, but earn **no XP** and create no lesson progress.
- **Error states:** placement already complete (the user goes to the course); course not found; content unreachable; "Could not record placement".
- **Edge cases / current-state observation**
  - A course with no placement questions authored places everyone at the start ("no probe content" method).
  - The data store accepts only three placement methods: "quiz", "claimed beginner shortcut" and "no probe content fallback". The commit step produces four: "adaptive quiz", "learner chose start", "learner adjusted" and "no probe content fallback". Only the last one is accepted, so commits of the other three kinds would be refused when stored, and the learner would receive "Could not record placement". Placement credits are written only after the placement record succeeds.

### D4. Play a lesson

- **Actors:** a signed-in learner (onboarding not required, so deep links work).
- **Preconditions:** the lesson is unlocked and the course placement is done.
- **Steps**
  1. **Load.** Core returns the lesson in the learner's profile language (falling back to Spanish (Mexico), then to any available language). Answer keys are removed. The response includes the narration audio manifest.
  2. **Recovery.** The player creates, or restores, a per-learner, per-lesson checkpoint in the browser tab: the segments reached, the run identifier, the elapsed time, and any pending completion. If the lesson content changed, the checkpoint is discarded.
  3. **Intro:** estimated minutes and number of challenges → "Start lesson" (a "lesson started" event).
  4. **For each segment (exercise):**
     - The learner views the segment, answers, and presses **Check**.
     - **Hints** (up to 2 per segment) can be revealed before answering. Each revealed hint reduces the segment's score by the lesson's hint penalty (10% per hint by default, compounding).
     - Core grades the answer **on the server** with the segment type's grader. It records the attempt atomically: attempt number, score, hints, time spent, skill (course/topic) and a diagnostic code (initial incorrect / hint assisted / retry recovery).
     - **Attempts:** each segment allows the lesson's maximum (2 by default, up to 3) per play-through ("run"). While attempts remain, "Try again" is offered and the correct answer is **withheld**. Once attempts are exhausted, the correct answer may be revealed and further attempts are refused ("No attempts left for this question").
     - **Retries after network loss:** re-submitting the same attempt number within the same run returns the original verdict. It never grants an extra attempt, and a changed answer is ignored.
     - **Hearts (optional per lesson):** if the lesson defines 1–5 hearts, each final wrong answer costs one heart. At zero hearts the lesson ends as failed.
     - Story/content segments have no grading. They just continue.
     - Unsupported segment types show "This exercise needs a newer version of the app" and can be skipped without affecting the score.
     - Feedback appears as perfect / great / almost / try again, with a combo counter and optional audio replay.
  5. **Completion.** When the lesson ends, the player sends the elapsed seconds, the learner's **local calendar date** and the run identifier. Core then:
     - Recomputes the score from the recorded attempts of **this run**: an XP-weighted average of each graded segment's best score. Ungraded segments count 0. Lessons with no graded weight score 100.
     - Marks the lesson **passed** if the score meets the pass threshold (70 by default).
     - Stores it atomically: best score, passed flag, attempt count, highest XP earned, and completion time. Learning statistics are updated (XP **only for improvement over the previous best XP**, minutes with a minimum of 1 per completion, lessons completed +1 only on the first pass, and the day streak).
     - **Streak:** a pass on the same local day keeps the streak; the next day adds 1; any gap restarts at 1. The longest streak is tracked.
     - Retrying the same run returns the original result ("replayed") without double-counting.
  6. **Results screen:** "Lesson complete!" or "Good effort!", score out of 100, XP earned, time, day streak, best streak, "Today's superpower" (the strongest exercise family) and "Your next quest" (the family to improve). A full-screen **streak celebration** appears on the first pass of the day.
  7. **Server-side events** (subject to consent): "lesson complete" on every passing non-replayed run, "first lesson complete" on the learner's first-ever pass, and "streak extended".
  8. **Finish** → back to the course (or to Learn).
- **Alternative paths:** **Exit lesson** at any time. A "lesson abandoned" event with seconds spent is recorded if the lesson was not completed.
- **Error states:** lesson locked; placement required (redirect); lesson not found; content service unreachable; segment cannot be graded; "We couldn't check your answer right now" (grading unavailable); "Your progress has not been confirmed as saved. Keep this screen open and try again" (completion failure, retry with the same run).
- **Edge cases**
  - Replaying a passed lesson shows **this run's** score, while the course keeps the best.
  - Answers typed into an unfinished exercise are not saved in the checkpoint.
  - Closing the tab loses the checkpoint.
  - The server never trusts client-reported scores.

### D5. Earn a course badge

- A course badge is earned when **every non-archived lesson** of a published course is passed, or credited by placement. The completion date is the latest pass or credit.
- Badges appear on the learner's profile ("Course badges"), on their public profile, and can be shared by a parent (F5).

---

## E. AI Tutor flows

### E1. Personalize the tutor

- **Steps:** on first entry (or via "My island") the learner chooses a tutor character (Dina, Liruf, Rho, Zara); optionally a **companion** character, which must differ from the tutor; an island (two dioramas); the lighting (auto, dawn, day, dusk, night); a **nickname** (1–24 letters/digits/spaces/'/_/-); and **adaptations** (slower pacing, more examples, less text, more visual, repeat before advancing).
- **Rules:** a nickname that contains any word of 3 or more letters from the learner's real display name is rejected ("A nickname may not be your real name"). The nickname is the only name-like value ever sent to the AI model. Without one, the tutor uses a neutral word ("Explorer").
- **Postconditions:** preferences are saved on the server, and the picker is no longer forced on later visits.

### E2. Start a tutor session

- **Preconditions:** signed in and onboarded (guests included).
- **Steps**
  1. The offers screen loads. Core checks:
     - The runtime's health ("preflight"): the language model is reachable, moderation is ready (**required** for children), and the voice provider is available.
     - The **daily session cap:** **2 sessions per local calendar day**. The "day" follows the learner's language region: Mexico City, São Paulo or New York time. Staff are exempt.
     - Voice eligibility. For children this requires an **active guardian microphone consent** and a platform policy allowing voice for minors (**off by default**).
  2. The offers shown are: continue the last session's topic; the learner's courses; up to 3 **weak skills** (only where the learner has at least 3 pieces of evidence and low uncertainty); a diagnostic "Where to start"; 4 fixed FAQ questions; and an open chat.
  3. The learner picks one (optionally ticking "talk out loud").
  4. Core validates the intent. FAQ must name one of the 4 fixed questions. A weak skill must exist in the knowledge graph. Other intents cannot carry a skill. Core re-runs the preflight, then atomically checks the daily cap and creates the session with the age tier (from the stored date of birth: 7 or younger → 1; 8–9 → 2; 10 or older → 3; unknown → 2), the character, companion, island, intent and voice decision.
  5. Core returns a single-use **socket address** valid for 60 seconds. The app opens the live connection (E3).
- **Error states and messages:** the tutor is unavailable ("The tutor is resting"); moderation is unavailable ("We can't start safely right now"); daily cap reached ("You've used today's tutor time. Come back {time}", with the exact reset time); rate limited; invalid skill; unable to read preferences or profile.
- **Voice outcomes:** microphone blocked by policy ("Talking out loud isn't ready yet, while we finish the safety paperwork. You can still type"); consent required ("A grown-up needs to turn the microphone on for you"); voice unavailable. The session always works by typing.

### E3. Live conversation (text or voice)

- **Connection:** the runtime admits the socket only if, in order:
  1. the runtime is below its concurrent-session limit (200 per instance);
  2. this network has not exceeded 100 connection attempts per minute;
  3. a token is present and is not a regular sign-in token;
  4. the signature is valid, the token is unexpired and has not been used before;
  5. the session exists and belongs to that user;
  6. moderation is available for the audience;
  7. the microphone is allowed at this moment.

  A session can have only one live connection. Refusals close the connection with a named reason: unauthorized, session not found, consent required, budget exhausted, already connected, service degraded, or daily spend ceiling reached.
- **Greeting:** the tutor greets the learner by nickname, using its knowledge of previous sessions (up to 3 recent session summaries and the curated memory note) and the session plan.
- **Each learner turn**
  1. The learner types (up to 2,000 characters per message; the runtime considers the first 600) or speaks (audio is sent whole or streamed in chunks and transcribed by the voice provider; the transcript is shown back).
  2. **Input safety classification** (deterministic, three languages):
     - self-harm → the session is **stopped** (high severity);
     - abuse disclosure → stopped (high);
     - grooming pattern (for example "don't tell your parents", "meet me alone") → stopped (high);
     - adult content → a scripted redirection (medium);
     - personal data (address, phone, email, "my school is…") → the turn is blocked (medium);
     - prompt-injection attempt → handled.

     Each triggers a guardian-visible **safety flag**.
  3. The input is wrapped as untrusted data. If the learner answered a number question, the answer is **checked deterministically**, and the tutor is told whether it was right, so it cannot praise a wrong answer. Requests like "do you remember…" pull verbatim excerpts from the learner's own past conversations (safety-flagged turns excluded).
  4. The **pedagogy controller** picks a teaching strategy (direct, worked example, faded, Socratic, fluency, spaced, probe, remediate, rescue, elaborate, transfer, celebrate), changing strategy at most 3 times per minute.
  5. The **language model** writes the tutor's reply: speech, emotion, gesture, next step (ask, activity, close), and optionally a whiteboard, a demonstration, a roleplay scene or a pointer.
  6. **Output moderation:** deterministic checks (no leaked instructions, no contact details), then an independent AI judge checking for sexual content, violence, self-harm, hate, dangerous instructions, personal information, secrecy, contact details and off-platform redirection, including multi-turn "crescendo" patterns. A refused reply is replaced by a scripted line and flagged. For children, if the judge cannot answer, the reply is refused. For other accounts, the deterministic checks are then sufficient.
  7. **Speech:** pre-generated audio, then cached audio, then new synthesis. Word timings drive the captions and lip-sync.
  8. Every turn is recorded (text, speaker, emotion, gesture, audio location, source, moderation result, whiteboard, demonstration, roleplay, pointer).
- **Activities:** when the tutor asks for an activity, the runtime requests one from Core's **content ladder**:
  1. an exercise from a **published lesson** on that skill (free and human-approved);
  2. a **curated bank** pack published by a human;
  3. otherwise the runtime **generates** one live with the language model. An independent judge must approve it, then Core **re-executes the real graders** to verify the answer key. A sample (15% by default) is queued for staff review.

  Repeats within a session are avoided. The activity appears in a side panel.
- **Adaptation offers:** the tutor may offer an adaptation (for example "slower pacing"). The learner answers "Yes please" or "No thanks"; declining is not recorded against them.
- **Budget:** at 15 minutes the tutor starts wrapping up ("wrapping up"). At 25 minutes, or after 120 turns, the session ends. After 10 idle minutes the connection closes. Staff: 8 hours / 5,000 turns.
- **Controls:** interrupt the tutor; edit the last message (the previous exchange is replaced); "Explain differently"; start over; finish.

### E4. Grade a tutor activity and award XP

- **Steps**
  1. The learner submits an answer to the activity (attempts 1–3, hints 0–2).
  2. Core grades it: 10% penalty per hint. The stored score **never decreases** across retries. The attempt number is derived on the server.
  3. **XP:** paid only if the activity's answer key was independently verified. It never exceeds the activity's own worth across all gradings, and is capped at **120 tutor XP per local day**, applied atomically.
  4. If the activity is linked to a knowledge component, the attempt updates the learner's **mastery model**: probability known, misconception detection, and the spaced-repetition due date. This is skipped if the answer was already checked by voice, or if the grader failed.
  5. The result returns to the runtime with a signed receipt, so the tutor reacts to the verified result ("Exactly right!" / "Nice work!" / "So close. Look again." / "Let's try that one together.").
- **Voice answers:** for number, count, estimate and coin/change activities, a spoken answer can be checked directly ("voice check") and recorded as evidence once.
- **Edge cases:** an unverifiable live activity is "practice only, so no XP this time". A grader error scores 0, allows a retry, and is logged without affecting mastery.

### E5. End a session and post-session memory

- **End reasons:** completed; soft budget; hard budget; learner left; abandoned (connection dropped and not resumed); consent revoked; safety stop; error. Only the first close counts.
- **Close steps:** the session's turn count, activity count and cost are recorded. A short **summary** (topic, skills, outcome, graded correct/total) is stored for the "continue" offer and for guardian narratives.
- **Post-session review:** the AI reads the transcript and proposes an updated **learner note** (up to about 1,300 characters) and a **pedagogy note** (up to about 2,100 characters).
  - Adults and guests: both notes are written, with a hash ledger of every change.
  - **Children:** the pedagogy note is written, but the learner note is **parked for guardian approval** (E8).
- **Safety stop screen:** "We stopped here — Go find that grown-up now."
- **Retention:** each session is scheduled for deletion **90 days** after it started, including its turns, activities, flags and session audio (see 08).

### E6. Resume after a dropped connection

- If the connection drops, the runtime keeps the conversation **parked for 90 seconds**. The app asks Core for a fresh single-use socket token for the same session (owner only, never a guardian), and reconnects. The transcript continues from where it stopped.
- If the session already ended: "This session has already ended" (then start a new one).
- If another tab holds the session: "You're already talking to me somewhere else."

### E7. History, replay, map, plan and notebook

- **History:** a list of the learner's own sessions, with replays (turn-by-turn playback with the original audio where available, activities, "talk instead").
- **Learning map:** the knowledge-component graph showing mastered, in-progress, review-due, available and locked skills; "Continue: {skill}" / "Review: {skill}"; "n things to review today". Read-only during a session.
- **Plan:** the tutor may save a learner plan (for example a savings plan). It is viewable by the learner and their guardian.
- **Notebook:** the learner taps "keep" on a whiteboard drawn in their own session. The board is copied to their notebook (verified against the real turn).

### E8. Guardian oversight of the AI Tutor

- **Actors:** a parent with a verified link to the child.
- **Steps**
  1. Family → the child → "Read tutor conversations".
  2. See sessions (30 per page, "Load older"), each with a plain-language end reason and a narrative computed without AI ("Practiced X", "Found X tricky at first, but worked through it", "Answered 3 of 5 activities correctly"), in the **guardian's** language.
  3. Open any transcript in full.
  4. **"Worth your attention":** safety flags sorted by urgency, including flags raised during placement intake (no transcript exists for those).
  5. **Memory approval:** see the current tutor note and each suggested replacement side by side, then **Approve** or **Reject**. If another suggestion was approved first, a stale suggestion is marked "Out of date" and cannot be applied. Two guardians deciding at once cannot both apply.
  6. **Microphone consent:** "Allow the microphone" requires confirming the exact consent wording shown (stored verbatim, with its language). It is refused while the platform policy blocks voice for minors ("We're not offering the microphone to children yet"). "Turn the microphone off" is always possible, both for the guardian and for the child themselves.
- **Postconditions:** approved notes are used by the tutor from the next session. A revoked microphone consent stops voice on the next connection check.

---

## F. Family management flows

### F1. Create a child account

- **Actors:** a parent (Tutor).
- **Preconditions:** fewer than **10** children linked.
- **Steps**
  1. Family → **Add a child**. Enter the first name (1–80), a username (3–20, lowercase a–z, 0–9, _), a passphrase (8–72), an optional date of birth, and the language.
  2. Core checks the child limit and that the username is free.
  3. A child user is created with a synthetic, non-deliverable sign-in address derived from the username. **No email, surname or address is collected.**
  4. A **verified guardian link** (parent → child) is created. The child's profile is set (username, name, language, date of birth). The **kid** role is granted. If any step after creation fails, the child user is deleted again and the rollback is audited.
  5. The audit log records "child created" with no personal detail.
  6. "All set — {name} can sign in with the username {username} and the passphrase you chose."
- **Error states:** child limit reached; username taken; validation error; data store unavailable.
- **Edge cases:**
  - The kid role cannot exist without a verified guardian link (enforced by the data store).
  - There is no flow to link an **existing** account as a child, or to add a second guardian to an existing child, although the public FAQ states that a second verified Tutor can link to the same child.

### F2. Manage a child account

- **Rename / change date of birth:** name and date of birth only. The **username is permanent**, because the child's sign-in identity derives from it. Audited with the field names only.
- **Change passphrase:** the parent sets a new passphrase (8–72). Audited without the value.
- **Remove permanently:** the parent types the child's username to confirm. The child's account and **all** their data (progress, streaks, tutor conversations, wallet, etc.) are deleted immediately and irreversibly. Audited before and after. The data store blocks removal of a child's last verified guardian link while the child still has the kid role, but deleting the child account itself cascades everything.
- **Guard:** every operation re-verifies that this parent holds a verified link to this child. Another family's child is answered as "not found".

### F3. Analytics consent for a child

- **Steps:** Family → toggle **"Share usage insights"** for a child.
  - *Grant:* a new consent record is added (who granted it, and when). From then on the child's app sends usage events, and the server accepts them.
  - *Revoke:* the open consent record is closed with a revocation time and collection stops immediately. History is preserved.
- A "consent granted/revoked" event is recorded about the **parent** (no child identifier), but only when the state actually changed.
- **Default:** off. A child's analytics are dropped until consent exists.

### F4. View a child's territory

- **Steps:** Family → **View territory** → choose a course. The same map the child sees is computed from the child's progress, with stats (XP, lessons completed, day streak, best streak, last active date).
- **Events:** "territory viewed" (server) and "parent report viewed" (client), both about the parent.

### F5. Share a child's achievement badge

- **Steps**
  1. From the child's territory, choose **Share achievement**: a completed course badge, a **streak** (at least 3 days), or a **reached savings goal**.
  2. Core verifies the achievement is real: the course is in the child's completed badges; the streak meets the minimum; the goal belongs to the child and has status "reached". The label is built on the server in the parent's chosen language (for example "5-day streak", "Saved 50 LF Coins for 'Bike'").
  3. The media service renders a badge image with the first name only.
  4. A public share record with a random 32-character token is stored. The app copies the link or opens the device share sheet ("Shared!"/"Link copied").
- **Events:** "badge generated" (server) and "badge shared" (client).
- **Error states:** not earned yet; the child has no display name; image rendering failed.

---

## G. Family Hub: chores and rewards flows

### G1. Parent creates a chore

- **Steps:** Tasks → **New task**. Choose the child, the title (1–120), the LF Coins reward (1–**500**), whether it repeats (just once / every week), an optional due date, and optionally "Require a photo before I can approve this". The task is created as **Open**. Audited.
- **Guard:** the child must be the parent's verified child.

### G2. Child completes a chore

- **Steps**
  1. Child → Tasks → **Mark done** on an Open task. The status becomes **Waiting for approval**.
  2. The child's **chore streak** updates using their local date: same day unchanged; next day +1; a gap resets to 1.
  3. Optionally the child **adds a photo** as proof (JPEG/PNG/WebP up to 8 MB, content checked to be a real image). This is allowed while the task is Open or Waiting, and can be replaced. The photo is stored privately and viewable only by the child and their verified guardians, through the app. The previous photo is deleted when replaced.
- **Error states:** the task is not open; the task was already decided (no more photos); more than **20 photo uploads per 15 minutes**.

### G3. Parent approves or cancels a chore

- **Approve:** Waiting → **Approved**. Refused if the task requires a photo and none is attached. Audited.
- **Cancel:** from Open or Waiting → **Cancelled**, with an optional reason (up to 240 characters) visible to the child. Cancelling a task with a photo also removes the photo. Audited.
- **Concurrency:** a task that changed state in the meantime is refused ("This task changed state — refresh and try again").

### G4. Child sorts the reward (Save / Spend / Share)

- **Preconditions:** the task is Approved and not yet allocated.
- **Steps:** "Sort your reward" → split the exact reward amount across **Save**, **Spend** and **Share** (all ≥ 0, summing to the reward). Optionally send the Save portion to one of the child's active **goals**.
- **Rules:** the split must equal the reward exactly. A goal requires a Save amount above 0 and must be the child's own active goal. The operation is atomic and serialized per child. Ledger entries are written per bucket with the reason "task approved", and the task is marked allocated.
- **Goal reached:** if the goal's saved total now meets its target, the goal flips to **reached** ("Goal reached!"), which makes it shareable as a badge.
- **Error states:** not ready to allocate, or invalid split ("That's more than you earned" in the UI).

### G5. Savings goals

- **Create:** title (1–80), target (1–100,000 LF Coins), icon (star, game, toy, book, bike, trip, gift). Starts **active**.
- **Progress:** the sum of Save-bucket ledger entries tagged to the goal.
- **Archive:** the child can archive a goal (confirmation). **Reached** is set automatically.

### G6. Reward catalog and redemption

- **Parent:** creates rewards ("30 extra minutes of tablet", cost 1–500) and turns them on or off.
- **Child:** Tasks → Rewards shows the active rewards of **all of the child's verified guardians** → **Redeem**.
  - A parent-set **spending limit** is checked at request time: if the period's spending plus this cost exceeds the cap, the request is refused ("This would go over the weekly/monthly spending limit").
  - The request is created as **requested** ("Waiting for your decision" for the parent).
- **Parent decision:**
  - *Deny:* status **denied**.
  - *Approve:* requires the child's **Spend** balance to cover the cost at decision time. The cost is deducted from Spend (ledger reason "redemption"), and the status becomes **approved**.
  - Otherwise: "They no longer have enough LF Coins for this".
- **Audited:** redemption approved/denied.
- **Edge cases:** the "fulfilled" status exists but no flow sets it. Balance is not reserved at request time; it is checked only at approval.

---

## H. Digital Banking flows

### H1. Parent opens a child's account

- **Steps:** Banking → choose a child → **Open account**: nickname (1–40, default "My Account") and card design (indigo, emerald, violet, amber, sunrise, ocean). A display card number is generated. The existing Save/Spend/Share balances "carry right over", because they live in the same ledger. Audited.
- **Error:** the account is already open.

### H2. Configure an allowance, spending limit and savings bonus

- **Preconditions:** the account is open (otherwise "Open the account before…").
- **Allowance:** amount 1–1,000 LF Coins; every week / every two weeks (day of week) or every month (day 1–28); active on/off. The next run date is computed. Audited.
- **Spending limit:** a weekly or monthly period, a cap ≥ 1, active on/off. The status shows used/remaining for the current period. Audited.
- **Savings bonus:** a rate of 0–20% (in basis points), active on/off; the first run is 7 days later. The copy says it is "a bonus your family adds… not a bank interest rate". Audited.

### H3. Scheduled credits (allowance and bonus)

- **Trigger:** whenever the child's or parent's account screen is opened, pending schedules are processed "catch-up" style. There is no background timer.
- **Allowance:** for each due occurrence (up to 8 at a time), a **pending credit** is created and the schedule advances weekly, fortnightly or monthly. Older missed occurrences beyond 8 are skipped.
- **Savings bonus:** for each due week (up to 8), the bonus is floor(current Save balance × rate). It is credited directly to **Save** (reason "savings bonus").
- **Child allocation:** "Your allowance arrived!" → split the pending credit exactly into Save/Spend/Share (reason "allowance").

### H4. Freeze and unfreeze the card

- A parent or the child can freeze or unfreeze. The UI shows who froze it ("You froze this card" / "A parent froze this card"). Audited.
- **Observed behavior:** the child UI says freezing "Blocks new redemption requests", but no server rule checks the frozen state (redemptions, allocations and allowances continue). A child can also unfreeze an account frozen by a parent.

### H5. Monthly statement

- For any month (default: current): total earned (positive entries), total spent (negative entries), net saved (Save bucket), and the entries.
- Viewable by the child and their verified parents.

---

## I. Profile and social flows

### I1. Edit profile and settings

- **Name** (1–80), **username** (3–20, a–z/0–9/_, lowercased, unique; "That @username is taken"), **language** (becomes the language of record: interface and lessons), **date of birth** (past, after 1900).
- **Children** use the same Settings screen as everyone else. They can edit their display name, profile username, language and date of birth, and use password and email change. A child who edits their profile username still signs in with the original username chosen by the parent, because the sign-in identity is fixed at creation. The parent-side management screen presents the username as permanent.
- **Theme** (auto/light/dark) is saved per browser, not per account.
- A "profile edited" event is recorded.

### I2. Avatar and cover

- **Avatar:** a cartoon option set (seed, hair/top, hair colour, skin, eyes, eyebrows, mouth, facial hair and its probability, clothing, clothing colour, accessories and their probability; each up to 3 values). Rendered in the browser. "Randomize" is available. No image upload exists anywhere in the product. An "avatar edited" event is recorded.
- **Cover:** one of 10 colour presets (aurora, sunset, ocean, forest, candy, ember, midnight, mint, grape, dawn).

### I3. Follow, unfollow and public profiles

- Open `/@username`. Profiles are visible only to signed-in users.
- The public profile shows name, @username, cover, avatar, member since, the Tutor badge (if the person is a verified parent), follower counts, learning statistics and course badges.
- **Follow** (not yourself; refused if a block exists either way) and **Unfollow**.

### I4. Block and unblock

- **Block** (second tap confirms): removes the relationship, blocks new follows either way, and **hides both profiles from each other** (each sees "doesn't exist", without revealing who blocked). The app returns to Learn.
- **Unblock:** Settings → Blocked accounts → Unblock (possible even though the profile is hidden).

### I5. Invite friends

- With a username set: "Copy invite" copies "Follow me on LittleFounders and let's learn together → littlefounders.ai/@username". Without one: "Choose your @username to share your profile with friends".

### I6. Account deletion

- **Children:** deleted by their parent (F2).
- **Adults and guests:** no self-service deletion exists. The FAQ directs users to "contact us".

---

## J. Staff flows

### J1. Release a course (publish gate)

- **Actors:** Admin or Superadmin.
- **Steps:** Content → course → **Publish**. The data store runs a release check, all or nothing:
  1. the course exists → otherwise "doesn't exist";
  2. it is not archived → otherwise "Restore it to draft before publishing";
  3. it has at least one adventure, saga, topic and lesson;
  4. every lesson is in **review** or **published**;
  5. every lesson has exactly one document in each of **English, Spanish and Portuguese**;
  6. a **course verification** (run by the generation pipeline's acceptance check) exists and is newer than the latest document change.

  On success, all review lessons are published, then every topic, saga and adventure whose children are all published, then the course. Concurrent content changes abort the release. Audited with counts.
- **Unpublish/archive:** sets the course status directly (draft/archived). Audited.

### J2. Moderate lessons (human review gate)

- Content → **Review queue** lists lessons in review, with course/adventure/saga/topic context and available languages. Staff preview the lesson rendered per language, inspect its components and audio, then **Approve** (→ published) or **Reject** (→ draft). Audited.

### J3. Review live tutor activities

- A sample (15% by default) of AI-generated live activities is queued. Staff see the activity with its answer key and either **approve** or **reject** it. A decision lands only on items still pending.

### J4. Manage roles and permissions (Superadmin only)

- Find a user (at least 2 characters) → grant or revoke **parent, kid, bigfounder, admin, superadmin**; grant or revoke staff permissions **manage users, manage content, view analytics, manage support**.
- Data store rules reject invalid changes ("The database rejected this role change"):
  - superadmin only for company email addresses;
  - admin only granted by a superadmin;
  - kid only with a verified guardian link;
  - no removal of a parent's role if it would orphan a child.
- A superadmin cannot revoke their own superadmin role. All changes are audited automatically.

### J5. Exclude internal traffic from analytics

- Analytics → Internal traffic: see "This device" (address, excluded or not) and **detected staff addresses** (seen in staff console requests over the last 1–90 days). Actions: **Exclude this device** (labelled "Staff device"), exclude an address or network range (IPv4 no broader than /16, IPv6 no broader than /32; label and optional reason), or revoke an exclusion (kept for history). Exclusions apply from that moment forward. Audited.

### J6. Reports and exports

- **Web analytics report:** choose the period and audience (Marketing, Sales, Frontend, Full) and the number of rows (1–200). Download as **PDF** (in a chosen language), **CSV** or **XLSX**. The report includes the previous-period comparison, imported-history flags and a first-party measurement block (sessions, share not from staff, accounts created, signups observed and unobserved, anonymous visitors, conversions).
- **Behavioral export:** all Umami dimensions in CSV or XLSX.
- **First-party event export:** CSV or JSON, filtered by days, role, event, surface, language and device. Up to 50,000 rows per page, with paging tokens. No user identifiers; session identifiers are replaced by a per-export pseudonym. Every export is audited.
- **Intelligence export:** CSV/XLSX with activation funnel, engagement, lesson drop-off and exercise calibration. Staff activity is excluded, and the file says so.

### J7. Monitoring

- **Generation:** live progress of content-generation runs (auto-refresh), run history, cross-run analytics, coach diagnostics, run comparison, slot details.
- **Emails:** delivery history and trends.
- **System health:** service monitors.
- **Audit log:** filterable history.
- **Users:** list and signup timeline.
- **Overview:** KPIs and retention curves.
- **Retention sweep status:** whether the 90-day tutor deletion job is running.

---

## K. Content production flows (operator, no end-user UI)

### K1. Generate a course

1. An operator runs course generation for a course (optionally specific lessons, languages, with/without images, dry run, resume by run id, audience register kid/adult). Mass generation runs per adventure with a total budget.
2. For each lesson blueprint ("slot"), the stages are: **plan → write → review (independent AI judge on a 9-dimension rubric, with child safety as a hard floor) → localize (Spanish source to English and Portuguese, with numbers, identifiers and answer keys frozen) → illustrate → publish**.
3. Between stages, **deterministic gates** check: schema validity, forbidden vocabulary by age tier, currency facts, arithmetic re-execution, rationales and character canon, anti-genericity, generation quality, clarity/visual-first, readability by tier and language, and plan fidelity.
4. Lessons are stored in **review** status (never directly live). Answer keys are stored separately from the public document. Re-publishing a live lesson requires an explicit choice: demote it to review, or keep it published.
5. Limits: per-run and per-lesson token and cost caps, retries per lesson, resumable checkpoints. Telemetry feeds the Generation console.
6. An alternative "authoring" path lets an external AI author write lessons. The same gates, judge, localization freeze and review-status publishing apply.

### K2. Narrate lessons

- The operator runs batch narration (all courses, or one). For each lesson document pending audio, the narratable text is extracted: prompts, story lines (in each character's voice), scene bodies, key ideas, choices, hints and explanations. Answers are never narrated.
- Speech is synthesized per language with cached reuse, stored in the media service, and the lesson's audio manifest is updated.

### K3. Verify and release a course

- The operator runs **course verification**, which checks that:
  - the catalog loads;
  - the pedagogical progression is valid;
  - every blueprint produced a release-ready lesson;
  - all 3 languages exist;
  - the current illustration style is used;
  - all gates pass;
  - every planned illustration exists;
  - no scene image is reused across lessons;
  - no orphaned lesson carries learner progress;
  - topic titles are localized;
  - no foreign-currency words leaked across languages.

  On success a **release attestation** is stored, which unlocks the staff Publish action (J1) until any document changes.

### K4. Seed and audit the tutor's knowledge graph

- An operator loads the knowledge-component graph: 28 skills, 36 prerequisite links and 32 misconceptions. The loader refuses cyclic graphs. Without it, the tutor's pedagogical brain stays dormant.
- A daily audit confirms that every mapped skill still reaches a published lesson. A weekly curation report proposes what to author next.
