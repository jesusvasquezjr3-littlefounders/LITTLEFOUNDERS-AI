import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { checkCopy, type Locale } from '../design/copyBudget';
import { LessonEligibilityStateView, type LessonEligibilityState } from './LessonEligibilityStateView';

describe('lesson eligibility state', () => {
  it('gives an age-evidence refusal a task-scoped, reversible explanation', () => {
    const onBack = vi.fn();
    render(<LessonEligibilityStateView state="required" locale="es-MX" onBack={onBack} />);
    expect(screen.getByRole('heading', { name: 'Necesitamos tus datos de edad' })).toBeTruthy();
    expect(screen.queryByText(/cuenta la tiene que crear/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('keeps every state within its copy budget in all three locales (06 §3; found over budget by the S03.5 route audit)', () => {
    const found: string[] = [];
    for (const locale of ['en-US', 'es-MX', 'pt-BR'] as Locale[]) for (const state of ['required', 'restricted', 'unavailable'] as LessonEligibilityState[]) {
      const view = render(<LessonEligibilityStateView state={state} locale={locale} onBack={vi.fn()} />);
      for (const element of view.container.querySelectorAll<HTMLElement>('[data-copy-role]')) {
        const role = element.dataset.copyRole as 'heading' | 'body';
        for (const issue of checkCopy(element.textContent ?? '', role, { locale, ageBand: '6-9', surface: 'app' })) found.push(`${locale} ${state} ${role}: ${issue}`);
      }
      for (const button of view.container.querySelectorAll('button')) for (const issue of checkCopy(button.textContent ?? '', 'action', { locale, ageBand: '6-9', surface: 'app' })) found.push(`${locale} ${state} action: ${issue}`);
      view.unmount();
    }
    expect(found).toEqual([]);
  });
});
