import { useTranslation } from 'react-i18next';
import type { GameState } from '../types';
import { GAME_CONFIG } from '../constants';

interface Props {
  state: GameState;
  onPause: () => void;
}

export default function GameHUD({ state, onPause }: Props) {
  const { t } = useTranslation('games');

  const { bankBalance, maxBankBalance, score, wave, level } = state;
  const balancePct = bankBalance / maxBankBalance;
  const isDanger = balancePct < 0.2;
  const isCaution = balancePct < 0.5;

  const barColor = isDanger
    ? '#ff3030'
    : isCaution
    ? '#ffb400'
    : '#00e060';

  const formattedBalance = bankBalance.toLocaleString();

  return (
    <div className="hd-hud">
      {/* Bank Balance */}
      <div className="hd-hud-bank">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="hd-bank-label">🏦 {t('hackerDefense:hud.bank')}</span>
          <span className={`hd-bank-amount ${isDanger ? 'danger' : ''}`}>
            ${formattedBalance}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div className="hd-bank-bar-bg">
            <div
              className="hd-bank-bar-fill"
              style={{
                width: `${Math.max(0, balancePct * 100)}%`,
                background: barColor,
              }}
            />
          </div>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>
            {Math.round(balancePct * 100)}%
          </span>
        </div>
      </div>

      {/* Wave Info */}
      <div className="hd-hud-wave">
        <span className="hd-wave-label">⚔️ {t('hackerDefense:hud.wave')}</span>
        <span className="hd-wave-text">{wave}/{GAME_CONFIG.maxWave}</span>
      </div>

      {/* Score */}
      <div className="hd-hud-score">
        <span className="hd-score-label">★ {t('hackerDefense:hud.score')}</span>
        <span className="hd-score-text">{score.toLocaleString()}</span>
      </div>

      {/* Level Progress */}
      <div className="hd-hud-level">
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, marginRight: 4 }}>
          {t('hackerDefense:hud.level')}
        </span>
        {[1, 2, 3].map(l => (
          <div
            key={l}
            className={`hd-level-dot ${l === level ? 'active' : l < level ? 'done' : ''}`}
          >
            {l < level ? '✓' : l}
          </div>
        ))}
      </div>

      {/* Pause Button */}
      <button className="hd-pause-btn" onClick={onPause} title={t('hackerDefense:hud.pause')}>
        ⏸
      </button>
    </div>
  );
}
