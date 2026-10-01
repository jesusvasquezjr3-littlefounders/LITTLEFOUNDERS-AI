import { act, fireEvent, waitFor } from '@testing-library/react';
import { expect, vi } from 'vitest';

/** JSDOM does not decode images; model the approved still loading before live 3D starts. */
export async function paintApprovedStill() {
  const image = document.querySelector<HTMLImageElement>('.lf-mentor-stage-still');
  if (!image) throw new Error('Approved Mentor still is missing');
  Object.defineProperties(image, {
    complete: { configurable: true, value: true },
    naturalWidth: { configurable: true, value: 375 },
  });
  fireEvent.load(image);
  if (vi.isFakeTimers()) {
    await act(async () => { await vi.advanceTimersByTimeAsync(48); });
  } else {
    await waitFor(() => expect(document.querySelector<HTMLElement>('.lf-mentor-stage')?.dataset.visualReady).toBe('true'));
  }
}
