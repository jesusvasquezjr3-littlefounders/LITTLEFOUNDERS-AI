/*
 * `npm run model:verify` — proves the TEACHING path against the LIVE providers,
 * through the real code rather than through curl.
 *
 * WHY IT EXISTS. Oracle shipped able to connect, greet, caption, save and
 * replay — and unable to answer a single question, because MODEL_API_BASE was
 * missing a path segment. Every layer above said it was fine: `/health`
 * reported `model: up` (it means "a key is configured"), the deploy preflight
 * passed all thirty checks, 142 tests passed against a local fake. The only
 * thing that found it was typing a question into production, and that is not a
 * check anyone can run on a schedule.
 *
 * A curl to /chat/completions is a better check and still not enough. It
 * proves the endpoint, key and model NAME answer. It does not prove the four
 * things between that answer and a learner being taught:
 *
 *   1. SEAL      — does a context still pass `sealContext()`? That is the
 *                  privacy boundary; nothing reaches the model without it.
 *   2. TRANSPORT — does the live provider answer OUR request, including
 *                  `response_format: json_object`, which not every model
 *                  supports and which a model-name change can silently drop?
 *   3. SHAPE     — does the completion parse as a TutorTurn? Closed emotion
 *                  and action enums, one free-text field, three control
 *                  decisions. A model that answers beautifully in prose fails
 *                  here, and a discarded turn is a scripted line to a learner.
 *   4. JUDGE     — does the independent moderator pass ordinary teaching? A
 *                  judge that refuses everything is as broken as one that is
 *                  down, and both look like a healthy service from outside.
 *
 * It starts no session, writes no row, and needs no learner. The context below
 * is synthetic and carries exactly what the schema allows — a nickname that is
 * not a name, an age BAND, no identifiers.
 *
 * Costs one short completion and one short moderation call.
 */

import process from 'node:process';
import { getConfig } from '../src/env.js';
import { sealContext } from '../src/context/schema.js';
import { TUTOR_SYSTEM_PROMPT, buildContextMessage } from '../src/tutor/prompt.js';
import { complete, ModelUnavailableError } from '../src/model/provider.js';
import { parseTurn } from '../src/tutor/turnSchema.js';
import { moderateTutorOutput } from '../src/safety/moderation.js';

let failures = 0;

function ok(label: string, detail = ''): void {
  console.log(`  ok    ${label}${detail ? ` — ${detail}` : ''}`);
}

function bad(label: string, detail: string): void {
  failures += 1;
  console.log(`  FAIL  ${label} — ${detail}`);
}

async function main(): Promise<void> {
  const config = getConfig();

  console.log('== What this Oracle is configured to call ==');
  console.log(`  model    ${config.MODEL_NAME} at ${config.MODEL_API_BASE}`);
  console.log(`  judge    ${config.JUDGE_MODEL_NAME} at ${config.JUDGE_API_BASE}`);
  console.log(`  keys     model ${config.MODEL_API_KEY ? 'set' : 'MISSING'}, judge ${config.JUDGE_API_KEY ? 'set' : 'MISSING'}`);
  console.log('');

  if (!config.MODEL_API_KEY) {
    console.error('MODEL_API_KEY is not set — nothing to verify. The tutor would be live and unable to teach.');
    process.exit(1);
  }

  // ── 1. SEAL ───────────────────────────────────────────────────────────────
  // Deliberately ordinary and deliberately anonymous: a nickname that is not a
  // name, an age band rather than an age, no ids of any kind.
  console.log('== 1. The privacy seal ==');
  let context;
  try {
    context = sealContext({
      nickname: 'Chispa',
      tier: 2,
      locale: 'es-MX',
      character: 'rho',
      intent: 'faq',
      adaptations: [],
      courseContext: null,
      skillStates: [],
      turnHistory: [{ speaker: 'learner', text: '¿Qué significa de verdad ahorrar?' }],
    });
    ok('sealContext accepted an ordinary context');
  } catch (error) {
    bad('sealContext', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  // ── 2. TRANSPORT ──────────────────────────────────────────────────────────
  console.log('');
  console.log('== 2. The live provider, through our own client ==');
  const started = Date.now();
  let completion;
  try {
    completion = await complete([
      { role: 'system', content: TUTOR_SYSTEM_PROMPT },
      { role: 'user', content: buildContextMessage(context) },
    ]);
    ok(
      'the model answered',
      `${Date.now() - started} ms, ${completion.promptTokens} in / ${completion.completionTokens} out`,
    );
  } catch (error) {
    // The message carries the status code, which is the whole diagnosis:
    // 404 wrong URL · 401 wrong key · 400 retired model · 402 no credit.
    const detail = error instanceof ModelUnavailableError ? error.message : String(error);
    bad('the model did not answer', detail);
    console.log('');
    console.log('  Every learner would get the scripted MODEL_DOWN line instead of a lesson.');
    process.exit(1);
  }

  // ── 3. SHAPE ──────────────────────────────────────────────────────────────
  console.log('');
  console.log('== 3. The closed turn schema ==');
  const parsed = parseTurn(completion.text);
  if (!parsed.ok) {
    bad(`the completion is not a turn (${parsed.reason})`, parsed.detail);
    console.log('');
    console.log('  Raw completion, first 300 chars:');
    console.log(`  ${completion.text.slice(0, 300).replace(/\n/g, ' ')}`);
    console.log('');
    console.log('  A discarded turn is a scripted line to a learner. If the model is new,');
    console.log('  check that it honours response_format: json_object.');
    process.exit(1);
  }
  ok('parsed as a TutorTurn', `emotion=${parsed.turn.emotion} action=${parsed.turn.action} next=${parsed.turn.next}`);
  console.log(`        say: ${parsed.turn.say.slice(0, 160)}${parsed.turn.say.length > 160 ? '…' : ''}`);

  // ── 4. JUDGE ──────────────────────────────────────────────────────────────
  console.log('');
  console.log('== 4. The independent moderator ==');
  // requireModelPass: true is the KID path — the stricter of the two, and the
  // one worth verifying. An adult session tolerates a missing judge; a minor's
  // session must not start without one.
  const verdict = await moderateTutorOutput({
    text: parsed.turn.say,
    locale: 'es-MX',
    tier: 2,
    requireModelPass: true,
  });
  if (verdict.allowed) {
    ok('the judge passed ordinary teaching', 'kid path (requireModelPass)');
  } else {
    bad(`the judge refused ordinary teaching (${verdict.reason})`, verdict.detail ?? 'no detail');
    console.log('');
    console.log('  A judge that refuses everything is as broken as one that is down:');
    console.log('  no minor gets a single sentence, and the service looks healthy.');
  }

  console.log('');
  if (failures > 0) {
    console.log(`model:verify FAILED — ${failures} stage(s) broken.`);
    process.exit(1);
  }
  console.log('model:verify OK — sealed, answered, parsed, and passed the judge.');
}

await main();
