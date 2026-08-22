import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/*
 * THE ONE FLOOR THAT IS NOT THE PROJECTOR'S DEFAULT.
 *
 * An anchored node is multiplied by its distance from the camera, and the only
 * thing under that multiplication is a per-node readability floor. The
 * projector's default is 12 px, which is right for the two-word label on a chip
 * — and every chip is held far above it by the 44 px tap floor anyway, because
 * a finger has to hit it.
 *
 * Nobody presses a caption. So on the caption the 12 was not a backstop, it was
 * the operating point: measured on `/dev/tutor-lab` at 375x812 with an
 * adaptation question up, the two-shot's stand-off clamped the tutor's spoken
 * line to exactly 12.0 px — below the 13.7 px a world chip's label renders at,
 * and below the 15 px `lf-action` the material guarantees any chrome caption —
 * while the same tutor's question, one plate below it in the dock, was 19 px.
 * One speaker, two voices, and the primary one was the whisper.
 *
 * /DESIGN.md §Lumen → Type calls 12 px on this layer "not a size, an apology",
 * has the stylesheet neutralise `lf-caption` to stop it reaching chrome, and
 * calls this node "the largest type on the stage after the character". The
 * depth scale was quietly reintroducing the apology on the one node all three
 * sentences are about, and the caption is the deaf learner's whole channel.
 *
 * Asserted here rather than in a screenshot because a screenshot only catches
 * it at the ONE camera distance somebody happened to photograph, and this is a
 * property of every distance the camera can reach.
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

const { SpeechCaption } = await import('../SpeechCaption');

/** `lf-action`, the size a CONTROL is set at on this layer (/DESIGN.md §Lumen → Type). */
const LF_ACTION_PX = 15;

describe('the tutor’s caption never shrinks to a whisper', () => {
  it('asks the projector for a floor no smaller than a control on the same layer', () => {
    render(<SpeechCaption text="Vamos a contar monedas." turnSeq={1} instant />);
    expect(options.last).not.toBeNull();
    expect(options.last?.minTextPx).toBeGreaterThanOrEqual(LF_ACTION_PX);
  });

  it('still clamps back into the frame rather than hiding, which is the older half of the rule', () => {
    render(<SpeechCaption text="Vamos a contar monedas." turnSeq={1} instant />);
    expect(options.last?.keepInFrame).toBe(true);
  });
});
