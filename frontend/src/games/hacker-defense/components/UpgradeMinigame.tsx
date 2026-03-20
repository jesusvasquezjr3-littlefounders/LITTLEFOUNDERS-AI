import { useTranslation } from 'react-i18next';
import type { UpgradeMinigame as UpgradeMinigameType } from '../types';
import { PASSWORD_OPTIONS } from '../constants';

interface Props {
  minigame: UpgradeMinigameType;
  onConfirm: (pw: { upper: string; lower: string; number: string; symbol: string }) => void;
  onCancel: () => void;
}

type Category = 'upper' | 'lower' | 'number' | 'symbol';

export default function UpgradeMinigame({ minigame, onConfirm, onCancel }: Props) {
  const { t } = useTranslation('games');

  const { selected } = minigame;
  const allSelected = selected.upper && selected.lower && selected.number && selected.symbol;

  const strengthLevel = [selected.upper, selected.lower, selected.number, selected.symbol].filter(Boolean).length;
  const strengthColors = ['#ff4444', '#ff8800', '#ffb400', '#00ff78'];
  const strengthLabels = [
    t('hackerDefense:upgrade.weak'),
    t('hackerDefense:upgrade.fair'),
    t('hackerDefense:upgrade.good'),
    t('hackerDefense:upgrade.strong'),
  ];

  const passwordPreview = [
    selected.upper || '_',
    selected.lower || '_',
    selected.number || '_',
    selected.symbol || '_',
  ].join('');

  const categories: Array<{ key: Category; labelKey: string; color: string }> = [
    { key: 'upper', labelKey: 'hackerDefense:upgrade.uppercase', color: '#64a0ff' },
    { key: 'lower', labelKey: 'hackerDefense:upgrade.lowercase', color: '#00ff78' },
    { key: 'number', labelKey: 'hackerDefense:upgrade.numbers', color: '#ffb400' },
    { key: 'symbol', labelKey: 'hackerDefense:upgrade.symbols', color: '#c864ff' },
  ];

  const handleSelect = (cat: Category, value: string) => {
    const newSelected = {
      ...selected,
      [cat]: selected[cat] === value ? null : value,
    };
    if (newSelected.upper && newSelected.lower && newSelected.number && newSelected.symbol) {
      onConfirm(newSelected as { upper: string; lower: string; number: string; symbol: string });
    }
  };

  return (
    <div className="hd-overlay">
      <div className="hd-card" style={{ maxWidth: 480 }}>
        <div className="hd-title" style={{ fontSize: 16, marginBottom: 4 }}>
          🔐 {t('hackerDefense:upgrade.title')} → Lv{minigame.targetLevel}
        </div>
        <div className="hd-subtitle" style={{ marginBottom: 16 }}>
          {t('hackerDefense:upgrade.subtitle')}
        </div>

        {/* Password preview */}
        <div className="hd-password-preview">{passwordPreview}</div>

        {/* Strength bar */}
        <div className="mb-4">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1 }}>
              {t('hackerDefense:upgrade.strengthLabel')}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: strengthColors[strengthLevel - 1] || 'rgba(255,255,255,0.3)' }}>
              {strengthLevel > 0 ? strengthLabels[strengthLevel - 1] : '—'}
            </span>
          </div>
          <div className="hd-strength-bar">
            <div
              className="hd-strength-fill"
              style={{
                width: (strengthLevel / 4) * 100 + '%',
                background: strengthColors[strengthLevel - 1] || 'transparent',
              }}
            />
          </div>
        </div>

        {/* Category rows */}
        {categories.map(cat => (
          <div key={cat.key} className="hd-upgrade-row">
            <div className="hd-upgrade-label" style={{ color: cat.color }}>
              {t(cat.labelKey)}
            </div>
            {PASSWORD_OPTIONS[cat.key].map(opt => (
              <button
                key={opt}
                className={`hd-upgrade-option ${selected[cat.key] === opt ? 'selected' : ''}`}
                onClick={() => handleSelect(cat.key, opt)}
                style={
                  selected[cat.key] === opt
                    ? { borderColor: cat.color, background: `${cat.color}22` }
                    : {}
                }
              >
                {opt}
              </button>
            ))}
          </div>
        ))}

        {/* Auto-confirms when all 4 selected, but also manual button */}
        <div className="flex gap-3 justify-center mt-4">
          <button
            onClick={onCancel}
            className="hd-btn hd-btn-secondary"
            style={{ fontSize: 12 }}
          >
            {t('hackerDefense:upgrade.cancel')}
          </button>
          <button
            className={`hd-btn ${allSelected ? 'hd-btn-primary' : 'hd-btn-secondary'}`}
            onClick={() => {
              if (allSelected) {
                onConfirm(selected as { upper: string; lower: string; number: string; symbol: string });
              }
            }}
            style={{ opacity: allSelected ? 1 : 0.4, cursor: allSelected ? 'pointer' : 'not-allowed' }}
            disabled={!allSelected}
          >
            {t('hackerDefense:upgrade.confirm')}
          </button>
        </div>

        <div
          style={{
            textAlign: 'center',
            fontSize: 11,
            color: 'rgba(255,255,255,0.3)',
            marginTop: 8,
          }}
        >
          {t('hackerDefense:upgrade.hint')}
        </div>
      </div>
    </div>
  );
}
