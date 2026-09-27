import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { launchBrowser, openPage } from './lesson-engine/browser.mjs';

/*
 * Real-Chrome check for the lane's published statements on the FAQ page:
 * S08.7's Product 10 E.10 "no messaging" and E.11 "how long we keep who
 * follows whom" (policy docs/rebuild/policies/SOCIAL-GOVERNANCE.md), and
 * S08.5's E.6 "can I delete our account" (ACCOUNT-DELETION.md), added to the
 * audit in S08.8. The FAQ is the rebuilt public FAQ (W2 Lane 1,
 * rebuild/site/Faq.tsx); this checks those three entries: 3 locales x 2 themes x
 * 320/375/768/1280 px x 1.0/1.4 text scale.
 *
 * Each configuration opens /faq, presses each entry's category filter and
 * its question with real (topmost-hit) mouse events, and checks: every answer
 * render in full; neither entry is clipped or outside the device width; the marketing
 * Copy Budget (question <= 8 words, answer <= 25 words and 2 sentences;
 * x1.25 for es-MX and pt-BR); no em dash; answer text >= 14 px with contrast
 * >= 4.5:1; the question button is at least 44 px tall (the legacy
 * accordion's own target). The legacy page being wider than the device (the
 * browser then zooms out) is reported separately as a legacy-page finding,
 * with the element that overflows. Console errors and failed requests are
 * reported.
 *
 * Usage: start the dev server, then
 *   REBUILD_URL=http://localhost:5350 AUDIT_OUT=<dir> node scripts/verify-social-governance-faq.mjs
 */

const origin = process.env.REBUILD_URL ?? 'http://localhost:5350';
const output = resolve(process.env.AUDIT_OUT ?? '../audit-results/social-governance-faq');
mkdirSync(output, { recursive: true });
const browser = await launchBrowser(mkdtempSync(join(output, 'chrome-')));
const page = await openPage(browser.browser, { width: 375, height: 740, dark: false });
const findings = [];
let configurations = 0;

const LOCALES = ['en-US', 'es-MX', 'pt-BR'];
const WIDTHS = [320, 375, 768, 1280];
const SCALES = [1, 1.4];
const SHOTS = new Set(['es-MX|dark|375|1', 'en-US|light|1280|1', 'pt-BR|dark|320|1.4']);
const strings = {};
for (const locale of LOCALES) {
  const { default: copy } = await import(`../src/i18n/${locale}/rebuild-site.json`, { with: { type: 'json' } });
  strings[locale] = copy.faq;
}

const wait = (ms) => new Promise((done) => setTimeout(done, ms));
async function until(expression, tries = 200) {
  for (let n = 0; n < tries; n++) {
    if (await page.evaluate(expression)) return true;
    await wait(50);
  }
  return false;
}

/** A real click: the browser decides what is topmost at the element's centre. */
async function click(expression) {
  // Smooth scrolling would move the target after its box is read: scroll instantly and let layout settle.
  const found = await page.evaluate(`(() => { const el = ${expression}; if (!el) return false; document.documentElement.style.scrollBehavior = 'auto'; el.scrollIntoView({ block: 'center', behavior: 'instant' }); return true; })()`);
  if (!found) return false;
  await page.evaluate('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
  await wait(120);
  // A mobile viewport zooms out when the page is wider than the device, so a
  // layout box is converted to the visual viewport's coordinates for the click.
  const box = await page.evaluate(`(() => { const r = (${expression}).getBoundingClientRect(); const v = visualViewport; return { x: (r.left + r.width / 2 - v.offsetLeft) * v.scale, y: (r.top + r.height / 2 - v.offsetTop) * v.scale }; })()`);
  for (const type of ['mousePressed', 'mouseReleased']) await page.send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 });
  return true;
}

const byText = (text) => `[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === ${JSON.stringify(text)})`;
// The accordion trigger holds the question in its first span, next to an icon ligature.
const byQuestion = (text) => `[...document.querySelectorAll('button[aria-expanded]')].find((b) => b.querySelector('span')?.textContent.trim() === ${JSON.stringify(text)})`;

for (const locale of LOCALES) {
  const faq = strings[locale];
  const items = [['noMessaging', 'privacy'], ['socialRetention', 'privacy'], ['deleteAccount', 'support']]
    .map(([id, category]) => ({ ...faq.items[id], category: faq.categories[category] }));
  for (const theme of ['light', 'dark']) {
    for (const width of WIDTHS) {
      for (const scale of SCALES) {
        configurations += 1;
        const key = `${locale}|${theme}|${width}|${scale}`;
        await page.send('Emulation.setDeviceMetricsOverride', { width, height: 740, deviceScaleFactor: 1, mobile: width < 768 });
        await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
        // A visitor who has already made the cookie choice: the docked banner would otherwise cover the lower questions.
        await page.send('Network.setCookie', { name: 'lf_cc', value: 'denied', url: origin });
        await page.send('Page.navigate', { url: `${origin}/faq?lng=${locale}` });
        const loaded = await until(`!!(${byText(faq.categories.privacy)})`, 1800); // a cold page on a loaded shared machine can take over a minute
        if (!loaded) { findings.push({ key, issue: 'faq-not-loaded' }); continue; }
        await page.evaluate(`localStorage.setItem('lf-theme', '${theme}'); document.documentElement.classList.toggle('dark', ${theme === 'dark'}); document.documentElement.style.fontSize='${16 * scale}px'`);
        await page.evaluate('document.fonts.ready');
        // The accordion opens one answer at a time: open and audit each in turn,
        // under its own category filter.
        for (const item of items) {
          await click(byText(item.category));
          if (!await until(`!!(${byQuestion(item.question)})`)) { findings.push({ key, issue: `missing-question:${item.question}` }); continue; }
          await click(byQuestion(item.question));
          if (!await until(`(${byQuestion(item.question)})?.getAttribute('aria-expanded') === 'true'`)) { findings.push({ key, issue: `did-not-open:${item.question}` }); continue; }
          await wait(150);
          const audit = await page.evaluate(`(() => {
            const issues = [];
            const item = ${JSON.stringify(item)};
            // The page itself (legacy, not restyled here) may be wider than the
            // device; that is reported separately from the two new entries.
            const device = ${width};
            if (document.documentElement.scrollWidth > device + 1 || visualViewport.scale < 0.99) {
              const wide = [...document.querySelectorAll('body *')].find((el) => el.getBoundingClientRect().right > device + 1 && el.children.length === 0);
              issues.push('legacy-page-wider-than-viewport(' + (wide ? wide.tagName + '.' + String(wide.className).slice(0, 40) + ' "' + (wide.textContent || '').trim().slice(0, 30) + '"' : '?') + ')');
            }
            const words = (t) => (t.match(/[\\p{L}\\p{N}]+(?:['’][\\p{L}\\p{N}]+)*/gu) || []).length;
            const sentences = (t) => (t.match(/[.!?](\\s|$)/g) || []).length;
            const factor = ${locale === 'en-US' ? 1 : 1.25};
            const lum = (c) => { const m = c.match(/[\\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
            const background = (el) => { for (let n = el; n; n = n.parentElement) { const b = getComputedStyle(n).backgroundColor; if (b && !b.endsWith(', 0)') && b !== 'transparent') return b; } return 'rgb(255, 255, 255)'; };
            if (words(item.question) > Math.floor(8 * factor)) issues.push('question-over-budget');
            if (words(item.answer) > Math.floor(25 * factor) || sentences(item.answer) > 2) issues.push('answer-over-budget');
            if (/\\u2014/.test(item.question + item.answer)) issues.push('em-dash');
            const button = ${byQuestion(item.question)};
            if (button.getBoundingClientRect().height < 44) issues.push('question-target-under-44px');
            const panel = document.getElementById(button.getAttribute('aria-controls'));
            const answer = panel && panel.querySelector('p');
            if (!answer || answer.textContent.trim() !== item.answer) return issues.concat('answer-not-rendered');
            const r = answer.getBoundingClientRect();
            if (r.width < 1 || r.height < 1) issues.push('answer-hidden');
            if (answer.scrollWidth > answer.clientWidth + 1 || r.right > device + 1 || r.left < -1) issues.push('answer-clipped');
            const q = button.getBoundingClientRect();
            if (q.right > device + 1 || q.left < -1) issues.push('question-outside-viewport');
            const style = getComputedStyle(answer);
            if (parseFloat(style.fontSize) < 14) issues.push('answer-under-14px');
            const [a, b] = [lum(style.color), lum(background(answer))];
            const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
            if (ratio < 4.5) issues.push('answer-contrast-' + ratio.toFixed(2));
            return issues;
          })()`);
          for (const issue of audit) findings.push({ key, issue: `${issue}:${item.question}` });
        }
        if (SHOTS.has(key)) {
          // The last entry audited is still open: capture it.
          const last = items[items.length - 1];
          await page.evaluate(`(${byQuestion(last.question)} || document.body).scrollIntoView({ block: 'center', behavior: 'instant' })`);
          await wait(150);
          const shot = await page.send('Page.captureScreenshot', { format: 'png' });
          const file = join(output, `faq-${locale}-${theme}-${width}-${String(scale).replace('.', '_')}.png`);
          writeFileSync(file, Buffer.from(shot.data, 'base64'));
        }
      }
    }
  }
}

// Console errors and failed requests are reported, not judged here: the page
// runs with no Core, so its anonymous session probe fails by design.
const entryFindings = findings.filter((f) => !f.issue.startsWith('legacy-page-'));
const legacyPage = findings.filter((f) => f.issue.startsWith('legacy-page-'));
const report = { configurations, findings: entryFindings, legacyPageFindings: legacyPage, consoleErrors: [...new Set(page.errors)], failedRequests: [...new Set(page.failedRequests)] };
writeFileSync(join(output, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ configurations, findings: entryFindings.length, legacyPageFindings: legacyPage.length, legacyPageConfigurations: new Set(legacyPage.map((f) => f.key)).size, consoleErrors: report.consoleErrors.length, failedRequests: report.failedRequests.length, output }));
if (entryFindings.length) console.log(JSON.stringify(entryFindings.slice(0, 30), null, 1));
await page.send('Browser.close').catch(() => {});
page.ws.close();
browser.child.kill();
process.exitCode = entryFindings.length ? 1 : 0;
