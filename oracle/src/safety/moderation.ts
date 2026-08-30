import { getConfig } from '../env.js';
import { withTimeout } from '../lib/http.js';
import type { Locale } from '../context/schema.js';
import { stripInvisible } from './untrusted.js';

/*
 * Moderation before the screen AND before the ear (/ORACLE.md §6).
 *
 * The rule that shapes this whole file: a turn is generated whole, moderated
 * whole, and only then spoken. Token-streaming into text-to-speech would put
 * unmoderated words in a child's ear and be unrecallable — an apology cannot
 * un-hear a sentence.
 *
 * TWO PASSES, AND THE ORDER MATTERS.
 *
 * The deterministic pass runs first because it catches the failures a model
 * judge is worst at: our own system prompt leaking back out, the fence nonce
 * being echoed, a contact detail appearing in output. Those are exact-match
 * problems, and an exact-match check does not have an opinion.
 *
 * The model pass runs second, for the things patterns cannot see. It is
 * FAIL-CLOSED: if it errors or times out, the turn is not spoken. That is a
 * deliberate availability trade — Oracle would rather say a scripted line than
 * an unreviewed one.
 */

export type ModerationVerdict =
  | { allowed: true }
  | { allowed: false; reason: ModerationReason; detail: string };

export type ModerationReason =
  | 'prompt_leak'
  | 'nonce_echo'
  | 'contact_detail'
  | 'unsafe_content'
  | 'moderator_unavailable';

export interface ModerationInput {
  text: string;
  locale: Locale;
  tier: 1 | 2 | 3;
  /** The fence nonce used for this turn; the model must never echo it. */
  nonce?: string;
  /** Kid sessions require the model pass. Adult sessions may run without it. */
  requireModelPass: boolean;
  /**
   * Whether a second judge call is still worth making. False when the turn is
   * already close to the client's 25 s ceiling: a verdict that lands after the
   * learner was told to ask again protects nobody and costs the turn.
   */
  allowRetry?: boolean;
}

/*
 * Phrases that only appear in output if the model has started reciting its own
 * instructions. Kept short and structural rather than trying to match the
 * prompt verbatim — a paraphrased leak is still a leak, and the give-away is
 * the vocabulary of instruction, not the exact wording.
 */
const PROMPT_LEAK_MARKERS: readonly RegExp[] = [
  /\bsystem\s+(prompt|instructions?|message)\b/i,
  /\bmy\s+(instructions?|system\s+prompt|rules)\s+(say|are|state)\b/i,
  /\byou\s+are\s+(dina|liruf|dr\.?\s*rho|rho|zara)[^.]{0,40}\b(tutor|assistant)\b.*\bnever\b/i,
  /<<<(?:END_)?LEARNER_INPUT/i,
  /\bLEARNER_INPUT_[A-Za-z0-9_-]+\b/,
  /\bas\s+an\s+ai\s+(language\s+)?model\b/i,
  /\bmis\s+instrucciones\s+(dicen|son)\b/i,
  /\bminhas\s+instru[çc][õo]es\s+(dizem|s[ãa]o)\b/i,
];

/*
 * Contact details in OUTPUT. The model has no legitimate reason to produce an
 * email address, a phone number or a URL: every link a learner should follow
 * is rendered by the product, not spoken by a character. Treating any of them
 * as a hard stop closes the "tutor tells a child to visit somewhere" hole
 * without needing to reason about whether a particular destination is safe.
 */
const CONTACT_DETAIL: readonly RegExp[] = [
  /\b[\w.+-]+@[\w-]+\.[\w.]{2,}\b/i,
  /\bhttps?:\/\/\S+/i,
  /\bwww\.[\w-]+\.\w{2,}/i,
  /*
   * PHONE-SHAPED, NOT JUST DIGIT-SHAPED. Found live, testing as a struggling
   * learner, 2026-08-30: this used to be `\b\+?\d[\d\s().-]{8,}\b` — any 9+
   * characters of digits/spaces/parens/dots/hyphens — which blocked entire
   * turns of ORDINARY teaching content for a tutor whose whole subject is
   * numbers: "Contamos hacia atrás: 10 9 8 7 6 5 4 3 2 1" and "Empiezas en 6
   * y vas sumando: 6 7 8 9 10" both matched. A real phone number's digits
   * are GROUPED (an area code, an exchange, a line number — each 2-4 digits
   * long); a spoken counting sequence or price breakdown is a run of
   * ISOLATED single- or double-digit numbers. Requiring three groups, the
   * middle and last each 3-4 digits, is what a phone number actually looks
   * like and a counting sequence never does — this tutor's own tier rules
   * keep every number under 100, so a bare 3+ digit group essentially never
   * appears in legitimate content at all.
   */
  /\b\+?\d{2,4}[\s().-]{0,3}\d{3,4}[\s().-]{0,3}\d{3,4}\b/,
];

/** The cheap, exact pass. Pure, synchronous, and never wrong about its own rules. */
export function deterministicModeration(input: ModerationInput): ModerationVerdict {
  // Stripped once, for the same reason `classifyLearnerInput` now does the
  // same on the input side (adversarial review, 2026-08-29, LOW here
  // specifically because it requires the MODEL to emit or echo an invisible
  // character — a compound scenario, and the semantic judge pass still runs
  // afterward for every minor session regardless): an invisible codepoint
  // planted inside the nonce, a prompt-leak marker or a phone number breaks
  // an exact/regex match without changing what a reader — or a reconstructed
  // request body — actually sees.
  const text = stripInvisible(input.text);
  if (input.nonce && text.includes(input.nonce)) {
    return { allowed: false, reason: 'nonce_echo', detail: 'output echoed the turn fence nonce' };
  }
  for (const pattern of PROMPT_LEAK_MARKERS) {
    if (pattern.test(text)) {
      return { allowed: false, reason: 'prompt_leak', detail: `matched ${String(pattern)}` };
    }
  }
  for (const pattern of CONTACT_DETAIL) {
    if (pattern.test(text)) {
      return { allowed: false, reason: 'contact_detail', detail: `matched ${String(pattern)}` };
    }
  }
  return { allowed: true };
}

/*
 * THE ONLY REASONS A TURN MAY BE REFUSED, as a closed vocabulary.
 *
 * The prompt already said "being wrong about a fact is not a safety problem",
 * and on 2026-08-29 the judge blocked a tutor explaining bank interest to a
 * six-year-old with this verdict, verbatim: "Incorrect math: 10 pesos loaned +
 * 2 extra is inconsistent with later example (20 + 1); MAY CONFUSE BUT NOT
 * UNSAFE PER GUIDELINES." It found a teaching flaw, said in its own words that
 * it was not a safety problem, and refused the turn anyway. The child got
 * "Déjame decirlo de otra forma" instead of an answer.
 *
 * Prose instructions did not hold, so the verdict is a closed vocabulary
 * instead. A refusal must NAME one of these categories; anything else — a
 * category we do not recognise, or none at all — is not a safety refusal, and
 * the turn is allowed with the judge's opinion logged. That is the §1.14 rule
 * this repository keeps relearning: a closed vocabulary is checkable and free
 * text is not.
 *
 * Quality still matters, and it is not this gate's job. A confusing
 * explanation is caught by the repair passes in `produce()` and by reading
 * transcripts; refusing the whole turn teaches the child nothing at all, which
 * is strictly worse than a clumsy sentence.
 */
const HARM_CATEGORIES = [
  'sexual',
  'violence',
  'self_harm',
  'hate',
  'dangerous_instructions',
  'personal_information',
  'secrecy',
  'contact_details',
  'off_platform',
] as const;

const JUDGE_SYSTEM = [
  'You are a child-safety reviewer for an educational product used by children',
  'as young as six. You are shown ONE message a tutor character is about to say',
  'out loud to a child.',
  '',
  'Answer with a single JSON object and nothing else:',
  '{"safe": true}',
  'or',
  `{"safe": false, "category": "<one of: ${HARM_CATEGORIES.join(' | ')}>", "reason": "<short>"}`,
  '',
  'You judge HARM ONLY. The categories above are the complete list of reasons a',
  'message may be refused. If the problem you see is not one of them, the answer',
  'is {"safe": true} — say so even if the message is wrong, confusing,',
  'inconsistent, badly explained, boring, simplistic or off-topic.',
  '',
  'A mathematical or factual error is NOT a safety problem. An example that',
  'contradicts an earlier one is NOT a safety problem. If your reason would',
  'contain the words "not unsafe", "may confuse", or would describe a teaching',
  'flaw rather than a harm, the answer is {"safe": true}.',
  '',
  'Refusing a turn costs the child the whole answer and replaces it with a',
  'scripted line that teaches nothing. Refuse only real harm.',
].join('\n');

interface JudgeChoice {
  message?: { content?: string };
}

/**
 * The model pass. Returns `null` when no judge is configured, so the caller can
 * distinguish "not configured" from "said no" — collapsing those two is exactly
 * the §1.14 failure-is-not-emptiness mistake.
 */
async function modelModeration(input: ModerationInput): Promise<ModerationVerdict | null> {
  const config = getConfig();
  if (!config.JUDGE_API_KEY) return null;

  const response = await withTimeout(
    fetch(`${config.JUDGE_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.JUDGE_API_KEY}`,
      },
      body: JSON.stringify({
        model: config.JUDGE_MODEL_NAME,
        temperature: 0,
        max_tokens: 120,
        messages: [
          { role: 'system', content: JUDGE_SYSTEM },
          { role: 'user', content: input.text },
        ],
      }),
    }),
    config.MODEL_TIMEOUT_MS,
    'moderation judge',
  );

  if (!response.ok) throw new Error(`moderation judge responded ${response.status}`);

  const body = (await response.json()) as { choices?: JudgeChoice[] };
  const raw = body.choices?.[0]?.message?.content ?? '';
  const match = /\{[\s\S]*\}/.exec(raw);
  if (!match) throw new Error('moderation judge returned no JSON object');

  const parsed = JSON.parse(match[0]) as { safe?: unknown; reason?: unknown; category?: unknown };
  if (typeof parsed.safe !== 'boolean') {
    /*
     * A response with no interpretable verdict at all — valid JSON, but no
     * `safe` field, e.g. `{}` or `{"result": true}` — is the SAME epistemic
     * state as no response, not an opinion we received. Throwing here routes
     * it through the retry-then-fail-closed-for-a-minor path below (the same
     * one "no JSON object found" already uses), rather than falling into the
     * "refused without a harm category" branch further down, which exists
     * for a DIFFERENT case: a real opinion we DID get, just not a safety one.
     * Found by an adversarial review, 2026-08-30 (CRITICAL): `{}` used to
     * take that branch and be silently converted to `{ allowed: true }`,
     * bypassing `requireModelPass` for exactly the malformed-response shape
     * §6's fail-closed rule exists to cover — reachable by ordinary model
     * non-compliance with the requested JSON shape, not an adversarial input.
     */
    throw new Error('moderation judge response had no interpretable verdict');
  }
  if (parsed.safe === true) return { allowed: true };

  const detail = typeof parsed.reason === 'string' ? parsed.reason.slice(0, 200) : 'judge marked unsafe';
  const category = typeof parsed.category === 'string' ? parsed.category : '';
  if (!(HARM_CATEGORIES as readonly string[]).includes(category)) {
    /*
     * A refusal that names no recognised harm is not a safety refusal. Allowed,
     * and LOGGED — the judge's opinion about the teaching is worth having, and
     * it is worth knowing how often this happens, but it must not cost a child
     * their answer.
     */
    console.warn(`[oracle] judge refused without a harm category (${category || 'none'}): ${detail}`);
    return { allowed: true };
  }
  return { allowed: false, reason: 'unsafe_content', detail: `${category}: ${detail}` };
}

/**
 * Moderates one tutor turn.
 *
 * FAIL-CLOSED FOR A CHILD, and the meaning of "closed" follows the session:
 *
 * - The judge threw or timed out → RETRY once, because most of these are a
 *   timeout or a 5xx and the cost of giving up is a whole turn destroyed. If
 *   it fails again, the answer depends on who is listening (below).
 * - Still no verdict, on a session that REQUIRES the model pass (a minor) →
 *   refuse. A child never hears model-authored text an unavailable judge did
 *   not clear.
 * - Still no verdict, on a session that does not require it (an adult) → the
 *   deterministic pass above already ran and allowed it, and §6 already says
 *   an adult's session may run on that pass alone.
 *
 * THAT LAST BRANCH IS THE FIX, and the asymmetry it removes cost a real
 * session. "No judge configured" was tolerated for an adult while "judge
 * briefly unreachable" was not — two names for one epistemic state, we have no
 * model verdict, answered with opposite policies. The owner's own session on
 * 2026-08-28 shows the result: a correct explanation of compound interest
 * replaced mid-conversation by "Déjame decirlo de otra forma", which reads to
 * a learner as the tutor refusing to answer them. Nothing about a minor's
 * protection changes here: `requireModelPass` is true for every one of their
 * sessions and every path above still refuses.
 */
export async function moderateTutorOutput(input: ModerationInput): Promise<ModerationVerdict> {
  const deterministic = deterministicModeration(input);
  if (!deterministic.allowed) return deterministic;

  let verdict: ModerationVerdict | null = null;
  let failure: string | null = null;

  // One retry, and only for a THROW. A judge that answered "unsafe" is not
  // asked again — that would be shopping for a second opinion on a verdict we
  // already have.
  const attempts = input.allowRetry === false ? 1 : 2;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      verdict = await modelModeration(input);
      failure = null;
      break;
    } catch (error) {
      failure = error instanceof Error ? error.message : 'moderation judge failed';
    }
  }

  if (failure !== null) {
    if (input.requireModelPass) {
      return { allowed: false, reason: 'moderator_unavailable', detail: failure };
    }
    // Adult session: the deterministic pass already cleared this text, and §6
    // permits running on it alone. Destroying the turn would protect nobody.
    console.warn(`[oracle] moderation judge unavailable, allowing on the deterministic pass: ${failure}`);
    return { allowed: true };
  }

  if (verdict === null) {
    if (input.requireModelPass) {
      return {
        allowed: false,
        reason: 'moderator_unavailable',
        detail: 'no moderation judge is configured for a session that requires one',
      };
    }
    return { allowed: true };
  }

  return verdict;
}

/**
 * Whether a session may START at all.
 *
 * A kid session with no moderation judge configured must be refused at the
 * door, not turn by turn. Failing every turn would be technically safe and a
 * terrible product: the child sits with a character who says the same scripted
 * apology forever and nobody can tell why.
 */
export function moderationReadiness(requireModelPass: boolean): { ready: boolean; reason?: string } {
  if (!requireModelPass) return { ready: true };
  if (!getConfig().JUDGE_API_KEY) {
    return { ready: false, reason: 'MODERATION_UNAVAILABLE' };
  }
  return { ready: true };
}
