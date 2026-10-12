---
title: Research foundation
status: draft
updated: 2026-10-09
---

# Research foundation

> The published evidence behind the design: what is established about color, shape, gamification, rewards and children's motor ability, how strong each finding is, and what it means for the system built in [[UI-LIBRARIES]] and [[DESIGN-SYSTEM]].

> **Status: draft.** The owner made this evidence base rule 5 of the frontend rules ([[FRONTEND-GUIDE]], D-009 in [[DECISIONS]]). Sections 1 to 8 report literature and carry no product decisions. Section 9 is the agent's reading of that literature against the current tokens and is proposed, not yet approved.

## Role

Stops design claims from becoming rules without evidence. An agent given "blue builds trust" or "round shapes feel safe" applies it everywhere, so every claim here has a grade, and only some grades may become rules.

## Read this when

- Choosing a color, shape, size, reward, celebration or feedback message.
- Designing anything a child taps, answers or earns.
- Someone, including an agent, states a design principle as fact.

## Provenance

Adapted from `frontend-bible/01-RESEARCH-FOUNDATION.md` of the previous version (git tag `archive/pre-clean-slate-2026-10-08`, file `docs/littlefounders-spec/frontend/frontend-bible/`). Kept: the findings, their grades and the sources, re-checked for wording. Left out: the previous owner decisions (typeface, age bands, streak policy, bounce policy), the reference-screen analysis, the section on writing context files for AI agents, and the practitioner anti-pattern catalogue, because none of those is literature on how people perceive or learn. All numbers about our own palette were measured again on the current tokens (section 9).

## 1. Evidence grades

| Grade | Meaning | May become |
|---|---|---|
| A | Meta-analysis, large replicated study, or binding standard such as WCAG | A rule (must, must not) |
| B | One strong study, or converging qualitative evidence | A strong default (should) |
| C | Contested, mixed replication, or expert consensus without controlled data | A guideline with its caveat stated |
| D | Practitioner folklore, blog level, or unverified | Nothing. Do not encode it |

## 2. Color psychology

- **Color-in-Context theory** (Elliot and Maier, 2012 and 2014) is the leading framework: a color carries meaning, can influence behavior, and its effect depends on the psychological context. The same color produced opposite effects in different contexts (Meier et al., 2012: red made people walk faster to a dating interview and slower to an intelligence interview). **Grade A:** there is no context-free meaning of a color.
- **Red and achievement** (Elliot et al., 2007) is unstable. Four replications on the word "red" found effects near zero (Collabra, 2020, N from 69 to 1,149, d from -0.23 to 0.19); another supported the original on evaluation and failure focus (2019). **Grade C:** plausible, possibly small, not settled; the field's own review asks for prudence before real-world use.
- **Consequence.** "Blue is trust", "green is calm", "red is danger" are not universal facts (grade D as universals). They can be conventions of this product, applied the same way everywhere. The value of a semantic color is consistency, not an innate meaning.

## 3. Shape psychology

- Bar and Neta (2006) reported a preference for curved objects. The meta-analysis of Chuquichambi et al. (2022, 61 records) found it "reliable but not universal", moderated by presentation time, stimulus type, expertise and task, and small to non-significant for spatial design such as rooms and buildings. A follow-up found lower curvature preference for objects with many affordances. **Grade A** for "reliable but not universal"; **grade C** for any mechanism such as threat avoidance.
- **Consequence.** "Round shapes feel safe" is not a justification. Defensible reasons for large radii and capsule controls are functional: a capsule is a closed, self-contained hit region and so reads as pressable, and a consistent radius scale makes the hierarchy between controls and surfaces legible. A control must never become less legible as a control in order to look soft.

## 4. Gamification

- Sailer and Homner (2020, meta-analysis): significant but small effects on cognitive (g = 0.49), motivational (g = 0.36) and behavioral (g = 0.25) outcomes, with high heterogeneity; the cognitive effect was stable in rigorous subsets, the other two less so. Game fiction (a story or world) helped behavioral outcomes; competition helped when combined with collaboration, not alone. **Grade A** for "small, positive, heterogeneous"; **grade B** for the two moderators.
- **Consequence.** Story-driven framing (a character, a world, missions) is the best-supported element; competition alone is the least supported. Claims that gamification "boosts engagement" need that qualification.

## 5. The reward trap

- Deci, Koestner and Ryan (1999, meta-analysis of 128 experiments): engagement-, completion- and performance-contingent tangible rewards undermined free-choice intrinsic motivation (d = -0.40, -0.36, -0.28); positive informational feedback enhanced it (d = +0.33 free-choice, +0.31 interest); tangible rewards were more detrimental for children than for college students, and verbal rewards less enhancing for children. **Grade A**, and it is about this audience.
- The effect is contested in language-learning contexts specifically (grade C there); the general meta-analytic evidence is stronger.
- **Consequences, derived from the findings:** feedback should inform ("you split the fraction correctly") rather than control ("keep your streak!"); a reward should not be the point of a screen; a celebration should mark a real milestone, since engagement-contingent rewards undermine most.

## 6. Loss aversion and streaks

- A loss weighs about twice a gain (Kahneman and Tversky). Applied to streaks it can raise retention and anxiety. A qualitative case study of a language-learning app (arXiv:2203.16175) documents apprehension and self-recrimination from gamification misuse. **Grade B**, one app, qualitative. Reports of anxiety in children from parent blogs are **grade D** and are not evidence. Whether and how to use streaks is a design-ethics decision for the owner, not something the literature settles.

## 7. Cognitive load: decoration that is not content

- Meta-analyses of the **seductive details effect** (Rey, 2012; Sundararajan and Adesope, 2020, overall g about -0.33): interesting but irrelevant additions to learning material reduce learning. **Grade A.** Decoration placed inside learning material has a measurable cost; decoration that is the content (the character who teaches) is a different matter.

## 8. Accessibility and children's motor ability

- **Binding standards (grade A), WCAG 2.2:** normal text contrast 4.5:1 (1.4.3); large text 3:1; interface components and graphics 3:1 (1.4.11); color never the only channel (1.4.1); target size at least 24 by 24 CSS px (2.5.8, AA) and 44 by 44 (2.5.5, AAA).
- **Children are not small adults (grade A/B).** Children aged 7 to 10 missed 7 mm targets almost 30 % of the time, and 11 to 17 year olds about 20 % (Anthony et al., 2013). Nielsen Norman Group, from usability studies with about 125 children aged 3 to 12, recommends targets of at least 2 cm by 2 cm for young children, four times the adult 1 cm, notes that dragging is hard for young children while tapping and swiping are easy, and distinguishes at least the bands 3 to 5, 6 to 8 and 9 to 12. 44 CSS px is roughly 7 to 11 mm on common phones: it satisfies WCAG and adults but sits inside the range where 7 to 10 year olds still err.
- **Color-vision deficiency.** Red-green deficiency affects up to about 8 % of males and 0.5 % of females of Northern European descent; pooled global estimates are nearer 4.5 % and 0.4 %, and lower in Asian and African populations. The local rates for Mexico and Brazil are not established by the sources gathered, so no rate is assumed. The design consequence is the same at any rate: never use color as the only channel (grade A for prevalence, with that caveat).

## 9. What this means for the current system

Measured on 2026-10-09 on the tokens in `frontend/src/styles/lf-theme.css`: WCAG relative luminance for contrast, and the Machado et al. (2009) simulation of protan, deutan and tritan vision at full severity with CIELAB ΔE76 for separation. ΔE76 is a coarse metric and the threshold used here, "about 15 or less collapses", is a working heuristic, not a standard.

**Label color on each fill** (the rule that follows from WCAG 1.4.3: only deep fills take white text, bright fills take dark ink, and each fill token ships with its own on-color, chosen by measurement):

| Fill | White | Ink `#11132a` | Label used |
|---|---:|---:|---|
| Primary `#5c55fd` | 5.03 | 3.63 | white |
| Success `#028048` | 5.02 | 3.64 | white |
| Error `#c4172a` | 5.99 | 3.05 | white |
| Berry `#cc2e72` | 5.00 | 3.65 | white |
| Accent `#eb7301` | 3.01 | 6.07 | ink |
| Sky `#4b94ff` | 3.01 | 6.07 | ink |
| Mint `#05a893` | 2.99 | 6.11 | ink |
| Reward `#ebb806` | 1.84 | 9.90 | ink |

The tokens already follow this. Text on the page: foreground 16.8:1 in light and 17.9:1 in dark, muted text 7.6:1 and 9.6:1, the brand indigo as text 4.9:1 (light, `#5850f8`) and 6.0:1 (dark, `#7a84ff`); control edges 3.3:1 in light and 4.8:1 in dark; the primary fill against the page 4.6:1 and 3.8:1.

**Separation under color-vision deficiency**, worst of the three types, ΔE76 (normal vision in brackets):

| Pair | Worst | Reading |
|---|---:|---|
| Success and error | 17.8 (108.6) | Collapses. The right/wrong pair needs icon and word |
| Mint and sky | 15.2 (80.4) | Collapses |
| Accent and reward | 15.7 (40.4) | Collapses, close even in normal vision |
| Accent and berry | 17.1 (74.5) | Collapses |
| Mint and success | 17.4 (26.3) | Close even in normal vision |
| Primary and sky | 20.9 (47.9) | Marginal |
| Error and berry | 22.8 (37.7) | Marginal |
| Accent and error | 23.9 (43.5) | Marginal |
| Accent and success | 32.3 (98.5) | Separated |
| Accent and mint | 54.8 (107.4) | Separated |
| Primary and berry | 66.2 (83.6) | Separated |
| Reward and mint | 70.9 (92.4) | Separated |

**Directives for this system, each tied to a finding above (proposed):**

1. **Color is a convention defined once.** Meaning lives in the tokens and is applied uniformly; no component assigns its own (section 2). This is already how the token layer works.
2. **Each fill has its measured on-color.** A new fill is added only with its label color chosen from the table method above (grade A, WCAG 1.4.3).
3. **Two channels for every state.** A correct or incorrect answer, a category, a status or an achievement is carried by an icon and a word as well as a hue. The pairs in the table above that collapse must never be the only difference between two meanings (section 8).
4. **Target sizes by audience.** 48 px is the floor everywhere (above WCAG's 44), 56 px the default control, 64 px for primary actions. Surfaces where a young child answers or plays use 76 px, which is 2 cm, through the `--ctl-xl` token, with spacing between targets of at least 12 px; a dragging gesture is never the only way to do something (section 8). Which surfaces count as young-child surfaces is decided per feature with the owner.
5. **Radius is functional.** A control keeps a closed, clearly pressable shape; radius scales with the element's shortest side, so a small card does not use a hero radius (section 3).
6. **Feedback informs.** Feedback copy states what was done right or wrong; XP, coins and seeds are secondary chrome, not the hero of a screen; a celebration marks a real milestone, never a routine click (section 5).
7. **Story over rivalry.** When a feature needs motivation, character, world and missions come first; competition alone is the weakest option (section 4).
8. **Decoration that is not the content stays out of learning material** (section 7).

## 10. What is deliberately not concluded

- That any color has an innate emotional meaning.
- That rounded shapes are inherently safer or friendlier.
- That gamification boosts engagement without qualification.
- That the "8 % of men" figure applies to this product's markets.
- That a streak is harmful or safe: the case-study evidence is qualitative and from one app.

## 11. Sources

**Color:** Elliot and Maier (2014), *Annual Review of Psychology* 65, 95-120; Elliot and Maier (2012), *Advances in Experimental Social Psychology* 45, 61-125; Elliot et al. (2007), *Journal of Experimental Psychology: General* 136, 154-168; Meier, D'Agostino, Elliot, Maier and Wilkowski (2012), *PLoS ONE*; four replications on processing the word "red", *Collabra: Psychology* 6(1), 2020; "The power of red: the influence of colour on evaluation and failure, a replication", *Acta Psychologica*, 2019.

**Shape:** Bar and Neta (2006), *Psychological Science* 17(8), 645-648; Chuquichambi, Vartanian, Skov, Corradi, Nadal, Silvia and Munar (2022), *Annals of the New York Academy of Sciences* 1518(1), 151-165; Djebbara et al. (2023), affordances and curvature preference, *Annals of the New York Academy of Sciences*.

**Motivation and gamification:** Deci, Koestner and Ryan (1999), *Psychological Bulletin* 125(6), 627-668; Sailer and Homner (2020), *Educational Psychology Review* 32, 77-112; "When gamification spoils your learning: a qualitative case study of gamification misuse in a language-learning app", arXiv:2203.16175.

**Cognitive load:** Rey (2012), *Educational Research Review* 7(3), 216-237; Sundararajan and Adesope (2020), *Educational Psychology Review*.

**Accessibility and children:** W3C, WCAG 2.2, success criteria 1.4.1, 1.4.3, 1.4.11, 2.5.5 and 2.5.8; Nielsen Norman Group, *Design for Kids Based on Their Stage of Physical Development* (2024) and *UX Design for Children (Ages 3-12)*, 4th ed.; Anthony, Brown, Nias and Tate et al. (2012-2013), children's touch and gesture input on mobile devices, and touch interaction for ages 3 to 6, *International Journal of Human-Computer Studies* (2014); Machado, Oliveira and Fernandes (2009), a physiologically based model for simulation of color vision deficiency, *IEEE TVCG*; "A Global Perspective of Color Vision Deficiency", *Healthcare* (MDPI), 2025, and pooled estimates cited by secondary sources (grade C).

## 12. Method

- Contrast: WCAG 2.x relative-luminance formula, computed.
- Color-vision simulation: Machado et al. (2009) matrices at severity 1.0 for protan, deutan and tritan, applied in linear RGB; separation as CIELAB ΔE76; the worst of the three is reported.
- The literature was retrieved on 2026-09-20 for the original document; secondary sources (blogs, parent guides) were read but not relied on for any grade A or B claim. The palette measurements were redone on 2026-10-09.

## Related

- [[FRONTEND-GUIDE]]
- [[DESIGN-SYSTEM]]
- [[UI-LIBRARIES]]
- [[CHILD-SAFETY-AND-PRIVACY]]
- [[DECISIONS]]

Back to [[INDEX]].

## Update this document when

- A palette token changes: re-measure section 9.
- A finding is added, regraded or retracted.
- The owner approves or changes a directive in section 9.
