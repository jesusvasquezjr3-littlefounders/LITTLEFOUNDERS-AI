// Rules 2 and 3 of docs/engineering/FRONTEND-GUIDE.md: no horizontal page scroll, no ellipsis, no line clamp, no
// clipped text, nothing that spills out of its box or the viewport. Looks at the page, the cookie preferences
// sheet and the language menu.
//
//   npm run audit:layout                                one page: light, en-US, 1440 px
//   npm run audit:layout -- --matrix                    320, 390, 768, 1024 and 1440 px in the three languages
//
// Visually hidden text (the skip link, the "Step 1:" labels; boxes of 2 px or less) is skipped on purpose.
import { CLOSE_WITH_ESCAPE, OPEN_LANGUAGE_MENU, OPEN_PREFERENCES, describe, parseArgs, run, sleep } from './lib.mjs';

const CHECK = `(() => {
  const out = [];
  const viewport = document.documentElement.clientWidth;
  const label = (el) => el.tagName.toLowerCase() + (el.getAttribute('aria-label') ? '[' + el.getAttribute('aria-label').slice(0, 24) + ']' : '') + ' "' + (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 40) + '"';

  if (document.documentElement.scrollWidth > viewport + 1) out.push('PAGE scrolls horizontally: ' + document.documentElement.scrollWidth + ' > ' + viewport);

  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('svg, video, canvas, [aria-hidden="true"]')) continue;

    const style = getComputedStyle(el);

    if (style.display === 'none' || style.visibility === 'hidden') continue;
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;

    const box = el.getBoundingClientRect();

    if (box.width <= 2 && box.height <= 2) continue;
    if (style.textOverflow === 'ellipsis') out.push('ELLIPSIS ' + label(el));
    if (style.webkitLineClamp && style.webkitLineClamp !== 'none') out.push('LINE-CLAMP ' + label(el));
    if (style.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 1) out.push('CLIPPED-X ' + label(el) + ' ' + el.scrollWidth + ' > ' + el.clientWidth);
    if (style.overflowY !== 'visible' && el.scrollHeight > el.clientHeight + 1) out.push('CLIPPED-Y ' + label(el) + ' ' + el.scrollHeight + ' > ' + el.clientHeight);

    for (const node of el.childNodes) {
      if (node.nodeType !== 3 || !node.textContent.trim()) continue;

      const range = document.createRange();

      range.selectNodeContents(node);

      let reported = false;

      for (const r of range.getClientRects()) {
        if (r.right > viewport + 1 || r.left < -1) { out.push('OUTSIDE-VIEWPORT ' + label(el) + ' ' + Math.round(r.left) + '..' + Math.round(r.right)); reported = true; break; }
        if (r.width > 0 && (r.right > box.right + 1.5 || r.left < box.left - 1.5)) { out.push('SPILLS-BOX ' + label(el)); reported = true; break; }
      }

      if (reported) break;
    }
  }

  return [...new Set(out)];
})()`;

await run('layout', parseArgs(), async (page, config) => {
  let failures = 0;
  const check = async (state) => {
    const findings = await page.ev(CHECK);

    console.log(`[${describe(config)}] ${state}: ${findings.length === 0 ? 'ok' : findings.length + ' finding(s)'}`);

    for (const finding of findings) console.log(`    ${finding}`);

    failures += findings.length;
  };

  await check('page');
  await page.ev(OPEN_PREFERENCES);
  await sleep(1500);
  await check('preferences sheet');
  await page.ev(CLOSE_WITH_ESCAPE);
  await sleep(900);
  await page.ev(OPEN_LANGUAGE_MENU);
  await sleep(1000);
  await check('language menu open');

  return failures;
});
