import { useTranslation } from 'react-i18next';

interface Props {
  timeLeft: number;
  maxTime: number;
}

export function TimerFuse({ timeLeft, maxTime }: Props) {
  const { t } = useTranslation('games');
  const pct = maxTime > 0 ? (timeLeft / maxTime) * 100 : 0;
  const isWarning = pct <= 30;
  const isCritical = pct <= 15;

  const fillColor = isCritical
    ? '#ef4444'
    : isWarning
    ? '#f97316'
    : '#fbbf24';

  const seconds = Math.ceil(timeLeft / 10);

  return (
    <div className="flex items-center gap-2 w-full">
      <span className="text-white/60 text-xs font-bold shrink-0">
        {t('paperCoin.hud.timerLabel')}
      </span>
      <div
        className={`pc-fuse-track flex-1 h-5 ${isWarning ? 'pc-fuse-warning' : ''}`}
      >
        <div
          className="pc-fuse-fill flex items-center pl-2"
          style={{
            width: `${pct}%`,
            background: isCritical
              ? 'linear-gradient(90deg, #dc2626, #ef4444)'
              : isWarning
              ? 'linear-gradient(90deg, #ea580c, #f97316)'
              : 'linear-gradient(90deg, #d97706, #fbbf24)',
            minWidth: pct > 5 ? '2rem' : '0',
            boxShadow: `0 0 8px ${fillColor}99`,
          }}
        />
      </div>
      <span
        className="shrink-0 text-sm font-black min-w-[1.8rem] text-right"
        style={{
          color: isCritical ? '#ef4444' : isWarning ? '#f97316' : '#fbbf24',
          animation: isCritical ? 'pcFusePulse 0.25s ease-in-out infinite' : undefined,
        }}
      >
        {seconds}s
      </span>
    </div>
  );
}
