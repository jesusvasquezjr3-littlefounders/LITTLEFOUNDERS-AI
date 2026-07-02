# Lesson Factory — Archived generators (reference only)

> **These files are superseded by `../generate_v3.py`. Kept as reference; do not run for new content.**

| File | What it was | Why archived |
|------|-------------|--------------|
| `generate_v1.py` | Original v1 generator (~39 KB), broad per-type logic baked in code. | Predates the `exercise_registry.json` single-source-of-truth; hardcoded shapes drifted from the Lesson Engine components. |
| `generate_v2.py` | v2 drafter → gate → retry pipeline (DeepSeek). | (a) DeepSeek was retired; (b) its system prompt only spelled out `correct_answer` shapes for ~7 of the 47 types, so generated lessons for the other 40 drifted from what the components consume (the exact class of grading bug found in the 2026-07 engine audit). |

## What `generate_v3.py` does differently (the reference lessons learned)
1. **Taxonomy-pure by construction.** It derives the per-type `content` + `correct_answer` contract for **all 47 canonical types** from `schema/exercise_registry.json` (the single source of truth, anchored to the frontend `exerciseTypes.generated.ts` and the actual activity components) — nothing is hardcoded per type, so it cannot drift.
2. **Model-agnostic.** The drafter LLM is injected (a `complete(system, user) -> dict` callable). No provider is hardwired, so a retired model can't strand the pipeline.
3. **Same quality bar, stronger enforcement.** Reuses the `gate` (LessonV2 structure + abstraction + vocabulary + content_quality + feedback) and adds the semantic answer-key contracts from `validate.py::validate_answer_keys` so the exact audit bugs (positional mindset grading, missing sorting/drag classifications, options-mode portfolio/shop keys, etc.) can never be generated.

Keep these two files to compare prompt phrasing, retry/gate wiring, and the gold-exemplar approach — but author new lessons only with v3.
