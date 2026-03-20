import { useTranslation } from 'react-i18next';
import type { TowerType } from '../types';
import { TOWER_DEFS } from '../constants';

interface Props {
  dataPoints: number;
  selectedTowerType: TowerType | null;
  onSelect: (type: TowerType | null) => void;
  actionCommandWindow: number;
}

const TOWERS: Array<{ type: TowerType; emojiKey: string; nameKey: string }> = [
  { type: 'password', emojiKey: '🔐', nameKey: 'hackerDefense:towers.password.name' },
  { type: 'antivirus', emojiKey: '🛡️', nameKey: 'hackerDefense:towers.antivirus.name' },
  { type: 'wall_2fa', emojiKey: '📱', nameKey: 'hackerDefense:towers.wall2fa.name' },
];

export default function TowerToolbar({
  dataPoints,
  selectedTowerType,
  onSelect,
  actionCommandWindow,
}: Props) {
  const { t } = useTranslation('games');

  return (
    <div className="hd-toolbar">
      {/* Label */}
      <div
        style={{
          fontSize: 9,
          color: 'rgba(255,255,255,0.4)',
          letterSpacing: 1,
          textTransform: 'uppercase',
          writingMode: 'vertical-rl',
          transform: 'rotate(180deg)',
          marginRight: 2,
        }}
      >
        {t('hackerDefense:toolbar.place')}
      </div>

      {/* Tower cards */}
      {TOWERS.map(({ type, emojiKey, nameKey }) => {
        const cost = TOWER_DEFS[type].cost;
        const canAfford = dataPoints >= cost;
        const selected = selectedTowerType === type;

        return (
          <button
            key={type}
            className={`hd-tower-card ${selected ? 'selected' : ''} ${!canAfford ? 'disabled' : ''}`}
            onClick={() => onSelect(selected ? null : type)}
            disabled={!canAfford && !selected}
          >
            <span className="hd-tower-card-emoji">{emojiKey}</span>
            <div className="hd-tower-card-info">
              <span className="hd-tower-card-name">{t(nameKey)}</span>
              <span className={`hd-tower-card-cost ${canAfford ? 'can-afford' : 'cannot-afford'}`}>
                💾 {cost}
              </span>
            </div>
            {selected && (
              <div
                style={{
                  position: 'absolute',
                  top: -3,
                  right: -3,
                  background: '#00ff78',
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  boxShadow: '0 0 6px rgba(0,255,120,0.8)',
                }}
              />
            )}
          </button>
        );
      })}

      {/* Action Command indicator */}
      <div
        style={{
          marginLeft: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          padding: '4px 10px',
          background: actionCommandWindow > 0
            ? 'rgba(255,220,0,0.15)'
            : 'rgba(255,255,255,0.04)',
          border: `1px solid ${actionCommandWindow > 0 ? 'rgba(255,220,0,0.5)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 10,
          transition: 'all 0.2s',
        }}
      >
        <span
          style={{
            fontSize: 18,
            filter: actionCommandWindow > 0 ? 'drop-shadow(0 0 8px rgba(255,220,0,0.8))' : 'none',
          }}
        >
          ⚡
        </span>
        <span
          style={{
            fontSize: 8,
            color: actionCommandWindow > 0 ? '#ffdd00' : 'rgba(255,255,255,0.3)',
            letterSpacing: 0.5,
            fontWeight: 700,
          }}
        >
          SPACE
        </span>
      </div>

      {/* Data Points display */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          padding: '4px 12px',
          background: 'rgba(100,160,255,0.08)',
          border: '1px solid rgba(100,160,255,0.25)',
          borderRadius: 10,
        }}
      >
        <span
          style={{
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 14,
            fontWeight: 700,
            color: '#64a0ff',
          }}
        >
          {dataPoints}
        </span>
        <span style={{ fontSize: 8, color: 'rgba(100,160,255,0.6)', letterSpacing: 0.5 }}>
          💾 {t('hackerDefense:hud.data')}
        </span>
      </div>
    </div>
  );
}
