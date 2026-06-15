import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import DrRhoCharacter from '@/components/characters/DrRhoCharacter';

interface Props {
  name: string;
  onAccept: () => void;
  onSkip: () => void;
}

export function PlacementIntroScreen({ name, onAccept, onSkip }: Props) {
  const { t, i18n } = useTranslation('placement');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const lang = i18n.language?.startsWith('en') ? 'EN' : 'ES';
    const src = `/sounds/onboarding/${lang}/5-pre-quiz_${lang}.mp3`;
    const audio = new Audio(src);
    audio.volume = 0.7;
    audio.play().catch(() => { /* ignore autoplay errors */ });
    audioRef.current = audio;

    return () => {
      audio.pause();
      if (audioRef.current === audio) audioRef.current = null;
    };
  }, [i18n.language]);

  return (
    <div className="flex flex-col items-center text-center w-full animate-in fade-in zoom-in-95 duration-700">
      {/* Character */}
      <div className="relative flex items-center justify-center mb-4">
        <div className="absolute inset-0 rounded-full blur-3xl pointer-events-none bg-indigo-400/15 dark:bg-indigo-500/15" />
        <div className="relative w-56 h-56 sm:w-64 sm:h-64 drop-shadow-2xl">
          <DrRhoCharacter mood="explaining" showBubble currentText={t('intro.rho_bubble', { name })} bubblePosition="top" />
        </div>
      </div>

      {/* Card */}
      <div className="relative rounded-3xl w-full max-w-sm bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 shadow-xl shadow-black/5 dark:shadow-black/40 p-7">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3 leading-snug">
          {t('intro.title', { name })}
        </h2>
        <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-2">
          {t('intro.body')}
        </p>
        <p className="text-slate-500 dark:text-slate-500 text-xs mb-7">
          {t('intro.later_hint')}
        </p>

        {/* Accept CTA */}
        <button
          type="button"
          onClick={onAccept}
          className="corp-btn-primary group w-full h-12 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 mb-3"
        >
          {t('intro.accept_button')}
          <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
        </button>

        {/* Skip link */}
        <button
          type="button"
          onClick={onSkip}
          className="w-full text-center text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors py-1 font-medium"
        >
          {t('intro.skip_link')}
        </button>
      </div>
    </div>
  );
}
