import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Trash2 } from 'lucide-react';

interface TrashZoneProps {
  isHighlighted: boolean;
}

export function TrashZone({ isHighlighted }: TrashZoneProps) {
  const { t } = useTranslation('games');

  return (
    <div
      className={cn(
        'absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-col items-center justify-end pb-3 sm:pb-4',
        'transition-all duration-200',
        isHighlighted && 'scale-110'
      )}
      style={{ height: '20%', zIndex: 15 }}
    >
      <div
        className={cn(
          'w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center',
          'bg-red-900/80 border-2 border-red-500/50',
          'transition-all duration-200',
          isHighlighted
            ? 'ring-4 ring-red-400 shadow-lg shadow-red-500/50 animate-pulse'
            : 'opacity-60'
        )}
      >
        <Trash2 className="w-6 h-6 sm:w-8 sm:h-8 text-red-300" />
      </div>
      <span className="pixel-font text-[6px] sm:text-[7px] text-red-300 mt-1">
        {t('namVsYum.trashZone.label')}
      </span>
    </div>
  );
}
