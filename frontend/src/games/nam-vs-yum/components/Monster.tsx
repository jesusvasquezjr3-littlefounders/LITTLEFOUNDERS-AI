import { useTranslation } from 'react-i18next';
import type { MonsterType, SkinId } from '../types';
import { PICTURES, SKIN_CONFIG } from '../constants';
import { AssetImg } from '@/components/ui/AssetImg';
import { cn } from '@/lib/utils';

interface MonsterProps {
  type: MonsterType;
  isEating: boolean;
  isRejecting: boolean;
  isHighlighted: boolean;
  skin?: SkinId;
  hasBombNearby?: boolean;
  isFrenzy?: boolean;
}

export function Monster({ type, isEating, isRejecting, isHighlighted, skin = 'classic', hasBombNearby, isFrenzy }: MonsterProps) {
  const { t } = useTranslation('games');

  const isVitalio = type === 'vitalio';
  const name = isVitalio ? t('namVsYum.monsters.vitalio') : t('namVsYum.monsters.capricho');
  const eatsLabel = isVitalio ? t('namVsYum.monsters.vitalioEats') : t('namVsYum.monsters.caprichoEats');

  const idleImg = isVitalio ? PICTURES.vitalio : PICTURES.capricho;
  const eatImg = isVitalio ? PICTURES.vitalioEat : PICTURES.caprichoEat;
  const rejectImg = isVitalio ? PICTURES.vitalioReject : PICTURES.caprichoReject;
  const currentImg = isEating ? eatImg : isRejecting ? rejectImg : idleImg;

  // Use skin config for visuals
  const skinConfig = SKIN_CONFIG[skin];
  const monsterSkin = isVitalio ? skinConfig?.vitalio : skinConfig?.capricho;
  const bgColor = monsterSkin?.bg || (isVitalio ? 'from-green-600 to-green-800' : 'from-purple-600 to-purple-800');
  const emoji = monsterSkin?.emoji || (isVitalio ? '🦎' : '👾');
  const highlightColor = isVitalio ? 'ring-green-400 shadow-green-400/50' : 'ring-purple-400 shadow-purple-400/50';
  const labelBg = isVitalio ? 'bg-green-500' : 'bg-purple-500';

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Monster image */}
      <div
        className={cn(
          'relative flex items-center justify-center rounded-xl transition-all duration-200',
          'w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28',
          `bg-gradient-to-b ${bgColor}`,
          isHighlighted && `ring-4 ${highlightColor} shadow-lg drop-zone-active`,
          isEating && 'monster-eating',
          isRejecting && 'monster-rejecting',
          hasBombNearby && 'animate-scared-shake',
          isFrenzy && 'animate-happy-bounce',
          !isEating && !isRejecting && !hasBombNearby && 'animate-breathing',
        )}
      >
        <AssetImg
          assetPath={currentImg}
          alt={name}
          className="w-full h-full object-contain pixel-art p-1"
          draggable={false}
          fallback={<span className="text-3xl sm:text-4xl md:text-5xl">{emoji}</span>}
        />

        {/* Glow effect when highlighted */}
        {isHighlighted && (
          <div className="absolute inset-0 rounded-xl bg-white/10 animate-pulse-scale pointer-events-none" />
        )}

        {/* Frenzy aura */}
        {isFrenzy && (
          <div className="absolute inset-0 rounded-xl bg-yellow-400/20 animate-pulse pointer-events-none" />
        )}
      </div>

      {/* Label */}
      <div className="flex flex-col items-center gap-0.5">
        <span className="pixel-font text-white text-[8px] sm:text-[10px] font-bold drop-shadow-md">
          {name}
        </span>
        <span
          className={cn(
            'pixel-font text-[6px] sm:text-[8px] text-white px-2 py-0.5 rounded-full',
            labelBg,
          )}
        >
          {eatsLabel}
        </span>
      </div>
    </div>
  );
}
