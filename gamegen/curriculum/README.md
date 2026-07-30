# `gamegen/curriculum/` — game blueprint authoring

One directory per course, one file inside it:

```
gamegen/curriculum/<course-slug>/games.yaml
```

A **game blueprint** is the human-designed input to Arcade. It is not a game: it is the
brief a game is generated *from*. `npm run catalog:check` validates every file here, and
the pipeline's free `validate` stage runs the same checks before the first paid call.

This is **content design, reviewed by a human**. The pipeline code never writes or edits
these files — a `catalog:check` finding about content goes to whoever authors the file
(`gamegen/AGENTS.md`).

Authoritative spec: [`/GAME_ENGINE.md`](../../GAME_ENGINE.md) §8 (concept binding) and §9
(the pipeline). Forge's equivalent layer, which this one is modeled on, is
[`coursegen/curriculum/`](../../coursegen/curriculum).

---

## The file format

```yaml
schema_version: 1
course: first-lemonade-stand        # MUST equal this directory's name
density: 1                          # optional: expected games per covered topic

games:
  - topic_path: estacion-de-pruebas/camara-de-tipos/tipos-story
    slug: contar-monedas-sorter
    mechanic: sorter
    micro_objective: "Separar monedas de billetes hasta que la caja quede ordenada."
    skin_brief: "Puesto de limonada al atardecer, caja de madera, monedas doradas."
    difficulty: 2
    tier: 2
    position: 1                     # optional
```

### Fields

| Field | Required | Rule |
|---|---|---|
| `topic_path` | ✅ | `"<adventure>/<saga>/<topic>"` — must resolve to a real topic in `coursegen/curriculum/<course>/catalog.yaml`. See **The binding** below. |
| `slug` | ✅ | kebab-case, ≤64. **Unique within its topic** (the `games` table carries `UNIQUE (topic_id, slug)`). The same slug under a *different* topic is fine. |
| `mechanic` | ✅ | One of the 8 closed ids: `sorter`, `launcher`, `runner`, `stacker`, `autobattler`, `explorer`, `defender`, `flyer`. Anything else is rejected by name. |
| `micro_objective` | ✅ | ≤300 chars. The ONE thing this game consolidates. Games consolidate; they do not teach. |
| `skin_brief` | ✅ | ≤600 chars. Art/setting direction for `author` and, through it, Prism. Prose only — never a URL, never a hex colour (the palette is a closed set chosen inside the document). |
| `difficulty` | ✅ | `1`–`5`, same scale as a Forge lesson blueprint. |
| `tier` | ✅ | `1`–`3` — the Piaget audience band (tier1 6–7, tier2 8–10, tier3 10–12). |
| `position` | — | `1`–`64`, ordering within the topic (`UNIQUE (topic_id, position)`). Omit across a whole topic and declaration order is the order. |

Course-level `density` is optional and purely an authoring target: every covered topic
carrying a different number of games produces a **warning**, never an error.

---

## The binding — the one rule that fails a run

**Every game binds to a `learn/` concept, and the binding is DATA.** `topic_path` is
resolved against Forge's own catalog:

```
coursegen/curriculum/<course-slug>/catalog.yaml   →   adventures/*.yaml   →   the topic
```

At publish time that path becomes `games.topic_id`, a `NOT NULL` foreign key. So a
`topic_path` that does not resolve is a **hard error**, not a warning: the game would be
an orphan, and orphan games do not exist. `catalog:check` names the blueprint and the
closest real topic paths so a typo is a one-line fix:

```
ERROR curriculum/first-lemonade-stand/games.yaml: game "contar-monedas-sorter" binds to
topic_path "estacion-de-pruebas/camara-de-tipos/tipos-storyy", which does not exist in
coursegen/curriculum/first-lemonade-stand/catalog.yaml — closest topics in this course:
"estacion-de-pruebas/camara-de-tipos/tipos-story", ...
```

Catching this here is the whole point: the alternative is discovering it at `publish`,
after `plan`, `author`, `judge`, `localize` and `illustrate` have all been billed.

> **This check is DEV/CI-time only.** Railway deploys gamegen with `--path-as-root`, so
> `coursegen/` does not exist in the production image and this cross-package read cannot
> run there. Nothing on a request path may call it — it runs from `npm run catalog:check`
> and from the pipeline's free `validate` stage on an operator's machine or in CI.
> `gamegen-ci.yml`'s path filters must include `coursegen/curriculum/**`, or a Forge
> rename breaks every binding here with nothing failing.

---

## Running the check

```bash
cd gamegen
npm run catalog:check              # every course directory here
npm run catalog:check -- curriculum/first-lemonade-stand   # just one
```

Non-zero exit on any error. Output per course: how many blueprints, how many topics they
cover out of the bound course's total, and the mechanic distribution.

### Errors (the run stops)

- `games.yaml` missing, unparseable, or failing the schema
- `course:` disagreeing with the directory name — one of the two is a typo, and the
  consequence is a whole course of games bound to the wrong curriculum
- an unknown `mechanic`
- a `topic_path` that does not resolve
- a duplicate `slug` or `position` within one topic
- Forge's course catalog unreadable (reported **once**, naming the file — not once per
  blueprint)

### Warnings (a design conversation, not a broken file)

- a `tier` that disagrees with the `age_tier` of the adventure the topic sits in — an
  author may deliberately pitch a consolidation game one band easier than the lesson
  that taught it
- mechanics left unused, once the course has at least 8 games
- one mechanic covering more than 40% of the course — variety is the point of having
  eight
- a topic whose game count differs from the declared `density`

---

## Authoring notes

- **One concept per game.** If `micro_objective` needs an "and", it is two games.
- **Pick the mechanic the concept wants**, not the one that sounds fun: sorting money
  into categories is a `sorter`; trading off price against demand is a `launcher` or an
  `autobattler`; accumulating savings is a `stacker`. The mechanic *is* the argument the
  game makes about the concept.
- **Spread the mechanics across a course.** Eight identical `sorter` games teach one
  interaction, not eight concepts.
- **Copy `topic_path` out of the adventure file**, do not retype it. The grammar is
  identical to Forge's `review_of` / `prerequisites` paths.
- **Write `skin_brief` for a child's eye**: setting, objects, time of day, mood. It is
  the only art direction the generated sprites will ever get.
- **No child data, ever.** Blueprints carry the concept, the age tier and the brief.
  Nothing derived from a user row goes into a prompt (`/AGENTS.md` §1.9).
