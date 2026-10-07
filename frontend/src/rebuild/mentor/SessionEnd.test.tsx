import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { closingLine, SessionClosing, SessionEndChoice, type ClosingScript, type EffortAct, type SessionEndCopy } from './SessionEnd';
import { checkCopy, type CopyRole, type Locale } from '../design/copyBudget';
import en from '@/i18n/en-US/rebuild-mentor.json';
import es from '@/i18n/es-MX/rebuild-mentor.json';
import pt from '@/i18n/pt-BR/rebuild-mentor.json';

/*
 * C.8/C.12 and C.16 on the stage: the stop-or-continue offer is two EQUAL
 * choices and never a default; the closing state is chosen from how the
 * session ended, carries one summary line and one action, never celebrates,
 * and a safety stop shows no topic and no praise. Every string fits the Copy
 * Budget in all three locales for the youngest band.
 */

const COPIES: Record<Locale, SessionEndCopy> = {
  'en-US': en.mentorSessionEnd,
  'es-MX': es.mentorSessionEnd,
  'pt-BR': pt.mentorSessionEnd,
};
const SCRIPTS: ClosingScript[] = ['completed', 'interrupted', 'learner_left', 'safety_stop'];
const ACTS: EffortAct[] = ['corroborated', 'recovered', 'hint_then_solved', 'kept_going', 'talked_through', 'none'];

describe('SessionEndChoice — two equal choices, never a default', () => {
  it('offers stop and one-more with the same weight, and reports which was chosen', () => {
    const onChoose = vi.fn();
    render(<SessionEndChoice copy={en.mentorSessionEnd} locale="en-US" dark={false} onChoose={onChoose} />);
    const group = screen.getByRole('group', { name: en.mentorSessionEnd.choiceLabel });
    const buttons = group.querySelectorAll('button');
    expect(buttons).toHaveLength(2);
    // Same variant: neither is the highlighted "default".
    expect(buttons[0]!.className).toBe(buttons[1]!.className);
    for (const b of buttons) {
      expect(b).toHaveAttribute('data-copy-role', 'action');
      expect(b).not.toHaveAttribute('autofocus');
    }
    fireEvent.click(screen.getByRole('button', { name: en.mentorSessionEnd.more }));
    expect(onChoose).toHaveBeenLastCalledWith(false);
    fireEvent.click(screen.getByRole('button', { name: en.mentorSessionEnd.stop }));
    expect(onChoose).toHaveBeenLastCalledWith(true);
  });

  it('disables both choices together while an answer is in flight', () => {
    render(<SessionEndChoice copy={en.mentorSessionEnd} locale="en-US" dark disabled onChoose={vi.fn()} />);
    for (const b of screen.getAllByRole('button')) expect(b).toBeDisabled();
    expect(document.querySelector('[data-screen="mentor-session-end-choice"]')).toHaveAttribute('data-theme', 'dark');
  });
});

describe('SessionClosing — the closing state matches how the session ended', () => {
  it('names the observed act on a completed close, with the next topic as data and one action', () => {
    const onBack = vi.fn();
    render(<SessionClosing copy={en.mentorSessionEnd} locale="en-US" dark={false} script="completed" effort="recovered"
      topic="Saving for a goal" onBack={onBack} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(en.mentorSessionEnd.completedTitle);
    expect(screen.getByText(en.mentorSessionEnd.effort.recovered)).toHaveAttribute('data-copy-role', 'body');
    expect(screen.getByText('Saving for a goal')).toHaveAttribute('data-copy-role', 'data');
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]!);
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('names the interruption and the re-entry point on a budget close', () => {
    render(<SessionClosing copy={en.mentorSessionEnd} locale="en-US" dark={false} script="interrupted" effort={null}
      topic="Needs and wants" onBack={vi.fn()} />);
    expect(screen.getByRole('heading')).toHaveTextContent(en.mentorSessionEnd.interruptedTitle);
    expect(screen.getByText(en.mentorSessionEnd.interruptedNext)).toBeInTheDocument();
    expect(screen.getByText(en.mentorSessionEnd.nextLabel)).toBeInTheDocument();
    expect(screen.getByText('Needs and wants')).toBeInTheDocument();
  });

  it('gives a safety stop its own calm state: no topic, no praise, no effort line', () => {
    const view = render(<SessionClosing copy={en.mentorSessionEnd} locale="en-US" dark={false} script="safety_stop"
      effort="corroborated" topic="Saving for a goal" onBack={vi.fn()} />);
    expect(screen.getByRole('heading')).toHaveTextContent(en.mentorSessionEnd.safetyTitle);
    expect(screen.getByText(en.mentorSessionEnd.safetyBody)).toBeInTheDocument();
    expect(screen.queryByText('Saving for a goal')).toBeNull();
    for (const act of ACTS) expect(screen.queryByText(en.mentorSessionEnd.effort[act])).toBeNull();
    expect(view.container.textContent).not.toMatch(/!|great|well done/i);
  });

  it('every visible string declares a copy role', () => {
    const view = render(<SessionClosing copy={en.mentorSessionEnd} locale="en-US" dark={false} script="completed"
      effort="kept_going" topic="Coins" onBack={vi.fn()} />);
    const walker = document.createTreeWalker(view.container, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent?.trim()) continue;
      expect(node.parentElement?.closest('[data-copy-role]'), node.textContent).not.toBeNull();
    }
  });

  it('shows the session summary — the topics, the tricky one and the XP (closing summary)', () => {
    render(<SessionClosing copy={en.mentorSessionEnd} locale="en-US" dark={false} script="completed" effort="recovered"
      topic="Saving for a goal"
      summary={{ topics: ['Needs and wants', 'Saving'], struggledTopic: 'Needs and wants', struggleResolved: true, gradedCorrect: 3, gradedTotal: 4 }}
      xp={30} onBack={vi.fn()} />);
    expect(screen.getByText('Needs and wants, Saving')).toHaveAttribute('data-copy-role', 'data');
    expect(screen.getByText(en.mentorSessionEnd.summaryWorkedThrough)).toHaveAttribute('data-copy-role', 'body');
    expect(screen.getByText(/You earned 30 XP\./)).toHaveAttribute('data-copy-role', 'body');
  });

  it('shows no summary after a safety stop, even when one is provided', () => {
    render(<SessionClosing copy={en.mentorSessionEnd} locale="en-US" dark={false} script="safety_stop" effort={null}
      topic={null} summary={{ topics: ['Needs and wants'], struggledTopic: null, struggleResolved: false, gradedCorrect: 1, gradedTotal: 1 }}
      xp={10} onBack={vi.fn()} />);
    expect(screen.queryByText(en.mentorSessionEnd.summaryTopicsLabel, { exact: false })).toBeNull();
    expect(screen.queryByText('Needs and wants')).toBeNull();
    expect(screen.queryByText(/XP/)).toBeNull();
  });
});

describe('the copy fits the budget for ages 6–9 in every locale (Bible 06)', () => {
  const context = (locale: Locale) => ({ locale, ageBand: '6-9' as const, surface: 'app' as const });
  it.each(['en-US', 'es-MX', 'pt-BR'] as Locale[])('%s', (locale) => {
    const copy = COPIES[locale];
    const check = (text: string, role: CopyRole) => expect(checkCopy(text, role, context(locale)), `${role}: ${text}`).toEqual([]);
    check(copy.stop, 'action');
    check(copy.more, 'action');
    check(copy.backToPath, 'action');
    for (const script of SCRIPTS) {
      for (const act of ACTS) {
        const line = closingLine(copy, script, act, 'Topic');
        check(line.title, 'heading');
        check(line.body, 'body');
      }
    }
    check(copy.nextLabel, 'body');
    // The controlled glossary: the AI is never the "Tutor", coins never money.
    for (const text of JSON.stringify(copy).match(/"[^"]+"/g) ?? []) {
      expect(text).not.toMatch(/\bTutor\b|\bbot\b|assistant|asistente|assistente|streak/i);
    }
  });
});
