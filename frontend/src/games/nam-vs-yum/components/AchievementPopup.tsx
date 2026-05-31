import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { AchievementId } from '../types';
import { ACHIEVEMENTS } from '../constants';
import * as Icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface AchievementPopupProps {
  achievementId: AchievementId;
  onDismiss: () => void;
}

export function AchievementPopup({ achievementId, onDismiss }: AchievementPopupProps) {
  const { t } = useTranslation('games');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 50);
    const t2 = setTimeout(() => onDismiss(), 3500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onDismiss]);

  const def = ACHIEVEMENTS.find((a) => a.id === achievementId);
  if (!def) return null;

  const IconComponent = (Icons[def.icon as keyof typeof Icons] as LucideIcon) || Icons.Award;

  return (
    <div
      className={cn(
        'absolute top-16 left-1/2 -translate-x-1/2 pointer-events-auto',
        'transition-all duration-500',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      )}
      style={{ zIndex: 75 }}
      onClick={onDismiss}
    >
      <div className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-xl',
        'bg-gradient-to-r from-amber-600 to-yellow-500',
        'border-2 border-yellow-300 shadow-lg shadow-yellow-500/40',
        'animate-achievement-pop'
      )}>
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
          <IconComponent className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="pixel-font text-[8px] text-yellow-100 uppercase">
            {t('namVsYum.achievements.unlocked')}
          </p>
          <p className="pixel-font text-xs text-white">
            {t(`namVsYum.achievements.${achievementId}.title`)}
          </p>
          <p className="text-[9px] text-yellow-100/80">
            +{def.reward} 💰
          </p>
        </div>
      </div>
    </div>
  );
}
