#!/usr/bin/env node
// check-dark-patterns.mjs — B.25, B.26 and B.27 (S05.3f): the automated half
// of the recurring dark-pattern and shame-signal audit.
// Checklist and procedure: docs/rebuild/DARK-PATTERN-AUDIT.md.
// Policy and lexicons: docs/rebuild/LEARNER-REGISTER-AND-WELLBEING-POLICY.md,
// backend/src/services/learnerRegisterPolicy.ts (imported directly: the one
// register policy the UI and the Forge gates also read).
//
// Product 10 B.25 asks for a recurring, at minimum pre-release, audit against
// the manipulative-design taxonomy of Radesky et al. (2022), with zero
// manipulation as the target. Appendix C scores it per release, item by item.
// This tool:
//   1. scans every learner- and parent-facing string the repository ships
//      (the three locales' i18n, the rebuilt UI, Core's family-prompt and
//      narrative catalogs, the Mentor's scripted lines) against the universal
//      forbidden lexicons: self-global shame, trait praise, moralizing about a
//      family's money, loss mechanics, fabricated time pressure, parasocial
//      pressure, purchase lures and social pressure;
//   2. checks the rebuilt UI's structure: no countdown or timer, no autoplay
//      or timed advance into more content, every dialog can be closed, no
//      leaderboard, no lives or hearts, a miss never uses the error hue, a sad
//      character or an error sound; and the live lesson player has no lives;
//   3. validates the audit record (docs/rebuild/audits/dark-pattern-audits.json):
//      every checklist item has a result and evidence in every audit. With
//      --release it also requires a human-signed release audit, no older than
//      RELEASE_AUDIT_MAX_AGE_DAYS, with no failing or open item.
//
//   node agent/tools/check-dark-patterns.mjs            (inside spec:check)
//   node agent/tools/check-dark-patterns.mjs --release  (inside release:readiness)

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const policy = await import(pathToFileURL(join(repo, 'backend/src/services/learnerRegisterPolicy.ts')).href);

export const CHECKLIST_VERSION = '2026-09-24.1';
export const AUDIT_RECORD = 'docs/rebuild/audits/dark-pattern-audits.json';
export const RELEASE_AUDIT_MAX_AGE_DAYS = 45;
export const RESULTS = ['pass', 'fail', 'open', 'not-applicable'];

/**
 * The checklist (Radesky et al. 2022's categories as summarized in Appendix B
 * §3.6, plus B.26's shame signals and B.27's family-finance framing). Items
 * marked automated are enforced by this tool on every run; manual items are
 * the reviewer's, per release.
 */
export const CHECKLIST = [
  { id: 'DP-01', category: 'Fabricated time pressure', method: 'automated', check: 'No countdown, timer, expiry-urgency or hurry copy on any learner or parent surface.' },
  { id: 'DP-02', category: 'Parasocial relationship pressure', method: 'automated', check: 'The Mentor never pleads, misses the learner, or is sad or disappointed about them leaving.' },
  { id: 'DP-03', category: 'Navigation constraints and forced continuity', method: 'automated', check: 'Every dialog and sheet can be closed; nothing autoplays or advances into more content on a timer.' },
  { id: 'DP-04', category: 'Lures to purchase or to watch advertising', method: 'automated', check: 'No purchase, upgrade, premium, unlock-now or watch-an-ad lure (OD-5: no paywall exists).' },
  { id: 'DP-05', category: 'Social pressure and comparison', method: 'automated', check: 'No comparison with other people, no leaderboard or rank for a learner; comparison is only with their own history.' },
  { id: 'DP-06', category: 'Randomized rewards', method: 'automated', check: 'No variable-ratio or mystery reward (B.22; rewards:check and Forge gate 17).' },
  { id: 'DP-07', category: 'Loss aversion', method: 'automated', check: 'No lives, hearts or other depleting resource; streak copy never threatens a loss (OD-1, B.21).' },
  { id: 'DP-08', category: 'Confirmshaming', method: 'automated', check: 'Declining any offer is neutral: no shame, guilt or trait language on a decline or dismiss.' },
  { id: 'DP-09', category: 'Nagging', method: 'manual', check: 'No streak-at-risk, come-back or repeated re-engagement notification or email to a learner.' },
  { id: 'DP-10', category: 'Disguised advertising', method: 'manual', check: 'No third-party advertising, sponsored content or product placement anywhere a learner can see.' },
  { id: 'SH-01', category: 'Shame language', method: 'automated', check: 'No self-global or trait language in any error, miss, failure or low-score state (B.26).' },
  { id: 'SH-02', category: 'Non-verbal shame signals', method: 'automated', check: 'A miss is never red, never a sad or disappointed character and never an error sound (B.26).' },
  { id: 'SH-03', category: 'Comparative display tied to a miss', method: 'automated', check: 'No rank, leaderboard or peer-visible result changes because of a miss (B.26).' },
  { id: 'FF-01', category: 'Family financial circumstances', method: 'automated', check: 'No copy, prompt or content implies a family\'s real money is a personal or moral failing (B.27).' },
  { id: 'MN-01', category: 'Reviewer walkthrough', method: 'manual', check: 'A reviewer walks every learner, Tutor and teen flow in the three locales against this checklist, including states the scanner cannot see.' },
  { id: 'MN-02', category: 'Time pressure inside lesson content', method: 'manual', check: 'Timed drills in lessons are reviewed: a timer never costs the learner anything they cannot retry.' },
  { id: 'MN-03', category: 'Age register', method: 'manual', check: 'The registers stay distinct (B.23): Appendix C Age-Band Register Differentiation Audit.' },
];

// ---- 1. copy -----------------------------------------------------------------

const LOCALES = ['en-US', 'es-MX', 'pt-BR'];
/** Code whose string literals are product copy. Tests, fixtures of lesson content and the policy itself are excluded. */
export const COPY_CODE_ROOTS = ['frontend/src/rebuild', 'backend/src/services/narrative', 'oracle/src/tutor/scripted.ts'];
const COPY_EXCLUDE = [/\.test\.[tj]sx?$/, /Fixtures\.ts$/, /\.generated\.ts$/, /[\\/]__tests__[\\/]/];

function walk(path, out = []) {
  let stat;
  try { stat = statSync(path); } catch { return out; }
  if (stat.isFile()) { out.push(path); return out; }
  for (const name of readdirSync(path)) {
    if (['node_modules', 'dist', '__tests__'].includes(name)) continue;
    walk(join(path, name), out);
  }
  return out;
}

const rel = (path) => relative(repo, path).split(sep).join('/');

export function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

/** String and template literals in source (a template's ${...} is blanked). */
export function stringLiterals(source) {
  const code = stripComments(source);
  return (code.match(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g) ?? [])
    .map((literal) => literal.slice(1, -1).replace(/\$\{[^}]*\}/g, ' '));
}

function jsonStrings(node, visit, path = '') {
  if (typeof node === 'string') visit(node, path);
  else if (Array.isArray(node)) node.forEach((item, index) => jsonStrings(item, visit, `${path}[${index}]`));
  else if (node && typeof node === 'object') for (const [key, value] of Object.entries(node)) jsonStrings(value, visit, path ? `${path}.${key}` : key);
}

const ITEM_FOR_LEXICON = {
  'time-pressure': 'DP-01', 'parasocial-pressure': 'DP-02', 'purchase-lure': 'DP-04', 'social-pressure': 'DP-05',
  'loss-mechanic': 'DP-07', 'self-global': 'SH-01', 'person-praise': 'SH-01', 'family-finance-moralizing': 'FF-01',
};

export function scanText(text, where) {
  return policy.findLexicons(text, policy.UNIVERSAL_FORBIDDEN).map((hit) => ({
    item: ITEM_FOR_LEXICON[hit.lexicon], where, message: `${hit.lexicon}: "${hit.match}"`,
  }));
}

function scanCopy(findings) {
  let files = 0;
  for (const locale of LOCALES) {
    for (const file of walk(join(repo, 'frontend/src/i18n', locale))) {
      if (!file.endsWith('.json')) continue;
      files += 1;
      jsonStrings(JSON.parse(readFileSync(file, 'utf8')), (text, path) => findings.push(...scanText(text, `${rel(file)} ${path}`)));
    }
  }
  for (const root of COPY_CODE_ROOTS) {
    for (const file of walk(join(repo, root))) {
      if (!/\.(ts|tsx)$/.test(file) || COPY_EXCLUDE.some((pattern) => pattern.test(file))) continue;
      files += 1;
      for (const literal of stringLiterals(readFileSync(file, 'utf8'))) findings.push(...scanText(literal, rel(file)));
    }
  }
  return files;
}

// ---- 2. structure ------------------------------------------------------------

const MISS_SELECTOR = /(miss|wrong|incorrect|not-?yet|retry|failed|--review|\[data-verdict='?review)/i;
const SAD_EMOTION = /['"](sad|disappointed|angry|crying|upset|ashamed)['"]/;

/** Structural checks over one rebuilt source file. Exported for the red-team tests. */
export function structuralFindings(path, text) {
  const findings = [];
  const code = stripComments(text);
  if (path.endsWith('.tsx') || path.endsWith('.ts')) {
    if (/role=["']timer["']/.test(code) || /\b(countdown|secondsLeft|timeLeft|expiresIn)\b/i.test(code)) {
      findings.push({ item: 'DP-01', where: path, message: 'a countdown or timer in rebuilt UI' });
    }
    // One exception, by exact file (OD-28 V-12, Frontend 07 §5): the shared celebration motion asset plays a
    // decorative Lottie once (never a loop) inside a closed-list milestone only. That is the milestone's
    // celebration, not content that plays on or advances; every autoplay there must be `autoplay loop={false}`.
    const oneShotCelebration = path.replace(/\\/g, '/').endsWith('src/rebuild/design/MotionAsset.tsx')
      && (code.match(/\bautoplay\b/g) ?? []).length === (code.match(/\bautoplay loop=\{false\}/g) ?? []).length && !/\bautoPlay\b/.test(code);
    if (/\bautoPlay\b|\bautoplay\b/.test(code) && !oneShotCelebration) findings.push({ item: 'DP-03', where: path, message: 'autoplay in rebuilt UI' });
    // A timed move to another screen or lesson. A representation stage inside
    // one activity advancing after the learner's own answer is not "more content".
    if (/setTimeout\([^;]*?\b(navigate|onContinue|onNext|location\.assign|location\.href)\b/s.test(code)) {
      findings.push({ item: 'DP-03', where: path, message: 'a timed advance into more content' });
    }
    // A dialog closes on Escape in its own file, or it hands a close handler to the shared layer stack
    // (S03.2 design/layers.ts), whose own Escape handling scanStructure checks once for every overlay.
    const ownEscape = /['"]Escape['"]/.test(code) && /\bon(Close|Cancel|Dismiss|Decline)\b/.test(code);
    const sharedEscape = /\buse(?:Modal|Layer)\([^;]*\bon(?:Close|Dismiss|Escape)\b/.test(code);
    if (/role=["']dialog["']|aria-modal/.test(code) && !ownEscape && !sharedEscape) {
      findings.push({ item: 'DP-03', where: path, message: 'a dialog without Escape and a close handler' });
    }
    // The Mentor whiteboard's `ranking` instrument (the wire types, ported from tutor/types.ts in W2M.1) orders the
    // items of a money problem, which is the skill practised: it ranks no person. Only that literal kind is exempt,
    // as a type member (`kind: 'ranking'`) or as the branch that draws it (`case 'ranking':`, the W2M.2 board).
    // Gap-fix round 1 (B.7): the board's renderer manifest names the same instrument (`ranking: 'SeriesBarsVisual'`).
    const people = code.replace(/\bkind:\s*['"]ranking['"]|\bcase\s+['"]ranking['"]\s*:|\branking:\s*'\w+Visual'/g, '');
    if (/\bleaderboards?\b|\branking\b/i.test(people)) findings.push({ item: 'DP-05', where: path, message: 'a leaderboard or ranking in rebuilt UI' });
    // The cartoon avatar's closed option set names an eye shape 'hearts' (E.12, W2P.1): a list literally named
    // `eyes` is a drawing choice, never a counter, and is the one place the word is not read as a lives mechanic.
    const withoutEyeOptions = code.replace(/\beyes:\s*\[[^\]]*\]/g, 'eyes: []');
    if (/\b(hearts|livesLeft|lives_left|heartCount)\b/.test(withoutEyeOptions)) findings.push({ item: 'DP-07', where: path, message: 'a lives or hearts counter in rebuilt UI' });
    if (SAD_EMOTION.test(code)) findings.push({ item: 'SH-02', where: path, message: 'a sad or disappointed character state' });
  }
  if (path.endsWith('.css')) {
    for (const rule of code.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = rule[1].trim();
      if (MISS_SELECTOR.test(selector) && /var\(--error/.test(rule[2])) {
        findings.push({ item: 'SH-02', where: path, message: `a miss styled with the error hue: ${selector}` });
      }
    }
  }
  return findings;
}

/** The live lesson player is live product: it may have no lives either (OD-1). */
export const LIVE_PLAYER_CHECKS = [
  { file: 'frontend/src/lesson-engine/core/session.ts', forbid: [/hearts\s*-\s*1/, /hearts\s*===\s*0/, /doc\.scoring\.hearts/], item: 'DP-07', message: 'the session spends or reads lives' },
  { file: 'frontend/src/lesson-engine/player/LessonPlayer.tsx', forbid: [/state\.hearts/, /chips\.hearts/], item: 'DP-07', message: 'the player renders a lives counter' },
  { file: 'frontend/src/lesson-engine/lab/LessonLabPage.tsx', forbid: [/setHearts/, /heartsOn/], item: 'DP-07', message: 'the lesson lab offers lives' },
  { file: 'frontend/src/lesson-engine/player/sfx.ts', forbid: [/tryagain:\s*'[^']*(error|fail|buzz|wrong)[^']*'/], item: 'SH-02', message: 'a miss plays an error sound' },
];

function scanStructure(findings) {
  let files = 0;
  for (const file of walk(join(repo, 'frontend/src/rebuild'))) {
    if (!/\.(ts|tsx|css)$/.test(file) || COPY_EXCLUDE.some((pattern) => pattern.test(file))) continue;
    files += 1;
    findings.push(...structuralFindings(rel(file), readFileSync(file, 'utf8')));
  }
  // The shared layer stack every design-system overlay delegates to must itself close the topmost layer on Escape.
  const LAYERS = 'frontend/src/rebuild/design/layers.ts';
  let layers = '';
  try { layers = stripComments(readFileSync(join(repo, LAYERS), 'utf8')); } catch { /* reported below */ }
  files += 1;
  if (!(/key\s*!==\s*['"]Escape['"]/.test(layers) && /\.onEscape\(\)/.test(layers))) {
    findings.push({ item: 'DP-03', where: LAYERS, message: 'the shared layer stack no longer closes the topmost overlay on Escape' });
  }
  for (const check of LIVE_PLAYER_CHECKS) {
    let text;
    try { text = stripComments(readFileSync(join(repo, check.file), 'utf8')); } catch { continue; }
    files += 1;
    if (check.forbid.some((pattern) => pattern.test(text))) findings.push({ item: check.item, where: check.file, message: check.message });
  }
  for (const locale of LOCALES) {
    const lesson = JSON.parse(readFileSync(join(repo, 'frontend/src/i18n', locale, 'lesson.json'), 'utf8'));
    if (lesson.chips && Object.keys(lesson.chips).some((key) => key.startsWith('hearts'))) {
      findings.push({ item: 'DP-07', where: `frontend/src/i18n/${locale}/lesson.json`, message: 'a lives counter string exists' });
    }
  }
  return files;
}

// ---- 3. the audit record -------------------------------------------------------

export function validateAuditRecord(record, { release = false, now = new Date() } = {}) {
  const problems = [];
  if (!record || typeof record !== 'object' || !Array.isArray(record.audits) || record.audits.length === 0) {
    return ['the audit record has no audits'];
  }
  if (record.checklist_version !== CHECKLIST_VERSION) problems.push(`checklist_version must be ${CHECKLIST_VERSION}`);
  for (const audit of record.audits) {
    const label = audit?.id ?? '(unnamed audit)';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(audit?.date ?? '')) problems.push(`${label}: date must be YYYY-MM-DD`);
    if (!['engineering-pre-audit', 'release-audit'].includes(audit?.kind)) problems.push(`${label}: kind must be engineering-pre-audit or release-audit`);
    if (typeof audit?.scope !== 'string' || audit.scope.length < 10) problems.push(`${label}: scope is required`);
    for (const item of CHECKLIST) {
      const entry = audit?.items?.[item.id];
      if (!entry) { problems.push(`${label}: ${item.id} has no result`); continue; }
      if (!RESULTS.includes(entry.result)) problems.push(`${label}: ${item.id} result must be one of ${RESULTS.join(', ')}`);
      if (typeof entry.evidence !== 'string' || entry.evidence.length < 10) problems.push(`${label}: ${item.id} needs evidence`);
    }
    for (const id of Object.keys(audit?.items ?? {})) {
      if (!CHECKLIST.some((item) => item.id === id)) problems.push(`${label}: ${id} is not a checklist item`);
    }
  }
  if (release) {
    const releases = record.audits.filter((audit) => audit.kind === 'release-audit').sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const latest = releases[0];
    if (!latest) problems.push('release: no release audit is recorded (an engineering pre-audit is not a release audit)');
    else {
      if (typeof latest.signed_off_by !== 'string' || latest.signed_off_by.trim().length < 3) problems.push(`release: ${latest.id} has no human sign-off`);
      const age = (now.getTime() - Date.parse(`${latest.date}T00:00:00Z`)) / 86_400_000;
      if (!(age <= RELEASE_AUDIT_MAX_AGE_DAYS)) problems.push(`release: ${latest.id} is older than ${RELEASE_AUDIT_MAX_AGE_DAYS} days`);
      const blocking = CHECKLIST.filter((item) => !['pass', 'not-applicable'].includes(latest.items?.[item.id]?.result)).map((item) => item.id);
      if (blocking.length > 0) problems.push(`release: ${latest.id} has failing or open items: ${blocking.join(', ')}`);
    }
  }
  return problems;
}

/** Appendix C "Dark-Pattern Audit Score": failing items per audit (target 0). */
export function auditScore(audit) {
  const results = CHECKLIST.map((item) => audit.items?.[item.id]?.result);
  return {
    pass: results.filter((r) => r === 'pass').length,
    fail: results.filter((r) => r === 'fail').length,
    open: results.filter((r) => r === 'open').length,
    notApplicable: results.filter((r) => r === 'not-applicable').length,
  };
}

// ---- run ---------------------------------------------------------------------

export function run({ release = false } = {}) {
  const findings = [];
  const copyFiles = scanCopy(findings);
  const structureFiles = scanStructure(findings);
  let record;
  try { record = JSON.parse(readFileSync(join(repo, AUDIT_RECORD), 'utf8')); } catch { record = null; }
  const auditProblems = validateAuditRecord(record, { release });
  return { findings, copyFiles, structureFiles, auditProblems, record };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const release = process.argv.includes('--release');
  const { findings, copyFiles, structureFiles, auditProblems, record } = run({ release });
  for (const finding of findings) console.error(`${finding.item} ${finding.where}: ${finding.message}`);
  for (const problem of auditProblems) console.error(`audit record: ${problem}`);
  if (findings.length > 0 || auditProblems.length > 0) {
    console.error(`Dark-pattern gate: ${findings.length} finding(s), ${auditProblems.length} audit-record problem(s). Checklist: docs/rebuild/DARK-PATTERN-AUDIT.md.`);
    process.exitCode = 1;
  } else {
    const latest = record.audits[record.audits.length - 1];
    const score = auditScore(latest);
    console.log(`Dark-pattern gate OK: ${copyFiles} copy files and ${structureFiles} structure files, 0 findings. `
      + `Latest audit ${latest.id} (${latest.kind}): ${score.pass} pass, ${score.fail} fail, ${score.open} open, ${score.notApplicable} not applicable.`);
  }
}
