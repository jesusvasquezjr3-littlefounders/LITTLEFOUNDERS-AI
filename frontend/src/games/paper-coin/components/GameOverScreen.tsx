import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { GameState, GameAction } from '../types';

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

export function GameOverScreen({ state, dispatch }: Props) {
  const { t } = useTranslation('games');
  const navigate = useNavigate();

  const isNewHighScore = state.score >= state.highScore && state.score > 0;

  const stats = [
    {
      label: t('paperCoin.gameOver.dayReached'),
      value: state.day,
      icon: '📅',
    },
    {
      label: t('paperCoin.gameOver.score'),
      value: `${state.score} XP`,
      icon: '⭐',
      highlight: true,
    },
    {
      label: t('paperCoin.gameOver.maxStreak'),
      value: `×${state.maxStreak}`,
      icon: '🔥',
    },
    {
      label: t('paperCoin.gameOver.tipsEarned'),
      value: `${state.tipCoins} 🪙`,
      icon: '💰',
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full bg-gradient-to-b from-slate-900 via-red-950 to-slate-900 overflow-y-auto pc-no-scroll py-6 px-4">
      {/* Skull or over banner */}
      <div className="text-6xl mb-3 pc-anim-pop-in">💀</div>

      <h1 className="pc-title-font text-3xl text-red-400 mb-1 pc-anim-pop-in" style={{ animationDelay: '0.1s' }}>
        {t('paperCoin.gameOver.title')}
      </h1>

      <p className="text-white/60 text-sm mb-4 text-center pc-anim-fade-in" style={{ animationDelay: '0.2s' }}>
        {t('paperCoin.gameOver.subtitle')}
      </p>

      {/* New high score */}
      {isNewHighScore && (
        <div
          className="flex items-center gap-2 px-5 py-2 rounded-xl mb-4 pc-anim-pop-in"
          style={{
            background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
            boxShadow: '0 4px 20px rgba(251, 191, 36, 0.5)',
            animationDelay: '0.3s',
          }}
        >
          <span className="text-2xl">🏆</span>
          <span className="font-black text-amber-900 text-base">
            {t('paperCoin.gameOver.newRecord')}
          </span>
        </div>
      )}

      {/* Stats */}
      <div className="w-full max-w-xs grid grid-cols-2 gap-2 mb-5">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="bg-white/5 border border-white/10 rounded-2xl p-3 text-center pc-anim-fade-in"
            style={{ animationDelay: `${0.25 + i * 0.07}s` }}
          >
            <div className="text-2xl mb-1">{stat.icon}</div>
            <div
              className={`font-black text-lg ${
                stat.highlight ? 'text-yellow-300' : 'text-white'
              }`}
            >
              {stat.value}
            </div>
            <div className="text-white/50 text-xs mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* High score display */}
      <div className="text-white/50 text-sm mb-5 pc-anim-fade-in" style={{ animationDelay: '0.55s' }}>
        🏆 {t('paperCoin.gameOver.bestRecord')}: {' '}
        <span className="text-yellow-300 font-bold">{state.highScore} XP</span>
      </div>

      {/* Actions */}
      <div className="w-full max-w-xs flex flex-col gap-3">
        <button
          className="w-full py-4 rounded-2xl pc-title-font text-xl font-black text-white transition-all duration-150 active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            boxShadow: '0 5px 0 #15803d, 0 8px 20px rgba(34, 197, 94, 0.4)',
          }}
          onClick={() => dispatch({ type: 'RESTART' })}
        >
          🔄 {t('paperCoin.gameOver.playAgain')}
        </button>

        <button
          className="w-full py-3 rounded-2xl font-bold text-white/60 border border-white/15 bg-white/5 hover:bg-white/10 transition-all active:scale-95"
          onClick={() => navigate('/games')}
        >
          ← {t('paperCoin.gameOver.backToGames')}
        </button>
      </div>
    </div>
  );
}
