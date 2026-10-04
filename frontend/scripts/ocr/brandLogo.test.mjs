import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isExistingBrandLogo } from './brandLogo.mjs';

test('the brand lettering exception accepts only the unchanged existing logo at its registered path', () => {
  const bytes = readFileSync(new URL('../../public/email-templates/lf-logo-email.png', import.meta.url));
  assert.equal(isExistingBrandLogo('/rebuild/brand/logo.png', bytes), true);
  assert.equal(isExistingBrandLogo('/rebuild/marketing/example.png', bytes), false);
  const changed = Buffer.from(bytes);
  changed[changed.length - 1] ^= 1;
  assert.equal(isExistingBrandLogo('/rebuild/brand/logo.png', changed), false);
});
