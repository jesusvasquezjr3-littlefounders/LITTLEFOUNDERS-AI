#!/usr/bin/env node
// generate:full — the ONE content factory entry point: Forge (coursegen) and Arcade
// (gamegen) for the SAME course, CONCURRENTLY, with linked run ids and a single
// combined summary (GAME_ENGINE.md §13, §9; ROADMAP.md Phase 5).
//
//   npm run generate:full -- --course <slug> --dry-run
//   npm run generate:full -- --course <slug> --confirm [--lanes 3] [--locales …]
//
// OPERATOR-TRIGGERED ONLY. This script spends real money on two paid pipelines at
// once, so agent/core/BOUNDARIES.md #8 ("calling paid AI APIs in bulk", "publishing")
// applies twice over. The guard is three layers and is documented at requirePaidRunApproval().
//
// Node built-ins only — no dependency, nothing to install, nothing to drift.

import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import readlinePromises from 'node:readline/promises';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Closed set shared by LESSON_LOCALES and GAME_LOCALES (GAME_ENGINE.md §2). */
const LOCALES = ['en-US', 'es-MX', 'pt-BR'];

/*
 * ---- Illustration lane budget -------------------------------------------------
 *
 * WHY THIS EXISTS: Prism (picturegen, 4007) is the ONLY image path and it fronts a
 * SINGLE DashScope quota. It has no serialization of its own — its retry ladder
 * slows a contended caller down but never removes the contention. Both pipelines
 * illustrate SEQUENTIALLY inside one slot (`for (const target of …)` in
 * coursegen/src/pipeline/images.ts and gamegen/src/pipeline/images.ts), so the
 * number of image calls a pipeline can have in flight equals its slot concurrency:
 * FORGE_CONCURRENCY and ARCADE_CONCURRENCY (both default 2, both capped at 8 by
 * their own Zod env schemas).
 *
 * Run solo, each pipeline puts 2 calls in flight. Run together at their defaults
 * that is 4 — strictly more DashScope contention than either was tuned against.
 * So generate:full always sets BOTH env vars from one TOTAL budget:
 *
 *   --lanes 3 (default)  ->  Forge 2 lanes, Arcade 1 lane
 *
 * Forge keeps its solo default of 2 because lessons are the dominant workload (a
 * course is thousands of lesson slots against tens of game slots), so a combined
 * run is never slower than a solo Forge run; Arcade drops to 1 so the COMBINED
 * in-flight ceiling (3) stays below the uncoordinated 4. Raise --lanes only after
 * watching Prism's 429/backoff rate on a real run.
 *
 * A parent-provided env var wins over a service's `.env` file (verified on Node
 * 24.11.0: `--env-file` does not override an already-set process.env entry), which
 * is exactly what makes this cap authoritative over each service's own .env.
 */
const DEFAULT_LANES = 3;
const FORGE_LANE_SHARE = 2 / 3;
const MAX_LANES_PER_CHILD = 8; // the max of both Zod env schemas

/*
 * Delay before Arcade starts. Best-effort DECORRELATION of the two initial
 * illustrate bursts — the lane cap above is the real control, this only keeps the
 * two pipelines from hitting their first images in the same second. It doubles as
 * the "did Forge die on its own usage error" window: if Forge exits non-zero inside
 * it, Arcade is never started and no money is spent on the second pipeline.
 */
const DEFAULT_STAGGER_SECONDS = 60;

const COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const C = {
  forge: COLOR ? '\u001b[0;34m' : '', // Blue — matches start-dev.sh's COURSEGEN
  arcade: COLOR ? '\u001b[0;33m' : '', // Yellow — matches start-dev.sh's GAMEGEN
  bold: COLOR ? '\u001b[1m' : '',
  reset: COLOR ? '\u001b[0m' : '',
};

// ---- CLI ---------------------------------------------------------------------

/**
 * A value-taking flag must never swallow the NEXT flag as its value — the same trap
 * both child CLIs guard (`--track-id --dry-run` would otherwise run a REAL paid job
 * whose id is the literal string "--dry-run", with the dry-run guard never firing).
 */
function requireValue(flag, value) {
  if (value === undefined || value.startsWith('--')) {
    fatalUsage(`${flag} needs a value (got ${value === undefined ? 'nothing' : `"${value}"`})`);
  }
  return value;
}

function requireInt(flag, raw, min, max) {
  const value = Number(requireValue(flag, raw));
  if (!Number.isInteger(value) || value < min || value > max) {
    fatalUsage(`${flag} must be an integer between ${min} and ${max}, got "${raw}"`);
  }
  return value;
}

function parseArgs(argv) {
  const opts = { lanes: DEFAULT_LANES, staggerSeconds: DEFAULT_STAGGER_SECONDS };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--course':
        opts.course = requireValue('--course', argv[++i]);
        break;
      case '--track-id':
        opts.baseId = requireValue('--track-id', argv[++i]);
        break;
      case '--locales': {
        const list = requireValue('--locales', argv[++i])
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean);
        if (list.length === 0) fatalUsage('--locales was given but is empty — omit the flag for all locales.');
        const bad = list.filter((l) => !LOCALES.includes(l));
        if (bad.length > 0) fatalUsage(`unknown locale(s) ${bad.join(', ')} — valid values are ${LOCALES.join('|')}.`);
        // es-MX is the AUTHORING locale on BOTH sides: en-US and pt-BR are derived
        // from it by the string-freeze, so a run without it has nothing to translate
        // FROM. Checked here so the operator learns it before Forge starts, not 60s
        // later when Arcade rejects the same flag.
        if (!list.includes('es-MX')) fatalUsage('--locales must include es-MX — it is the authoring locale both pipelines derive from.');
        opts.locales = list;
        break;
      }
      case '--lanes':
        opts.lanes = requireInt('--lanes', argv[++i], 2, MAX_LANES_PER_CHILD * 2);
        break;
      case '--stagger-seconds':
        opts.staggerSeconds = requireInt('--stagger-seconds', argv[++i], 0, 3600);
        opts.staggerExplicit = true;
        break;
      case '--shard-passes':
        opts.shardPasses = requireInt('--shard-passes', argv[++i], 1, 10);
        break;
      case '--register': {
        const value = requireValue('--register', argv[++i]);
        if (value !== 'kid' && value !== 'adult') fatalUsage(`--register must be kid|adult, got "${value}"`);
        opts.register = value;
        break;
      }
      case '--forge-budget-usd':
        opts.forgeBudgetUsd = requirePositive('--forge-budget-usd', argv[++i]);
        break;
      case '--arcade-budget-usd':
        opts.arcadeBudgetUsd = requirePositive('--arcade-budget-usd', argv[++i]);
        break;
      case '--no-images':
        opts.noImages = true;
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--confirm':
        opts.confirm = true;
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;
      default:
        fatalUsage(`unknown argument "${arg}"`);
    }
  }
  return opts;
}

function requirePositive(flag, raw) {
  const value = Number(requireValue(flag, raw));
  if (!Number.isFinite(value) || value <= 0) fatalUsage(`${flag} must be a positive number, got "${raw}"`);
  return value;
}

function printUsage() {
  console.error(
    'Usage: npm run generate:full -- --course <slug> (--dry-run | --confirm)\n' +
      '         [--track-id <base-id>] [--locales es-MX,en-US,pt-BR] [--no-images]\n' +
      `         [--lanes <n>] (total illustration lanes across BOTH pipelines, default ${DEFAULT_LANES})\n` +
      `         [--stagger-seconds <n>] (default ${DEFAULT_STAGGER_SECONDS})\n` +
      '         [--forge-budget-usd <n>] [--arcade-budget-usd <n>]\n' +
      '         [--shard-passes <n>] [--register kid|adult]   (Forge only)\n\n' +
      '  --dry-run  spends NOTHING and writes NOTHING; passed through to BOTH pipelines.\n' +
      '  --confirm  acknowledges a PAID run (BOUNDARIES.md #8). Required for a real run.\n' +
      '  Re-running with the same --track-id RESUMES both sides from their checkpoints.',
  );
}

function fatalUsage(message) {
  console.error(`generate:full: ${message}`);
  printUsage();
  process.exit(1);
}

// ---- The paid-run guard (BOUNDARIES.md #8) ------------------------------------

/**
 * Three layers, because this script starts TWO paid pipelines at once and a mistake
 * here is billed, not logged:
 *
 *  1. A run that is not `--dry-run` is REFUSED unless `--confirm` is passed. There is
 *     no default-to-paid path: omitting both flags prints the plan and exits 1.
 *  2. A paid run is refused outright when CI is set. BOUNDARIES.md #8 is explicit
 *     that bulk paid calls are operator-triggered, never automated.
 *  3. On a TTY, the operator must type the course slug back. Typing the slug (rather
 *     than "y") proves the printed plan — course, lanes, budgets — was actually read.
 *     Off a TTY, --confirm alone proceeds; layer 2 already blocks the automation case.
 */
async function requirePaidRunApproval(plan) {
  if (!plan.confirm) {
    console.error(
      'generate:full: this is a PAID run — two pipelines calling DeepSeek, Qwen and Prism in bulk.\n' +
        '  Nothing was started. Re-run with --dry-run to validate for free, or --confirm to spend.\n' +
        '  (agent/core/BOUNDARIES.md #8: bulk paid AI calls and publishing need a human yes.)',
    );
    process.exit(1);
  }
  if (process.env.CI) {
    console.error(
      'generate:full: refusing a paid run under CI. Bulk paid generation is operator-triggered only\n' +
        '  (agent/core/BOUNDARIES.md #8). Unset CI and run it from an operator shell.',
    );
    process.exit(1);
  }
  if (!process.stdin.isTTY) return; // non-interactive operator shell (nohup, pipe) — layer 2 covered CI
  const rl = readlinePromises.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`Type the course slug (${plan.course}) to start the PAID run: `);
    if (answer.trim() !== plan.course) {
      console.error('generate:full: not confirmed — nothing was started.');
      process.exit(1);
    }
  } finally {
    rl.close();
  }
}

// ---- Child processes ----------------------------------------------------------

/**
 * Spawns one pipeline and streams it back LINE BY LINE with a stable prefix, so an
 * operator reading two interleaved pipelines can always tell which one is talking.
 * Line-buffered on purpose: prefixing raw chunks would split a prefix mid-line.
 */
function startChild({ name, color, cwd, args, env }) {
  const child = spawn('npm', args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const tag = `${color}[${name}]${C.reset}`;

  for (const [stream, sink] of [
    [child.stdout, process.stdout],
    [child.stderr, process.stderr],
  ]) {
    readline.createInterface({ input: stream, crlfDelay: Infinity }).on('line', (line) => {
      sink.write(`${tag} ${line}\n`);
    });
  }

  const done = new Promise((resolve) => {
    // 'error' (e.g. npm not found) fires INSTEAD of 'close' — without this the
    // orchestrator would await a promise that never settles and hang forever while
    // the sibling pipeline kept spending.
    child.once('error', (err) => resolve({ name, code: null, signal: null, error: err.message }));
    child.once('close', (code, signal) => resolve({ name, code, signal, error: null }));
  });

  return { name, child, done };
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---- Artifact readers (tolerant by design) ------------------------------------
//
// The combined summary is built from the run ARTIFACTS both pipelines already write,
// never from parsing their console output. Both readers are tolerant: a missing or
// malformed artifact degrades that one line to "unavailable", it never masks a
// child's exit code and never crashes the summary that reports the other pipeline.

async function readForgeTotals(trackId) {
  const file = path.join(REPO_ROOT, 'coursegen', 'runs', trackId, 'track-report.json');
  try {
    const report = JSON.parse(await readFile(file, 'utf8'));
    const t = report.totals ?? {};
    return {
      slots: t.slots ?? 0,
      published: t.published ?? 0,
      failed: t.failed ?? 0,
      notAttempted: t.notAttempted ?? 0,
      dryRun: t.dryRun ?? 0,
      tokens: t.tokens ?? 0,
      usd: t.usd ?? 0,
      images: t.imagesBilled ?? 0,
      cachePct: t.cachePct ?? 0,
      halted: report.halted ?? null,
      source: path.relative(REPO_ROOT, file),
    };
  } catch (err) {
    return { unavailable: `${path.relative(REPO_ROOT, file)}: ${err.code ?? err.message}` };
  }
}

async function readArcadeTotals(runId) {
  const runDir = path.join(REPO_ROOT, 'gamegen', 'runs', runId);
  const totals = { source: path.relative(REPO_ROOT, runDir) };

  try {
    const checkpoint = JSON.parse(await readFile(path.join(runDir, 'checkpoint.json'), 'utf8'));
    const states = Object.values(checkpoint.slots ?? {}).map((slot) => slot?.state);
    totals.slots = states.length;
    totals.published = states.filter((s) => s === 'published').length;
    totals.failed = states.filter((s) => s === 'failed').length;
    totals.dryRun = states.filter((s) => s === 'dry-run').length;
    // Anything neither published, failed nor dry-run is mid-stage: enumerated work
    // the run never finished. Reported so the buckets add up to the slot count.
    totals.notAttempted = totals.slots - totals.published - totals.failed - totals.dryRun;
  } catch (err) {
    totals.slotsUnavailable = `checkpoint.json: ${err.code ?? err.message}`;
  }

  try {
    const raw = await readFile(path.join(runDir, 'ledger.jsonl'), 'utf8');
    let tokens = 0;
    let usd = 0;
    let images = 0;
    let cached = 0;
    for (const line of raw.split('\n')) {
      if (line.trim().length === 0) continue;
      try {
        const rec = JSON.parse(line);
        // cached_prompt_tokens is a SUBSET of prompt_tokens — it changes the PRICE,
        // never the token total. est_usd is replayed verbatim so a ledger written
        // across a price change still sums correctly.
        tokens += (rec.prompt_tokens ?? 0) + (rec.completion_tokens ?? 0);
        usd += rec.est_usd ?? 0;
        images += rec.images ?? 0;
        cached += rec.cached_prompt_tokens ?? 0;
      } catch {
        // A line truncated by a kill mid-append loses one record's accounting —
        // far better than refusing to report the run at all.
      }
    }
    totals.tokens = tokens;
    totals.usd = usd;
    totals.images = images;
    totals.cachePct = tokens > 0 ? Number(((cached / tokens) * 100).toFixed(1)) : 0;
  } catch (err) {
    // ENOENT is the NORMAL dry-run case: nothing was paid, so no ledger exists.
    totals.tokens = 0;
    totals.usd = 0;
    totals.images = 0;
    totals.cachePct = 0;
    if (err.code !== 'ENOENT') totals.spendUnavailable = `ledger.jsonl: ${err.message}`;
  }

  return totals;
}

// ---- Summary ------------------------------------------------------------------

const num = (n) => Number(n ?? 0).toLocaleString();

function exitLabel(outcome) {
  if (!outcome) return 'NOT STARTED';
  if (outcome.error) return `SPAWN FAILED (${outcome.error})`;
  if (outcome.signal) return `killed by ${outcome.signal}`;
  return `exit ${outcome.code}`;
}

function printSide(label, color, id, outcome, totals) {
  console.log(`${color}${label}${C.reset} ${id} — ${exitLabel(outcome)}`);
  if (!totals) {
    console.log('    (not started — no artifacts to report)');
    return;
  }
  if (totals.unavailable) {
    console.log(`    summary unavailable — ${totals.unavailable}`);
    return;
  }
  if (totals.slotsUnavailable) {
    console.log(`    slot counts unavailable — ${totals.slotsUnavailable}`);
  } else {
    console.log(
      `    slots ${num(totals.slots)}: ${num(totals.published)} published` +
        `${totals.dryRun > 0 ? `, ${num(totals.dryRun)} dry-run` : ''}` +
        `${totals.failed > 0 ? `, ${num(totals.failed)} FAILED` : ''}` +
        `${totals.notAttempted > 0 ? `, ${num(totals.notAttempted)} not attempted` : ''}`,
    );
  }
  if (totals.spendUnavailable) {
    console.log(`    spend unavailable — ${totals.spendUnavailable}`);
  } else {
    console.log(
      `    ${num(totals.tokens)} tokens, $${Number(totals.usd ?? 0).toFixed(4)}, ` +
        `${num(totals.images)} image(s) billed, cache ${totals.cachePct ?? 0}%`,
    );
  }
  if (totals.halted) console.warn(`    HALTED: ${totals.halted}`);
  console.log(`    artifacts: ${totals.source}`);
}

// ---- main ---------------------------------------------------------------------

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.course) fatalUsage('--course is required');
  if (opts.dryRun && opts.confirm) fatalUsage('--dry-run and --confirm are mutually exclusive — a dry run spends nothing to confirm.');

  // Both children resume from their checkpoints under the SAME ids, so re-running
  // generate:full with the same --track-id continues both sides rather than paying
  // for finished work twice.
  const baseId = opts.baseId ?? `${opts.course}-full-${new Date().toISOString().slice(0, 10)}`;
  const trackId = baseId;
  const gamesRunId = `games-${baseId}`; // the `games-` namespace can never collide with a Forge run id

  const forgeLanes = Math.min(MAX_LANES_PER_CHILD, Math.max(1, Math.round(opts.lanes * FORGE_LANE_SHARE)));
  const arcadeLanes = Math.min(MAX_LANES_PER_CHILD, Math.max(1, opts.lanes - forgeLanes));
  // A dry run pays for no image, so it needs no stagger and defaults to none — unless
  // the operator asked for one explicitly, which is how the staggered start and its
  // "Forge died early, don't start Arcade" abort are rehearsed for free.
  const staggerSeconds = opts.dryRun && !opts.staggerExplicit ? 0 : opts.staggerSeconds;
  const staggerMs = staggerSeconds * 1000;

  console.log(`${C.bold}==> generate:full — course "${opts.course}"${C.reset}`);
  console.log(`    mode:      ${opts.dryRun ? 'DRY RUN (spends nothing, writes nothing)' : 'PAID RUN'}`);
  console.log(`    forge:     coursegen generate:track  --track-id ${trackId}  (FORGE_CONCURRENCY=${forgeLanes})`);
  console.log(`    arcade:    gamegen   generate        --run-id  ${gamesRunId}  (ARCADE_CONCURRENCY=${arcadeLanes})`);
  console.log(
    `    illustration: ${opts.lanes} total lane(s) across both pipelines — Prism fronts ONE shared DashScope quota` +
      `${staggerMs > 0 ? `, Arcade starts ${staggerSeconds}s later` : ''}`,
  );
  if (opts.locales) console.log(`    locales:   ${opts.locales.join(',')}`);
  if (opts.noImages) console.log('    images:    DISABLED (--no-images on both sides)');
  if (opts.forgeBudgetUsd) console.log(`    forge cap: $${opts.forgeBudgetUsd.toFixed(2)}`);
  if (opts.arcadeBudgetUsd) console.log(`    arcade cap: $${opts.arcadeBudgetUsd.toFixed(2)}`);

  if (!opts.dryRun) await requirePaidRunApproval({ course: opts.course, confirm: opts.confirm });

  const shared = [
    '--course', opts.course,
    ...(opts.locales ? ['--locales', opts.locales.join(',')] : []),
    ...(opts.noImages ? ['--no-images'] : []),
    ...(opts.dryRun ? ['--dry-run'] : []),
  ];

  const live = new Set();
  let interrupted = false;

  /** Ctrl+C must reach the CHILDREN, or npm exits and leaves two orphaned pipelines spending money. */
  const onSignal = (signal) => {
    if (interrupted) return;
    interrupted = true;
    console.error(`\ngenerate:full: ${signal} — stopping both pipelines. Work already checkpointed is resumable with the same --track-id.`);
    for (const child of live) child.kill('SIGINT');
  };
  process.once('SIGINT', () => onSignal('SIGINT'));
  process.once('SIGTERM', () => onSignal('SIGTERM'));

  const forge = startChild({
    name: 'forge',
    color: C.forge,
    cwd: path.join(REPO_ROOT, 'coursegen'),
    env: { FORGE_CONCURRENCY: String(forgeLanes) },
    args: [
      'run', 'generate:track', '--',
      ...shared,
      '--track-id', trackId,
      ...(opts.shardPasses ? ['--shard-passes', String(opts.shardPasses)] : []),
      ...(opts.register ? ['--register', opts.register] : []),
      ...(opts.forgeBudgetUsd ? ['--budget-usd', String(opts.forgeBudgetUsd)] : []),
    ],
  });
  live.add(forge.child);
  forge.done.then((outcome) => {
    live.delete(forge.child);
    return outcome;
  });

  let arcade = null;
  let arcadeSkipped = null;

  if (staggerMs > 0) {
    // If Forge dies inside the stagger window (a usage error, a bad catalog, missing
    // credentials), Arcade is never started: whatever killed Forge would almost
    // certainly kill Arcade too, and not starting it is the difference between one
    // wasted invocation and two.
    const early = await Promise.race([forge.done, delay(staggerMs).then(() => null)]);
    if (interrupted) {
      // The operator's Ctrl+C is the reason, not anything Forge did — say so, or the
      // summary blames a pipeline that was working fine.
      arcadeSkipped = 'interrupted during the stagger, before Arcade started.';
    } else if (early && early.code !== 0) {
      arcadeSkipped = `Forge exited (${exitLabel(early)}) during the ${staggerSeconds}s stagger — Arcade was never started.`;
      console.error(`generate:full: ${arcadeSkipped}`);
    }
  }

  if (!arcadeSkipped && !interrupted) {
    arcade = startChild({
      name: 'arcade',
      color: C.arcade,
      cwd: path.join(REPO_ROOT, 'gamegen'),
      env: { ARCADE_CONCURRENCY: String(arcadeLanes) },
      args: [
        'run', 'generate', '--',
        ...shared,
        '--run-id', gamesRunId,
        ...(opts.arcadeBudgetUsd ? ['--budget-usd', String(opts.arcadeBudgetUsd)] : []),
      ],
    });
    live.add(arcade.child);
    arcade.done.then((outcome) => {
      live.delete(arcade.child);
      return outcome;
    });
  } else if (interrupted) {
    arcadeSkipped = 'interrupted before Arcade started.';
  }

  // ALWAYS await both. A crash on one side never aborts the other — both sides are
  // checkpointed and resumable, and killing a live pipeline would throw away paid,
  // judge-approved work — but the orchestrator must not exit while a child is still
  // running, or npm returns to the shell with two pipelines orphaned behind it.
  const [forgeOutcome, arcadeOutcome] = await Promise.all([forge.done, arcade ? arcade.done : Promise.resolve(null)]);

  const [forgeTotals, arcadeTotals] = await Promise.all([
    readForgeTotals(trackId),
    arcade ? readArcadeTotals(gamesRunId) : Promise.resolve(null),
  ]);

  console.log(`\n${C.bold}================ generate:full summary ================${C.reset}`);
  console.log(`  course: ${opts.course}    linked id: ${baseId}${opts.dryRun ? '    (DRY RUN — nothing paid, nothing written)' : ''}`);
  printSide('  forge ', C.forge, `track ${trackId}`, forgeOutcome, forgeTotals);
  printSide('  arcade', C.arcade, `run ${gamesRunId}`, arcadeOutcome, arcadeTotals);
  if (arcadeSkipped) console.error(`  arcade NOT RUN: ${arcadeSkipped}`);

  const sum = (key) => (forgeTotals?.[key] ?? 0) + (arcadeTotals?.[key] ?? 0);
  console.log(
    `  combined: ${num(sum('slots'))} slot(s), ${num(sum('published'))} published, ` +
      `${num(sum('failed'))} failed, ${num(sum('tokens'))} tokens, $${sum('usd').toFixed(4)}, ` +
      `${num(sum('images'))} image(s) billed`,
  );
  if (!opts.dryRun && sum('published') > 0) {
    console.log("  everything published landed with status='review' — a human still has to approve it.");
  }
  console.log('=======================================================');

  if (interrupted) {
    process.exitCode = 130;
    return;
  }
  // Propagate a non-zero exit from EITHER side — a green generate:full must mean both
  // pipelines finished clean.
  const failures = [forgeOutcome, arcadeOutcome].filter((o) => o && (o.error || o.signal || o.code !== 0));
  if (failures.length > 0 || arcadeSkipped) {
    console.error(`generate:full: FAILED — ${failures.map((o) => `${o.name} ${exitLabel(o)}`).join(', ') || arcadeSkipped}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
  process.exit(1);
});
