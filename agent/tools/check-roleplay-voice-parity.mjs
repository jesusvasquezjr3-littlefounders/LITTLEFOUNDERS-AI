#!/usr/bin/env node
/**
 * ONE SCENE'S DIALOGUE, TWO HAND-WRITTEN COPIES, NO COMPILER BETWEEN THEM —
 * the same shape of gap `check-instrument-parity.mjs` and
 * `check-preferred-types-parity.mjs` already exist to close, applied here to
 * `roleplay`'s spoken lines.
 *
 * WHY THIS EXISTS. `oracle/src/tutor/roleplayScenes.ts` is what
 * `speech:pregenerate` actually SYNTHESIZES and bills for, once, into
 * `speech.pregenerated.json`. The rebuilt Mentor screen's scene table
 * (`frontend/src/rebuild/mentor/session/roleplay.ts`) and its captions (the
 * three `rebuild-mentor.json` files) are what a learner actually READS while
 * that same audio plays. (The legacy `frontend/src/tutor/roleplay/scenes.ts`
 * leg retired with the legacy Tutor UI, S10L.1.) Oracle and the frontend deliberately share no types (/AGENTS.md
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
/*
 * The rebuilt Mentor screen (W2M.3) acts the same scene from its own table and
 * captions it from its own namespace. Its captions follow the Copy Budget's
 * style (no em dash), so they are compared to Oracle's text by their WORDS: the
 * pre-generated clip must say exactly what the rebuilt plate shows.
 */
const REBUILT_SCENES_FILE = 'frontend/src/rebuild/mentor/session/roleplay.ts';
const REBUILT_COPY_FILES = LOCALES.map((locale) => `frontend/src/i18n/${locale}/rebuild-mentor.json`);

/** The words a voice says, without punctuation or case. */
export function spokenWords(text) {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? []).join(' ');
}

/** The rebuilt table's `LEMONADE_CHANGE` speakers, in order. */
export function rebuiltLemonadeSpeakers(source) {
  const block = /const LEMONADE_CHANGE:[^=]*=\s*\[[\s\S]*?\n\];/.exec(source);
  if (!block) return null;
  const speakers = [...block[0].matchAll(/speaker:\s*'(lead|companion)'/g)].map((m) => m[1]);
  return speakers.length > 0 ? speakers : null;
}

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

export function checkRoleplayVoiceParity(read) {
  const problems = [];

  const oracleBeats = oracleLemonadeBeats(read(ORACLE_FILE));
  if (oracleBeats === null) {
    problems.push(`${ORACLE_FILE}: could not parse LEMONADE_CHANGE's beats`);
    return problems;
  }

  const rebuiltSpeakers = rebuiltLemonadeSpeakers(read(REBUILT_SCENES_FILE));
  if (rebuiltSpeakers === null) {
    problems.push(`${REBUILT_SCENES_FILE}: could not parse LEMONADE_CHANGE's beats`);
    return problems;
  }
  if (rebuiltSpeakers.join() !== oracleBeats.map((beat) => beat.speaker).join()) {
    problems.push(`speaker disagrees: ${ORACLE_FILE} says ${oracleBeats.map((b) => b.speaker).join(',')}, ${REBUILT_SCENES_FILE} says ${rebuiltSpeakers.join(',')}`);
  }
  for (const [locale, file] of LOCALES.map((l, i) => [l, REBUILT_COPY_FILES[i]])) {
    let lines;
    try {
      lines = JSON.parse(read(file))?.mentorRoleplay?.scenes?.lemonade_change?.beats;
    } catch (error) {
      problems.push(`${file}: could not parse as JSON — ${error.message}`);
      continue;
    }
    if (!Array.isArray(lines) || lines.length !== oracleBeats.length) {
      problems.push(`beat count disagrees: ${file}: mentorRoleplay.scenes.lemonade_change.beats must hold ${oracleBeats.length} captions`);
      continue;
    }
    oracleBeats.forEach((beat, i) => {
      if (spokenWords(lines[i]) !== spokenWords(beat.text[locale])) {
        problems.push(`beat ${i}/${locale}: the rebuilt caption's words disagree — oracle says "${beat.text[locale]}", ${file} says "${lines[i]}"`);
      }
    });
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
