// Game-design playbook — the CREATIVE brief shared by the AUTHOR (what to aim for) and
// the JUDGE (what to score against). ONE module, two injection points, on purpose: the
// twin of `coursegen/src/pipeline/contentPlaybook.ts`, which exists because injecting the
// bar in only one place gives you an author aiming at a different target than the judge
// rejects against — i.e. mechanically-valid, boring content (the 2026-07-23 QA verdict on
// Forge's first exercises, and the reason gamegen/AGENTS.md pins this file by name).
//
// DIVISION OF LABOUR. The Zod contract (`src/contract/`) and the deterministic `gate`
// stage enforce CORRECTNESS: shapes, bounds, closed sets, unique ids, a trap that carries
// its misconception. The `simulate` bot gate enforces WINNABILITY mechanically. THIS file
// enforces VALUE — that the game teaches the concept it is bound to, is worth a child's
// five minutes, and could not be reskinned into meaninglessness.
//
// NOT a copy of contentPlaybook: those rules are exercise-shaped (prompt_md <= 140 chars,
// per-option rationales, one reasoning step per screen) and do not map onto a real-time
// loop with a difficulty ladder. Games reinforce what a lesson already taught (§8 concept
// binding: a game is never a child's first contact with the idea), so the bar here is
// recognition and fluency under mild pressure, not first instruction.
//
// Grounded in the same literature as contentPlaybook (retrieval practice, desirable
// difficulties, dual coding, Piaget's bands, self-determination theory's competence/
// autonomy), plus the one finding that is specific to educational games: a game teaches
// its MECHANIC, not its theme — so the concept must live in the verb, not the wallpaper.
//
// Kept deliberately tight: it ships in EVERY author and judge prompt (and, per the
// prefix-cache rule, sits in the byte-stable leading block), so every line must earn its
// tokens by changing what the model produces.

/** The author-facing playbook. Injected into the AUTHOR prompt as its creative brief. */
export const GAME_PLAYBOOK = [
  'GAME PLAYBOOK — what makes a LittleFounders minigame GREAT (design the manifest to this bar, not merely to the schema):',
  '',
  '1. THE CONCEPT IS THE VERB — the single most important rule. What the player MANIPULATES must BE the idea the lesson taught: the thing sorted, launched, stacked, dodged, bought, built or defended carries the concept, and its `value` / `props` / `category` are that concept\'s real numbers. THE SWAP TEST: mentally replace every label with "cosa A / cosa B / cosa C". If the game still plays the same and is still winnable, the design has FAILED — you built a reskin, not a learning game. Deciding correctly must be IMPOSSIBLE without using the concept.',
  '2. REINFORCEMENT, NOT ASSESSMENT. The child already passed the lesson (a game only unlocks behind it), so reward RECOGNITION and FLUENCY under mild pressure: fast recall of need vs want, which price is cheaper, which coins reach the goal. Never introduce a rule the lesson did not teach, never quiz a definition, never make the first move a gamble. A miss is a one-line teaching beat, never elimination.',
  '3. TRAPS TEACH. Every wrong/avoid/trap item encodes ONE specific, common kid misconception, named concretely in `misconception_md` ("es un capricho, no algo que necesitas hoy", "el número es más grande pero trae menos"). A trap must be TEMPTING and DIAGNOSTIC. Never throwaway noise, never a joke item, never an obviously absurd one: an item nobody would pick diagnoses nothing and wastes a slot a real misconception deserved.',
  '4. WINNABLE AND FAIR — about 80% winnable at the stated tier. Every fact needed to decide is VISIBLE (label, sprite, `value`, category label) BEFORE the player must act; in `falling` / `conveyor` / scrolling configurations the travel time must let a child of that tier READ and DECIDE, not react blindly. Fairness has two edges the free bot gate will check: the intended play MUST reach `pass_score`, and mashing MUST NOT.',
  '5. DIFFICULTY COMES FROM THE CONFIG LADDER, NEVER FROM AMBIGUITY. Ramp the numbers across the ladder/phases/waves — spawn interval, speed, simultaneous elements, included item tiers, wave composition, budget, tolerance, target. NEVER manufacture difficulty from ambiguous labels, an item that honestly fits two categories, hidden information, a fact revealed only after the action, or a surprise the player could not have seen. Confusion is not challenge.',
  '6. POSITIVE STAKES ONLY. Something GOOD is gained: fill the jar, reach the market, keep the stand open, finish the delivery. NEVER a social or shaming stake ("se van a reír de ti", "la clienta se enoja", "te quedas sin nada"). `incorrect_md` lines are outcome-NEUTRAL and ROTATE (write 3-4 distinct short nudges) so a child who misses three times is not shown the same sentence three times.',
  '7. TEXT DISCIPLINE — this is a HUD inside a moving canvas, not a page. `label_md` = one short, literal, drawable object name a 6-year-old reads at a glance and a TTS voice says cleanly ("Manzana", "Boleto $20"), never a sentence, never a pun, never an emoji. `recap_md` = 1-2 sentences naming what the lesson taught, in the child\'s words, and NEVER a restatement of the title. `results_md` = one warm honest line. Feedback lines stay ~10 words. Never write an instruction the canvas already shows.',
  '8. VISUAL-FIRST — the sprite carries the meaning. Give every item and category the child must recognize an `image_slot` chosen from THIS mechanic\'s declared slot list, and make its label name one concrete object an illustrator can draw exactly. If two items must be told apart, they must be tellable apart BY LOOKING. Never depend on a picture a child cannot interpret (an abstract symbol, a chart, text baked into the art); when a thing has no honest picture, give it a literal Material `icon` instead and keep the label doing the work.',
  '9. TIER-CORRECT REASONING. Obey the age-tier guidance supplied with this prompt as a ceiling AND a floor: the decision the game asks for must be one a child of that band can make in the seconds the config allows. An abstraction served too early is not "ambitious", it is a game that cannot be played.',
  '10. CLOSED SETS ARE CLOSED. `palette` from the declared palettes, `sfx`/`bgm` from the closed vocabulary, `cast` a subset of the canon four (dina, liruf, rho, zara), `skin.sprites` keys only from the mechanic\'s declared sprite slots. Never a raw hex colour, a font, an external host, a `<script>` or a data URI. An invented name is not a nice touch, it is a document that fails the gate.',
  '11. ONE SESSION, ONE IDEA. `estimated_minutes` 2-5, one concept per document. Rounds vary the DIFFICULTY of that idea, never the idea. An `interlude` (max one per 2 rounds) asks ONE question about the SAME concept, with options parallel in length and format and a `rationale_md` on the wrong ones. Never a second topic smuggled in as variety.',
  '12. THE NUMBERS MUST WORK OUT. Any economy you write — budget, prices, income, costs, targets, `pass_score` against the points the items can actually yield — must be solvable with the items and the ladder you provided. Do the arithmetic before you write it: the deterministic gates re-execute it, and a target no configuration can reach is an unwinnable game, not a hard one.',
  '',
  'FORBIDDEN (each item on its own FAILS the manifest):',
  '- A design that survives the swap test — labels replaceable with nonsense and the game plays identically (a theme pasted on a generic loop).',
  '- Generic or abstract items ("Objeto 1", "Moneda", "Cosa buena") where a concrete, named, pictured thing with a real number belongs.',
  '- A trap/avoid item with no `misconception_md`, or one that is a joke, absurd, or impossible to pick seriously.',
  '- Difficulty created by ambiguity, hidden information, unreadable speed for the tier, or a fact that only appears after the player has acted.',
  '- Any punishing, shaming, scary or loss-framed stake; a hostile "WRONG" tone; or the same feedback line repeated instead of a rotating set.',
  '- Labels that are sentences, carry emojis, or rely on puns/wordplay that TTS mangles; a recap that merely restates the title; a manifest that teaches the concept for the first time.',
  '- Tier-3 abstraction (profit, percentages, interest, opportunity cost, future value, multi-step arithmetic) served to tier 1.',
  '- An invented palette / sfx / bgm / sprite slot, a raw hex colour, an external URL, executable content, or a real-world brand.',
  '- An unreachable target or `pass_score` (unwinnable), or a configuration a random masher completes (free XP).',
  '- Any personal detail about a real child, or content generated as if for one specific child — prompts and manifests carry the age TIER and the concept, nothing else.',
].join('\n');

/**
 * Age-tier ceiling/floor for the KIND of decision a game may ask for (Piaget-mapped,
 * the numeric twin of coursegen's `tierReasoningGuidance`). Adapted to game DECISIONS —
 * what a child of this band can judge in the seconds a moving canvas gives them — not to
 * exercise prose. `tier` is `GameDocument.meta.tier` (1 | 2 | 3); any other value falls
 * through to the generic guidance rather than throwing inside a prompt build.
 */
export function tierReasoningGuidance(tier: number): string {
  switch (tier) {
    case 1:
      return 'TIER 1 — AGE 6-7 (pre-operational): ONE-STEP, CONCRETE, PRESENT-TENSE decisions only. Recognize a coin or a note, "cuesta más / cuesta menos", need vs want between 2-3 things you can see, put a visible thing where it belongs, wait for a treat. Keep 2-4 categories, small whole numbers, generous travel/decision time, and prefer `cheer` mode (no fail state, `lives: null`) so nothing is ever lost. FORBIDDEN at this age as a developmental mismatch, not a style choice: percentages, profit, interest, opportunity cost, future value ("en 3 semanas tendrás"), unit price, any two-step arithmetic. Pictures must carry as much meaning as the words.';
    case 2:
      return 'TIER 2 — AGE 8-10 (concrete-operational): up to TWO reasoning steps, always anchored to a concrete manipulative. Making change, saving toward a NAMED goal, needs vs wants as a trade-off, comparing two prices, staying inside a small budget, simple cause→effect over rounds. Percent only as a concrete part-of ("10 de cada 100"). `arcade` mode with lives is viable here, and the ladder may ramp speed and simultaneity across rounds. Never a formula the child has to hold abstractly.';
    case 3:
      return 'TIER 3 — AGE 10-12 (early formal-operational): now viable — profit (cost vs price), buying to resell, opportunity cost, risk and uncertainty, simple interest, and comparing options on TWO OR MORE dimensions at once. Planning-before-execution loops (economies, budgets, wave/round preparation) belong here. Still anchor every abstraction to a worked, concrete instance with real numbers on screen; older does not mean symbolic.';
    default:
      return 'Match the decision to the stated age tier: one concrete visible step for the youngest, two grounded steps in the middle, multi-dimension trade-offs only for the oldest — always with the numbers visible on screen.';
  }
}

/**
 * The judge-facing anchors. Injected into the JUDGE prompt so Qwen scores the SAME bar
 * the DeepSeek author was given — the loop that makes a boring-but-valid game rejected
 * instead of shipped. Binary signals on purpose: a yes/no question is reproducible across
 * runs in a way "rate the fun 1-5" is not.
 */
export const JUDGE_PLAYBOOK_ANCHORS = [
  'Score concept_fit, fun_agency, clarity, kid_safety and difficulty_fairness against the playbook bar above — the author was held to exactly it. Check these BINARY signals; every "no" is points off, and name the failed signal in `notes`.',
  '',
  'concept_fit:',
  '- SWAP TEST: replace every label with "cosa A / cosa B / cosa C" in your head. Does the game BREAK (become unwinnable or meaningless)? If it still plays the same, concept_fit is 1-2 — it is a reskin.',
  '- Do `value` / `props` / `category` / `roles` carry the concept\'s real numbers and groupings, rather than decorating an arbitrary loop?',
  '- Does `recap_md` name what the lesson taught, in a child\'s words, without restating the title?',
  '',
  'fun_agency:',
  '- Is there a real DECISION each round (choose, aim, place, spend, skip), not only a reflex?',
  '- Does the config ladder actually ramp — is round 3 different from round 1?',
  '- Are `correct_md` / `incorrect_md` a rotating set of distinct short lines rather than one line repeated?',
  '',
  'clarity:',
  '- Are labels short, literal, drawable object names, TTS-safe (no emoji, no pun, no sentence)?',
  '- Is every fact needed to decide visible BEFORE the player must act — never only after?',
  '- Does each thing the child must recognize have a meaning-carrying `image_slot` (from the declared slots) or an honest literal `icon`?',
  '',
  'kid_safety (HARD FLOOR — not an average input):',
  '- Positive stakes only: nothing shaming, punishing, scary, or loss-framed anywhere, including `incorrect_md`.',
  '- Age-appropriate throughout; no brands, no real-person or child-specific detail, no violent framing.',
  '- Closed sets respected; no external host, no executable content, no raw hex.',
  '- ANY single "no" here means kid_safety = 1 and the document is REJECTED regardless of every other score.',
  '',
  'difficulty_fairness:',
  '- Does difficulty come from the ladder\'s numbers rather than from ambiguity, hidden information, or unreadable speed for the tier?',
  '- Does every trap/avoid item carry a specific `misconception_md` a child would actually hold?',
  '- Is the abstraction level right for `meta.tier` (no profit/percent/interest/opportunity-cost/future-value at tier 1)?',
  '- Do the economy and the target arithmetic work out with the items and ladder provided?',
  '',
  'ILLUSTRATION HAPPENS DOWNSTREAM — judge the design and the labels, NEVER the pixels. At judging time `skin.sprites` may be empty, `background_url` absent and every `image_slot` pointing at nothing; a later stage generates the art from these very labels. Do NOT penalize a missing sprite URL, a missing background, or a placeholder `icon`. Penalize only a label too vague or too abstract to be DRAWN.',
  'WINNABILITY WAS ALREADY PROVEN MECHANICALLY by a free deterministic bot gate before this prompt ran. Do not re-derive whether the simulation terminates; judge whether the intended strategy is DISCOVERABLE by a child of this tier and worth doing twice.',
  'Score LOW (1-2) any game that survives the swap test, decorates a generic loop with a theme, has throwaway traps, hides a needed fact, punishes or shames, serves too-old reasoning to a young tier, repeats one feedback line, or whose numbers do not work out. "Mechanically valid but boring" is a FAILING game, not a passing one.',
].join('\n');
