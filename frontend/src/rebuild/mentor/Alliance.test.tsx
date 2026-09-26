import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoalCheckChoice, type GoalCheckCopy } from './GoalCheck';
import { AllianceCheck, type AllianceCheckCopy } from './AllianceCheck';
import { DispositionSummary, type DispositionSummaryCopy } from './DispositionSummary';
import { getKidDisposition, postAllianceCheck, resetOwnDisposition, type DispositionSummaryData } from './allianceApi';
import { checkCopy, type Locale } from '../design/copyBudget';
import en from '@/i18n/en-US/rebuild-mentor.json';
import es from '@/i18n/es-MX/rebuild-mentor.json';
import pt from '@/i18n/pt-BR/rebuild-mentor.json';

/*
 * C.15 / C.7 surfaces: the goal chips, the end-of-session bond proxy and the
 * learner disposition profile. Equal chips, never a modal and never a default;
 * the bond proxy is never shown after a safety stop; nothing names a feeling;
 * the client API layer sends only closed values.
 */

const COPIES: Record<Locale, { goal: GoalCheckCopy; bond: AllianceCheckCopy; profile: DispositionSummaryCopy }> = {
  'en-US': { goal: en.mentorGoalCheck, bond: en.mentorAllianceCheck, profile: en.mentorProfile },
  'es-MX': { goal: es.mentorGoalCheck, bond: es.mentorAllianceCheck, profile: es.mentorProfile },
  'pt-BR': { goal: pt.mentorGoalCheck, bond: pt.mentorAllianceCheck, profile: pt.mentorProfile },
};
/** Whole words only: "sentence" and "pasadas" are not feelings. */
const FEELING = /(?<![\p{L}])(?:feel\p{L}*|sad|upset|bored|confus\p{L}*|frustr\p{L}*|sient\p{L}*|triste|aburrid\p{L}*|sente|chatead\p{L}*|mood|ánimo|humor)(?![\p{L}])/iu;

const PROFILE: DispositionSummaryData = {
  exists: true,
  current: false,
  sessionsObserved: 7,
  helpStyle: 'tell_early',
  persistence: 'disengages_early',
  explanation: 'needs_scaffold',
  persistentlyDeclined: ['less_text'],
  typicalReplySeconds: 9,
  personas: [{ character: 'dina', sessions: 7 }],
  effects: ['stuck_degrade_early'],
  updatedAt: '2026-08-01T00:00:00Z',
};

afterEach(() => vi.unstubAllGlobals());

describe('GoalCheckChoice — two equal chips under the goal restatement', () => {
  it('offers both answers with the same weight and reports which was chosen', () => {
    const onAnswer = vi.fn();
    render(<GoalCheckChoice copy={en.mentorGoalCheck} locale="en-US" dark={false} onAnswer={onAnswer} />);
    const chips = screen.getByRole('group', { name: en.mentorGoalCheck.choiceLabel }).querySelectorAll('button');
    expect(chips).toHaveLength(2);
    expect(chips[0]!.className).toBe(chips[1]!.className);
    for (const chip of chips) {
      expect(chip).toHaveAttribute('data-copy-role', 'option');
      expect(chip).not.toHaveAttribute('aria-pressed');
    }
    fireEvent.click(screen.getByRole('button', { name: en.mentorGoalCheck.other }));
    expect(onAnswer).toHaveBeenLastCalledWith(false);
    fireEvent.click(screen.getByRole('button', { name: en.mentorGoalCheck.agree }));
    expect(onAnswer).toHaveBeenLastCalledWith(true);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).not.toBe(chips[0]);
  });

  it('disables both chips together, in either theme', () => {
    render(<GoalCheckChoice copy={pt.mentorGoalCheck} locale="pt-BR" dark disabled onAnswer={vi.fn()} />);
    for (const chip of screen.getAllByRole('button')) expect(chip).toBeDisabled();
    expect(document.querySelector('[data-screen="mentor-goal-check"]')).toHaveAttribute('data-theme', 'dark');
  });
});

describe('AllianceCheck — the end-of-session bond proxy', () => {
  it('asks one question with three equal chips, then thanks once; nothing celebrates', async () => {
    const onAnswer = vi.fn(async () => 'recorded' as const);
    render(<AllianceCheck copy={en.mentorAllianceCheck} locale="en-US" dark={false} script="completed" onAnswer={onAnswer} />);
    expect(screen.getByText(en.mentorAllianceCheck.question)).toHaveAttribute('data-copy-role', 'prompt');
    const chips = screen.getByRole('group', { name: en.mentorAllianceCheck.choiceLabel }).querySelectorAll('button');
    expect(chips).toHaveLength(3);
    expect(new Set([...chips].map((c) => c.className)).size).toBe(1);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: en.mentorAllianceCheck.partly }));
    });
    expect(onAnswer).toHaveBeenCalledWith('partly');
    expect(screen.getByRole('status')).toHaveTextContent(en.mentorAllianceCheck.thanks);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(document.querySelector('[class*="celebrat"], [class*="confetti"]')).toBeNull();
  });

  it('is never shown after a safety stop', () => {
    const { container } = render(<AllianceCheck copy={en.mentorAllianceCheck} locale="en-US" dark={false} script="safety_stop" onAnswer={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('a failed save offers a retry of the same answer', async () => {
    const onAnswer = vi.fn(async () => 'failed' as const);
    render(<AllianceCheck copy={es.mentorAllianceCheck} locale="es-MX" dark script="interrupted" onAnswer={onAnswer} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: es.mentorAllianceCheck.no }));
    });
    expect(screen.getByRole('alert')).toHaveTextContent(es.mentorAllianceCheck.failed);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: es.mentorAllianceCheck.retry }));
    });
    expect(onAnswer).toHaveBeenNthCalledWith(2, 'no');
  });
});

describe('DispositionSummary — interpretable, closed labels only', () => {
  it('renders every row in plain words, flags a stale profile and offers the reset only where allowed', () => {
    const onReset = vi.fn();
    const { rerender } = render(<DispositionSummary copy={en.mentorProfile} locale="en-US" dark={false} audience="child" phase="ready" data={PROFILE} canReset onReset={onReset} />);
    expect(screen.getByRole('heading', { name: en.mentorProfile.titleChild })).toBeInTheDocument();
    expect(screen.getByText(en.mentorProfile.help.tell_early)).toBeInTheDocument();
    expect(screen.getByText(en.mentorProfile.persistence.disengages_early)).toBeInTheDocument();
    expect(screen.getByText(en.mentorProfile.adaptation.less_text)).toBeInTheDocument();
    expect(screen.getByText('About 9 seconds')).toBeInTheDocument();
    expect(screen.getByText(en.mentorProfile.notCurrent)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: en.mentorProfile.reset }));
    expect(onReset).toHaveBeenCalledTimes(1);
    for (const node of document.querySelectorAll('[data-screen="mentor-profile"] *')) {
      if (node.children.length === 0 && node.textContent) expect(node.closest('[data-copy-role]'), node.textContent).not.toBeNull();
    }
    rerender(<DispositionSummary copy={en.mentorProfile} locale="en-US" dark={false} audience="own" phase="ready" data={PROFILE} canReset={false} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('heading', { name: en.mentorProfile.titleOwn })).toBeInTheDocument();
  });

  it('distinguishes loading, failure and an empty profile', () => {
    const { rerender } = render(<DispositionSummary copy={en.mentorProfile} locale="en-US" dark={false} audience="own" phase="loading" data={null} canReset />);
    expect(screen.getByRole('status')).toHaveTextContent(en.mentorProfile.loading);
    rerender(<DispositionSummary copy={en.mentorProfile} locale="en-US" dark={false} audience="own" phase="failed" data={null} canReset />);
    expect(screen.getByRole('alert')).toHaveTextContent(en.mentorProfile.loadFailed);
    rerender(<DispositionSummary copy={en.mentorProfile} locale="en-US" dark={false} audience="own" phase="ready" data={{ ...PROFILE, exists: false }} canReset />);
    expect(screen.getByText(en.mentorProfile.empty)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('copy in three locales', () => {
  it.each(Object.entries(COPIES))('fits the Copy Budget and names no feeling in %s', (locale, copy) => {
    const ctx = { locale: locale as Locale, ageBand: '6-9' as const, surface: 'app' as const };
    for (const text of [copy.goal.agree, copy.goal.other, copy.bond.yes, copy.bond.partly, copy.bond.no]) {
      expect(checkCopy(text, 'option', ctx), text).toEqual([]);
      expect(text).not.toMatch(FEELING);
    }
    expect(checkCopy(copy.bond.question, 'prompt', ctx)).toEqual([]);
    expect(copy.bond.question).not.toMatch(FEELING);
    const all = JSON.stringify(copy.profile);
    expect(all).not.toMatch(FEELING);
    // "Tutor" is only the verified parent; the AI is the Mentor.
    expect(all).not.toMatch(/\bTutor\b/);
  });
});

describe('the client API layer sends only closed values', () => {
  it('posts the bond proxy and maps the refusals', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { recorded: true }, error: null }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await postAllianceCheck('tok', 'session-1', 'partly')).toBe('recorded');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/api/v1/tutor/sessions/session-1/alliance-check');
    expect(JSON.parse(String(init.body))).toEqual({ answer: 'partly' });
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({ data: null, error: { code: 'ALREADY_ANSWERED', message: 'x' } }), { status: 409 }));
    expect(await postAllianceCheck('tok', 'session-1', 'yes')).toBe('closed');
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({ data: null, error: { code: 'DATA_UNAVAILABLE', message: 'x' } }), { status: 502 }));
    expect(await postAllianceCheck('tok', 'session-1', 'yes')).toBe('failed');
  });

  it('reads a child’s profile and resets one’s own on the right paths', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: { reset: true }, error: null }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await getKidDisposition('tok', 'kid-1');
    await resetOwnDisposition('tok');
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    expect(calls[0]![0]).toContain('/api/v1/tutor/kids/kid-1/disposition');
    expect(calls[1]![0]).toContain('/api/v1/tutor/disposition');
    expect(calls[1]![1].method).toBe('DELETE');
  });
});
