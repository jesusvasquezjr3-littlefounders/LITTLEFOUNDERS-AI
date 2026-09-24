import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LessonEligibilityStateView } from './LessonEligibilityStateView';

describe('lesson eligibility state', () => {
  it('gives an age-evidence refusal a task-scoped, reversible explanation', () => {
    const onBack = vi.fn();
    render(<LessonEligibilityStateView state="required" locale="es-MX" onBack={onBack} />);
    expect(screen.getByRole('heading', { name: 'Necesitamos tus datos de edad' })).toBeTruthy();
    expect(screen.queryByText(/cuenta la tiene que crear/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
