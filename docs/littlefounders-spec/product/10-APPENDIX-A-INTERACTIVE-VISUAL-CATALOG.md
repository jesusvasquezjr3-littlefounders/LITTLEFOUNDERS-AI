# Appendix A — Interactive Visual & Operational Reasoning Catalog

**Status:** Authoritative reference for requirement B.7 in `10-PRODUCT-GOLD-STANDARD-REQUIREMENTS.md`. This appendix exists because B.7 mandates that the visual/graphic resource be the defining pedagogical mechanism of the product, not one exercise family among many — that mandate cannot be specified responsibly without first surveying the full space of what exists, rather than a hand-picked subset. This document has two parts: **Part 1** is the complete taxonomy of chart and diagram types documented in the data-visualization literature, each tagged for relevance to LittleFounders. **Part 2** is a research-grounded catalog of interactive *operations and animated demonstrations* — a distinct discipline from chart typology, concerned with how a learner manipulates a live model and watches it respond, per the explicit product requirement that the "Pizarrón" represent operations and animations, not only static-form charts. **Part 3** maps twelve core financial/economic concepts to the specific technique that should teach them.

**Relevance tags used throughout:** **Core** (should exist in the v1 component library; broadly applicable across age tiers/subjects), **Situational** (real pedagogical value but narrow — gate to specific subjects/age tiers), **Out of scope** (no credible pedagogical fit for a children/teen financial-literacy curriculum; listed for completeness only, per the explicit instruction not to bias the research toward a pre-selected subset).

---

## Part 1 — Chart & Diagram Taxonomy

Cross-referenced against: the Financial Times "Visual Vocabulary," The Data Visualisation Catalogue, Data-to-Viz, ASQ's Seven Basic Tools of Quality, Tableau's chart guides, and standard project-management references. ~65 distinct types across 11 categories.

### 1.1 Comparison

| Type | How it works / what it shows | Best suited for | Relevance |
|---|---|---|---|
| Bar chart (horizontal) | Compares discrete categories by bar length | Many or long category labels | **Core** — all tiers (e.g., "coins earned per chore") |
| Column chart (vertical bar) | Same as bar chart, vertical orientation | Few categories, quick visual read | **Core** — all tiers |
| Grouped (clustered) bar/column | Sub-category bars placed side by side within each category | Comparing 2–4 sub-series across categories | **Core** — e.g., Save/Spend/Share by week |
| Stacked bar/column | Sub-category values stacked to show total + composition | When both whole and parts matter | **Core** — budget composition |
| 100% stacked bar/column | Normalized stacked bars showing proportional share | Comparing composition shares regardless of size | **Situational** — teens comparing allocation strategies |
| Diverging bar chart | Bars extend left/right from a zero baseline, color-coded | Budget variance, net gain/loss | **Core** — "over/under budget" views |
| Lollipop chart | Line + dot instead of full bar | Many categories, less visual clutter | **Situational** — leaderboards, long skill lists |
| Dot plot (Cleveland) | Single point per category on a shared axis | Many categories with close values | **Situational** — comparing many students' scores (staff-facing) |
| Slope chart | Connects two time points per category with a line | Before/after comparison across entities | **Situational** — "savings rate this month vs. last" |
| Radar/spider chart | Multiple variables on axes radiating from a center | Multi-dimensional profile comparison | **Core** — comparing budgeting/saving/investing/credit skill profile |
| Bullet graph | Compact bar with a target marker and performance bands | Metric vs. goal on a dashboard | **Core** — savings-goal progress vs. target |
| Population pyramid | Two mirrored horizontal bar charts | Distribution across two mirrored groups | **Out of scope** — no demographic-comparison use case |

### 1.2 Composition / Part-to-Whole

| Type | How it works / what it shows | Best suited for | Relevance |
|---|---|---|---|
| Pie chart | Circle divided into proportional slices | Simple composition, ≤5–6 categories | **Core** — Save/Spend/Share is a native fit |
| Donut chart | Pie chart with a hollow center, often holding a KPI number | Composition + a callout metric | **Core** — same as pie, with a headline number |
| Stacked area chart | Areas stacked over time | How composition of a total changes over time | **Core** — allocation trend over months |
| 100% stacked area chart | Normalized stacked area over time | Tracking shifting composition percentages | **Situational** — teens, longer time horizons |
| Waterfall chart | Sequential positive/negative bars bridging start to end | Explaining how sequential gains/losses build a total | **Core** — "how your allowance became your ending balance"; unit-economics profit build |
| Marimekko (mosaic) chart | Stacked bar where width AND height both vary | Composition across categories of different sizes | **Situational** — teens, market-share style Entrepreneurship content |
| Treemap | Nested rectangles sized by value | Relative magnitude within a hierarchy | **Situational** — portfolio holdings by sector (Investing, teens) |
| Sunburst chart | Concentric rings by hierarchy level | Multi-level hierarchical composition | **Situational** — spending category → subcategory drill-down |
| Nightingale rose (coxcomb) | Pie variant where radius encodes magnitude | Cyclical/categorical data, historical framing | **Out of scope** — no clear fit; visually striking but low clarity for children |
| Icicle chart | Axis-aligned band variant of a sunburst | Hierarchy + magnitude, more readable than sunburst | **Situational** — same use as sunburst, alternate layout |

### 1.3 Distribution

| Type | How it works / what it shows | Best suited for | Relevance |
|---|---|---|---|
| Histogram | Bins continuous data, shows frequency as bar height | Shape/spread/skew of one variable | **Situational** — teens/staff, e.g., quiz-score spread |
| Box plot (box-and-whisker) | Median, quartiles, outliers via box + whiskers | Comparing spread across groups compactly | **Situational** — teens, comparing cohort savings amounts |
| Violin plot | Box plot + mirrored density curve | Full distribution shape across groups | **Out of scope** — too statistically dense for this audience |
| Dot/strip plot (distribution) | Individual points along an axis | Small/medium datasets, every value visible | **Situational** — staff-facing analytics only |
| Beeswarm plot | Jittered dot plot avoiding overlap | Distribution of individual points without occlusion | **Out of scope** — staff/analytics tool, not learner-facing |
| Density plot (KDE) | Smoothed continuous probability curve | Comparing distribution shape between groups | **Out of scope** — too abstract for the audience |
| Ridgeline plot (joyplot) | Stacked overlapping density plots | Distribution change across many categories/time | **Out of scope** — analytics-only, not curriculum-facing |
| Stem-and-leaf plot | Splits values into stem/leaf digits | Small datasets preserving raw values | **Out of scope** — a classroom-statistics tool, not a fintech-app fit |
| Frequency polygon | Line connecting histogram bin midpoints | Comparing distribution shapes of datasets | **Out of scope** — redundant with simpler options here |
| Q-Q plot | Sample quantiles vs. theoretical distribution | Statistical distribution testing | **Out of scope** — pure statistics tooling |

### 1.4 Relationship / Correlation

| Type | How it works / what it shows | Best suited for | Relevance |
|---|---|---|---|
| Scatter plot | Individual points on two numeric axes | Correlation, clusters, outliers between two variables | **Core** — allowance amount vs. amount saved |
| Bubble chart | Scatter plot with a third variable as bubble size | Three numeric dimensions at once | **Core** — risk vs. return vs. investment size (Investing) |
| Scatter plot matrix (SPLOM) | Grid of scatter plots for every variable pair | Exploratory analysis across many variables | **Out of scope** — analytics/staff only |
| Connected scatter plot | Scatter plot with points connected in sequence | How a two-variable relationship evolves over time | **Situational** — teens, price vs. time in Investing |
| Parallel coordinates | Each variable on a parallel axis, one line per observation | Multivariate comparison across many dimensions | **Out of scope** — too complex for the audience |
| Heatmap / correlation matrix | Grid with color intensity encoding value | Spotting patterns across many variable pairs | **Out of scope** — staff/analytics only |
| Hexbin plot | Scatter data binned into shaded hexagons | Density between two variables with many points | **Out of scope** — analytics-scale data only |

### 1.5 Trend Over Time

| Type | How it works / what it shows | Best suited for | Relevance |
|---|---|---|---|
| Line chart | Connects points across a continuous axis | Trend, direction, rate of change | **Core** — foundational, all tiers |
| Area chart | Line chart with filled area beneath | Emphasizing magnitude of a single trend | **Core** — savings growth over time |
| Time series (multi-line) | Multiple line series on shared time axis | Comparing trends of related metrics | **Core** — teens, comparing strategies |
| Step chart | Line transitions in discrete steps, not diagonals | Data that changes at specific points | **Situational** — interest-rate changes, tax brackets |
| Candlestick / OHLC chart | Open/high/low/close per period as a "candle" | Financial price movement and volatility | **Situational** — Investing course, teens only |
| Sparkline | Tiny axis-free inline trend line | Compact glance next to a KPI number | **Core** — next to account balance, goal cards |
| Calendar heatmap | Calendar-shaped grid shaded by daily value | Daily patterns/streaks over a year | **Core** — directly matches existing streak mechanic |
| Streamgraph | Stacked area displaced around a central axis | Composition change over time, thematic style | **Out of scope** — aesthetic over clarity for this audience |
| Horizon chart | Compresses time-series range into color bands | Comparing many series in small space | **Out of scope** — analytics/staff only |
| Bump chart | Tracks *rank* of categories over time | Relative ranking change over time | **Situational** — "most popular savings goals this month" |
| Control chart (SPC) | Time-ordered line with center line + control limits | Detecting abnormal variation in a process | **Out of scope** here (learner-facing); retained as a staff/quality tool only |

### 1.6 Hierarchy

| Type | How it works / what it shows | Best suited for | Relevance |
|---|---|---|---|
| Tree diagram (node-link) | Branching parent-child nodes/edges | Structures, decision breakdowns, taxonomies | **Core** — course/skill tree, decision-branch lessons |
| Dendrogram | Tree from hierarchical clustering | Statistical cluster analysis | **Out of scope** — pure statistics tooling |
| Org chart | Tree diagram for reporting/authority relationships | Team/company structure | **Situational** — Entrepreneurship, "build your team" lessons |
| Treemap / Sunburst / Icicle | (cross-ref 1.2) | Hierarchy + magnitude | See 1.2 |

### 1.7 Flow / Process / Network

| Type | How it works / what it shows | Best suited for | Relevance |
|---|---|---|---|
| Sankey diagram | Directional flows, arrow/ribbon width = quantity | Visualizing flows and losses through a system | **Core (flagship)** — money flow: income → spending categories → savings/investing |
| Flowchart | Boxes/arrows representing sequential steps and decisions | Documenting a process step by step | **Core** — "how to open an account," process explainers |
| Decision tree | Branching diagram of decision points and outcomes | Illustrating choice consequences | **Core** — save vs. spend vs. invest branching lessons |
| Network / node-link diagram | Nodes connected by edges | Relational/connected data | **Out of scope** — no relational-data use case for learners |
| Chord diagram | Circular node arrangement with flow-width arcs | Many-to-many relationships/flows | **Out of scope** — too complex for the audience |
| Arc diagram | Nodes on a line with arcs above/below | Simpler network relationships | **Out of scope** — no clear use case |
| Funnel chart | Shrinking stacked segments, stage by stage | Conversion/attrition processes | **Situational** — staff-facing acquisition funnels only |
| Swimlane diagram | Flowchart organized into role/actor lanes | Multi-actor processes with handoffs | **Situational** — "parent approval → child request → bank" process explainer |
| Gantt chart | Horizontal bars per task on a timeline | Project/schedule tracking | **Out of scope** — no project-management use case for learners |
| PERT/CPM diagram | Node-and-arrow task-dependency network | Critical-path project planning | **Out of scope** — too advanced/corporate |
| Process Decision Program Chart (PDPC) | Tree mapping a plan plus failure points/countermeasures | Risk-anticipation planning | **Out of scope** — corporate quality-management tool |

### 1.8 Set Relationships

| Type | How it works / what it shows | Best suited for | Relevance |
|---|---|---|---|
| Venn diagram | Overlapping circles showing set intersections | Shared vs. unique membership, 2–3 sets | **Situational** — "savers AND investors AND budgeters" style content |
| Euler diagram | Like Venn, shows only overlaps that actually exist | Accurate real-subset relationships | **Situational** — same use, more precise |
| UpSet plot | Matrix + bars replacing circles for 4+ sets | Intersections among many sets | **Out of scope** — analytics tool, unreadable for the audience |

### 1.9 Quality-Management / Root-Cause / Business Diagrams

| Type | How it works / what it shows | Best suited for | Relevance |
|---|---|---|---|
| Ishikawa (fishbone) diagram | Branching structure mapping causes to an effect | Structured root-cause analysis | **Situational (niche)** — Entrepreneurship, teens: "why did my business idea fail" |
| Pareto chart | Descending bar chart + cumulative-% line (80/20 rule) | Identifying which causes drive most impact | **Situational (niche)** — Entrepreneurship, teens: "which 3 expenses are 80% of your spending" |
| Check sheet | Structured tally form for recording occurrences | Raw data collection before analysis | **Out of scope** — a data-collection form, not a learner visualization |
| Stratification | Splitting aggregate data into subgroups | Uncovering hidden subgroup patterns | **Out of scope** — analytics technique, not learner-facing |
| Affinity diagram | Clustering raw ideas into thematic groups | Organizing qualitative/brainstormed input | **Out of scope** — a facilitation tool for adults, not curriculum content |
| Interrelationship digraph | Cause-effect links among interacting factors | Complex multi-factor problem analysis | **Out of scope** — too abstract, corporate origin |
| Matrix diagram | Grid crossing factor sets to show relationship strength | Many-to-many relationship evaluation | **Out of scope** — corporate planning tool |
| Prioritization matrix | Weighted scoring/ranking of options | Objectively prioritizing initiatives | **Out of scope** — corporate planning tool |
| Mind map | Radial branching from a central topic | Brainstorming, organizing a broad topic | **Situational** — could support the Mentor's "plan & notebook" feature |

### 1.10 Geospatial

All entries in this category — choropleth map, cartogram, proportional symbol map, dot density map, flow map — are **Out of scope**. The curriculum has no geographic-distribution dimension today; listed here only for completeness of the research pass.

### 1.11 Other Notable Types

| Type | How it works / what it shows | Best suited for | Relevance |
|---|---|---|---|
| Gauge / KPI dial | Speedometer-style arc showing one value's position in a range | At-a-glance single metric | **Situational** — use sparingly; literature flags this as low-information "chart junk" beyond one hero KPI |
| Pictogram / isotype chart | Repeated icons, each representing a fixed quantity | Making quantities intuitive for young/general audiences | **Core (flagship for youngest tier)** — "each piggy-bank icon = $10 saved" |
| Waffle chart | 10×10 grid of squares, filled count = percentage | Friendlier, more precise alternative to pie for simple % | **Core** — youngest tiers, Save/Spend/Share alternative to pie |
| Word cloud | Word size weighted by frequency | Lightweight summary of qualitative/text themes | **Out of scope** — imprecise, no clear curriculum fit |
| Stat tile / scorecard | Large numeral, often with sparkline/delta | Dashboard building block for one key metric | **Core** — "Total Saved This Month" style summary cards |

---

## Part 2 — Interactive Operations & Animated Demonstrations

This is a distinct discipline from chart *typology*: it concerns how a learner directly manipulates a live model of a process and watches it respond, which is what the product's mandate to represent "operations and animations" requires beyond static or semi-static chart forms. Grounded in: PhET Interactive Simulations' design research (University of Colorado Boulder), Desmos/GeoGebra's parametric manipulation model, Bret Victor's "Explorable Explanations," Universal Design for Learning's multiple-representation principle, and virtual-manipulatives research in math/finance education. Full source list at the end of this appendix.

### 2.1 The sixteen reusable interaction primitives

| # | Pattern | Mechanic | Pedagogical grounding | Financial-literacy examples |
|---|---|---|---|---|
| 1 | Parameter slider, live-recomputed output | Sliders drive variables; any change instantly redraws the visual, no submit step | PhET real-time feedback; Desmos slider substitution | Compound-interest growth curve; Rule-of-72 doubling marker |
| 2 | Direct-manipulation drag point (constraint recompute) | Dragging a point/object live-recomputes every mathematically dependent element | GeoGebra "drag test" — 1.02 effect size in Chan & Leung's meta-analysis of dynamic geometry software | Dragging a supply/demand curve to a new equilibrium |
| 3 | Drag-to-reallocate, live totals | A fixed total splits into segments; dragging a boundary raises one and lowers another, labels update live | UDL multi-representation + opportunity-cost concreteness | Budget category reallocation; portfolio asset-allocation slider |
| 4 | Two/multi-curve overlay comparison | Two+ series from shared inputs drawn on one axis so their divergence is the lesson | Victor's "explorable example" — linked simultaneous representations | Simple vs. compound interest; debt snowball vs. avalanche race |
| 5 | What-if branching simulator | Learner picks a strategy; tool re-runs a full simulation per branch, shown side by side | Victor's reactive document applied to a strategy choice, not just a number | Save-vs-spend-now future value; rent-vs-buy outcome |
| 6 | Step-by-step animated replay with pause/scrub | A multi-step process renders as a scrubbable timeline; internal state updates at each step | PhET controllable animation; CPA's sequential concreteness | Loan amortization scrub, payment by payment |
| 7 | Before/after toggle comparison | A switch swaps between two states with a smooth transition, isolating one variable's effect | UDL contrast principle | Pre-tax vs. after-tax paycheck; with/without employer match |
| 8 | Guided "little puzzle" sandbox | An open sandbox with subtle cues and a lightweight goal steers exploration without instructions | PhET's implicit-scaffolding framework: affordances, constraints, cueing, feedback | Lemonade-stand profit challenge; "balance the budget" mini-game |
| 9 | Live-linked multi-representation panel | The same model shown in 2+ representations (flow + bar + number), wired to one input | UDL's multiple-representation principle made literally simultaneous | Tax-bracket Sankey + stacked bar + effective-rate number |
| 10 | Threshold/marker reveal on a continuous curve | A slider's continuous motion triggers a marker/flag exactly when a condition is met | PhET cueing; Desmos glider-on-curve mechanic | Rule-of-72 doubling flag; "years until debt-free" marker |
| 11 | Constrained trade-off chooser | Learner allocates a small number of discrete tokens among competing options, visibly spending down the resource | Manipulatives' concreteness applied to an abstract economic idea | "Pick 2 of 5 wants with your $20" activity |
| 12 | Draggable curve-shift with live equilibrium recompute | Whole curves shift; a dependent marker animates to its new resting position | PhET affordances + GeoGebra/Desmos dependent recompute | Supply/demand curve shift; price-floor/ceiling shading |
| 13 | Real-time running-total ledger | Every discrete action immediately updates a visible running ledger/meter | PhET's tight immediate feedback loop | Per-sale profit-margin readout; savings-goal thermometer |
| 14 | Reactive "what-if" text | Numbers embedded in explanatory prose are themselves editable/draggable; changing one updates the sentence and a linked chart | Bret Victor's literal "reactive document" | "If you saved $[5]/week at [7]% for [10] years, you'd have $[X]" |
| 15 | Overlay/ghost-trace replay | A frozen "ghost" of a prior run is compared against a new animated run for a direct visual delta | Extends Victor's comparison + UDL contrast into a temporal form | "Extra $50/month toward debt" ghosted against the minimum-payment trace |
| 16 | Zoom/scale toggle for long-horizon effects | Learner switches between a near-term and a decades-long view of the same process | PhET's use of scale/speed controls to reveal effects invisible at normal timescales | Compound interest flat at 2 years, dramatic at 40; a daily habit's cost compounding over a career |

**Design principles that must govern every pattern above** (from the PhET/Victor/UDL research base): start in the simplest possible state on load; every visible element must carry conceptual meaning (no decoration without purpose); interaction should guide toward a specific phenomenon rather than being an open-ended, purposeless sandbox; help must be available on request but never block the view; and — critically for a graded, server-authoritative lesson engine — the "server never trusts client scores" principle already established in the audit (D4) must extend to every gradable interactive operation, not only to the traditional 57 exercise types.

---

## Part 3 — Concept-to-Technique Mapping (Financial/Economic Concepts)

| Concept | Recommended technique(s) | Age/course fit |
|---|---|---|
| Compound interest growth | Pattern 1 (parameter slider) + pattern 16 (zoom/scale toggle) | All tiers from ~10+; Financial Education, Investing |
| Simple vs. compound interest | Pattern 4 (multi-curve overlay) | Tier 3+, Financial Education |
| Loan amortization | Pattern 6 (step-by-step scrub) | Teens, Investing/Entrepreneurship |
| Budget allocation/reallocation | Pattern 3 (drag-to-reallocate) | All tiers — pairs naturally with the existing Save/Spend/Share pie |
| Supply and demand | Pattern 2 + pattern 12 (draggable curve-shift) | Teens, Entrepreneurship |
| Opportunity cost | Pattern 11 (constrained trade-off chooser) | All tiers, age-appropriate token counts |
| Inflation's erosion of purchasing power | Pattern 1 + pattern 16 | Teens, Financial Education/Investing |
| Rule of 72 | Pattern 1 + pattern 10 (threshold marker) | Teens |
| Debt payoff strategies (snowball/avalanche) | Pattern 5 (what-if branching simulator) | Teens, Financial Education |
| Diversification/portfolio risk | Pattern 3 + pattern 2 (dependent risk/return point) | Teens, Investing |
| Unit economics (a small business) | Pattern 8 (guided sandbox) + pattern 13 (running ledger); waterfall chart (Part 1, §1.2) | All tiers — "My First Lemonade Stand" is the native home for this |
| Marginal tax brackets | Pattern 9 (live-linked multi-representation: Sankey + bar + number) | Teens, Financial Education/Investing |

---

## Sources

**Chart taxonomy:** Financial Times "Visual Vocabulary" (chart-doctor GitHub repo and PDF); The Data Visualisation Catalogue (full list and chart-selection guide); Data Viz Project; From Data to Viz; ASQ Seven Basic Quality Tools; Wikipedia (Seven Basic Tools of Quality, Bullet graph, Mosaic plot, Affinity diagram); SPC for Excel (Ishikawa's seven tools, control-chart rules); Tableau chart guides and bullet-graph explainer; Domo (Marimekko chart); ConceptDraw (affinity diagrams / 7 management-planning tools); visualizing.org (UpSet plot); The Node (Venn/Euler/UpSet); Asana (PERT chart); ProjectManager.com (project charts, swimlane diagrams); Smartsheet (PERT vs. Gantt); iSixSigma (control charts); Datylon (80 types of charts).

**Interactive operations/demonstrations:** PhET Interactive Simulations research page and AAPT design-principles paper (University of Colorado Boulder); Podolefsky, Perkins & Adams on implicit scaffolding (ResearchGate, arXiv); PhET interview studies on engagement/learning; PhysPort and ACS Journal of Chemical Education on PhET effectiveness; Desmos Help Center (sliders and movable points); Chan & Leung (2014) meta-analysis of dynamic geometry software; Bret Victor, "Explorable Explanations" (worrydream.com) and Wikipedia's entry on the concept; IRIS Center (Vanderbilt) and Reading Rockets on Universal Design for Learning; Wikipedia on manipulatives and virtual manipulatives in math education; IES blog on virtual manipulatives for fractions; Bouck, Long & O'Reilly (2024) on virtual money manipulatives; Toy Theater, Brainingcamp and ThreeJars as existing money-manipulative tools; plus concept-specific tools reviewed for design patterns: PennyTime, Banzai, ChooseFI, Bankrate, shadcn, Visme, EconLearn, Marginal Revolution University, Federal Reserve Education, Foundation for Teaching Economics, MobLab, TES (inflation basket simulator), CalcScope (Rule of 72), Monarch (debt payoff calculator), Portfolio Visualizer, SmartAsset, My Lemonade Stand, and Engaging Data's tax-bracket visualizer.

**Citation caveat:** the Concrete–Pictorial–Abstract (CPA) framework referenced in Part 2 is documented here via Fennema (1973) and Van de Walle & Thompson (1984) as retrieved; the broader literature also associates this progression with Bruner's enactive–iconic–symbolic modes (Bruner, *Toward a Theory of Instruction*, 1966), which was not directly retrieved in this pass and should be verified by name if the final PRD needs a hard primary citation.
