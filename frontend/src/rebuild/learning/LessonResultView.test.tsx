import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LessonResultView, lessonCompletionReceiptSchema } from './LessonResultView';

const receipt = {
  schema_version: 2, completion_id: 'sample-completion-1', lesson_id: 'pilot-savings-sequence', version_id: 'rev-1',
  locale: 'es-MX', first_try_correct: 3, graded_count: 4, awarded_xp: 40, duration_seconds: 200, previous_best_percent: 60,
};

describe('lesson result receipt boundary', () => {
  it('renders result statistics from a valid receipt and identifies a preview fixture', () => {
    const onContinue = vi.fn();
    render(<LessonResultView rawReceipt={receipt} locale="es-MX" onContinue={onContinue} fixture />);
    expect(screen.getByRole('heading', { name: '¡Lección terminada!' })).toBeTruthy();
    expect(screen.getByText('Resultado de ejemplo')).toBeTruthy();
    expect(screen.getByText('3/4 al primer intento.')).toBeTruthy();
    expect(screen.getAllByText('75%')).toHaveLength(3);
    expect(screen.getByText('3:20')).toBeTruthy();
    expect(screen.getByText('Nueva mejor marca')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Hoy' }).getAttribute('aria-valuenow')).toBe('75');
    expect(screen.getByRole('progressbar', { name: 'Mejor' }).getAttribute('aria-valuenow')).toBe('75');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('refuses malformed, inconsistent, answer-bearing and wrong-locale receipts', () => {
    for (const value of [{ ...receipt, graded_count: 2 }, { ...receipt, answer_key: '7' }, { ...receipt, awarded_xp: -1 },
      { ...receipt, schema_version: 3 }, { ...receipt, locale: 'en-US' }]) {
      const { unmount } = render(<LessonResultView rawReceipt={value} locale="es-MX" onContinue={() => {}} />);
      expect(screen.getByRole('heading', { name: 'Resultado no disponible' })).toBeTruthy();
      expect(screen.queryByText('XP ganados')).toBeNull();
      unmount();
    }
    expect(lessonCompletionReceiptSchema.safeParse(receipt).success).toBe(true);
  });

  it.each([
    ['en-US', 'Saved best: 100%. This replay was practice.'],
    ['es-MX', 'Mejor marca guardada: 100%. Solo fue práctica.'],
    ['pt-BR', 'Recorde salvo: 100%. Esta repetição foi prática.'],
  ] as const)('explains preserved progress after a lower %s replay', (locale, message) => {
    const { unmount } = render(<LessonResultView rawReceipt={{ ...receipt, locale, first_try_correct: 2, previous_best_percent: 100 }}
      locale={locale} onContinue={() => {}} />);
    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.queryByText(/2\/4/)).toBeNull();
    expect(screen.getByRole('progressbar', { name: locale === 'en-US' ? 'Best' : locale === 'es-MX' ? 'Mejor' : 'Recorde' })
      .getAttribute('aria-valuenow')).toBe('100');
    unmount();
  });
});
