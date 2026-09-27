import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Celebration, type Milestone } from './controls';
import { MotionAsset } from './MotionAsset';
import { resetCelebrationsForTest } from './motion';

/*
 * OD-28 (V-12), Frontend Bible 07 §5: a celebration motion asset plays once
 * only inside a closed-list milestone Celebration, shows its designated static
 * frame otherwise, and shows nothing at all outside the list.
 */

vi.mock('@lottiefiles/dotlottie-react', () => ({
  setWasmUrl: vi.fn(),
  DotLottieReact: (props: { src: string; loop?: boolean; autoplay?: boolean; className?: string }) =>
    <canvas data-testid="lottie" data-src={props.src} data-loop={String(props.loop)} data-autoplay={String(props.autoplay)} className={props.className} />,
}));

vi.mock('@lottiefiles/dotlottie-web/dotlottie-player.wasm?url', () => ({ default: '/assets/dotlottie-player.wasm' }));

const ID = 'celebration.lesson-complete.confetti';
const STILL = '/rebuild/motion/lesson-confetti-still.svg';

function preferMotion(allowed: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true, writable: true,
    value: (query: string) => ({
      matches: query.includes('no-preference') ? allowed : query.includes('reduce') ? !allowed : false,
      media: query, onchange: null, addEventListener: () => undefined, removeEventListener: () => undefined,
      addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false,
    }),
  });
}

beforeEach(() => resetCelebrationsForTest());
afterEach(() => { Reflect.deleteProperty(window, 'matchMedia'); });

describe('MotionAsset (07 §5, OD-7, OD-28 V-12)', () => {
  it('plays the registered Lottie once, never looping, while a milestone celebration plays', async () => {
    preferMotion(true);
    const { container } = render(<Celebration milestone="lesson-complete" momentId="m-1"><MotionAsset assetId={ID} /></Celebration>);
    const lottie = await screen.findByTestId('lottie');
    expect(lottie).toHaveAttribute('data-src', '/rebuild/motion/lesson-confetti.json');
    expect(lottie).toHaveAttribute('data-loop', 'false');
    expect(lottie).toHaveAttribute('data-autoplay', 'true');
    const holder = container.querySelector(`[data-asset-id="${ID}"]`);
    expect(holder).toHaveAttribute('aria-hidden', 'true');
    expect(holder?.textContent).toBe('');
  });

  it('shows the designated static frame under reduced motion and on a revisit', () => {
    preferMotion(false);
    const reduced = render(<Celebration milestone="lesson-complete" momentId="m-2"><MotionAsset assetId={ID} /></Celebration>);
    expect(reduced.container.querySelector('img')).toHaveAttribute('src', STILL);
    expect(reduced.container.querySelector('canvas')).toBeNull();
    reduced.unmount();
    preferMotion(true);
    render(<Celebration milestone="lesson-complete" momentId="m-3"><span /></Celebration>).unmount();
    const revisit = render(<Celebration milestone="lesson-complete" momentId="m-3"><MotionAsset assetId={ID} /></Celebration>);
    expect(revisit.container.querySelector('img')).toHaveAttribute('src', STILL);
  });

  it('shows nothing outside a celebration, off the milestone list, or for an unregistered id', () => {
    preferMotion(true);
    const outside = render(<MotionAsset assetId={ID} />);
    expect(outside.container.innerHTML).toBe('');
    const offList = render(<Celebration milestone={'correct-answer' as Milestone} momentId="m-4"><MotionAsset assetId={ID} /></Celebration>);
    expect(offList.container.querySelector('[data-asset-id], img, canvas')).toBeNull();
    const unknown = render(<Celebration milestone="lesson-complete" momentId="m-5"><MotionAsset assetId="celebration.lesson-complete.fireworks" /></Celebration>);
    expect(unknown.container.querySelector('[data-asset-id], img, canvas')).toBeNull();
    // Not a Lottie of the celebration family: a static SVG id is refused as a motion asset.
    const notMotion = render(<Celebration milestone="lesson-complete" momentId="m-6"><MotionAsset assetId={`${ID}-still`} /></Celebration>);
    expect(notMotion.container.querySelector('[data-asset-id], img, canvas')).toBeNull();
  });
});

describe('the lesson-complete confetti asset', () => {
  const publicDir = join(process.cwd(), 'public');
  const anim = JSON.parse(readFileSync(join(publicDir, 'rebuild/motion/lesson-confetti.json'), 'utf8')) as {
    fr: number; ip: number; op: number; w: number; h: number;
    layers: Array<{ ty: number; ks: { p: { k: Array<{ t: number; s: number[] }> } } }>;
  };

  it('bursts within the celebration budget and plays out well inside 3 s', () => {
    expect(anim.fr).toBe(60);
    expect((anim.op - anim.ip) / anim.fr).toBeLessThanOrEqual(0.9);
    for (const layer of anim.layers) {
      const keys = layer.ks.p.k;
      // The travel ends within 700 ms (--dur-celebration) of the start of the moment.
      expect(keys[keys.length - 1]!.t / anim.fr).toBeLessThanOrEqual(0.7);
    }
  });

  it('lands every piece inside the frame and above the burst origin (never on the heading, never widening a 320 px page)', () => {
    expect(anim.layers).toHaveLength(12);
    for (const layer of anim.layers) {
      expect(layer.ty).toBe(4);
      const [start, end] = [layer.ks.p.k[0]!.s, layer.ks.p.k[layer.ks.p.k.length - 1]!.s];
      expect(end[1]!).toBeLessThan(start[1]!);
      expect(end[0]!).toBeGreaterThanOrEqual(8);
      expect(end[0]!).toBeLessThanOrEqual(anim.w - 8);
      expect(end[1]!).toBeGreaterThanOrEqual(5);
    }
  });

  it('has a static frame that draws the same twelve pieces with no text', () => {
    const svg = readFileSync(join(publicDir, 'rebuild/motion/lesson-confetti-still.svg'), 'utf8');
    expect((svg.match(/<(?:circle|rect) /g) ?? [])).toHaveLength(12);
    expect(svg).not.toMatch(/<text|<image|gradient/i);
  });
});
