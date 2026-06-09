import { useTranslation } from 'react-i18next';
import { GameState, GameAction } from '../types';
import { SHOP_UPGRADES } from '../constants';

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

export function ShopScreen({ state, dispatch }: Props) {
  const { t } = useTranslation('games');

  const getUpgradeLevel = (id: string): number => {
    if (id === 'hourglass') return state.upgrades.hourglass;
    if (id === 'amulet') return state.upgrades.amulet;
    if (id === 'forest' || id === 'castle' || id === 'ghost') {
      return state.upgrades.theme === id ? 1 : 0;
    }
    return 0;
  };

  const canBuy = (id: string, cost: number, maxLevel: number): boolean => {
    const level = getUpgradeLevel(id);
    return state.tipCoins >= cost && level < maxLevel;
  };

  const isOwned = (id: string, maxLevel: number): boolean => {
    return getUpgradeLevel(id) >= maxLevel;
  };

  return (
    <div className="flex flex-col items-center min-h-screen w-full bg-gradient-to-b from-indigo-950 via-purple-950 to-slate-950 overflow-y-auto pc-no-scroll">
      {/* Header */}
      <div className="w-full bg-gradient-to-r from-indigo-500/20 to-blue-500/20 border-b border-indigo-400/20 px-4 py-4 text-center">
        {/* Day complete stars */}
        <div className="flex justify-center gap-2 mb-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`text-3xl pc-anim-star-pop pc-star-delay-${i + 1}`}
            >
              ⭐
            </span>
          ))}
        </div>
        <h2 className="pc-title-font text-2xl text-indigo-300">
          {t('paperCoin.shop.dayComplete', { day: state.day })}
        </h2>
        <p className="text-blue-200/70 text-sm mt-1">
          {t('paperCoin.shop.earnedToday', { score: state.totalDayScore })}
        </p>
      </div>

      {/* Tip coin balance */}
      <div className="flex items-center gap-2 mt-4 bg-blue-900/30 border border-blue-500/30 rounded-2xl px-5 py-2">
        <span className="text-2xl">🪙</span>
        <div>
          <div className="text-blue-300 font-black text-xl">{state.tipCoins}</div>
          <div className="text-blue-400/70 text-xs">{t('paperCoin.shop.balance')}</div>
        </div>
      </div>

      {/* Upgrades grid */}
      <div className="w-full max-w-sm px-4 mt-4 flex flex-col gap-3">
        <h3 className="text-white/70 text-xs uppercase tracking-widest font-bold text-center">
          {t('paperCoin.shop.upgradesTitle')}
        </h3>

        {SHOP_UPGRADES.map((upgrade) => {
          const level = getUpgradeLevel(upgrade.id);
          const owned = isOwned(upgrade.id, upgrade.maxLevel);
          const buyable = canBuy(upgrade.id, upgrade.cost, upgrade.maxLevel);

          return (
            <button
              key={upgrade.id}
              className="pc-shop-card w-full flex items-center gap-3 p-3 text-left"
              disabled={!buyable}
              onClick={() => dispatch({ type: 'BUY_UPGRADE', id: upgrade.id })}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                style={{
                  background: owned
                    ? 'linear-gradient(135deg, #fbbf24, #f59e0b)'
                    : 'rgba(255,255,255,0.08)',
                  boxShadow: owned ? '0 3px 10px rgba(251,191,36,0.4)' : 'none',
                }}
              >
                {upgrade.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-bold text-sm">
                  {t(upgrade.nameKey)}
                </div>
                <div className="text-white/60 text-xs mt-0.5 leading-tight">
                  {t(upgrade.descKey)}
                </div>
                {/* Level dots for hourglass/amulet */}
                {(upgrade.id === 'hourglass' || upgrade.id === 'amulet') && (
                  <div className="flex gap-1 mt-1">
                    {Array.from({ length: upgrade.maxLevel }).map((_, i) => (
                      <div
                        key={i}
                        className="w-3 h-1.5 rounded-full"
                        style={{
                          background:
                            i < level ? '#fbbf24' : 'rgba(255,255,255,0.2)',
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <div className="shrink-0 flex flex-col items-end gap-1">
                {owned ? (
                  <span className="text-indigo-400 text-xs font-bold">
                    ✅ {t('paperCoin.shop.owned')}
                  </span>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="text-sm">🪙</span>
                    <span
                      className={`font-black text-sm ${
                        buyable ? 'text-indigo-300' : 'text-white/40'
                      }`}
                    >
                      {upgrade.cost}
                    </span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Next day button */}
      <div className="w-full max-w-sm px-4 mt-5 mb-6">
        <button
          className="w-full py-4 rounded-2xl pc-title-font text-xl font-black text-white transition-all duration-150 active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            boxShadow: '0 5px 0 #3730a3, 0 8px 20px rgba(99, 102, 241, 0.4)',
          }}
          onClick={() => dispatch({ type: 'NEXT_DAY' })}
        >
          {t('paperCoin.shop.nextDay', { day: state.day + 1 })} →
        </button>
        <p className="text-white/40 text-xs text-center mt-2">
          {t('paperCoin.shop.heartsRestored')}
        </p>
      </div>
    </div>
  );
}
