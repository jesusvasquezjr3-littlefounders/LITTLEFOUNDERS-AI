import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MentorStageProps } from '../../MentorStage';
import { mentorCopy } from '../MentorRoute';
import { MentorScreenPreview } from '../MentorScreenPreview';

/*
 * GAP-FIX-R5 (Bible 08 §10 item 5, 06 §7, 02 §7 item 10): the audits can only
 * measure a state the preview can open. The OD-28 recap's 'Finish now' chip
 * and the start-over ConfirmDialog now open from the URL, only in a
 * conversation (where the real screen offers them).
 */
vi.mock('../../MentorStage', async (original) => ({
  ...(await original<typeof import('../../MentorStage')>()),
  MentorStage: (props: MentorStageProps) => <div data-testid="stage" data-state={props.state} />,
}));

const t = mentorCopy('en-US').mentorScreen;
const show = (query: string) => render(<MentorScreenPreview locale="en-US" theme="light" ageBand="6-9" params={new URLSearchParams(query)} />);

describe('MentorScreenPreview openers for the audit states', () => {
  it('opens the recap with its one Finish now chip in a conversation', () => {
    const view = show('state=conversing&recap=1');
    expect(view.container.querySelector('[data-finish-now]')).toHaveTextContent(t.finishNow);
  });

  it('opens the start-over ConfirmDialog in a conversation', () => {
    show('state=conversing&dialog=start-over');
    expect(screen.getByRole('alertdialog', { name: t.startOverHeading })).toBeInTheDocument();
  });

  it('opens neither outside a conversation, and neither by default', () => {
    const openings = show('state=openings&recap=1&dialog=start-over');
    expect(openings.container.querySelector('[data-finish-now]')).toBeNull();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    openings.unmount();
    const plain = show('state=conversing');
    expect(plain.container.querySelector('[data-finish-now]')).toBeNull();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
