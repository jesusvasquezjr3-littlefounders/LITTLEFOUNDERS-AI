// Rule 2 of docs/engineering/FRONTEND-GUIDE.md, measured: the container, the left edge of every text block, the
// space between sections, the gutters between side-by-side columns, the characters per line of each text block
// and the centers of side-by-side blocks. It reports numbers and flags what breaks the grid; it does not
// judge taste.
//
//   npm run audit:grid                                  one page: light, en-US, 1440 px
//   npm run audit:grid -- --width 390 --lang es-MX
//   npm run audit:grid -- --matrix
//
// Flags: more than one gutter on the page; a space between consecutive sections that differs from the others by
// more than 40 px (scenes pulled in with a negative margin, to trim the empty frame around them, account for the smaller difference);
// a left-aligned text block whose text starts inset from the left edge of its own column (list rows with a marker, and text set beside a figure in a flex row, are skipped); and running text (16 px, eight words or
// more) whose column is too wide (over 75 characters) or, from 768 px, when it wraps, too narrow (under 40).
import { describe, parseArgs, run } from './lib.mjs';

const MEASURE = `(() => {
  const round = Math.round;
  const box = (el) => { const r = el.getBoundingClientRect(); return { l: round(r.left), r: round(r.right), t: round(r.top + scrollY), b: round(r.bottom + scrollY), w: round(r.width), h: round(r.height) }; };
  const out = { viewport: document.documentElement.clientWidth };
  const main = document.querySelector('main');
  const sections = [...document.querySelectorAll('main > div > section, main > section')];

  out.container = box(main);
  out.sections = sections.map((section, index) => {
    const style = getComputedStyle(section);
    const visible = [...section.querySelectorAll('h1, h2, h3, p, li, button, a, video, img, [role=img], ol')].filter((el) => el.getBoundingClientRect().height > 2);
    const tops = visible.map((el) => el.getBoundingClientRect().top + scrollY);
    const bottoms = visible.map((el) => el.getBoundingClientRect().bottom + scrollY);
    const columns = [...section.children].filter((child) => getComputedStyle(child).display !== 'none').map(box);
    const gutters = [];

    for (let i = 1; i < columns.length; i++) if (columns[i].t < columns[i - 1].b - 4 && columns[i].l >= columns[i - 1].r) gutters.push(columns[i].l - columns[i - 1].r);

    return { index, ...box(section), paddingTop: parseFloat(style.paddingTop), contentTop: round(Math.min(...tops)), contentBottom: round(Math.max(...bottoms)), gutters, columns };
  });

  // left edge of each text block (the first line's start), per section
  out.edges = sections.map((section) => [...section.querySelectorAll('h1, h2, h3, p')].filter((el) => el.textContent.trim() && el.getBoundingClientRect().height > 2).map((el) => {
    const style = getComputedStyle(el);
    const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
    const lines = Math.max(1, round(el.getBoundingClientRect().height / lineHeight));
    const words = el.textContent.trim().split(/\\s+/).length;

    const column = [...section.children].find((child) => child.contains(el)) ?? section;
    const width = el.getBoundingClientRect().width;
    const font = parseFloat(style.fontSize);
    const textLeft = el.getBoundingClientRect().left + parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth);

    return { tag: el.tagName.toLowerCase(), text: el.textContent.trim().slice(0, 28), left: round(textLeft), inList: !!el.closest('li') || (getComputedStyle(el.parentElement).display === 'flex' && el.previousElementSibling !== null), inset: round(textLeft - column.getBoundingClientRect().left), align: style.textAlign, font: round(font), lines, cpl: round(el.textContent.trim().length / lines), capacity: round(width / (font * 0.52)), words, width: round(width) };
  }));

  return out;
})()`;

await run('grid', parseArgs(), async (page, config) => {
  await page.scrollThrough();

  const m = await page.ev(MEASURE);
  const flags = [];
  const left = m.container.l + (m.viewport >= 640 ? 24 : 16);
  const gutters = new Set(m.sections.flatMap((s) => s.gutters));
  const spaces = m.sections.slice(1).map((s, i) => s.contentTop - m.sections[i].contentBottom);

  console.log(`\n### ${describe(config)}  container ${m.container.l}..${m.container.r}  content left ${left}`);
  console.log(`space between sections (visible content): ${spaces.join(', ')}`);
  console.log(`gutters between side-by-side columns: ${[...gutters].join(', ') || 'none (stacked)'}`);

  for (const s of m.sections) {
    const inset = m.edges[s.index].filter((e) => (e.align === 'start' || e.align === 'left') && !e.inList && e.inset > 1);

    console.log(`section ${s.index}: top ${s.t} h ${s.h} padding ${s.paddingTop}; columns ${s.columns.map((c) => `${c.l}..${c.r}`).join(' | ')}`);

    for (const e of m.edges[s.index]) {
      const judged = e.tag === 'p' && e.words >= 8 && e.font <= 17;

      console.log(`    ${e.tag} left ${e.left} (inset ${e.inset}) ${e.align} ${e.font}px ${e.lines} line(s) room for ~${e.capacity} characters w${e.width}  "${e.text}"`);

      if (judged && e.capacity > 75) flags.push(`section ${s.index}: "${e.text}" has room for ${e.capacity} characters per line`);
      if (judged && m.viewport >= 768 && e.lines > 1 && e.capacity < 40) flags.push(`section ${s.index}: "${e.text}" wraps in a column with room for only ${e.capacity} characters`);
    }

    for (const e of inset) flags.push(`section ${s.index}: ${e.tag} "${e.text}" is inset ${e.inset} px from the left edge of its column`);
  }

  if (gutters.size > 1) flags.push(`more than one gutter on the page: ${[...gutters].join(', ')}`);
  if (spaces.length > 0 && Math.max(...spaces) - Math.min(...spaces) > 40) flags.push(`the space between sections is not constant: ${spaces.join(', ')}`);

  console.log(flags.length === 0 ? 'grid: ok' : `grid: ${flags.length} flag(s)`);

  for (const f of flags) console.log(`    ${f}`);

  return flags.length;
});
