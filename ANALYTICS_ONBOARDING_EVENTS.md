# Onboarding Custom Events — GA4 Reference

Reference guide for the custom events instrumented in the LittleFounders web app onboarding + placement flow. Use this to build dashboards, funnels, and audiences in Google Analytics 4 (or to wire downstream tools such as Looker Studio, BigQuery exports, Microsoft Clarity correlations, etc.).

---

## 1. Setup

| Field | Value |
|---|---|
| GA4 Measurement ID | `G-0XH7S80QG2` |
| gtag.js loader | `frontend/index.html` (lines 29–40) |
| React wrapper (page views) | `frontend/src/components/analytics/GoogleAnalytics.tsx` |
| Custom event helper | `frontend/src/lib/analytics.ts` → `trackEvent(name, params?)` |
| Tracking gate | Disabled on `localhost` and `127.0.0.1`. Production only. |
| Companion telemetry | Microsoft Clarity (`vwvchxd933`) — same hostname gate. |

`trackEvent()` calls `window.gtag('event', name, params)`. It is a no-op when gtag is not loaded, so it never throws if the script is blocked or in dev.

---

## 2. Funnel overview

The onboarding journey is two consecutive flows:

```
Landing
  └─► Onboarding (5 steps: welcome → name → age → interests → experience)
        └─► Placement (intro → quiz x12 → closing)
              └─► Learn page
```

Recommended primary funnel:

1. `onboarding_started`
2. `onboarding_name_submitted` (success: true)
3. `onboarding_age_submitted` (success: true)
4. `onboarding_interests_submitted` (success: true)
5. `onboarding_experience_selected`
6. `onboarding_completed` *(fires alongside #5 — use either one as the conversion)*
7. `placement_started` *or* `placement_skipped` (split attribution)
8. `placement_quiz_completed`
9. `placement_continue_to_learn`

---

## 3. Event catalog

All events use `snake_case`. Parameter values are scalars or string/number arrays (GA4 limit: 25 params per event, max 40 char param name, max 100 char string value).

### 3.1 Onboarding events

#### `onboarding_step_viewed`
Fires every time the visible step changes (including the initial render).

| Param | Type | Example | Notes |
|---|---|---|---|
| `step_index` | number | `0` | 0–4 |
| `step_name` | string | `welcome` | `welcome`, `name`, `age`, `interests`, `experience` |

**Source:** `frontend/src/pages/Onboarding.tsx` (`useEffect` on `step`).

#### `onboarding_started`
User tapped the welcome CTA (transition step 0 → 1).

| Param | Type | Example |
|---|---|---|
| `source` | string | `welcome_cta` |

#### `onboarding_name_submitted`
User pressed Continue / Enter on the name step. Fires on both success and validation failure — split with the `success` dimension.

| Param | Type | Example | Notes |
|---|---|---|---|
| `success` | boolean | `true` | |
| `error` | string | `required`, `invalid` | Only present when `success=false` |
| `name_length` | number | `6` | Length of the trimmed name. **No PII (the raw name is never sent.)** |

#### `onboarding_age_submitted`
Same pattern as `name_submitted`.

| Param | Type | Example | Notes |
|---|---|---|---|
| `success` | boolean | `true` | |
| `error` | string | `required`, `invalid`, `nan`, `out_of_range` | Only when `success=false` |
| `age` | number | `9` | Sent on success, and on `out_of_range` for diagnosis |

#### `onboarding_interest_toggled`
User added or removed one of the 6 interest cards.

| Param | Type | Example | Values |
|---|---|---|---|
| `interest` | string | `saving` | `saving`, `investing`, `entrepreneurship`, `budgeting`, `banking`, `security` |
| `action` | string | `added` | `added` \| `removed` |
| `total_after` | number | `2` | Selection count after the toggle |

#### `onboarding_interests_submitted`
User pressed Continue on interests.

| Param | Type | Example | Notes |
|---|---|---|---|
| `success` | boolean | `true` | |
| `error` | string | `none_selected` | When `success=false` |
| `count` | number | `3` | Only on success |
| `interests` | string[] | `["saving","investing"]` | Only on success |

#### `onboarding_experience_selected`
User tapped a level on the last step. **This is the moment the guest profile is persisted.**

| Param | Type | Example | Values |
|---|---|---|---|
| `experience_level` | string | `beginner` | `beginner` \| `some_knowledge` \| `experienced` |
| `age` | number | `9` | |
| `interests_count` | number | `3` | |
| `preferred_language` | string | `es` | `es` \| `en` |

#### `onboarding_completed`
Fired immediately after `onboarding_experience_selected`. **Use this as the onboarding-conversion event.**

| Param | Type | Example |
|---|---|---|
| `experience_level` | string | `beginner` |
| `age` | number | `9` |
| `interests` | string[] | `["saving","investing"]` |
| `preferred_language` | string | `es` |

> **Why two events at the same point?** `onboarding_experience_selected` lets you slice by level for UX; `onboarding_completed` is the funnel/conversion endpoint and is the one to mark as a Key Event in GA4.

---

### 3.2 Placement events

#### `placement_started`
User tapped Accept on the intro screen.

| Param | Type | Example | Notes |
|---|---|---|---|
| `base_adventure` | string | `A1` | Derived from age (`ageToAdventure`) |
| `age` | number | `9` | |

#### `placement_skipped`
User opted out of the quiz. Can fire from intro (`source: intro`) or from the X button mid-quiz (`source: exit`).

| Param | Type | Example |
|---|---|---|
| `source` | string | `intro` \| `exit` |
| `base_adventure` | string | `A1` |
| `age` | number | `9` |

#### `placement_question_answered`
Fires on every answer click in the quiz (max 12 per session).

| Param | Type | Example | Notes |
|---|---|---|---|
| `item_id` | string | `it_023` | Bank item ID |
| `item_number` | number | `3` | 1-indexed position in the served sequence |
| `item_type` | string | `multiple_choice` | `multiple_choice` \| `true_false` |
| `correct` | boolean | `true` | |
| `time_sec` | number | `4.21` | Seconds from question render to answer |
| `selected_value` | number \| string | `2` or `"true"` | Index for MC, stringified bool for T/F |

#### `placement_quiz_completed`
Fires when the engine reaches the stop condition (max items or convergence).

| Param | Type | Example |
|---|---|---|
| `items_served` | number | `12` |
| `items_correct` | number | `8` |
| `overall_score` | number | `0.66` |
| `confidence` | number | `0.84` |
| `base_adventure` | string | `A1` |
| `final_adventure` | string | `A2` |
| `final_saga` | number | `2` |
| `target_lesson_code` | string | `A2-2-1-1` |
| `duration_sec` | number | `78.4` |
| `age_declared` | number | `9` |

#### `placement_exited_early`
Fires before `placement_skipped` when the user closes mid-quiz with the X button.

| Param | Type | Example |
|---|---|---|
| `items_answered` | number | `4` |
| `items_served` | number | `5` |
| `base_adventure` | string | `A1` |

> Note: an early exit produces **two** events in this order: `placement_exited_early` then `placement_skipped` (with `source: exit`). Use `placement_exited_early` for abandonment metrics; `placement_skipped` is the canonical "did not complete" flag.

#### `placement_continue_to_learn`
User tapped the CTA on the closing screen → navigates to `/learn`.

| Param | Type | Example | Notes |
|---|---|---|---|
| `skipped` | boolean | `false` | True if reached closing via skip path |
| `target_lesson_code` | string \| null | `A2-2-1-1` | |
| `final_adventure` | string | `A2` | |
| `final_saga` | number | `2` | |

---

## 4. Suggested dashboard

### 4.1 Mark as Key Events (conversions) in GA4

Recommend marking these as Key Events:

- `onboarding_completed`
- `placement_quiz_completed`
- `placement_continue_to_learn`

### 4.2 Funnels (Explore → Funnel exploration)

**Onboarding funnel (strict order):**
```
onboarding_started
  → onboarding_name_submitted (success=true)
  → onboarding_age_submitted (success=true)
  → onboarding_interests_submitted (success=true)
  → onboarding_completed
```
Track step-to-step drop-off. Add breakdown by `device_category` and `country`.

**Placement funnel (after onboarding):**
```
onboarding_completed
  → placement_started
  → placement_quiz_completed
  → placement_continue_to_learn
```

**Validation-error funnel** — monitor friction:
- Total `onboarding_name_submitted` with `success=false` / total submissions, broken down by `error`.
- Same for `onboarding_age_submitted`.

### 4.3 Recommended cards / scorecards

| Metric | Definition |
|---|---|
| Onboarding completion rate | `onboarding_completed` / `onboarding_started` |
| Welcome-to-name drop | 1 − (`onboarding_name_submitted` success / `onboarding_started`) |
| Avg. validation errors per session | sum of `*_submitted` with `success=false`, grouped by session |
| Placement attempt rate | `placement_started` / `onboarding_completed` |
| Placement skip rate (intro) | `placement_skipped` (source=intro) / `placement_started` + `placement_skipped` (intro) |
| Placement abandonment rate | `placement_exited_early` / `placement_started` |
| Placement completion rate | `placement_quiz_completed` / `placement_started` |
| Avg. quiz duration | mean(`duration_sec` on `placement_quiz_completed`) |
| Avg. items served | mean(`items_served` on `placement_quiz_completed`) |
| Quiz accuracy | mean(`items_correct` / `items_served`) |
| Question response time | mean(`time_sec` on `placement_question_answered`), segmented by `item_number` |
| Final adventure distribution | count of `placement_quiz_completed` by `final_adventure` |
| Lift / drop vs. base adventure | `final_adventure ≠ base_adventure` rate |

### 4.4 Audiences worth building

- **Stuck on name** — users with `onboarding_name_submitted` (success=false ≥ 2) and no subsequent success.
- **Interests power-user** — `onboarding_interests_submitted` with `count ≥ 4`.
- **Quiz over-performers** — `placement_quiz_completed` where `final_adventure > base_adventure` (lift). Useful for discovery of mis-assigned age content.
- **Quiz quitters** — `placement_exited_early` with `items_answered ≤ 2`.
- **Skip-to-learn** — `placement_continue_to_learn` where `skipped=true`. These users go straight to the default lesson.

### 4.5 Segmentation dimensions to register as custom dimensions

Register these once in GA4 (Admin → Custom definitions → Custom dimensions, scope: Event):

| Dimension | Event param | Why |
|---|---|---|
| `experience_level` | `onboarding_completed`, `onboarding_experience_selected` | Slice retention by self-reported level |
| `age` | `onboarding_completed`, `placement_quiz_completed` | Cohort / age-group analysis |
| `preferred_language` | `onboarding_completed` | ES vs. EN performance |
| `base_adventure` | placement events | Did age-bucketing match reality? |
| `final_adventure` | `placement_quiz_completed`, `placement_continue_to_learn` | Where users actually started |
| `final_saga` | `placement_quiz_completed`, `placement_continue_to_learn` | Saga-level drop-in |
| `target_lesson_code` | `placement_quiz_completed`, `placement_continue_to_learn` | Lesson-level entry distribution |
| `item_id` | `placement_question_answered` | Item analysis (difficulty, time) |
| `item_type` | `placement_question_answered` | MC vs. T/F response rates |
| `correct` | `placement_question_answered` | Per-item accuracy |
| `source` | `placement_skipped` | Intro vs. exit attribution |

---

## 5. Quality checks before publishing the dashboard

1. **DebugView** (GA4 → Configure → DebugView): open in two browser tabs and run through the flow. All events listed in §3 should appear in order.
2. **Localhost gate**: confirm no events fire on `localhost:5173` or `127.0.0.1` — the helper short-circuits.
3. **PII**: confirm no event has the raw `name`. Only `name_length` is sent. If you ever add `name` as a param, GA4's [data redaction settings](https://support.google.com/analytics/answer/13544947) won't catch arbitrary names — keep them out.
4. **Realtime**: GA4 Realtime → Event count by event name should show the events within ~30s of firing.
5. **Backfill**: BigQuery export (if linked) lands events in `events_*` tables ~24h later. Item-level analysis (`placement_question_answered`) is best done there to avoid cardinality issues in GA4 reports.

---

## 6. Where each event is fired (file references)

| Event | File | Function |
|---|---|---|
| `onboarding_step_viewed` | `frontend/src/pages/Onboarding.tsx` | `useEffect([step])` |
| `onboarding_started` | `frontend/src/pages/Onboarding.tsx` | `handleStartFromWelcome` |
| `onboarding_name_submitted` | `frontend/src/pages/Onboarding.tsx` | `handleNameContinue` |
| `onboarding_age_submitted` | `frontend/src/pages/Onboarding.tsx` | `handleAgeContinue` |
| `onboarding_interest_toggled` | `frontend/src/pages/Onboarding.tsx` | `toggleInterest` |
| `onboarding_interests_submitted` | `frontend/src/pages/Onboarding.tsx` | `handleInterestContinue` |
| `onboarding_experience_selected` | `frontend/src/pages/Onboarding.tsx` | `handleExperienceSelect` |
| `onboarding_completed` | `frontend/src/pages/Onboarding.tsx` | `handleExperienceSelect` |
| `placement_started` | `frontend/src/features/placement/PlacementEngine.tsx` | `handleAccept` |
| `placement_skipped` | `frontend/src/features/placement/PlacementEngine.tsx` | `handleSkip` |
| `placement_question_answered` | `frontend/src/features/placement/components/PlacementQuestion.tsx` | `handleSelect` |
| `placement_quiz_completed` | `frontend/src/features/placement/PlacementEngine.tsx` | `loadNextItem`, `handleAnswer` |
| `placement_exited_early` | `frontend/src/features/placement/PlacementEngine.tsx` | `handleExit` |
| `placement_continue_to_learn` | `frontend/src/features/placement/PlacementEngine.tsx` | `handleContinue` |

---

## 7. Adding new events

1. Import the helper: `import { trackEvent } from '@/lib/analytics';`
2. Call it in the handler: `trackEvent('event_name', { param1, param2 });`
3. Update this document — add the event under §3 with parameters, type table, and a row in §6.
4. If the event should be a conversion, add it to §4.1 and register it as a Key Event in GA4.
5. Never send raw user input that could identify a user (name, email, free-text answers). Send aggregates (length, count, hash) instead.
