import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { divisionLayoutFor, LongArithmeticLayout } from './LongArithmeticLayout';
import { LessonDocumentView } from './LessonDocumentView';
import { workedExamplePilotDocument } from './WorkedExampleBoard';

/* GAP-FIX-R1 learning (Appendix P Part 1 M9, Part 5): locale layouts and the locale number echo. */

vi.mock('../../tutor-scene/quality', () => ({ getDeviceProbe: () => ({ webgl: 'webgl2' }), pickInitialTier: () => 'medium' }));
vi.mock('../../tutor-scene/TutorStage', () => ({ TutorStage: () => <div /> }));

const division = { kind: 'long-division' as const, dividend: 156, divisor: 12, steps: [{ digit: 1, product: 12, remainder: 3 }, { digit: 3, product: 36, remainder: 0 }] };

describe('M9 long division layouts', () => {
  it('chooses the bracket, the casita and the chave by locale profile', () => {
    expect(divisionLayoutFor('en-US')).toBe('bracket');
    expect(divisionLayoutFor('es-MX')).toBe('casita');
    expect(divisionLayoutFor('pt-BR')).toBe('chave');
  });

  it('draws each market layout, reveals steps one at a time and names the result', () => {
    const { rerender, container } = render(<LongArithmeticLayout algorithm={division} locale="en-US" revealed={1} />);
    expect(container.querySelector('[data-layout="bracket"]')).toBeTruthy();
    expect(screen.getByRole('img').getAttribute('aria-label')).toContain('quotient ?');
    rerender(<LongArithmeticLayout algorithm={division} locale="es-MX" revealed={2} />);
    // The casita writes remainders only.
    expect(container.querySelector('.lf-long-product')).toBeNull();
    expect(screen.getByRole('img').getAttribute('aria-label')).toBe('156 entre 12: cociente 13, residuo 0.');
    rerender(<LongArithmeticLayout algorithm={division} locale="pt-BR" revealed={2} />);
    expect(container.querySelector('[data-layout="chave"] .lf-long-chave-right .lf-long-quotient')?.textContent).toBe('13');
  });
});

describe('worked example locale numbers', () => {
  it('echoes the parsed value and submits the canonical decimal for pt-BR input', async () => {
    const onGradeWorkedExample = vi.fn(async () => 'met' as const);
    render(<LessonDocumentView raw={workedExamplePilotDocument('pt-BR', 2)} locale="pt-BR" ageBand="10-12" onBack={() => {}} onGradeWorkedExample={onGradeWorkedExample} />);
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0]!, { target: { value: '40,0' } });
    expect(screen.getByText('Lê-se 40')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar próxima etapa' }));
    fireEvent.change(screen.getAllByRole('textbox').at(-1)!, { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar próxima etapa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Conferir' }));
    await waitFor(() => expect(onGradeWorkedExample).toHaveBeenCalledWith({ values: { 'discount-subtract': '40', 'sale-price': '40' } }, 'worked-example-01', expect.anything()));
  });
});
