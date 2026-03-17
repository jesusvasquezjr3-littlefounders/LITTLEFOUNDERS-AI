import { useTranslation } from 'react-i18next';
import { GameState } from '../types';

interface Props {
  state: GameState;
}

export function FeedbackOverlay({ state }: Props) {
  const { t } = useTranslation('games');

  const isCorrect = state.phase === 'FEEDBACK_CORRECT';
  const isWrong = state.phase === 'FEEDBACK_WRONG';
  const isTimeout = state.phase === 'FEEDBACK_TIMEOUT';

  if (!isCorrect && !isWrong && !isTimeout) return null;

  const tx = state.currentTransaction;
  const coins = isCorrect
    ? [0, 1, 2, 3, 4].map((i) => ({
        x: (Math.random() - 0.5) * 120,
        y: -(60 + Math.random() * 80),
        delay: i * 0.08,
      }))
    : [];

  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-30 ${
        isCorrect
          ? 'pc-feedback-correct'
          : isWrong
          ? 'pc-feedback-wrong'
          : 'pc-feedback-timeout'
      }`}
    >
      {/* Main feedback */}
      <div className="pc-anim-pop-in flex flex-col items-center gap-2">
        {isCorrect && (
          <>
            <div className="text-6xl">✅</div>
            <div
              className="px-6 py-3 rounded-2xl text-xl font-black text-white text-center"
              style={{
                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                boxShadow: '0 4px 20px rgba(34, 197, 94, 0.5)',
              }}
            >
              {t('paperCoin.feedback.correct')}
            </div>
            {state.lastWasBonus && (
              <div
                className="px-4 py-1.5 rounded-xl text-sm font-black text-white pc-speed-bonus"
                style={{
                  background: 'linear-gradient(135deg, #eab308, #ca8a04)',
                  boxShadow: '0 3px 12px rgba(234, 179, 8, 0.6)',
                }}
              >
                ⚡ {t('paperCoin.feedback.speedBonus')} +{10}XP
              </div>
            )}
            {state.correctStreak >= 3 && (
              <div className="text-sm text-yellow-300 font-bold pc-anim-streak-flash">
                🔥 {t('paperCoin.feedback.streak', { count: state.correctStreak })}
              </div>
            )}
          </>
        )}

        {isWrong && (
          <>
            <div className="text-6xl pc-anim-shake">❌</div>
            <div
              className="px-6 py-3 rounded-2xl text-xl font-black text-white text-center"
              style={{
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                boxShadow: '0 4px 20px rgba(239, 68, 68, 0.5)',
              }}
            >
              {t('paperCoin.feedback.wrong')}
            </div>
            {tx && (
              <div className="text-white/80 text-sm text-center">
                {t('paperCoin.feedback.correctWas')}{' '}
                <span className="font-black text-yellow-300">{tx.correctChange} 🪙</span>
              </div>
            )}
          </>
        )}

        {isTimeout && (
          <>
            <div className="text-6xl">⏰</div>
            <div
              className="px-6 py-3 rounded-2xl text-xl font-black text-white text-center"
              style={{
                background: 'linear-gradient(135deg, #f97316, #ea580c)',
                boxShadow: '0 4px 20px rgba(249, 115, 22, 0.5)',
              }}
            >
              {t('paperCoin.feedback.timeout')}
            </div>
            {tx && (
              <div className="text-white/80 text-sm text-center">
                {t('paperCoin.feedback.correctWas')}{' '}
                <span className="font-black text-yellow-300">{tx.correctChange} 🪙</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Flying coins particles for correct */}
      {isCorrect &&
        coins.map((coin, i) => (
          <div
            key={i}
            className="absolute text-2xl pc-anim-coin-fly"
            style={{
              left: '50%',
              top: '45%',
              '--dx': `${coin.x}px`,
              '--dy': `${coin.y}px`,
              animationDelay: `${coin.delay}s`,
            } as React.CSSProperties}
          >
            🪙
          </div>
        ))}

      {/* Score float */}
      {isCorrect && (
        <div
          className="absolute text-yellow-300 font-black text-xl pc-anim-score-float"
          style={{ top: '30%', left: '50%', transform: 'translateX(-50%)' }}
        >
          +{state.lastWasBonus ? 20 : 10} XP
        </div>
      )}
    </div>
  );
}
