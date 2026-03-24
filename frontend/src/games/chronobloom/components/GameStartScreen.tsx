import { useTranslation } from 'react-i18next';
import type { GameState } from '../types';

interface Props {
  state: GameState;
  onStart: () => void;
}

const ENEMY_PREVIEWS = [
  { emoji: '🐜', nameKey: 'enemies.ant_expense.name', color: '#78350f' },
  { emoji: '👹', nameKey: 'enemies.impulsive_beast.name', color: '#ef4444' },
  { emoji: '🎈', nameKey: 'enemies.inflation_zeppelin.name', color: '#f59e0b' },
  { emoji: '👑', nameKey: 'enemies.deficit_king.name', color: '#7c3aed' },
];

const PLANT_PREVIEWS = [
  { emoji: '🌱', nameKey: 'plants.savings_sprout.name', color: '#4ade80' },
  { emoji: '🌳', nameKey: 'plants.stock_tree.name', color: '#a78bfa' },
  { emoji: '🌿', nameKey: 'plants.div_vine.name', color: '#34d399' },
  { emoji: '🌵', nameKey: 'plants.emergency_cactus.name', color: '#fb923c' },
];

export default function GameStartScreen({ state, onStart }: Props) {
  const { t } = useTranslation('chronoBloom');

  return (
    <div className="cb-overlay" style={{ background: 'transparent' }}>
      <div className="cb-start-bg" />
      <div style={{ position: 'relative', textAlign: 'center', padding: '20px 30px' }}>
        {/* Decorative plants */}
        <div style={{ fontSize: 30, marginBottom: 6, letterSpacing: 8 }}>
          🌱 🌿 🌳 🌵 🌿 🌱
        </div>

        <div className="cb-start-title">
          {t('start.title')}
        </div>
        <div className="cb-start-title-sub">
          {t('start.codename')}
        </div>

        <p style={{
          fontFamily: '"Nunito", sans-serif',
          fontSize: 13,
          color: 'rgba(134,239,172,0.75)',
          maxWidth: 440,
          margin: '0 auto 20px',
          lineHeight: 1.6,
        }}>
          {t('start.description')}
        </p>

        {/* Plants you'll use */}
        <div style={{ marginBottom: 16 }}>
          <p style={{
            fontFamily: '"Orbitron", monospace',
            fontSize: 9,
            color: 'rgba(74,222,128,0.6)',
            letterSpacing: 2,
            textTransform: 'uppercase',
            marginBottom: 8,
          }}>
            {t('start.yourPlants')}
          </p>
          <div className="cb-start-enemies-preview">
            {PLANT_PREVIEWS.map(p => (
              <div key={p.nameKey} className="cb-enemy-preview-chip">
                <span style={{ fontSize: 24 }}>{p.emoji}</span>
                <span style={{ color: p.color, fontWeight: 700 }}>{t(p.nameKey)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Enemies you'll face */}
        <div style={{ marginBottom: 24 }}>
          <p style={{
            fontFamily: '"Orbitron", monospace',
            fontSize: 9,
            color: 'rgba(239,68,68,0.6)',
            letterSpacing: 2,
            textTransform: 'uppercase',
            marginBottom: 8,
          }}>
            {t('start.enemiesYoullFace')}
          </p>
          <div className="cb-start-enemies-preview">
            {ENEMY_PREVIEWS.map(e => (
              <div key={e.nameKey} className="cb-enemy-preview-chip" style={{ borderColor: `${e.color}40` }}>
                <span style={{ fontSize: 24 }}>{e.emoji}</span>
                <span style={{ color: e.color, fontWeight: 700 }}>{t(e.nameKey)}</span>
              </div>
            ))}
          </div>
        </div>

        {state.highScore > 0 && (
          <p style={{
            fontFamily: '"Orbitron", monospace',
            fontSize: 11,
            color: '#ffd700',
            marginBottom: 16,
          }}>
            🏆 {t('start.highScore')}: {state.highScore}
          </p>
        )}

        <button className="cb-btn-primary" style={{ fontSize: 22 }} onClick={onStart}>
          🌱 {t('start.playButton')}
        </button>

        <p style={{
          fontFamily: '"Nunito", sans-serif',
          fontSize: 10,
          color: 'rgba(134,239,172,0.4)',
          marginTop: 14,
        }}>
          {t('start.clickHint')}
        </p>
      </div>
    </div>
  );
}
