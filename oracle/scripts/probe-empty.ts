/*
 * `npm run model:probe-empty` — WHY does the provider return whitespace, and
 * what actually reduces it?
 *
 * THE PROBLEM, measured and named. `deepseek-chat` returns completions with
 * `finish_reason=stop`, no reasoning, 41-87 completion tokens billed, and
 * `message.content` holding 45-76 characters — of whitespace. `produce()`
 * retries and the second call answers, so no learner ever sees one, but we pay
 * for a second call on a large fraction of turns.
 *
 * WHY THIS SCRIPT EXISTS RATHER THAN ANOTHER CONVERSATION. The first attempt
 * to fix it was measured through `tutor:converse`, which produced 18 empties in
 * one run and 32 in another AT THE SAME SETTING. Against that spread, a change
 * that moved the number to 40 taught me nothing except that I had been reading
 * noise as signal — and I had already shipped the change before noticing. A
 * conversation is the right instrument for "is this a good lesson" and the
 * wrong one for "does this parameter matter": it varies the prompt, the
 * history and the turn count all at once.
 *
 * So this holds everything still and changes ONE thing at a time. Same context,
 * same messages, N identical calls per condition, counting how many come back
 * as whitespace. It is the experiment the conversation could not be.
 *
 * Costs N × (number of conditions) short completions. Nothing is changed.
 */

import process from 'node:process';
import { getConfig } from '../src/env.js';
import { sealContext, type TutorContext } from '../src/context/schema.js';
import { TUTOR_SYSTEM_PROMPT, buildContextMessage } from '../src/tutor/prompt.js';

const CONTEXT: TutorContext = {
  nickname: 'Chispa',
  tier: 2,
  locale: 'es-MX',
  character: 'rho',
  intent: 'open',
  adaptations: [],
  courseContext: null,
  skillStates: [],
  turnHistory: [
    { speaker: 'learner', text: '¿qué es el interés compuesto?' },
    { speaker: 'tutor', text: 'Imagina que guardas 100 pesos y cada año ganas 10.' },
    { speaker: 'learner', text: 'si algo cuesta 25 y pago con 50 el cambio son 35 verdad?' },
  ],
  planState: null,
  previousSessions: [],
  pedagogy: null,
  openActivity: null,
};

/** The correction the RETRY appends today, and the variable under test. */
const CORRECTION =
  'Reply with ONLY the JSON object described above. No prose, no markdown fence, no blank reply.';

interface Condition {
  name: string;
  temperature: number;
  correction: boolean;
}

const CONDITIONS: Condition[] = [
  { name: 'as production runs today', temperature: 0.6, correction: false },
  { name: 'with the retry correction on the FIRST call', temperature: 0.6, correction: true },
];

/** How many calls per condition. Small enough to be cheap, large enough to see a difference. */
const N = 12;

interface Outcome {
  empty: boolean;
  contentChars: number;
  completionTokens: number;
}

async function once(condition: Condition, context: TutorContext): Promise<Outcome | null> {
  const config = getConfig();
  const messages = [
    { role: 'system', content: TUTOR_SYSTEM_PROMPT },
    { role: 'user', content: buildContextMessage(context) },
    { role: 'user', content: 'no entendí, explícamelo otra vez' },
    ...(condition.correction ? [{ role: 'user', content: CORRECTION }] : []),
  ];
  try {
    const response = await fetch(`${config.MODEL_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.MODEL_API_KEY}` },
      body: JSON.stringify({
        model: config.MODEL_NAME,
        messages,
        temperature: condition.temperature,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      }),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      choices?: { message?: { content?: unknown } }[];
      usage?: { completion_tokens?: number };
    };
    const content =
      typeof body.choices?.[0]?.message?.content === 'string'
        ? (body.choices[0].message.content as string)
        : '';
    return {
      empty: content.trim() === '',
      contentChars: content.length,
      completionTokens: body.usage?.completion_tokens ?? 0,
    };
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const config = getConfig();
  if (!config.MODEL_API_KEY) {
    console.error('MODEL_API_KEY is not set — nothing to measure.');
    process.exit(1);
  }
  const context = sealContext(CONTEXT);

  console.log(`== Whitespace completions from ${config.MODEL_NAME}, ${N} calls per condition ==`);
  console.log('');

  const results: { condition: Condition; empties: number; usable: number }[] = [];
  for (const condition of CONDITIONS) {
    let empties = 0;
    let usable = 0;
    let billedForNothing = 0;
    for (let i = 0; i < N; i += 1) {
      const outcome = await once(condition, context);
      if (outcome === null) continue;
      usable += 1;
      if (outcome.empty) {
        empties += 1;
        billedForNothing += outcome.completionTokens;
      }
    }
    results.push({ condition, empties, usable });
    const pct = usable > 0 ? Math.round((empties / usable) * 100) : 0;
    console.log(
      `  ${String(pct).padStart(3)}%  ${String(empties).padStart(2)}/${usable}  ` +
        `${condition.name}` +
        (billedForNothing > 0 ? `  — ${billedForNothing} completion tokens billed for whitespace` : ''),
    );
  }

  console.log('');
  const [baseline, treatment] = results;
  if (!baseline || !treatment || baseline.usable === 0 || treatment.usable === 0) {
    console.log('  not enough usable calls to compare.');
    process.exit(1);
  }
  const before = baseline.empties / baseline.usable;
  const after = treatment.empties / treatment.usable;
  console.log(`  baseline ${Math.round(before * 100)}%  →  treatment ${Math.round(after * 100)}%`);
  /*
   * Twelve calls per condition cannot separate small differences, and saying
   * so is the point — the last change was shipped on a difference this
   * instrument could not have measured.
   */
  if (Math.abs(after - before) < 0.2) {
    console.log('  Difference is within what 12 calls can distinguish. Not a result.');
  } else if (after < before) {
    console.log('  The correction message REDUCES whitespace completions. Worth adopting.');
  } else {
    console.log('  The correction message makes it WORSE. Do not adopt.');
  }
}

await main();
