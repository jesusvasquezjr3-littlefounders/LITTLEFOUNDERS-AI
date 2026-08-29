/*
 * `npm run model:probe` — WHICH model should Oracle teach with?
 *
 * WHY THIS EXISTS. `tutor-deploy.yml` states the requirement outright: "Oracle
 * needs a NON-reasoning model: deepseek-v4-pro spends the whole completion
 * budget on reasoning_content and returns empty content, which reaches a
 * learner as the scripted 'my thoughts got tangled' line on every single
 * turn." Production is nevertheless running `deepseek-v4-flash`, which does
 * exactly that — measured on 2026-08-29: 577 of 666 completion tokens spent on
 * `reasoning_content`, an empty `content` on two of four probes, and a turn
 * that needed its retry taking 38 s against a client that gives up at 25.
 *
 * So the requirement is written down and violated, and the reason it stayed
 * violated is that nobody could answer "then which one?" without guessing. A
 * wrong guess costs a deploy cycle and a live tutor that cannot teach.
 *
 * This asks the provider instead. It lists the models the account can actually
 * reach, then puts each candidate through ONE real turn and reports the three
 * things that decide it:
 *
 *   REASONS   does the response carry `reasoning_content`? That is the
 *             disqualifier — a reasoning model spends the budget thinking and
 *             hands back an empty answer often enough to break a conversation.
 *   ANSWERS   does the completion parse as a TutorTurn? A model that writes
 *             beautiful prose and ignores the schema teaches nobody.
 *   IN TIME   how long did it take? The client stops waiting at 25 s, and a
 *             turn is only useful if it arrives before that.
 *
 * It changes nothing. Provisioning stays a separate, deliberate step.
 *
 * Costs one short completion per candidate.
 */

import process from 'node:process';
import { getConfig } from '../src/env.js';
import { sealContext, type TutorContext } from '../src/context/schema.js';
import { TUTOR_SYSTEM_PROMPT, buildContextMessage } from '../src/tutor/prompt.js';
import { parseTurn } from '../src/tutor/turnSchema.js';

/**
 * Candidates, tried in order. Overridable with `MODEL_CANDIDATES` (comma
 * separated) so a name learned from the listing below can be probed without a
 * code change.
 *
 * The currently-configured model is always included, so every run reports the
 * baseline it is being compared against rather than assuming the reader
 * remembers it.
 */
const DEFAULT_CANDIDATES = ['deepseek-chat', 'deepseek-v4-flash', 'deepseek-v4-pro'];

const CONTEXT: TutorContext = {
  nickname: 'Chispa',
  tier: 2,
  locale: 'es-MX',
  character: 'rho',
  intent: 'faq',
  adaptations: [],
  courseContext: null,
  skillStates: [],
  turnHistory: [{ speaker: 'learner', text: '¿Qué significa de verdad ahorrar?' }],
  planState: null,
  previousSessions: [],
  pedagogy: null,
  openActivity: null,
};

interface Probe {
  model: string;
  ok: boolean;
  reasons: boolean;
  parsed: boolean;
  ms: number;
  contentChars: number;
  reasoningChars: number;
  note: string;
}

async function listModels(base: string, key: string): Promise<string[]> {
  try {
    const response = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${key}` } });
    if (!response.ok) return [];
    const body = (await response.json()) as { data?: { id?: unknown }[] };
    return (body.data ?? []).map((m) => String(m.id ?? '')).filter(Boolean);
  } catch {
    return [];
  }
}

async function probe(model: string, base: string, key: string, context: TutorContext): Promise<Probe> {
  const started = Date.now();
  const result: Probe = {
    model,
    ok: false,
    reasons: false,
    parsed: false,
    ms: 0,
    contentChars: 0,
    reasoningChars: 0,
    note: '',
  };
  try {
    const response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: TUTOR_SYSTEM_PROMPT },
          { role: 'user', content: buildContextMessage(context) },
          { role: 'user', content: '¿Qué significa de verdad ahorrar?' },
        ],
        temperature: 0.6,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      }),
    });
    result.ms = Date.now() - started;

    const raw = await response.text();
    if (!response.ok) {
      result.note = `HTTP ${response.status}: ${raw.slice(0, 120)}`;
      return result;
    }

    const body = JSON.parse(raw) as {
      choices?: { message?: { content?: unknown; reasoning_content?: unknown } }[];
      usage?: { completion_tokens_details?: { reasoning_tokens?: number } };
    };
    const message = body.choices?.[0]?.message ?? {};
    const content = typeof message.content === 'string' ? message.content : '';
    const reasoning = typeof message.reasoning_content === 'string' ? message.reasoning_content : '';
    const reasoningTokens = body.usage?.completion_tokens_details?.reasoning_tokens ?? 0;

    result.contentChars = content.length;
    result.reasoningChars = reasoning.length;
    // Either signal counts: some providers report the tokens without echoing
    // the text, and a model that spends the budget thinking disqualifies itself
    // whether or not it shows its work.
    result.reasons = reasoning.length > 0 || reasoningTokens > 0;
    result.parsed = parseTurn(content).ok;
    result.ok = content.length > 0 && result.parsed;
    if (content.length === 0) result.note = 'empty content';
    else if (!result.parsed) result.note = 'did not parse as a TutorTurn';
    return result;
  } catch (error) {
    result.ms = Date.now() - started;
    result.note = error instanceof Error ? error.message : String(error);
    return result;
  }
}

async function main(): Promise<void> {
  const config = getConfig();
  if (!config.MODEL_API_KEY) {
    console.error('MODEL_API_KEY is not set — nothing to probe.');
    process.exit(1);
  }

  const context = sealContext(CONTEXT);

  console.log(`== Models this account can reach at ${config.MODEL_API_BASE} ==`);
  const available = await listModels(config.MODEL_API_BASE, config.MODEL_API_KEY);
  console.log(available.length > 0 ? `  ${available.join(', ')}` : '  (the provider did not list any)');

  const requested = process.env.MODEL_CANDIDATES?.split(',').map((s) => s.trim()).filter(Boolean);
  const candidates = [...new Set([...(requested ?? DEFAULT_CANDIDATES), config.MODEL_NAME])];

  console.log('');
  console.log(`== One real turn each. Current production model: ${config.MODEL_NAME} ==`);
  const results: Probe[] = [];
  for (const model of candidates) {
    const r = await probe(model, config.MODEL_API_BASE, config.MODEL_API_KEY, context);
    results.push(r);
    const verdict = r.ok ? (r.reasons ? 'USABLE but REASONS' : 'GOOD') : 'UNUSABLE';
    console.log(
      `  ${verdict.padEnd(18)} ${model.padEnd(22)} ${String(r.ms).padStart(6)} ms  ` +
        `content ${String(r.contentChars).padStart(5)}  reasoning ${String(r.reasoningChars).padStart(5)}` +
        (r.note ? `  — ${r.note}` : ''),
    );
  }

  console.log('');
  console.log('== What this means ==');
  const good = results.filter((r) => r.ok && !r.reasons).sort((a, b) => a.ms - b.ms);
  if (good.length === 0) {
    console.log('  No candidate both answered in the required shape AND avoided reasoning.');
    console.log('  Set MODEL_CANDIDATES to names from the listing above and run again.');
    process.exit(1);
  }
  const best = good[0]!;
  console.log(`  Recommended: ${best.model} — answered in ${best.ms} ms with no reasoning_content.`);
  console.log('  Nothing was changed. To adopt it:');
  console.log(`    gh workflow run tutor-deploy.yml -f step=provision -f model_name=${best.model}`);
}

await main();
