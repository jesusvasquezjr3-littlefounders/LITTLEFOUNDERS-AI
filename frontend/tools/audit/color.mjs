// Color (rule 5, docs/design/RESEARCH-FOUNDATION.md section 9), measured on the tokens the running page uses, in
// light and dark: the label color each fill needs, text and edge contrast on the page ground, and how far apart
// the fills that sit together stay under color-vision deficiency.
//
//   npm run audit:color
//
// Contrast is the WCAG 2.x relative-luminance ratio. Color-vision simulation is Machado et al. (2009) at full
// severity (protan, deutan, tritan) with CIELAB deltaE76, the worst of the three; "about 15 or less" is a working
// heuristic for "collapses", not a standard. Flags: a fill whose best label is under 4.5:1, text under 4.5:1,
// an edge under 3:1, and a pair of fills that collapse, which must never carry meaning by hue alone.
import { launch, parseArgs } from './lib.mjs';

// token names, resolved on the running page so the tool follows src/styles/lf-theme.css
const FILLS = { primary: '--primary', accent: '--v-pink', sky: '--v-blue', gold: '--v-yellow', mint: '--v-olive', error: '--v-danger-fill' };
const INK = '--v-on-accent';
const GROUND = '--v-canvas';
const TEXTS = { text: '--v-text', 'soft ink': '--v-ink-soft', 'brand ink': '--primary-ink' };
const EDGES = { edge: '--v-edge' };
const PAIRS = [['accent', 'primary'], ['accent', 'gold'], ['accent', 'error'], ['mint', 'sky'], ['mint', 'primary'], ['primary', 'sky'], ['error', 'mint'], ['error', 'primary']];

const names = [...Object.values(FILLS), INK, GROUND, ...Object.values(TEXTS), ...Object.values(EDGES)];
const RESOLVE = `(() => {
  const probe = document.createElement('i');

  document.body.append(probe);

  const out = {};

  for (const name of ${JSON.stringify(names)}) { probe.style.color = 'var(' + name + ')'; out[name] = getComputedStyle(probe).color; }

  probe.remove();

  return out;
})()`;

const rgb = (css) => css.match(/[\d.]+/g).slice(0, 3).map((n) => Number(n) / 255);
const linear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (c) => { const [r, g, b] = c.map(linear); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const MACHADO = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};
const lab = (c, type) => {
  const l = c.map(linear);
  const [r, g, b] = (type ? MACHADO[type].map((row) => row[0] * l[0] + row[1] * l[1] + row[2] * l[2]) : l).map((v) => Math.min(1, Math.max(0, v)));
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;

  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
};
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const worst = (a, b) => Math.min(...Object.keys(MACHADO).map((type) => distance(lab(a, type), lab(b, type))));

parseArgs();

const browser = await launch();
let flags = 0;

try {
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ theme, settle: 2500 });
    const tokens = Object.fromEntries(Object.entries(await page.ev(RESOLVE)).map(([k, v]) => [k, rgb(v)]));
    const white = [1, 1, 1];

    console.log(`\n### ${theme}`);
    console.log('label on each fill (white / ink):');

    for (const [name, token] of Object.entries(FILLS)) {
      const w = ratio(tokens[token], white), i = ratio(tokens[token], tokens[INK]);
      const best = Math.max(w, i);

      console.log(`    ${name.padEnd(8)} ${w.toFixed(2)} / ${i.toFixed(2)}  -> ${w >= i ? 'white' : 'ink'}${best < 4.5 ? '   <- under 4.5:1' : ''}`);
      flags += best < 4.5 ? 1 : 0;
    }

    console.log('text on the page ground:');

    for (const [name, token] of Object.entries(TEXTS)) {
      const r = ratio(tokens[token], tokens[GROUND]);

      console.log(`    ${name.padEnd(10)} ${r.toFixed(2)}${r < 4.5 ? '   <- under 4.5:1' : ''}`);
      flags += r < 4.5 ? 1 : 0;
    }

    for (const [name, token] of Object.entries(EDGES)) {
      const r = ratio(tokens[token], tokens[GROUND]);

      console.log(`    ${name.padEnd(10)} ${r.toFixed(2)} (needs 3:1)${r < 3 ? '   <- under 3:1' : ''}`);
      flags += r < 3 ? 1 : 0;
    }

    console.log('fills that sit together, worst color-vision case (normal vision in brackets):');

    for (const [a, b] of PAIRS) {
      const normal = distance(lab(tokens[FILLS[a]]), lab(tokens[FILLS[b]]));
      const bad = worst(tokens[FILLS[a]], tokens[FILLS[b]]);

      console.log(`    ${`${a} / ${b}`.padEnd(18)} ${bad.toFixed(1).padStart(5)} (${normal.toFixed(1)})${bad < 15 ? '   <- collapses: add an icon and a word' : ''}`);
    }

    await page.close();
  }
} finally {
  await browser.close();
}

console.log(flags === 0 ? '\ncolor: contrast ok (collapsing pairs are listed above; they need a second channel, not a new color).' : `\ncolor: ${flags} contrast flag(s).`);
process.exitCode = flags === 0 ? 0 : 1;
