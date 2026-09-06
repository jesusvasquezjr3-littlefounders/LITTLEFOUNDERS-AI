import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HudPlate } from '../HudPlate';
import { resolveBackdrop, SCENE_BACKDROP_IDS } from '@/tutor-scene/backdrops';

/*
 * HudPlate carries three rules that cannot be left to memory, because all three
 * fail silently and all three fail only for someone other than the person who
 * built it.
 *
 * The CONTRAST rule, which changed on 2026-08-22 and is now measured rather
 * than asserted. Text used to be banned from the glass and put on an opaque
 * floor, on the grounds that a translucent plate over an orbiting camera has no
 * background to compute a ratio against. True, and not the end of the
 * arithmetic: alpha puts a FLOOR under the composite, so the ratio is
 * computable as a bound. `--lf-lumen-alpha` IS that bound, and the first
 * describe below re-derives it from the shipped stylesheet for every backdrop
 * in both themes rather than trusting the comment next to it.
 *
 * The MEASURE rule: `personalize.lightTitle` is 9 / 6 / 5 characters across
 * en-US / es-MX / pt-BR, so any plate sized to one locale's string clips
 * another's, and a truncated two-word control has no name at all.
 *
 * The TAP rule: 48 px authored, not 44. An anchored plate is scaled by its
 * distance from the camera, so a control authored at exactly the design floor
 * renders under it — which is what six of them were doing.
 */

// `process.cwd()` rather than `import.meta.url`: under jsdom the module URL is
// an http one and `fileURLToPath` refuses it. Vitest runs from `frontend/`.
const CSS = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

/** A `--lf-*: <number>` from the shipped stylesheet, so the test cannot drift from it. */
function cssNumber(name: string): number {
  const match = new RegExp(`--${name}:\\s*([0-9.]+)%?;`).exec(CSS);
  if (!match?.[1]) throw new Error(`no --${name} in index.css`);
  return Number.parseFloat(match[1]);
}

/** An `--lf-*: r g b;` triplet, from the `:root` block or the `.dark` block. */
function cssTriplet(name: string, dark: boolean): [number, number, number] {
  const block = dark ? CSS.slice(CSS.indexOf('.dark {')) : CSS;
  const match = new RegExp(`--${name}:\\s*(\\d+) (\\d+) (\\d+);`).exec(block);
  if (!match) throw new Error(`no --${name} in ${dark ? '.dark' : ':root'}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** WCAG relative luminance of an sRGB byte triplet. */
function luminance([r, g, b]: [number, number, number]): number {
  const channel = (byte: number) => {
    const c = byte / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: number, b: number): number {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

function mix(
  a: [number, number, number],
  b: [number, number, number],
  amountOfB: number,
): [number, number, number] {
  return [0, 1, 2].map((i) => a[i]! * (1 - amountOfB) + b[i]! * amountOfB) as [
    number,
    number,
    number,
  ];
}

describe('the Lumen contrast bound, re-derived from the shipped stylesheet', () => {
  const tint = cssNumber('lf-lumen-tint') / 100;

  /*
   * The two densities and the inks each one has to carry. `chrome` deliberately
   * does NOT carry `content-muted`: at 32% transmission it reads 3.6:1, which
   * is why /DESIGN.md prohibits a muted second line on in-world chrome rather
   * than closing the plate to make one legible.
   */
  const DENSITIES = [
    { name: 'chrome', alpha: cssNumber('lf-lumen-alpha'), inks: ['lf-content'] },
    { name: 'reading', alpha: cssNumber('lf-lumen-alpha-reading'), inks: ['lf-content', 'lf-content-muted'] },
  ] as const;

  /*
   * The worst case a moving render can produce. In light mode the plate is at
   * its darkest over pure black; in dark mode at its lightest over pure white.
   * Nothing in a 3D scene can be outside that, which is exactly why a bound
   * works where a measurement does not.
   */
  const WORST: Record<'light' | 'dark', [number, number, number]> = {
    light: [0, 0, 0],
    dark: [255, 255, 255],
  };

  for (const density of DENSITIES) {
    for (const theme of ['light', 'dark'] as const) {
      const dark = theme === 'dark';
      const surface = cssTriplet('lf-surface', dark);

      for (const backdrop of SCENE_BACKDROP_IDS) {
        const sky = hexToRgb(resolveBackdrop(backdrop, dark).sky);
        const fill = mix(surface, sky, tint);
        const background = luminance(mix(WORST[theme], fill, density.alpha));

        for (const token of density.inks) {
          it(`${density.name} carries ${token} at 4.5:1 in ${theme} under ${backdrop}`, () => {
            expect(contrast(luminance(cssTriplet(token, dark)), background)).toBeGreaterThanOrEqual(4.5);
          });
        }
      }
    }
  }

  it('keeps chrome genuinely translucent rather than an opaque plate wearing a glass name', () => {
    // The whole point of the bound is that it buys transmission. A "material"
    // at 0.95 is the opaque floor with extra steps.
    const chrome = DENSITIES[0].alpha;
    expect(chrome).toBeGreaterThan(0);
    expect(chrome).toBeLessThanOrEqual(0.7);
    expect(DENSITIES[1].alpha).toBeGreaterThan(chrome);
  });

  /*
   * THE FLAT FORM — what a plate becomes when there is no blur behind it, for
   * either of the two reasons there can be: a browser without
   * `backdrop-filter`, or a device the quality governor has demoted to `low`
   * (/DESIGN.md §Lumen → The blur, profiled). Both write the same token, and
   * this is the assertion that keeps the degraded path from becoming the
   * illegible path.
   *
   * Denser than either published density is a SUFFICIENT proof of the bound.
   * Compositing the worst backdrop toward the fill is monotonic in alpha, and
   * both published alphas already clear 4.5:1 above, so anything denser clears
   * it too — no separate derivation needed, and none that could quietly rot.
   */
  it('closes the plate when the blur is gone, rather than leaving it open and sharp', () => {
    const flat = cssNumber('lf-lumen-alpha-flat');
    expect(flat).toBeGreaterThanOrEqual(DENSITIES[1].alpha);
    expect(flat).toBeGreaterThan(DENSITIES[0].alpha);
    expect(flat).toBeLessThanOrEqual(1);
  });

  it('reaches that one form by both routes, writing one token rather than a rule per surface', () => {
    // The blur is ONE token, so there is one switch to throw rather than two
    // declarations that can disagree.
    expect(CSS).toMatch(/backdrop-filter:\s*var\(--lf-lumen-backdrop\);/);
    // The `low` tier's route. `StageShell` publishes the attribute; the
    // material reads it and the custom properties inherit to every plate.
    expect(CSS).toMatch(/\[data-lumen-blur='off'\]\s*\{[^}]*--lf-lumen-backdrop:\s*none;/);
    // Exactly two writers of the flat alpha: the unsupported-browser route and
    // the low-tier route. A third would be a second opinion about what a
    // blur-less plate looks like.
    expect(CSS.match(/--lf-lumen-alpha:\s*var\(--lf-lumen-alpha-flat\)/g)).toHaveLength(2);
    expect(CSS.match(/--lf-lumen-alpha-reading:\s*var\(--lf-lumen-alpha-flat\)/g)).toHaveLength(2);
  });

  it('refuses muted ink on chrome, which is the rule the density exists to state', () => {
    // Not an accident of the numbers: at the chrome alpha muted body text is
    // BELOW the floor, and /DESIGN.md prohibits it there for exactly that
    // reason. If this ever starts passing, the alpha was raised and the
    // material lost the transmission it was chosen for.
    const surface = cssTriplet('lf-surface', false);
    const sky = hexToRgb(resolveBackdrop('night', false).sky);
    const background = luminance(mix(WORST.light, mix(surface, sky, tint), DENSITIES[0].alpha));
    expect(contrast(luminance(cssTriplet('lf-content-muted', false)), background)).toBeLessThan(4.5);
  });
});

describe('HudPlate material', () => {
  it('is ONE surface: the words sit on the glass, not on a second opaque plate inside it', () => {
    const { container } = render(<HudPlate>Minutes left</HudPlate>);
    const frame = container.firstElementChild;
    const text = screen.getByText('Minutes left');

    expect(frame?.className).toContain('lf-lumen');
    // The inner box is layout only. An opaque fill there is the 2px lighter
    // ring that made every control read as a sticker on a photograph.
    expect(text.className).not.toContain('bg-surface');
    expect(text.className).not.toContain('bg-surface-sunken');
  });

  it('does not use the page material', () => {
    const { container } = render(<HudPlate>Minutes left</HudPlate>);
    // `.lf-glass` frosts a panel on a page that holds still. This one is over a
    // world that is relit four times a day.
    expect(container.firstElementChild?.className).not.toContain('lf-glass');
  });

  it('renders an action as a solid object rather than one more window onto the island', () => {
    const { container } = render(<HudPlate floor="accent">Begin</HudPlate>);
    expect(container.firstElementChild?.className).toContain('lf-lumen-solid');
    const text = screen.getByText('Begin');
    expect(text.className).toContain('bg-accent');
    expect(text.className).toContain('text-on-accent');
  });

  it('draws selection through the material, never through a ring utility', () => {
    const { container } = render(
      <HudPlate as="button" selected>
        Dusk
      </HudPlate>,
    );
    const frame = container.firstElementChild;
    expect(frame?.className).toContain('lf-lumen-selected');
    /*
     * `ring-2` writes `box-shadow`, and utilities outrank components — so a
     * chosen plate used to lose its edge, its specular lip and the shadow that
     * seats it in the scene at the exact moment it was meant to look more
     * present.
     */
    expect(frame?.className).not.toContain('ring-2');
  });

  it('settles rather than popping, on the plate and never on the anchored wrapper', () => {
    const { container } = render(<HudPlate>Minutes left</HudPlate>);
    // `ScreenAnchor` rewrites the wrapper's whole transform every frame; an
    // entrance declared there is erased sixty times a second.
    expect(container.firstElementChild?.className).toContain('lf-settle');
  });

  it('keeps the material on the frame even when the plate composes its own interior', () => {
    const { container } = render(
      <HudPlate floor="none">
        <svg data-ring="true" />
      </HudPlate>,
    );
    expect(container.querySelector('[data-ring="true"]')?.parentElement?.className).toContain(
      'lf-lumen',
    );
  });
});

describe('HudPlate shape', () => {
  it('is a pill, matching the design study (reversed 2026-09-05, owner direction)', () => {
    const { container } = render(<HudPlate shape="chip">Dusk</HudPlate>);
    /*
     * This used to assert the opposite: a quiet `rounded-md` pane, on the
     * theory that a capsule over a photographic frame reads as a sticker.
     * The owner's mandate for this route is the Stitch study verbatim, and
     * the study's own exit chip, live badge, stat pills and suggestion chips
     * are all full capsules — photographed against it three times, the
     * quiet-radius chip was named each time as part of "the same old button
     * configuration." See the shape rationale in `HudPlate.tsx`.
     */
    expect(container.firstElementChild?.className).toContain('rounded-full');
  });

  it('keeps the orb a circle, because it is an object rather than a label', () => {
    const { container } = render(<HudPlate shape="orb" floor="none" />);
    expect(container.firstElementChild?.className).toContain('rounded-full');
  });
});

describe('HudPlate measure', () => {
  // The real strings, at their real lengths, in all three shipped locales.
  const NO_COMPANION = ['Just us', 'Solo nosotros', 'So a gente'];

  it.each(NO_COMPANION)('renders "%s" in full, without truncation', (label) => {
    render(<HudPlate shape="chip">{label}</HudPlate>);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('wraps instead of truncating', () => {
    render(<HudPlate shape="chip">Solo nosotros</HudPlate>);
    const text = screen.getByText('Solo nosotros');

    expect(text.className).toContain('break-words');
    expect(text.className).toContain('whitespace-normal');
    // Any of these turns a 1.86x locale swing into a control with no name.
    expect(text.className).not.toContain('truncate');
    expect(text.className).not.toContain('text-ellipsis');
    expect(text.className).not.toContain('whitespace-nowrap');
  });

  it('sizes in ch against a viewport clamp, never in fixed pixels', () => {
    const { container } = render(<HudPlate shape="plate">Anything</HudPlate>);
    const frame = container.firstElementChild;
    // `ch` follows the rendered text, so the measure holds in a locale nobody
    // designed against; the vw half is what stops a long label pushing the
    // document wider than a 375px screen (§1.11).
    expect(frame?.className).toMatch(/max-w-\[min\(\d+ch,\d+vw\)\]/);
  });
});

describe('HudPlate element', () => {
  it('renders a real button when it is interactive, authored above the tap floor', () => {
    render(<HudPlate as="button">Pick this</HudPlate>);
    const button = screen.getByRole('button', { name: 'Pick this' });
    expect(button).toHaveAttribute('type', 'button');
    /*
     * 48, not 44. An anchored control is multiplied by its distance from the
     * camera; `ScreenAnchor` clamps that scale so the RENDERED box never goes
     * under 44, and authoring at 48 is what leaves the depth cue any room to
     * exist at all. Authored at 44 the clamp pins every chip to scale 1 and the
     * HUD loses its depth entirely.
     */
    expect(button.className).toContain('min-h-12');
    expect(button.className).toContain('min-w-12');
  });

  it('never leaks form-control attributes onto a plain plate', () => {
    const { container } = render(<HudPlate>Read only</HudPlate>);
    const frame = container.firstElementChild;
    expect(frame?.tagName).toBe('DIV');
    expect(frame?.hasAttribute('type')).toBe(false);
    expect(frame?.hasAttribute('disabled')).toBe(false);
  });
});
