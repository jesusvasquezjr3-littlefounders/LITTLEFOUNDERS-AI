#!/usr/bin/env node
/**
 * ONE SCENE'S DIALOGUE, TWO HAND-WRITTEN COPIES, NO COMPILER BETWEEN THEM —
 * the same shape of gap `check-instrument-parity.mjs` and
 * `check-preferred-types-parity.mjs` already exist to close, applied here to
 * `roleplay`'s spoken lines.
 *
 * WHY THIS EXISTS. `oracle/src/tutor/roleplayScenes.ts` is what
 * `speech:pregenerate` actually SYNTHESIZES and bills for, once, into
 * `speech.pregenerated.json`. `frontend/src/tutor/roleplay/scenes.ts` (plus
 * the three `tutor.json` i18n files its `textKey`s point into) is what a
 * learner actually READS in `RoleplayCaption.tsx` while that same audio
 * plays. Oracle and the frontend deliberately share no types (/AGENTS.md
 * §1.5), so these are typed out twice by hand — and if they ever disagree,
 * nothing crashes: a learner would simply hear one sentence while reading a
 * different one, the quietest kind of bug this codebase has a name for.
 *
 * WHAT IT CHECKS, per beat of `lemonade_change`: the `speaker` role agrees,
 * and the oracle-side text agrees with the frontend i18n string its
 * `textKey` resolves to, in all three locales.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const LOCALES = ['en-US', 'es-MX', 'pt-BR'];

const ORACLE_FILE = 'oracle/src/tutor/roleplayScenes.ts';
const FRONTEND_SCENES_FILE = 'frontend/src/tutor/roleplay/scenes.ts';
const FRONTEND_I18N_FILES = LOCALES.map((locale) => `frontend/src/i18n/${locale}/tutor.json`);

/**
 * Oracle's `LEMONADE_CHANGE` beats: `{ speaker: 'x', text: { 'en-US': '...',
 * 'es-MX': '...', 'pt-BR': '...' } }`, in order. One scene, hardcoded to its
 * own const name on purpose — there is exactly one today, and a second scene
 * is a small, obvious addition to this function rather than speculative
 * generality this repo does not have a second case to verify against yet.
 */
/**
 * One JS string literal, either quote style — Prettier picks double quotes
 * ONLY when the text itself contains an apostrophe, so a fixed quote
 * character per locale is wrong the moment a translator's wording changes.
 */
const STRING_LITERAL = `(?:"((?:[^"\\\\]|\\\\.)*)"|'((?:[^'\\\\]|\\\\.)*)')`;

function unescape_(s) {
  return s.replace(/\\(['"\\])/g, '$1');
}

/** Pulls whichever of the two capture groups a STRING_LITERAL match filled. */
function literalValue(match, groupOffset) {
  const raw = match[groupOffset] ?? match[groupOffset + 1];
  return raw === undefined ? null : unescape_(raw);
}

export function oracleLemonadeBeats(source) {
  const block = /LEMONADE_CHANGE:\s*RoleplayVoiceScene\s*=\s*\{[\s\S]*?\n\};/.exec(source);
  if (!block) return null;
  const beats = [];
  const beatRe = new RegExp(
    `speaker:\\s*'(lead|companion)'[\\s\\S]*?` +
      `'en-US':\\s*${STRING_LITERAL}[\\s\\S]*?` +
      `'es-MX':\\s*${STRING_LITERAL}[\\s\\S]*?` +
      `'pt-BR':\\s*${STRING_LITERAL}`,
    'g',
  );
  let m;
  while ((m = beatRe.exec(block[0])) !== null) {
    beats.push({
      speaker: m[1],
      text: {
        'en-US': literalValue(m, 2),
        'es-MX': literalValue(m, 4),
        'pt-BR': literalValue(m, 6),
      },
    });
  }
  return beats.length > 0 ? beats : null;
}

/**
 * The frontend's `LEMONADE_CHANGE` beats: `{ speaker: 'x', textKey: '...' }`,
 * in order — the text itself is not here, only the key into `tutor.json`.
 */
export function frontendLemonadeBeats(source) {
  const block = /LEMONADE_CHANGE:\s*RoleplayScene\s*=\s*\{[\s\S]*?\n\};/.exec(source);
  if (!block) return null;
  const beats = [];
  const beatRe = /speaker:\s*'(lead|companion)',\s*\n\s*textKey:\s*'([\w.]+)'/g;
  let m;
  while ((m = beatRe.exec(block[0])) !== null) {
    beats.push({ speaker: m[1], textKey: m[2] });
  }
  return beats.length > 0 ? beats : null;
}

/**
 * Resolves a dot-path against a parsed i18n JSON tree. `textKey`s carry a
 * leading `tutor.` NAMESPACE segment (the file `tutor.json` itself), which
 * is not a key inside that file — `t()` strips it before looking anything
 * up, and this has to do the same or every path misses by one level.
 */
function resolvePath(tree, dotPath) {
  const path = dotPath.startsWith('tutor.') ? dotPath.slice('tutor.'.length) : dotPath;
  return path.split('.').reduce((node, key) => (node && typeof node === 'object' ? node[key] : undefined), tree);
}

export function checkRoleplayVoiceParity(read) {
  const problems = [];

  const oracleBeats = oracleLemonadeBeats(read(ORACLE_FILE));
  if (oracleBeats === null) {
    problems.push(`${ORACLE_FILE}: could not parse LEMONADE_CHANGE's beats`);
    return problems;
  }

  const frontendBeats = frontendLemonadeBeats(read(FRONTEND_SCENES_FILE));
  if (frontendBeats === null) {
    problems.push(`${FRONTEND_SCENES_FILE}: could not parse LEMONADE_CHANGE's beats`);
    return problems;
  }

  const i18nTrees = {};
  for (const [locale, file] of LOCALES.map((l, i) => [l, FRONTEND_I18N_FILES[i]])) {
    try {
      i18nTrees[locale] = JSON.parse(read(file));
    } catch (error) {
      problems.push(`${file}: could not parse as JSON — ${error.message}`);
    }
  }
  if (problems.length > 0) return problems;

  if (oracleBeats.length !== frontendBeats.length) {
    problems.push(
      `beat count disagrees: ${ORACLE_FILE} has ${oracleBeats.length}, ${FRONTEND_SCENES_FILE} has ${frontendBeats.length}`,
    );
    return problems;
  }

  for (let i = 0; i < oracleBeats.length; i += 1) {
    const oracleBeat = oracleBeats[i];
    const frontendBeat = frontendBeats[i];

    if (oracleBeat.speaker !== frontendBeat.speaker) {
      problems.push(
        `beat ${i}: speaker disagrees — ${ORACLE_FILE} says '${oracleBeat.speaker}', ` +
          `${FRONTEND_SCENES_FILE} says '${frontendBeat.speaker}'`,
      );
    }

    for (const locale of LOCALES) {
      const resolved = resolvePath(i18nTrees[locale], frontendBeat.textKey);
      if (typeof resolved !== 'string') {
        problems.push(`beat ${i}/${locale}: '${frontendBeat.textKey}' does not resolve in the i18n tree`);
        continue;
      }
      if (resolved !== oracleBeat.text[locale]) {
        problems.push(
          `beat ${i}/${locale}: text disagrees — oracle says "${oracleBeat.text[locale]}", ` +
            `the frontend's own '${frontendBeat.textKey}' says "${resolved}"`,
        );
      }
    }
  }

  return problems;
}

function main() {
  const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');
  const problems = checkRoleplayVoiceParity(read);
  if (problems.length > 0) {
    console.error('roleplay-voices:check FAILED — oracle and the frontend disagree about what is said:\n');
    for (const p of problems) console.error(`  ✗ ${p}`);
    process.exitCode = 1;
    return;
  }
  console.log('roleplay-voices:check OK — oracle synthesizes exactly what the frontend captions, beat for beat');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
