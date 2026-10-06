/*
 * line.ts — the one sealed line a Mentor says after a game race.
 *
 * WHAT IT DOES. After a finished race, the pit-stop card shows the Mentor's
 * observation about it. That observation always exists as authored copy in the
 * SPA. This is the optional upgrade: a model writes ONE or TWO short sentences
 * about the same single thing (the Decision Lens), in the Mentor's own voice and
 * the learner's age register. It is never a conversation and never graded: a
 * racing decision has no keyed answer, so the line only notices, it does not
 * score, praise a result or compare anyone with anyone.
 *
 * WHAT IT NEVER SEES. Four closed values (docs/games/KARTRUSH-INTEGRATION-DESIGN.md
 * 4.2): the Mentor, the locale, the age band and the lens key. No nickname, id,
 * time, track or free text exists in the input schema (`GameLineInputSchema`,
 * `.strict()`), and there is no learner text anywhere on this path, so there is
 * nothing to fence or classify; the model's REPLY is the only thing to guard.
 *
 * WHAT GUARDS THE REPLY. A small deterministic check (length, sentence count,
 * the Copy Budget glossary, no digits), then `moderateTutorOutput`, which fails
 * closed for a minor. Anything else, including the model being down, empty,
 * malformed or reasoning past its budget, is `null`, which the route answers
 * with a 204: the SPA keeps the authored line and the child never knows.
 *
 * WHY IT LIVES IN ORACLE. Core has no model client; the character voices, the
 * moderation judge and the spend guard are here (the placement intake's reason).
 * The route is off unless `GAME_AI_DEBRIEF` is `on`, and Core refuses to call it
 * without the guardian's consent and a per-learner daily cap.
 */

import { sealGameLine, type GameLineInput } from './schema.js';
import { complete, ModelUnavailableError } from '../model/provider.js';
import { moderateTutorOutput } from '../safety/moderation.js';
import { spendGuard } from '../session/spend-guard.js';
import { estimateCostUsd } from '../tutor/orchestrator.js';
import { CHARACTER_VOICES } from '../tutor/prompt.js';

/** One or two short sentences: a pit stop, not a lecture. ~120 tokens covers it with room. */
export const GAME_LINE_MAX_TOKENS = 120;
const MAX_LINE_CHARS = 240;
const MAX_SENTENCES = 2;

const LOCALE_NAME: Record<GameLineInput['locale'], string> = {
  'en-US': 'English (US)',
  'es-MX': 'Mexican Spanish',
  'pt-BR': 'Brazilian Portuguese',
};

/**
 * What each lens key means, in plain terms the model can describe without ever
 * judging. Authored here, never derived from the child: the lens key is the
 * whole of what the model learns about the race.
 */
export const LENS_FACTS: Record<GameLineInput['lens'], string> = {
  item_hold: 'They kept a power-up in hand while they passed several more item boxes, choosing to wait before using it.',
  drift_patient: 'They held a drift for a long time before letting go, to get the biggest boost.',
  drift_early: 'They let go of several drifts early, before the boost had grown.',
  steady: 'Their laps were almost exactly the same speed, lap after lap.',
  swingy: 'Their laps were quite different from one another, some quick and some slow.',
  neutral: 'They finished the race. Nothing in particular stood out, so say something warm and brief about racing on.',
};

const REGISTER: Record<GameLineInput['band'], string> = {
  '6-9': 'The learner is a young child (6 to 9). Use very short sentences (about 8 words), only everyday words, and a concrete picture. No abstract words.',
  '10-12': 'The learner is 10 to 12. Short, clear sentences and everyday words. A little curiosity is welcome.',
  '13-17': 'The learner is a teenager. Plain and direct, a light touch, never babyish and never a lecture.',
  adult: 'The learner is an adult. Plain, friendly and brief.',
};

/** Words the product glossary keeps out of anything a learner reads (Copy Budget, docs/games/KRV1-CONTRACT.md section 7). */
const GLOSSARY_BAN = /\b(tutor|bot|robot|assistant|ai|lives|life|freeze|xp|coins?|streak|score|points?|rank|ranking|winner|loser|best|worst|monedas?|moedas?|racha|sequ[eê]ncia|vidas?|pontos?|puntos?)\b/i;

/** The deterministic gate on the reply, before the moderation judge. Codes, never the text. */
export function lineViolation(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_LINE_CHARS) return 'length';
  if (/\d/.test(trimmed)) return 'digit';
  if (/[—–]/.test(trimmed)) return 'dash';
  if (/[\n\r]/.test(trimmed)) return 'lines';
  if (GLOSSARY_BAN.test(trimmed)) return 'glossary';
  const sentences = trimmed.split(/(?<=[.!?])\s+/).filter((s) => /[\p{L}]/u.test(s));
  if (sentences.length > MAX_SENTENCES) return 'sentences';
  return null;
}

function buildMessages(input: GameLineInput) {
  const system = [
    `You are ${CHARACTER_VOICES[input.mentor] ?? 'a friendly Mentor character.'}`,
    '',
    `The learner has just finished a kart race. Say ONE short line about it, in your own voice, in ${LOCALE_NAME[input.locale]}.`,
    REGISTER[input.band],
    '',
    `What to notice, and the only thing you know about the race: ${LENS_FACTS[input.lens]}`,
    '',
    'Rules:',
    `- One or two short sentences, under ${MAX_LINE_CHARS} characters in all. No questions.`,
    '- Notice, never judge: no praise for a result, no blame, no comparing with anyone.',
    '- No numbers, times, positions or places. No em dash.',
    '- Never mention points, coins, XP, streaks, lives, scores, ranks, or any AI, bot or assistant.',
    '- Do not invent anything else about the race or the learner.',
    '',
    'Output ONLY this JSON, no markdown fences:',
    '{"text": string}',
  ].join('\n');
  return [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: 'Write the line now.' },
  ];
}

function parseReply(raw: string): string | null {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    const keys = Object.keys(parsed);
    const text = (parsed as { text?: unknown }).text;
    return keys.length === 1 && keys[0] === 'text' && typeof text === 'string' ? text.trim() : null;
  } catch {
    return null;
  }
}

export interface GameLineResult {
  text: string;
  costUsd: number;
}

/**
 * Runs the line. Never throws for an operational reason: a null is "show the
 * authored line". The cost of a paid call is recorded with the spend guard even
 * when the reply is then refused, because the money is spent either way.
 */
export async function runGameLine(candidate: unknown): Promise<GameLineResult | null> {
  const input = sealGameLine(candidate);

  let raw: string;
  let costUsd = 0;
  try {
    const result = await complete(buildMessages(input), { temperature: 0.7, maxTokens: GAME_LINE_MAX_TOKENS, label: 'game-line' });
    raw = result.text;
    costUsd = estimateCostUsd(result.promptTokens, result.completionTokens);
    spendGuard.record(costUsd);
  } catch (err) {
    if (err instanceof ModelUnavailableError) return null;
    throw err;
  }

  const text = parseReply(raw);
  if (text === null || lineViolation(text) !== null) return null;

  // A child's screen: the judge is not optional below adulthood, and an unavailable judge is a refusal.
  const verdict = await moderateTutorOutput({
    text,
    locale: input.locale,
    tier: input.band === '6-9' ? 1 : 3,
    requireModelPass: input.band !== 'adult',
  });
  if (!verdict.allowed) return null;

  return { text, costUsd: Math.round(costUsd * 1_000_000) / 1_000_000 };
}
