// Writing skills for the v2 authoring prompt (owner direction 2026-10-04:
// "use the writing skills incorporated in Forge, and prioritise learning with
// examples; exercises only reaffirm").
//
// Forge v1 carries its writing discipline in `pipeline/contentPlaybook.ts` and
// `learnerRegisterPolicy.generated.ts`, but the v2 `authoringMessages` prompt
// never imported it, so v2 copy was held to the gates and not to the craft. This
// module is that import. It reuses the neutral v1 rules VERBATIM (by number, so a
// reworded v1 rule flows through and a removed one fails loudly), and states
// afresh the parts that are v1-field-shaped (`prompt_md`, `explanation_md`) or
// that the owner reversed (v1 rule 4 is discovery-first; v2 is example-first).
//
// Everything here is prompt text. The checkable half (roles, order, pre/post
// pairing) is `lessonDesign.ts`; the Copy Budget, tone, register lexicons and
// generic-praise gates already run on the emitted documents (gates 11-13, 17-19).

import { PLAYBOOK_RULES, FOLLOWABILITY_RULES, tierReasoningGuidance } from '../pipeline/contentPlaybook.js';
import { REGISTERS, registerForAge, forbiddenLexicons, type LexiconId } from '../pipeline/learnerRegisterPolicy.generated.js';
import { COPY_BUDGETS, wordLimit, type ContentLocale } from '../contentGates/budgets.js';
import type { V2LessonPlan } from './plan.js';

type MentorId = NonNullable<V2LessonPlan['mentor_stage']>['character'];
type SkillSkeleton = Pick<V2LessonPlan, 'eligibility' | 'age_band' | 'mentor_stage' | 'segments'>;

/** One v1 playbook rule by its number; throws if v1 renumbers it, so drift is loud and never silent. */
function playbookRule(number: number): string {
  const rule = PLAYBOOK_RULES.find((line) => line.startsWith(`${number}. `));
  if (!rule) throw new Error(`writingSkills: v1 content playbook has no rule ${number}`);
  return rule;
}

/** The v1 followability rules, with rule 2 restated against the v2 Copy Budget (v1 states it against the prompt_md cap). */
function followabilityRules(): string[] {
  const restated = '2. **EVERY GRADED SEGMENT RE-ANCHORS ITSELF IN ITS OWN PROMPT.** Open with a short clause naming who and where ("En el puesto de Rho, ¿cuál…?") so a learner who lost the thread can re-enter without scrolling back. The anchor is a CLAUSE INSIDE the instruction sentence, never a sentence of its own: the prompt word limit below is enforced, and if the anchor does not fit, shorten the instruction, never the limit.';
  return FOLLOWABILITY_RULES.map((rule) => (rule.startsWith('2. ') ? restated : rule));
}

/** The four Mentors' voices (mirrors oracle/src/tutor/prompt.ts CHARACTER_VOICES) plus how each one TEACHES an example. */
type MentorMoves = Readonly<Record<ContentLocale, string>>;

export const MENTOR_VOICES: Readonly<Record<MentorId, { voice: string; teachesBy: string; moves: MentorMoves; olderMoves?: MentorMoves }>> = {
  rho: {
    voice: 'Dr. Rho: a warm, precise, slightly formal older scientist, delighted by a good question.',
    teachesBy: 'Treats every example as a small experiment: states what is measured, does one measurement per turn, reads the result aloud.',
    moves: { 'es-MX': 'Observa. Medimos. Anotemos el resultado.', 'en-US': 'Watch. We measure. Let us note the result.', 'pt-BR': 'Observe. Vamos medir. Anotemos o resultado.' },
    olderMoves: { 'es-MX': 'Veamos el dato. Una medición a la vez.', 'en-US': 'Look at the figure. One measurement at a time.', 'pt-BR': 'Veja o dado. Uma medição de cada vez.' },
  },
  zara: {
    voice: 'Zara Vex: a fast, curious, encouraging young inventor who thinks out loud.',
    teachesBy: 'Builds the example out loud: tries a move, says what she expects, looks at what happened, adjusts. Short bursts, one build step per turn.',
    moves: { 'es-MX': 'Hmm, probemos esto. ¿Y si lo armo así?', 'en-US': 'Hmm, let me try this. What if I build it like so?', 'pt-BR': 'Hmm, vou tentar isto. E se eu montar assim?' },
    olderMoves: { 'es-MX': 'Pruébalo así: ¿qué cambia si sube la tasa?', 'en-US': 'Try it this way: what changes if the rate goes up?', 'pt-BR': 'Teste assim: o que muda se a taxa subir?' },
  },
  liruf: {
    voice: 'Liruf: a playful cartoon dinosaur, the youngest voice in the cast; simple words, stories and pictures.',
    teachesBy: 'Tells the example as a tiny story with a picture to look at; uses the smallest words and at most one exclamation per turn.',
    moves: { 'es-MX': 'Mira mi frasco. Hay tres monedas.', 'en-US': 'Look at my jar. There are three coins.', 'pt-BR': 'Olhe meu pote. Tem três moedas.' },
  },
  dina: {
    voice: 'Dina: a calm, patient four-legged companion who never rushes and checks in often.',
    teachesBy: 'Goes slowly, one small step per turn, then checks in ("¿Vamos bien?") before the next step; never hurries past a step.',
    moves: { 'es-MX': 'Sin prisa. Vamos paso a paso. ¿Vamos bien?', 'en-US': 'No rush. One step at a time. Are we okay so far?', 'pt-BR': 'Sem pressa. Um passo de cada vez. Estamos bem?' },
    olderMoves: { 'es-MX': 'Con calma. Revisemos este paso antes del siguiente.', 'en-US': 'Take your time. Let us check this step before the next.', 'pt-BR': 'Com calma. Vamos conferir este passo antes do próximo.' },
  },
};

/** Style per market: the copy is written for that market, never translated from es-MX. */
export const LOCALE_STYLE: Readonly<Record<ContentLocale, string>> = {
  'es-MX': 'es-MX: speak to the child as "tú", plain Mexican Spanish ("monedas", "cambio", "mesada"; "pesos" only when the lesson is about real market money), no voseo, no "vosotros", no Spain-only words. Never a literal calque of English.',
  'en-US': 'en-US: plain American English ("coins", "change", "allowance"; dollars and cents only when the lesson is about real market money), contractions are welcome, second person. Adapt the situation to a US child; do not translate the Spanish.',
  'pt-BR': 'pt-BR: speak to the child as "você" (never "tu"), Brazilian words ("moedas", "troco", "mesada"; "reais" and "R$" only when the lesson is about real market money), no Portugal-only forms ("telemóvel", "miúdo", "autocarro"). Adapt the situation; do not translate the Spanish.',
};

/** Market style for learners of 13 and up: the same markets, written to a person and not to a child. */
export const LOCALE_STYLE_OLDER: Readonly<Record<ContentLocale, string>> = {
  'es-MX': 'es-MX: speak to the learner as "tú" (the app is informal; never "usted"), plain Mexican Spanish with the real money words ("sueldo", "renta", "tarjeta", "préstamo", "ahorro"); no voseo, no "vosotros", no Spain-only words, no diminutives ("ahorrito", "pesitos"). Never a literal calque of English.',
  'en-US': 'en-US: plain, direct American English, second person, contractions welcome; the real money words ("paycheck", "rent", "credit card", "loan", "savings"); no diminutives and no baby talk. Adapt the situation to a US learner; do not translate the Spanish.',
  'pt-BR': 'pt-BR: speak to the learner as "você" (never "tu"), Brazilian words with the real money terms ("salário", "aluguel", "cartão", "empréstimo", "poupança"); no Portugal-only forms, no diminutives ("dinheirinho"). Adapt the situation; do not translate the Spanish.',
};

const LEXICON_NOTES: Readonly<Record<LexiconId, string>> = {
  'self-global': 'judging the child as a person ("you are bad at this")',
  'person-praise': 'praising a trait ("you are so smart"); name what they DID instead',
  'family-finance-moralizing': 'moralising about family money',
  'loss-mechanic': 'lives, losing points or streaks',
  'time-pressure': 'hurry, countdowns, "only today"',
  'parasocial-pressure': 'the Mentor needing or missing the child',
  'purchase-lure': 'urging a purchase',
  'social-pressure': 'comparing with other children',
  'childish-framing': 'baby talk for older learners',
};

/** The copy limits the gates will enforce, stated as numbers so the model writes inside them the first time. */
function budgetLines(skeleton: SkillSkeleton): string[] {
  const audience = { young: skeleton.age_band === '6-9', label: skeleton.age_band };
  const locales: ContentLocale[] = ['es-MX', 'en-US', 'pt-BR'];
  const row = (role: 'prompt' | 'mentor' | 'body' | 'option') => locales.map((locale) => `${locale} ${wordLimit(role, locale, audience)}`).join(', ');
  return [
    `Copy Budget (gate 13, words; the build is blocked above these): a prompt ${row('prompt')} (at most ${COPY_BUDGETS.prompt.sentences} sentences); a Mentor line ${row('mentor')} (at most ${COPY_BUDGETS.mentor.sentences} sentences); a feedback or help line ${row('body')}; an option label ${row('option')}.`,
    'The limits are per market, so a line that fits in es-MX can be too long in en-US: write the en-US line short first, then adapt.',
  ];
}

function registerLines(skeleton: SkillSkeleton): string[] {
  const register = registerForAge(skeleton.eligibility.minimum_age);
  const spec = REGISTERS[register];
  const forbidden = forbiddenLexicons(register);
  return [
    `Register for ages ${skeleton.eligibility.minimum_age}-${skeleton.eligibility.maximum_age} (${register}): praise names the ${spec.tone.praiseTarget} the child showed; ${spec.tone.genericPraise ? 'a short "well done" is tolerated at this age but a named action is better' : 'a bare "great job" with nothing named is blocked (gate 19)'}; at most ${spec.tone.exclamations} exclamation mark${spec.tone.exclamations === 1 ? '' : 's'} per string; a miss is always met with encouragement, never sadness or disappointment.`,
    `Never write: ${forbidden.map((id) => `${LEXICON_NOTES[id]}`).join('; ')}. The Mentor never celebrates (no confetti language) and never mentions lives.`,
  ];
}

function tierFor(skeleton: SkillSkeleton): string {
  const age = skeleton.eligibility.minimum_age;
  return age <= 7 ? 'tier1' : age <= 10 ? 'tier2' : age <= 12 ? 'tier3' : 'tier4';
}

/** The teaching order, and what each role's copy must do. This is the owner's "examples first, exercises reaffirm". */
export const EXAMPLES_FIRST_SKILL: readonly string[] = [
  'TEACHING ORDER: EXAMPLES FIRST, EXERCISES ONLY TO REAFFIRM. A learner is never asked to do a move they have not just watched. The lesson runs: a hook, (optional) a try-first probe, THEN a worked example, THEN guided practice, THEN practice to reaffirm, THEN one transfer. The exercises confirm what the example taught; they never introduce it.',
  'A WORKED EXAMPLE IS ONE COMPLETE CASE SHOWN ON SCREEN. Narration audio is not generated yet, so everything the learner must see is in the visible text. The Mentor does the case in consecutive turns, ONE step per turn: (1) the situation and what we want to find out; (2..n) each move, with the number it uses and WHY this move; (last) the result, checked against the goal. Use real numbers and the named thing from the lesson. A turn is a short line, never a paragraph. No question is asked of the learner inside the example.',
  'role hook: the Mentor opens the one situation of the lesson (a named character, a place, a stake) in a line or two. It asks the child nothing and promises nothing; it makes the child want to see how it turns out.',
  'role pre: ONE low-pressure item before any teaching, to see what the child already thinks. Its feedback never says wrong; it says what the child chose and promises to look at it together ("Gracias, ya veo cómo piensas. Ahora lo vemos paso a paso."). Both feedback lines are neutral.',
  'role example: a Mentor turn that demonstrates, one step per turn. It teaches by showing: name the deciding fact first, then the move, then the result. It never asks the child a question.',
  'role guided: the SAME move on NEW numbers; the child does one step and the help lines restate the step the example showed. `not_yet` points back to the example ("Mira cómo empezó Rho: por el precio.") and never gives the answer.',
  'role practice: reaffirm only. The move just shown and practised, a fresh instance, no new idea. `met` names the action the child took, not the child.',
  'role transfer: the same idea in a different place or object, so the child must decide what carries over. `met` names the move that carried over.',
  'Never grade a case whose answer a previous segment already showed: keep the characters and the setting, change the data (followability rule 3).',
];

/** What the pilot reviewers kept finding in rounds 1-2, as rules to apply the first time (docs/content/FORGE-V2-PILOT-ROUNDS.md). */
export const PILOT_LESSONS: readonly string[] = [
  'THE EXAMPLE SHOWS WHAT THE EXERCISE GRADES. Before writing a practice or transfer item, name the criterion it grades (a decimal comparison, a "nothing is wrong here" case, "do not reply", spoilage). The example must already have demonstrated that exact criterion, with numbers of the same kind (decimals when the exercise uses decimals) and never with the exercise\'s own answer.',
  'THE WHY IS ON SCREEN. A reason that lives only in `narration.script` is never heard, because narration audio is not generated: put it in the visible line, in one clause, and mark the turn `text_only`. Keep `differentiated` narration for a turn whose plate would otherwise carry nothing the child can read.',
  'A HOOK IS A PICTURE, NOT AN INSTRUCTION. "Listen to Rho" is not a hook. Say who is where and what they are looking at ("Nia and her club look at the picnic basket"), in one line, before anything is asked.',
  'NUMBER THE STEPS of an example with three or more moves ("Paso 1: lo que falta", "Paso 2: las semanas") so a learner who looked away can find the thread again.',
  'A STEP NEVER LEAKS THE NEXT RESULT. A worked-example or guided step expression such as "60 − 50" shows an earlier hidden result: label it in words ("Meta − total redondeado"). `feedback.met` credits only what the child did, never a step the board already showed, and never makes a categorical safety claim ("es seguro").',
  'VARY WHERE THE RIGHT CHOICE SITS. In a set of choices the correct one is not always first; reorder the options and the payload together.',
  'A MISTAKE ENDS WITH A COMMITMENT. A Mentor episode\'s recovery names what the Mentor will do next time ("la próxima vez comparo el precio de uno"), in the child\'s words, and the three markets agree on what went wrong.',
];

/** Lessons for 13-17 and adults: the Mentor steps back, the stakes are real, and teaching opens with something the learner already lives. */
export const OLDER_LEARNER_SKILL: readonly string[] = [
  'LEARNER OF 13 OR OLDER: write to a person, never to a child. Open each lesson with something this learner already lives (a gig payout, a phone plan, an in-game purchase, a first paycheck, splitting a cost with friends, a scam in their feed), THEN name the financial idea it maps to; never explain the idea first and bolt an analogy on after. Stakes are real and delayed (a debt that grows, a deal that is hard to undo), never a treat won or lost. Wherever the craft rules below say "kid", "child", an allowance or a toy, read "learner" and use a situation from their own life.',
  'THE MENTOR STEPS BACK (register: presence minimal, text first). The Mentor is a near-peer guide at the edge of the screen: one short line per step, no pet names, no exclamation marks, no cartoon narration, no "campeón". Keep the Mentor\'s character (Rho precise, Zara quick, Dina calm) but speak peer to peer. Liruf, the youngest voice, never teaches a 13+ lesson. The worked example is mostly the board, with the Mentor naming what to look at.',
  'A WORKED EXAMPLE FOR THIS AGE IS MULTI-STEP BY DEFAULT: three to five steps, each with the number it uses and why, and the last step checks the result against the starting question. Numbers are realistic amounts in the learner\'s own currency; compute every answer twice. Each exercise changes the data AND at least one condition (a rate, a period, a fee), so the learner applies the method and does not repeat the example.',
  'INVESTING AND TRADING STAY SIMULATION-ONLY at every age: never leverage, derivatives, options, short selling, margin trading, day trading, forex, or crypto as an investment, never a named stock or fund to buy, never a promised return. Use labelled illustrative rates ("suppose it grows 6 % a year").',
];

/** Adults (18+) come with a real decision and little time: teach the method, respect the person. */
export const ADULT_LEARNER_SKILL: readonly string[] = [
  'ADULT LEARNER (18+): they arrive with a real decision to make (a payslip, a rent increase, a loan offer, a first stall at a weekend market) and little time. Open with their situation, not a character in a story. Praise is utility ("Ya puedes comparar dos ofertas por su costo total"), never "good job". No treats, no stars, no story rewards, no childish framing. Respect what they already know: one example, then straight to their own numbers.',
  'ADULT MONEY IS LOCAL. Use each market\'s own general, stable products and institutions where they help (es-MX: Afore, CETES, IMSS, SAT, tanda, Buró de Crédito; pt-BR: Pix, FGTS, 13º salário, Tesouro Direto, CDB, Serasa, MEI; en-US: 401(k), credit score, APR, Roth IRA, paycheck, W-2) and declare the scenario regional. NEVER present a current interest rate, tax rate, fee, limit or deadline as fact: use a labelled illustrative number ("suppose the card charges 3 % a month"). Never give personal financial advice and never tell the adult to buy or open anything: teach the method and let the numbers decide.',
];

/** Rules the catalog build adds to the pilot ones: they save a review round when applied the first time. */
export const CATALOG_LESSONS: readonly string[] = [
  'ONE SITUATION PER LESSON. Name the character, the place and the thing at stake in the hook, and keep them in every segment through the transfer; a transfer changes the setting, never the cast.',
  'WRITE THE EN-US LINE SHORT FIRST. The Copy Budget is per market and en-US is the tightest: aim at about 80 % of the cap so a later edit does not break gate 13. A Mentor line is one idea.',
  'WHEN THE NUMBERS CAN DIFFER BY MARKET, THEY DO: a regional lesson carries its own amounts, items and currency per market (rubric_by_locale where the answer differs), written for that market and never converted from es-MX.',
  'CHECK EVERY ANSWER TWICE: recompute each graded answer, each explanation and each worked-example step from the payload before you save the plan; Core\'s check recomputes them and a wrong key blocks the lesson.',
];

/**
 * The full writing-skills block for one skeleton: every line is model-facing
 * prompt text, ordered so the pedagogy comes before the craft and the numbers
 * the gates enforce come last (nearest the JSON shape).
 */
export function writingSkillsPrompt(skeleton: SkillSkeleton): string[] {
  const mentor = skeleton.mentor_stage ? MENTOR_VOICES[skeleton.mentor_stage.character] : undefined;
  const older = skeleton.eligibility.minimum_age >= 13;
  const adult = skeleton.age_band === 'adult' || skeleton.eligibility.minimum_age >= 18;
  const moves = mentor ? (older && mentor.olderMoves ? mentor.olderMoves : mentor.moves) : undefined;
  const lessonRoles = new Set<string>(skeleton.segments.flatMap((segment) => (segment.teaching_role ? [segment.teaching_role] : [])));
  return [
    ...EXAMPLES_FIRST_SKILL.filter((line) => !line.startsWith('role ') || lessonRoles.size === 0 || lessonRoles.has(/^role (\w+):/.exec(line)?.[1] ?? '')),
    ...PILOT_LESSONS,
    ...CATALOG_LESSONS,
    ...(older ? OLDER_LEARNER_SKILL : []),
    ...(adult ? ADULT_LEARNER_SKILL : []),
    '',
    'WRITING CRAFT (reused from the Forge content playbook):',
    playbookRule(1), playbookRule(5), playbookRule(6), playbookRule(12),
    'For the exercises (guided, practice, transfer), also: ' + [playbookRule(2), playbookRule(3)].join(' '),
    '',
    'FOLLOWABILITY (the owner\'s first complaint about past lessons was "it is hard to follow the thread"):',
    ...followabilityRules(),
    '',
    'AGE AND REGISTER:',
    tierReasoningGuidance(tierFor(skeleton)).replace(/ REGISTER: .*$/s, ''),
    ...registerLines(skeleton),
    '',
    'FEEDBACK that teaches: `met` states what the child DID and why it worked in one concrete sentence ("Contaste desde el precio, justo como Rho."); `not_yet` is a hint that points at a fact already on screen and never names the answer. Never "¡Correcto!" alone. Mentor colloquialisms (a light "¡órale!") may appear in a Mentor line at most once every two or three segments and only for ages 6-12 (never at 13+); never in a prompt, an option, a hint or feedback.',
    ...(mentor && moves ? [`MENTOR VOICE for this lesson: ${mentor.voice} ${mentor.teachesBy} The turns sound like this (es-MX): "${moves['es-MX']}"; adapt, never translate, for en-US ("${moves['en-US']}") and pt-BR ("${moves['pt-BR']}"). Only this Mentor speaks in this lesson.`] : []),
    '',
    'MARKET STYLE:',
    ...Object.values(older ? LOCALE_STYLE_OLDER : LOCALE_STYLE),
    ...budgetLines(skeleton),
  ];
}
