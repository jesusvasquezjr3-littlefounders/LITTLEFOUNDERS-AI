import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { PowerUpType } from '../types';
import { POWER_UPS } from '../constants';

interface PowerUpIndicatorProps {
  activePowerUp: { type: PowerUpType; endsAt: number } | null;
}

export function PowerUpIndicator({ activePowerUp }: PowerUpIndicatorProps) {
  const { t } = useTranslation('games');
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!activePowerUp) {
      setTimeLeft(0);
      return;
    }

    const interval = setInterval(() => {
      const remaining = Math.max(0, activePowerUp.endsAt - Date.now());
      setTimeLeft(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 100);

    return () => clearInterval(interval);
  }, [activePowerUp]);

  if (!activePowerUp || timeLeft <= 0) return null;

  const def = POWER_UPS.find((p) => p.type === activePowerUp.type);
  if (!def) return null;

  const progress = timeLeft / def.durationMs;

  return (
    <div className="absolute top-12 left-1/2 -translate-x-1/2 pointer-events-none" style={{ zIndex: 60 }}>
      <div className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-full',
        'bg-black/60 backdrop-blur-sm border border-white/20',
        'animate-bounce-in'
      )}>
        <span className="text-lg">{def.emoji}</span>
        <span className="pixel-font text-[8px] text-white">
          {t(`namVsYum.powerUps.names.${activePowerUp.type}`)}
        </span>
        <div className="w-16 h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-400 transition-all duration-100"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
