import { useTranslation } from 'react-i18next';
import { GameState, GameAction } from '../types';

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

export function GameHUD({ state, dispatch }: Props) {
  const { t } = useTranslation('games');

  const progressPct = Math.min(
    100,
    (state.customersThisDay / state.customersPerDay) * 100,
  );

  const canPause =
    state.phase === 'CUSTOMER_ARRIVING' ||
    state.phase === 'PRESENTING' ||
    state.phase === 'WAITING_INPUT';

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-black/30 backdrop-blur-sm border-b border-white/10 select-none">
      {/* Hearts */}
      <div className="flex items-center gap-1 shrink-0">
        {Array.from({ length: state.maxHearts }).map((_, i) => (
          <span
            key={i}
            className={`pc-heart text-xl ${i >= state.hearts ? 'lost' : ''}`}
            style={
              i === state.hearts && state.lastWasCorrect === false
                ? { animation: 'pcHeartBreak 0.5s ease-in-out' }
                : undefined
            }
          >
            {i < state.hearts ? '❤️' : '🖤'}
          </span>
        ))}
      </div>

      {/* Day + Progress */}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-center justify-between">
          <span className="text-white text-xs font-bold opacity-80">
            {t('paperCoin.hud.day', { day: state.day })}
          </span>
          <span className="text-white/60 text-xs">
            {state.customersThisDay}/{state.customersPerDay}
          </span>
        </div>
        <div className="pc-progress-track h-2">
          <div
            className="pc-progress-fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Score */}
      <div className="flex flex-col items-end shrink-0">
        <div className="flex items-center gap-1">
          <span className="text-indigo-300 text-xs font-black">
            {state.score}
          </span>
          <span className="text-indigo-400 text-xs">XP</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-blue-400 text-xs">🪙</span>
          <span className="text-blue-300 text-xs font-bold">
            {state.tipCoins}
          </span>
        </div>
      </div>

      {/* Streak badge */}
      {state.correctStreak >= 3 && (
        <div
          className="pc-streak-badge rounded-lg px-2 py-0.5 flex items-center gap-1 shrink-0"
        >
          <span className="text-xs">🔥</span>
          <span className="text-white text-xs font-black">
            ×{state.correctStreak}
          </span>
        </div>
      )}

      {/* Pause */}
      {canPause && (
        <button
          className="shrink-0 w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-lg transition-all active:scale-90"
          onClick={() => dispatch({ type: 'PAUSE' })}
          aria-label={t('paperCoin.hud.pause')}
        >
          ⏸
        </button>
      )}
    </div>
  );
}
