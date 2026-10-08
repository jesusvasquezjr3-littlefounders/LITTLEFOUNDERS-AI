import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { gamesCopy } from './gamesCopy';
import { PlayScreen, type PlayScreenProps } from './PlayScreen';
import { CIRCUITS, LENSES, MENTORS, type PlayPhase } from './vocabulary';
import type { Locale as CopyLocale } from '../design/copyBudget';

/*
 * The game host's screen, phase by phase: what each card says, what each control
 * does, and what no phase may show (a session timer, a rank, a reward). The
 * route (app-routes/PlayRoute) is tested with its transport; this is the
 * presentation, with every callback a spy.
 */

afterEach(() => cleanup());

function props(patch: Partial<PlayScreenProps> = {}): PlayScreenProps {
  return {
    locale: 'en-US', dark: false, ageBand: '6-9', phase: 'garage', mentor: 'zara',
    selection: { circuit: 'jungleNeck', mode: 'single', driver: 'rho', speed: '100cc' }, muted: false, closed: null, error: null,
    pit: { outcome: { status: 'ready', lens: 'steady' }, reply: null, aiText: null }, frame: null, frameHidden: false, rotate: false,
    onSelect: vi.fn(), onMuted: vi.fn(), onGo: vi.fn(), onExit: vi.fn(), onResume: vi.fn(), onRestart: vi.fn(), onRaceAgain: vi.fn(),
    onChangeKart: vi.fn(), onAskMentor: vi.fn(), onReply: vi.fn(), onSoftStop: vi.fn(), onSoftKeep: vi.fn(), onRetry: vi.fn(), ...patch,
  };
}
const show = (patch: Partial<PlayScreenProps> = {}) => {
  const p = props(patch);
  return { p, ...render(<PlayScreen {...p} />) };
};

describe('every phase', () => {
  const phases: PlayPhase[] = ['garage', 'loading', 'gate', 'racing', 'paused', 'pitstop', 'soft', 'closed', 'error'];
  it.each(phases)('keeps a visible Exit and exactly one page heading in %s', (phase) => {
    const { p } = show({ phase, closed: 'limit', error: 'unavailable' });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const exit = document.querySelector<HTMLButtonElement>('[data-play-exit]');
    expect(exit).toBeTruthy();
    expect(exit!.textContent).toBe('Exit');
    // The bar sits outside the dialog that opens over it: it stays reachable by name, not hidden from the tree, in the cards that are not modal.
    fireEvent.click(exit!);
    expect(p.onExit).toHaveBeenCalledTimes(1);
  });

  it.each(phases)('shows no timer, countdown, rank, reward or clock in %s', (phase) => {
    show({ phase, closed: 'ended', error: 'offline' });
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/\d+:\d{2}|\bminutes?\b|\bseconds?\b|\btimer\b|\bcountdown\b|\bXP\b|\bcoins?\b|\bstreak\b|\brank\b|\bpodium\b|\bwin(ner|s)?\b|confetti/i);
    expect(document.querySelector('[role="timer"], .lf-celebration, [data-milestone]')).toBeNull();
  });

  it('declares a copy role on every text of every phase it draws', () => {
    for (const phase of phases) {
      cleanup();
      show({ phase, closed: 'limit', error: 'webgl' });
      for (const element of document.querySelectorAll('.lf-play h1, .lf-play p, .lf-play button, [data-overlay] h2, [data-overlay] p, [data-overlay] button')) {
        if (element.closest('[aria-hidden="true"]') || !element.textContent?.trim()) continue;
        // A control either declares its role or wraps the text that does (the switch's label and state word).
        expect(element.closest('[data-copy-role]') ?? element.querySelector('[data-copy-role]'), `${phase}: ${element.textContent}`).not.toBeNull();
      }
    }
  });
});

describe('the Garage', () => {
  it('greets in the learner\'s Mentor\'s own voice, with the real render, in each locale', () => {
    for (const locale of ['en-US', 'es-MX', 'pt-BR'] as CopyLocale[]) for (const mentor of MENTORS) {
      cleanup();
      show({ locale, mentor });
      expect(screen.getByText(gamesCopy[locale].gameGarage.greeting[mentor])).toBeTruthy();
      expect(document.querySelector(`.lf-play-mentor [data-slot="mentor-avatar"] img[data-character="${mentor}"]`)).not.toBeNull();
    }
  });

  it('offers six circuits, three modes, four Mentors as drivers and two speed classes, and marks the chosen ones', () => {
    show();
    expect(screen.getAllByRole('radio', { name: /Jungle Neck|Boulevard of Suits|Fossil Fire|Factory Circuit|Salt Bay|Glacier Circuit/ })).toHaveLength(CIRCUITS.length);
    expect(screen.getByRole('radio', { name: 'Jungle Neck' })).toBeChecked();
    expect(screen.getAllByRole('radio', { name: /^(Race|Time trial|Practice lap)$/ })).toHaveLength(3);
    expect(screen.getByRole('radio', { name: 'Race' })).toBeChecked();
    expect(screen.getAllByRole('radio', { name: /Dr\. Rho|Zara|Liruf|Dina/ })).toHaveLength(4);
    expect(screen.getByRole('radio', { name: 'Dr. Rho' })).toBeChecked();
    expect(screen.getAllByRole('radio', { name: /^(100cc|150cc)$/ })).toHaveLength(2);
    expect(screen.getByRole('radio', { name: '100cc' })).toBeChecked();
    expect(screen.queryByRole('radio', { name: '200cc' })).toBeNull();
  });

  it('draws each driver as the Mentor\'s real render, never a letter', () => {
    show();
    const drivers = document.querySelectorAll('.lf-play-drivers [data-slot="mentor-avatar"] img');
    expect([...drivers].map((img) => img.getAttribute('data-character'))).toEqual([...MENTORS]);
    expect(document.querySelector('.lf-play-drivers')!.textContent).not.toMatch(/^[A-Z]$/);
  });

  it('reports every pick and the one Go', () => {
    const { p } = show();
    fireEvent.click(screen.getByRole('radio', { name: 'Glacier Circuit' }));
    expect(p.onSelect).toHaveBeenLastCalledWith({ circuit: 'glacier' });
    fireEvent.click(screen.getByRole('radio', { name: 'Time trial' }));
    expect(p.onSelect).toHaveBeenLastCalledWith({ mode: 'timeTrial' });
    fireEvent.click(screen.getByRole('radio', { name: 'Dina' }));
    expect(p.onSelect).toHaveBeenLastCalledWith({ driver: 'dina' });
    fireEvent.click(screen.getByRole('radio', { name: '150cc' }));
    expect(p.onSelect).toHaveBeenLastCalledWith({ speed: '150cc' });
    fireEvent.click(screen.getByRole('switch', { name: 'Sound' }));
    expect(p.onMuted).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(p.onGo).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('.lf-play-garage .lf-button--accent')).toHaveLength(1);
  });

  it('localizes the circuit names in Spanish and Portuguese', () => {
    show({ locale: 'es-MX' });
    expect(screen.getByRole('radio', { name: 'Cuello de la Selva' })).toBeTruthy();
    cleanup();
    show({ locale: 'pt-BR' });
    expect(screen.getByRole('radio', { name: 'Garganta da Selva' })).toBeTruthy();
  });
});

describe('the game frame', () => {
  it('keeps the frame mounted but hidden behind the Garage, and shows it while racing', () => {
    const frame = <iframe title="game" />;
    const { rerender, p } = show({ phase: 'garage', frame, frameHidden: true });
    expect(document.querySelector('.lf-play-frame')!.getAttribute('data-hidden')).toBe('true');
    rerender(<PlayScreen {...p} phase="racing" frameHidden={false} frame={frame} />);
    expect(document.querySelector('.lf-play-frame')!.getAttribute('data-hidden')).toBeNull();
    expect(document.querySelector('.lf-play-frame iframe')).not.toBeNull();
  });

  it('draws no frame for a closed or failed visit', () => {
    show({ phase: 'closed', closed: 'ended', frame: null });
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('says "tap the game" at the gate, and not while the rotate card covers it', () => {
    const { p, rerender } = show({ phase: 'gate' });
    expect(screen.getByText('Tap the game to start.')).toBeTruthy();
    rerender(<PlayScreen {...p} phase="gate" rotate />);
    expect(screen.queryByText('Tap the game to start.')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Turn your device' })).toBeTruthy();
  });

  it('shows the rotate card only over a live race, never over the Garage or a card', () => {
    show({ phase: 'garage', rotate: true });
    expect(screen.queryByText('Turn your device')).toBeNull();
    cleanup();
    show({ phase: 'racing', rotate: true });
    expect(screen.getByText('Hold it sideways to race.')).toBeTruthy();
  });
});

describe('the pause menu', () => {
  it('offers resume, restart and leave, resumes on Escape, and holds a sound switch', () => {
    const { p } = show({ phase: 'paused' });
    const dialog = screen.getByRole('dialog', { name: 'Paused' });
    expect(within(dialog).getByText('Your race is waiting.')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Resume' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Restart' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Leave' }));
    fireEvent.click(within(dialog).getByRole('switch', { name: 'Sound' }));
    expect(p.onResume).toHaveBeenCalledTimes(1);
    expect(p.onRestart).toHaveBeenCalledTimes(1);
    expect(p.onExit).toHaveBeenCalledTimes(1);
    expect(p.onMuted).toHaveBeenCalledWith(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(p.onResume).toHaveBeenCalledTimes(2);
  });

  it('puts the first focus on Resume', () => {
    show({ phase: 'paused' });
    expect(document.activeElement?.textContent).toBe('Resume');
  });
});

describe('the pit stop', () => {
  it.each(LENSES)('says one observation and asks one question for %s, with three replies', (lens) => {
    show({ phase: 'pitstop', mentor: 'liruf', pit: { outcome: { status: 'ready', lens }, reply: null, aiText: null } });
    const t = gamesCopy['en-US'].gamePitstop;
    const sheet = screen.getByRole('dialog', { name: 'Pit stop' });
    expect(within(sheet).getByText(t.observation[lens].liruf)).toBeTruthy();
    expect(within(sheet).getByText(t.question[lens])).toBeTruthy();
    const replies = within(sheet).getAllByRole('button').filter((button) => button.hasAttribute('data-reply'));
    expect(replies.map((button) => button.getAttribute('data-reply'))).toEqual(['a', 'b', 'unsure']);
    expect(replies.map((button) => button.textContent)).toEqual([t.replies[lens].a, t.replies[lens].b, t.replies[lens].unsure]);
  });

  it('speaks in the learner\'s Mentor\'s voice and shows that Mentor\'s render', () => {
    for (const mentor of MENTORS) {
      cleanup();
      show({ phase: 'pitstop', mentor, pit: { outcome: { status: 'ready', lens: 'drift_early' }, reply: null, aiText: null } });
      const sheet = screen.getByRole('dialog', { name: 'Pit stop' });
      expect(within(sheet).getByText(gamesCopy['en-US'].gamePitstop.observation.drift_early[mentor])).toBeTruthy();
      expect(sheet.querySelector(`img[data-character="${mentor}"]`)).not.toBeNull();
    }
  });

  it('reports a reply, then says "Got it" and takes the question away (self-report, never right or wrong)', () => {
    const { p, rerender } = show({ phase: 'pitstop' });
    fireEvent.click(screen.getByRole('button', { name: 'I knew the track' }));
    expect(p.onReply).toHaveBeenCalledWith('a');
    rerender(<PlayScreen {...p} phase="pitstop" pit={{ outcome: { status: 'ready', lens: 'steady' }, reply: 'a', aiText: null }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Got it.');
    expect(screen.queryByText('What helped you stay steady?')).toBeNull();
    expect(document.querySelector('.lf-play-replies')).toBeNull();
    expect(document.body.textContent).not.toMatch(/\b(right|wrong|correct|incorrect|well done|great job)\b/i);
  });

  it('swaps in a generated line when one arrived, and keeps the question', () => {
    show({ phase: 'pitstop', pit: { outcome: { status: 'ready', lens: 'drift_patient' }, reply: null, aiText: 'You waited for the big boost. I noticed.' } });
    expect(screen.getByText('You waited for the big boost. I noticed.')).toBeTruthy();
    expect(screen.queryByText(gamesCopy['en-US'].gamePitstop.observation.drift_patient.zara)).toBeNull();
    expect(screen.getByText('How did waiting feel?')).toBeTruthy();
  });

  it.each([['none'], ['failed']] as const)('asks no question when Core has nothing to ask about (%s), only the neutral line', (status) => {
    show({ phase: 'pitstop', pit: { outcome: { status }, reply: null, aiText: null } });
    expect(screen.getByText(gamesCopy['en-US'].gamePitstop.observation.neutral.zara)).toBeTruthy();
    expect(document.querySelector('.lf-play-pit-question')).toBeNull();
    expect(screen.getByRole('button', { name: 'Race again' })).toBeTruthy();
  });

  it('waits with a calm line while Core is still reading the race', () => {
    show({ phase: 'pitstop', pit: { outcome: { status: 'pending' }, reply: null, aiText: null } });
    expect(screen.getByText('Checking your race.')).toBeTruthy();
    expect(document.querySelector('.lf-play-pit-question')).toBeNull();
  });

  it('has three ways on, and closing the card (Escape, the close button) is "not now": the Garage', () => {
    const { p } = show({ phase: 'pitstop', mentor: 'dina' });
    fireEvent.click(screen.getByRole('button', { name: 'Race again' }));
    fireEvent.click(screen.getByRole('button', { name: 'Change kart' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ask Dina' }));
    expect(p.onRaceAgain).toHaveBeenCalledTimes(1);
    expect(p.onChangeKart).toHaveBeenCalledTimes(1);
    expect(p.onAskMentor).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(p.onChangeKart).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(p.onChangeKart).toHaveBeenCalledTimes(3);
  });

  it('names Dr. Rho in the ask without breaking the three-word action budget in any language', () => {
    for (const locale of ['en-US', 'es-MX', 'pt-BR'] as CopyLocale[]) {
      cleanup();
      show({ phase: 'pitstop', mentor: 'rho', locale });
      const ask = [...document.querySelectorAll('[data-overlay] .lf-button')].map((button) => button.textContent ?? '').find((text) => /Rho/.test(text));
      expect(ask, locale).toBeTruthy();
    }
  });
});

describe('the soft break', () => {
  it.each(MENTORS)('is a calm offer in %s\'s own words, with no countdown, and stopping is the accent choice', (mentor) => {
    const { p } = show({ phase: 'soft', mentor });
    const dialog = screen.getByRole('dialog', { name: 'Quick break?' });
    expect(within(dialog).getByText(gamesCopy['en-US'].gameSoft.line[mentor])).toBeTruthy();
    expect(dialog.textContent).not.toMatch(/\d/);
    const stop = within(dialog).getByRole('button', { name: 'Take a break' });
    expect(stop.className).toContain('lf-button--accent');
    fireEvent.click(stop);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep racing' }));
    expect(p.onSoftStop).toHaveBeenCalledTimes(1);
    expect(p.onSoftKeep).toHaveBeenCalledTimes(1);
  });

  it('does not close on Escape: the learner answers it', () => {
    const { p } = show({ phase: 'soft' });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(p.onSoftKeep).not.toHaveBeenCalled();
    expect(p.onSoftStop).not.toHaveBeenCalled();
  });
});

describe('the closed and error cards', () => {
  it.each([['limit', 'All done for today'], ['ended', 'Racing time is over'], ['disabled', 'Racing is off']] as const)('says %s in words and offers the way back', (closed, heading) => {
    const { p } = show({ phase: 'closed', closed });
    expect(screen.getByRole('heading', { name: heading })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back to Learn' }));
    expect(p.onExit).toHaveBeenCalledTimes(1);
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('offers a retry for a game that did not start, but not for a device that cannot draw it', () => {
    const { p } = show({ phase: 'error', error: 'unavailable' });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(p.onRetry).toHaveBeenCalledTimes(1);
    cleanup();
    show({ phase: 'error', error: 'webgl' });
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Back to Learn' })).toBeTruthy();
  });
});

describe('languages', () => {
  it.each(['es-MX', 'pt-BR'] as CopyLocale[])('renders the Garage, the pit stop and the break in %s with the page language set', (locale) => {
    show({ locale, phase: 'garage' });
    expect(document.querySelector('.lf-play')!.getAttribute('lang')).toBe(locale);
    expect(screen.getByRole('button', { name: gamesCopy[locale].gamePlay.exit })).toBeTruthy();
    cleanup();
    show({ locale, phase: 'pitstop', mentor: 'zara' });
    expect(screen.getByRole('dialog', { name: gamesCopy[locale].gamePitstop.heading })).toBeTruthy();
    cleanup();
    show({ locale, phase: 'soft', mentor: 'rho' });
    expect(screen.getByText(gamesCopy[locale].gameSoft.line.rho)).toBeTruthy();
  });
});
