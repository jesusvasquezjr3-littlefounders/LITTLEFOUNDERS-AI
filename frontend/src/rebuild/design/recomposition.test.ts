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
};

describe('rebuilt surfaces use the shared controls (S03.6)', () => {
  it('has surfaces to check', () => {
    expect(surfaces.length).toBeGreaterThan(30);
  });

  it('draws no local toggle: aria-pressed and role="switch" live only in the design system', () => {
    const offences = surfaces.filter(({ source }) => /aria-pressed|role="switch"/.test(source)).map(({ file }) => file);
    expect(offences).toEqual([]);
  });

  it('writes no local error or status paragraph: errors are InlineNotice, Banner or ErrorState', () => {
    const offences = surfaces.filter(({ source }) => /role="alert"|role=\{[^}]*'alert'|<div role="status"><Copy/.test(source)).map(({ file }) => file);
    expect(offences).toEqual([]);
  });

  it('renders no raw input or button except the direct-manipulation handles of a teaching visual', () => {
    const offences: string[] = [];
    for (const { file, source } of surfaces) {
      const allowed = DIRECT_MANIPULATION[file];
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
