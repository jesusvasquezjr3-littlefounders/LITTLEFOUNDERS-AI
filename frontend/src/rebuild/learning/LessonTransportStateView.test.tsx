import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { checkCopy, type Locale } from '../design/copyBudget';
import { LessonTransportStateView, lessonTransportCopy, type LessonTransportState } from './LessonTransportStateView';

const STATES: LessonTransportState[] = ['opening', 'offline', 'load-error', 'placement', 'locked', 'prerequisite', 'not-found'];

describe('lesson transport and refusal states (W2L.3)', () => {
  it('offers a retry only where one can help, and always the way back', () => {
    for (const state of STATES) {
      const onBack = vi.fn();
      const view = render(<LessonTransportStateView state={state} locale="en-US" onBack={onBack} onRetry={vi.fn()} />);
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(!!screen.queryByRole('button', { name: 'Try again' })).toBe(state === 'offline' || state === 'load-error');
      fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
      expect(onBack).toHaveBeenCalledOnce();
      view.unmount();
    }
  });

  it('keeps every state within the youngest copy budget in all three locales, in the glossary', () => {
    const found: string[] = [];
    for (const locale of ['en-US', 'es-MX', 'pt-BR'] as Locale[]) for (const state of STATES) {
      const t = lessonTransportCopy[locale][state];
      const strings: Array<[string, 'heading' | 'body' | 'action']> = [[t.heading, 'heading'], [t.body, 'body'], [t.back, 'action'], ...(t.retry ? [[t.retry, 'action'] as [string, 'action']] : [])];
      for (const [text, role] of strings) {
        for (const issue of checkCopy(text, role, { locale, ageBand: '6-9', surface: 'app' })) found.push(`${locale} ${state} ${role}: ${issue}`);
        // B.26: task-scoped, no blame, no lives; the AI is never the Tutor; no em dash.
        if (/\bTutor\b|\blives?\b|\bvidas?\b|fail|wrong|—/i.test(text)) found.push(`${locale} ${state}: ${text}`);
      }
    }
    expect(found).toEqual([]);
  });
});
