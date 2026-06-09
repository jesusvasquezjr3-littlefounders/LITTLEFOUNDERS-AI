import React from 'react';
import { useTranslation } from 'react-i18next';
import { LandingLayout } from '@/components/landing/LandingLayout';
import {
  Clock,
} from 'lucide-react';

/* ─── Wave divider ────────────────────────────────────────────────────────── */
function WaveDivider({ top = false, fromClass, toClass }: { top?: boolean; fromClass?: string; toClass: string }) {
  return (
    <div className={`relative w-full overflow-hidden leading-none pointer-events-none ${top ? '' : ''}`} style={{ height: 64 }}>
      <svg viewBox="0 0 1440 64" preserveAspectRatio="none" className={`absolute w-full h-full ${top ? 'bottom-0' : 'bottom-0'}`} xmlns="http://www.w3.org/2000/svg">
        {top
          ? <path d="M0,64 C360,20 720,64 1080,30 C1260,12 1380,50 1440,40 L1440,64 L0,64 Z" className={toClass} />
          : <path d="M0,20 C360,60 720,10 1080,45 C1260,60 1380,20 1440,35 L1440,64 L0,64 Z" className={toClass} />
        }
      </svg>
    </div>
  );
}




/* ─── PAGE ────────────────────────────────────────────────────────────────── */
export default function FamiliesPage() {
  const { t, i18n } = useTranslation('landing');
  const lang = i18n.language;

  return (
    <LandingLayout>
      <div className="min-h-screen">

        {/* ════════════════════════════════════════════════════════
            HERO — warm amber sunburst, cozy family energy
        ════════════════════════════════════════════════════════ */}
        <section className="relative pt-20 lg:pt-32 pb-0 px-4 overflow-hidden min-h-[92vh] flex flex-col justify-center hero-sunburst dark:bg-[#16112a]">

          {/* Ambient glows */}
          <div className="absolute inset-0 overflow-hidden -z-10 pointer-events-none">
             <div className="absolute top-10 right-[5%] w-[500px] h-[500px] bg-indigo-300/15 dark:bg-indigo-950/10 rounded-full blur-[100px] animate-orb-1" />
            <div className="absolute bottom-10 left-[10%] w-[400px] h-[400px] bg-pink-300/15 dark:bg-pink-900/8 rounded-full blur-[100px] animate-orb-2" style={{ animationDelay: '3s' }} />
          </div>

          <div className="max-w-7xl mx-auto w-full relative z-10 pb-16">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">

              {/* LEFT */}
              <div className="space-y-6">

                {/* Coming-soon badge */}
                <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full glass-badge border-indigo-300/40 dark:border-indigo-700/30 shadow-lg animate-fade-in-up">
                  <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-sm font-bold text-indigo-800 dark:text-indigo-300">{t('families.hero.coming_soon_label')}</span>
                </div>

                <h1 className="landing-heading text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 dark:text-white leading-[1.1] tracking-tight animate-fade-in-up-delay-1">
                  {t('families.hero.title_part1')}
                  <span className="block mt-1">
                    <span className="relative inline-block">
                      <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b6b] to-[#7048e8]">
                        {t('families.hero.title_highlight')}
                      </span>
                      <svg className="absolute -bottom-1.5 left-0 w-full" viewBox="0 0 200 10" fill="none" preserveAspectRatio="none">
                        <path d="M2 6 C50 1, 100 9, 150 4 C170 2, 190 7, 198 5" stroke="url(#fam-squiggle)" strokeWidth="3" strokeLinecap="round" fill="none"/>
                        <defs>
                          <linearGradient id="fam-squiggle" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#ff6b6b"/>
                            <stop offset="100%" stopColor="#7048e8"/>
                          </linearGradient>
                        </defs>
                      </svg>
                    </span>
                  </span>
                  <span className="block mt-1">{t('families.hero.title_part2')}</span>
                </h1>

                <p className="landing-body-text text-base lg:text-lg text-gray-700 dark:text-gray-300 max-w-xl leading-relaxed font-medium animate-fade-in-up-delay-2">
                  {t('families.hero.subtitle')}
                </p>

                {/* Steps */}
                <div className="flex flex-col gap-3 animate-fade-in-up-delay-2">
                  {[
                    { n: 1, text: t('families.hero.step_1') },
                    { n: 2, text: t('families.hero.step_2') },
                    { n: 3, text: t('families.hero.step_3') },
                  ].map(step => (
                    <div key={step.n} className="flex items-center gap-3 p-3 rounded-2xl glass-card hover:shadow-md transition-all">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-500 to-violet-600 text-white text-xs font-black flex items-center justify-center shadow-md flex-shrink-0">{step.n}</div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{step.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* RIGHT — Hero Visual Block */}
              <div className="w-full flex justify-center items-center relative h-[300px] lg:h-[560px] flex-shrink-0 lg:w-[600px] overflow-visible animate-float" style={{ animationDelay: '1s' }}>
                {/* Blurs behind the image */}
                <div className="absolute bottom-0 z-0 animate-float left-1/2 -ml-[150px] w-[300px] h-[300px] lg:left-auto lg:ml-0 lg:-right-16 lg:w-[640px] lg:h-[640px]" style={{ animationDelay: '1.5s' }}>
                  <div className="absolute inset-8 lg:inset-20 rounded-full bg-pink-400/20 blur-[50px] lg:blur-[80px]" />
                </div>
                <div className="absolute bottom-0 z-0 animate-float left-0 w-[200px] h-[200px] lg:left-auto lg:right-[13rem] lg:w-[400px] lg:h-[400px]" style={{ animationDelay: '0s' }}>
                  <div className="absolute inset-8 lg:inset-16 rounded-full bg-emerald-400/25 blur-[40px] lg:blur-[60px]" />
                </div>

                {/* Morphing Blob Frame */}
                <div className="relative w-[340px] h-[260px] sm:w-[400px] sm:h-[300px] lg:w-[600px] lg:h-[560px] flex-shrink-0 morphing-blob-frame bg-gradient-to-tr from-[#ff6b6b]/60 via-white/20 to-[#7048e8]/60 dark:from-[#ff6b6b]/45 dark:via-white/5 dark:to-[#7048e8]/45 p-[8px] backdrop-blur-md shadow-[0_25px_60px_-15px_rgba(112,72,232,0.45)] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] border border-white/40 dark:border-white/15 overflow-hidden z-10" style={{ animationDelay: '0.5s' }}>
                  <div className="w-full h-full overflow-hidden bg-white/70 dark:bg-slate-900/70 relative" style={{ borderRadius: 'inherit' }}>
                    <img 
                      src="/Hero-Families.png" 
                      alt="LittleFounders Families Hero" 
                      className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-500"
                    />
                    {/* Glossy liquid glass reflections */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-transparent pointer-events-none mix-blend-overlay" />
                    <div className="absolute -inset-full bg-gradient-to-b from-white/10 via-transparent to-transparent rotate-45 pointer-events-none" />
                  </div>
                </div>

                {/* Magical Sparkles/Glitter around the liquid glass image */}
                <svg className="absolute -top-4 left-10 sm:-top-6 sm:left-20 lg:-top-10 lg:left-24 z-20 w-8 h-8 text-yellow-300 pointer-events-none animate-sparkle-1" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C12 0 12.5 8.5 15 11C17.5 13.5 24 12 24 12C24 12 17.5 12.5 15 15C12.5 17.5 12 24 12 24C12 24 11.5 17.5 9 15C6.5 12.5 0 12 0 12C0 12 6.5 11.5 9 11C11.5 8.5 12 0 12 0Z" />
                </svg>
                <svg className="absolute top-10 -right-2 sm:top-14 sm:-right-4 lg:top-20 lg:-right-8 z-20 w-10 h-10 text-amber-300 pointer-events-none animate-sparkle-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C12 0 12.5 8.5 15 11C17.5 13.5 24 12 24 12C24 12 17.5 12.5 15 15C12.5 17.5 12 24 12 24C12 24 11.5 17.5 9 15C6.5 12.5 0 12 0 12C0 12 6.5 11.5 9 11C11.5 8.5 12 0 12 0Z" />
                </svg>
                <svg className="absolute top-1/2 -left-6 sm:-left-8 lg:-left-12 z-20 w-7 h-7 text-yellow-200 pointer-events-none animate-sparkle-3" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C12 0 12.5 8.5 15 11C17.5 13.5 24 12 24 12C24 12 17.5 12.5 15 15C12.5 17.5 12 24 12 24C12 24 11.5 17.5 9 15C6.5 12.5 0 12 0 12C0 12 6.5 11.5 9 11C11.5 8.5 12 0 12 0Z" />
                </svg>
                <svg className="absolute bottom-6 -right-4 sm:bottom-10 sm:-right-6 lg:bottom-16 lg:-right-10 z-20 w-6 h-6 text-pink-300 pointer-events-none animate-sparkle-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C12 0 12.5 8.5 15 11C17.5 13.5 24 12 24 12C24 12 17.5 12.5 15 15C12.5 17.5 12 24 12 24C12 24 11.5 17.5 9 15C6.5 12.5 0 12 0 12C0 12 6.5 11.5 9 11C11.5 8.5 12 0 12 0Z" />
                </svg>
                <svg className="absolute -bottom-4 left-12 sm:-bottom-6 sm:left-24 lg:-bottom-10 lg:left-32 z-20 w-8 h-8 text-amber-200 pointer-events-none animate-sparkle-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C12 0 12.5 8.5 15 11C17.5 13.5 24 12 24 12C24 12 17.5 12.5 15 15C12.5 17.5 12 24 12 24C12 24 11.5 17.5 9 15C6.5 12.5 0 12 0 12C0 12 6.5 11.5 9 11C11.5 8.5 12 0 12 0Z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Wave bottom */}
          <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none" style={{ height: 64 }}>
            <svg viewBox="0 0 1440 64" preserveAspectRatio="none" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <path d="M0,30 C360,64 720,15 1080,45 C1260,60 1380,20 1440,35 L1440,64 L0,64 Z" className="fill-white dark:fill-slate-950" />
            </svg>
          </div>
        </section>


      </div>
    </LandingLayout>
  );
}
