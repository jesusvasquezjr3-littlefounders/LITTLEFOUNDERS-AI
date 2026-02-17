import { useTranslation } from 'react-i18next';
import type { MentorTip } from '../types';
import { cn } from '@/lib/utils';

interface MentorPopupProps {
  tip: MentorTip;
  onDismiss: () => void;
}

const MENTOR_EMOJIS: Record<string, string> = {
  drRho: '🧔',
  zara: '👧',
  liruf: '🦖',
  dina: '🦕',
};

const MENTOR_COLORS: Record<string, string> = {
  drRho: 'border-blue-400 bg-blue-900/90',
  zara: 'border-amber-400 bg-amber-900/90',
  liruf: 'border-green-400 bg-green-900/90',
  dina: 'border-pink-400 bg-pink-900/90',
};

export function MentorPopup({ tip, onDismiss }: MentorPopupProps) {
  const { t } = useTranslation('games');

  const emoji = MENTOR_EMOJIS[tip.character] || '💡';
  const colorClass = MENTOR_COLORS[tip.character] || 'border-white bg-slate-900/90';
  const name = t(tip.nameKey);
  const message = t(tip.tipKey);

  return (
    <div
      className="absolute bottom-[28%] left-2 right-2 sm:left-4 sm:right-4 flex justify-center pointer-events-auto"
      style={{ zIndex: 60 }}
      onClick={onDismiss}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onDismiss()}
    >
      <div
        className={cn(
          'mentor-popup max-w-sm w-full rounded-xl border-2 p-3 sm:p-4',
          'backdrop-blur-sm shadow-xl',
          colorClass,
        )}
      >
        <div className="flex items-start gap-3">
          {/* Mentor avatar */}
          <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/30 flex items-center justify-center text-xl sm:text-2xl">
            {emoji}
          </div>

          {/* Message */}
          <div className="flex-1 min-w-0">
            <p className="pixel-font text-[8px] sm:text-[9px] text-yellow-300 mb-1">
              {name}
            </p>
            <p className="text-white text-xs sm:text-sm leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        {/* Tap to dismiss hint */}
        <p className="pixel-font text-[6px] text-white/40 text-center mt-2">
          tap to dismiss
        </p>
      </div>
    </div>
  );
}
