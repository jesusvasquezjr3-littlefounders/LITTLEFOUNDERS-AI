import { useTranslation } from 'react-i18next';
import type { GameState } from '../types';
import { GAME_CONFIG } from '../constants';

interface Props {
  state: GameState;
  onPause: () => void;
}

export default function GameHUD({ state, onPause }: Props) {
  const { t } = useTranslation('chronoBloom');

  const hpPct = state.greenhouseHp / state.maxGreenhouseHp;
  const hpColor =
    hpPct > 0.5 ? '#4ade80' :
    hpPct > 0.25 ? '#fb923c' :
    '#ef4444';
  const capitalClass =
    state.capital < 100 ? 'danger' :
    state.capital < 200 ? 'warning' :
    'gold';

  const inflated = state.inflationMultiplier > 1;

  return (
    <div className="cb-hud">
      {/* Capital */}
      <div className="cb-hud-stat" style={{ minWidth: 130 }}>
        <span style={{ fontSize: 14 }}>💰</span>
        <div>
          <div className="cb-hud-label">{t('hud.capital')}</div>
          <div className={`cb-hud-value ${capitalClass}`}>
            ${state.capital.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Year */}
      <div className="cb-hud-stat">
        <span style={{ fontSize: 14 }}>📅</span>
        <div>
          <div className="cb-hud-label">{t('hud.year')}</div>
          <div className="cb-hud-value">
            {state.year}<span style={{ color: 'rgba(74,222,128,0.5)', fontSize: 12 }}>/{GAME_CONFIG.maxYear}</span>
          </div>
        </div>
      </div>

      {/* Level */}
      <div className="cb-hud-stat">
        <span style={{ fontSize: 14 }}>🌿</span>
        <div>
          <div className="cb-hud-label">{t('hud.level')}</div>
          <div className="cb-hud-value">
            {state.level}<span style={{ color: 'rgba(74,222,128,0.5)', fontSize: 12 }}>/{GAME_CONFIG.maxLevel}</span>
          </div>
        </div>
      </div>

      {/* Greenhouse HP */}
      <div className="cb-hud-stat" style={{ flex: 1, minWidth: 160 }}>
        <span style={{ fontSize: 14 }}>🏡</span>
        <div style={{ flex: 1 }}>
          <div className="cb-hud-label">{t('hud.greenhouse')}</div>
          <div className="cb-hud-hp-bar">
            <div
              className="cb-hud-hp-fill"
              style={{
                width: `${Math.max(0, hpPct * 100)}%`,
                background: hpColor,
                boxShadow: `0 0 6px ${hpColor}80`,
              }}
            />
          </div>
          <div style={{
            fontFamily: '"Orbitron", monospace',
            fontSize: 9,
            color: hpColor,
            marginTop: 1,
          }}>
            {state.greenhouseHp} / {state.maxGreenhouseHp}
          </div>
        </div>
      </div>

      {/* Score */}
      <div className="cb-hud-stat">
        <span style={{ fontSize: 14 }}>⭐</span>
        <div>
          <div className="cb-hud-label">{t('hud.score')}</div>
          <div className="cb-hud-value gold">{state.score}</div>
        </div>
      </div>

      {/* Inflation badge */}
      {inflated && (
        <div className="cb-inflation-badge">
          🎈 +{Math.round((state.inflationMultiplier - 1) * 100)}% {t('hud.inflation')}
        </div>
      )}

      <div className="cb-hud-spacer" />

      {/* Pause */}
      <button
        className="cb-hud-pause-btn"
        onClick={onPause}
        disabled={state.phase !== 'PLAYING' && state.phase !== 'PLANNING'}
      >
        {state.phase === 'PLAYING' ? '⏸' : '▶'} {t('hud.pause')}
      </button>
    </div>
  );
}
