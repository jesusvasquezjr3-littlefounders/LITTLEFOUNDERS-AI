// check-social-copy-tone.mjs — the tone gate for the profile and social-layer
// copy (GAP-FIX-R4). Appendix J Part 3 Stage 4 asks any change to profile
// display or social-layer copy to extend "the existing Forge tone gate
// (established in Block B/D)" to it; F.3 names the same gate. This is that
// extension: the D.8 engine (check-family-copy-tone.mjs), read with a second
// scope file, agent/tools/social-copy-tone.lexicon.json.
//
// Scope: every group of rebuild-profile.json (scope.complete: a new group
// fails until it is listed), the OD-27 (1) goals-together copy
// (rebuild-learn.json `together`) and the Family connection groups of
// rebuild-family.json, in all three locales; the surfaces rebuild/social,
// rebuild/account, routes/app/profile and /learn/together.
//
// Categories, each with a stated reason (the lexicon file carries them):
//   guarantee       a safety, privacy or protection promise the system does
//                   not enforce (D.7, Block E)
//   messaging       chat, message, inbox or reply vocabulary (E.10: there is
//                   no messaging between accounts)
//   glossary        the Tutor is the verified parent; the Mentor is the AI;
//                   coins, never money (owner log §5)
//   bank_register   a bank's voice (Law 2)
//   legal_register  a legal or disciplinary voice (Law 2, Block E)
//   shouting        stacked "!!", capitals, raw error codes
//   b14_ui          B.14's UI tone lexicon, shared with Forge and D.8
// A reviewed exception names the key, the category and why. A stale
// exception fails, and so does a surface that renders a raw Core message.
//
// `--report <path>` writes the pass rate as JSON (Appendix H/J diagnostic).

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkTone, liveInputs } from './check-family-copy-tone.mjs';

export const SOCIAL_LEXICON = 'agent/tools/social-copy-tone.lexicon.json';

/** The live social-layer inputs: the shared engine, the social scope file. */
export function socialInputs(root) {
  return root ? liveInputs(root, SOCIAL_LEXICON) : liveInputs(undefined, SOCIAL_LEXICON);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkTone(socialInputs());
  const rate = result.checked > 0 ? result.passed / result.checked : null;
  const reportAt = process.argv.indexOf('--report');
  if (reportAt > 0 && process.argv[reportAt + 1]) {
    writeFileSync(process.argv[reportAt + 1], `${JSON.stringify({
      metric: 'Tone-Gate Pass Rate (profile and social-layer copy), Appendix J Part 3 Stage 4, Diagnostic',
      at: new Date().toISOString(), checked: result.checked, passed: result.passed, passRate: rate, failures: result.failures,
    }, null, 2)}\n`);
  }
  if (result.failures.length > 0) {
    for (const failure of result.failures) console.error(`FAIL: ${failure}`);
    console.error(`social-copy-tone: ${result.passed} of ${result.checked} strings pass (${((rate ?? 0) * 100).toFixed(1)}%)`);
    process.exit(1);
  }
  console.log(`social-copy-tone OK — ${result.checked} profile and social-layer strings in three locales; every rebuild-profile group in scope; no surface renders a raw Core message; pass rate ${((rate ?? 0) * 100).toFixed(1)}%`);
}
