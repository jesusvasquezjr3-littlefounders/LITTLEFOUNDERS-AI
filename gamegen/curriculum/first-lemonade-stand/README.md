# `first-lemonade-stand` — the Arcade QA catalog

> **Internal note.** `first-lemonade-stand` is the platform's **non-shipping QA course**.
> Nothing a learner can see says so: its slug, title and description are deliberately
> learner-facing. Only files like this one, and the comments inside `games.yaml`, say what
> it is for.

This directory is the Game Engine twin of Forge's QA course. Forge uses
`coursegen/curriculum/first-lemonade-stand/` to exercise all 56 LESSON_ENGINE segment
types for a fraction of a real course's cost; `games.yaml` here is the smallest catalog
that still forces **one** Arcade run to touch every simulator, every gate and every
per-mechanic schema.

Format, field rules and the `catalog:check` contract live one level up, in
[`../README.md`](../README.md). This file records only what is specific to *this* catalog
and *why* it is shaped the way it is.

---

## What this catalog is for

18 blueprints, 9 of the bound course's 10 topics, all 8 mechanics:

```
sorter=3  launcher=2  runner=2  stacker=2  autobattler=2  explorer=3  defender=2  flyer=2
```

Two blueprints per mechanic is the floor, not a coincidence. A single mechanic instance
can pass by luck — a second one with a different tier, a different difficulty and a
different concept is what makes `simulate` (the perfect-bot / random-bot winnability gate)
and the judge rubric actually mean something for that mechanic.

## The three deliberate choices

**1. All three tiers, on a `tier2` adventure.**
The bound adventure (`estacion-de-pruebas`) declares `age_tier: tier2`, so every tier1 and
tier3 blueprint trips the loader's tier-agreement **warning** — 7 of them, by design. The
loader itself documents that posture: *"an author may deliberately pitch a consolidation
game one band easier than the lesson that taught it."* Here that is exactly what happens.
The tier1 games are counting and sorting drills (`caja-de-monedas-mexicanas`,
`torre-de-los-cinco-pesos`, `mapa-de-la-gran-idea`); the tier3 games are planning and
economy games (`mercado-de-los-20-pesos`, `domingo-completo-de-ventas`,
`vuelo-de-las-ofertas`, `frascos-de-hecho-y-opinion`). Flattening every `tier` to `2` would
silence the warnings and cost the run its tier coverage — which is most of the point.

**2. No `density`.**
A declared density asserts that every covered topic carries the same number of games, and
a uniform catalog is the opposite of what a QA harness wants. Topics carry 2 games, except
`tipos-money`, which carries 3 because it is the topic that actually teaches the most
distinct money skills (counting coins, change from a 20, splitting profit, the savings
goal).

**3. Difficulty spread 1..5, not parked in the middle.**
`d1=3  d2=5  d3=5  d4=4  d5=1`. The author prompt and the judge rubric both see easy and
hard content in one pass, instead of eighteen variations on "medium".

## The binding

Every `topic_path` was copied out of
`coursegen/curriculum/first-lemonade-stand/adventures/01-estacion-de-pruebas.yaml`, and
every `micro_objective` names a concept that topic's own `concept` / `learning_objective`
really teaches — the guitar goal of 80 pesos, the 5-peso cup against its 2-peso cost,
change from a 20-peso bill, needs of the stand against whims that can wait, facts against
opinions. Games consolidate; they do not teach.

The only topic left uncovered is `secuencias-y-repaso/repaso-veloz`, which is Forge's
spaced-review topic (`kind: review_spaced`). Its whole job is to re-ask what earlier topics
taught, so a game bound to it would consolidate a consolidation. If a future run wants a
19th blueprint, that is the honest place to argue about it, not an oversight to patch.

## Language

Content is **es-MX**, matching the bound course's `authoring_locale`; comments and this
README are English (`/AGENTS.md` §1.0.4). Nothing here is user-visible — `localize`
produces the three learner-facing locales downstream.

## Checking it

```bash
cd gamegen
npm run catalog:check -- curriculum/first-lemonade-stand
```

Expected: **0 errors, 7 warnings** (the tier-agreement warnings above). Any error is a real
break — most likely a Forge rename that orphaned a `topic_path`, which is precisely the
breakage this gate exists to catch before the first paid call.
