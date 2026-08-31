import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
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
  lastSession: null,
  intelDegraded: false,
  canStart: true,
  startBlockedBy: null,
  sessionCapResetAt: null,
  voiceAvailable: true,
  microphoneBlockedBy: null,
  weakSkills: [
    {
      skillKey: 'financial-education/ahorro-con-meta',
      title: null,
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
      map={null}
      // The guaranteed arrangement by default: with no canvas there is nothing
      // to anchor to, and a test that asserted against culled chips would be
      // asserting against an empty screen.
      ready={false}
      offers={{ ...OFFERS, ...offers }}
      starting={false}
      startError={null}
      startErrorResetAt={null}
      onStart={onStart}
      onPersonalize={vi.fn()}
      onReplay={vi.fn()}
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

beforeEach(async () => {
  vi.stubGlobal('Audio', SilentAudio);
  // Deterministic default: several tests below assert against real English
  // strings, and a test in an EARLIER file that changed the active language
  // and never changed it back must not leak into this one.
  await i18n.changeLanguage('en-US');
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

  it('leads with "continue where you left off" when a digest exists — and the FAQ yields its slot', () => {
    const { container, onStart } = renderChips({
      lastSession: {
        topic: 'Ahorro',
        courseId: '55555555-5555-4555-8555-555555555555',
        topicId: null,
        skillKey: 'money.saving',
        outcome: 'left',
        daysAgo: 1,
      },
    });

    // Continuity first, and still four chips: the curated question stood down.
    expect(openings(container)).toEqual(['continue', 'course_topic', 'weak_skill', 'open']);

    const chip = container.querySelector<HTMLButtonElement>('[data-opening="continue"]');
    expect(chip?.getAttribute('aria-label')).toContain('Ahorro');
    chip?.click();
    // Reopens the SAME ground: the ids the digest kept, as a course_topic start.
    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({ intent: 'course_topic', courseId: '55555555-5555-4555-8555-555555555555' }),
    );
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

  /*
   * tutor-review-sweep-92, session-cap-ux, MEDIUM. The OLD copy was a static
   * "come back tomorrow", with no clock time, no countdown, and no relation
   * to the local-midnight boundary Core actually computes for the reset — a
   * child with a weak sense of relative time cannot tell a 10-minute wait
   * from a 24-hour one from that sentence. `startErrorResetAt` is Core's own
   * computed reset instant; without this fix nothing on this component ever
   * read it, so it could not have changed what rendered here.
   *
   * Verified failing pre-fix, not merely reasoned about: `git stash` on
   * `OfferChips.tsx` and the three locale files (keeping this test) re-runs
   * the OLD code against the SAME props — it renders the fixed "tomorrow" /
   * "mañana" regardless of `startErrorResetAt`, so the assertions on the
   * concrete duration below fail for the exact reason this fix exists to
   * close; `git stash pop` restores the fix and they pass again.
   */
  describe('the SESSION_LIMIT refusal names a real time, not just "tomorrow"', () => {
    // A round 6 hours away, in UTC, so the arithmetic is identical regardless
    // of which locale's own clock is asked — only the WORDS should vary.
    const NOW = new Date('2026-08-30T18:00:00.000Z');
    const RESET_AT = new Date('2026-08-31T00:00:00.000Z').toISOString();

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(NOW);
    });

    it('renders a concrete duration in en-US ("in 6 hours"), not the old static "tomorrow"', () => {
      renderChips({}, { startError: 'SESSION_LIMIT', startErrorResetAt: RESET_AT });

      const lines = screen.getAllByRole('status').map((node) => node.textContent ?? '');
      const text = lines.join(' ');
      expect(text).toContain('in 6 hours');
      expect(text).not.toContain('tomorrow');
    });

    /*
     * The SAME props, a DIFFERENT active language — proving the duration is
     * genuinely produced by `Intl.RelativeTimeFormat(i18n.language, ...)`
     * rather than a hardcoded English string that happens to satisfy the
     * en-US assertion above. A fix that hardcodes "in 6 hours" and ignores
     * locale would pass the test above and fail only this one.
     */
    it('renders the SAME duration in es-MX ("dentro de 6 horas"), proving real per-locale formatting', async () => {
      await i18n.changeLanguage('es-MX');
      renderChips({}, { startError: 'SESSION_LIMIT', startErrorResetAt: RESET_AT });

      const lines = screen.getAllByRole('status').map((node) => node.textContent ?? '');
      const text = lines.join(' ');
      expect(text).toContain('dentro de 6 horas');
      expect(text).not.toContain('mañana');
      expect(text).not.toContain('in 6 hours');
    });

    it('renders the same duration in pt-BR ("em 6 horas") too', async () => {
      await i18n.changeLanguage('pt-BR');
      renderChips({}, { startError: 'SESSION_LIMIT', startErrorResetAt: RESET_AT });

      const lines = screen.getAllByRole('status').map((node) => node.textContent ?? '');
      const text = lines.join(' ');
      expect(text).toContain('em 6 horas');
      expect(text).not.toContain('amanhã');
    });

    it('falls back to the plain "tomorrow" copy when Core omits resetAt, rather than a broken "{{when}}"', () => {
      renderChips({}, { startError: 'SESSION_LIMIT', startErrorResetAt: null });

      const lines = screen.getAllByRole('status').map((node) => node.textContent ?? '');
      const text = lines.join(' ');
      expect(text).toContain('tomorrow');
      expect(text).not.toContain('{{when}}');
    });

    it('falls back to "tomorrow" when resetAt is already in the past (clock skew, a stale prop)', () => {
      renderChips(
        {},
        { startError: 'SESSION_LIMIT', startErrorResetAt: new Date('2026-08-30T00:00:00.000Z').toISOString() },
      );

      const lines = screen.getAllByRole('status').map((node) => node.textContent ?? '');
      const text = lines.join(' ');
      expect(text).toContain('tomorrow');
    });
  });

  /*
   * Found by adversarial review, round 99 (2026-08-31, HIGH), a sibling
   * finding of the backend fix that folds the daily cap into
   * `canStart`/`startBlockedBy` (`backend/src/routes/tutor.ts`). Before this
   * fix, `cannotServe` rendered "The tutor is resting" for ANY refusal,
   * which is wrong copy for a learner who simply used today's two sessions
   * — it reads as an outage rather than as the cap the product deliberately
   * enforces. The offer screen must tell the two apart on sight, not only
   * after a tap into `POST /sessions` bounces with the same code.
   *
   * These three run AFTER round 95's fix landed above, and reconcile with
   * it rather than duplicate it: `tutor.startError.SESSION_LIMIT` now needs
   * a `{{when}}` interpolation, so this proactive message reuses the SAME
   * `formatResetWhen` helper and `offers.sessionCapResetAt` (the offers
   * route's own `resetAt`, round 99) rather than the plain static word —
   * the fallback and the precise-duration cases are both exercised, so a
   * fix that renders a broken `{{when}}` here would fail visibly.
   */
  it('says the daily cap is spent, not that the tutor is resting, when startBlockedBy is SESSION_LIMIT', () => {
    const { container } = renderChips({ canStart: false, startBlockedBy: 'SESSION_LIMIT' }, { starting: true });

    for (const chip of container.querySelectorAll<HTMLElement>('[data-opening]')) {
      expect(chip).toBeDisabled();
    }
    const lines = screen.getAllByRole('status').map((node) => node.textContent ?? '');
    expect(lines.join(' ')).toContain("You've used today's tutor time. Come back tomorrow!");
    expect(lines.join(' ')).not.toContain('The tutor is resting');
  });

  it('names a real duration on the proactive cap message too, not just the post-tap one', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-30T18:00:00.000Z'));
    renderChips({
      canStart: false,
      startBlockedBy: 'SESSION_LIMIT',
      sessionCapResetAt: new Date('2026-08-31T00:00:00.000Z').toISOString(),
    });

    const lines = screen.getAllByRole('status').map((node) => node.textContent ?? '');
    const text = lines.join(' ');
    expect(text).toContain('in 6 hours');
    expect(text).not.toContain('tomorrow');
  });

  it('still says the tutor is resting for an ordinary Oracle outage, unrelated to the cap', () => {
    renderChips({ canStart: false, startBlockedBy: 'MODEL_UNAVAILABLE' }, { starting: true });

    const lines = screen.getAllByRole('status').map((node) => node.textContent ?? '');
    expect(lines.join(' ')).toContain('The tutor is resting');
    expect(lines.join(' ')).not.toContain("You've used today's tutor time");
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

  /*
   * Found by adversarial review, round 27 (2026-08-30, MEDIUM): `archive`
   * used to render ONLY inside the dock's portal (`{chipsIn && dockAbove ?
   * createPortal(...) : null}`), with no fallback for `!dockAbove` — unlike
   * its sibling `secondary`, which already had one. This component's OWN
   * comment says the dock "is absent... in a unit test", which is exactly
   * this render (no `StageDockContext` provider), so `dockAbove` is null
   * here — the same combination a live device hits if the dock's portal
   * target is ever unmounted or delayed. Pre-fix, tapping "Past
   * conversations" flipped the toggle's own `aria-expanded` and label with
   * no error, while the archive list itself never appeared anywhere on
   * screen — a control that looks like it worked and silently does nothing.
   */
  it('still shows the archive when toggled with no stage dock present', () => {
    vi.useFakeTimers();
    const { getByRole, queryByText } = renderChips({}, { ready: true });
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    const toggle = getByRole('button', { name: 'Past conversations' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    act(() => {
      toggle.click();
    });

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(queryByText('Your past conversations')).not.toBeNull();
  });
});
