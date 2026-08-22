import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HudPlate } from '../HudPlate';

/*
 * HudPlate carries two rules that cannot be left to memory, because both fail
 * silently and both fail only for someone other than the person who built it.
 *
 * The contrast rule: text on `.lf-glass` over a moving 3D island has no second
 * colour to compute a ratio against, so every word must sit on an opaque token.
 * The measure rule: `personalize.lightTitle` is 9 / 6 / 5 characters across
 * en-US / es-MX / pt-BR, so any plate sized to one locale's string clips
 * another's, and a truncated two-word control has no name at all.
 */

describe('HudPlate contrast floor', () => {
  it('puts body text on an OPAQUE token, never on the glass itself', () => {
    render(<HudPlate>Minutes left</HudPlate>);
    const text = screen.getByText('Minutes left');

    expect(text.className).toContain('bg-surface');
    // The glass is the frame. If the text node ever carries it directly, the
    // effective background becomes 22% whatever the camera is pointing at.
    expect(text.className).not.toContain('lf-glass');
  });

  it('keeps the glass frame on the outer element', () => {
    const { container } = render(<HudPlate>Minutes left</HudPlate>);
    const frame = container.firstElementChild;
    expect(frame?.className).toContain('lf-glass');
  });

  it('offers an accent floor that is still an opaque token', () => {
    render(<HudPlate floor="accent">Begin</HudPlate>);
    const text = screen.getByText('Begin');
    expect(text.className).toContain('bg-accent');
    expect(text.className).toContain('text-on-accent');
  });

  it('skips the floor only for chrome that carries no words', () => {
    const { container } = render(
      <HudPlate floor="none">
        <svg data-ring="true" />
      </HudPlate>,
    );
    expect(container.querySelector('[data-ring="true"]')?.parentElement?.className).toContain(
      'lf-glass',
    );
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
  it('renders a real button when it is interactive, with a safe default type', () => {
    render(<HudPlate as="button">Pick this</HudPlate>);
    const button = screen.getByRole('button', { name: 'Pick this' });
    expect(button).toHaveAttribute('type', 'button');
    // The a11y floor: 44x44 minimum, on a control that is often over scenery.
    expect(button.className).toContain('min-h-11');
    expect(button.className).toContain('min-w-11');
  });

  it('never leaks form-control attributes onto a plain plate', () => {
    const { container } = render(<HudPlate>Read only</HudPlate>);
    const frame = container.firstElementChild;
    expect(frame?.tagName).toBe('DIV');
    expect(frame?.hasAttribute('type')).toBe(false);
    expect(frame?.hasAttribute('disabled')).toBe(false);
  });
});
