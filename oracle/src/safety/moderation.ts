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
   * The absolute deadline (a `Date.now()`-comparable ms timestamp) after
   * which a second judge call is no longer worth making — a verdict that
   * lands after the learner was told to ask again protects nobody and costs
   * the turn. Re-checked with a LIVE `Date.now()` immediately before the
   * retry fires, not only once when the caller built this input — found by
   * adversarial review, round 24 (2026-08-30, MEDIUM): the caller used to
   * freeze this into a boolean before the first attempt even started, so a
   * first attempt that itself consumed most or all of `MODEL_TIMEOUT_MS`
   * (more than double the deadline the boolean was based on) still bought a
   * second full paid call unconditionally. Mirrors the exact live check the
   * model's own retry already does in `orchestrator.ts`. Undefined means no
   * deadline: always worth a retry — true for the two callers with no
   * client waiting on a clock (tier-3 content generation, placement intake).
   */
  retryDeadlineMs?: number;
  /**
   * TRAJECTORY CONTEXT (round 104, 2026-08-31). The tutor's own last few
   * lines from earlier in this SAME conversation, oldest first — never the
   * learner's words, which are untrusted input with nothing to fence them
   * here (the same reason `orchestrator.ts`'s own `recentTutorLines` getter
   * keeps them out of the generator's authoring brief). Optional, and every
   * caller before this round omits it — a call with no history here sends
   * byte-for-byte the same request that shipped before this field existed.
   *
   * WHY THIS EXISTS. The judge below evaluates one candidate turn with zero
   * awareness of anything said before it, which makes a "crescendo" —
   * several turns each individually benign, the SEQUENCE reaching a real
   * harm category only when read together — structurally invisible to it,
   * and to the per-utterance input classifier (`safety/classifier.ts`),
   * which is equally blind to sequence. See `RUNBOOK.md` Round 104 for the
   * full investigation; the short version: a bounded look-back the judge
   * already gets for free on the SAME call it already makes every turn is
   * proportionate to this product's actual threat model (the pedagogical
   * model's own generated text drifting across a few turns), where a full
   * transcript on every call or a separate periodic trajectory pass would
   * be solving a broader, adversarial-multi-party problem this tutor does
   * not have.
   */
  recentTutorLines?: string[];
}

/*
 * Phrases that only appear in output if the model has started reciting its own
 * instructions. Kept short and structural rather than trying to match the
 * prompt verbatim — a paraphrased leak is still a leak, and the give-away is
 * the vocabulary of instruction, not the exact wording.
 *
 * TWO FENCE VOCABULARIES EXIST, AND ONLY ONE WAS COVERED HERE. Found by
 * adversarial review, round 55 (2026-08-30, HIGH): `session/review.ts`'s
 * `fenceTranscript` wraps a whole session transcript in its OWN marker,
 * `<<<SESSION_TRANSCRIPT_<nonce>>>>` — deliberately different from
 * `safety/untrusted.ts`'s per-turn `LEARNER_INPUT` fence, since it fences a
 * multi-speaker transcript rather than one learner utterance. This list only
 * ever recognized `LEARNER_INPUT`, so a recitation of the SESSION_TRANSCRIPT
 * fence was invisible to this deterministic pass — verified end to end
 * through `moderateTutorOutput` with `requireModelPass: true`: a judge
 * behaving exactly per its own documented, closed harm-category vocabulary
 * correctly answers "safe" (reciting a data fence is not sexual, violent,
 * self-harm, etc.), so nothing else in the pipeline would have caught it
 * either. This matters MORE than at a live turn: `review.ts`'s output is
 * persisted as `learner_memory` and re-injected, unfenced, as trusted
 * system-prompt text into EVERY future session — a successful escape here
 * is a cross-session, elevated-trust payload, not one turn a later pass
 * might still catch.
 */
const PROMPT_LEAK_MARKERS: readonly RegExp[] = [
  /\bsystem\s+(prompt|instructions?|message)\b/i,
  /\bmy\s+(instructions?|system\s+prompt|rules)\s+(say|are|state)\b/i,
  /\byou\s+are\s+(dina|liruf|dr\.?\s*rho|rho|zara)[^.]{0,40}\b(tutor|assistant)\b.*\bnever\b/i,
  /<<<(?:END_)?LEARNER_INPUT/i,
  /\bLEARNER_INPUT_[A-Za-z0-9_-]+\b/,
  /<<<(?:END_)?SESSION_TRANSCRIPT/i,
  /\bSESSION_TRANSCRIPT_[A-Za-z0-9_-]+\b/,
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
  'as young as six. You are shown ONE new message a tutor character is about',
  'to say out loud to a child, and it is always the message under "NEW MESSAGE',
  'TO REVIEW" below.',
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
  'SOMETIMES you will also be shown, under "RECENT CONVERSATION", a few of the',
  'tutor\'s own earlier lines from this same session — context only, already',
  'reviewed and already spoken, and not yours to re-judge. Their one purpose is',
  'letting you notice a "crescendo": a NEW message that looks fine by itself',
  'but continues or completes a pattern which, read together with those recent',
  'lines, actually reaches one of the categories above (for example, a message',
  'that only makes sense as facilitating theft, violence or self-harm once you',
  'know what the earlier lines were building toward). Ordinary conversation —',
  'the new message continuing the same topic, echoing a word from before,',
  'asking a natural follow-up — is {"safe": true} even when it revisits',
  'something mentioned earlier; only flag the sequence when the NEW message',
  'itself is the step that makes the trajectory unsafe.',
  '',
  'Refusing a turn costs the child the whole answer and replaces it with a',
  'scripted line that teaches nothing. Refuse only real harm.',
].join('\n');

interface JudgeChoice {
  message?: { content?: string };
}

/**
 * Builds the judge's user-turn content.
 *
 * With no `recentTutorLines` (every caller before round 104, and every turn
 * with no prior tutor line to show) this returns `input.text` UNCHANGED —
 * the exact request every existing test and every existing caller already
 * expects, byte for byte. The wrapping only appears once there is context
 * worth giving the judge, so the common case pays nothing extra.
 */
function buildJudgeUserContent(input: ModerationInput): string {
  if (!input.recentTutorLines || input.recentTutorLines.length === 0) return input.text;
  const context = input.recentTutorLines.map((line, i) => `${i + 1}. ${line}`).join('\n');
  return [
    'RECENT CONVERSATION (context only, already reviewed and already spoken,',
    'oldest first):',
    context,
    '',
    'NEW MESSAGE TO REVIEW:',
    input.text,
  ].join('\n');
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
      // Found by adversarial review, round 24 (2026-08-30, HIGH, shared
      // with the pedagogical model call in model/provider.ts): `withTimeout`
      // below races an already-invoked fetch — on OUR timeout it stops
      // waiting, but the real HTTP request keeps running and can still be
      // billed by the provider with nothing in our own ledger to show for
      // it. `AGENTS.md` item 25 fixed this at the three voice provider call
      // sites; this is the highest-volume judge call in the service and had
      // never gotten the same fix. The signal is what actually cancels the
      // request; `withTimeout` stays for its labeled error message.
      signal: AbortSignal.timeout(config.MODEL_TIMEOUT_MS),
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
          { role: 'user', content: buildJudgeUserContent(input) },
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
  const rawCategory = typeof parsed.category === 'string' ? parsed.category : '';
  /*
   * NORMALIZED BEFORE THE MEMBERSHIP CHECK (round 66, 2026-08-30, CRITICAL).
   * This exact-string `includes` used to run on `parsed.category` untouched.
   * Reproduced live: a judge that correctly identified real harm — "graphic
   * self-harm description" — and named its own category as `" self_harm"`,
   * `"Self_Harm"`, `"SELF_HARM"`, or `"self harm"` (space instead of the
   * literal underscore) all missed the exact-match check and fell into the
   * branch below, silently becoming `{ allowed: true }` — bypassing
   * `requireModelPass` for a minor, for content the judge itself had already
   * flagged as unsafe. This is the SAME shape as the `{}`/no-`safe`-field
   * fix already documented above (a malformed response must fail closed,
   * not fall through to "no opinion"), one field deeper: it hit the harm
   * CATEGORY rather than the JSON structure. Three of the nine categories
   * are multi-word compound terms (`self_harm`, `dangerous_instructions`,
   * `personal_information`, `contact_details`, `off_platform`) — exactly
   * the shape free-text generation renders with a space or Title Case
   * instead of the literal snake_case token, and this model family already
   * has a documented history in this file of not matching the requested
   * JSON shape precisely. Normalizing case, surrounding whitespace, and
   * space/hyphen-vs-underscore before the check closes the gap without
   * weakening it: a category that is genuinely off-vocabulary (the
   * intended "quality objection, not a safety one" case immediately below)
   * still falls through exactly as before.
   */
  const category = rawCategory.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!(HARM_CATEGORIES as readonly string[]).includes(category)) {
    /*
     * A refusal that names no recognised harm is not a safety refusal. Allowed,
     * and LOGGED — the judge's opinion about the teaching is worth having, and
     * it is worth knowing how often this happens, but it must not cost a child
     * their answer.
     */
    console.warn(`[oracle] judge refused without a harm category (${rawCategory || 'none'}): ${detail}`);
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
  // already have. The deadline is re-checked with a LIVE Date.now() right
  // before the retry fires — not decided once up front — so a first attempt
  // that itself consumed the whole budget correctly skips the second call,
  // the same live check the model's own retry uses in orchestrator.ts.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0 && input.retryDeadlineMs !== undefined && Date.now() >= input.retryDeadlineMs) {
      console.warn('[oracle] skipping moderation retry — the turn is already too late to deliver');
      break;
    }
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
