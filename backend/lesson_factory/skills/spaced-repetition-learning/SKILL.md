---
name: spaced-repetition-learning
description: >
  A subject-agnostic spaced-repetition architecture distilled from a CLI tool
  (originally for LeetCode-style practice). Its core idea: after every attempt
  the learner self-rates cognitive friction on a 1-5 scale, and that single
  number directly drives the next review interval, sorting priority, and
  promotion/demotion between "in progress" and "mastered". Use this skill when
  designing adaptive difficulty, review frequency, or mastery tracking for
  LittleFounders lessons.
source: https://github.com/HayesBarber/spaced-repetition-learning
license: MIT
fetched: 2026-06-19
---

# Spaced Repetition Learning — Friction-Rated Adaptive Scheduling

## (a) What it is + overall architecture

A terminal tool (`srl`) for mastering programming problems via spaced repetition.
It is not a heavyweight SM-2/Anki clone — it is a deliberately small, replicable
loop. The whole system is three JSON state files plus a handful of pure functions,
which makes the **architecture trivially portable to any subject**, including
financial-literacy lessons.

State lives in three buckets (`~/.srl/`):

- `next_up.json` — the **queue**: items the learner hasn't started yet.
- `problems_in_progress.json` — items being actively learned/reviewed, each with
  an **attempt history**.
- `problems_mastered.json` — items that cleared the mastery bar (parked, but
  randomly re-audited).

(Plus `audit.json` for re-test bookkeeping and `config.json` for tunables.)

The lifecycle of a single learning item:

```
next_up  ──(first attempt, rated)──▶  in_progress  ──(2× rating 5 in a row)──▶  mastered
                                          ▲                                         │
                                          └────────(failed random audit)───────────┘
```

There is no separate "scheduler service". Scheduling is a *derived property*:
each time you ask "what's due?", the code recomputes due dates on the fly from
each item's last attempt. This is the single most replicable design choice —
**state stores only raw attempts; the schedule is computed, never persisted.**

## (b) The 1-5 post-attempt friction rating and how it maps to scheduling

After each attempt the learner gives one integer rating (validated
`choices=range(1, 6)` i.e. 1-5). The rating expresses **cognitive
friction/stress / how hard it felt**:

| Rating | Meaning (friction)              | Next attempt due in |
|--------|----------------------------------|---------------------|
| 1      | Couldn't solve / needed solution | 1 day               |
| 2      | Solved with significant struggle | 2 days              |
| 3      | Solved with minor struggle       | 3 days              |
| 4      | Solved smoothly, few gaps        | 4 days              |
| 5      | Solved perfectly, confidently    | 5 days              |

The mapping is radically simple — **the rating *is* the interval in days**:

```python
# from get_due_problems() — the heart of the scheduler
last       = history[-1]                                  # most recent attempt
last_date  = datetime.fromisoformat(last["date"]).date()
due_date   = last_date + timedelta(days=last["rating"])   # rating == days
if due_date <= today():
    # item is due for review
```

So low friction (high rating) → longer gap before you see it again; high
friction (low rating) → it comes back tomorrow. There is no multiplicative
ease factor and no growing interval across reviews — each interval is set
**solely by the most recent rating**. Simple, legible, easy to tune.

**Priority/ordering of due items** (what to surface first when many are due):

```python
# oldest last-attempt first, then lowest rating first
due.sort(key=lambda x: (last_date, last_rating))
```

i.e. the most neglected and the most painful items float to the top.

**Promotion to mastered** — requires two consecutive top ratings:

```python
mastered = (len(history) >= 2
            and history[-1]["rating"] == 5
            and history[-2]["rating"] == 5)
```

On promotion the item's full history moves to `problems_mastered.json` and it
leaves the active rotation.

**Demotion / durability check (audits)** — mastered items are not trusted
forever. With probability `audit_probability` (default 0.1), or after
`max_days_without_audit`, the system randomly pulls a mastered item for a
surprise re-test:

```python
return random.random() < probability        # should_audit()
```

- Audit **pass** → just logged (stays mastered, counts as an implicit rating 5).
- Audit **fail** → the item gets a fresh attempt of **rating 1** appended and is
  moved back into `in_progress` (due tomorrow). This is the forgetting-recovery
  loop: long-untested knowledge can decay, so it is forced back into circulation.

## (c) The replicable, subject-agnostic data model + scheduling loop

Strip out "LeetCode" and the model is fully generic. An *item* = anything to be
learned (a concept, a skill, a lesson, a question type).

**Data model (per item):**

```jsonc
// in_progress / mastered entry
{
  "item_id": {
    "url": "optional reference link",
    "history": [
      { "rating": 3, "date": "2026-06-15" },
      { "rating": 5, "date": "2026-06-18" }
    ]
  }
}
// next_up entry (not yet started)
{ "item_id": { "added": "2026-06-19", "url": "..." } }
```

Only raw facts are stored: rating + date per attempt. Everything else is derived.

**The core loop (pseudocode, subject-agnostic):**

```
1. SELECT what to study now:
     due = []
     for item in in_progress:
         last = item.history[-1]
         if last.date + days(last.rating) <= today:
             due.append(item)
     due.sort(by = (oldest last.date, then lowest last.rating))
     if due is empty: pull fresh items from next_up queue
     # optionally, with small probability, inject a surprise audit of a mastered item

2. PRESENT one item to the learner; they attempt it.

3. RATE friction 1-5 after the attempt; append {rating, date} to history.

4. UPDATE state:
     if last two ratings == 5  -> move item to mastered
     elif audit failed         -> append rating 1, move mastered item back to in_progress
     else                      -> stays in_progress, next due = today + rating days
```

Tunables worth exposing: the rating→interval function (here identity in days),
the mastery threshold (here 2× top score), audit probability, and max-days-
without-audit. Everything else is mechanical.

## How to apply to LittleFounders (adaptive difficulty + review frequency for ages 5-18)

This architecture maps cleanly onto the Lesson Factory's goal of adaptive
difficulty and spaced review. Concrete adaptations:

1. **Make "friction" age-appropriate and implicit.** Young children (5-8) should
   never type a 1-5 rating. Derive the friction score automatically from
   in-lesson signals — hints used, retries, time-to-answer, wrong attempts —
   and collapse them into the same 1-5 scale (5 = answered fast & first try,
   1 = needed the answer revealed). Teens (13-18) can optionally self-rate
   "how confident did that feel?" with emoji/stars mapped to 1-5. Either way the
   downstream scheduling math is identical, which is the whole point of the
   abstraction.

2. **Use rating → interval to control *review frequency*.** A concept the child
   nailed (4-5) shouldn't reappear for several sessions; one they struggled with
   (1-2) should resurface next session. Adapt the interval unit from "days" to
   "sessions/lessons" for kids who don't log in daily — `next_due = last_seen +
   f(rating)` where `f` returns sessions, not calendar days, so progress doesn't
   depend on real-world cadence. Optionally widen the gaps with age (older
   learners tolerate longer retention intervals).

3. **Use rating → priority to drive *adaptive difficulty*.** The "oldest +
   lowest-rating first" sort means the child is always re-served their weakest,
   most-neglected concepts first. Extend this: when an item's recent ratings are
   consistently low, the factory should serve an *easier variant* (more
   scaffolding, smaller numbers, more hints) of the same concept rather than
   repeating the identical item; when ratings hit 5, serve a *harder variant* —
   turning the 1-5 signal into a difficulty-ladder controller, not just a timer.

4. **Mastery + audits = durable retention without re-teaching.** Promote a
   concept to "mastered" after two clean top performances, then stop drilling it
   to avoid boredom — but periodically inject a surprise review (the audit loop).
   For kids, frame audits as a fun "challenge round" or "boss check"; a failed
   audit pulls the concept back into active rotation. This gives parents/teachers
   a defensible mastery model and prevents the silent decay of skills learned
   months ago.

5. **Keep state minimal and computed.** Store only `{concept_id, [{rating,
   date/session}]}` per child. Never persist schedules — recompute "what's due"
   each session. This keeps the learner model auditable, easy to tune per age
   band, and cheap to evolve as the adaptive-difficulty rules improve.

**Caveat / deliberate simplification to be aware of:** this model uses a flat
interval (interval = last rating only) with no growing/multiplicative ease
factor across successful reviews. That is great for legibility and for young
learners, but for older teens approaching real long-term retention you may want
to layer a true expanding-interval scheme (SM-2 style) on top of the same
1-5 friction signal.
