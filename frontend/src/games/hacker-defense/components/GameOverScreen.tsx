import { useTranslation } from 'react-i18next';
import type { GameState } from '../types';

interface Props {
  state: GameState;
  onRestart: () => void;
}

export default function GameOverScreen({ state, onRestart }: Props) {
  const { t } = useTranslation('games');

  const isNewHighScore = state.score > 0 && state.score >= state.highScore;

  return (
    <div className="hd-overlay">
      <div className="hd-card" style={{ maxWidth: 420, textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>💀</div>

        <div className="hd-gameover-title">{t('hackerDefense:gameOver.title')}</div>

        <div
          style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 13,
            color: '#ff4444',
            marginBottom: 20,
            letterSpacing: 1,
          }}
        >
          {t('hackerDefense:gameOver.subtitle')}
        </div>

        {/* Stats */}
        <div
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
            padding: '14px 20px',
            marginBottom: 18,
          }}
        >
          {[
            {
              label: t('hackerDefense:gameOver.levelReached'),
              value: `${state.level} / 3`,
            },
            {
              label: t('hackerDefense:gameOver.waveReached'),
              value: `${state.wave} / 5`,
            },
            {
              label: t('hackerDefense:gameOver.finalScore'),
              value: state.score.toLocaleString(),
            },
            {
              label: t('hackerDefense:gameOver.highScore'),
              value: state.highScore.toLocaleString(),
            },
          ].map(({ label, value }) => (
            <div className="hd-stat-row" key={label}>
              <span className="hd-stat-label">{label}</span>
              <span className="hd-stat-value">{value}</span>
            </div>
          ))}
        </div>

        {isNewHighScore && (
          <div
            style={{
              marginBottom: 16,
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 13,
              color: '#ffdd00',
              letterSpacing: 1,
              textShadow: '0 0 12px rgba(255,220,0,0.5)',
              animation: 'hd-logo-pulse 1s infinite alternate',
            }}
          >
            ★ {t('hackerDefense:gameOver.newRecord')} ★
          </div>
        )}

        <div
          style={{
            fontSize: 12,
            color: 'rgba(255,255,255,0.5)',
            marginBottom: 20,
            lineHeight: 1.5,
          }}
        >
          {t('hackerDefense:gameOver.tip')}
        </div>

        <button onClick={onRestart} className="hd-btn hd-btn-primary" style={{ width: '100%', fontSize: 15 }}>
          {t('hackerDefense:gameOver.tryAgain')}
        </button>
      </div>
    </div>
  );
}
