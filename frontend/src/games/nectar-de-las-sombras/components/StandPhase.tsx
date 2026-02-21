/* ──────────────────────────────────────────────────────────────
   Stand Preparation Phase – Visual recipe builder
   ────────────────────────────────────────────────────────────── */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PICTURES, GAME_CONFIG, MENTOR_TIPS, calculateSatisfaction, getIdealRecipe } from '../constants';
import type { WeatherType, Recipe, MentorTip, MentorCharacter } from '../types';

interface Props {
  weather: WeatherType;
  lemonsAvailable: number;
  sugarAvailable: number;
  day: number;
  onSell: (recipe: Recipe) => void;
  onShowMentor: (tip: MentorTip) => void;
}

const MENTOR_PICS: Record<MentorCharacter, string> = {
  drRho: PICTURES.drRho,
  zara: PICTURES.zara,
  liruf: PICTURES.liruf,
  dina: PICTURES.dina,
};

export function StandPhase({ weather, lemonsAvailable, sugarAvailable, day, onSell, onShowMentor }: Props) {
  const { t } = useTranslation('games');

  const [lemons, setLemons] = useState(0);
  const [sugarAmount, setSugar] = useState(0);

  // Animate ingredient addition
  const [lemonPop, setLemonPop] = useState(false);
  const [sugarPop, setSugarPop] = useState(false);

  // Show mentor tip on first render (day-based)
  useEffect(() => {
    const tipPool = MENTOR_TIPS.filter(
      (tip) => tip.character === 'zara' || tip.character === 'drRho'
    );
    const tip = tipPool[day % tipPool.length];
    if (tip) {
      const timer = setTimeout(() => onShowMentor(tip), 800);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  const addLemon = useCallback(() => {
    if (lemons < lemonsAvailable) {
      setLemons((v) => v + 1);
      setLemonPop(true);
      setTimeout(() => setLemonPop(false), 200);
    }
  }, [lemons, lemonsAvailable]);

  const removeLemon = useCallback(() => {
    if (lemons > 0) setLemons((v) => v - 1);
  }, [lemons]);

  const addSugar = useCallback(() => {
    if (sugarAmount < sugarAvailable) {
      setSugar((v) => v + 1);
      setSugarPop(true);
      setTimeout(() => setSugarPop(false), 200);
    }
  }, [sugarAmount, sugarAvailable]);

  const removeSugar = useCallback(() => {
    if (sugarAmount > 0) setSugar((v) => v - 1);
  }, [sugarAmount]);

  const handleSell = () => {
    onSell({ lemons, sugar: sugarAmount });
  };

  const ingredientCost = (lemons + sugarAmount) * GAME_CONFIG.ingredientCostPerUnit;
  const satisfaction = calculateSatisfaction({ lemons, sugar: sugarAmount }, weather);
  const ideal = getIdealRecipe(weather);

  // Satisfaction label & color
  let satLabel: string;
  let satColor: string;
  if (satisfaction >= 0.85) {
    satLabel = t('nectar.stand.satPerfect');
    satColor = '#6ee7b7';
  } else if (satisfaction >= 0.6) {
    satLabel = t('nectar.stand.satGood');
    satColor = '#fbbf24';
  } else if (satisfaction >= 0.35) {
    satLabel = t('nectar.stand.satOk');
    satColor = '#fb923c';
  } else {
    satLabel = t('nectar.stand.satBad');
    satColor = '#f87171';
  }

  const bgImage = weather === 'hot' ? PICTURES.bgStandHot : PICTURES.bgStandCold;

  // Build array of placed ingredient icons for the "bowl" visual
  const bowlIcons: { type: 'lemon' | 'sugar'; key: number }[] = [];
  for (let i = 0; i < lemons; i++) bowlIcons.push({ type: 'lemon', key: i });
  for (let i = 0; i < sugarAmount; i++) bowlIcons.push({ type: 'sugar', key: 100 + i });

  return (
    <div className="nectar-stand" style={{ backgroundImage: `url(${bgImage})` }}>
      {/* Weather indicator */}
      <div className={`nectar-weather-indicator nectar-weather-${weather}`}>
        <span className="nectar-weather-icon">
          {weather === 'hot' ? '🔥' : '❄️'}
        </span>
        <span className="nectar-weather-label">
          {t(`nectar.stand.weather.${weather}`)}
        </span>
      </div>

      {/* Recipe builder panel */}
      <div className="nectar-recipe-panel nectar-recipe-visual">
        <h2 className="nectar-recipe-title">{t('nectar.stand.recipeTitle')}</h2>

        {/* Weather hint */}
        <p className="nectar-recipe-hint">
          {t(`nectar.stand.weatherHint.${weather}`)}
        </p>

        {/* ── Visual bowl / mixing area ──────────────────────── */}
        <div className="nectar-bowl">
          <div className="nectar-bowl-inner">
            {bowlIcons.length === 0 && (
              <span className="nectar-bowl-empty">{t('nectar.stand.tapToAdd')}</span>
            )}
            {bowlIcons.map((item) => (
              <img
                key={item.key}
                src={item.type === 'lemon' ? PICTURES.lemon : PICTURES.sugar}
                alt=""
                className={`nectar-bowl-item nectar-bowl-item-${item.type}`}
              />
            ))}
          </div>
        </div>

        {/* ── Ingredient tap buttons ─────────────────────────── */}
        <div className="nectar-ingredient-row">
          {/* Lemon controls */}
          <div className="nectar-ingredient-group">
            <button
              className="nectar-ingredient-minus"
              onClick={removeLemon}
              disabled={lemons === 0}
              aria-label="Remove lemon"
            >
              −
            </button>
            <button
              className={`nectar-ingredient-btn nectar-ingredient-lemon ${lemonPop ? 'nectar-pop' : ''}`}
              onClick={addLemon}
              disabled={lemons >= lemonsAvailable}
            >
              <img src={PICTURES.lemon} alt="" className="nectar-ingredient-icon" />
              <span className="nectar-ingredient-count">{lemons}</span>
            </button>
            <span className="nectar-ingredient-avail">/{lemonsAvailable}</span>
          </div>

          {/* Sugar controls */}
          <div className="nectar-ingredient-group">
            <button
              className="nectar-ingredient-minus"
              onClick={removeSugar}
              disabled={sugarAmount === 0}
              aria-label="Remove sugar"
            >
              −
            </button>
            <button
              className={`nectar-ingredient-btn nectar-ingredient-sugar ${sugarPop ? 'nectar-pop' : ''}`}
              onClick={addSugar}
              disabled={sugarAmount >= sugarAvailable}
            >
              <img src={PICTURES.sugar} alt="" className="nectar-ingredient-icon" />
              <span className="nectar-ingredient-count">{sugarAmount}</span>
            </button>
            <span className="nectar-ingredient-avail">/{sugarAvailable}</span>
          </div>
        </div>

        {/* ── Satisfaction meter ──────────────────────────────── */}
        <div className="nectar-satisfaction-bar-wrap">
          <div className="nectar-satisfaction-label">
            <span>{t('nectar.stand.satisfaction')}</span>
            <span style={{ color: satColor, fontWeight: 700 }}>{satLabel}</span>
          </div>
          <div className="nectar-satisfaction-track">
            <div
              className="nectar-satisfaction-fill"
              style={{
                width: `${Math.round(satisfaction * 100)}%`,
                background: satColor,
              }}
            />
            {/* Ideal marker */}
            <div className="nectar-satisfaction-ideal" title={t('nectar.stand.idealHint', { lemons: ideal.lemons, sugar: ideal.sugar })}>
              ★
            </div>
          </div>
        </div>

        {/* Cost preview */}
        <div className="nectar-cost-preview">
          <img src={PICTURES.coin} alt="" className="nectar-icon-sm" />
          <span>
            {t('nectar.stand.cost')}: {ingredientCost}
          </span>
        </div>

        {/* SELL button */}
        <button
          className="nectar-btn nectar-btn-sell nectar-btn-glow"
          onClick={handleSell}
          disabled={lemons === 0 && sugarAmount === 0}
        >
          {t('nectar.stand.sellButton')}
        </button>
      </div>

      {/* Mentor character portraits */}
      <div className="nectar-stand-mentors">
        {(['zara', 'drRho'] as MentorCharacter[]).map((char) => (
          <img
            key={char}
            src={MENTOR_PICS[char]}
            alt={char}
            className="nectar-mentor-portrait"
            style={{ width: 80, height: 80, objectFit: 'contain' }}
          />
        ))}
      </div>
    </div>
  );
}
