import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * S03.6 recomposition contract: the rebuilt surfaces use the shared controls
 * (Frontend Bible 02 rule 23, §9.1, §9.5, §9.8) instead of re-implementing them.
 * The inventory this closes is in docs/rebuild/sprints/S03-DESIGN-SYSTEM.md
 * (S03.1 current state). It reads source, so a regression fails before any
 * browser runs.
 */
// Vitest runs from the frontend package (as galleryContract.test.ts relies on).
const rebuild = resolve(process.cwd(), 'src/rebuild');
const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true })
  .flatMap((entry) => (entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]));
const relative = (file: string) => file.slice(file.lastIndexOf('rebuild')).replace(/\\/g, '/');
/** Product surfaces: everything rebuilt except the design system itself, the dev-only gallery and tests. */
const surfaces = walk(rebuild)
  .filter((file) => file.endsWith('.tsx') && !/\.test\.tsx$/.test(file))
  .map((file) => ({ file: relative(file), source: readFileSync(file, 'utf8') }))
  .filter(({ file }) => !file.startsWith('rebuild/design/') && !file.startsWith('rebuild/preview/'));
const sheets = walk(rebuild).filter((file) => file.endsWith('.css'))
  .map((file) => ({ file: relative(file), css: readFileSync(file, 'utf8').replace(/[/][*][\s\S]*?[*][/]/g, '') }));

/**
 * Direct manipulation of a teaching visual (05 interaction contract), not a
 * form control: the transparent range laid over a drawn number line and the
 * draggable linked pair on the ratio lines. Their discrete alternatives are the
 * shared Stepper and Slider.
 */
const DIRECT_MANIPULATION: Record<string, RegExp> = {
  'rebuild/learning/NumberLineBoard.tsx': /<input className="lf-number-line-slider"/g,
  'rebuild/learning/FractionNumberLineBoard.tsx': /<input className="lf-number-line-slider"/g,
  'rebuild/learning/RatioTableBoard.tsx': /<button className="lf-ratio-pair"/g,
  // Horizonte boards: each is a cell, strip or step drawn on the visual itself, the tap alternative to a drag
  // (Horizonte spec V1-V6). Choices that sit beside a visual use the shared ChoiceChip, never a raw button.
  'rebuild/learning/horizonte/com/CircuitsBoard.tsx': /<button key=\{id\} type="button" className="lf-bit"/g,
  'rebuild/learning/horizonte/com/NetworkBoard.tsx': /<button key=\{id\} type="button" className="lf-pascal-cell"/g,
  'rebuild/learning/horizonte/golden/TenFrameBoard.tsx': /<button key=\{index\} type="button" className="lf-tenframe-cell"/g,
  'rebuild/learning/horizonte/num-b/ArrayAreaBoard.tsx': /<button key=\{index\} type="button" className="lf-arr-row"|<button type="button" aria-pressed=\{split === at\}/g,
  // The numbered shading row of the circles: the tap alternative to the drawn slices. ChoiceChip and Button are bound to counted copy roles, so they would count the digits as words.
  'rebuild/learning/horizonte/num-b/FractionCirclesBoard.tsx': /<button key=\{item\.value\} type="button" className="lf-numb-numeral"/g,
  'rebuild/learning/horizonte/num-b/FractionWallBoard.tsx':/<button type="button" className="lf-fcell lf-fcell--button"|<button key=\{index\} type="button" className="lf-grid-strip"|<button type="button" className="lf-grid-strip"/g,
  'rebuild/learning/horizonte/num-b/RatioLineBoard.tsx': /<button type="button" className="lf-line-step"/g,
  'rebuild/learning/horizonte/solids/CubeStackBoard.tsx': /<button type="button" className="lf-stack-height"/g,
  'rebuild/learning/horizonte/solids/NetCompleteBoard.tsx': /<button type="button" className="lf-net-square"/g,
  'rebuild/learning/horizonte/solids/NetLabelBoard.tsx': /<button type="button" className="lf-net-square"/g,
  // The public landing simulation: a topic card and an age card each hold a number or range, a title and a sentence, which the single-label ChoiceChip cannot carry. They only switch a local preview and never write learner state.
  'rebuild/site/Landing.tsx': /<button key=\{item\.title\} type="button" className="lf-landing-topic"|<button type="button" key=\{item\.range\} aria-pressed=\{age === index\}/g,
};

/** Files whose drawn cells, beads or slices (or, on the public landing demo, selector cards) carry aria-pressed because that element itself is the control. */
const PRESSED_VISUAL_CELLS = new Set([
  'rebuild/learning/horizonte/com/CircuitsBoard.tsx',
  'rebuild/learning/horizonte/com/NetworkBoard.tsx',
  'rebuild/learning/horizonte/num-a/AbacusBoard.tsx',
  'rebuild/learning/horizonte/num-a/RekenrekBoard.tsx',
  'rebuild/learning/horizonte/num-b/ArrayAreaBoard.tsx',
  'rebuild/learning/horizonte/num-b/FractionCirclesBoard.tsx',
  'rebuild/learning/horizonte/num-b/FractionWallBoard.tsx',
  'rebuild/learning/horizonte/num-b/RatioLineBoard.tsx',
  'rebuild/site/Landing.tsx',
]);

/**
 * The one governed upload surface (docs/rebuild/policies/SOCIAL-GOVERNANCE.md §4.2):
 * the parent's ID photo for A.5 verification. It is kept out of the shared
 * controls on purpose, so no other screen can render a file input by import.
 */
const REVIEWED_UPLOAD: Record<string, RegExp> = {
  'rebuild/identity/IdDocumentField.tsx': /<input id=\{id\} type="file"/g,
};

describe('rebuilt surfaces use the shared controls (S03.6)', () => {
  it('has surfaces to check', () => {
    expect(surfaces.length).toBeGreaterThan(30);
  });

  it('draws no local toggle: aria-pressed and role="switch" live only in the design system', () => {
    const offences = surfaces.filter(({ file, source }) => /role="switch"/.test(source) || (/aria-pressed/.test(source) && !PRESSED_VISUAL_CELLS.has(file))).map(({ file }) => file);
    expect(offences).toEqual([]);
  });

  it('writes no local error or status paragraph: errors are InlineNotice, Banner or ErrorState', () => {
    const offences = surfaces.filter(({ source }) => /role="alert"|role=\{[^}]*'alert'|<div role="status"><Copy/.test(source)).map(({ file }) => file);
    expect(offences).toEqual([]);
  });

  it('renders no raw input or button except the direct-manipulation handles of a teaching visual', () => {
    const offences: string[] = [];
    for (const { file, source } of surfaces) {
      const allowed = DIRECT_MANIPULATION[file] ?? REVIEWED_UPLOAD[file];
      const raw = (source.match(/<(?:input|button)\b/g) ?? []).length;
      const permitted = allowed ? (source.match(allowed) ?? []).length : 0;
      if (raw !== permitted) offences.push(`${file}: ${raw - permitted} raw control(s)`);
    }
    expect(offences).toEqual([]);
  });

  it('keeps no duplicated control component or stylesheet', () => {
    for (const retired of ['learning/ParameterSlider.tsx', 'learning/ScaleToggle.tsx']) expect(existsSync(join(rebuild, retired)), retired).toBe(false);
    const retiredRules = /\.lf-parameter-(?:slider|stepper)|\.lf-scale-toggle|\.lf-learning-stepper|\.lf-number-line-stepper button|\.lf-learning-feedback--[a-z]+\s*[,{]|\.lf-feedback--(?:correct|retry)|\.lf-field\b|\.lf-learning-view-toggle\s*\{[^}]*background/;
    expect(sheets.filter(({ css }) => retiredRules.test(css)).map(({ file }) => file)).toEqual([]);
  });

  it('draws progress only with the shared ProgressBar', () => {
    // Not progress capsules: the result screen's today-versus-best comparison bars (a chart that fills as part of the
    // lesson-complete celebration) and the transport screen's still, indeterminate loading track.
    const allowed = new Set(['rebuild/learning/LessonResultView.tsx', 'rebuild/learning/LessonTransportStateView.tsx']);
    const offences = surfaces.filter(({ file, source }) => /role="progressbar"/.test(source) && !allowed.has(file)).map(({ file }) => file);
    expect(offences).toEqual([]);
    expect(sheets.filter(({ css }) => /\.lf-learning-progress\s*>\s*span/.test(css)).map(({ file }) => file)).toEqual([]);
  });

  it('shows every lesson verdict through the shared feedback row', () => {
    const boards = surfaces.filter(({ source }) => /lf-learning-feedback/.test(source));
    expect(boards.map(({ file }) => file)).toEqual(['rebuild/learning/LessonFeedback.tsx']);
  });
});
