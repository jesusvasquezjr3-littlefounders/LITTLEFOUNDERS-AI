# Appendix K — Achievement Sharing Research Brief

**Status:** Authoritative research foundation for requirements F.x in `10-PRODUCT-GOLD-STANDARD-REQUIREMENTS.md`, covering the badge-sharing mechanism reachable from a child's territory screen and the public `/badge/{token}` page it generates. Unlike Appendices B, D, G, and I, this is a single-report research brief rather than a multi-pillar deep dive — the initial structural read of this domain found the open questions here to be mostly product and governance decisions (revocation, disclosure, brand position) rather than genuinely disputed science, and the user directed a proportionate, lighter research pass. It answers one question: **does a company-hosted, permanent, unauthenticated public page displaying a specific named child's achievement — created at a verified parent's request, as a first-party growth/acquisition mechanism — sit on solid ground, and what would a defensible version of it look like?**

**A note on scope, stated honestly up front:** this is a comparatively novel, under-litigated fact pattern. No FTC enforcement action, consent order, or court ruling was found addressing this exact combination (parent-initiated, first-party, permanent, public, growth-instrumented). What follows is a well-sourced risk analysis built from adjacent, verified precedent — not a citation trail proving this design has already been tested and found wanting. It should be reviewed by counsel before any specific claim below is treated as a compliance conclusion rather than a risk-reduction recommendation.

---

## Part 1 — Regulatory and Legal Precedent

### 1.1 COPPA's disclosure doctrine reaches a company-hosted public page, regardless of who clicked "share"

The COPPA Rule's definition of "disclose or disclosure" (16 CFR 312.2) has two independent prongs: releasing a child's personal information in identifiable form for any purpose, and — the one that matters here — **"[m]aking personal information collected by an operator from a child publicly available in identifiable form by any means."** LittleFounders' badge page is disclosure under this second prong regardless of who initiated it: the operator is the one hosting it, on its own infrastructure, reachable by the entire internet. The FTC's own "Complying with COPPA: Frequently Asked Questions" (FAQ D.12) states that "disclosure" includes "making a child's personal information publicly available in identifiable form through an email service or other means, such as a social network," and that an operator "must get verifiable parental consent before enabling children to share personal information in this manner, even through third parties."

**Honesty flag:** FAQ D.12 is framed around a *child* initiating a share via an in-app feature, not a *parent* initiating it on the child's behalf — LittleFounders' actual mechanic. This is the closest on-point FTC guidance found, but it is not a perfect match, and no source resolves whether a verified parent's affirmative "share" action changes the legal analysis of an otherwise-identical public, permanent disclosure.

### 1.2 Verifiable parental consent must be informed of the specific practice, not a general permission

FTC guidance on verifiable parental consent (VPC) requires that consent methods be "reasonably calculated" to ensure the consenting person is the parent, and that the parent be informed of the *specific* practice being consented to. A blanket, generic "sharing" permission is a weaker compliance position than specific, itemized notice of the exact practice: permanent, public, unauthenticated, marketing-attribution-tagged, and non-revocable except by deleting the entire child's account.

### 1.3 A parent's ongoing right to compel deletion is not meaningfully exercisable at the level of a single disclosure today

16 CFR 312.6 gives a parent an ongoing right to review collected data, refuse its further use, and have an operator delete the child's personal information. A design where the *only* lever to remove one shared badge is deleting the child's entire account does not cleanly honor a right that is supposed to be exercisable at the level of a specific disclosure, not only the account as a whole.

### 1.4 The FTC's retention-limitation rulemaking trend disfavors indefinite retention beyond the purpose served

The FTC's December 2023 NPRM ("FTC Proposes Strengthening Children's Privacy Rule to Further Limit Companies' Ability to Monetize Children's Data") proposes that personal information be retained "only for as long as necessary to fulfill the specific purpose for which it was collected," banning indefinite retention and secondary use. **Honesty flag:** the January 2025 final-rule press release could not be independently re-fetched in this research pass (the indexed URL returned a 404); the retention-limitation language above is drawn from the December 2023 proposal, reported by secondary sources as substantially finalized in January 2025, but the final rule's exact operative text was not independently re-verified — this should be checked directly against ftc.gov or the Federal Register before being quoted as binding. A permanent badge page whose internally documented purpose is an *ongoing* growth loop, not the one-time act of celebrating an achievement, reads as exactly the kind of purpose-creep the rulemaking targets.

### 1.5 FTC v. Epic Games — analogous regulatory posture, not a directly on-point case

FTC v. Epic Games (Dec. 2022, $520M total, $275M COPPA) centered on Fortnite's default-on voice/text chat exposing children to strangers, combined with a COPPA collection-without-consent violation. **This is not a precedent about parent-initiated achievement sharing** — it is cited only for the general regulatory posture it establishes: the FTC scrutinizes real-world exposure of children produced by a platform's own design defaults, not only formal disclosure to a named third party.

### Part 1 — Honest limitations

The central legal question — whether a verified parent's affirmative "share" action converts an otherwise-disclosure-triggering design into a lawful one, given the disclosure is permanent, unauthenticated, and non-revocable — is not resolved by any source found in this research pass. The analysis above lays out the relevant doctrine on both sides as a reasoned legal inference, not a citation of a ruling. FTC v. Cognosphere (Genshin Impact, Jan. 2025) was identified as a recent, high-profile COPPA-adjacent action against a game popular with minors, but only its headline was reviewed, not the full complaint — it concerns loot-box practices, not public disclosure, and is mentioned only for enforcement-priority context, not as precedent.

### Part 1 — Source list

16 CFR 312.2, COPPA Rule definitions (eCFR). — FTC, "Complying with COPPA: Frequently Asked Questions," FAQ D.12. — FTC, "Verifiable Parental Consent and the Children's Online Privacy Rule." — 16 CFR 312.6 (parental review/revocation rights). — FTC, "FTC Proposes Strengthening Children's Privacy Rule to Further Limit Companies' Ability to Monetize Children's Data" (Dec. 2023 press release/NPRM). — FTC, *FTC v. Epic Games, Inc.* press release (Dec. 2022). — FTC, *FTC v. Cognosphere* press release (Jan. 2025) — headline-level only, flagged as unverified beyond that.

---

## Part 2 — Real-World Product Precedent

### 2.1 Verified comparators that chose a more closed architecture

**Mozilla Open Badges** — per Mozilla's own support documentation, "newly earned badges are automatically added to a private user badge collection," and public visibility only occurs if the badge earner affirmatively creates and shares a collection. This is the clearest verified precedent for an alternative architecture: **private by default, public only via explicit, granular, owner-controlled opt-in** — the opposite of LittleFounders' default-generates-a-permanent-public-page model. (Honesty flag: Open Badges/Credly-style credentialing is generally an adult/professional/higher-ed context, not a product built for under-13s; the transferability of the privacy-by-default *principle* to a child-directed product is this appendix's inference, not a claim that Mozilla's system was designed with COPPA-covered users in mind.)

**ClassDojo** — per ClassDojo's own Help Center, a student's portfolio content, once teacher-approved, is visible only to the student, connected family members, and connected teachers. No evidence was found of any public, unauthenticated webpage for ClassDojo content — a clean, verified contrast between a comparable child-directed product's achievement/portfolio feature and LittleFounders' open-web model.

**Strava** — per Strava's own Help Center, accounts identified as belonging to a user under 18 get restrictive defaults: only followers see the complete profile/activities, activities are excluded from public leaderboards, and achievement-recognition features ("Local Legend") and activity-replay features ("Flyby") are disabled by default. This is a real consumer platform with genuine achievement/badge mechanics **actively suppressing** public visibility of a minor's achievements by default — the opposite design choice from using a child's achievement as public-reach bait. Strava does not appear to have a "share this specific achievement via public link" flow for minors at all.

### 2.2 Comparators where the specific mechanism could not be confirmed either way

**Duolingo** has well-documented streak and "Friend Streak" features, gated behind an account and a "public profile" privacy setting; marketing materials reference "sharing your streak," but this research pass could not confirm whether that produces a persistent, operator-hosted, unauthenticated public webpage (LittleFounders' model) or an exportable image posted to the user's own social account (a materially different privacy model, since the latter creates no company-hosted permanent URL). This is flagged explicitly as unresolved, not as evidence either way.

**Epic! (kids' reading app)** documents how badges are earned and used to unlock avatar customization, but says nothing about sharing or export — no evidence either way was found.

**Khan Academy Kids, ABCmouse, and Prodigy Education** — no primary-source documentation was found describing these products' achievement-sharing mechanics in enough detail to compare against LittleFounders. Prodigy appears to route parent-facing progress through an authenticated parent dashboard based on product-page descriptions, but this was not confirmed against a document addressing a public-share feature specifically. Direct verification (e.g., test accounts) is recommended if these products need to be cited by name in engineering-facing material.

### Part 2 — Honest limitations

Several of the comparisons above rest on absence of evidence rather than confirmed absence of a feature — this research relied on public help-center documentation and marketing materials, which may not document every edge-case sharing flow, rather than direct inspection of app binaries or network traffic. What can be said with confidence: of the comparators that *were* independently verified in detail (Mozilla Open Badges, ClassDojo, Strava), all three chose a more closed, gated, or suppressed-by-default architecture than LittleFounders' current permanent-public-page model, and none of them match LittleFounders' specific combination of permanent, unauthenticated, indexable, and growth-instrumented.

### Part 2 — Source list

Mozilla Support, "Are all my badges public?" — ClassDojo Help Center, "Who Can See a Student's Portfolio Posts?" — Strava Help Center, "Your Privacy & Control Defaults When You're Under 18 on Strava." — Duolingo Blog, "Friend Streak" announcement; Duolingo support account, public-profile privacy setting. — Epic! Help Center, "How do achievements and badges work?"

---

## Part 3 — The Growth-Loop / Commodification-of-Childhood Tension

### 3.1 A child's identity as a marketing vector — the closest available regulatory-adjacent framing

The UK Advertising Standards Authority / Committee of Advertising Practice guidance, "Use of children as brand ambassadors and in peer-to-peer marketing," is the most directly on-point source found for this specific concern, even though it is UK self-regulatory guidance, not US law, and not written about software products. It names two relevant harms: **exploitation of credulity** (an audience may not recognize marketing intent) and **"commercialization of friendship"** (a peer or family network seeing an apparent personal share that is, in substance, an engineered marketing touchpoint). It requires that marketing activity be "obviously identifiable, whoever conducted it," and recommends seeking parental consent before engaging children in this way. This maps closely onto LittleFounders' badge page: a visitor sees a specific named child's achievement plus a sign-up call to action, with no evident disclosure that this is an acquisition touchpoint.

### 3.2 The "sharenting" academic literature

Recent academic work — titles and abstracts verified via search, not full papers read — uses the term "institutionalized sharenting" to describe cases where an *industry*, not just an individual parent, structures and profits from the public visibility of children (Beuckels et al., "Institutionalized Sharenting: Industry Dynamics Shaping Children's Visibility in Influencer Content," 2026; Marôpo, Jorge, Janiques de Carvalho & Neto, "Memeability and sharenting: The affective economy of children on social media," 2026; see also the Digital Wellness Lab's research brief on sharenting and child influencers). This framework — the platform, not just the parent, designs, hosts, instruments, and profits from the disclosure — is a strong conceptual match for LittleFounders' mechanic. **Honesty flag:** no source in this literature was found discussing LittleFounders or an identical feature; this is this appendix's own application of a general academic framework to LittleFounders' specific mechanic, not a citation of someone else having already made this exact critique.

### 3.3 A notable absence, reported honestly

No named child-safety advocacy report (5Rights Foundation, Common Sense Media, or similar) or piece of journalism was found specifically critiquing an ed-tech or fintech company's "achievement-sharing growth loop" as its own distinct malpractice pattern, despite how common referral/growth-loop mechanics are in consumer software generally and how much scrutiny child-directed apps receive generally. This absence is itself worth reporting honestly rather than papering over — it may mean the pattern is under-recognized rather than that it is unproblematic.

### Part 3 — Source list

UK Advertising Standards Authority / CAP, "Use of children as brand ambassadors and in peer-to-peer marketing." — Beuckels et al. (2026). Institutionalized Sharenting. — Marôpo, Jorge, Janiques de Carvalho & Neto (2026). Memeability and sharenting. — "The Marketization of Childhood: A Critical Examination of Sharenting in the Digital Age" (IBIMA, 2024). — Digital Wellness Lab, "'Sharenting' and Child Influencers" research brief.

---

## A note on intellectual honesty

This brief does not claim LittleFounders' badge-sharing feature is unlawful, nor that any cited source has already examined and condemned this exact design. What it supports: the feature's text matches COPPA's disclosure definition closely enough to warrant real caution; every verified real-world comparator chose a more closed architecture; and a named, real regulatory-adjacent body (the UK ASA/CAP) has already articulated the specific concern — a child's identity used, without obvious marketing disclosure, as a vector into a peer or family network — that this feature's growth-loop framing raises. Where the evidence stops short of certainty — whether parental initiation changes the COPPA analysis, whether other named children's apps share this exact pattern, whether any advocacy body has specifically targeted this practice — this brief has said so directly, and Block F's requirements should be communicated with the same honesty.
