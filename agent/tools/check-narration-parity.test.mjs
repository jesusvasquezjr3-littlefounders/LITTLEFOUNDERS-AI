import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { checkNarrationParity, ECHO, FORGE } from './check-narration-parity.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const real = { [ECHO]: readFileSync(path.join(ROOT, ECHO), 'utf8'), [FORGE]: readFileSync(path.join(ROOT, FORGE), 'utf8') };
const with_ = (file, from, to) => (f) => {
  if (f !== file) return real[f];
  assert.ok(real[f].includes(from), `fixture anchor missing in ${f}: ${from}`);
  return real[f].replace(from, to);
};

test('Echo and the Forge redundancy gate agree in the shipped repo', () => {
  assert.deepEqual(checkNarrationParity((f) => real[f]), []);
});

test('RED when Echo starts reading a new choice type aloud that Forge does not model', () => {
  const problems = checkNarrationParity(with_(ECHO, "  'would_you_rather',\n]);", "  'would_you_rather',\n  'price_compare',\n]);"));
  assert.ok(problems.some((p) => p.includes('choice roll-up types differ') && p.includes('price_compare')));
});

test('RED when Forge stops modelling a narrated story body', () => {
  const problems = checkNarrationParity(with_(FORGE, "      case 'checkpoint':\n        push('recap', str(payload.recap_md), ['payload.recap_md']);\n        break;\n", ''));
  assert.ok(problems.some((p) => p.includes('narrated story types differ')));
});

test('RED when a unit field is renamed on one side', () => {
  const problems = checkNarrationParity(with_(ECHO, "push(units, segment, 'explanation', segment.explanation_md);", "push(units, segment, 'feedback', segment.explanation_md);"));
  assert.ok(problems.some((p) => p.includes('narration unit fields differ') && p.includes('feedback')));
});

test('RED when either side drops the B.18 text_only rule', () => {
  const problems = checkNarrationParity(with_(ECHO, "if (segment.narration?.mode === 'text_only') continue;", ''));
  assert.ok(problems.some((p) => p.includes(ECHO) && p.includes('text_only')));
});
