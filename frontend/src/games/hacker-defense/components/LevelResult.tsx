import { useTranslation } from 'react-i18next';
import type { LevelStats } from '../types';
import { getRank } from '../constants';

interface Props {
  level: number;
  stats: LevelStats;
  maxBalance: number;
  score: number;
  isVictory?: boolean;
  onNext: () => void;
  onRestart: () => void;
}

export default function LevelResult({ level, stats, maxBalance, score, isVictory, onNext, onRestart }: Props) {
  const { t } = useTranslation('games');

  const balancePct = stats.bankBalanceEnd / stats.bankBalanceStart;
  const phishingTotal = stats.phishingDetected + stats.phishingMissed;
  const phishingAcc = phishingTotal > 0 ? stats.phishingDetected / phishingTotal : 1;
  const rank = getRank(balancePct, phishingAcc);

  const rankColors = { S: '#ffb400', A: '#00ff78', B: '#64a0ff', C: '#888' };

  return (
    <div className="hd-overlay">
      <div className="hd-card" style={{ maxWidth: 460 }}>
        {/* Rank Badge */}
        <div className={`hd-rank-badge hd-rank-${rank}`}>{rank}</div>

        <div className="hd-title" style={{ fontSize: 18, color: rankColors[rank] }}>
          {t('hackerDefense:levelResult.levelComplete', { level })}
        </div>

        <div className="hd-subtitle">
          {rank === 'S'
            ? t('hackerDefense:levelResult.rankS')
            : rank === 'A'
            ? t('hackerDefense:levelResult.rankA')
            : rank === 'B'
            ? t('hackerDefense:levelResult.rankB')
            : t('hackerDefense:levelResult.rankC')}
        </div>

        {/* Stats */}
        <div style={{ marginBottom: 16 }}>
          {[
            {
              label: t('hackerDefense:levelResult.bankSaved'),
              value: `$${stats.bankBalanceEnd.toLocaleString()}`,
              good: balancePct >= 0.7,
            },
            {
              label: t('hackerDefense:levelResult.phishingDetected'),
              value: `${stats.phishingDetected}/${phishingTotal}`,
              good: phishingAcc >= 0.7,
            },
            {
              label: t('hackerDefense:levelResult.inboxResult'),
              value: stats.inboxCorrect ? '✅' : '❌',
              good: stats.inboxCorrect,
            },
            {
              label: t('hackerDefense:levelResult.twoFASuccess'),
              value: `${stats.twoFASuccess}`,
              good: stats.twoFASuccess > 0,
            },
            {
              label: t('hackerDefense:levelResult.enemiesKilled'),
              value: stats.enemiesKilled,
              good: true,
            },
            {
              label: t('hackerDefense:levelResult.score'),
              value: score.toLocaleString(),
              good: true,
            },
          ].map(({ label, value, good }) => (
            <div className="hd-stat-row" key={label}>
              <span className="hd-stat-label">{label}</span>
              <span className={`hd-stat-value ${good ? 'good' : 'bad'}`}>{value}</span>
            </div>
          ))}
        </div>

        {/* Boss popups closed */}
        {stats.bossPopupsClosed > 0 && (
          <div
            style={{
              textAlign: 'center',
              fontSize: 12,
              color: 'rgba(255,180,0,0.8)',
              marginBottom: 12,
              background: 'rgba(255,180,0,0.06)',
              borderRadius: 10,
              padding: '8px 12px',
            }}
          >
            ⚡ {t('hackerDefense:levelResult.popupsClosed', { count: stats.bossPopupsClosed })}
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3 justify-center">
          <button onClick={onRestart} className="hd-btn hd-btn-secondary" style={{ fontSize: 12 }}>
            {t('hackerDefense:levelResult.restart')}
          </button>
          <button onClick={onNext} className="hd-btn hd-btn-primary">
            {level >= 3
              ? t('hackerDefense:levelResult.backToMenu')
              : t('hackerDefense:levelResult.nextLevel')}
          </button>
        </div>
      </div>
    </div>
  );
}
