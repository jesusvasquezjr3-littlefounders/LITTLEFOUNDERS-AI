import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { cn } from '@/lib/utils';

interface LottieIconProps {
  name: 'streak' | 'lesson' | 'gold-coin' | 'time' | 'followers' | 'following' | 'loading';
  /** The associated value (e.g., streak days, coins, followers count). Determines if it's black (0). */
  value?: number;
  /** Whether the user has completed at least one lesson today. Determines default colors vs black & white. */
  activated?: boolean;
  className?: string;
}

export function LottieIcon({ name, value = 0, activated = false, className }: LottieIconProps) {
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
    filterClass = 'brightness-0';
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
