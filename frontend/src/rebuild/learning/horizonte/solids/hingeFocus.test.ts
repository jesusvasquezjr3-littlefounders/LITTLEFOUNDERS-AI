import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * A hinge is a focusable SVG shape with its own outline turned off, so its stylesheet is the only focus indicator a keyboard user gets.
 * Every hinge already wears the pale armed halo while a face is carried, so focus has to read against that halo, not match it.
 */
const css = readFileSync(resolve(__dirname, 'solids.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, prelude, body]) => ({ selectors: prelude!.split(',').map((selector) => selector.trim()), body: body! }));
const stroke = (body: string) => /(?:^|;)\s*stroke\s*:\s*([^;]+)/.exec(body)?.[1]?.trim();
const hingeFocus = rules.filter((rule) => rule.selectors.some((selector) => selector.includes('.lf-poly-hinge') && selector.includes(':focus-visible')));

describe('net hinge keyboard focus', () => {
  it('styles a focused hinge', () => expect(hingeFocus.length).toBeGreaterThan(0));

  it('draws the focused hinge in the focus colour, not a pale tint', () => {
    const strokes = hingeFocus.map((rule) => stroke(rule.body));
    expect(strokes).toContain('var(--focus-color)');
    for (const value of strokes) expect(value ?? '', 'a pale stroke is not a visible focus indicator').not.toMatch(/-soft\b/);
  });

  it('keeps the focus rule apart from the armed halo so the two states differ', () => {
    for (const rule of hingeFocus) for (const selector of rule.selectors) expect(selector).not.toContain('data-drop-armed');
    const armed = rules.find((rule) => rule.selectors.some((selector) => selector.includes('.lf-poly-hinge[data-drop-armed')));
    expect(stroke(armed?.body ?? '')).toBe('var(--sky-soft)');
  });
});
