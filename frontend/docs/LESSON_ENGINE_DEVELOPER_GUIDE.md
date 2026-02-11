# LittleFounders Lesson Engine — Developer Guide

**Version 2.0 | February 2026**

Complete technical reference for the Lesson Engine: architecture, 40+ activity components, centralized validation, state machine, data structures, and API integration.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [State Machine (useLessonState)](#2-state-machine-uselessonstate)
3. [Data Structures](#3-data-structures)
4. [Complete Activity Catalog (40 Components)](#4-complete-activity-catalog-40-components)
5. [Centralized Validation Engine](#5-centralized-validation-engine)
6. [Standardized Component Props](#6-standardized-component-props)
7. [LessonRunner (Orchestrator)](#7-lessonrunner-orchestrator)
8. [API Integration](#8-api-integration)
9. [Character System](#9-character-system)
10. [Content Library](#10-content-library)
11. [File Structure Reference](#11-file-structure-reference)
12. [Known Issues & Critical Bugs Fixed](#12-known-issues--critical-bugs-fixed-feb-2026)
13. [Developer Guidelines](#13-developer-guidelines)

---

## 1. Architecture Overview

The Lesson Engine is the core interactive learning system of LittleFounders. It renders educational activities for children learning financial literacy through gamified exercises.

### 1.1 System Layers

**Backend (FastAPI + PostgreSQL):** Stores lesson data (adventures → sagas → topics → lessons → exercises) and serves them via REST API. Generates audio narration with ElevenLabs for character voices.

**State Management (React Hooks):** `useLessonData` fetches lesson data. `useLessonState` implements the state machine and centralized validation. `useLessonAudio` manages audio playback and character animations.

**Activity Components (40+ React Components):** Each exercise type maps to a dedicated component that renders the UI, collects user input, and delegates validation to the engine via `onSubmit`.

### 1.2 Data Flow

1. Frontend requests lesson data via `GET /lesson-engine/lessons/{code}/play?lang={lang}`
2. Backend returns `LessonData` with `lesson` (metadata), `meta` (rewards), and `timeline` (exercise array)
3. `LessonRunner.tsx` iterates through timeline, rendering the appropriate activity component per exercise type
4. User interacts → component calls `onSubmit(answer)` → `useLessonState.submitAnswer()` runs `validateAnswer()` → returns boolean
5. Component uses the boolean to set local feedback state (success/error) → shows Continue or Retry
6. Continue → `onNext()` → `nextExercise()` advances to next exercise
7. All exercises done → state = `COMPLETED` → lesson completion API called

### 1.3 Key Design Principles

- **Single Source of Truth:** All validation lives in `useLessonState.validateAnswer()`. Components never validate answers themselves (exception: `MatchingPairs` detects pair completion, sends `true`)
- **Standardized Props:** Every activity component receives: `exercise`, `onSubmit`, `onNext`, `onRetry`
- **No setTimeout in State Transitions:** Synchronous state changes only. setTimeout caused critical bugs where narrative activities overwrote subsequent exercise states

---

## 2. State Machine (useLessonState)

The lesson engine is driven by a finite state machine in `useLessonState.ts`.

### 2.1 States

| State | Description |
|-------|-------------|
| `IDLE` | Initial state before lesson starts. Waiting for `startLesson()` |
| `PLAYING` | Audio/narration playing. Used by `intro_narrative` and `story_mode`. Also initial state after `startLesson()` |
| `WAITING_INPUT` | Waiting for user to submit answer. All interactive activities operate here |
| `CHECKING` | Transient state during `validateAnswer()`. Prevents double-submission |
| `FEEDBACK_SUCCESS` | Answer correct. Component shows success + Continue |
| `FEEDBACK_ERROR` | Answer wrong. Component shows error + Try Again |
| `COMPLETED` | All exercises finished. Triggers completion API |

### 2.2 Transitions

```
IDLE → PLAYING                    startLesson()
PLAYING → WAITING_INPUT           Audio completes (auto) / user continues narrative
WAITING_INPUT → CHECKING          submitAnswer() invoked
CHECKING → FEEDBACK_SUCCESS       validateAnswer() returned true
CHECKING → FEEDBACK_ERROR         validateAnswer() returned false
FEEDBACK_SUCCESS → WAITING_INPUT  nextExercise() (next is interactive)
FEEDBACK_SUCCESS → PLAYING        nextExercise() (next is intro_narrative/story_mode)
FEEDBACK_SUCCESS → COMPLETED      nextExercise() (no more exercises)
FEEDBACK_ERROR → WAITING_INPUT    retryExercise()
```

### 2.3 Key Functions

- **`submitAnswer(answer)`**: Guards against invalid states (only `WAITING_INPUT` or `PLAYING`). Calls `validateAnswer()`, records result, sets feedback state synchronously, returns boolean.
- **`nextExercise()`**: Increments index. Checks next exercise type for initial state (`PLAYING` for narratives, `WAITING_INPUT` for interactive). Sets `COMPLETED` if done.
- **`retryExercise()`**: Sets state to `WAITING_INPUT` for another attempt.
- **`startLesson()`**: Resets index, results, transitions to `PLAYING`.

### 2.4 Guard Conditions

`submitAnswer` blocks (returns `false`) when:
- `currentExercise` is null
- `state` is not `WAITING_INPUT` or `PLAYING`

Both emit `console.warn('[LessonEngine] submitAnswer blocked: ...')` with exercise type and current state.

---

## 3. Data Structures

### 3.1 LessonData

```typescript
interface LessonData {
  lesson: LessonInfo;       // id, code, title, description, saga/adventure/topic
  meta: LessonMeta;         // estimated_duration_seconds, points_reward, xp_reward
  timeline: ExerciseData[]; // Ordered exercises
}
```

### 3.2 ExerciseData

| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` | Unique exercise identifier |
| `type` | `string` (union) | Activity type key (e.g. `'multiple_choice'`, `'quiz_battle'`) |
| `order_index` | `number` | Position in timeline |
| `character_code` | `string?` | Character: `'liruf'`, `'dina'`, `'dr_rho'`, `'zara_vex'` |
| `start_time_ms` | `number` | Audio start time |
| `pause_at_ms` | `number?` | Audio pause point |
| `content` | `object` | Exercise-specific content (question, options, items, etc.) |
| `correct_answer` | `object?` | Validation data (correctOptionId, sequence, etc.) |
| `feedback` | `object?` | Custom messages: `{ success: string, error: string }` |
| `points` | `number` | Points for correct answer |
| `audio` | `AudioData?` | Audio URL, character, gesture, emotion, transcript |

### 3.3 correct_answer Fields by Activity Type

| Field | Type | Used By |
|-------|------|---------|
| `correctOptionId` | `string` | multiple_choice, roleplay_chat, risk_reward, price_detective, market_reaction |
| `isTrue` | `boolean` | true_false |
| `sequence` | `string[]` | sequencing, concept_builder |
| `blank_ids` | `Record<string, string>` | fill_blank |
| `classifications` | `Record<string, string>` | classification |
| `targetIds` | `string[]` | tap_action (legacy) |
| `trapIds` | `string[]` | spot_trap |
| `correctValue` | `number` | math_challenge, estimation_slider |
| `tolerance` | `number` | estimation_slider |
| `shopItems` | `string[]` | shop_sim |
| `allocation` | `Record<string, string>` | budget_builder |
| `order` | `string[]` | expense_timeline, goal_roadmap |
| `minScore` | `number` | credit_score, quiz_battle |
| `bestOffer` | `string` | salary_comparison |
| `minBoxes` | `number` | mystery_investment |
| `splits` | `Record<string, number>` | bill_splitter |
| `acceptAny` | `boolean` | impact_meter |

---

## 4. Complete Activity Catalog (40 Components)

All components are in `frontend/src/components/lessons/engine/activities/`.

### 4.1 Selection Activities

| Exercise Type | Component | Answer Type | Validation |
|--------------|-----------|-------------|------------|
| `multiple_choice` | MultipleChoice | `string` | `answer === correctAnswer.correctOptionId` |
| `true_false` | TrueFalse | `boolean` | `answer === correctAnswer.isTrue` |
| `tap_action` | TapAction | `string[]` | Set equality with target IDs |
| `risk_reward` | RiskReward | `string` | `answer === correctAnswer.correctOptionId` |
| `roleplay_chat` | RoleplayChat | `string` | `answer === correctAnswer.correctOptionId` |
| `price_detective` | PriceDetective | `string` | `answer === correctAnswer.correctOptionId` |
| `market_reaction` | MarketReaction | `string` | `answer === correctAnswer.correctOptionId` |
| `salary_comparison` | SalaryComparison | `string` | `answer === correctAnswer.bestOffer` |
| `spot_trap` | SpotTheTrap | `string[]` | Set equality vs `correctAnswer.trapIds` |

### 4.2 Matching & Ordering Activities

| Exercise Type | Component | Answer Type | Validation |
|--------------|-----------|-------------|------------|
| `matching_pairs` | MatchingPairs | `boolean` | `answer === true` (self-validates matching) |
| `sequencing` | Sequencing | `string[]` | Position-by-position vs `correctAnswer.sequence` |
| `concept_builder` | ConceptBuilder | `string[]` | Position-by-position vs `correctAnswer.sequence` |
| `expense_timeline` | ExpenseTimeline | `string[]` | Position-by-position vs `correctAnswer.order` |

### 4.3 Classification Activities

| Exercise Type | Component | Answer Type | Validation |
|--------------|-----------|-------------|------------|
| `classification` | Classification | `Record<string, string>` | Every item matches `correctAnswer.classifications` |
| `budget_builder` | BudgetBuilder | `Record<string, string>` | Every key matches `correctAnswer.allocation` |

### 4.4 Text Entry Activities

| Exercise Type | Component | Answer Type | Validation |
|--------------|-----------|-------------|------------|
| `fill_blank` | FillBlank | `Record<string, string>` | Key or positional match vs `correctAnswer.blank_ids` |
| `math_challenge` | MathChallenge | `string` | String match or numeric `|diff| < 0.01` |
| `word_scramble` | WordScramble | `string` | Case-insensitive match vs `content.word` |

### 4.5 Numeric Activities

| Exercise Type | Component | Answer Type | Validation |
|--------------|-----------|-------------|------------|
| `estimation_slider` | EstimationSlider | `number` | `|value - correctValue| <= tolerance` |
| `coin_counter` | CoinCounter | `number` | `|amount - targetAmount| < 0.01` |

### 4.6 Shopping Activities

| Exercise Type | Component | Answer Type | Validation |
|--------------|-----------|-------------|------------|
| `shop_sim` | ShopSim | `string[]` | Set match OR budget constraint |

### 4.7 Investment Activities

| Exercise Type | Component | Answer Type | Validation |
|--------------|-----------|-------------|------------|
| `portfolio_builder` | PortfolioBuilder | `Record<string, number>` | Sum of percentages ≈ 100 |
| `passive_income` | PassiveIncome | `string[]` | `totalIncome >= targetIncome` |
| `mystery_investment` | MysteryInvestment | `Record<string, number>` | `boxesUsed >= minBoxes` |

### 4.8 Score-Based Activities

| Exercise Type | Component | Answer Type | Validation |
|--------------|-----------|-------------|------------|
| `quiz_battle` | QuizBattle | `number` | `score >= minScore` (uses `useRef`) |
| `credit_score` | CreditScoreBuilder | `string[]` | `finalScore >= minScore` |
| `emergency_fund` | EmergencyFund | `string[]` | `balance >= 0` after costs |

### 4.9 Exploratory Activities (Always Correct)

| Exercise Type | Component | Description |
|--------------|-----------|-------------|
| `impact_meter` | ImpactMeter | Donation/impact exploration |
| `savings_race` | SavingsRace | Racing savings strategies |
| `interest_calculator` | InterestCalculator | Compound interest visualization |
| `tax_puzzle` | TaxPuzzle | Tax calculation exploration |
| `subscription_tracker` | SubscriptionTracker | Recurring subscription tracking |
| `inflation_simulator` | InflationSimulator | Inflation impact over time |
| `bill_splitter` | BillSplitter | Bill splitting among people |
| `debt_strategy` | DebtStrategy | Debt payoff visualization |
| `opportunity_cost` | OpportunityCost | Opportunity cost concepts |
| `goal_roadmap` | GoalRoadmap | Financial goal planning |
| `mindset_comparison` | MindsetComparison | Scarcity vs abundance mindset |

### 4.10 Narrative Activities (Consumption)

| Exercise Type | Component | Description |
|--------------|-----------|-------------|
| `intro_narrative` | IntroNarrative | Character narration with speech bubbles. No answer. |
| `story_mode` | StoryMode | Multi-page story with branching choices. No answer. |

---

## 5. Centralized Validation Engine

All answer validation is performed by `validateAnswer()` in `useLessonState.ts`. Components must never validate locally.

### 5.1 Validation Strategies

| Strategy | Description | Activity Types |
|----------|-------------|----------------|
| Exact String Match | `answer === correctOptionId` | multiple_choice, roleplay_chat, risk_reward, price_detective, market_reaction, salary_comparison |
| Boolean Match | `answer === isTrue` | true_false |
| Array Order Match | Position-by-position comparison | sequencing, concept_builder, expense_timeline |
| Set Equality | Identical elements, order-independent | tap_action, spot_trap |
| Record Key Match | Every key-value pair must match | classification, budget_builder, fill_blank |
| Numeric Tolerance | `|userValue - correctValue| <= tolerance` | estimation_slider, coin_counter, math_challenge |
| Case-Insensitive | `toUpperCase()` comparison | word_scramble |
| Score Threshold | Score/balance >= minimum | quiz_battle, credit_score, emergency_fund |
| Diversification | Boxes used >= min, or sum ≈ 100% | mystery_investment, portfolio_builder |
| Income Threshold | `totalIncome >= targetIncome` | passive_income |
| Budget Constraint | `totalSpent <= budget` | shop_sim (fallback) |
| Always True | Cannot fail | All simulators, narratives, impact_meter |

### 5.2 Special Cases

- **fill_blank:** Two-pass — direct key match first, then positional fallback (handles both `"b0"` and `0` keys)
- **math_challenge:** String match first, then numeric comparison with tolerance `< 0.01`. correctValue from `correctAnswer.correctValue` or `correctAnswer.correctOptionId`
- **shop_sim:** Checks `correctAnswer.shopItems` first (set equality). If not defined, validates budget constraint
- **tap_action:** Targets from `items[].isTarget === true` merged with legacy `correctAnswer.targetIds`

---

## 6. Standardized Component Props

### 6.1 Interactive Activities

```typescript
interface ActivityProps {
  exercise: ExerciseData;
  onSubmit: (answer: T) => boolean;  // T varies by activity
  onNext: () => void;
  onRetry: () => void;
}
```

### 6.2 Narrative Activities

```typescript
interface NarrativeProps {
  exercise: ExerciseData;
  onNext: () => void;
  isAudioPlaying?: boolean;  // Disables Continue during audio
}
```

### 6.3 Component Lifecycle

1. **Mount:** Extract content/options. Initialize local state (`feedback: 'none'`). Shuffle if needed
2. **Interaction:** User selects/enters answer. Update local state
3. **Submit:** Call `const isCorrect = onSubmit(answer)`. Synchronous validation
4. **Feedback:** Set local state based on boolean. Success = green Continue + confetti + `edu_success`. Error = orange Try Again + `edu_error`
5. **Advance:** Continue → `onNext()`. Try Again → reset state + `onRetry()`

### 6.4 Audio/Visual Feedback Standards

- **Correct:** `playSound('edu_success')`, confetti, green Continue
- **Wrong:** `playSound('edu_error')`, lives decrease, orange Try Again
- **Interaction validation** (incomplete selection): `playSound('ui_tap')` — never `edu_error`

---

## 7. LessonRunner (Orchestrator)

`LessonRunner.tsx` is the main orchestrator component.

### 7.1 Responsibilities

- Fetch lesson data via `useLessonData(lessonCode, language)`
- Manage state machine via `useLessonState(lessonData)`
- Manage audio via `useLessonAudio(currentExercise, state)`
- Render activity component by mapping `exercise.type` → component
- Pass standardized callbacks: `onSubmit` wraps `submitAnswer`, `onNext` wraps `nextExercise`, `onRetry` wraps `retryExercise`
- Track lives (errors decrease, 0 = lesson failed)
- Show progress bar, character display, completion screen
- Play validation sounds at LessonRunner level

### 7.2 Local State

- `localFeedback` (`'none' | 'success' | 'error'`): Reset to `'none'` on each exercise index change
- `lives` (`number`): Starts at 3, decremented on wrong answers
- All other state managed by `useLessonState`

### 7.3 Type Mapping Note

Both `'matching_pairs'` and `'match_pairs'` map to `MatchingPairs` for backward compatibility.

---

## 8. API Integration

### 8.1 Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/lesson-engine/lessons/{code}/play?lang={lang}` | Fetch lesson data for playback |
| POST | `/lesson-engine/lessons/{code}/complete` | Mark lesson completed. Body: `{ score, time_spent_seconds }` |
| GET | `/lesson-engine/adventures` | List adventures with progress |
| GET | `/lesson-engine/adventures/{code}/sagas` | List sagas in adventure |
| GET | `/lesson-engine/sagas/{code}/topics` | List topics in saga |
| GET | `/lesson-engine/topics/{code}/lessons` | List lessons in topic |

### 8.2 Lesson Code Format

Format: `{adventure}-{saga}-{topic}-{lesson}` (e.g., `"1-1-1-1"`). `getNextLessonCode()` increments the lesson number.

### 8.3 Backend Pipeline

JSON files in `littlefounders_lessons/{adventure}/{saga}/{topic}/` → loaded by endpoint → `correct_answer` passed as-is to frontend (no field transformation).

### 8.4 i18n Support

API supports bilingual content (es/en) via `lang` parameter. `useLessonData` automatically passes current i18n language. All 3,072 lessons validated for bilingual completeness.

---

## 9. Character System

| Character | Code | Role |
|-----------|------|------|
| Liruf | `liruf` | Main mascot. Friendly fox. Guides introductory lessons |
| Dina | `dina` | Smart dinosaur. Analytical and math-oriented activities |
| Dr. Rho | `dr_rho` | Robot professor. Complex concepts (investing, credit, economics) |
| Zara Vex | `zara_vex` | Space explorer. Adventure-themed and creative scenarios |

Characters are assigned per exercise via `character_code`. ElevenLabs generates voice narration with distinct profiles per character.

---

## 10. Content Library

3,072 validated lessons across 6 adventures:

| Adventure | Theme | Content |
|-----------|-------|---------|
| 1 | Basics | 480 lessons, 3 sagas |
| 2 | Saving & Spending | 480 lessons, 3 sagas |
| 3 | Earning & Planning | 480 lessons, 3 sagas |
| 4 | Investing | 480 lessons, 3 sagas |
| 5 | Credit & Debt | 576 lessons, 3 sagas |
| 6 | Advanced Finance | 576 lessons, 3 sagas |

Each lesson has 4-8 exercises mixing narratives with interactive activities. Validated for JSON integrity, bilingual completeness, activity type distribution, and character assignment.

---

## 11. File Structure Reference

### Frontend Engine

```
frontend/src/components/lessons/engine/
├── LessonRunner.tsx                  # Main orchestrator
├── hooks/
│   ├── useLessonState.ts            # State machine + validation
│   ├── useLessonData.ts             # API data fetching + types
│   └── useLessonAudio.ts            # Audio playback
└── activities/
    ├── MultipleChoice.tsx            # Selection
    ├── TrueFalse.tsx
    ├── TapAction.tsx
    ├── RiskReward.tsx
    ├── RoleplayChat.tsx
    ├── MatchingPairs.tsx             # Matching & ordering
    ├── Sequencing.tsx
    ├── ConceptBuilder.tsx
    ├── ExpenseTimeline.tsx
    ├── Classification.tsx            # Classification
    ├── BudgetBuilder.tsx
    ├── FillBlank.tsx                 # Text entry
    ├── MathChallenge.tsx
    ├── WordScramble.tsx
    ├── EstimationSlider.tsx          # Numeric
    ├── CoinCounter.tsx
    ├── ShopSim.tsx                   # Shopping
    ├── PriceDetective.tsx
    ├── SalaryComparison.tsx
    ├── PortfolioBuilder.tsx          # Investment
    ├── PassiveIncome.tsx
    ├── MysteryInvestment.tsx
    ├── MarketReaction.tsx
    ├── QuizBattle.tsx                # Gamification
    ├── CreditScoreBuilder.tsx        # Score-based
    ├── EmergencyFund.tsx
    ├── SpotTheTrap.tsx
    ├── ImpactMeter.tsx               # Exploratory
    ├── SavingsRace.tsx               # Simulators
    ├── InterestCalculator.tsx
    ├── TaxPuzzle.tsx
    ├── SubscriptionTracker.tsx
    ├── InflationSimulator.tsx
    ├── BillSplitter.tsx
    ├── DebtStrategy.tsx
    ├── OpportunityCost.tsx
    ├── GoalRoadmap.tsx
    ├── MindsetComparison.tsx
    ├── IntroNarrative.tsx            # Narrative
    └── StoryMode.tsx
```

### Backend

```
backend/lesson_engine/
├── endpoints.py                      # FastAPI routes
├── models.py                         # SQLAlchemy models
└── littlefounders_lessons/           # JSON lesson content
    └── {adventure}/{saga}/{topic}/   # Organized by hierarchy
```

---

## 12. Known Issues & Critical Bugs Fixed (Feb 2026)

### 12.1 setTimeout State Corruption (Critical)

**Problem:** `submitAnswer()` used `setTimeout` to delay state transitions. When narrative activities called `submitAnswer()` + `nextExercise()` in quick succession, the setTimeout fired after `nextExercise` had already set `WAITING_INPUT`, overwriting it with `FEEDBACK_SUCCESS`. All subsequent exercises failed validation.

**Fix:** Removed all `setTimeout` from `submitAnswer()`. State transitions are synchronous.

### 12.2 QuizBattle Field Name Mismatch

**Problem:** Component checked `question.correctAnswer`, but JSON uses `question.correctId`. Every question evaluated as wrong.

**Fix:** Changed all `question.correctAnswer` → `question.correctId`.

### 12.3 QuizBattle Stale Closure

**Problem:** `moveToNext` called via `setTimeout` captured stale `score` from closure. Last question's points never included.

**Fix:** Added `useRef(0)` for score. Ref updated alongside `setState`, `moveToNext` reads `scoreRef.current`.

### 12.4 BillSplitter Unconditional Advance

**Problem:** `handleContinue()` called `onNext()` regardless of answer correctness.

**Fix:** Check feedback state: success → `onNext()`, error → reset + `onRetry()`.

### 12.5 story_mode State Initialization

**Problem:** `nextExercise()` only checked `'intro_narrative'` for `PLAYING` state. `story_mode` got `WAITING_INPUT`, blocking advance.

**Fix:** Added `'story_mode'` to the type check.

### 12.6 Duplicate Error Sounds

**Problem:** BillSplitter and BudgetBuilder played `edu_error` for interaction validation (incomplete items). Double error feedback.

**Fix:** Changed to `ui_tap`. Only centralized handler plays `edu_error`/`edu_success`.

---

## 13. Developer Guidelines

### 13.1 Adding a New Activity Type

1. **Create component** in `activities/`. Use standard props: `exercise`, `onSubmit`, `onNext`, `onRetry`
2. **Add type** to `ExerciseData` union in `useLessonData.ts`
3. **Add validation case** in `validateAnswer()` in `useLessonState.ts`
4. **Add rendering case** in `LessonRunner.tsx`
5. **Create JSON content** with matching `correct_answer` structure

### 13.2 Do's and Don'ts

**DO:**
- Use `onSubmit()` return value for feedback
- Call `onNext()` only after success + user clicks Continue
- Call `onRetry()` after error + user clicks Try Again
- Play `ui_tap` for interaction checks
- Reset local state on exercise index change

**DON'T:**
- Validate answers in the component
- Use `setTimeout` for state transitions or score updates
- Play `edu_error` for interaction validation
- Call `onNext()` unconditionally
- Assume field names from one activity type apply to another

### 13.3 Debugging Tips

- **Console warnings:** Look for `'[LessonEngine] submitAnswer blocked: ...'`
- **React DevTools:** Inspect `useLessonState` hook: `state`, `currentExerciseIndex`, `results`
- **Data verification:** Check raw JSON to verify `correct_answer` field names match `validateAnswer()` expectations
- **Stale closures:** Use `useRef` alongside `useState` for values accumulated over time in callbacks/setTimeout
