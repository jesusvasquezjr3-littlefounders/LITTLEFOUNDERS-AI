#!/usr/bin/env node
// Arcade CLI — the ONLY entry point in this package that spends money
// (GAME_ENGINE.md §9, gamegen/AGENTS.md).
//
//   npm run generate -- --course financial-education
//     [--slots <adventure>/<saga>/<topic>[/<game>],...]
//     [--mechanic sorter,runner] [--locales es-MX,en-US,pt-BR]
//     [--no-images] [--dry-run] [--budget-usd 5] [--run-id <id>]
//
// OPERATOR-TRIGGERED ONLY — never run by CI or any automatic process
// (/AGENTS.md sign-off rule, agent/core/BOUNDARIES.md #8: calling paid AI APIs in
// bulk and publishing are both boundary actions).
//
// `npm run generate` carries `tsx --env-file-if-exists=.env`: Forge's `generate` and
// Echo's `narrate:all` both crashed on their very first real invocation because the
// operator script never loaded `.env`. Any new script reaching getConfig() needs it.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runGeneration } from './pipeline/run.js';
import { ConfigError, getConfig } from './env.js';
import { GAME_LOCALES, MECHANIC_IDS, type GameLocale } from './contract/core/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '..');

interface CliOptions {
  course?: string;
  slots?: string[];
  mechanics?: string[];
  locales?: GameLocale[];
  noImages?: boolean;
  dryRun?: boolean;
  budgetUsd?: number;
  runId?: string;
}

/**
 * A value-taking flag must never swallow the NEXT flag as its value (§1.14) —
 * `--run-id --dry-run` would otherwise silently create a run literally named
 * "--dry-run", and the real dry-run guard would never fire.
 */
function requireValue(flag: string, value: string | undefined): string {
  if (value === undefined || value.startsWith('--')) {
    console.error(`generate: ${flag} needs a value (got ${value === undefined ? 'nothing' : `"${value}"`})`);
    process.exit(1);
  }
  return value;
}

/**
 * §1.14: validate at the edge, never coerce silently. An empty list flag used to
 * become a DIFFERENT run — an empty `--slots` meant "the whole course" (a full
 * generation bill from a typo) and an empty `--locales` meant "no locales at all"
 * (slots marked done having published nothing).
 */
function requireList(flag: string, raw: string | undefined, hint: string): string[] {
  const list = (raw ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  if (list.length === 0) {
    console.error(`generate: ${flag} was given but is empty — ${hint}`);
    process.exit(1);
  }
  return list;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--course':
        opts.course = requireValue('--course', argv[++i]);
        break;
      case '--slots':
        opts.slots = requireList(
          '--slots',
          argv[++i],
          'omit the flag to generate the whole course, or pass at least one slot id ' +
            '("<adventure>/<saga>/<topic>" selects every game in a topic).',
        );
        break;
      case '--mechanic': {
        const list = requireList(
          '--mechanic',
          argv[++i],
          `omit the flag for every mechanic, or pass a subset of ${MECHANIC_IDS.join('|')}.`,
        );
        const bad = list.filter((m) => !(MECHANIC_IDS as readonly string[]).includes(m));
        if (bad.length > 0) {
          console.error(`generate: unknown mechanic(s) ${bad.join(', ')} — the closed set is ${MECHANIC_IDS.join('|')}.`);
          process.exit(1);
        }
        opts.mechanics = list;
        break;
      }
      case '--locales': {
        const list = requireList(
          '--locales',
          argv[++i],
          `omit the flag for all locales, or pass a subset of ${GAME_LOCALES.join('|')}.`,
        );
        const bad = list.filter((l) => !(GAME_LOCALES as readonly string[]).includes(l));
        if (bad.length > 0) {
          console.error(`generate: unknown locale(s) ${bad.join(', ')} — valid values are ${GAME_LOCALES.join('|')}.`);
          process.exit(1);
        }
        if (!list.includes('es-MX')) {
          // es-MX is the AUTHORING locale: en-US and pt-BR are derived from it by the
          // string-freeze, so a run without it has nothing to translate FROM.
          console.error('generate: --locales must include es-MX — it is the authoring locale every other locale is derived from.');
          process.exit(1);
        }
        opts.locales = list as GameLocale[];
        break;
      }
      case '--budget-usd': {
        const raw = requireValue('--budget-usd', argv[++i]);
        const value = Number(raw);
        if (!Number.isFinite(value) || value <= 0) {
          console.error(`generate: --budget-usd must be a positive number, got "${raw}".`);
          process.exit(1);
        }
        opts.budgetUsd = value;
        break;
      }
      case '--no-images':
        opts.noImages = true;
        break;
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--run-id':
        opts.runId = requireValue('--run-id', argv[++i]);
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
      // `process.exit` above is terminal, so this case never falls through.
      default:
        console.error(`generate: unknown argument "${arg}"`);
        process.exit(1);
    }
  }
  return opts;
}

function printUsage(): void {
  console.error(
    'Usage: npm run generate -- --course <slug> [--slots <adventure>/<saga>/<topic>,...] ' +
      `[--mechanic ${MECHANIC_IDS.slice(0, 2).join(',')}] [--locales ${GAME_LOCALES.join(',')}] ` +
      '[--no-images] [--dry-run] [--budget-usd <n>] [--run-id <id>]',
  );
}

/**
 * Resolve the configuration UP FRONT, before a single stage runs.
 *
 * The config is read lazily all over the pipeline, so a bad variable used to
 * surface as a raw ZodError from whichever provider happened to touch
 * `getConfig()` first — a stack trace pointing at src/env.ts, thrown mid-run,
 * and (worse) thrown even for `--dry-run`, the one mode whose entire promise is
 * that it validates without spending or configuring anything. Doing it here
 * turns that into a single readable refusal naming the offending variables,
 * before any slot is enumerated. Note this does NOT demand credentials: an
 * unset — or blank — key parses fine; only a genuinely invalid VALUE fails.
 */
function loadConfigOrExit(): void {
  try {
    getConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(err.message);
      process.exit(1);
    }
    throw err;
  }
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.course) {
    printUsage();
    process.exit(1);
  }
  loadConfigOrExit();

  const summary = await runGeneration({
    course: opts.course,
    ...(opts.slots === undefined ? {} : { slots: opts.slots }),
    ...(opts.mechanics === undefined ? {} : { mechanics: opts.mechanics }),
    ...(opts.locales === undefined ? {} : { locales: opts.locales }),
    ...(opts.noImages === undefined ? {} : { noImages: opts.noImages }),
    ...(opts.dryRun === undefined ? {} : { dryRun: opts.dryRun }),
    ...(opts.runId === undefined ? {} : { runId: opts.runId }),
    ...(opts.budgetUsd === undefined ? {} : { maxUsdOverride: opts.budgetUsd }),
    curriculumRoot: path.join(PACKAGE_ROOT, 'curriculum'),
    runsRoot: path.join(PACKAGE_ROOT, 'runs'),
  });

  // Print EVERY bucket, so the numbers add up to the enumerated slot count. A report
  // that shows only published/failed hides whole categories: 700 unattempted slots of
  // 1000 used to look like a clean partial success.
  console.log(`\nrun ${summary.runId}`);
  console.log(`  slots enumerated: ${summary.slotsEnumerated}`);
  console.log(`  published (status='review' — a human still has to approve them): ${summary.published.length}`);
  for (const slotId of summary.published) console.log(`    - ${slotId}`);
  console.log(`  failed: ${summary.failed.length}`);
  for (const failure of summary.failed) {
    console.log(`    - ${failure.slotId} [from ${failure.failedFrom ?? 'pending'}]: ${failure.error}`);
  }
  if (summary.escalated.length > 0) {
    // A kid_safety verdict is routed to a human, never patched by the model that
    // wrote it and never re-rolled by the retry loop (§1.9).
    console.error(`  KID-SAFETY ESCALATIONS (human review required, NOT retried): ${summary.escalated.length}`);
    for (const slotId of summary.escalated) console.error(`    - ${slotId}`);
  }
  if (summary.alreadyDone.length > 0) console.log(`  already done before this run: ${summary.alreadyDone.length}`);
  if (summary.dryRun.length > 0) {
    console.log(`  dry-run validated (nothing written, nothing paid): ${summary.dryRun.length}`);
  }
  if (summary.skipped.length > 0) {
    console.log(`  skipped: ${summary.skipped.length}`);
    for (const s of summary.skipped) console.log(`    - ${s.slotId}: ${s.reason}`);
  }
  if (summary.notAttempted.length > 0) {
    console.warn(
      `  NOT ATTEMPTED: ${summary.notAttempted.length} slot(s) were enumerated but never reached — ` +
        `resume with the same --run-id to continue.`,
    );
  }
  if (summary.stoppedOnBudget) {
    console.warn(
      `  STOPPED: run budget exceeded (cap was ${summary.budget.maxTokens.toLocaleString()} tokens / ` +
        `$${summary.budget.maxUsd.toFixed(2)}). Published slots stay published; the rest are resumable.`,
    );
  }
  if (summary.fatalProviderError) {
    // The ONE cause, stated once, instead of leaving the operator to infer it from
    // dozens of derived slot failures.
    console.error(`\n  ABORTED — provider credential/balance failure:\n    ${summary.fatalProviderError}`);
    console.error('  Nothing further could have succeeded. Fix the account, then resume with the SAME --run-id;');
    console.error('  everything already published stays published and only the remaining slots are regenerated.');
  }

  console.log(
    `  images: ${summary.imagesGenerated} placed, ${summary.imagesBilled} freshly generated (billed), ` +
      `${summary.imagesInherited} inherited from art this run already drew (free)`,
  );
  if (summary.imageSkipReasons.length > 0) {
    console.warn(
      `  IMAGES SKIPPED (${summary.imageSkipReasons.join(', ')}) — games publish with icon fallbacks instead of sprites.`,
    );
  } else if (summary.imagesGenerated === 0 && summary.published.length > 0) {
    console.warn('  WARNING: published games but placed ZERO sprites — check PICTUREGEN_URL, or pass --no-images if that was intended.');
  }
  if (summary.salvagedSlots.length > 0) {
    console.warn(`  SALVAGED (published SMALLER than the skeleton asked for): ${summary.salvagedSlots.length}`);
    for (const s of summary.salvagedSlots) console.warn(`    - ${s.slotId}: ${s.droppedItems} item(s) dropped`);
  }

  const cachePct = summary.tokensUsed > 0 ? ((summary.cachedTokens / summary.tokensUsed) * 100).toFixed(1) : '0.0';
  console.log(
    `  tokens used: ${summary.tokensUsed.toLocaleString()}, est. USD: $${summary.usdUsed.toFixed(4)} ` +
      `(context-cache hits: ${summary.cachedTokens.toLocaleString()} tokens, ${cachePct}% — billed at the cached rate)`,
  );
  // The prefix-cache share is a COST regression signal, not a curiosity: a prompt edit
  // that tanks it costs real money even when quality holds (gamegen/AGENTS.md).
  if (summary.published.length > 0) {
    console.log(`  cost per published game: $${(summary.usdUsed / summary.published.length).toFixed(4)}`);
  }

  // A run that did NOTHING is not a success. A --slots/--mechanic filter that matched
  // no slot used to exit 0 with "published: 0".
  if (summary.slotsEnumerated === 0) {
    console.error(
      'generate: no slots matched — check --slots/--mechanic (a filter that matches nothing is not a successful run).',
    );
    process.exitCode = 1;
  }
  if (
    summary.failed.length > 0 ||
    summary.stoppedOnBudget ||
    summary.notAttempted.length > 0 ||
    summary.fatalProviderError
  ) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  // A configuration problem is an OPERATOR problem: print the instructions, not
  // a stack trace through zod that names no variable and suggests no fix. The
  // gates in env.ts (`require*Keys`) throw ConfigError too, so a run that dies
  // for a missing key at stage 3 reads the same way as one that never started.
  if (err instanceof ConfigError) {
    console.error(err.message);
    process.exit(1);
  }
  console.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
  process.exit(1);
});
