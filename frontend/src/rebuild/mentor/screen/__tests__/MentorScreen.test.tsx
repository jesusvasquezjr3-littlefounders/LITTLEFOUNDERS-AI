import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MentorStageProps } from '../../MentorStage';
import type { TutorOffers } from '../../session/types';
import type { TutorTurnState } from '../../session/useTutorSocket';
import { boardFixtures } from '../boardFixtures';
import { fixtureData } from '../mentorFixtures';
import { mentorCopy } from '../MentorRoute';
import {
  CAPTION_MIN_PAGE_MS, CAPTION_MS_PER_WORD, captionPageMs, MentorScreen, openingsFor, stageStateFor, type MentorLive, type MentorScreenSession,
} from '../MentorScreen';
import { copyLimit, wordCount } from '../../../design/copyBudget';

/*
 * W2M.2: the Mentor screen (Frontend Bible 08 §2-§8) against fixtures of its
 * session. The stage is replaced by a probe that records what the screen asks
 * of it; the stage itself is covered by MentorStage.test.tsx.
 */
const stageProps: MentorStageProps[] = [];
vi.mock('../../MentorStage', () => ({
  MentorStage: (props: MentorStageProps) => {
    stageProps.push(props);
    return <div data-testid="stage" data-state={props.state} data-character={props.character} data-board={props.board ? 'open' : 'closed'} />;
  },
}));

const copy = mentorCopy('en-US');
const t = copy.mentorScreen;
const noop = () => undefined;

const OFFERS: TutorOffers = {
  locale: 'en-US', lastSession: null, intelDegraded: false, canStart: true, startBlockedBy: null, sessionCapResetAt: null,
  voiceAvailable: true, microphoneBlockedBy: null, weakSkills: [], faqIds: ['what_is_saving'], canAskOpen: true,
};

function live(overrides: Partial<MentorLive> = {}): MentorLive {
  return {
    adaptationOffer: null, sessionEndOffer: false, checkInOpen: false, goalCheckOpen: false, error: null, budget: 'running',
    intelDegraded: false, segment: null, lesson: null, thinking: false,
    answerAdaptation: vi.fn(), answerSessionEnd: vi.fn(), answerCheckIn: vi.fn(), answerGoal: vi.fn(), ...overrides,
  };
}

function turn(overrides: Partial<TutorTurnState> = {}): TutorTurnState {
  return { seq: 1, text: 'How much is left to save?', emotion: 'happy', action: 'idle', audioUrl: null, audioPending: false, wordTimings: null,
    next: 'ask', policy: null, demonstrate: null, whiteboard: null, roleplayScene: null, pointAt: null, ...overrides };
}

function session(overrides: Partial<MentorScreenSession> = {}): MentorScreenSession {
  return {
    phase: 'openings', known: true, ageBand: '6-9', character: 'dina', scene: 'diorama-b', voice: false, companion: null, light: 'auto', nickname: null, offers: OFFERS,
    preferences: { character: 'dina', companion: null, diorama: 'diorama-b', backdrop: 'auto', nickname: null, adaptations: [] },
    catalog: null, personalized: true, updatePreferences: vi.fn(async () => true), keepBoard: vi.fn(async () => true), data: fixtureData('en-US'),
    calibrationSaving: false, calibrationError: false, starting: false, startError: null, socket: live(), turn: null,
    speechUrl: null, audioKey: 0, speaking: false, awaitingReply: false, replyTimedOut: false, resuming: false, ending: false,
    history: [], closing: null, recapOpen: false,
    mic: { present: true, blockedBy: null, denied: false, recording: false, microphone: { subscribe: () => noop } },
    retry: vi.fn(), chooseCalibration: vi.fn(), start: vi.fn(), sendText: vi.fn(), pressMic: vi.fn(), endSession: vi.fn(), restart: vi.fn(), editLast: vi.fn(),
    gradeActivity: vi.fn(async () => null), reportActivity: vi.fn(),
    chooseCharacter: vi.fn(async () => true), answerAlliance: vi.fn(async () => 'recorded' as const), setHasDraft: vi.fn(),
    onSpeechEnd: noop, onSpeechBlocked: noop, ...overrides,
  };
}

function show(value: MentorScreenSession, props: { guardianLink?: boolean; onLeave?: () => void; onPath?: () => void } = {}) {
  return render(<MentorScreen session={value} copy={copy} locale="en-US" theme="light" guardianLink={props.guardianLink ?? false}
    onLeave={props.onLeave ?? noop} onPath={props.onPath ?? noop} />);
}

afterEach(() => { stageProps.length = 0; vi.useRealTimers(); });

describe('the screen is the stage (08 §2, D13)', () => {
  it('names the character as the only heading and puts it on its Diorama', () => {
    show(session());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Dina');
    expect(screen.getByTestId('stage')).toHaveAttribute('data-character', 'dina');
    expect(stageProps.at(-1)).toMatchObject({ scene: 'diorama-b', ageBand: '6-9', copy: copy.mentorStage });
    expect(document.querySelector('[data-copy-role="mentor"]')).toHaveTextContent("Hi, I'm Dina. What shall we do today?");
  });

  it('never shows a stand-in character before Core has said which one', () => {
    show(session({ phase: 'loading', known: false, offers: null }));
    expect(screen.queryByTestId('stage')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t.documentTitle);
    expect(document.querySelector('[data-copy-role="mentor"]')).toHaveTextContent(t.loading);
  });

  it('says so and offers a retry when the Mentor cannot be reached', () => {
    const retry = vi.fn();
    show(session({ phase: 'unavailable', known: false, offers: null, retry }));
    expect(document.querySelector('[data-copy-role="mentor"]')).toHaveTextContent(t.unavailable);
    fireEvent.click(screen.getByRole('button', { name: t.retry }));
    expect(retry).toHaveBeenCalled();
  });
});

describe('openings: 2-3 reply chips, the field and the microphone (08 §2 layer 5)', () => {
  it('offers at most three openings, where the learner left off first', () => {
    const offers: TutorOffers = { ...OFFERS, lastSession: { topic: 'Saving', courseId: 'c', topicId: 't', skillKey: null, outcome: 'left', daysAgo: 1 },
      weakSkills: [{ skillKey: 'money/change', title: 'Change', courseId: 'c', topicId: 't2', recommendedAction: 'practice', reasonCode: 'x' }] };
    const list = openingsFor(offers, t);
    expect(list.map((o) => o.id)).toEqual(['continue', 'weak_skill', 'course_topic']);
    expect(list.map((o) => o.label)).toEqual(['Keep going: Saving', 'Practise Change', t.courseTopic]);
    // A skill Core could not name is never shown as its internal key.
    const unnamed = openingsFor({ ...offers, lastSession: { ...offers.lastSession!, topic: null, skillKey: 'money/change', courseId: null, topicId: null },
      weakSkills: [{ ...offers.weakSkills[0]!, title: null }] }, t);
    expect(unnamed.map((o) => o.label).slice(0, 2)).toEqual([t.continueGeneric, t.practiseSkill]);
    const start = vi.fn();
    show(session({ offers, start }));
    const chips = within(screen.getByRole('group', { name: t.openingsLabel })).getAllByRole('button');
    expect(chips).toHaveLength(3);
    for (const chip of chips) expect(chip).toHaveAttribute('data-copy-role', 'option');
    fireEvent.click(chips[0]!);
    expect(start).toHaveBeenCalledWith({ intent: 'course_topic', courseId: 'c', topicId: 't' });
  });

  it('asks an open question from the field when the learner may', () => {
    const sendText = vi.fn();
    show(session({ sendText }));
    fireEvent.change(screen.getByLabelText(t.askLabel), { target: { value: 'What is interest?' } });
    fireEvent.click(screen.getByRole('button', { name: t.send }));
    expect(sendText).toHaveBeenCalledWith('What is interest?');
  });

  it('shows the daily limit as the Mentor saying so, with nothing to press into a refusal', () => {
    show(session({ startError: 'SESSION_LIMIT' }));
    expect(document.querySelector('[data-copy-role="mentor"]')).toHaveTextContent(t.limit);
    expect(screen.queryByRole('group', { name: t.openingsLabel })).toBeNull();
    expect(screen.queryByLabelText(t.askLabel)).toBeNull();
    expect(screen.queryByRole('button', { name: t.talk })).toBeNull();
  });

  it('shows the microphone only where C.2 allows it, and says why when a grown-up can change it', () => {
    const { unmount } = show(session({ mic: { present: false, blockedBy: 'CONSENT_REQUIRED', denied: false, recording: false, microphone: { subscribe: () => noop } } }));
    expect(screen.queryByRole('button', { name: t.talk })).toBeNull();
    expect(screen.getByText(t.micBlocked.CONSENT_REQUIRED)).toBeInTheDocument();
    unmount();
    show(session());
    expect(screen.getByRole('button', { name: t.talk })).toBeInTheDocument();
  });

  it('asks a child 6-7 or 8-9 their band before offering anything (C.1)', () => {
    const chooseCalibration = vi.fn();
    show(session({ phase: 'calibration', chooseCalibration }));
    fireEvent.click(screen.getByRole('button', { name: copy.mentorCalibration.youngest }));
    expect(chooseCalibration).toHaveBeenCalledWith(1);
    expect(screen.queryByRole('group', { name: t.openingsLabel })).toBeNull();
  });
});

describe('a conversation: the current turn only, Block C as chips', () => {
  it('holds the current turn in caption pages within the budget, never a thread', () => {
    const long = 'You saved ten coins the first week. Then you added five coins each week after that, so the jar kept growing. Look at the board now.';
    show(session({ phase: 'conversing', turn: turn({ text: long }), history: [{ speaker: 'tutor', text: 'Earlier turn', seq: 0 }] }));
    const plate = document.querySelector('[data-copy-role="mentor"]')!;
    expect(plate.textContent!.split(/\s+/).length).toBeLessThanOrEqual(12);
    expect(screen.queryByText('Earlier turn')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: t.nextLine }));
    expect(plate.textContent).not.toBe('You saved ten coins the first week.');
  });

  it('offers the hint ladder (C.13) as the learner’s own words', () => {
    const sendText = vi.fn();
    show(session({ phase: 'conversing', turn: turn(), sendText }));
    const group = screen.getByRole('group', { name: t.replyChips });
    fireEvent.click(within(group).getByRole('button', { name: t.hint }));
    fireEvent.click(within(group).getByRole('button', { name: t.tell }));
    expect(sendText.mock.calls).toEqual([[t.hint], [t.tell]]);
  });

  it('asks an adaptation (C.15) with two equal chips and no default', () => {
    const socket = live({ adaptationOffer: 'more_examples' });
    show(session({ phase: 'conversing', turn: turn(), socket }));
    expect(screen.getByText(t.adaptation.more_examples)).toHaveAttribute('data-copy-role', 'prompt');
    const chips = within(screen.getByRole('group', { name: t.adaptation.more_examples })).getAllByRole('button');
    expect(chips.map((chip) => chip.className)).toEqual([chips[0]!.className, chips[0]!.className]);
    fireEvent.click(screen.getByRole('button', { name: t.no }));
    expect(socket.answerAdaptation).toHaveBeenCalledWith('more_examples', false);
    // An open offer outranks the hint ladder.
    expect(screen.queryByRole('button', { name: t.hint })).toBeNull();
  });

  it('carries the stop-or-continue offer (C.8/C.12), the goal check (C.15) and the check-in (C.19)', () => {
    const socket = live({ sessionEndOffer: true });
    const { rerender } = show(session({ phase: 'conversing', turn: turn(), socket }));
    fireEvent.click(screen.getByRole('button', { name: copy.mentorSessionEnd.more }));
    expect(socket.answerSessionEnd).toHaveBeenCalledWith(false);
    const goal = live({ goalCheckOpen: true });
    rerender(<MentorScreen session={session({ phase: 'conversing', turn: turn(), socket: goal })} copy={copy} locale="en-US" theme="light" guardianLink={false} onLeave={noop} onPath={noop} />);
    fireEvent.click(screen.getByRole('button', { name: copy.mentorGoalCheck.agree }));
    expect(goal.answerGoal).toHaveBeenCalledWith(true);
    const check = live({ checkInOpen: true });
    rerender(<MentorScreen session={session({ phase: 'conversing', turn: turn(), socket: check })} copy={copy} locale="en-US" theme="light" guardianLink={false} onLeave={noop} onPath={noop} />);
    fireEvent.click(screen.getByRole('button', { name: copy.mentorCheckIn.misaligned }));
    expect(check.answerCheckIn).toHaveBeenCalledWith(false);
  });

  it('opens the board when a turn draws one, lets the learner hide it and bring it back', () => {
    show(session({ phase: 'conversing', turn: turn({ whiteboard: boardFixtures('en-US').goal_bar, action: 'point' }), speaking: true }));
    expect(screen.getByRole('heading', { name: 'My goal' })).toBeInTheDocument();
    expect(screen.getByTestId('stage')).toHaveAttribute('data-state', 'demonstrating');
    fireEvent.click(screen.getByRole('button', { name: t.hideBoard }));
    expect(screen.queryByRole('heading', { name: 'My goal' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: t.showBoard }));
    expect(screen.getByRole('heading', { name: 'My goal' })).toBeInTheDocument();
  });

  it('keeps a your-turn value unwritten until the learner shows it', () => {
    show(session({ phase: 'conversing', turn: turn({ whiteboard: boardFixtures('en-US').your_turn }) }));
    expect(screen.queryByText('$25')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: t.board.showNext }));
    expect(screen.getByText('$25')).toBeInTheDocument();
  });

  it('shows the thinking pose at once and the one-word status only after about 1.5 s (08 §3)', () => {
    vi.useFakeTimers();
    show(session({ phase: 'conversing', turn: turn(), awaitingReply: true }));
    expect(screen.getByTestId('stage')).toHaveAttribute('data-state', 'thinking');
    expect(screen.queryByText(t.thinking)).toBeNull();
    act(() => { vi.advanceTimersByTime(1600); });
    expect(screen.getByText(t.thinking)).toBeInTheDocument();
  });

  it('listens while the learner types or talks, and shows the level in the response area', () => {
    const { rerender } = show(session({ phase: 'conversing', turn: turn() }));
    fireEvent.change(screen.getByLabelText(t.replyLabel), { target: { value: 'ten' } });
    expect(screen.getByTestId('stage')).toHaveAttribute('data-state', 'listening');
    rerender(<MentorScreen session={session({ phase: 'conversing', turn: turn(), mic: { present: true, blockedBy: null, denied: false, recording: true, microphone: { subscribe: () => noop } } })}
      copy={copy} locale="en-US" theme="light" guardianLink={false} onLeave={noop} onPath={noop} />);
    expect(screen.getByRole('button', { name: t.stopTalking })).toBeInTheDocument();
    expect(screen.getByText(t.listening)).toBeInTheDocument();
  });

  it('words a server refusal instead of printing it', () => {
    show(session({ phase: 'conversing', turn: turn(), socket: live({ error: { code: 'STT_FAILED' } }) }));
    expect(screen.getByRole('alert')).toHaveTextContent(t.errors.STT_FAILED!);
  });

  it('ends the conversation from the top bar instead of leaving mid-sentence', () => {
    const endSession = vi.fn();
    const onLeave = vi.fn();
    show(session({ phase: 'conversing', turn: turn(), endSession }), { onLeave });
    fireEvent.click(screen.getByRole('button', { name: t.close }));
    expect(endSession).toHaveBeenCalled();
    expect(onLeave).not.toHaveBeenCalled();
  });

  it('shows an activity type the screen does not draw as its prompt, with the answer in the field', () => {
    show(session({ phase: 'conversing', turn: turn(), socket: live({ segment: { segmentId: 's', seq: 1, origin: 'catalog', segment: { type: 'memory_flip', prompt: 'How many coins?' }, scoresXp: true, framing: '' } }) }));
    expect(screen.getByRole('heading', { name: t.activityUi.heading })).toBeInTheDocument();
    expect(screen.getByText('How many coins?')).toBeInTheDocument();
    expect(screen.getByText(t.activityUi.answer)).toBeInTheDocument();
  });
});

describe('closing (C.16) and the bond proxy (C.15)', () => {
  it('shows the closing line, one action back to the path, and the bond question', () => {
    const onPath = vi.fn();
    show(session({ phase: 'closing', closing: { sessionId: 's1', script: 'completed', effort: 'recovered', topic: 'Saving' } }), { onPath });
    expect(screen.getByTestId('stage')).toHaveAttribute('data-state', 'closing');
    expect(stageProps.at(-1)?.closing).toBe('completed');
    fireEvent.click(screen.getByRole('button', { name: copy.mentorSessionEnd.backToPath }));
    expect(onPath).toHaveBeenCalled();
    expect(screen.getByText(copy.mentorAllianceCheck.question)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('never asks the bond question after a safety stop', () => {
    show(session({ phase: 'closing', closing: { sessionId: 's1', script: 'safety_stop', effort: null, topic: null } }));
    expect(screen.queryByText(copy.mentorAllianceCheck.question)).toBeNull();
    expect(screen.getByRole('heading', { name: copy.mentorSessionEnd.safetyTitle })).toBeInTheDocument();
  });
});

describe('the menu: change Mentor, what we said, and the grown-up line only with a guardian link', () => {
  const openMenu = () => fireEvent.click(screen.getByRole('button', { name: t.menu }));

  it('lists the grown-up line for a child in a family only', () => {
    const { unmount } = show(session(), { guardianLink: false });
    openMenu();
    expect(screen.queryByRole('menuitem', { name: t.grownUp })).toBeNull();
    unmount();
    show(session(), { guardianLink: true });
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: t.grownUp }));
    expect(screen.getByRole('dialog', { name: t.grownUp })).toHaveTextContent(t.grownUpBody);
  });

  it('keeps the transcript as a secondary sheet in reading order', () => {
    show(session({ phase: 'conversing', turn: turn(), history: [{ speaker: 'tutor', text: 'Hello there', seq: 1 }, { speaker: 'learner', text: 'Hi', seq: 2 }] }));
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: t.transcript }));
    const items = within(screen.getByRole('dialog', { name: t.transcript })).getAllByRole('listitem');
    // The learner's last line carries the one way to change it (T1c).
    expect(items.map((item) => item.textContent)).toEqual(['DinaHello there', `${t.you}Hi${t.editLast}`]);
  });

  it('chooses among the four real characters, saved before it is shown as chosen (08 §8)', async () => {
    const chooseCharacter = vi.fn(async () => true);
    show(session({ chooseCharacter }));
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: t.changeMentor }));
    const dialog = screen.getByRole('dialog', { name: t.chooser.heading });
    const rows = within(dialog).getAllByRole('button').filter((button) => button.classList.contains('lf-list-row--pressable'));
    expect(rows).toHaveLength(4);
    expect(rows.filter((row) => row.textContent?.includes(t.chooser.chosen)).map((row) => row.querySelector('.lf-list-row-title')?.textContent)).toEqual(['Dina']);
    for (const img of dialog.querySelectorAll('img')) expect(img.getAttribute('data-asset-id')).toBeTruthy();
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: /Zara/ })); });
    expect(chooseCharacter).toHaveBeenCalledWith('zara');
  });

  it('does not offer a character change in the middle of a conversation', () => {
    show(session({ phase: 'conversing', turn: turn() }));
    openMenu();
    expect(screen.queryByRole('menuitem', { name: t.changeMentor })).toBeNull();
  });
});

describe('age bands change presence and order, never components (08 §9)', () => {
  it('puts the field first for 13 and older and the chips first for 6-9, in the DOM and so in the Tab order', () => {
    const order = () => {
      const field = screen.getByRole('textbox');
      const chips = screen.getByRole('group', { name: t.openingsLabel });
      return field.compareDocumentPosition(chips) & Node.DOCUMENT_POSITION_FOLLOWING ? 'field-first' : 'chips-first';
    };
    const { unmount } = show(session({ ageBand: '13-17' }));
    expect(document.querySelector('.lf-mentor-screen')).toHaveAttribute('data-age-band', '13-17');
    expect(order()).toBe('field-first');
    unmount();
    show(session({ ageBand: '6-9' }));
    expect(order()).toBe('chips-first');
  });

  it('requests states and never fakes a celebration', () => {
    const base = session({ phase: 'conversing', turn: turn({ emotion: 'encouraging' }) });
    expect(stageStateFor(base, { board: false, delivering: false, drafting: false })).toBe('encouraging');
    for (const phase of ['openings', 'conversing', 'closing'] as const) {
      expect(stageStateFor(session({ phase }), { board: true, delivering: true, drafting: false })).not.toBe('celebrating');
    }
  });

  it('W3M.1: encourages after a missed activity and while offering a guided review; speaking and thinking outrank it', () => {
    const plain = session({ phase: 'conversing', turn: turn({ emotion: 'neutral' }) });
    expect(stageStateFor(plain, { board: false, delivering: false, drafting: false })).toBe('idle');
    expect(stageStateFor(plain, { board: false, delivering: false, drafting: false, missed: true })).toBe('encouraging');
    const offering = session({ phase: 'conversing', turn: turn({ emotion: 'neutral' }), socket: { ...plain.socket, adaptationOffer: 'guided_review' as never } });
    expect(stageStateFor(offering, { board: false, delivering: false, drafting: false })).toBe('encouraging');
    expect(stageStateFor(offering, { board: false, delivering: true, drafting: false })).toBe('speaking');
    expect(stageStateFor({ ...plain, awaitingReply: true }, { board: false, delivering: false, drafting: false, missed: true })).toBe('thinking');
  });
});

describe('W3M.1: the chip budget and the paced caption (08 §2, §3, 06)', () => {
  it('a topic that would overflow a chip says the generic line instead, per age band and locale', () => {
    const long = 'Comparing unit prices across several different grocery store brands';
    const offers: TutorOffers = { ...OFFERS, lastSession: { topic: long, courseId: 'c', topicId: 't', skillKey: null, outcome: 'left', daysAgo: 1 },
      weakSkills: [{ skillKey: 'money/change', title: 'Making change', courseId: 'c', topicId: 't2', recommendedAction: 'practice', reasonCode: 'x' }] };
    const young = openingsFor(offers, t, { locale: 'en-US', ageBand: '6-9' });
    expect(young[0]!.label).toBe(t.continueGeneric);
    expect(young[1]!.label).toBe('Practise Making change');
    for (const opening of young) expect(wordCount(opening.label)).toBeLessThanOrEqual(copyLimit('option', { locale: 'en-US', ageBand: '6-9', surface: 'app' })!);
    // Without a budget context (the legacy callers), the label is filled as before.
    expect(openingsFor(offers, t)[0]!.label).toBe(`Keep going: ${long}`);
  });

  it('holds each caption page about as long as it takes to say it, never under 1.5 s', () => {
    expect(captionPageMs('Hi')).toBe(CAPTION_MIN_PAGE_MS);
    expect(captionPageMs('one two three four five six seven eight nine ten')).toBe(10 * CAPTION_MS_PER_WORD);
  });

  it('turns caption pages by themselves while the Mentor speaks, and settles on the last', () => {
    vi.useFakeTimers();
    try {
      const text = 'Money you keep is called savings. It waits for later. A jar can hold it safe. Banks can hold it too. We can count it together.';
      show(session({ phase: 'conversing', ageBand: '6-9', speaking: true, turn: turn({ text, seq: 2 }) }));
      const plate = () => document.querySelector('.lf-mentor-plate-text')!.textContent;
      const first = plate();
      act(() => { vi.advanceTimersByTime(captionPageMs(first ?? '') + 50); });
      expect(plate()).not.toBe(first);
      act(() => { vi.advanceTimersByTime(60_000); });
      expect(text.endsWith(plate() ?? '')).toBe(true);
    } finally { vi.useRealTimers(); }
  });
});
