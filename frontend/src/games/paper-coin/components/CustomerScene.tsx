import { useTranslation } from 'react-i18next';
import { GameState } from '../types';
import { THEME_CONFIG } from '../constants';

interface Props {
  state: GameState;
}

function CoinBadge({ amount }: { amount: number }) {
  return (
    <div
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
      style={{
        background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
        boxShadow: '0 2px 6px rgba(245,158,11,0.4)',
      }}
    >
      <span className="text-xs">🪙</span>
      <span className="font-black text-amber-900 text-sm">{amount}</span>
    </div>
  );
}

export function CustomerScene({ state }: Props) {
  const { t } = useTranslation('games');
  const theme = THEME_CONFIG[state.upgrades.theme];
  const tx = state.currentTransaction;

  const isArriving = state.phase === 'CUSTOMER_ARRIVING';
  // Only slide out during CUSTOMER_LEAVING — not during feedback
  const isLeaving = state.phase === 'CUSTOMER_LEAVING';
  const isPresenting = state.phase === 'PRESENTING' || state.phase === 'WAITING_INPUT';
  const isCorrect = state.phase === 'FEEDBACK_CORRECT';
  const isWrong =
    state.phase === 'FEEDBACK_WRONG' || state.phase === 'FEEDBACK_TIMEOUT';

  if (!tx) return null;

  const customer = tx.customer;

  return (
    <div
      className="relative flex flex-col items-center justify-end overflow-hidden"
      style={{
        background: `linear-gradient(180deg, ${theme.wallTop} 0%, ${theme.wallBottom} 65%, ${theme.floor} 65%)`,
        minHeight: 200,
        flex: 1,
      }}
    >
      {/* Decorative wall elements */}
      <div
        className="absolute top-2 left-3 text-2xl opacity-40"
        style={{ filter: 'drop-shadow(1px 1px 2px rgba(0,0,0,0.3))' }}
      >
        🛡️
      </div>
      <div
        className="absolute top-2 right-3 text-2xl opacity-40"
        style={{ filter: 'drop-shadow(1px 1px 2px rgba(0,0,0,0.3))' }}
      >
        ⚗️
      </div>

      {/* Shop sign */}
      <div
        className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-lg text-xs font-bold text-white/80 border border-white/20"
        style={{ background: theme.signBg }}
      >
        🏪 {t('paperCoin.scene.shopName')}
      </div>

      {/* Customer card */}
      <div
        className={`relative flex flex-col items-center mb-2 paper-character ${
          isArriving ? 'pc-anim-slide-in' : ''
        } ${isLeaving && !isCorrect ? 'pc-anim-slide-out' : ''} ${
          isCorrect ? 'pc-anim-bounce' : ''
        } ${isWrong ? 'pc-anim-shake' : ''}`}
      >
        {/* Character body */}
        <div
          className="relative flex flex-col items-center justify-center rounded-3xl border-4 shadow-2xl"
          style={{
            width: 88,
            height: 100,
            background: customer.bgColor,
            borderColor: customer.borderColor,
            boxShadow: `0 8px 24px rgba(0,0,0,0.4), inset 0 2px 4px rgba(255,255,255,0.1)`,
          }}
        >
          {/* Emoji face */}
          <span className="text-5xl" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>
            {customer.emoji}
          </span>
        </div>

        {/* Customer name badge */}
        <div
          className="mt-1.5 px-3 py-0.5 rounded-full text-xs font-bold border border-white/20"
          style={{ background: customer.bgColor, color: customer.textColor }}
        >
          {t(customer.nameKey)}
        </div>

        {/* Speech bubble — shown in PRESENTING / WAITING_INPUT */}
        {(isPresenting || state.phase === 'WAITING_INPUT') && (
          <div
            className="absolute -top-24 left-1/2 -translate-x-1/2 w-52 pc-speech-bubble p-3 pc-anim-bubble-in"
            style={{ zIndex: 10 }}
          >
            {/* Items ordered */}
            <div className="flex items-center justify-center gap-2 mb-2">
              {tx.items.map((item) => (
                <div key={item.key} className="flex flex-col items-center gap-0.5">
                  <span className="text-2xl paper-item">{item.emoji}</span>
                  <CoinBadge amount={item.price} />
                </div>
              ))}
            </div>

            {/* Total if 2 items */}
            {tx.items.length > 1 && (
              <div className="text-center text-xs text-slate-600 font-bold mb-1 border-t border-slate-100 pt-1">
                {t('paperCoin.scene.totalLabel')}:{' '}
                <CoinBadge amount={tx.totalPrice} />
              </div>
            )}

            {/* Payment */}
            <div className="flex items-center justify-center gap-2 bg-amber-50 rounded-lg px-2 py-1">
              <span className="text-xs text-amber-700 font-bold">
                {t('paperCoin.scene.paysLabel')}
              </span>
              <CoinBadge amount={tx.payment} />
            </div>

            {/* Change question mark */}
            <div className="flex items-center justify-center gap-1 mt-1.5">
              <span className="text-xs text-slate-500">
                {t('paperCoin.scene.changeLabel')}
              </span>
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-white text-sm"
                style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
              >
                ?
              </div>
            </div>
          </div>
        )}

        {/* Feedback emoji overlay */}
        {isCorrect && (
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 pc-anim-pop-in text-3xl">
            😄
          </div>
        )}
        {(state.phase === 'FEEDBACK_WRONG' || state.phase === 'FEEDBACK_TIMEOUT') && (
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 pc-anim-pop-in text-3xl">
            😤
          </div>
        )}
      </div>
    </div>
  );
}
