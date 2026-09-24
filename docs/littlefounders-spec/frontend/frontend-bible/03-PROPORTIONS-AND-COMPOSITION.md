# 03 · Proportion & Composition — why this should feel human-made

Status: **owner-directed research, applied and verified in the prototype.** v2 (2026-09-20): type-scale wording aligned with the mockup and `02`, pricing marked as parked (OD-5), verification re-run. Companion to `02-FOUNDATIONS.md`. Written in English because the file feeds an AI frontend agent.

The owner's brief: mobile and desktop should both feel like the primary surface, not one adapted from the other, and the platform should feel human-made rather than "built by AI." This file documents what the evidence actually says about that feeling, and the concrete rules an agent can follow to reproduce it. Every rule below was applied to the site prototype and re-verified after each change (section 5).

---

## 1. What actually reads as "AI-made" — evidence, not vibes

I could not find controlled experiments that isolate "does this page look AI-generated" as a variable — the claims in this section come from practitioner audits of many AI-built sites, not peer-reviewed studies. I'm grading them **D** (converging craft opinion) and treating them as a hypothesis worth designing against, not as fact.

**The catalogued tell is a specific bundle, not any one part of it:** a centered hero with a badge above the H1, a row of exactly three identical cards (icon, heading, two lines), a numbered 1-2-3 step row, purple-to-indigo gradients, glassmorphism, and every section given the same padding and the same centered-text treatment. Practitioners who reviewed large batches of AI-built launches found this specific combination repeatedly enough to name it ("AI design slop"). None of these elements is wrong on its own — a three-card row is often the right shape for three things. What reads as machine-made is **uniformity without a reason**: every section the same width, every card the same size, every heading the same weight relationship to its body text, nothing asymmetric, nothing that only makes sense for *this* content.

The proposed mechanism (also D-grade, but coherent with what the audits describe): a generative model reverts to the statistical center of its training data when a request is under-specified, and that center is exactly the safe, universal pattern above. The fix practitioners converge on is the same one design systems have always used — locked tokens, a real typographic scale, capped variety — which is what section 3 gives an agent to follow instead of improvising.

**What is NOT evidence for this:** none of this says generic patterns are unusable, and it does not mean novelty for its own sake reads as "human." The next section gives the actual, measured alternative.

## 2. What IS measured, and what it implies

| Finding | Source | Grade | What it means here |
|---|---|---|---|
| Low visual complexity **and** high prototypicality together produce the best first impression, and the effect is set within 17–50 ms | Tuch, Presslaber, Stöcklin, Opwis & Bargas-Avila 2012, two studies, real website screenshots | B | Familiar structure (nav at top, cards for choices, a table for rows) is not the problem. The two knobs that matter are keeping visual complexity low and making sure the structure still reads as *the kind of thing it is* on sight. |
| No reliable preference for the golden ratio in controlled tests; the only strong, replicated preference in rectangle studies is for near-square shapes, and individual variation dwarfs any population-level ratio preference | Green 1995 review; McManus et al. 2010; large cross-cultural replications through 2015–2016 | A (absence of an effect, well replicated) | Do not reach for 1.618 as a magic number. Asymmetry and a clear larger/smaller relationship read as intentional; a specific irrational ratio does not read as anything to a viewer. |
| ~49% of people hold a phone one-handed; ~75% of touches are thumb-driven; the bottom third of the screen is the effortless zone, the middle third needs a stretch | Hoober 2013, 1,333 observed device interactions in public | B | Primary actions belong low on the screen on mobile, not just "responsive" — reachable. Section 4.4. |
| Comprehension peaks around 50–75 characters per line for on-screen reading; both much shorter and much longer lines measurably hurt comprehension or speed, though the exact optimum is contested across studies (55 vs 75–95 cpl) | Dyson & Haselgrove 2001; Dyson & Kipping 1998; later replications disagree on the exact peak | C (real effect, contested optimum) | Cap running text width. I used a conservative ~66-character measure (66 characters ≈ 30em with this typeface's average glyph width — see section 3.2) rather than the higher end of the range, since undershooting is the safer failure mode for a children's product. |
| A heading needs to be *noticeably* larger than body text — subtle size steps read as indecision, not hierarchy | General typographic-hierarchy literature, converging but not a single controlled study | D | A closed, stepped type scale with real jumps between levels (section 3.2), not a fluid `clamp()` that can land anywhere. |
| Buyers rate handmade goods as more attractive than identical machine-made goods, and the effect is driven by a perceived "love"/effort signal, not by objective quality | Fuchs, Schreier & van Osselaer 2015, four studies, *Journal of Marketing* | B (for physical products; extrapolated here) | This is about physical goods with a stated production method, not interfaces — I'm applying it by analogy, not as direct evidence. The transferable idea: specificity and visible effort read as care. A generic stock icon reads as low effort; a screen showing the product's *actual* UI (a real answer choice, a real chore row) inside a marketing card reads as considered, because it could only have been made by someone who used the product. |

## 3. Rules an agent can check mechanically

### 3.1 Spacing: one scale, no off-grid values
All padding, margin and gap values are multiples of 4px: `--s-1` (4) through `--s-32` (128); the full scale (4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80, 96, 128) is the `spacing` block of the `02` YAML. An agent should never hand-write a padding value outside this scale (`--s-1` … `--s-32`, `--target-min/base/lg` for touch sizing). Off-scale spacing was the single largest source of findings when this was audited mechanically (see section 5) — it is invisible to a person eyeballing one screen and obvious as noise across many.

### 3.2 Type: closed, stepped, measured
- Sizes are fixed pixel values at each container-width step, not fluid `clamp()` interpolation (the mockup contains no `clamp()`; `02` §6 and the `02` YAML say the same since v2). Three steps only, keyed to the `app` container width: base (<640px), medium (640–1119px), wide (≥1120px). What steps, as rendered: marketing H1 `display-2xl` 48 / 56 / 72 px; `display-xl` 36 / 40 / 40; `display-lg` (in-app H1) 28 / 32 / 32; `numeral-xl` 40 / 56 / 56. Every other size is fixed at all widths. A size either belongs to the named scale or it is a bug.
- Marketing H1 is at least **3×** the 16px body size. In-app H1 (a lesson question, a page title) is at least **1.5×**, since app headings sit inside a denser, task-focused layout where a 3× jump would crowd the content below it.
- Every page has exactly one `<h1>`.
- Running text (`p`, `.t-body`, `.t-body-lg`) caps at **30em** measure. I derived this from the typeface rather than the `ch` unit: Nunito's average glyph is about 0.45em wide, so 30em ≈ 66 characters, near the middle of the researched range. The `ch` unit (defined by the width of "0", ≈0.60em in this face) would have permitted lines nearly a third longer than intended — a mistake worth flagging since `max-width: 66ch` is a common shorthand that silently assumes a monospace-like average.

### 3.3 Composition: asymmetry with a reason, not decoration
- The hero is a **7:5** split on wide screens (copy: art), never 1:1. The hero art is portrait (4:5) and allowed to overlap into the next section by design, breaking the "every block is a clean rectangle" tell.
- Feature cards use a **7:5 / 5:7** two-up rhythm (a wide card paired with a narrow one), not a uniform 3- or 4-across grid. Where a true uniform grid is the right shape for the content — badges to collect, colour swatches in the system sheet, plan cards in pricing (a route parked for v1, OD-5) — it stays uniform, because forcing asymmetry onto genuinely equivalent items would be decoration for its own sake, which is its own tell.
- Process steps render as a **staircase** (alternating vertical offset, connected by a dotted line) on wide screens, not a row of identically-sized numbered circles.
- The "how it works for families" section **alternates which side the text sits on**, chapter by chapter, rather than repeating the same left-text/right-image block.
- Each feature card shows a **real piece of the product** — an actual answer row, an actual coin, an actual "waiting for approval" chip — rather than a decorative line-icon standing in for the idea. This is the interface analogue of the handmade-effect finding: specificity signals that someone actually built and looked at the thing being described.
- Section rhythm uses three named paddings (tight/default/loose) rather than one constant, and at least one section per page is a full colour block rather than the alternating light/white pattern repeated forever — enough to break a run of three or more identical section treatments in a row, which is the pattern the composition audit (section 5) checks for directly.

### 3.4 Mobile is a primary surface, not a shrink
- Primary actions sit in the bottom third of the screen on phones: the signup/login CTA in the marketing nav, the tab bar in the app, and a **sticky "Start free" bar** that appears on mobile once the visitor scrolls past the first screen of the landing and family pages — so the action is always in the thumb's easy zone without pinning it there from the first paint, which would crowd the hero.
- On mobile, the pricing page reorders the **recommended plan first**, ahead of the free plan, since a phone shows one plan at a time and the free-first order (correct for a side-by-side desktop comparison) would bury the recommendation below a full scroll. *v2: the pricing route is parked and out of scope for v1 (owner decision OD-5); the reordering principle (on a phone, put the item the page exists for first) still applies to any comparison layout.*
- Desktop is not "mobile plus more columns": the hero split, the feature-card asymmetry and the alternating chapters only activate at wider container widths; below that, content stacks in an order chosen for a single reading column, not a squeezed version of the wide layout.

---

## 4. Evidence gaps — flagged, not asserted

- No controlled study isolates "looks AI-generated" as a measured variable; section 1 is practitioner consensus, not an experiment.
- The 55 vs 75–95 characters-per-line optimum is genuinely contested in the reading-research literature; I chose the conservative end for a children's product rather than claiming a settled number.
- The handmade-effect study (section 2) is about physical goods with a *disclosed* production method (a label saying "handmade"). Nothing here tests whether showing real product UI in marketing cards produces a comparable effect for a digital interface — it is a reasoned extrapolation, not a direct finding.
- No test with real children or families on any of this. Every rule above should be treated as the best available starting point, not a validated outcome.

---

## 5. Verification

A second, purpose-built audit (separate from the Text Fit Contract in `02-FOUNDATIONS.md` §7) renders every route and measures the **computed, on-screen** page — not the source code — for:
off-grid spacing and font sizes, running-text measure over the cap, rows of 3+ visually-identical siblings outside the routes where a uniform grid is the correct shape, heading:body ratio below threshold, symmetric (near-1:1) hero splits, more than one accent-coloured button competing for attention on screen, more than one `<h1>`, centered-text share over 50% outside the pages where that is intentional, three or more consecutive sections sharing the same padding/background/layout signature, and interactive targets closer than 8px apart.

**Before these rules were applied:** the same audit, run on the previous build, returned over 100 findings across 28 page states — dominated by off-grid spacing (padding/margin values like 6px, 10px, 30px sitting outside the 4px scale), font sizes with no relationship to a scale, a symmetric 1:1 hero, and a heading:body ratio as low as 1.33.

**Current state (v2.1 mockup):** **0 findings across 492 page states** (17 routes and their state variants, 41 states × 4 widths × 3 languages). Earlier: **0 findings across 168 page states** (14 routes × 4 widths [320/375/768/1280] × 3 languages [EN/ES/PT]). Re-run with the v2 tool on 2026-09-20 (`verification-tools/proportion-audit.reference.mjs`, local Chromium via `CHROME_PATH`): the same 168 states, 0 findings.

This runs alongside, not instead of, the Text Fit Contract audit in `02-FOUNDATIONS.md` §7: that harness confirms nothing clips or truncates; this one confirms the composition around that text follows a deliberate, checkable rhythm. Both passed on the same final build, as reported by the original session: 1,440 configurations with normal text, 1,440 with WCAG 1.4.12 forced text-spacing, 0 issues in either, 0 JS errors across all 14 routes. The v2 re-run of the text-fit audit (768 + 768 reproducible configurations) confirms 0 issues with normal text and finds one real defect under forced text-spacing (a Portuguese course title on `home`); see `02` §7.
