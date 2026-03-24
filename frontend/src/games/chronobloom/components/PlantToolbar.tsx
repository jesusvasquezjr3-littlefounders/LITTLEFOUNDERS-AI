import { useTranslation } from 'react-i18next';
import type { GameState, PlantType } from '../types';
import { PLANT_DEFS, GAME_CONFIG } from '../constants';

interface Props {
  state: GameState;
  onSelectPlant: (type: PlantType | null) => void;
  onAdvanceYear: () => void;
}

const PLANT_ORDER: PlantType[] = ['savings_sprout', 'stock_tree', 'div_vine', 'emergency_cactus'];

export default function PlantToolbar({ state, onSelectPlant, onAdvanceYear }: Props) {
  const { t } = useTranslation('chronoBloom');

  const isPlanning = state.phase === 'PLANNING';
  const isPlaying  = state.phase === 'PLAYING';

  function handlePlantClick(type: PlantType) {
    if (!isPlanning) return;
    onSelectPlant(state.selectedPlantType === type ? null : type);
  }

  function rateLabel(type: PlantType) {
    const rate = PLANT_DEFS[type].interestRate;
    if (rate === 0) return t('toolbar.oneTime');
    return `+${Math.floor(rate * 100)}%/${t('toolbar.perYear')}`;
  }

  return (
    <div className="cb-toolbar">
      {PLANT_ORDER.map((type, idx) => {
        const def = PLANT_DEFS[type];
        const cost = Math.floor(def.cost * state.inflationMultiplier);
        const canAfford = state.capital >= cost;
        const isSelected = state.selectedPlantType === type;
        const alreadyPlaced = state.plants.some(p => p.type === type);

        // High risk label for stock tree
        const label = type === 'stock_tree' ? t('toolbar.highRisk') :
                      type === 'div_vine'    ? t('toolbar.support') :
                      type === 'emergency_cactus' ? t('toolbar.aoe') : null;

        return (
          <button
            key={type}
            className={`cb-plant-btn ${isSelected ? 'selected' : ''}`}
            onClick={() => handlePlantClick(type)}
            disabled={!isPlanning || !canAfford}
            title={t(`plants.${type}.desc`)}
          >
            {label && <span className="cb-plant-btn-label">{label}</span>}
            <span className="cb-plant-btn-emoji">{def.emoji}</span>
            <span className="cb-plant-btn-name">{t(`plants.${type}.name`)}</span>
            <span className="cb-plant-btn-cost">💰 {cost}</span>
            <span className="cb-plant-btn-rate">{rateLabel(type)}</span>
          </button>
        );
      })}

      <div className="cb-toolbar-divider" />

      {/* Advance Year / Playing indicator */}
      {isPlanning ? (
        <button
          className="cb-advance-btn"
          onClick={onAdvanceYear}
          disabled={state.plants.length === 0}
          title={state.plants.length === 0 ? t('toolbar.needPlants') : ''}
        >
          📅 {t('toolbar.advanceYear', { year: state.year })} →
        </button>
      ) : isPlaying ? (
        <div className="cb-advance-btn cb-advance-btn-playing">
          ⚔️ {t('toolbar.yearInProgress', { year: state.year })}
        </div>
      ) : (
        <div className="cb-advance-btn cb-advance-btn-playing">
          ⏳ {t('toolbar.waiting')}
        </div>
      )}
    </div>
  );
}
