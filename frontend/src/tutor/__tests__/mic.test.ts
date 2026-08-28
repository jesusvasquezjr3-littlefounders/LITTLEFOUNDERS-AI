import { describe, expect, it } from 'vitest';
import { micBlockedForOffers, micBlockedReason, narrowBlockedReason, primaryOpening } from '../mic';
import type { TutorOffers } from '../types';

/*
 * The two answers the shell needs about the microphone, now that the orb has
 * one owner instead of two.
 *
 * Both of these used to live inside `OfferChips`, beside one of the two orbs.
 * Moving the orb to the stage moved the questions with it, and a second copy of
 * either is the kind of duplication that drifts in one direction only: the copy
 * nobody is looking at keeps saying yes after the original has started saying
 * no.
 */

const OFFERS: TutorOffers = {
  locale: 'en-US',
  lastSession: null,
  intelDegraded: false,
  canStart: true,
  startBlockedBy: null,
  voiceAvailable: true,
  microphoneBlockedBy: null,
  weakSkills: [],
  faqIds: [],
  canAskOpen: true,
};

describe('micBlockedReason', () => {
  it('reports policy first, because that is the order Core decides in', () => {
    // Telling a family to ask a grown-up when the answer would still be no
    // wastes their time and reads as a permission that does not work.
    expect(micBlockedReason(true, 'POLICY_BLOCKED')).toBe('POLICY_BLOCKED');
    expect(micBlockedReason(true, 'CONSENT_REQUIRED')).toBe('CONSENT_REQUIRED');
  });

  it('treats an unknown refusal as the voice one rather than as permission', () => {
    expect(micBlockedReason(true, 'SOMETHING_NEW')).toBe('VOICE_UNAVAILABLE');
    expect(micBlockedReason(false, null)).toBe('VOICE_UNAVAILABLE');
  });

  it('says nothing is wrong when nothing is', () => {
    expect(micBlockedReason(true, null)).toBeNull();
  });
});

describe('micBlockedForOffers', () => {
  it('dashes the orb when Oracle cannot open a session at all', () => {
    // An orb that looked pressable and did nothing is the same broken promise
    // as an orb that was not there.
    expect(micBlockedForOffers({ ...OFFERS, canStart: false })).toBe('VOICE_UNAVAILABLE');
  });

  it('leaves it live when a session and voice are both possible', () => {
    expect(micBlockedForOffers(OFFERS)).toBeNull();
  });

  it('keeps Core’s own reason rather than flattening it to the voice one', () => {
    expect(micBlockedForOffers({ ...OFFERS, microphoneBlockedBy: 'CONSENT_REQUIRED' })).toBe(
      'CONSENT_REQUIRED',
    );
  });
});

describe('narrowBlockedReason', () => {
  it('refuses a wire value it does not recognise', () => {
    expect(narrowBlockedReason('POLICY_BLOCKED')).toBe('POLICY_BLOCKED');
    expect(narrowBlockedReason('nonsense')).toBeNull();
    expect(narrowBlockedReason(null)).toBeNull();
  });
});

describe('primaryOpening', () => {
  it('opens a free conversation when this learner may have one', () => {
    expect(primaryOpening(OFFERS)).toEqual({ intent: 'open' });
  });

  it('falls back to the opening the first chip already offers', () => {
    // The orb must start something the learner can also see on screen, rather
    // than a fifth intent that exists only behind the microphone.
    expect(primaryOpening({ ...OFFERS, canAskOpen: false })).toEqual({ intent: 'course_topic' });
  });
});
