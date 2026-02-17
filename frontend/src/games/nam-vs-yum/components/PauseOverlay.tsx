import { useTranslation } from 'react-i18next';
import { useSound } from '@/contexts/SoundContext';
import { Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PauseOverlayProps {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

export function PauseOverlay({ onResume, onRestart, onQuit }: PauseOverlayProps) {
  const { t } = useTranslation('games');
  const { mute, toggleMute } = useSound();

  const buttonBase = cn(
    'pixel-font text-xs sm:text-sm w-full max-w-[200px] py-3 rounded-lg',
    'border-b-4 transition-all duration-100',
    'hover:brightness-110 active:border-b-0 active:mt-1',
  );

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm" style={{ zIndex: 70 }}>
      <div className="flex flex-col items-center gap-4 animate-bounce-in">
        <h2 className="pixel-font text-lg sm:text-xl text-white retro-glow mb-2">
          {t('namVsYum.pause.title')}
        </h2>

        {/* Resume */}
        <button
          onClick={onResume}
          className={cn(buttonBase, 'bg-green-500 border-green-700 text-white')}
        >
          {t('namVsYum.pause.resume')}
        </button>

        {/* Sound toggle */}
        <button
          onClick={toggleMute}
          className={cn(
            buttonBase,
            'bg-slate-600 border-slate-800 text-white',
            'flex items-center justify-center gap-2',
          )}
        >
          {mute ? (
            <VolumeX className="w-4 h-4" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
          {mute ? t('namVsYum.pause.soundOff') : t('namVsYum.pause.soundOn')}
        </button>

        {/* Restart */}
        <button
          onClick={onRestart}
          className={cn(buttonBase, 'bg-amber-500 border-amber-700 text-white')}
        >
          {t('namVsYum.pause.restart')}
        </button>

        {/* Quit */}
        <button
          onClick={onQuit}
          className={cn(buttonBase, 'bg-red-500 border-red-700 text-white')}
        >
          {t('namVsYum.pause.quit')}
        </button>
      </div>
    </div>
  );
}
