import { useTranslation } from 'react-i18next';
import { useSound } from '@/contexts/SoundContext';

interface Props {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

export function PauseOverlay({ onResume, onRestart, onQuit }: Props) {
  const { t } = useTranslation('games');
  const { mute, toggleMute } = useSound();

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center pd-font"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}>
      <div className="pd-card w-full max-w-xs mx-4 p-6 text-center pd-slide-up">
        <h2 className="text-2xl font-black text-amber-900 mb-6">
          ⏸ {t('paperDetective.pause.title')}
        </h2>

        <div className="flex flex-col gap-3">
          <button
            onClick={onResume}
            className="pd-btn pd-btn-primary py-3 text-base font-bold w-full"
          >
            ▶ {t('paperDetective.pause.resume')}
          </button>

          <button
            onClick={toggleMute}
            className="pd-btn py-3 text-sm font-bold w-full text-amber-800"
          >
            {mute
              ? `🔇 ${t('paperDetective.pause.soundOff')}`
              : `🔊 ${t('paperDetective.pause.soundOn')}`}
          </button>

          <button
            onClick={onRestart}
            className="pd-btn py-3 text-sm font-bold w-full text-amber-700"
          >
            🔄 {t('paperDetective.pause.restart')}
          </button>

          <button
            onClick={onQuit}
            className="pd-btn pd-btn-danger py-3 text-sm font-bold w-full"
          >
            🚪 {t('paperDetective.pause.quit')}
          </button>
        </div>
      </div>
    </div>
  );
}
