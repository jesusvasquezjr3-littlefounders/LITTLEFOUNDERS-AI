// Keyboard: real key presses, no mouse.
//   - the first Tab stop is the skip link, then the stops in reading order;
//   - every stop shows a focus indicator;
//   - every visible interactive target is at least 48 px both ways (docs/engineering/FRONTEND-GUIDE.md);
//   - the language menu opens with Enter, moves with ArrowDown and Escape returns focus to its button;
//   - the preferences sheet and the sign-in window trap focus and Escape returns focus to the control that opened them.
//
//   npm run audit:keyboard                              one page: light, en-US, 1440 px
//   npm run audit:keyboard -- --matrix --themes light,dark
import { OPEN_PREFERENCES, OPEN_SIGN_IN, describe, parseArgs, run, sleep } from './lib.mjs';

const WHERE = `(() => {
  const a = document.activeElement;

  if (!a || a === document.body) return null;

  const style = getComputedStyle(a);
  const box = a.getBoundingClientRect();
  const ring = (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== 'none';

  return { tag: a.tagName.toLowerCase(), name: (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 30), ring, inDialog: !!a.closest('[role=dialog]'), inMenu: !!a.closest('[role=menu]'), w: Math.round(box.width), h: Math.round(box.height) };
})()`;

const TARGETS = `[...document.querySelectorAll('a[href], button, input, select, textarea, [role=menuitemradio], [tabindex]:not([tabindex="-1"])')]
  .filter((el) => { const b = el.getBoundingClientRect(); return b.width > 2 && b.height > 2 && !el.closest('[aria-hidden="true"]'); })
  .map((el) => { const b = el.getBoundingClientRect(); return { name: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 30), w: Math.round(b.width), h: Math.round(b.height) }; })
  .filter((t) => t.w < 48 || t.h < 48)`;

await run('keyboard', parseArgs(), async (page, config) => {
  const failures = [];
  const expect = (ok, message) => { if (!ok) failures.push(message); };
  const tag = `[${describe(config)}]`;

  for (const t of await page.ev(TARGETS)) failures.push(`target under 48 px: ${t.name} ${t.w}x${t.h}`);

  const order = [];

  for (let i = 0; i < 10; i++) {
    await page.press('Tab');

    const stop = await page.ev(WHERE);

    order.push(stop);
    expect(stop && stop.ring, `stop ${i + 1} (${stop?.name}) shows no focus indicator`);
  }

  console.log(`${tag} tab order: ${order.map((s) => s?.name).join(' > ')}`);
  expect(order[0]?.tag === 'a', `the first Tab stop is "${order[0]?.name}", not the skip link`);

  await page.ev(`document.querySelector('header button[aria-label^="Language"], header button[aria-label^="Idioma"]').focus()`);
  await page.press('Enter');
  await sleep(500);
  expect((await page.ev(WHERE))?.inMenu, 'Enter on the language button did not move focus into the menu');
  await page.press('ArrowDown');
  expect((await page.ev(WHERE))?.inMenu, 'ArrowDown left the language menu');
  await page.press('Escape');
  await sleep(400);

  const afterMenu = await page.ev(WHERE);

  expect(afterMenu && !afterMenu.inMenu && afterMenu.tag === 'button', 'Escape did not return focus to the language button');

  await page.ev(`[...document.querySelectorAll('button')].find((b) => /preferences|preferencias|preferências/i.test(b.textContent)).focus()`);

  const opener = (await page.ev(WHERE))?.name;

  await page.press('Enter');
  await sleep(900);

  const trapped = new Set();

  for (let i = 0; i < 6; i++) { await page.press('Tab'); trapped.add(JSON.stringify(await page.ev(WHERE))); }

  expect([...trapped].every((s) => JSON.parse(s)?.inDialog), 'Tab left the preferences sheet');
  await page.press('Escape');
  await sleep(700);
  expect((await page.ev(WHERE))?.name === opener, `Escape did not return focus to "${opener}"`);

  await page.ev(`(${OPEN_SIGN_IN.replace('.click()', '.focus()')})`);

  const signInOpener = (await page.ev(WHERE))?.name;

  await page.press('Enter');
  await sleep(900);
  expect((await page.ev(WHERE))?.inDialog, 'Enter on Sign in did not move focus into the window');

  const signInTrapped = new Set();

  for (let i = 0; i < 6; i++) { await page.press('Tab'); signInTrapped.add(JSON.stringify(await page.ev(WHERE))); }

  expect([...signInTrapped].every((s) => JSON.parse(s)?.inDialog), 'Tab left the sign-in window');
  await page.press('Escape');
  await sleep(700);
  expect((await page.ev(WHERE))?.name === signInOpener, `Escape did not return focus to "${signInOpener}"`);

  console.log(`${tag} ${failures.length === 0 ? 'ok' : failures.length + ' finding(s)'}`);

  for (const f of failures) console.log(`    ${f}`);

  return failures.length;
});
