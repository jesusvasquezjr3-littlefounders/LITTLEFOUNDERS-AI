import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { rebuildNamespaceCopy } from '@/i18n/rebuild';
import { ChildMentorTalks } from './ChildMentorTalks';
import {
  dispositionWire, FAMILY, fakeTransport, GOAL_BOARD, historyWire, KID_A, KID_B, micWire, notesWire, ok, refuse, SESSION_A, SESSION_B, sessionWire, transcriptWire, YOUR_TURN_BOARD, type Answer,
} from './consoleFixtures';

/*
 * W2F.1 F3: a child's Mentor talks through the verified Tutor's eyes. The
 * invariants of the legacy guardian page, carried over from its adversarial
 * reviews: flags first and most severe first across both provenances; a
 * course-choice flag says it has no talk to open; the full transcript with
 * the activities in order and no answer key; honest session lengths and
 * endings; load-more appends and survives a failure; another child's flags
 * never linger; the approval gate on the Mentor's note tells applied, out of
 * date and failed apart; the disposition profile for the child audience.
 */

const family = rebuildNamespaceCopy['en-US'].family;
const copy = family.familyChildMentor;
const notes = family.familyMemoryNotes;
const profile = rebuildNamespaceCopy['en-US'].mentor.mentorProfile;
const boardCopy = rebuildNamespaceCopy['en-US'].mentor.mentorScreen.board;

function routesFor(kid: string, over: Record<string, Answer> = {}): Record<string, Answer> {
  return {
    [`GET /tutor/kids/${kid}/sessions`]: ok(historyWire()),
    [`GET /tutor/kids/${kid}/memory-proposals`]: ok(notesWire({ proposals: [] })),
    [`GET /tutor/consent/${kid}`]: ok(micWire()),
    [`GET /tutor/kids/${kid}/disposition`]: ok(dispositionWire),
    [`GET /tutor/kids/${kid}/plan`]: ok({ plan: null }),
    [`GET /tutor/kids/${kid}/notebook`]: ok({ entries: [] }),
    [`GET /tutor/sessions/${SESSION_A}`]: ok(transcriptWire(SESSION_A)),
    [`GET /tutor/sessions/${SESSION_B}`]: ok(transcriptWire(SESSION_B)),
    ...over,
  };
}

function setup(over: Record<string, Answer> = {}, kid = KID_A) {
  const transport = fakeTransport({ 'GET /family/kids': ok({ kids: FAMILY }), ...routesFor(KID_A), ...routesFor(KID_B), ...over });
  const props = { copy, notesCopy: notes, consentCopy: family.familyChildConsent, profileCopy: profile, boardCopy, locale: 'en-US' as const, dark: false, transport,
    backHref: `/family?child=${kid}`, onNavigate: vi.fn() };
  const view = render(<ChildMentorTalks {...props} kidId={kid} />);
  return { transport, view, rerender: (next: string) => view.rerender(<ChildMentorTalks {...props} kidId={next} />) };
}

const flagsCard = () => screen.getByRole('heading', { name: copy.flagsTitle }).closest('section')!;

describe('ChildMentorTalks (F3): what needs the Tutor first', () => {
  it('lists every flag most severe first across both provenances, each with its severity in words', async () => {
    setup();
    await screen.findByRole('heading', { level: 1, name: "Sofía's Mentor talks" });
    const items = [...flagsCard().querySelectorAll('li[data-severity]')];
    expect(items.map((item) => item.getAttribute('data-severity'))).toEqual(['high', 'medium', 'low']);
    expect(within(items[0] as HTMLElement).getByText(copy.high)).toBeInTheDocument();
    expect(within(items[0] as HTMLElement).getByText(copy.category.self_harm)).toBeInTheDocument();
    expect(within(items[2] as HTMLElement).getByText(copy.low)).toBeInTheDocument();
  });

  it('says a course-choice flag has no talk to open, and offers no Read for it', async () => {
    setup();
    await screen.findByRole('heading', { name: copy.flagsTitle });
    const placement = flagsCard().querySelector('li[data-flag-source="placement"]') as HTMLElement;
    expect(within(placement).getByText(copy.fromPlacement)).toBeInTheDocument();
    expect(within(placement).queryByRole('button')).toBeNull();
  });

  it('shows the flags card when the only flags came from choosing a course', async () => {
    setup({ [`GET /tutor/kids/${KID_A}/sessions`]: ok(historyWire({ safetyFlags: [] })) });
    expect(await screen.findByRole('heading', { name: copy.flagsTitle })).toBeInTheDocument();
  });

  it('opens the flagged talk at the flagged moment, even when that talk is not in the recent list', async () => {
    const { transport } = setup();
    await screen.findByRole('heading', { name: copy.flagsTitle });
    const high = flagsCard().querySelector('li[data-severity="high"]') as HTMLElement;
    fireEvent.click(within(high).getByRole('button', { name: copy.read }));
    const flagged = await within(high).findByText('Let me show you with coins.');
    expect(flagged.closest('li')).toHaveAttribute('data-flagged', 'true');
    expect(within(flagged.closest('li') as HTMLElement).getByText(`Mentor · ${copy.flagged}`)).toBeInTheDocument();
    expect(transport.calls.some((call) => call.path === `/tutor/sessions/${SESSION_B}`)).toBe(true);
  });

  it('never shows the previous child\'s flags while the next child loads', async () => {
    let release: (value: ReturnType<typeof ok>) => void = () => {};
    const { rerender } = setup({ [`GET /tutor/kids/${KID_B}/sessions`]: () => new Promise((resolve) => { release = resolve; }) });
    await screen.findByRole('heading', { name: copy.flagsTitle });
    rerender(KID_B);
    await waitFor(() => expect(screen.queryByRole('heading', { name: copy.flagsTitle })).toBeNull());
    expect(screen.getByText(copy.loading)).toBeInTheDocument();
    await act(async () => { release(ok(historyWire({ safetyFlags: [], placementSafetyFlags: [] }))); });
    await screen.findByRole('heading', { level: 1, name: "Mateo's Mentor talks" });
    expect(screen.queryByRole('heading', { name: copy.flagsTitle })).toBeNull();
  });
});

describe('ChildMentorTalks (F3): the talks', () => {
  const sessionsSection = () => screen.getByRole('heading', { name: copy.sessionsTitle }).closest('section')!;

  it('reads a talk in full: lines, the activity between them with its score and no answer key, the drawn board and the tray steps', async () => {
    setup();
    await screen.findByRole('heading', { name: copy.sessionsTitle });
    fireEvent.click(within(sessionsSection()).getByRole('button', { name: copy.read }));
    await within(sessionsSection()).findByText('Hi! Want to plan a goal?');
    const transcript = sessionsSection().querySelector('[data-console-part="transcript"]') as HTMLElement;
    const kinds = [...transcript.querySelectorAll(':scope > li')].map((li) => li.getAttribute('data-speaker'));
    expect(kinds).toEqual(['mentor', 'child', 'activity', 'mentor', 'note']);
    expect(within(transcript).getByText('How many more coins?')).toBeInTheDocument();
    expect(within(transcript).getByText('Scored 80 of 100 · 12 XP')).toBeInTheDocument();
    // The board is drawn by the Mentor lane's renderer, titled by its caption, with its figures written.
    const goal = transcript.querySelector('[data-console-part="board"][data-board-kind="goal_bar"]') as HTMLElement;
    expect(within(goal).getByRole('heading', { level: 4, name: 'Board: Bike: 5 of 20' })).toBeInTheDocument();
    expect(within(goal).getByText('Bike')).toBeInTheDocument();
    expect(within(goal).getByText('15')).toBeInTheDocument();
    // A class II board is read-only for the Tutor: every value written, no control to act on it.
    const turn = transcript.querySelector('[data-console-part="board"][data-board-kind="your_turn"]') as HTMLElement;
    expect(turn.querySelector('[data-board-read-only="true"]')).not.toBeNull();
    expect(within(turn).queryByRole('button', { name: boardCopy.showNext })).toBeNull();
    // The shared Pizarrón picture describes every step (none held back as the learner's turn); the table is one press away.
    const picture = within(turn).getByRole('img').getAttribute('aria-label') ?? '';
    for (const value of ['10', '15', '20', '25']) expect(picture).toMatch(new RegExp(`: ${value}(\.|$)`));
    expect(within(transcript).getByText(/^The Mentor showed: \+10 and -5$/)).toBeInTheDocument();
    expect(within(transcript).getByText('Sofía')).toBeInTheDocument();
    expect(transcript.textContent).not.toMatch(/answer_hidden|answer key/i);
  });

  it('says a talk is still going instead of "0 messages", and gives the real count once it ends', async () => {
    setup({ [`GET /tutor/kids/${KID_A}/sessions`]: ok(historyWire({ safetyFlags: [], placementSafetyFlags: [], sessions: [
      sessionWire({ id: 'live', endedAt: null, closeReason: null, turnCount: 0, narrative: null }),
      sessionWire({ id: 'done', turnCount: 14 }),
    ] })) });
    await screen.findByRole('heading', { name: copy.sessionsTitle });
    expect(within(sessionsSection()).getByText(new RegExp(copy.ongoing))).toBeInTheDocument();
    expect(within(sessionsSection()).queryByText(/0 messages/)).toBeNull();
    expect(within(sessionsSection()).getByText(/14 messages/)).toBeInTheDocument();
  });

  it('adds nothing for an ordinary ending and says how any other talk ended', async () => {
    setup({ [`GET /tutor/kids/${KID_A}/sessions`]: ok(historyWire({ safetyFlags: [], placementSafetyFlags: [], sessions: [
      sessionWire({ id: 's1', closeReason: 'completed' }), sessionWire({ id: 's2', closeReason: 'error' }), sessionWire({ id: 's3', closeReason: 'brand_new_reason' }),
    ] })) });
    await screen.findByRole('heading', { name: copy.sessionsTitle });
    expect(screen.getByText(copy.closeReason.error)).toBeInTheDocument();
    expect(screen.getByText(copy.closeReason.other)).toBeInTheDocument();
    expect(screen.queryByText(/completed/)).toBeNull();
  });

  it('turns the structured narrative into whole sentences, and shows no score while a talk is open', async () => {
    setup({ [`GET /tutor/kids/${KID_A}/sessions`]: ok(historyWire({ safetyFlags: [], placementSafetyFlags: [], sessions: [
      sessionWire({ id: 'one', narrative: { topics: ['saving'], struggledTopic: null, struggleResolved: false, gradedCorrect: 3, gradedTotal: 4 } }),
      sessionWire({ id: 'two', narrative: { topics: ['saving', 'sharing'], struggledTopic: 'sharing', struggleResolved: true, gradedCorrect: null, gradedTotal: null } }),
      sessionWire({ id: 'three', narrative: { topics: [], struggledTopic: 'goals', struggleResolved: false, gradedCorrect: 1, gradedTotal: 2 } }),
      sessionWire({ id: 'four', narrative: null }),
    ] })) });
    await screen.findByRole('heading', { name: copy.sessionsTitle });
    expect(screen.getAllByText('Practiced saving.')).toHaveLength(1);
    expect(screen.getByText('3 of 4 activities right.')).toBeInTheDocument();
    expect(screen.getByText('Practiced saving and sharing.')).toBeInTheDocument();
    expect(screen.getByText('Found sharing tricky, then worked it out.')).toBeInTheDocument();
    expect(screen.getByText('Still working on goals.')).toBeInTheDocument();
    expect(screen.getAllByText(/activities right/)).toHaveLength(2);
  });

  it('loads older talks only while Core reports more, appends them, and survives a failed page', async () => {
    let calls = 0;
    const { transport } = setup({
      [`GET /tutor/kids/${KID_A}/sessions`]: ok(historyWire({ hasMore: true })),
      [`GET /tutor/kids/${KID_A}/sessions?offset=1`]: () => (++calls === 1 ? refuse('DATA_UNAVAILABLE')
        : ok(historyWire({ hasMore: false, sessions: [sessionWire({ id: 'older', intent: 'faq' })] }))),
    });
    const more = await screen.findByRole('button', { name: copy.more });
    fireEvent.click(more);
    expect(await screen.findByText(copy.moreFailed)).toBeInTheDocument();
    expect(screen.getByText(copy.intent.course_topic)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: copy.more }));
    await screen.findByText(copy.intent.faq);
    expect(screen.getByText(copy.intent.course_topic)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: copy.more })).toBeNull();
    expect(transport.calls.filter((call) => call.path.endsWith('?offset=1'))).toHaveLength(2);
  });

  it('states the retention period and the empty state', async () => {
    setup({ [`GET /tutor/kids/${KID_A}/sessions`]: ok(historyWire({ sessions: [], safetyFlags: [], placementSafetyFlags: [] })) });
    expect(await screen.findByText(copy.empty)).toBeInTheDocument();
    expect(screen.getByText(copy.retention)).toBeInTheDocument();
  });
});

describe('ChildMentorTalks (F3): the note, the profile, the kept boards, the states', () => {
  it('shows the note in force and marks an out-of-date suggestion before anyone taps', async () => {
    setup({ [`GET /tutor/kids/${KID_A}/memory-proposals`]: ok(notesWire()) });
    await screen.findByText('Loves bikes and saving for one.');
    expect(screen.getAllByText('Loves bikes.').length).toBeGreaterThanOrEqual(2);
    const stale = document.querySelector('[data-memory-note="n2"]') as HTMLElement;
    expect(stale).toHaveAttribute('data-out-of-date', 'true');
    expect(within(stale).getByText(notes.outOfDate)).toBeInTheDocument();
    const fresh = document.querySelector('[data-memory-note="n1"]') as HTMLElement;
    expect(within(fresh).queryByText(notes.outOfDate)).toBeNull();
  });

  it('shows both Mentor notes, who they are and how they learn best, each with its own suggestions', async () => {
    setup({ [`GET /tutor/kids/${KID_A}/memory-proposals`]: ok(notesWire()) });
    await screen.findByRole('heading', { level: 3, name: notes.pedagogyStore });
    expect(screen.getByRole('heading', { level: 3, name: notes.learnerStore })).toHaveAttribute('data-copy-role', 'heading');
    const pedagogy = document.querySelector('.lf-console-note-store[data-memory-store="pedagogy"]') as HTMLElement;
    expect(within(pedagogy).getAllByText('Short steps help.').length).toBeGreaterThanOrEqual(1);
    const n3 = within(pedagogy).getByText('A picture first, then the rule.').closest('li') as HTMLElement;
    expect(n3).not.toHaveAttribute('data-out-of-date');
    expect(within(n3).getByRole('button', { name: notes.approve })).toBeEnabled();
  });

  it('tells an applied approval, an out-of-date refusal and a failure apart', async () => {
    setup({
      [`GET /tutor/kids/${KID_A}/memory-proposals`]: ok(notesWire()),
      'POST /tutor/memory-proposals/n1/decision': ok({ outcome: 'approved', applied: true }),
      'POST /tutor/memory-proposals/n2/decision': refuse('NOTE_OUT_OF_DATE'),
      'POST /tutor/memory-proposals/n3/decision': ok({ outcome: 'rejected', applied: false, store: 'pedagogy' }),
    });
    const n1 = await screen.findByText('Loves bikes and saving for one.').then((el) => el.closest('li') as HTMLElement);
    fireEvent.click(within(n1).getByRole('button', { name: notes.approve }));
    await within(n1).findByText(notes.approved);
    const n2 = document.querySelector('[data-memory-note="n2"]') as HTMLElement;
    fireEvent.click(within(n2).getByRole('button', { name: notes.approve }));
    await within(n2).findByText(notes.stale);
    expect(within(n2).queryByText(notes.approved)).toBeNull();
    // The pedagogy note is decided on its own (C.4, OD-18): rejecting it is a delete.
    const n3 = document.querySelector('[data-memory-note="n3"]') as HTMLElement;
    expect(n3).toHaveAttribute('data-memory-store', 'pedagogy');
    fireEvent.click(within(n3).getByRole('button', { name: notes.reject }));
    await within(n3).findByText(notes.rejected);
    await screen.findByText(notes.allDone);
  });

  it('reads the child\'s learning profile in closed labels and lets the Tutor reset it', async () => {
    const { transport } = setup({ [`DELETE /tutor/kids/${KID_A}/disposition`]: ok({ reset: true }) });
    await screen.findByRole('heading', { name: profile.titleChild });
    expect(screen.getByText(profile.help.hint_seeking)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: profile.reset }));
    await screen.findByText(profile.resetDone);
    expect(transport.calls.filter((call) => call.method === 'DELETE' && call.path.endsWith('/disposition'))).toHaveLength(1);
  });

  it('keeps the caption for a board the renderer cannot draw (an unknown shape, a hole in its figures)', async () => {
    const sessionsSection = () => screen.getByRole('heading', { name: copy.sessionsTitle }).closest('section')!;
    const turns = transcriptWire(SESSION_A).turns.map((turn, index) => index === 0
      ? { ...turn, whiteboard: { kind: 'goal_bar', saved: 5, target: 20, label: 'Bike: 5 of 20' } }
      : index === 2 ? { ...turn, whiteboard: { kind: 'hologram', label: 'Space' } } : turn);
    setup({ [`GET /tutor/sessions/${SESSION_A}`]: ok({ ...transcriptWire(SESSION_A), turns }) });
    await screen.findByRole('heading', { name: copy.sessionsTitle });
    fireEvent.click(within(sessionsSection()).getByRole('button', { name: copy.read }));
    await within(sessionsSection()).findByText('Board: Bike: 5 of 20');
    const transcript = sessionsSection().querySelector('[data-console-part="transcript"]') as HTMLElement;
    expect(transcript.querySelector('[data-console-part="board"]')).toBeNull();
    expect(within(transcript).getByText('Board: Space')).toBeInTheDocument();
  });

  it('hides the kept boards when there are none and draws them when there are', async () => {
    const { view } = setup();
    await screen.findByRole('heading', { name: copy.sessionsTitle });
    expect(view.container.querySelector('[data-console-part="kept"]')).toBeNull();
    view.unmount();
    setup({
      [`GET /tutor/kids/${KID_A}/plan`]: ok({ plan: { content: { ...GOAL_BOARD, label: 'Bike plan' }, sessionId: null, updatedAt: '2026-09-19T00:00:00Z' } }),
      [`GET /tutor/kids/${KID_A}/notebook`]: ok({ entries: [
        { id: 'k1', whiteboard: YOUR_TURN_BOARD, keptAt: '2026-09-20T00:00:00Z' },
        { id: 'k2', whiteboard: { kind: 'goal_bar', label: 'Old board' }, keptAt: '2026-09-18T00:00:00Z' },
      ] }),
    });
    const kept = (await screen.findByRole('heading', { level: 2, name: copy.keptTitle })).closest('section')!;
    expect(within(kept).getByRole('heading', { level: 3, name: 'Board: Bike plan' })).toBeInTheDocument();
    expect(within(kept).getByRole('heading', { level: 3, name: 'Board: Keep it going' })).toBeInTheDocument();
    expect(within(kept).queryByRole('button', { name: boardCopy.showNext })).toBeNull();
    // A kept board the renderer cannot draw keeps its caption.
    expect(within(kept).getByText('Board: Old board')).toBeInTheDocument();
  });

  it('carries the microphone consent for this child', async () => {
    setup();
    expect(await screen.findByRole('button', { name: family.familyChildConsent.micAllow })).toBeInTheDocument();
  });

  it('explains a refusal and offers a retry for anything else', async () => {
    const { view } = setup({ [`GET /tutor/kids/${KID_A}/sessions`]: refuse('FORBIDDEN') });
    expect(await screen.findByRole('heading', { name: copy.forbiddenTitle })).toBeInTheDocument();
    view.unmount();
    let calls = 0;
    setup({ [`GET /tutor/kids/${KID_A}/sessions`]: () => (++calls === 1 ? refuse('DATA_UNAVAILABLE') : ok(historyWire())) });
    fireEvent.click(await screen.findByRole('button', { name: copy.retry }));
    expect(await screen.findByRole('heading', { name: copy.flagsTitle })).toBeInTheDocument();
  });
});
