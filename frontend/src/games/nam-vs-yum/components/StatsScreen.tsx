import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { X, Trophy, Gamepad2, Target, Clock, Zap, TrendingUp, Award } from 'lucide-react';
import type { PlayerProgress } from '../types';

interface StatsScreenProps {
  progress: PlayerProgress;
  accuracy: number;
  onClose: () => void;
}

export function StatsScreen({ progress, accuracy, onClose }: StatsScreenProps) {
  const { t } = useTranslation('games');

  const formatTime = (ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${mins}m`;
  };

  const stats = [
    { icon: Gamepad2, label: t('namVsYum.stats.gamesPlayed'), value: progress.totalGamesPlayed },
    { icon: Trophy, label: t('namVsYum.stats.highScore'), value: progress.totalXp > 0 ? '—' : '—' }, // We don't track this directly, will compute from achievements
    { icon: Target, label: t('namVsYum.stats.totalItems'), value: progress.totalItemsSorted },
    { icon: Zap, label: t('namVsYum.stats.maxCombo'), value: `x${progress.maxComboEver}` },
    { icon: TrendingUp, label: t('namVsYum.stats.highestLevel'), value: progress.highestLevelReached },
    { icon: Clock, label: t('namVsYum.stats.timePlayed'), value: formatTime(progress.totalTimePlayedMs) },
    { icon: Target, label: t('namVsYum.stats.accuracy'), value: `${accuracy}%` },
    { icon: Award, label: t('namVsYum.stats.achievements'), value: `${Object.values(progress.achievements).filter((a) => a.unlocked).length} / 19` },
  ];

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-sm px-4" style={{ zIndex: 80 }}>
      <div className="w-full max-w-sm bg-slate-900/95 rounded-2xl border border-white/10 p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="pixel-font text-sm sm:text-base text-white retro-glow">
            {t('namVsYum.stats.title')}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* Player Level */}
        <div className="flex items-center justify-center gap-3 mb-6 p-3 bg-white/5 rounded-xl">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <span className="pixel-font text-lg text-white">{progress.playerLevel}</span>
          </div>
          <div>
            <p className="pixel-font text-[9px] text-white/60">{t('namVsYum.stats.playerLevel')}</p>
            <p className="pixel-font text-xs text-white">{progress.totalXp} / {progress.playerLevel * 100} XP</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center gap-1 p-3 bg-white/5 rounded-xl">
              <stat.icon className="w-4 h-4 text-cyan-400" />
              <span className="pixel-font text-xs text-white">{stat.value}</span>
              <span className="pixel-font text-[7px] text-white/50 text-center">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
