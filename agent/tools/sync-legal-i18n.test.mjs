// The legal sync tool writes legally-binding text into the product, and it was
// the only tool in this directory with no test. It had a Windows bug the whole
// time: it read the source documents with whatever line endings git checked out,
// so on a CRLF checkout every carriage return travelled INTO the JSON string
// values.
//
// Nothing caught it. Chapter and paragraph counts matched, `legal:sync` printed
// OK, and the result was a 102-line diff running straight through the terms and
// conditions without changing one word of them. Whoever ran it next on Linux
// would have produced the exact inverse diff, forever.
//
// So this asserts the PROPERTY on the committed artifacts rather than mocking
// the tool: whatever machine ran it last, no legal string may carry a carriage
// return. That is the thing that must be true, and it is checkable in a
// millisecond without writing to the repository.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const LOCALES = ['en-US', 'es-MX', 'pt-BR'];
const SOURCES = {
  'es-MX': 'LEGAL/TERMINOSyCONDICIONES.md',
  'en-US': 'LEGAL/TERMSANDCONDITIONS.md',
  'pt-BR': 'LEGAL/TERMOSDECONDIÇÕES.md',
};

/** Every string in a nested object, with the dot-path that reaches it. */
function* strings(node, trail = '') {
  if (typeof node === 'string') {
    yield [trail, node];
    return;
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      yield* strings(value, trail ? `${trail}.${key}` : key);
    }
  }
}

// ── 1. no carriage return survives into the generated legal sections ─────────

for (const locale of LOCALES) {
  const file = path.join(root, `frontend/src/i18n/${locale}/marketing.json`);
  const legal = JSON.parse(readFileSync(file, 'utf8')).legal;
  assert.ok(legal, `${locale}: marketing.json has no legal section`);

  for (const [trail, value] of strings(legal)) {
    assert.ok(
      !value.includes('\r'),
      `${locale}: legal.${trail} carries a carriage return — sync-legal-i18n.mjs was ` +
        `run on a CRLF checkout without normalizing. Re-run \`npm run legal:sync\` ` +
        `with the fix in place and commit that instead.`,
    );
  }
}

// ── 2. the three locales stay structurally identical ─────────────────────────
//
// §1.8 is a hard invariant: a locale that quietly lost a chapter would publish
// a shorter contract to the people who read that language. The tool asserts
// this at generation time; this asserts it about what actually shipped.

const shapes = LOCALES.map((locale) => {
  const legal = JSON.parse(
    readFileSync(path.join(root, `frontend/src/i18n/${locale}/marketing.json`), 'utf8'),
  ).legal;
  return [locale, [...strings(legal)].map(([trail]) => trail).sort()];
});

const [, reference] = shapes[0];
for (const [locale, keys] of shapes.slice(1)) {
  assert.deepEqual(
    keys,
    reference,
    `${locale}: its legal key set differs from ${shapes[0][0]}'s — one locale has ` +
      `gained or lost a clause.`,
  );
}

// ── 3. the source documents are the ones the tool actually reads ─────────────
//
// A renamed or moved /LEGAL/ document would make `legal:sync` a no-op against a
// file that no longer exists, and the JSON would silently keep serving the old
// contract. Cheap to check, and the failure is otherwise invisible.

for (const [locale, relative] of Object.entries(SOURCES)) {
  const source = path.join(root, relative);
  assert.doesNotThrow(
    () => readFileSync(source, 'utf8'),
    `${locale}: ${relative} is missing — sync-legal-i18n.mjs reads it by this exact path.`,
  );
}

console.log(
  `sync-legal-i18n OK — ${reference.length} legal strings per locale, ` +
    `3 locales in lockstep, no carriage returns.`,
);
