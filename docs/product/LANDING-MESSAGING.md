---
title: Landing messaging
status: draft
updated: 2026-10-10
---

# Landing messaging

> What the landing page says and why: who it speaks to, the promise, the order of the sections, and what is still an assumption.

> **Status: draft.** Written from the owner's call with an advisor on 2026-10-09 and applied to the landing the same day. The age ranges and the exact words are not validated with parents yet (T-014).

## Role

Keeps the landing's words consistent across sessions and languages, and records which statements are decisions, which came from the advisor's suggestion, and which are guesses to test. Copy itself lives in `frontend/src/i18n/<locale>/site.json`; rules for writing it are rule 12 in [[CLAUDE]] and rule 1 in [[FRONTEND-GUIDE]].

## Read this when

- Changing any text on the landing page, the page title or the search description.
- Adding a section, a testimonial, a number or a claim to the page.
- Deciding who the product speaks to.

## What the advisor said, and what was done

| Observation | What the landing does now |
|---|---|
| The headline did not say whose financial future it was. A parent should read it as theirs, and the message must be "hyper clear" about who it is for. | The headline speaks to the parent: "Let your kids practice money before it's real." The first sentence under it names the ages, 13 to 18 (D-027 in [[DECISIONS]]). |
| "Practice field" sounds like soccer. "Playground" brings parents and kids to mind quickly, and a playground gives kids a sense of ownership and accountability. | "Playground" is in the hero's lead (es-MX "un espacio para jugar y aprender", pt-BR "playground"); "practice field" is gone. |
| Attention lasts about ten seconds. The page must be crystal clear in that time. | The hero answers who (your kids), what (practice money before it's real) and what it is not (real money) with one headline, one sentence and two buttons. |
| The four patterns parents ask for belong on the home page: money habits, saving, staying out of debt, entrepreneurship. | A section of four numbered steps, in that order, each with the age it opens (see below). |
| Show a maturity model, a step function, so parents see the long-term path and the product is not "hundreds of lessons". The model is Duolingo's: first the alphabet, then words, then sentences. | The four steps are a numbered list, one row per step with its age. The lead says it works the way you learn a language. |
| "Clear goals and decisions" sounds like business language, not parent and child language. | Business vocabulary is out; the words are habits, saving, debt, a business of their own. |
| Do not sell by fear. Fear holds kids back; inspire and give hope. | No fear copy. The problem section keeps its published figure and turns straight to "your child can start practicing today, with no real risk". |
| A sense of ownership: "my dad thinks I'm grown up". | "Their decisions, their results." |
| Parent stories and testimonials would connect the interviews to the page. | Not on the page: nothing is invented. T-014 collects real ones, with the parent's consent. |

## The page, in order

1. **Hero.** Who it is for, the promise, no real money, two calls to action (parent, and "I just want to learn" for older kids). The 3D Mentors stay.
2. **The evidence.** "By age 7, money habits are already forming" (University of Cambridge, 2013) and the share of adults in the visitor's own country who do not understand money basics (S&P Global FinLit Survey, 2014), each language with its own country's figure. The 3D dinosaurs stay.
3. **The path.** Four skills, one step at a time:
   1. Money habits, from age 13
   2. Saving, from age 13
   3. Staying out of debt, from age 15
   4. Starting a business, from age 17
4. **What stays true.** No real money, ever; their decisions, their results.
5. **The ask.** The same two buttons.

## Assumptions to validate

- **The age ranges.** The advisor sketched the order from his own story and said which ages make sense is for the owner to say after talking to parents; he also mentioned the segments 6 to 12, 12 to 15 and 16 to 18 for analysis. On 2026-10-10 the owner set the platform for ages 13 and over (D-027, after 12 to 18 the day before), so the page says "ages 13 to 18" and "From age 13, 13, 15, 17"; children from 6 can still sign up (D-025), but the page does not address them. Change it in the locale files once parents answer.
- **"Playground".** It is the advisor's word, tested on one person. The advisor offered to help test exact words with parents.
- **Free to start and the Mentor.** The previous search description promised both. Neither is promised now, because pricing is not decided and the Mentor is not part of what the page explains yet.

## Not applied, on purpose

The call also covered the sign-up flow, what an active user is, return-visit messages and fund-raising. Those are product and analytics questions, not landing text; see T-015 in [[BUILD-TASKS]].

## Related

- [[PRODUCT-REQUIREMENTS]]
- [[USER-FLOWS]]
- [[FRONTEND-GUIDE]]
- [[RESEARCH-FOUNDATION]]
- [[CHILD-SAFETY-AND-PRIVACY]]
- [[GLOSSARY]]

Back to [[INDEX]].

## Update this document when

- Any landing copy, title or description changes.
- A parent interview or test changes a word, an age range or the order.
- A testimonial is added.
