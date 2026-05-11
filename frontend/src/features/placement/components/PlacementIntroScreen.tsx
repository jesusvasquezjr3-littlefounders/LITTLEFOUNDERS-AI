import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
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
        <div
          className="absolute inset-0 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'rgba(99,102,241,0.18)' }}
        />
        <div className="relative w-40 h-52 drop-shadow-2xl">
          <DrRhoCharacter mood="explaining" showBubble currentText={t('intro.rho_bubble', { name })} bubblePosition="top" />
        </div>
      </div>

      {/* Card */}
      <div
        className={cn(
          'relative rounded-3xl overflow-hidden w-full max-w-sm',
          'bg-white/70 border border-white/90',
          'dark:bg-white/[0.10] dark:border-white/20',
          'backdrop-blur-2xl saturate-[170%]',
          'shadow-2xl shadow-black/8 dark:shadow-black/60',
          'p-7',
        )}
      >
        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-3 leading-snug">
          {t('intro.title', { name })}
        </h2>
        <p className="text-gray-600 dark:text-white/75 text-sm leading-relaxed mb-2">
          {t('intro.body')}
        </p>
        <p className="text-gray-400 dark:text-white/45 text-xs mb-7">
          {t('intro.later_hint')}
        </p>

        {/* Accept CTA */}
        <button
          type="button"
          onClick={onAccept}
          className={cn(
            'relative group w-full py-4 rounded-2xl font-black text-white text-base mb-3',
            'transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]',
            'overflow-hidden',
          )}
          style={{
            background: 'linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)',
            boxShadow: '0 12px 32px rgba(99,102,241,0.45)',
            border: '1px solid rgba(255,255,255,0.15)',
          }}
        >
          <span
            className="absolute inset-0 pointer-events-none rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.14) 50%, transparent 70%)' }}
          />
          <span className="relative flex items-center justify-center gap-2">
            {t('intro.accept_button')}
            <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
          </span>
        </button>

        {/* Skip link */}
        <button
          type="button"
          onClick={onSkip}
          className="w-full text-center text-xs text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/60 transition-colors py-1 font-medium"
        >
          {t('intro.skip_link')}
        </button>
      </div>
    </div>
  );
}
