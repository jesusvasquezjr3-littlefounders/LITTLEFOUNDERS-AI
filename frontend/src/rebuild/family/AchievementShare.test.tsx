import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import en from '../../i18n/en-US/rebuild.json';
import es from '../../i18n/es-MX/rebuild.json';
import pt from '../../i18n/pt-BR/rebuild.json';
import { AchievementShare, type AchievementShareStatus } from './AchievementShare';

/*
 * F.3 under OD-20: the disclosure is un-buried (beside the button, linked by
 * aria-describedby) and names the image flow's real mechanics in every
 * locale; every string declares its copy role; the action never celebrates.
 */

describe('AchievementShare', () => {
  it('binds the disclosure to the button and states the image-flow facts', () => {
    const onShare = vi.fn();
    render(<AchievementShare copy={en.achievementShare} locale="en-US" dark={false} status="idle" onShare={onShare} />);
    const button = screen.getByRole('button', { name: 'Share achievement' });
    const description = document.getElementById(button.getAttribute('aria-describedby') ?? '');
    expect(description?.textContent).toContain('No link is made.');
    expect(description?.textContent).toContain('first name');
    expect(description?.textContent).toContain('can keep it');
    expect(description?.textContent).toContain('LittleFounders');
    fireEvent.click(button);
    expect(onShare).toHaveBeenCalledOnce();
  });

  it('never mentions a link that anyone can open, an expiry or a revoke in any locale', () => {
    for (const copy of [en.achievementShare, es.achievementShare, pt.achievementShare]) {
      const text = Object.values(copy).join(' ');
      expect(text).not.toMatch(/30|expir|caduc|revo|anyone with the link/i);
    }
  });

  it('announces each state and disables the button while preparing', () => {
    const states: [AchievementShareStatus, string | null, string][] = [
      ['preparing', 'Making the picture…', 'status'],
      ['shared', 'Picture shared.', 'status'],
      ['downloaded', 'Picture saved to your device.', 'status'],
      ['failed', 'Could not make the picture. Try again.', 'alert'],
      ['cancelled', null, 'status'],
    ];
    for (const [status, text, role] of states) {
      const { unmount } = render(<AchievementShare copy={en.achievementShare} locale="en-US" dark status={status} onShare={() => undefined} />);
      const region = screen.getByRole(role);
      expect(region.textContent).toBe(text ?? '');
      expect(screen.getByRole('button').hasAttribute('disabled')).toBe(status === 'preparing');
      unmount();
    }
  });

  it('uses the goal label for a reached savings goal', () => {
    render(<AchievementShare copy={pt.achievementShare} locale="pt-BR" dark={false} variant="goal" status="idle" onShare={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Compartilhar meta' })).toBeTruthy();
  });

  it('declares a copy role on every string and sets theme and language', () => {
    const { container } = render(<AchievementShare copy={es.achievementShare} locale="es-MX" dark status="downloaded" onShare={() => undefined} />);
    const section = container.querySelector('section')!;
    expect(section.getAttribute('data-theme')).toBe('dark');
    expect(section.getAttribute('lang')).toBe('es-MX');
    for (const node of container.querySelectorAll('p, button')) expect(node.getAttribute('data-copy-role')).toBeTruthy();
    expect(container.querySelector('[class*="confetti"], canvas')).toBeNull();
  });
});
