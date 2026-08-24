import { afterEach, describe, expect, it, vi } from 'vitest';
import { armAudioUnlock, audioIsUnlocked, resetAudioUnlockForTests } from './audioUnlock';

/*
 * THE DEFECT THIS PINS.
 *
 * The Tutor's whole opening is the character speaking BEFORE the learner has
 * touched anything, which is precisely what every browser autoplay policy
 * refuses. The refusal was swallowed by a bare `.catch()`, so the product was
 * silently silent on first load — for every learner, on every browser, every
 * time. The owner's report was "there are no voices, voice does not work for
 * anything", and this was why.
 *
 * These assert the two halves of the fix: a gesture earns the permission, and
 * a refusal is still reported rather than hidden.
 */

/** An audio element that refuses to play until `allow` is flipped. */
function fakeAudio(allow: { value: boolean }) {
  const node = {
    src: '',
    muted: false,
    paused: true,
    plays: 0,
    play: vi.fn(() => {
      node.plays += 1;
      return allow.value
        ? Promise.resolve()
        : Promise.reject(new DOMException('blocked', 'NotAllowedError'));
    }),
    pause: vi.fn(),
    removeAttribute: vi.fn(() => {
      node.src = '';
    }),
  };
  return node as unknown as HTMLAudioElement & { plays: number };
}

const gesture = () => window.dispatchEvent(new Event('pointerdown'));
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => resetAudioUnlockForTests());

describe('audio unlock', () => {
  it('is locked until a gesture happens', () => {
    const allow = { value: true };
    armAudioUnlock(fakeAudio(allow));
    // Arming alone must not claim permission the browser has not granted.
    expect(audioIsUnlocked()).toBe(false);
  });

  it('earns permission on the first gesture, whatever the gesture was for', async () => {
    const allow = { value: true };
    const node = fakeAudio(allow);
    armAudioUnlock(node);

    gesture();
    await settle();

    expect(audioIsUnlocked()).toBe(true);
    expect(node.plays).toBe(1);
  });

  it('restores the element so the first real line does not reload', async () => {
    // Priming with a different src and leaving it there would make the next
    // turn's assignment a change the browser refetches — a stall on the one
    // line where a delay is most visible.
    const allow = { value: true };
    const node = fakeAudio(allow);
    node.src = 'https://example.invalid/line.mp3';
    armAudioUnlock(node);

    gesture();
    await settle();

    expect(node.src).toBe('https://example.invalid/line.mp3');
    expect(node.muted).toBe(false);
  });

  it('stops listening once unlocked, so a remounting stage cannot pile up work', async () => {
    const allow = { value: true };
    const node = fakeAudio(allow);
    armAudioUnlock(node);

    gesture();
    await settle();
    gesture();
    gesture();
    await settle();

    expect(node.plays).toBe(1);
  });

  it('stays armed when the browser refuses, and succeeds on a later gesture', async () => {
    // iOS low-power mode, a hard block, a muted device: the first gesture can
    // fail. Giving up would leave the learner permanently silent with no way
    // back, which is the original defect wearing a different hat.
    const allow = { value: false };
    const node = fakeAudio(allow);
    armAudioUnlock(node);

    gesture();
    await settle();
    expect(audioIsUnlocked()).toBe(false);

    allow.value = true;
    gesture();
    await settle();
    expect(audioIsUnlocked()).toBe(true);
  });

  it('does nothing without an element, rather than throwing', () => {
    expect(() => armAudioUnlock(null)).not.toThrow();
    expect(armAudioUnlock(null)).toBeTypeOf('function');
  });
});
