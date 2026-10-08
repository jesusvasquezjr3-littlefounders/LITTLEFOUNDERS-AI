import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PercentGridBoard, percentGridPilotDocument } from './PercentGridBoard';
import { loadLessonClientDocument } from './lessonDocument';

describe('percent-grid evidence belongs to the submitted state', () => {
  it('clears a passing verdict when resetting the percentage', async () => {
    const raw = percentGridPilotDocument('en-US', '10-12') as { segments: Array<{ grading: string; feedback?: { met: string; not_yet: string } }> };
    raw.segments[0]!.grading = 'server';
    raw.segments[0]!.feedback = { met: 'The share matches the requested percentage.', not_yet: 'Check the share of the whole.' };
    const parsed = loadLessonClientDocument(raw);
    if (parsed.status !== 'ready') throw new Error('Invalid percent fixture');
    const document = parsed.document;
    const segment = document.segments[0]!;
    if (segment.type !== 'visual.percent-grid.v2') throw new Error('Wrong segment');
    render(<PercentGridBoard document={document} segment={segment} onBack={() => {}} onGrade={async () => ({ verdict: 'met' })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Change percent: More' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Discount' }), { target: { value: '25' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Check' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    await screen.findByText('The share matches the requested percentage.');
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.queryByText('The share matches the requested percentage.')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Discount' })).toBeEnabled();
  });
});
