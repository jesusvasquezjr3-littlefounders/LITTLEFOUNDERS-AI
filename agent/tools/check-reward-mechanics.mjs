#!/usr/bin/env node
// check-reward-mechanics.mjs — B.22 (S05.3e): no variable-ratio or randomized
// reward mechanics. Policy: docs/rebuild/REWARD-AND-MOTIVATION-POLICY.md §3.
//
// Product 10 B.22 mandates an explicit prohibition on randomized ("mystery",
// loot-box style) reward mechanics for any minor: every reward must be
// predictable and tied to a specific, understood action. Appendix C Part 3
// Stage 2 gate 7 asks for a structural check that flags any such pattern for
// review. This is that check for the product's code, database and copy; the
// content-pipeline twin (lesson documents) lives in coursegen
// (src/pipeline/rewardMechanicGate.ts).
//
// Three rules, all fail-closed:
//   1. RANDOMNESS IS DECLARED. Any random-number API in product source
//      (Math.random, crypto.randomInt, getRandomValues, lodash sample or
//      shuffle, SQL random()/setseed/TABLESAMPLE) must appear in the closed
//      allowlist below, with the non-reward purpose it serves. Identifiers
//      (randomUUID, randomBytes tokens, gen_random_uuid) are not draws and
//      are not flagged.
//   2. REWARD CODE NEVER DRAWS. The files that compute or present XP, coins,
//      badges, streaks or celebrations can never be allowlisted: the rule
//      holds even if someone adds them to the list.
//   3. NO MYSTERY-REWARD LANGUAGE. No copy, key or identifier promises a
//      mystery box, loot, gacha, spin, lucky draw, scratch card or random or
//      surprise prize, in English, Spanish or Portuguese.
//
//   node agent/tools/check-reward-mechanics.mjs        (repository root)

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(fileURLToPath(new URL('../..', import.meta.url)));

export const SCAN_ROOTS = ['backend/src', 'frontend/src', 'oracle/src', 'coursegen/src', 'database/migrations'];

/** Closed allowlist: path -> the one non-reward purpose of its randomness. */
export const RANDOMNESS_ALLOWLIST = {
  'frontend/src/components/characters/DinaCharacter.tsx': 'blink timing of a legacy 2D character (idle animation)',
  'frontend/src/components/characters/DrRhoCharacter.tsx': 'blink timing of a legacy 2D character (idle animation)',
  'frontend/src/components/characters/LirufCharacter.tsx': 'blink timing of a legacy 2D character (idle animation)',
  'frontend/src/components/characters/ZaraVexCharacter.tsx': 'blink timing of a legacy 2D character (idle animation)',
  'frontend/src/lib/avatarOptions.ts': 'the avatar "randomize" button draws a cosmetic look; nothing is earned, withheld or unlocked by chance',
  'backend/src/routes/tutor.ts': 'staff live-review sampling of Mentor sessions (quality assurance, no learner-facing outcome)',
  'backend/src/services/supabaseRest.ts': 'the simulated card\'s display number (an identifier, not a value)',
  'coursegen/src/providers/retry.ts': 'provider retry jitter',
};

/**
 * Teaching about the mechanic is not the mechanic. A teen lesson may analyse
 * loot-box odds as risk and expected value (financial literacy); such files
 * are declared here and never hold reward code. Lesson documents themselves
 * are reviewed by the Forge gate, which flags this language for the Stage 3
 * pedagogical reviewer rather than letting it pass silently.
 */
export const TEACHING_CONTEXT = {
  'coursegen/src/pipeline/contentPlaybook.ts': 'the teen authoring brief names loot-box drop odds as a risk and expected-value example',
  'coursegen/src/pipeline/rewardMechanicGate.ts': 'the Forge twin of this gate: it holds the same detectors',
};

/** Reward code: may never draw a random number, allowlisted or not. */
export const REWARD_PATHS = [
  /^backend\/src\/routes\/(learn|learnMotivation|tasks|banking|placement|onboarding)\.ts$/,
  /^backend\/src\/services\/(habitStreak|streak|celebrationBudget|badges|lessonCompletionReceipt|autonomy|unlockRules)\.ts$/,
  /^frontend\/src\/lesson-engine\/(core|player)\//,
  /^frontend\/src\/rebuild\/design\/milestones\.ts$/,
  /^frontend\/src\/rebuild\/learning\/(LessonResultView|LearningRhythmView|motivation)\.tsx?$/,
  /^frontend\/src\/tutor\/(useTutorLearningStats|hud\/GamificationCelebration)\.tsx?$/,
];

const RANDOM_JS = [
  /\bMath\.random\s*\(/,
  /\brandomInt\s*\(/,
  /\bgetRandomValues\s*\(/,
  /\b_\.(?:sample|sampleSize|shuffle)\s*\(/,
];
const RANDOM_SQL = [/(?<![\w.])random\s*\(\s*\)/i, /\bsetseed\s*\(/i, /\bTABLESAMPLE\b/i];

export const MYSTERY_LEXICON = [
  /\bmystery\s+(?:box(?:es)?|rewards?|prizes?|chests?|gifts?|crates?|packs?|eggs?)\b/i,
  /\bloot(?:\s*box(?:es)?|\s*drops?)?\b/i,
  /\bgacha\b/i,
  /\blucky\s+(?:draws?|spins?|box(?:es)?|dips?)\b/i,
  /\bspin\s+(?:the|to)\s+(?:wheel|win)\b/i,
  /\bprize\s+wheels?\b/i,
  /\bscratch\s+cards?\b/i,
  /\b(?:random|randomi[sz]ed|surprise)\s+(?:rewards?|prizes?|bonus(?:es)?|box(?:es)?|chests?|drops?|tiers?)\b/i,
  /\bcaja(?:s)?\s+(?:misteriosas?|sorpresa)\b/i,
  /\bpremios?\s+(?:sorpresa|misteriosos?|aleatorios?)\b/i,
  /\brecompensas?\s+(?:aleatori[ao]s?|aleatória|sorpresa|surpresa|misteriosas?)\b/i,
  /\bcofres?\s+(?:misteriosos?|sorpresa)\b/i,
  /\bruleta\s+de\s+premios\b/i,
  /\brasca\s+y\s+gana\b/i,
  /\bcaixas?\s+(?:misteriosas?|surpresa)\b/i,
  /\bprêmios?\s+(?:surpresa|misteriosos?|aleatórios?)\b/i,
  /\bbaús?\s+(?:misteriosos?|surpresa)\b/i,
  /\broleta\s+de\s+prêmios\b/i,
  /\braspadinhas?\b/i,
];

function walk(dir, out = []) {
  let names;
  try { names = readdirSync(dir); } catch { return out; }
  for (const name of names) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (!['node_modules', '__tests__', 'dist', 'fixtures'].includes(name)) walk(full, out);
    } else if (/\.(ts|tsx|mjs|js|json|sql)$/.test(name) && !/\.(test|spec)\.(ts|tsx|mjs|js)$/.test(name) && !/\.generated\.ts$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

/** Comments are not code: a sentence ABOUT Math.random is not a draw. */
export function stripComments(text, sql = false) {
  if (sql) return text.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

/**
 * Checks one file's text. `path` is repository-relative with forward slashes.
 * Returns findings (strings); empty means the file passes.
 */
export function checkFile(path, text, allowlist = RANDOMNESS_ALLOWLIST, teaching = TEACHING_CONTEXT) {
  const findings = [];
  const sql = path.endsWith('.sql');
  const json = path.endsWith('.json');
  const code = json ? '' : stripComments(text, sql);
  const draws = (sql ? RANDOM_SQL : RANDOM_JS).filter((pattern) => pattern.test(code));
  if (draws.length > 0) {
    if (REWARD_PATHS.some((pattern) => pattern.test(path))) {
      findings.push(`${path}: reward code draws a random number (${draws.map(String).join(', ')}); B.22 forbids it`);
    } else if (!Object.hasOwn(allowlist, path)) {
      findings.push(`${path}: undeclared randomness (${draws.map(String).join(', ')}); declare its non-reward purpose or remove it (B.22)`);
    }
  }
  if (Object.hasOwn(teaching, path) && !REWARD_PATHS.some((pattern) => pattern.test(path))) return findings;
  // Comments describing the prohibition are not copy; JSON (i18n) is all copy.
  const copy = json ? text : code;
  for (const pattern of MYSTERY_LEXICON) {
    const match = copy.match(pattern);
    if (match) findings.push(`${path}: mystery-reward language "${match[0]}" (B.22)`);
  }
  return findings;
}

export function checkRepository(root = repo, roots = SCAN_ROOTS, allowlist = RANDOMNESS_ALLOWLIST, teaching = TEACHING_CONTEXT) {
  const findings = [];
  for (const [path] of Object.entries(allowlist)) {
    if (REWARD_PATHS.some((pattern) => pattern.test(path))) findings.push(`${path}: reward code cannot be allowlisted (B.22)`);
  }
  let files = 0;
  for (const scanRoot of roots) {
    for (const file of walk(join(root, scanRoot))) {
      files += 1;
      const path = relative(root, file).split(sep).join('/');
      findings.push(...checkFile(path, readFileSync(file, 'utf8'), allowlist, teaching));
    }
  }
  return { files, findings };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { files, findings } = checkRepository();
  if (findings.length > 0) {
    console.error(`Reward-mechanic check FAILED (${findings.length}):\n${findings.map((f) => `  ${f}`).join('\n')}`);
    process.exitCode = 1;
  } else {
    console.log(`Reward mechanics OK — ${files} files: no randomness on a reward path, ${Object.keys(RANDOMNESS_ALLOWLIST).length} declared non-reward draws, no mystery-reward language (B.22).`);
  }
}
