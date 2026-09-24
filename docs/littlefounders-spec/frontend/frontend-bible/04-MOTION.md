# 04 · Motion — transitions, animation and "juice"

Status: **owner-directed research, applied and verified in the prototype.** v2 (2026-09-20): the celebration budget (owner decision OD-7) is applied to the tokens and rules below; where the mockup disagrees, this file wins. v3 (2026-09-21): motion **assets** (Lottie, rendered sequences) follow these tokens as set out in `07-ICONOGRAPHY-AND-VISUAL-ASSETS.md` §5, and the Mentor character's states on the Diorama are in `08-MENTOR-STAGE.md` §3. Companion to `02-FOUNDATIONS.md` and `03-PROPORTIONS-AND-COMPOSITION.md`. Written in English because the file feeds an AI frontend agent.

The owner's brief for this pass: motion is not a finishing touch, it is one of the core carriers of gamification, and it deserved its own dedicated research session rather than being folded into general UI work. The two concrete requests were (1) avoid the "generic AI transition" — fade/slide applied uniformly with no relationship to what's on screen — and (2) build animations where **the scene's own elements participate** (a green card sliding over to cover what it's confirming, a wave running through a row of items, an exercise sliding out as the next one slides in), not decoration flown in from outside the scene.

---

## 1. What the evidence actually says about "juice"

**The central finding, and the one that shapes every rule below:** Kao (2020, *Entertainment Computing*, the largest controlled study of "juiciness" to date) tested none / low / medium / high / extreme levels of audiovisual feedback in an action RPG and found a **non-monotonic relationship**: medium and high levels outperformed both the complete absence of juice *and* extreme levels, across player-experience, intrinsic-motivation, play-time and in-game-performance measures. Grade **B** (single strong controlled study, not yet a meta-analysis, but well-powered and widely cited). This is the direct evidence against both failure modes this project has now hit once each: the earlier "chunky 3D button" system was too much simulated weight (corrected in `02-FOUNDATIONS.md` §9), and a bare fade/instant-swap interface would be the opposite failure — participants in Kao's dry condition described it as "something was either missing, or incomplete."

Supporting context, all lower-grade but converging: Swink's *Game Feel* (2009) frames juice as the third pillar after real-time control and a predictable simulated space — polish amplifies something that already works, it does not fix something broken. Pichlmair & Johansen's 2020 survey adds the caution that juice-rich interaction can make it hard to learn what aspects of an interface have mechanical importance, unless the exaggeration is itself a deliberate, legible choice. Grade **D** as a general design maxim, but consistent with Kao's quantitative ceiling.

**Design consequence:** every animation in this system has to answer "what does this movement communicate" before it's allowed in. Motion for the sake of motion is exactly the failure mode the evidence warns against.

## 2. Duration — five tokens in three categories

Grounded in Material Design 3's own three-category split (transitions 300–700ms, component state changes 100–300ms, state-layer feedback 50–150ms): `--dur-instant` and `--dur-micro` are state-layer feedback, `--dur-component` is a component state change, `--dur-transition` and `--dur-celebration` are transitions. The split is cross-checked against general mobile-motion practice, which converges on the same bands independently. Named here by **what the movement represents**, not by a number, so an agent extending this system reaches for the right token by asking "what kind of event is this" rather than picking a duration that merely looks right.

| Token | Duration | What it's for |
|---|---|---|
| `--dur-instant` | 80ms | State-layer: a row's press shadow, a tap acknowledgement |
| `--dur-micro` | 150ms | Press/release, a toggle, a small icon swap |
| `--dur-component` | 250ms | A component changes state in place: a badge pops in, a card flips to "done" |
| `--dur-transition` | 380ms | One screen or exercise replaces another |
| `--dur-celebration` | 700ms | A milestone on the closed list (`02` D7, owner decision OD-7): lesson complete, course complete, savings goal reached, badge earned, streak at 7, 30 or 100 days. Once per moment, never per click, never for a correct answer or a coin split |

Easing is named by what enters or exits, not by the shape of the curve, for the same reason: `--ease-enter` (decelerate, arriving on screen), `--ease-exit` (accelerate, leaving), `--ease-standard` (moves within the screen, starts and ends on-screen), `--ease-spring` (overshoot — reserved for the same closed milestone list, never routine UI, so an overshoot always means something). A press and its release use `--ease-standard` (`--dur-instant` in, `--dur-micro` out); small state bumps (an answer selected or correct, a CTA arming) are keyframed scale changes on `--ease-standard`, not spring.

**Resolved in the v2.1 mockup:** spring overshoot is removed from all routine UI (press in 80 ms, out 150 ms, standard easing; the streak wave uses enter easing); spring and confetti remain only on the lesson-complete milestone.

**Deliberate exception, documented in the CSS itself:** the hero object's float (5s), the streak flame's flicker (2.4s) and a pulsing CTA's breathing glow do **not** use these tokens (v3: on the Mentor stage, the character's catalogue idle loop takes the hero object's place, `08` §3). They are idle "the scene is alive" loops, not state transitions — forcing a 5-second float onto a 380ms transition scale would misrepresent what it is. The motion budget from `02-FOUNDATIONS.md` §9.4 still applies: exactly three things get idle motion at once, no more.

## 3. Accessibility — the hard limit that overrides everything above

**35% of adults over 40 have some vestibular dysfunction** (WCAG 2.3.3 analysis), and the reaction — dizziness, nausea, headaches, sometimes requiring the person to stop and lie down — can be triggered by animation the way flashing content triggers seizures, just slower-building. Grade **A** for WCAG 2.3.3 and 2.2.2 being binding standards; grade **B** for the 35% figure (a cited estimate, not this project's own measurement).

The specific, actionable finding (A List Apart, practitioner analysis corroborated by the WCAG working group's own examples): **what triggers a reaction is the size of the movement relative to the screen, not which CSS property is animated.** A small button doing a 3D rotate is unlikely to cause a problem; a full-screen wipe transition is a likely trigger regardless of how "smooth" the easing is. Opacity, color and blur changes are essentially never problematic; large-scale position changes are the actual risk.

**Rule, already implemented and re-verified this pass:** every animation in this system checks `prefers-reduced-motion` — either through the JS `REDUCED()` helper (for Web Animations API sequences) or the `@media (prefers-reduced-motion: no-preference)` guard (for CSS `@keyframes`, which means the animation is simply absent rather than present-and-skipped when motion is reduced). Reduced motion never hides a state change — the wave, the stagger, the exercise slide all still result in the correct final state, only the travel is removed or reduced to a brief cross-fade.

## 4. The three orchestrated patterns built this pass

The owner's request was specific: animations that look "generic AI" are the ones where a floating element enters from nowhere in particular. The alternative is **the scene's own elements doing the moving** — something already on screen transforms into its next state, rather than a new element appearing over it.

### 4.1 Exercise-to-exercise slide (the lesson engine)

**Before this pass:** the lesson screen had exactly one hardcoded question. Advancing "reset" went straight to the result screen with no transition at all — an instant `innerHTML` swap, the single most generic possible interface behavior.

**What was built:** a real 4-exercise sequence per language (12 total question/answer sets, EN/ES/PT), and a transition where the outgoing exercise card is cloned before the DOM swap, then both cards are choreographed together: the outgoing card slides out to the left and fades (`--ease-exit`), the incoming card slides in from the right and fades in (`--ease-enter`), with roughly a 22%-duration overlap so the handoff reads as one continuous motion rather than two separate cuts. The bottom action bar (feedback banner + Check/Continue button) cross-fades in sync rather than snapping to its new state mid-slide — an earlier version of this had the new question's fresh "Check" button visually stacked on the old question's green "correct" feedback for a frame, which was confusing and is now fixed (section 6).

Distance traveled is a **fraction of the track's own width** (18% in, 14% out), not a fixed pixel value, so the motion is proportionate whether the container is a 320px phone or a 1280px desktop panel — this is the same "scale to the container, not a magic number" principle used throughout the composition work in `03-PROPORTIONS-AND-COMPOSITION.md`.

### 4.2 Success-wipe (the requested "green card overlaps on completion" pattern)

Built on the family chores screen: each pending chore now has a real "Approve" action. On approval, a solid `success`-green panel — no border, per the `02-FOUNDATIONS.md` §4.4 rule — covers the row from the top edge, holds briefly with a check mark and the task's own name, then wipes away in the same direction it arrived, revealing the row already updated to "Approved" underneath.

This is the row's own content participating in its own transition, not a toast or a separate confetti burst layered on top. (v2 note: approving a chore is a parent action; in the product this pattern lives in the parent experience. The mockup shows it inside the child's app shell, which is a known deviation.) The direction (top-to-bottom cover, then continuing top-to-bottom to clear) was chosen because it reads like a stamp or a seal being applied — matching what "approve" means — rather than an arbitrary left/right choice.

### 4.3 Wave entrance (the streak strip)

The weekly streak strip's seven day-dots rise and settle in sequence, left to right, like a stadium wave crossing the row — each dot's animation delay is `index × 60ms`, so the motion visibly travels across the row rather than every dot popping in at once. This pattern is reserved specifically for the streak strip, not applied generically to every list in the product: the whole point of that component is "a sequence completed in order," so a wave crossing the row in reading order is the one place where the direction of the motion actually matches what the component means. (v2: the wave uses `--ease-enter`; the mockup's spring curve on it is a known deviation, and an ordinary practised day never celebrates, `02` §9.6.) Applying the same wave to, say, a badge grid (which has no inherent left-to-right sequence) would be motion for its own sake — exactly what section 1 warns against — so the badge grid instead uses a plainer staggered fade-and-rise (section 4.4), not a wave.

### 4.4 Staggered reveal (badge grids)

A simpler, more general pattern for collections that don't have the streak strip's sequential meaning: each item fades and rises in with a capped stagger delay (`min(index, 10) × 45ms`, so a 12-item grid still finishes settling well under a second rather than trailing indefinitely). Applied to the badge grid on both the landing page and the profile screen.

**Critical constraint, verified in code, not just assumed:** this only fires on genuine route entry (`S.enter`), never on an in-place re-render triggered by an unrelated interaction on the same screen. Before this was enforced, toggling an unrelated control (e.g. "show resting state" on the profile page) would have re-triggered the badge stagger and the streak wave every time — exactly the kind of motion-without-a-reason the evidence in section 1 argues against. Confirmed directly: navigating into the profile route fires both animations (7 wave elements, 6 staggered badges); a subsequent click on an in-page toggle fires neither.

---

## 5. Library and tooling notes (for whoever picks this up)

No animation library was added to the prototype — everything above is native CSS `@keyframes`/transitions plus the Web Animations API (already used for the confetti burst and press-ring effects before this pass; since v2, confetti is reserved for the milestone list). OD-12 now selects a future mobile wrapper sharing the web frontend, so these web motion mechanisms remain the implementation target; the wrapper must honor reduced-motion settings and preserve the same tokens (`02` §1.2). That was a deliberate choice for a static prototype, not a recommendation against libraries for production:

- **GSAP became 100% free in 2025** (Webflow now sponsors it), including ScrollTrigger and every previously-paid plugin. It remains the strongest choice for complex, timeline-driven, or scroll-linked sequences — most relevant here if the lesson engine grows scroll-driven transitions or cross-exercise choreography beyond what a CSS/WAAPI slide can express cleanly.
- **Motion (the 2024 rebrand of Framer Motion)** is the dominant choice for React UI animation specifically — declarative, smaller bundle than GSAP's full package, first-class exit/layout animations. The natural choice if/when this design system is implemented in a real React codebase rather than the vanilla-JS prototype harness used here.
- **Native CSS transitions/`@keyframes` and the Web Animations API**, which is everything used in this prototype, remain the right choice for anything that doesn't need cross-browser scroll-linking or complex timeline sequencing — zero added bundle weight, and every effect built this pass (the exercise slide, the success-wipe, the wave, the stagger) was expressible cleanly without a library.

The recommendation for production: start with native CSS/WAAPI as done here; reach for Motion if the codebase is React and the team wants less animation boilerplate; reach for GSAP specifically when a sequence needs precise multi-element timeline control or scroll-triggering that CSS alone can't express well.

---

## 6. Iteration log — what was caught and fixed this pass

**Bug: the lesson-foot overlap.** The first working version of the exercise slide had the bottom action bar (feedback + button) snap instantly to the new exercise's state while the old exercise's card was still visibly sliding out above it — for a frame, the new question's disabled "Check" button appeared stacked on top of the old question's green "correct" feedback banner. Caught by screenshotting the animation mid-flight, not by the automated audits (which check layout overflow, not animation choreography). Fixed by cross-fading the foot in sync with the card slide rather than letting it change state instantly.

**Bug: the approve-row layout.** Adding a fourth column (the "Approve" button) to the existing 3-column row-card grid crowded the task title against the button badly enough to wrap it into an ugly multi-line stack on narrow screens. Fixed by switching that row variant to flex-wrap, with the button given its own full-width line below 480px and returning inline at wider widths — verified with screenshots at both 375px and 768px.

Both fixes were re-verified against the full suite: 1,440 configurations with normal text, 1,440 with WCAG 1.4.12 forced text-spacing, 168 proportion/composition page-states, 0 issues in any of them, 0 JS errors across all 14 routes.

---

## 7. Evidence gaps — flagged, not asserted

- Kao (2020) is one strong study, not a meta-analysis; the exact shape of the "too much juice" ceiling (where it starts, how steep the falloff is) is this one paper's finding, not an established constant.
- The 35% vestibular-dysfunction figure is a cited estimate from accessibility literature, not measured by this project, and prevalence in the platform's actual Mexico/Brazil user base is unknown.
- No test with real children on any of the motion patterns built this pass. Kao's study population was general game players, not this platform's specific audience of children and their parents.
