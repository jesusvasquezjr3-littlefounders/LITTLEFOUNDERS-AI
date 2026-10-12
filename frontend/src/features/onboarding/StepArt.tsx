import { Loop } from '@/features/landing/LoopVideo';
import type { Scene } from '@/features/onboarding/steps';

/*
 * The composition of a step: a looping video of the mentors on their studio (or in the car, or
 * with the sunflower), made per color mode on the page's own color, so it sits on the page with no
 * border (docs/design/CHARACTER-COMPOSITIONS.md, the onboarding family). The poster shows at once,
 * and stays for anybody who asked for less motion or less data.
 *
 * The four together are a wide picture and one mentor alone a square one; the sizes are the
 * videos' own, so the page keeps their room before they load and nothing jumps. The video itself
 * is decorative; the words that describe it are on the element around it.
 */
const GROUP = { width: 1200, height: 800 };

const ALONE = { width: 900, height: 900 };

export function StepArt({ scene, alt, priority = false }: { scene: Scene; alt: string; priority?: boolean }) {
  const size = scene.startsWith('group') ? GROUP : ALONE;

  return <div role="img" aria-label={alt} className="pointer-events-none mx-auto w-fit max-w-full select-none">
    <Loop src={`/onboarding/loops/${scene}`} width={size.width} height={size.height} priority={priority}
      className="mx-auto block h-auto max-h-[34dvh] w-auto max-w-full object-contain lg:max-h-[74dvh]" />
  </div>;
}
