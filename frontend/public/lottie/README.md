# Lottie Animation Definitions

**This folder contains a series of Lottie files intended exclusively for the platform's UI.**

Each file has a **single, predefined purpose** within the platform. These animations **MUST NOT** be reused for unrelated features, screens, or UI elements unless this document is explicitly updated.

The visual state of every animation is determined exclusively by the conditions described below. Non-negotiable.

**Last updated:** July 15, 2026.

---

# General Definitions

The following terms are used throughout this document.

### Activated

An animation is considered **Activated** when the user has completed **at least one lesson during the current day**.

### Not Activated

An animation is considered **Not Activated** when:

- The associated counter is greater than zero.
- The user has **not completed any lesson today**.

This means the user has historical progress, but today's activity has not yet activated the animation.

### Default Color

The animation is displayed using its original colors exactly as designed.

### Black

The entire animation is rendered as solid black.

Used to indicate that the associated value is exactly zero.

### Black & White

The animation is displayed in grayscale (without color).

Used to indicate that historical progress exists, but today's lesson has not yet been completed.

---

## `frontend/public/lottie/streak.lottie`

This animation represents the user's **Day Streak**.

It MUST be used only for:

- Current Day Streak display.
- Streak increment animation after completing a lesson.
- Any Lesson Engine component that represents the user's streak.

It MUST NOT be used for any statistic unrelated to the user's streak.

### Animation State

- **Streak = 0**
  - Animation is solid black.

- **Streak > 0 AND no lesson has been completed today**
  - Animation is black and white.

- **Activated AND Streak between 1 and 99 days**
  - Animation uses its default colors.

- **Activated AND Streak between 100 and 364 days**
  - Animation uses the blue color variant.

- **Activated AND Streak ≥ 365 days**
  - Animation uses the purple color variant.

---

## `frontend/public/lottie/lesson.lottie`

This animation represents the user's **Lessons Completed**.

It MUST be used only for:

- Lessons Completed counters.
- Lesson statistics.
- Any Lesson Engine component representing completed lessons.

It MUST NOT be used for any other platform statistic.

### Animation State

- **Lessons = 0**
  - Animation is solid black.

- **Lessons > 0 AND no lesson has been completed today**
  - Animation is black and white.

- **Activated (at least one lesson completed today)**
  - Animation uses its default colors.

---

## `frontend/public/lottie/gold-coin.lottie`

This animation represents the user's **Gold Coins**.

It MUST be used only for:

- Gold balance.
- Gold rewards.
- Gold earnings.
- Any Lesson Engine component representing the platform's Gold currency.

It MUST NOT be used for XP, points, streaks, achievements, followers, or any statistic other than Gold.

### Animation State

- **Gold = 0**
  - Animation is solid black.

- **Gold > 0 AND no lesson has been completed today**
  - Animation is black and white.

- **Activated (at least one lesson completed today)**
  - Animation uses its default colors.

---

## `frontend/public/lottie/time.lottie`

This animation represents **Learning Time**.

It MUST be used only for:

- Total learning time.
- Daily learning time.
- Study duration.
- Any Lesson Engine component representing time spent learning.

It MUST NOT be used for countdowns, timers, clocks unrelated to learning, or loading indicators.

### Animation State

- **Learning Time = 0**
  - Animation is solid black.

- **Learning Time > 0 AND no lesson has been completed today**
  - Animation is black and white.

- **Activated (at least one lesson completed today)**
  - Animation uses its default colors.

---

## `frontend/public/lottie/followers.lottie`

This animation represents the user's **Followers**.

It MUST be used only for:

- Followers counter.
- Followers statistics.
- Social profile sections displaying followers.

It MUST NOT be used for Following, friends, subscriptions, likes, or any unrelated social metric.

### Animation State

- **Followers = 0**
  - Animation is solid black.

- **Followers > 0 AND no lesson has been completed today**
  - Animation is black and white.

- **Activated (at least one lesson completed today)**
  - Animation uses its default colors.

---

## `frontend/public/lottie/following.lottie`

This animation represents the user's **Following** count.

It MUST be used only for:

- Following counter.
- Following statistics.
- Social profile sections displaying followed users.

It MUST NOT be used for Followers, friends, subscriptions, likes, or any unrelated social metric.

### Animation State

- **Following = 0**
  - Animation is solid black.

- **Following > 0 AND no lesson has been completed today**
  - Animation is black and white.

- **Activated (at least one lesson completed today)**
  - Animation uses its default colors.

---

## `frontend/public/lottie/loading.lottie`

This animation represents the platform's **Loading State**.

It MUST be used only while content, data, or UI elements are actively loading.

It MUST NOT be used as:

- Success animation.
- Completion animation.
- Reward animation.
- Empty state.
- Decorative animation.
- Idle animation.

### Animation State

Unlike the other animations in this directory, `loading.lottie` does **not** depend on user progress or lesson completion.

Its appearance is always the original animation.

It should begin playing immediately when a loading process starts and stop immediately once the loading process finishes.

---

# Maintenance Rules

This document is the single source of truth for the intended usage of every Lottie animation inside `frontend/public/lottie/`.

Whenever:

- a new Lottie file is added,
- an existing animation changes purpose,
- a color state is modified,
- or a new visual rule is introduced,

this document **MUST** be updated accordingly.

Any implementation that conflicts with the definitions described here should be considered incorrect.