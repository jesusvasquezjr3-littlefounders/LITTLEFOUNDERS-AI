import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RunningLedgerBoard, runningLedgerPilotDocument } from './RunningLedgerBoard';
import { loadLessonClientDocument } from './lessonDocument';

function documentFor(locale: 'en-US' | 'es-MX' | 'pt-BR', graded = false) {
  const raw = runningLedgerPilotDocument(locale) as { segments: Array<{ grading: string; payload: Record<string, unknown>; feedback?: { met: string; not_yet: string } }> };
  raw.segments[0]!.payload = { initial: 20, sale: 10, cost: 5, maxEntries: 4, personal: true, currency: 'local' };
  if (graded) { raw.segments[0]!.grading = 'server'; raw.segments[0]!.feedback = { met: 'You tracked each payment.', not_yet: 'Follow the payment direction.' }; }
  const parsed = loadLessonClientDocument(raw);
  if (parsed.status !== 'ready') throw new Error('Invalid personal ledger fixture');
  return parsed.document;
}

describe('a personal cashbook uses receiving and paying, not business sales and supplies', () => {
  it.each([
    ['en-US', 'Receive', 'Pay', 'dollars'], ['es-MX', 'Recibir', 'Pagar', 'pesos'], ['pt-BR', 'Receber', 'Pagar', 'reais'],
  ] as const)('shows the actual personal-money operations in %s', (locale, receive, pay, unit) => {
    const document = documentFor(locale);
    const segment = document.segments[0]!;
    if (segment.type !== 'money.running-ledger.v2') throw new Error('Wrong fixture');
    render(<RunningLedgerBoard document={document} segment={segment} onBack={() => {}} />);
    expect(screen.getByRole('button', { name: `${receive} +10 ${unit}` })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: `${pay} −5 ${unit}` }));
    expect(screen.getAllByText(`15 ${unit}`).length).toBeGreaterThan(0);
  });
  it('removes the passing verdict when the learner undoes the graded transaction', async () => {
    const document = documentFor('en-US', true);
    const segment = document.segments[0]!;
    if (segment.type !== 'money.running-ledger.v2') throw new Error('Wrong fixture');
    render(<RunningLedgerBoard document={document} segment={segment} onBack={() => {}} onGrade={async () => ({ verdict: 'met' })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Receive +10 dollars' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Balance' }), { target: { value: '30' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Check' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await screen.findByText('You tracked each payment.');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.queryByText('You tracked each payment.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
  });
});
