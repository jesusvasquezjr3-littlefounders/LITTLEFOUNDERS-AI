import { useTranslation } from 'react-i18next';
import type { GameState, Plant } from '../types';
import { PLANT_DEFS, GAME_CONFIG, getCellCenter, CANVAS_W, CANVAS_H, HUD_H, TOOLBAR_H } from '../constants';

interface Props {
  plant: Plant;
  state: GameState;
  scale: number;
  onLiquidate: () => void;
  onUnfreeze: () => void;
  onClose: () => void;
}

export default function PlantInfoPanel({ plant, state, scale, onLiquidate, onUnfreeze, onClose }: Props) {
  const { t } = useTranslation('chronoBloom');
  const def = PLANT_DEFS[plant.type];

  const { cx, cy } = getCellCenter(plant.col, plant.row);

  // Position panel near the plant but keep within bounds
  const scaleOffset = ((window.innerWidth - CANVAS_W * scale) / 2);
  const topOffset = ((window.innerHeight - CANVAS_H * scale) / 2);
  const panelX = Math.min(scaleOffset + cx * scale + 30, window.innerWidth - 220);
  const panelY = Math.max(topOffset + cy * scale - 80, HUD_H * scale + topOffset + 10);

  const isLiquidatable = state.phase === 'PLANNING';
  const isFreezable = plant.frozenTicks > 0;
  const canAffordUnfreeze = state.capital >= GAME_CONFIG.unfreezeMinCost;

  const potentialIfHeld5 = Math.floor(
    plant.capitalValue * Math.pow(1 + plant.interestRate, Math.max(0, 5 - plant.yearsAlive))
  );

  return (
    <div
      className="cb-plant-info"
      style={{ position: 'fixed', left: panelX, top: panelY, zIndex: 60 }}
    >
      <div className="cb-plant-info-name">
        <span>{def.emoji}</span>
        <span>{t(`plants.${plant.type}.name`)}</span>
        {plant.isGolden && <span>👑</span>}
      </div>

      <div className="cb-plant-info-row">
        <span>{t('plantInfo.currentValue')}</span>
        <strong>${plant.capitalValue}</strong>
      </div>
      <div className="cb-plant-info-row">
        <span>{t('plantInfo.originalCost')}</span>
        <strong>${plant.baseCapital}</strong>
      </div>
      <div className="cb-plant-info-row">
        <span>{t('plantInfo.yearsAlive')}</span>
        <strong>{plant.yearsAlive}</strong>
      </div>
      {plant.type !== 'emergency_cactus' && (
        <div className="cb-plant-info-row">
          <span>{t('plantInfo.interestRate')}</span>
          <strong style={{ color: '#4ade80' }}>{Math.floor(plant.interestRate * 100)}%/yr</strong>
        </div>
      )}
      {plant.yearsAlive < 5 && plant.type !== 'emergency_cactus' && (
        <div className="cb-plant-info-row">
          <span>{t('plantInfo.valueIn5yr')}</span>
          <strong style={{ color: '#ffd700' }}>~${potentialIfHeld5}</strong>
        </div>
      )}
      {plant.yearsAlive >= 10 && (
        <div className="cb-plant-info-row">
          <span>{t('plantInfo.hodl')}</span>
          <strong style={{ color: '#ffd700' }}>🏆 HODL!</strong>
        </div>
      )}

      <hr className="cb-plant-info-divider" />

      {isFreezable && (
        <button
          className="cb-unfreeze-btn"
          onClick={onUnfreeze}
          disabled={!canAffordUnfreeze}
        >
          ❄️ {t('plantInfo.unfreeze', { cost: GAME_CONFIG.unfreezeMinCost })}
        </button>
      )}

      {isLiquidatable && (
        <button className="cb-liquidate-btn" onClick={onLiquidate}>
          {plant.yearsAlive < 5
            ? `💸 ${t('plantInfo.liquidateEarly')} ($${plant.capitalValue})`
            : `✅ ${t('plantInfo.liquidate')} ($${plant.capitalValue})`}
        </button>
      )}

      <button
        className="cb-btn-secondary"
        style={{ width: '100%', marginTop: 6, fontSize: 11 }}
        onClick={onClose}
      >
        ✕ {t('plantInfo.close')}
      </button>
    </div>
  );
}
