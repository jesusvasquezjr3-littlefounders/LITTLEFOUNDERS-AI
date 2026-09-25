#!/usr/bin/env node
/**
 * ONE NARRATION RULE, TWO HAND-WRITTEN COPIES (S05.4a, B.18).
 *
 * Echo (audiogen/src/narrate/extractNarratables.ts) decides what a v1 lesson
 * reads aloud. Forge's redundancy gate (coursegen/src/contentGates/
 * lessonModel.ts, `narrationUnits`) must model exactly the same units, or it
 * would judge on-screen text against narration that is never produced (a false
 * block) or miss narration that is (a false pass). The packages share no code
 * (no workspaces), so this gate compares the two copies structurally:
 *
 *   - the choice types whose option labels are read as one `choices` clip;
 *   - the story types whose payload bodies are narrated;
 *   - the unit field names each copy pushes ('prompt', `line.${i}`, ...);
 *   - the B.18 channel rule: text_only skips the segment, differentiated
 *     reads narration.script_md in place of prompt_md.
 *
 * The committed corpus is the runtime cross-check: coursegen's tests replay
 * every recorded audio manifest of database/seeds/first-lemonade-stand-fixture.sql
 * through the Forge model and require zero drift.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const ECHO = 'audiogen/src/narrate/extractNarratables.ts';
export const FORGE = 'coursegen/src/contentGates/lessonModel.ts';

function arrayLiteral(source, anchor) {
  const at = source.indexOf(anchor);
  if (at === -1) return null;
  // The first '[' after the '=' (a type annotation such as `readonly string[]` comes before it).
  const eq = source.indexOf('=', at);
  const open = eq === -1 ? -1 : source.indexOf('[', eq);
  const close = source.indexOf(']', open);
  if (open === -1 || close === -1) return null;
  return [...source.slice(open, close).matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
}

function functionBody(source, anchor) {
  const at = source.indexOf(anchor);
  if (at === -1) return null;
  const next = source.indexOf('\nfunction ', at + anchor.length);
  const nextExport = source.indexOf('\nexport function ', at + anchor.length);
  const ends = [next, nextExport].filter((i) => i !== -1);
  return source.slice(at, ends.length ? Math.min(...ends) : undefined);
}

function caseLabels(body) {
  return [...body.matchAll(/case '([a-z_]+)':/g)].map((m) => m[1]).sort();
}

function fieldNames(body, pushPrefix) {
  const re = new RegExp(`(?<![.\\w])${pushPrefix}(['\`])([^'\`]+)\\1`, 'g');
  return [...new Set([...body.matchAll(re)].map((m) => m[2].replace(/\$\{[^}]+\}/g, '#')))].sort();
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function checkNarrationParity(read) {
  const echo = read(ECHO);
  const forge = read(FORGE);
  const problems = [];

  const echoChoices = arrayLiteral(echo, 'const CHOICE_OPTION_TYPES');
  const forgeChoices = arrayLiteral(forge, 'export const CHOICE_OPTION_TYPES');
  if (!echoChoices || !forgeChoices) problems.push('CHOICE_OPTION_TYPES not found in one of the copies');
  else if (!same(echoChoices, forgeChoices)) problems.push(`choice roll-up types differ: ${ECHO} [${echoChoices}] vs ${FORGE} [${forgeChoices}]`);

  const echoStoryBody = functionBody(echo, 'function pushStoryBodies');
  const forgeUnits = functionBody(forge, 'export function narrationUnits');
  if (!echoStoryBody || !forgeUnits) {
    problems.push('pushStoryBodies (Echo) or narrationUnits (Forge) not found');
    return problems;
  }
  const echoStory = caseLabels(echoStoryBody);
  const forgeStory = caseLabels(forgeUnits);
  const forgeDeclared = arrayLiteral(forge, 'export const NARRATED_STORY_TYPES');
  if (!same(echoStory, forgeStory)) problems.push(`narrated story types differ: ${ECHO} [${echoStory}] vs ${FORGE} [${forgeStory}]`);
  if (!forgeDeclared || !same(forgeDeclared, forgeStory)) problems.push(`${FORGE}: NARRATED_STORY_TYPES [${forgeDeclared}] does not match its own switch [${forgeStory}]`);

  const echoMain = functionBody(echo, 'export function extractNarratables') ?? '';
  const echoFields = fieldNames(echoMain + echoStoryBody + (functionBody(echo, 'function pushChoices') ?? ''), 'push\\(units, segment, ');
  const forgeFields = fieldNames(forgeUnits, 'push\\(');
  if (!same(echoFields, forgeFields)) problems.push(`narration unit fields differ: ${ECHO} [${echoFields}] vs ${FORGE} [${forgeFields}]`);

  for (const [file, source] of [[ECHO, echo], [FORGE, forge]]) {
    if (!/narration\?\.mode === 'text_only'\) continue;/.test(source)) problems.push(`${file}: missing the B.18 text_only skip`);
    if (!/narration\?\.mode === 'differentiated'/.test(source) || !/script_md/.test(source)) problems.push(`${file}: missing the B.18 differentiated script rule`);
  }
  return problems;
}

function main() {
  const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');
  const problems = checkNarrationParity(read);
  if (problems.length > 0) {
    console.error('narration:check FAILED — Echo and the Forge redundancy gate disagree on what is narrated:\n');
    for (const p of problems) console.error(`  ✗ ${p}`);
    process.exitCode = 1;
    return;
  }
  console.log('narration:check OK — Echo and the Forge redundancy gate model the same narration units');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
