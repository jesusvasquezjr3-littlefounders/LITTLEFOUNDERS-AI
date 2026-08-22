import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OfferChips } from '../OfferChips';
import type { TutorOffers } from '../types';

/*
 * The arrival screen, which the owner has rejected twice.
 *
 * These tests are about the three things a mistake here is visible to a LEARNER
 * rather than to a developer: the openings are a small closed set of controls
 * and not a reading exercise, the flagged-skill opening asks rather than tells,
 * and the microphone is present and honest instead of being a checkbox that
 * disappears when the answer is no.
 *
 * The in-scene arrangement needs a camera to hang off, so what runs here is the
 * component's own logic plus its guaranteed arrangement. The composition itself
 * is verified by looking at it, per the standing instruction on this project.
 */

/** jsdom has no media stack; a real `Audio` prints through the virtual console. */
class SilentAudio {
  volume = 1;
  currentTime = 0;
  loop = false;
  preload = '';
  paused = true;

  constructor(public src: string) {}

  play() {
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }
}

const OFFERS: TutorOffers = {
  locale: 'en-US',
  intelDegraded: false,
  canStart: true,
  startBlockedBy: null,
  voiceAvailable: true,
  microphoneBlockedBy: null,
  weakSkills: [
    {
      skillKey: 'financial-education/ahorro-con-meta',
      courseId: null,
      topicId: null,
      recommendedAction: 'practice',
      reasonCode: 'low_recent_accuracy',
    },
  ],
  faqIds: ['what_is_saving', 'why_prices_change'],
  canAskOpen: true,
};

function renderChips(offers: Partial<TutorOffers> = {}, props: Record<string, unknown> = {}) {
  const onStart = vi.fn();
  const view = render(
    <OfferChips
      phase="introducing"
      // The guaranteed arrangement by default: with no canvas there is nothing
      // to anchor to, and a test that asserted against culled chips would be
      // asserting against an empty screen.
      ready={false}
      offers={{ ...OFFERS, ...offers }}
      starting={false}
      startError={null}
      onStart={onStart}
      onPersonalize={vi.fn()}
      token="test-token"
      character="rho"
      nickname="Robi"
      {...props}
    />,
  );
  return { ...view, onStart };
}

/** Every opening chip, in the order a keyboard reaches them. */
function openings(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-opening]')).map(
    (node) => node.dataset.opening ?? '',
  );
}

beforeEach(() => {
  vi.stubGlobal('Audio', SilentAudio);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the openings', () => {
  it('is a small closed set of controls, not a grid of cards', () => {
    const { container } = renderChips();

    // Four ways in (/ORACLE.md §9.2), one chip each. The rejected version put
    // up to five Cards on screen, each with a title, a body paragraph and a
    // button whose label repeated its own title.
    expect(openings(container)).toEqual([
      'course_topic',
      'weak_skill',
      'faq:what_is_saving',
      'open',
    ]);

    for (const chip of container.querySelectorAll<HTMLElement>('[data-opening]')) {
      expect(chip.tagName).toBe('BUTTON');
      expect(chip.getAttribute('aria-label')?.trim()).toBeTruthy();
    }
  });

  it('offers the flagged skill by asking, and never shows the raw skill key', () => {
    const { container } = renderChips();
    const chip = container.querySelector<HTMLElement>('[data-opening="weak_skill"]');

    const name = chip?.getAttribute('aria-label') ?? '';
    // The offer PHRASING is what makes this an invitation rather than a
    // verdict, and the accessible name is where a screen reader hears it.
    expect(name).toContain('Ahorro con meta');
    expect(name).not.toContain('financial-education/');
    expect(chip?.textContent).not.toContain('financial-education/');
  });

  it('offers a short diagnostic when there is nothing to practise yet', () => {
    // Cold start is the NORMAL case right now: the courses sit in review, so
    // most learners carry almost no evidence. The tutor must not invent a
    // profile out of that.
    const { container } = renderChips({ weakSkills: [] });

    expect(openings(container)).toContain('diagnostic');
    expect(openings(container)).not.toContain('weak_skill');
    // Said in the tutor's own voice, by name, rather than posted as a banner
    // about our data. The key itself must never reach the screen.
    expect(container.textContent ?? '').toContain('Robi');
    expect(container.textContent ?? '').not.toContain('tutor.introduce.');
  });

  it('starts a session with voice on whenever voice is possible', () => {
    const { container, onStart } = renderChips();
    container.querySelector<HTMLElement>('[data-opening="course_topic"]')?.click();

    expect(onStart).toHaveBeenCalledWith({ intent: 'course_topic', wantsVoice: true });
  });

  it('never claims voice when Core has already said no', () => {
    const { container, onStart } = renderChips({ microphoneBlockedBy: 'CONSENT_REQUIRED' });
    container.querySelector<HTMLElement>('[data-opening="open"]')?.click();

    expect(onStart).toHaveBeenCalledWith({ intent: 'open', wantsVoice: false });
  });
});

describe('the microphone on the arrival screen', () => {
  /*
   * IT IS NOT MOUNTED HERE, AND THAT IS THE FIX.
   *
   * This layer used to mount an orb, and so did the conversation. Two owners
   * fixed two screens and left the other four — arrival, personalization, the
   * goodbye and the unavailable state — with no microphone in the DOM at all,
   * which is how the owner came to report, of a build that had TWO orbs in it,
   * that the microphone was nowhere to be seen. The stage owns the one orb now
   * (`stage/StageShell.tsx`); that it is present in every phase is asserted in
   * `stage/__tests__/stageMic.test.tsx`, and what a press of it starts is
   * asserted in `mic.test.ts`.
   */
  it('mounts no orb of its own, because the stage owns the only one', () => {
    const { container } = renderChips();
    // The orb is the one control on this route at 96 px; nothing else uses that
    // size, so its absence here is checkable without knowing its label.
    expect(container.querySelector('.h-24.w-24')).toBeNull();
    expect(screen.queryByRole('button', { name: /microphone unavailable/i })).toBeNull();
  });

  it('has replaced the checkbox that asked permission to speak out loud', () => {
    const { container } = renderChips();
    // "I want to talk out loud" as a tick box under a card grid is how the
    // microphone came to be invisible in the first place.
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
  });
});

describe('refusals', () => {
  it('says the tutor is resting, and disables every opening, when Core cannot serve', () => {
    const { container } = renderChips({ canStart: false }, { starting: true });

    for (const chip of container.querySelectorAll<HTMLElement>('[data-opening]')) {
      expect(chip).toBeDisabled();
    }
    const lines = screen.getAllByRole('status').map((node) => node.textContent ?? '');
    expect(lines.join(' ')).not.toContain('tutor.page.');
  });

  it('renders a start failure as a translated code, never as a wire message', () => {
    renderChips({}, { startError: 'SESSION_LIMIT' });

    const lines = screen.getAllByRole('status').map((node) => node.textContent ?? '');
    expect(lines.join(' ')).not.toContain('tutor.startError.');
    expect(lines.join(' ')).not.toContain('SESSION_LIMIT');
  });
});

describe('the arrival, once the island is on screen', () => {
  it('holds the openings back until the tutor has begun speaking, then lets them in', () => {
    vi.useFakeTimers();
    const { container } = renderChips({}, { ready: true });

    // The greeting is on screen first: chips that arrive with it read as a menu
    // opening rather than as the tutor thinking of things to do.
    expect(openings(container)).toHaveLength(0);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(openings(container)).toHaveLength(4);
  });
});
