import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PICTURES, COIN_EMOJI, ITEM_EMOJI } from '../constants';
import type { ItemSilhouette, CoinOption } from '../types';

interface Props {
  item: ItemSilhouette;
  options: CoinOption[];
  selectedId: string | null;
  feedback: 'correct' | 'incorrect' | null;
  onSelect: (coinId: string) => void;
}

function CoinImage({ imageKey, size }: { imageKey: string; size: number }) {
  const [error, setError] = useState(false);
  const src = (PICTURES as Record<string, string>)[imageKey];
  if (error || !src) {
    return (
      <span style={{ fontSize: size * 0.6 }} className="select-none">
        {COIN_EMOJI[imageKey] ?? '🪙'}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      style={{ width: size, height: size, objectFit: 'contain' }}
      onError={() => setError(true)}
      draggable={false}
    />
  );
}

function ItemImage({ imageKey, size }: { imageKey: string; size: number }) {
  const [error, setError] = useState(false);
  const src = (PICTURES as Record<string, string>)[imageKey];
  if (error || !src) {
    return (
      <span style={{ fontSize: size * 0.7 }} className="select-none">
        {ITEM_EMOJI[imageKey] ?? '🎁'}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      className="pd-item-silhouette"
      style={{ width: size, height: size, objectFit: 'contain' }}
      onError={() => setError(true)}
      draggable={false}
    />
  );
}

export function Phase1Inspection({ item, options, selectedId, feedback, onSelect }: Props) {
  const { t } = useTranslation('games');
  const disabled = selectedId !== null;

  return (
    <div className="flex flex-col items-center justify-between h-full pt-14 pb-4 px-4 pd-font">

      {/* Instruction banner */}
      <div className="pd-card-dark px-4 py-2 text-center mb-2">
        <p className="text-sm font-bold text-amber-900">
          {t('paperDetective.phase1.instruction')}
        </p>
      </div>

      {/* Item silhouette + price tag */}
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        {/* Item silhouette */}
        <div className="pd-card p-4 rounded-xl flex items-center justify-center"
          style={{ minWidth: 120, minHeight: 120 }}>
          <ItemImage imageKey={item.imageKey} size={96} />
        </div>

        {/* Price tag */}
        <div className="pd-price-tag px-6 py-2 text-center">
          <span className="text-3xl sm:text-4xl font-black text-amber-900">
            {t('paperDetective.phase1.priceLabel', { price: item.price })}
          </span>
        </div>

        {/* Feedback message */}
        {feedback && (
          <div className={`text-xl font-black mt-1 ${feedback === 'correct' ? 'pd-feedback-correct text-green-700' : 'pd-feedback-incorrect text-red-600'}`}>
            {feedback === 'correct'
              ? t('paperDetective.feedback.correct')
              : t('paperDetective.feedback.incorrect')}
          </div>
        )}
      </div>

      {/* Coin options */}
      <div className="w-full max-w-md">
        <div
          className="flex items-end justify-center gap-3 sm:gap-5 flex-wrap px-2"
        >
          {options.map((coin) => {
            const isSelected = coin.id === selectedId;
            const isCorrectSelected = isSelected && feedback === 'correct';
            const isIncorrectSelected = isSelected && feedback === 'incorrect';

            const coinSize = 64;

            return (
              <button
                key={coin.id}
                onClick={() => !disabled && onSelect(coin.id)}
                disabled={disabled}
                aria-label={t(coin.labelKey)}
                className={`pd-coin-option flex items-center justify-center
                  ${isCorrectSelected ? 'pd-coin-selected-correct' : ''}
                  ${isIncorrectSelected ? 'pd-coin-selected-incorrect' : ''}
                  ${disabled ? 'pd-coin-selected' : ''}
                `}
                style={{
                  width: coinSize + 8,
                  height: coinSize + 8,
                  padding: 4,
                }}
              >
                <CoinImage imageKey={coin.imageKey} size={coinSize} />
                {/* Checkmark / X overlay on selected */}
                {isSelected && (
                  <span
                    className="absolute text-2xl font-black pointer-events-none"
                    style={{
                      top: -8,
                      right: -8,
                      textShadow: '0 0 4px #fff',
                    }}
                  >
                    {feedback === 'correct' ? '✅' : '❌'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
