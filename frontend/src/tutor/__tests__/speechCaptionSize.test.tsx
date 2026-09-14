import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/*
 * THE "LARGE CAPTIONS" PREFERENCE, AND WHY ITS OWN FILE.
 *
 * `speechCaptionFloor.test.tsx` asserts the DEFAULT floor with a real
 * `captionSize` module (the preference off). This file mocks
 * `useCaptionLarge` to `true` for its entire run, so it cannot share that
 * file without silently changing what the default-floor tests exercise.
 */

const options = vi.hoisted(() => ({ last: null as Record<string, unknown> | null }));

vi.mock('@/tutor-scene/ScreenAnchor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/tutor-scene/ScreenAnchor')>();
  return {
    ...actual,
    useAnchorSlot: (slot: string, opts: Record<string, unknown> = {}) => {
      options.last = opts;
      return actual.useAnchorSlot(slot as never, opts as never);
    },
  };
});

vi.mock('../captionSize', () => ({ useCaptionLarge: () => true }));

const { SpeechCaption } = await import('../SpeechCaption');

describe('the caption honours the learner\'s "large captions" preference', () => {
  it('renders .lf-speech-lg, never alongside the base .lf-speech class', () => {
    const { container } = render(
      <SpeechCaption text="Vamos a contar monedas." turnSeq={1} instant />,
    );
    const node = container.querySelector('.lf-speech-lg');
    expect(node).not.toBeNull();
    expect(node?.className).not.toMatch(/(^|\s)lf-speech(\s|$)/);
  });

  it('raises the readability floor along with the base size, not just the starting point', () => {
    render(<SpeechCaption text="Vamos a contar monedas." turnSeq={1} instant />);
    // 18, the large floor — see SpeechCaption.tsx's MIN_SPEECH_PX_LARGE.
    expect(options.last?.minTextPx).toBe(18);
  });
});
