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
/*
 * `TutorContext` is imported so every fixture below can be `satisfies
 * TutorContext`. `sealContext` takes `unknown` by design — it is the privacy
 * boundary and must validate whatever arrives — which means TypeScript cannot
 * protect a fixture that drifts from the schema. Adding `openActivity` broke
 * this script's first context silently, and the only thing that noticed was a
 * live run against production. `satisfies` turns that into a compile error.
 */
import { sealContext, type TutorContext } from '../src/context/schema.js';
import {
  TUTOR_SYSTEM_PROMPT,
  buildContextMessage,
  promisesAnActivity,
  tierVocabularyViolation,
} from '../src/tutor/prompt.js';
import { complete, DEFAULT_MAX_TOKENS, ModelUnavailableError } from '../src/model/provider.js';
import { parseTurn } from '../src/tutor/turnSchema.js';
import { moderateTutorOutput } from '../src/safety/moderation.js';

let failures = 0;

/**
 * What `complete()` deliberately does not tell you.
 *
 * The client throws a short reason and drops the body, which is right for a
 * live turn and useless for a diagnosis — "model returned an empty completion"
 * has at least four causes that need different fixes, and they are all visible
 * in the response it just discarded. So on failure only, this repeats the
 * request and prints the fields that separate them:
 *
 *   finish_reason: 'length'          the budget ran out before any content
 *   reasoning_content present        a REASONING model spent the budget
 *                                    thinking; `content` is genuinely empty
 *   content: ''  with usage > 0      we were billed for nothing
 *   an error envelope in the body    the provider explained itself and the
 *                                    status code did not
 *
 * It mirrors the request in `src/model/provider.ts` rather than importing it,
 * because the whole point is to see the RAW response that function throws
 * away. Keep the body in step with it; a diagnosis of a different request is
 * worse than no diagnosis.
 */
async function diagnose(context: unknown): Promise<void> {
  const config = getConfig();
  console.log('');
  console.log('  -- raw response, for diagnosis --');
  try {
    const response = await fetch(`${config.MODEL_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.MODEL_API_KEY}`,
      },
      body: JSON.stringify({
        model: config.MODEL_NAME,
        messages: [
          { role: 'system', content: TUTOR_SYSTEM_PROMPT },
          { role: 'user', content: buildContextMessage(context as never) },
        ],
        temperature: 0.6,
        // The SAME budget the client uses. Hardcoding a number here is how the
        // first version of this diagnostic reported 400 while the client had
        // moved to 800, and sent the reader after the wrong cause.
        max_tokens: DEFAULT_MAX_TOKENS,
        response_format: { type: 'json_object' },
      }),
    });
    const raw = await response.text();
    console.log(`  HTTP ${response.status}`);
    let body: {
      choices?: { message?: Record<string, unknown>; finish_reason?: string }[];
      usage?: Record<string, unknown>;
      error?: unknown;
    };
    try {
      body = JSON.parse(raw) as typeof body;
    } catch {
      console.log(`  body is not JSON: ${raw.slice(0, 400)}`);
      return;
    }
    if (body.error !== undefined) {
      console.log(`  error: ${JSON.stringify(body.error).slice(0, 400)}`);
    }
    const choice = body.choices?.[0];
    console.log(`  finish_reason: ${choice?.finish_reason ?? '(none)'}`);
    console.log(`  usage: ${JSON.stringify(body.usage ?? {})}`);
    const message = choice?.message ?? {};
    for (const [key, value] of Object.entries(message)) {
      const shown = typeof value === 'string' ? `${value.length} chars: ${value.slice(0, 200)}` : JSON.stringify(value);
      console.log(`  message.${key} = ${shown}`);
    }
    if (Object.keys(message).length === 0) console.log('  message: (absent)');
  } catch (error) {
    console.log(`  the diagnostic call itself failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

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
      planState: null,
      previousSessions: [],
      pedagogy: null,
      openActivity: null,
    } satisfies TutorContext);
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
    // The message carries the status code, which is most of the diagnosis:
    // 404 wrong URL · 401 wrong key · 400 retired model · 402 no credit.
    const detail = error instanceof ModelUnavailableError ? error.message : String(error);
    bad('the model did not answer', detail);
    await diagnose(context);
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

  // ── 5. THE THINGS THAT ONLY A LIVE MODEL CAN PROVE ────────────────────────
  //
  // Everything above proves the pipeline carries a turn. These four prove the
  // turn is TEACHING — and each one exists because the shipped product failed
  // it in front of the owner. Unit tests pin the plumbing with a stubbed
  // model; only the real one can show whether it actually behaves.
  console.log('');
  console.log('== 5. Does it teach the way it must? ==');

  // 5a. THE AGE BAND. The prompt has always said "never use percentages" for a
  // six-year-old, and on 2026-08-28 the tutor taught "interés compuesto" with
  // "10% cada año". Telling is not checking.
  const youngContext = sealContext({
    nickname: 'Chispa',
    tier: 1,
    locale: 'es-MX',
    character: 'rho',
    intent: 'faq',
    adaptations: [],
    courseContext: null,
    skillStates: [],
    turnHistory: [{ speaker: 'learner', text: '¿cómo crece el dinero en el banco?' }],
    planState: null,
    previousSessions: [],
    pedagogy: null,
    openActivity: null,
  } satisfies TutorContext);
  try {
    const young = await complete([
      { role: 'system', content: TUTOR_SYSTEM_PROMPT },
      { role: 'user', content: buildContextMessage(youngContext) },
      { role: 'user', content: '¿cómo crece el dinero en el banco?' },
    ]);
    const youngTurn = parseTurn(young.text);
    if (!youngTurn.ok) {
      bad('a tier-1 answer did not parse', youngTurn.detail);
    } else {
      const slip = tierVocabularyViolation(youngTurn.turn.say, 1);
      if (slip === null) ok('a six-year-old is answered without percentages or decimals');
      else bad('tier-1 vocabulary reached the learner', `${slip} in: ${youngTurn.turn.say.slice(0, 120)}`);
    }
  } catch (error) {
    bad('the tier-1 probe failed', error instanceof Error ? error.message : String(error));
  }

  // 5b. A PROMISE IS KEPT. Twice in the owner's sessions the tutor announced an
  // activity and delivered none: prose could promise what the turn never asked
  // for, and no gate compared the two.
  try {
    const asked = await complete([
      { role: 'system', content: TUTOR_SYSTEM_PROMPT },
      { role: 'user', content: buildContextMessage(context) },
      { role: 'user', content: 'ya entendí, ahora ponme un ejercicio de verdad para practicar' },
    ]);
    const askedTurn = parseTurn(asked.text);
    if (!askedTurn.ok) {
      bad('the activity request did not parse', askedTurn.detail);
    } else if (promisesAnActivity(askedTurn.turn.say) && askedTurn.turn.next !== 'segment') {
      bad(
        'the tutor promised an activity it did not request',
        `next=${askedTurn.turn.next} for: ${askedTurn.turn.say.slice(0, 120)}`,
      );
    } else {
      ok(
        'no unkept promise',
        askedTurn.turn.next === 'segment' ? 'it asked for the activity' : 'it did not announce one',
      );
    }
  } catch (error) {
    bad('the activity-request probe failed', error instanceof Error ? error.message : String(error));
  }

  // 5c. IT TALKS ABOUT THE ACTIVITY ON SCREEN. The tutor asks for a SKILL and
  // the ladder picks the segment; before `openActivity` it narrated from
  // imagination and congratulated a learner for change they never gave.
  try {
    const withActivity = sealContext({
      nickname: 'Chispa',
      tier: 2,
      locale: 'es-MX',
      character: 'rho',
      intent: 'faq',
      adaptations: [],
      courseContext: null,
      skillStates: [],
      turnHistory: [],
      planState: null,
      previousSessions: [],
      pedagogy: null,
      openActivity: {
        type: 'order_steps',
        prompt: 'Ordena las monedas y billetes del que vale menos al que vale más.',
      },
    } satisfies TutorContext);
    const reaction = await complete([
      { role: 'system', content: TUTOR_SYSTEM_PROMPT },
      { role: 'user', content: buildContextMessage(withActivity) },
      {
        role: 'user',
        content:
          'The learner completed the activity and scored 100 out of 100. React to that as their tutor.',
      },
    ]);
    const reactionTurn = parseTurn(reaction.text);
    if (!reactionTurn.ok) {
      bad('the activity reaction did not parse', reactionTurn.detail);
    } else {
      // "ordenar/ordenaste/orden" — the verb the activity actually used. The
      // failing shape was praise for a DIFFERENT task ("juntar monedas").
      const onTopic = /orden/i.test(reactionTurn.turn.say);
      if (onTopic) ok('it praised the task the learner actually did', reactionTurn.turn.say.slice(0, 90));
      else
        bad(
          'it narrated a different activity from the one on screen',
          reactionTurn.turn.say.slice(0, 140),
        );
    }
  } catch (error) {
    bad('the open-activity probe failed', error instanceof Error ? error.message : String(error));
  }

  console.log('');
  if (failures > 0) {
    console.log(`model:verify FAILED — ${failures} stage(s) broken.`);
    process.exit(1);
  }
  console.log('model:verify OK — sealed, answered, parsed, and passed the judge.');
}

await main();
