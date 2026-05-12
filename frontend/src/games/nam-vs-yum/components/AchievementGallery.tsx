import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { X, Lock } from 'lucide-react';
import type { PlayerProgress, AchievementId } from '../types';
import { ACHIEVEMENTS } from '../constants';
import * as Icons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface AchievementGalleryProps {
  progress: PlayerProgress;
  onClose: () => void;
}

export function AchievementGallery({ progress, onClose }: AchievementGalleryProps) {
  const { t } = useTranslation('games');

  const unlockedCount = Object.values(progress.achievements).filter((a) => a.unlocked).length;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-sm px-4" style={{ zIndex: 80 }}>
      <div className="w-full max-w-sm bg-slate-900/95 rounded-2xl border border-white/10 p-4 sm:p-6 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="pixel-font text-sm sm:text-base text-white retro-glow">
            {t('namVsYum.achievements.title')}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* Progress */}
        <p className="pixel-font text-[8px] text-white/50 mb-4 text-center">
          {unlockedCount} / {ACHIEVEMENTS.length} {t('namVsYum.achievements.unlockedCount')}
        </p>

        {/* Grid */}
        <div className="grid grid-cols-1 gap-2">
          {ACHIEVEMENTS.map((ach) => {
            const state = progress.achievements[ach.id];
            const isUnlocked = state?.unlocked;
            const IconComponent = (Icons[ach.icon as keyof typeof Icons] as LucideIcon) || Icons.Award;
            const progressPct = Math.min(100, (state?.progress / ach.target) * 100);

            return (
              <div
                key={ach.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl transition-all',
                  isUnlocked
                    ? 'bg-amber-900/30 border border-amber-500/30'
                    : 'bg-white/5 border border-white/10'
                )}
              >
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                  isUnlocked ? 'bg-amber-500/30' : 'bg-white/10'
                )}>
                  {isUnlocked ? (
                    <IconComponent className="w-5 h-5 text-amber-400" />
                  ) : (
                    <Lock className="w-4 h-4 text-white/30" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    'pixel-font text-[9px] sm:text-[10px]',
                    isUnlocked ? 'text-amber-300' : 'text-white/40'
                  )}>
                    {t(`namVsYum.achievements.${ach.id}.title`)}
                  </p>
                  <p className="text-[8px] sm:text-[9px] text-white/50 mt-0.5">
                    {t(`namVsYum.achievements.${ach.id}.description`)}
                  </p>
                  {!isUnlocked && (
                    <div className="mt-1.5 w-full h-1 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white/30 rounded-full transition-all"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  )}
                </div>
                <span className="pixel-font text-[8px] text-yellow-400 flex-shrink-0">
                  +{ach.reward}💰
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
