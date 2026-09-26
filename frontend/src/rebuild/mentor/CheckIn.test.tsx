import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CheckInChoice, type CheckInCopy } from './CheckIn';
import { checkCopy, type Locale } from '../design/copyBudget';
import en from '@/i18n/en-US/rebuild.json';
import es from '@/i18n/es-MX/rebuild.json';
import pt from '@/i18n/pt-BR/rebuild.json';

/*
 * C.19 on the stage: the check-in is a Mentor turn with two EQUAL reply
 * chips, never a modal and never a default. The chips are option controls
 * within the youngest band's budget in every locale, and nothing names a
 * feeling.
 */

const COPIES: Record<Locale, CheckInCopy> = {
  'en-US': en.mentorCheckIn,
  'es-MX': es.mentorCheckIn,
  'pt-BR': pt.mentorCheckIn,
};

describe('CheckInChoice — two equal reply chips', () => {
  it('offers both answers with the same weight and reports which was chosen', () => {
    const onAnswer = vi.fn();
    render(<CheckInChoice copy={en.mentorCheckIn} locale="en-US" dark={false} onAnswer={onAnswer} />);
    const group = screen.getByRole('group', { name: en.mentorCheckIn.choiceLabel });
    const chips = group.querySelectorAll('button');
    expect(chips).toHaveLength(2);
    // Same control and variant: neither is the highlighted default.
    expect(chips[0]!.className).toBe(chips[1]!.className);
    for (const chip of chips) {
      expect(chip).toHaveAttribute('data-copy-role', 'option');
      expect(chip).not.toHaveAttribute('autofocus');
      expect(chip).not.toHaveAttribute('aria-pressed');
    }
    fireEvent.click(screen.getByRole('button', { name: en.mentorCheckIn.misaligned }));
    expect(onAnswer).toHaveBeenLastCalledWith(false);
    fireEvent.click(screen.getByRole('button', { name: en.mentorCheckIn.aligned }));
    expect(onAnswer).toHaveBeenLastCalledWith(true);
    // Not a modal: no dialog role, no focus trap.
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).not.toBe(chips[0]);
  });

  it('disables both chips together while an answer is in flight, in either theme', () => {
    render(<CheckInChoice copy={es.mentorCheckIn} locale="es-MX" dark disabled onAnswer={vi.fn()} />);
    for (const chip of screen.getAllByRole('button')) expect(chip).toBeDisabled();
    const section = document.querySelector('[data-screen="mentor-check-in"]')!;
    expect(section).toHaveAttribute('data-theme', 'dark');
    expect(section).toHaveAttribute('lang', 'es-MX');
  });

  it.each(Object.entries(COPIES))('fits the Copy Budget and names no feeling in %s', (locale, copy) => {
    for (const text of [copy.aligned, copy.misaligned]) {
      expect(checkCopy(text, 'option', { locale: locale as Locale, ageBand: '6-9', surface: 'app' })).toEqual([]);
      expect(text).not.toMatch(/feel|sad|upset|bored|confus|frustr|sient|triste|aburr|sente|chatead/i);
    }
    expect(checkCopy(copy.choiceLabel, 'body', { locale: locale as Locale, ageBand: '6-9', surface: 'app' })).toEqual([]);
  });
});
