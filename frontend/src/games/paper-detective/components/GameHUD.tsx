import { useTranslation } from 'react-i18next';
import { GAME_CONFIG } from '../constants';

interface Props {
  score: number;
  comboCount: number;
  comboMultiplier: number;
  dayNumber: number;
  timeLeft: number;
  maxTime: number;
  onPause: () => void;
}

export function GameHUD({ score, comboCount, comboMultiplier, dayNumber, timeLeft, maxTime, onPause }: Props) {
  const { t } = useTranslation('games');

  const timePercent = Math.max(0, (timeLeft / maxTime) * 100);
  const isLow = timePercent < 25;
  const isCritical = timePercent < 10;

  const fuseColor = isCritical
    ? '#e74c3c'
    : isLow
    ? '#e67e22'
    : timePercent < 50
    ? '#f1c40f'
    : '#27ae60';

  const showCombo = comboMultiplier > 1;

  return (
    <div className="absolute top-0 left-0 right-0 z-10 flex items-center gap-2 px-3 pt-2 pb-1 pd-font"
      style={{ background: 'rgba(0,0,0,0.15)', backdropFilter: 'blur(4px)' }}>

      {/* Score */}
      <div className="pd-card px-2 py-1 flex items-center gap-1 flex-shrink-0">
        <span className="text-xs font-bold text-blue-700">🏅</span>
        <span className="text-sm font-black text-blue-900 tabular-nums">{score}</span>
      </div>

      {/* Combo badge */}
      {showCombo && (
        <div className="pd-combo-badge flex-shrink-0">
          <div className="pd-card px-2 py-1 text-center"
            style={{ background: '#f39c12', borderColor: '#d68910' }}>
            <span className="text-xs font-black text-white">
              {t('paperDetective.hud.comboMultiplier', { multiplier: comboMultiplier })}
            </span>
          </div>
        </div>
      )}

      {/* Fuse / Timer — expands to fill available space */}
      <div className="flex-1 flex flex-col gap-0.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-blue-800">
            🧨 {t('paperDetective.hud.timeLabel')}
          </span>
          <span className="text-xs font-bold text-blue-700">
            {t('paperDetective.hud.day', { day: dayNumber })}
          </span>
        </div>
        <div className="pd-fuse-track h-4 relative">
          <div
            className="pd-fuse-fill"
            style={{
              width: `${timePercent}%`,
              background: fuseColor,
            }}
          />
          {/* Spark at the end */}
          {timePercent > 2 && (
            <span
              className="absolute top-1/2 -translate-y-1/2 text-sm pointer-events-none"
              style={{
                left: `calc(${timePercent}% - 10px)`,
                filter: `drop-shadow(0 0 4px ${fuseColor})`,
                animation: 'spark-flicker 0.3s ease-in-out infinite alternate',
              }}
            >
              ✨
            </span>
          )}
        </div>
      </div>

      {/* Pause button */}
      <button
        onClick={onPause}
        className="pd-btn px-2 py-1 text-xs font-bold flex-shrink-0"
        aria-label={t('paperDetective.hud.pause')}
      >
        ⏸
      </button>
    </div>
  );
}
