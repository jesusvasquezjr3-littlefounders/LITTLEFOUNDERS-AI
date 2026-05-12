import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { X, Check, Lock } from 'lucide-react';
import type { PlayerProgress, SkinId, ThemeId } from '../types';
import { SKIN_PRICES, THEME_PRICES, SKIN_CONFIG, THEME_GRADIENTS } from '../constants';

interface MonsterShopProps {
  progress: PlayerProgress;
  onClose: () => void;
  onUnlockSkin: (skin: SkinId) => void;
  onUnlockTheme: (theme: ThemeId) => void;
  onEquipSkin: (monster: 'vitalio' | 'capricho', skin: SkinId) => void;
  onEquipTheme: (theme: ThemeId) => void;
  onSpendCoins: (amount: number) => boolean;
}

const SKIN_LIST: { id: SkinId; monster: 'vitalio' | 'capricho'; nameKey: string }[] = [
  { id: 'classic', monster: 'vitalio', nameKey: 'namVsYum.shop.skins.vitalioClassic' },
  { id: 'gold', monster: 'vitalio', nameKey: 'namVsYum.shop.skins.vitalioGold' },
  { id: 'ninja', monster: 'vitalio', nameKey: 'namVsYum.shop.skins.vitalioNinja' },
  { id: 'astronaut', monster: 'vitalio', nameKey: 'namVsYum.shop.skins.vitalioAstronaut' },
  { id: 'classic', monster: 'capricho', nameKey: 'namVsYum.shop.skins.caprichoClassic' },
  { id: 'gold', monster: 'capricho', nameKey: 'namVsYum.shop.skins.caprichoGold' },
  { id: 'pirate', monster: 'capricho', nameKey: 'namVsYum.shop.skins.caprichoPirate' },
  { id: 'robot', monster: 'capricho', nameKey: 'namVsYum.shop.skins.caprichoRobot' },
];

const THEME_LIST: { id: ThemeId; nameKey: string }[] = [
  { id: 'sky', nameKey: 'namVsYum.shop.themes.sky' },
  { id: 'forest', nameKey: 'namVsYum.shop.themes.forest' },
  { id: 'space', nameKey: 'namVsYum.shop.themes.space' },
  { id: 'city', nameKey: 'namVsYum.shop.themes.city' },
];

export function MonsterShop({ progress, onClose, onUnlockSkin, onUnlockTheme, onEquipSkin, onEquipTheme, onSpendCoins }: MonsterShopProps) {
  const { t } = useTranslation('games');

  const handleUnlockSkin = (skin: SkinId) => {
    const price = SKIN_PRICES[skin];
    if (price && onSpendCoins(price)) {
      onUnlockSkin(skin);
    }
  };

  const handleUnlockTheme = (theme: ThemeId) => {
    const price = THEME_PRICES[theme];
    if (price && onSpendCoins(price)) {
      onUnlockTheme(theme);
    }
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-sm px-4" style={{ zIndex: 80 }}>
      <div className="w-full max-w-sm bg-slate-900/95 rounded-2xl border border-white/10 p-4 sm:p-6 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="pixel-font text-sm sm:text-base text-white retro-glow">
            {t('namVsYum.shop.title')}
          </h2>
          <div className="flex items-center gap-3">
            <span className="pixel-font text-[8px] text-yellow-400">
              💰 {progress.coins}
            </span>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 transition-colors">
              <X className="w-5 h-5 text-white/60" />
            </button>
          </div>
        </div>

        {/* Skins */}
        <h3 className="pixel-font text-[9px] text-white/60 uppercase mb-2">
          {t('namVsYum.shop.skinsTitle')}
        </h3>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {SKIN_LIST.map((skin) => {
            const config = SKIN_CONFIG[skin.id];
            const monsterConfig = skin.monster === 'vitalio' ? config?.vitalio : config?.capricho;
            const isUnlocked = progress.unlockedSkins.includes(skin.id);
            const isEquipped = skin.monster === 'vitalio'
              ? progress.equippedVitalioSkin === skin.id
              : progress.equippedCaprichoSkin === skin.id;
            const price = SKIN_PRICES[skin.id];
            const canAfford = price ? progress.coins >= price : true;

            return (
              <div
                key={`${skin.monster}-${skin.id}`}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all',
                  isEquipped
                    ? 'bg-green-900/30 border-green-500/50'
                    : 'bg-white/5 border-white/10'
                )}
              >
                <div className={cn(
                  'w-12 h-12 rounded-lg flex items-center justify-center text-2xl',
                  'bg-gradient-to-b',
                  monsterConfig?.bg
                )}>
                  {monsterConfig?.emoji}
                </div>
                <span className="pixel-font text-[7px] text-white/70 text-center">
                  {t(skin.nameKey)}
                </span>
                {isEquipped ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : isUnlocked ? (
                  <button
                    onClick={() => onEquipSkin(skin.monster, skin.id)}
                    className="pixel-font text-[7px] px-2 py-1 bg-green-600 hover:bg-green-500 rounded text-white transition-colors"
                  >
                    {t('namVsYum.shop.equip')}
                  </button>
                ) : (
                  <button
                    onClick={() => handleUnlockSkin(skin.id)}
                    disabled={!canAfford}
                    className={cn(
                      'pixel-font text-[7px] px-2 py-1 rounded transition-colors flex items-center gap-1',
                      canAfford
                        ? 'bg-amber-600 hover:bg-amber-500 text-white'
                        : 'bg-white/10 text-white/30 cursor-not-allowed'
                    )}
                  >
                    <Lock className="w-3 h-3" />
                    {price}💰
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Themes */}
        <h3 className="pixel-font text-[9px] text-white/60 uppercase mb-2">
          {t('namVsYum.shop.themesTitle')}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {THEME_LIST.map((theme) => {
            const isUnlocked = progress.unlockedThemes.includes(theme.id);
            const isEquipped = progress.equippedTheme === theme.id;
            const price = THEME_PRICES[theme.id];
            const canAfford = price ? progress.coins >= price : true;

            return (
              <div
                key={theme.id}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all',
                  isEquipped
                    ? 'bg-green-900/30 border-green-500/50'
                    : 'bg-white/5 border-white/10'
                )}
              >
                <div
                  className="w-12 h-12 rounded-lg"
                  style={{ background: THEME_GRADIENTS[theme.id] }}
                />
                <span className="pixel-font text-[7px] text-white/70 text-center">
                  {t(theme.nameKey)}
                </span>
                {isEquipped ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : isUnlocked ? (
                  <button
                    onClick={() => onEquipTheme(theme.id)}
                    className="pixel-font text-[7px] px-2 py-1 bg-green-600 hover:bg-green-500 rounded text-white transition-colors"
                  >
                    {t('namVsYum.shop.equip')}
                  </button>
                ) : (
                  <button
                    onClick={() => handleUnlockTheme(theme.id)}
                    disabled={!canAfford}
                    className={cn(
                      'pixel-font text-[7px] px-2 py-1 rounded transition-colors flex items-center gap-1',
                      canAfford
                        ? 'bg-amber-600 hover:bg-amber-500 text-white'
                        : 'bg-white/10 text-white/30 cursor-not-allowed'
                    )}
                  >
                    <Lock className="w-3 h-3" />
                    {price}💰
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
