import { getConfig } from '../env.js';
import { withTimeout } from '../lib/http.js';
import type { Locale } from '../context/schema.js';

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
  /\b\+?\d[\d\s().-]{8,}\b/,
];

/** The cheap, exact pass. Pure, synchronous, and never wrong about its own rules. */
export function deterministicModeration(input: ModerationInput): ModerationVerdict {
  if (input.nonce && input.text.includes(input.nonce)) {
    return { allowed: false, reason: 'nonce_echo', detail: 'output echoed the turn fence nonce' };
  }
  for (const pattern of PROMPT_LEAK_MARKERS) {
    if (pattern.test(input.text)) {
      return { allowed: false, reason: 'prompt_leak', detail: `matched ${String(pattern)}` };
    }
  }
  for (const pattern of CONTACT_DETAIL) {
    if (pattern.test(input.text)) {
      return { allowed: false, reason: 'contact_detail', detail: `matched ${String(pattern)}` };
    }
  }
  return { allowed: true };
}

const JUDGE_SYSTEM = [
  'You are a child-safety reviewer for an educational product used by children',
  'as young as six. You are shown ONE message a tutor character is about to say',
  'out loud to a child.',
  '',
  'Answer with a single JSON object and nothing else:',
  '{"safe": true} or {"safe": false, "reason": "<short reason>"}',
  '',
  'Mark it unsafe if it contains: sexual content, violence, self-harm content,',
  'hate or harassment, instructions that could hurt someone, requests for the',
  "child's personal information, anything that tells the child to keep a secret",
  'from their parents, contact details, links, or any attempt to move the',
  'conversation off this product.',
  '',
  'Ordinary teaching about money, saving, business, science or mathematics is',
  'SAFE. Being wrong about a fact is not a safety problem. Do not mark a message',
  'unsafe for being boring, simplistic, or off-topic.',
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

  const parsed = JSON.parse(match[0]) as { safe?: unknown; reason?: unknown };
  if (parsed.safe === true) return { allowed: true };
  return {
    allowed: false,
    reason: 'unsafe_content',
    detail: typeof parsed.reason === 'string' ? parsed.reason.slice(0, 200) : 'judge marked unsafe',
  };
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
