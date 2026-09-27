import { DotLottieReact, setWasmUrl } from '@lottiefiles/dotlottie-react';
import lottieWasmUrl from '@lottiefiles/dotlottie-web/dotlottie-player.wasm?url';
import { cn } from '@/lib/utils';

/*
 * Serve the pinned player with the app so animations do not depend on a CDN.
 * Set on the first render, not at module scope: a module side effect would
 * keep this file (and the player) in any chunk that imports the
 * components/ui barrel, which is how it sat in the entry chunk (S10L.2).
 */
let wasmUrlSet = false;
function ensureWasmUrl() {
  if (wasmUrlSet) return;
  setWasmUrl(lottieWasmUrl);
  wasmUrlSet = true;
}

interface LottieIconProps {
  name: 'streak' | 'lesson' | 'gold-coin' | 'time' | 'followers' | 'following' | 'loading';
  /** The associated value (e.g., streak days, coins, followers count). Determines if it's black (0). */
  value?: number;
  /** Whether the user has completed at least one lesson today. Determines default colors vs black & white. */
  activated?: boolean;
  className?: string;
}

export function LottieIcon({ name, value = 0, activated = false, className }: LottieIconProps) {
  ensureWasmUrl();
  // loading.lottie never applies filters and ignores value/activated.
  const isLoading = name === 'loading';

  const isZero = value === 0 && !isLoading;
  const isBlackAndWhite = value > 0 && !activated && !isLoading;
  const isDefault = (activated && value > 0) || isLoading;

  // Streak special cases for hue-rotate
  const isBlueStreak = name === 'streak' && isDefault && value >= 100 && value < 365;
  const isPurpleStreak = name === 'streak' && isDefault && value >= 365;

  // Compute CSS filter based on states
  let filterClass = '';
  if (isZero) {
    // A dimmed, desaturated icon — NOT brightness-0. Pure black turned the
    // gold-coin into a solid black disc on the results screen (the single
    // most-photographed defect in the QA course), because a zero XP delta is
    // the normal state on any replay. Faded reads as "nothing gained", not
    // "broken".
    filterClass = 'grayscale opacity-40';
  } else if (isBlackAndWhite) {
    filterClass = 'grayscale';
  } else if (isBlueStreak) {
    // Rotate to blue
    filterClass = 'hue-rotate-180';
  } else if (isPurpleStreak) {
    // Rotate to purple
    filterClass = 'hue-rotate-[260deg]';
  }

  return (
    <div className={cn('relative flex items-center justify-center', filterClass, className)}>
      <DotLottieReact
        src={`/lottie/${name}.lottie`}
        loop
        autoplay
        className="w-full h-full object-contain"
      />
    </div>
  );
}
