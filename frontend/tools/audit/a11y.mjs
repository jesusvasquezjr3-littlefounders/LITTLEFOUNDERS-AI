// Accessibility: axe-core (WCAG 2.0 to 2.2 A and AA plus best practices) on the page, with the cookie preferences
// sheet open, and with the language menu open.
//
//   npm run audit:a11y                                  one page: light, en-US, 1440 px
//   npm run audit:a11y -- --matrix                      every width and language, light and dark alternating
//   npm run audit:a11y -- --theme dark --lang es-MX --width 390
//
// With the language menu open Radix hides the rest of the page, so axe also reports aria-hidden-focus,
// landmark-one-main, page-has-heading-one and region; those four are expected there and not counted.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { CLOSE_WITH_ESCAPE, OPEN_LANGUAGE_MENU, OPEN_PREFERENCES, describe, parseArgs, run, sleep } from './lib.mjs';

const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const EXPECTED_WITH_MENU_OPEN = new Set(['aria-hidden-focus', 'landmark-one-main', 'page-has-heading-one', 'region']);
const AUDIT = `(async () => {
  const result = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
  return result.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
})()`;

await run('a11y', parseArgs(), async (page, config) => {
  await page.ev(axeSource);

  let failures = 0;
  const check = async (state, expected = new Set()) => {
    const violations = (await page.ev(AUDIT)).filter((v) => !expected.has(v.id));

    console.log(`[${describe(config)}] ${state}: ${violations.length === 0 ? 'ok' : violations.length + ' violation(s)'}`);

    for (const v of violations) console.log(`    ${v.impact} ${v.id}: ${v.help}\n      ${v.nodes.join('\n      ')}`);

    failures += violations.length;
  };

  await check('page');
  await page.ev(OPEN_PREFERENCES);
  await sleep(1500);
  await check('preferences sheet');
  await page.ev(CLOSE_WITH_ESCAPE);
  await sleep(900);
  await page.ev(OPEN_LANGUAGE_MENU);
  await sleep(1200);
  await check('language menu open', EXPECTED_WITH_MENU_OPEN);

  return failures;
});
