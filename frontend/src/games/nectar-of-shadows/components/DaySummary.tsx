/* ──────────────────────────────────────────────────────────────
   Day Summary – Results screen after market phase
   ────────────────────────────────────────────────────────────── */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PICTURES, MENTOR_TIPS } from '../constants';
import type { DayResult, MentorTip, MentorCharacter } from '../types';

interface Props {
  day: number;
  result: DayResult;
  totalCoins: number;
  onContinue: () => void;
  onShowMentor: (tip: MentorTip) => void;
}

const MENTOR_PICS: Record<MentorCharacter, string> = {
  drRho: PICTURES.drRho,
  zara: PICTURES.zara,
  liruf: PICTURES.liruf,
  dina: PICTURES.dina,
};

export function DaySummary({ day, result, totalCoins, onContinue, onShowMentor }: Props) {
  const { t } = useTranslation('games');
  const [animatedProfit, setAnimatedProfit] = useState(0);

  // Animate profit counter
  useEffect(() => {
    const target = result.netProfit;
    if (target === 0) {
      setAnimatedProfit(0);
      return;
    }
    const step = target > 0 ? Math.max(1, Math.floor(target / 20)) : Math.min(-1, Math.ceil(target / 20));
    let current = 0;

    const interval = setInterval(() => {
      current += step;
      if ((step > 0 && current >= target) || (step < 0 && current <= target)) {
        current = target;
        clearInterval(interval);
      }
      setAnimatedProfit(current);
    }, 40);

    return () => clearInterval(interval);
  }, [result.netProfit]);

  // Show Dina mentor tip
  useEffect(() => {
    const dinaTips = MENTOR_TIPS.filter((tip) => tip.character === 'dina');
    const tip = dinaTips[day % dinaTips.length];
    if (tip) {
      const timer = setTimeout(() => onShowMentor(tip), 1200);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  const isProfit = result.netProfit > 0;

  return (
    <div className="nectar-summary">
      <div className="nectar-summary-card">
        {/* Header */}
        <div className="nectar-summary-header">
          <h2 className="nectar-summary-title">
            {t('nectar.summary.title', { day })}
          </h2>
        </div>

        {/* Results */}
        <div className="nectar-summary-rows">
          <div className="nectar-summary-row">
            <span>{t('nectar.summary.totalSales')}</span>
            <span className="nectar-summary-value nectar-text-positive">
              +{result.totalSales}
              <img src={PICTURES.coin} alt="" className="nectar-icon-xs" />
            </span>
          </div>

          <div className="nectar-summary-row">
            <span>{t('nectar.summary.ingredientCost')}</span>
            <span className="nectar-summary-value nectar-text-negative">
              -{result.ingredientCost}
              <img src={PICTURES.coin} alt="" className="nectar-icon-xs" />
            </span>
          </div>

          <div className="nectar-summary-divider" />

          <div className="nectar-summary-row nectar-summary-row-main">
            <span>{t('nectar.summary.netProfit')}</span>
            <span className={`nectar-summary-value-big ${isProfit ? 'nectar-text-positive' : 'nectar-text-negative'}`}>
              {animatedProfit > 0 ? '+' : ''}{animatedProfit}
              <img src={PICTURES.coin} alt="" className="nectar-icon-sm" />
            </span>
          </div>
        </div>

        {/* Customers */}
        <div className="nectar-summary-customers">
          <img src={PICTURES.customerHappy} alt="" className="nectar-icon-sm" />
          <span>
            {t('nectar.summary.customersBought', {
              bought: result.customersBought,
              total: result.customersTotal,
            })}
          </span>
        </div>

        {/* Total balance */}
        <div className="nectar-summary-balance">
          <img src={PICTURES.coin} alt="" className="nectar-icon-sm" />
          <span>{t('nectar.summary.totalBalance', { coins: totalCoins })}</span>
        </div>

        {/* Character reaction */}
        <div className="nectar-summary-reaction">
          <img
            src={isProfit ? PICTURES.liruf : PICTURES.dina}
            alt=""
            className="nectar-summary-char"
          />
          <p className="nectar-summary-quote">
            {isProfit ? t('nectar.summary.goodDay') : t('nectar.summary.badDay')}
          </p>
        </div>

        {/* Continue */}
        <button className="nectar-btn nectar-btn-primary" onClick={onContinue}>
          {t('nectar.summary.continue')}
        </button>
      </div>
    </div>
  );
}
