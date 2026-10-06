import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MentorStageProps } from '../../MentorStage';
import type { TutorOffers } from '../../session/types';
import type { TutorTurnState } from '../../session/useTutorSocket';
import { fixtureData, mapFixture, sessionsFixture, transcriptFixture } from '../mentorFixtures';
import { mentorCopy } from '../MentorRoute';
import { MentorScreen, type MentorLive, type MentorScreenSession } from '../MentorScreen';
import { replayBeats } from '../replayModel';

/*
 * W2M.3: the Mentor screen's remaining surfaces (T1a-T1g) against fixtures:
 * the menu by what is happening, the learner's island, the learning map, the
 * notebook and keeping a board, past talks replayed on the stage, a roleplay
 * scene in the plate, and the first visit's chooser.
 */
const stageProps: MentorStageProps[] = [];
vi.mock('../../MentorStage', async (original) => ({
  ...(await original<typeof import('../../MentorStage')>()),
  MentorStage: (props: MentorStageProps) => {
    stageProps.push(props);
    return <div data-testid="stage" data-state={props.state} data-character={props.character} data-companion={props.companion ?? ''} />;
  },
}));

const copy = mentorCopy('en-US');
const t = copy.mentorScreen;
const noop = () => undefined;

const OFFERS: TutorOffers = {
  locale: 'en-US', lastSession: null, intelDegraded: false, canStart: true, startBlockedBy: null, sessionCapResetAt: null,
  voiceAvailable: true, microphoneBlockedBy: null, weakSkills: [], faqIds: ['what_is_saving'], canAskOpen: true,
};

const live = (overrides: Partial<MentorLive> = {}): MentorLive => ({
  adaptationOffer: null, sessionEndOffer: false, checkInOpen: false, goalCheckOpen: false, error: null, budget: 'running',
  intelDegraded: false, segment: null, lesson: null, thinking: false,
  answerAdaptation: vi.fn(), answerSessionEnd: vi.fn(), answerCheckIn: vi.fn(), answerGoal: vi.fn(), ...overrides,
});

const turn = (overrides: Partial<TutorTurnState> = {}): TutorTurnState => ({
  seq: 1, text: 'How much is left to save?', emotion: 'happy', action: 'idle', audioUrl: null, audioPending: false, wordTimings: null,
  next: 'ask', policy: null, demonstrate: null, whiteboard: null, roleplayScene: null, pointAt: null, replies: [], ...overrides,
});

function session(overrides: Partial<MentorScreenSession> = {}): MentorScreenSession {
  return {
    phase: 'openings', known: true, ageBand: '6-9', character: 'dina', scene: 'diorama-b', voice: false, companion: null, light: 'auto', nickname: null, offers: OFFERS,
    preferences: { character: 'dina', companion: null, diorama: 'diorama-b', backdrop: 'auto', nickname: null, adaptations: [] },
    catalog: { characters: ['rho', 'zara', 'liruf', 'dina'], dioramas: ['diorama-a', 'diorama-b'], backdrops: ['day', 'auto', 'night'],
      adaptations: ['slower_pacing', 'more_examples', 'less_text', 'more_visual', 'repeat_before_advancing'], articulates: [] },
    personalized: true, updatePreferences: vi.fn(async () => true), keepBoard: vi.fn(async () => true), data: fixtureData('en-US'),
    calibrationSaving: false, calibrationError: false, starting: false, startError: null, socket: live(), turn: null,
    speechUrl: null, audioKey: 0, speaking: false, awaitingReply: false, replyTimedOut: false, resuming: false, ending: false,
    history: [], closing: null, recapOpen: false,
    mic: { present: false, blockedBy: null, denied: false, recording: false, microphone: { subscribe: () => noop } },
    retry: vi.fn(), chooseCalibration: vi.fn(), start: vi.fn(), sendText: vi.fn(), pressMic: vi.fn(), endSession: vi.fn(), restart: vi.fn(), editLast: vi.fn(),
    gradeActivity: vi.fn(async () => null), reportActivity: vi.fn(),
    chooseCharacter: vi.fn(async () => true), answerAlliance: vi.fn(async () => 'recorded' as const), setHasDraft: vi.fn(),
    onSpeechEnd: noop, onSpeechBlocked: noop, ...overrides,
  };
}

const show = (value: MentorScreenSession, props: Partial<Parameters<typeof MentorScreen>[0]> = {}) =>
  render(<MentorScreen session={value} copy={copy} locale="en-US" theme="light" guardianLink={false} onLeave={noop} onPath={noop} {...props} />);
const openMenu = () => fireEvent.click(screen.getByRole('button', { name: t.menu }));
const menuItems = () => screen.getAllByRole('menuitem').map((item) => item.textContent);
const plate = () => document.querySelector('.lf-mentor-plate-text')?.textContent;
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => { stageProps.length = 0; });
afterEach(() => { vi.useRealTimers(); });

describe('the menu opens what fits the moment (08 §2 layer 1, T1b)', () => {
  it('offers every secondary view outside a conversation', () => {
    show(session(), { guardianLink: true });
    openMenu();
    expect(menuItems()).toEqual([t.changeMentor, copy.mentorPersonalise.menu, copy.mentorMap.menu, copy.mentorNotebook.menu,
      copy.mentorHistory.menu, t.transcript, t.grownUp]);
  });

  it('keeps only reading views during a conversation: no change of Mentor or island, no replay over a live talk', () => {
    show(session({ phase: 'conversing', turn: turn() }));
    openMenu();
    // "Start over" (T1c) ends this talk, behind a confirmation; it is the only action.
    expect(menuItems()).toEqual([copy.mentorMap.menu, copy.mentorNotebook.menu, t.transcript, t.startOver]);
  });

  it('offers nothing but the transcript before Core has said who the Mentor is', () => {
    show(session({ phase: 'loading', known: false, offers: null, preferences: null }));
    openMenu();
    expect(menuItems()).toEqual([t.transcript]);
  });
});

describe('my island (T1a): every choice saved to Core before it is shown', () => {
  const openIsland = () => { openMenu(); fireEvent.click(screen.getByRole('menuitem', { name: copy.mentorPersonalise.menu })); return screen.getByRole('dialog', { name: copy.mentorPersonalise.heading }); };

  it('invites a friend who is never the Mentor itself', async () => {
    const updatePreferences = vi.fn(async () => true);
    show(session({ updatePreferences }));
    const dialog = openIsland();
    const friends = within(dialog).getByRole('group', { name: copy.mentorPersonalise.companion });
    expect(within(friends).getAllByRole('radio').map((radio) => radio.closest('label')?.textContent))
      .toEqual([copy.mentorPersonalise.companionNone, 'Dr. Rho', 'Zara', 'Liruf']);
    await act(async () => { fireEvent.click(within(friends).getByRole('radio', { name: 'Zara' })); });
    expect(updatePreferences).toHaveBeenCalledWith({ companion: 'zara' });
  });

  it('orders the light with the screen-following one first, and changes the island and the explanations', async () => {
    const updatePreferences = vi.fn(async () => true);
    show(session({ updatePreferences }));
    const dialog = openIsland();
    const light = within(dialog).getByRole('group', { name: copy.mentorPersonalise.light });
    expect(within(light).getAllByRole('radio').map((radio) => radio.closest('label')?.textContent))
      .toEqual([copy.mentorPersonalise.lights.auto, copy.mentorPersonalise.lights.day, copy.mentorPersonalise.lights.night]);
    await act(async () => { fireEvent.click(within(dialog).getByRole('radio', { name: copy.mentorPersonalise.islands['diorama-a'] })); });
    expect(updatePreferences).toHaveBeenLastCalledWith({ diorama: 'diorama-a' });
    await act(async () => { fireEvent.click(within(dialog).getByRole('switch', { name: copy.mentorPersonalise.adaptation.less_text })); });
    expect(updatePreferences).toHaveBeenLastCalledWith({ adaptations: ['less_text'] });
  });

  it('checks a nickname before sending it and says when Core refuses one', async () => {
    const updatePreferences = vi.fn(async () => false);
    show(session({ updatePreferences }));
    const dialog = openIsland();
    const field = within(dialog).getByRole('textbox', { name: copy.mentorPersonalise.nickname });
    fireEvent.change(field, { target: { value: '<b>' } });
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: copy.mentorPersonalise.nicknameSave })); });
    expect(updatePreferences).not.toHaveBeenCalled();
    expect(dialog).toHaveTextContent(copy.mentorPersonalise.nicknameInvalid);
    fireEvent.change(field, { target: { value: 'Ana Maria' } });
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: copy.mentorPersonalise.nicknameSave })); });
    expect(updatePreferences).toHaveBeenCalledWith({ nickname: 'Ana Maria' });
    expect(dialog).toHaveTextContent(copy.mentorPersonalise.nicknameRejected);
  });

  it('keeps what was there and says so when a save is refused', async () => {
    show(session({ updatePreferences: vi.fn(async () => false) }));
    const dialog = openIsland();
    await act(async () => { fireEvent.click(within(dialog).getByRole('radio', { name: 'Liruf' })); });
    expect(within(dialog).getByRole('radio', { name: copy.mentorPersonalise.companionNone })).toBeChecked();
    expect(dialog).toHaveTextContent(copy.mentorPersonalise.failed);
  });

  it('puts the invited friend on the stage beside the Mentor', () => {
    show(session({ companion: 'liruf' }));
    expect(screen.getByTestId('stage')).toHaveAttribute('data-companion', 'liruf');
  });
});

describe('the learning map (T1f)', () => {
  const openMap = async () => {
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: copy.mentorMap.menu }));
    await flush();
    return screen.getByRole('dialog', { name: copy.mentorMap.heading });
  };

  it('lays the skills out in steps, each state in words, and names what a closed skill waits on', async () => {
    show(session());
    const dialog = await openMap();
    expect(within(dialog).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([copy.mentorDecisions.title, 'Step 1', 'Step 2', 'Step 3', 'Step 4']);
    expect(dialog).toHaveTextContent(copy.mentorMap.states.mastered);
    expect(dialog).toHaveTextContent('Opens after Give change by counting up');
    expect(dialog).toHaveTextContent('To review today: 1');
    expect(within(dialog).queryByRole('button', { name: /Plan a budget/ })).toBeNull();
  });

  it('shows the learner, read-only, what the Mentor decided and on what evidence (Appendix D §2.6)', async () => {
    show(session());
    const dialog = await openMap();
    const card = dialog.querySelector('[data-mentor-decisions]') as HTMLElement;
    expect(card).toHaveTextContent('Moved on after 2 correct answers in a row.');
    expect(card).toHaveTextContent(copy.mentorDecisions.hintAssisted);
    expect(card).toHaveTextContent('1 correct answer so far.');
    expect(card).toHaveTextContent(copy.mentorDecisions.states.not_yet);
    expect(within(card).queryByRole('button')).toBeNull();
  });

  it('starts a practice talk from a skill outside a conversation', async () => {
    const start = vi.fn();
    show(session({ start }));
    const dialog = await openMap();
    fireEvent.click(within(dialog).getAllByRole('button', { name: /Save for a goal/ })[0]!);
    expect(start).toHaveBeenCalledWith({ intent: 'weak_skill', skillKey: 'money/save' });
  });

  it('is read-only during a conversation and says why', async () => {
    const start = vi.fn();
    show(session({ phase: 'conversing', turn: turn(), start }));
    const dialog = await openMap();
    expect(dialog).toHaveTextContent(copy.mentorMap.readOnly);
    expect(within(dialog).queryByRole('button', { name: /Save for a goal/ })).toBeNull();
  });

  it.each([
    ['failed', copy.mentorMap.failed],
    ['empty', copy.mentorMap.empty],
    ['loading', copy.mentorMap.loading],
  ] as const)('has a %s state', async (mode, text) => {
    show(session({ data: fixtureData('en-US', mode) }));
    const dialog = await openMap();
    expect(dialog).toHaveTextContent(text);
  });
});

describe('the notebook and keeping a board (T1g)', () => {
  it('shows the recap, the plan and the kept boards, each in the Pizarrón frame', async () => {
    show(session());
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: copy.mentorNotebook.menu }));
    await flush();
    const dialog = screen.getByRole('dialog', { name: copy.mentorNotebook.heading });
    expect(within(dialog).getAllByRole('heading', { level: 3 }).map((h) => h.textContent))
      .toEqual([copy.mentorNotebook.lastTime, copy.mentorNotebook.plan, copy.mentorNotebook.kept]);
    expect(dialog).toHaveTextContent('12 min · 30 XP');
    expect(dialog.querySelectorAll('[data-board-kind]')).toHaveLength(2);
  });

  it('says how to fill an empty notebook', async () => {
    show(session({ data: fixtureData('en-US', 'empty') }));
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: copy.mentorNotebook.menu }));
    await flush();
    expect(screen.getByRole('dialog', { name: copy.mentorNotebook.heading })).toHaveTextContent(copy.mentorNotebook.empty);
  });

  it('keeps a live board by naming its turn, and says when it could not', async () => {
    const keepBoard = vi.fn(async () => false);
    const board = { kind: 'goal_bar' as const, goal: { label: 'Bike', value: 120 }, saved: { label: 'Saved', value: 45 }, remaining: 75, savedFraction: 0.375, label: 'Goal', currency: 'USD' as const };
    show(session({ phase: 'conversing', turn: turn({ seq: 7, whiteboard: board }), keepBoard }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: copy.mentorNotebook.keep })); });
    expect(keepBoard).toHaveBeenCalledWith(7);
    expect(screen.getByText(copy.mentorNotebook.keepFailed)).toBeInTheDocument();
  });
});

describe('past talks replay on the stage (T1e)', () => {
  const openHistory = async () => {
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: copy.mentorHistory.menu }));
    await flush();
    return screen.getByRole('dialog', { name: copy.mentorHistory.heading });
  };

  it('lists who each talk was with, what kind and how long, never a score', async () => {
    show(session());
    const dialog = await openHistory();
    const rows = within(dialog).getAllByRole('button').filter((b) => b.classList.contains('lf-list-row--pressable'));
    expect(rows.map((row) => row.querySelector('.lf-list-row-title')?.textContent)).toEqual(['A lesson topic with Dina', 'A chat with Dr. Rho']);
    expect(rows[0]).toHaveTextContent('6 lines');
    expect(dialog).not.toHaveTextContent('XP');
  });

  it('replays a talk with its own character: the Mentor performs its lines, the board returns, the transport drives it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    show(session());
    const dialog = await openHistory();
    await act(async () => { fireEvent.click(within(dialog).getAllByRole('button', { name: /Dr\. Rho/ })[0]!); });
    await flush();
    expect(document.querySelector('.lf-mentor-screen')).toHaveAttribute('data-replay', 'on');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Dr. Rho');
    expect(stageProps.at(-1)).toMatchObject({ character: 'rho', scene: 'diorama-a' });
    expect(screen.getByText(copy.mentorReplay.notLive.replace('{name}', 'Dr. Rho'))).toBeInTheDocument();
    expect(plate()).toBe('Hi! Shall we plan how to save for the bike?');
    expect(document.querySelector('.lf-mentor-plate-speaker')).toHaveTextContent('Dr. Rho');
    expect(screen.getByText('Line 1 of 5')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: copy.mentorReplay.next }));
    expect(plate()).toBe('Yes!');
    expect(screen.getByTestId('stage')).toHaveAttribute('data-state', 'listening');
    fireEvent.click(screen.getByRole('button', { name: copy.mentorReplay.next }));
    expect(document.querySelector('[data-board-kind="goal_bar"]')).not.toBeNull();
    expect(screen.getByTestId('stage')).toHaveAttribute('data-state', 'demonstrating');
    fireEvent.click(screen.getByRole('button', { name: copy.mentorReplay.next }));
    expect(plate()).toBe('How much is still to save?');
    expect(screen.getByText(copy.mentorReplay.scored.replace('{score}', '100'))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: copy.mentorReplay.pause }));
    expect(screen.getByTestId('stage')).toHaveAttribute('data-state', 'idle');
    fireEvent.click(screen.getByRole('button', { name: copy.mentorReplay.talk }));
    expect(document.querySelector('.lf-mentor-screen')).not.toHaveAttribute('data-replay');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Dina');
  });

  it('plays on by itself and says when the talk is over', () => {
    vi.useFakeTimers();
    const beats = replayBeats(transcriptFixture('en-US', 'dina'));
    show(session(), { initialReplay: { summary: sessionsFixture()[0]!, beats } });
    for (let step = 0; step < 20; step += 1) act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.getByText(copy.mentorReplay.ended)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.mentorReplay.play })).toBeInTheDocument();
  });

  it('says so when a talk cannot be opened, and the way back works', async () => {
    const data = { ...fixtureData('en-US'), transcript: async () => null };
    show(session({ data }));
    const dialog = await openHistory();
    await act(async () => { fireEvent.click(within(dialog).getAllByRole('button', { name: /Dina/ })[0]!); });
    await flush();
    expect(plate()).toBe(copy.mentorReplay.failed);
    fireEvent.click(screen.getByRole('button', { name: t.close }));
    expect(document.querySelector('.lf-mentor-screen')).not.toHaveAttribute('data-replay');
  });
});

describe('a roleplay scene (Class III)', () => {
  it('plays each beat in the plate, the Mentor acting the lead and the invited friend the other part', () => {
    vi.useFakeTimers();
    show(session({ phase: 'conversing', companion: 'zara', turn: turn({ seq: 4, roleplayScene: 'lemonade_change', audioPending: true }) }));
    const scene = copy.mentorRoleplay.scenes.lemonade_change!;
    expect(document.querySelector('.lf-mentor-screen')).toHaveAttribute('data-roleplay', 'lemonade_change');
    expect(document.querySelector('.lf-mentor-plate-speaker')).toHaveTextContent(`${scene.title} · Zara`);
    expect(plate()).toBe("Hi! I'd like a lemonade, please.");
    expect(stageProps.at(-1)).toMatchObject({ state: 'listening', companion: 'zara', companionPose: { emotion: 'happy', action: 'wave', beat: 1 } });
    act(() => { vi.advanceTimersByTime(6700); });
    expect(document.querySelector('.lf-mentor-plate-speaker')).toHaveTextContent(`${scene.title} · Dina`);
    expect(screen.getByTestId('stage')).toHaveAttribute('data-state', 'speaking');
    for (let step = 0; step < 20; step += 1) act(() => { vi.advanceTimersByTime(5000); });
    expect(document.querySelector('.lf-mentor-screen')).not.toHaveAttribute('data-roleplay');
    expect(plate()).toBe('How much is left to save?');
  });

  it('gives an unseen customer the other part when no friend was invited', () => {
    vi.useFakeTimers();
    show(session({ phase: 'conversing', turn: turn({ seq: 4, roleplayScene: 'lemonade_change', audioPending: true }) }));
    expect(document.querySelector('.lf-mentor-plate-speaker')).toHaveTextContent(copy.mentorRoleplay.customer);
    expect(stageProps.at(-1)?.companionPose).toBeNull();
  });

  it('plays the pre-generated clips only in a session that speaks', () => {
    vi.useFakeTimers();
    const played: string[] = [];
    const Real = window.Audio;
    window.Audio = class { onended: (() => void) | null = null; constructor(src: string) { played.push(src); } play() { return Promise.resolve(); } pause() {} removeAttribute() {} } as unknown as typeof Audio;
    try {
      const { unmount } = show(session({ phase: 'conversing', companion: 'zara', turn: turn({ seq: 4, roleplayScene: 'lemonade_change', audioPending: true }) }));
      expect(played).toEqual([]);
      unmount();
      show(session({ phase: 'conversing', voice: true, companion: 'zara', turn: turn({ seq: 4, roleplayScene: 'lemonade_change', audioPending: true }) }));
      expect(played).toHaveLength(1);
      expect(played[0]).toMatch(/^https:\/\//);
    } finally { window.Audio = Real; }
  });

  it('ignores a scene id Oracle is not allowed to name', () => {
    show(session({ phase: 'conversing', turn: turn({ roleplayScene: 'invented' }) }));
    expect(document.querySelector('.lf-mentor-screen')).not.toHaveAttribute('data-roleplay');
  });
});

describe('the first visit (08 §8: the learner chooses)', () => {
  it('opens the chooser once, and closing it keeps and records the character shown', async () => {
    const chooseCharacter = vi.fn(async () => true);
    show(session({ personalized: false, chooseCharacter }));
    const dialog = screen.getByRole('dialog', { name: t.chooser.heading });
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: t.sheetClose })); });
    expect(chooseCharacter).toHaveBeenCalledWith('dina');
  });

  it('never opens it for a learner who has chosen before', () => {
    show(session());
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('the map fixture is a real graph', () => {
  it('has every state once', () => {
    expect(new Set(mapFixture('en-US').nodes.map((node) => node.state)).size).toBe(5);
  });
});

describe('W2M.4: the conversation layer (T1c), the close (T1d) and OD-28', () => {
  const conversing = (overrides: Partial<MentorScreenSession> = {}) => session({ phase: 'conversing', turn: turn({ seq: 3, next: 'close' }), ...overrides });

  it('offers "explain another way" once the lesson is under way, sent as the learner’s own words', () => {
    const sendText = vi.fn();
    show(conversing({ sendText }));
    fireEvent.click(screen.getByRole('button', { name: t.explain }));
    expect(sendText).toHaveBeenCalledWith(t.explain);
  });

  it('never shows more than three reply chips (08 §2)', () => {
    show(conversing({ turn: turn({ seq: 3, next: 'ask' }) }));
    const chips = within(screen.getByRole('group', { name: t.replyChips })).getAllByRole('button');
    expect(chips.map((chip) => chip.textContent)).toEqual([t.hint, t.tell, t.explain]);
  });

  it('OD-28: after the recap question, the only chip is "finish now", which leaves', () => {
    const endSession = vi.fn();
    show(conversing({ recapOpen: true, endSession, turn: turn({ seq: 4, next: 'ask' }) }));
    const chips = within(screen.getByRole('group', { name: t.replyChips })).getAllByRole('button');
    expect(chips.map((chip) => chip.textContent)).toEqual([t.finishNow]);
    fireEvent.click(chips[0]!);
    expect(endSession).toHaveBeenCalled();
  });

  it('changes the last message from the transcript, and the field sends it as an edit', () => {
    const editLast = vi.fn();
    const sendText = vi.fn();
    show(conversing({ editLast, sendText, history: [{ speaker: 'tutor', text: 'Hi', seq: 1 }, { speaker: 'learner', text: 'ten', seq: 2 }, { speaker: 'tutor', text: 'Why?', seq: 3 }] }));
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: t.transcript }));
    fireEvent.click(screen.getByRole('button', { name: t.editLast }));
    const field = screen.getByLabelText(t.editLabel) as HTMLInputElement;
    expect(field.value).toBe('ten');
    fireEvent.change(field, { target: { value: 'twenty' } });
    fireEvent.click(screen.getByRole('button', { name: t.send }));
    expect(editLast).toHaveBeenCalledWith('twenty');
    expect(sendText).not.toHaveBeenCalled();
  });

  it('starts over only after the learner confirms', () => {
    const restart = vi.fn();
    show(conversing({ restart }));
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: t.startOver }));
    expect(screen.getByRole('alertdialog', { name: t.startOverHeading })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t.keepGoing }));
    expect(restart).not.toHaveBeenCalled();
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: t.startOver }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: t.startOver }));
    expect(restart).toHaveBeenCalledTimes(1);
  });

  it('draws a live activity, reports the result to Oracle and shows it with the XP Core paid', async () => {
    const reportActivity = vi.fn();
    const gradeActivity = vi.fn(async () => ({ correct: true, score: 100, feedback: null, xpAwarded: 10, scoresXp: true, pedagogy: null }));
    const segment = { segmentId: 'seg-9', seq: 3, origin: 'catalog' as const, scoresXp: true, framing: '',
      segment: { type: 'true_false', prompt_md: 'True or false?', payload: { statement_md: 'Saving means keeping money for later.' } } };
    show(conversing({ reportActivity, gradeActivity, socket: live({ segment, lesson: { topic: null, step: 2, of: 4 } }) }));
    expect(screen.getByText(t.step.replace('{n}', '2').replace('{total}', '4'))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t.activityUi.true }));
    fireEvent.click(screen.getByRole('button', { name: t.activityUi.check }));
    await flush();
    expect(gradeActivity).toHaveBeenCalledWith('seg-9', { is_true: true }, 1);
    expect(reportActivity).toHaveBeenCalledWith(expect.objectContaining({ segmentId: 'seg-9', correct: true, attempt: 1 }));
    expect(screen.getByText(t.right)).toBeInTheDocument();
    expect(screen.getByText(t.xp.replace('{n}', '10'))).toBeInTheDocument();
  });

  it('T1d: the closing says the talk was saved to replay, never after a safety stop', () => {
    const history = [{ speaker: 'tutor' as const, text: 'Hi', seq: 1 }];
    const { unmount } = show(session({ phase: 'closing', history, closing: { sessionId: 's1', script: 'completed', effort: 'kept_going', topic: null, summary: null, xp: null } }));
    expect(screen.getByText(t.savedReplay)).toBeInTheDocument();
    unmount();
    show(session({ phase: 'closing', history, closing: { sessionId: 's1', script: 'safety_stop', effort: null, topic: null, summary: null, xp: null } }));
    expect(screen.queryByText(t.savedReplay)).toBeNull();
  });
});
