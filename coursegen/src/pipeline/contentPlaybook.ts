// Content-design playbook — the CREATIVE/PEDAGOGICAL brief shared by the WRITE
// author (what to aim for) and the REVIEW judge (what to score against). It is
// the answer to the 2026-07-23 QA verdict that exercises were mechanically
// correct but "estúpidas": the deterministic gates (gate 1-7) and the schema
// enforce CORRECTNESS; this enforces VALUE — that a premise is concrete,
// relatable, and worth a child's attention, at Duolingo/Brilliant quality.
//
// Grounded in learning science (retrieval practice & the testing effect,
// worked examples, desirable difficulties, concreteness/dual-coding, immediate
// formative feedback), child cognitive development (Piaget: pre-operational
// tier1, concrete-operational tier2, early formal-operational tier3), and
// engagement research (self-determination theory — autonomy/competence/
// relatedness; the curiosity gap; narrative stakes). Sources are catalogued in
// COURSE_ENGINE.md §"Content quality".
//
// Kept deliberately tight: it ships in every write/review prompt, so every line
// must earn its tokens by changing what the model produces.

/** The author-facing playbook. Injected into the WRITE prompt as its creative brief. */
export const CONTENT_PLAYBOOK = [
  'CONTENT PLAYBOOK — what makes an exercise GREAT (design every premise to this bar, not just to the rules):',
  '',
  '1. START FROM A CONCRETE MICRO-SITUATION a kid actually lives: an allowance, saving for a NAMED toy with a real price, a lemonade-stand decision, splitting a snack, a trade with a friend. Name the thing, the price, the character, the stakes. "Zara tiene $8 y la patineta cuesta $10" beats "¿cuál número es mayor?".',
  '2. MAKE IT A REAL DECISION WITH A STAKE, not a fact to recall. The kid has AGENCY — they DECIDE for a character ("¿qué haces tú?"), and something is won or lost. Open a CURIOSITY GAP: a concrete stake whose answer is not yet obvious ("Dos puestos venden la misma limonada a precios distintos — ¿cuál gana MÁS dinero de verdad?"), close enough that the kid wants the resolution.',
  '3. TEST APPLICATION, NEVER DEFINITION-RECALL. Never ask "¿qué es el ahorro?"; make the kid DO saving inside a scenario. Reconstructing the answer from a concrete case IS the learning (the testing effect). If the answer is a vocabulary word\'s definition, redesign it into a situation where the concept is USED.',
  '4. LET THE KID DISCOVER, THEN CONFIRM (guided discovery, Brilliant-style): pose the situation and let them ATTEMPT/decide first; reveal the rule in the feedback, not before the question. For a brand-new procedure (e.g. making change) show ONE worked example, then immediately fade the support to a solve-it item — never leave a new procedure unmodeled.',
  '5. CONCRETE BEFORE ABSTRACT, and FADE (never start abstract): grounded object/scene → annotated icon → number/word. Youngest tier stays fully concrete; the symbol is the LAST rung, not the first. Prefer a small, worked, specific instance over any general statement.',
  '6. ONE IDEA PER SCREEN, one genuine reasoning step (a "desirable difficulty"): a comparison, a one-step calc, a judgment. The answer must NOT be visible in the prompt or obvious at a glance, and the exercise should be ~80% winnable — the effort is the CONCEPT, never confusing wording. Low reading, tap/drag over typing, solvable in under a minute.',
  '7. DISTRACTORS THAT TEACH: every wrong option encodes ONE specific, common kid misconception (ignored the cost, added instead of subtracted, picked the biggest number, confused want vs. need, off-by-one coin, forgot the savings goal). Keep options parallel in length/format so the answer is not guessable by surface cues. A wrong choice must be tempting AND diagnostic — put its misconception in that option\'s `rationale_md` so the feedback names exactly the thinking that went wrong. Never joke or impossible options.',
  '8. FEEDBACK BUILDS THE MENTAL MODEL — elaborated, not verification. explanation_md is outcome-neutral (shown right OR wrong), 1-2 kid-sized sentences: state the fact and the WHY in concrete terms ("El vaso cuesta 5 pesos porque…"), address the misconception a wrong answer reveals ("te quedarías corto por 2 pesos para la feria"). Concrete beats general; short beats long. Never "¡Correcto!" alone; a wrong answer is a gentle teaching beat, never a punishment.',
  '9. VOICE: warm, playful peer-coach — a dina/liruf/rho/zara character with a bit of humor and heart the kid roots for. Short sentences, concrete nouns, real stakes. Never condescending, never empty praise ("¡bien hecho, campeón!"), never a lecture, never filler.',
  '',
  'FORBIDDEN (hallmarks of a boring, low-value exercise — a lesson with any of them is a FAIL):',
  '- Generic phrasing with no specific number, named object, or situation ("elige la respuesta correcta sobre el dinero").',
  '- Recall-of-a-definition questions instead of applying the concept in a decision.',
  '- Stakes-free trivia ("¿cuál es mayor, 8 o 10?") when a real decision was possible — nothing won/lost, nothing chosen.',
  '- Abstract framing (profit, interest, percentages) where a concrete, pictured one fits — or served to an age tier too young for it.',
  '- Contrived scenarios a child never meets ("reparte tu portafolio trimestral").',
  '- Throwaway distractors (obviously silly, or the right answer restated) that diagnose nothing.',
  '- Wall-of-text premise, or more than one concept crammed onto one screen.',
].join('\n');

/**
 * Age-tier reasoning ceiling/floor (Piaget-mapped). The forbidden-vocabulary
 * gate already blocks jargon per tier; this shapes the KIND of reasoning and
 * framing each premise should demand.
 */
export function tierReasoningGuidance(tier: string): string {
  switch (tier) {
    case 'tier1':
      return 'AGE 6-7 (pre-operational): concrete, visible, PRESENT-TENSE, one-step reasoning ONLY. Recognize coins/notes, "cuesta más / cuesta menos", pick between 2-3 physical things you can picture, wait-for-a-treat. Saving = watching a clear jar fill. FORBIDDEN at this age (developmental mismatch, not just style): future value / "en X semanas tendrás", percentages, profit, interest, multi-step word problems. Pictures carry as much meaning as words.';
    case 'tier2':
      return 'AGE 8-11 (concrete-operational): up to TWO reasoning steps grounded in a concrete manipulative. Making change, saving toward a NAMED goal, needs vs. wants trade-offs, simple comparison shopping, cause→effect. Percent only AS a concrete part-of ("10 de cada 100"). Keep it anchored to objects/situations, never a formula.';
    case 'tier3':
      return 'AGE 11-13 (early formal-operational): now viable — profit, buying-to-sell, simple interest, opportunity cost, risk, comparing options on 2+ dimensions. A lemonade-stand profit/loss or a "compra 3 para revender" scenario fits HERE (kids integrate buying+selling and grasp profit around 11), NOT younger. Still anchor every abstraction to a concrete worked instance with real numbers first.';
    default:
      return 'Match the reasoning depth and framing to the stated age tier: concrete and one-step for the youngest, multi-step and lightly abstract for the oldest, always anchored to a real, pictured situation.';
  }
}

/**
 * The judge-facing anchors. Injected into the REVIEW prompt so the judge scores
 * engagement/pedagogy against the SAME bar the author was given — closing the
 * loop so a boring-but-correct lesson is rejected, not shipped.
 */
export const JUDGE_PLAYBOOK_ANCHORS = [
  'Score cognitive_engagement, pedagogy, distractor_quality, feedback_quality and narrative_quality against this bar (the author was held to it). For each exercise, check these BINARY signals — every "no" is points off:',
  '- Does the premise have a concrete number AND a named character/object? (not "una persona ahorra dinero")',
  '- Is there a DECISION the kid makes and a STAKE (something won/lost)? (not stakes-free trivia)',
  '- Does solving require APPLYING the concept, not reciting a definition, with the answer NOT visible in the prompt/options?',
  '- Does each wrong option map to a specific, tempting misconception (not a throwaway)?',
  '- Is the explanation elaborated (states the WHY concretely) and outcome-neutral, not bare praise?',
  '- Is the abstraction level right for the age tier (no profit/interest/percentages/future-value for the youngest)?',
  'Score LOW (1-2) any exercise that is generic, tests a definition, is stakes-free, is abstract where concrete fits, serves too-old concepts to a young tier, or has throwaway distractors. "Mechanically valid but boring / adds no real value" is a FAILING lesson, not a passing one — say exactly which signal failed in `notes`.',
].join('\n');
