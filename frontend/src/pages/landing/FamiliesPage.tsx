import React from 'react';
import { motion } from "framer-motion";
import { useTranslation } from 'react-i18next';
import { LandingLayout } from '@/components/landing/LandingLayout';
import { AnimatedSection, AnimatedStagger, AnimatedItem } from '@/components/ui/AnimatedSection';
import {
  CheckCircle2,
  Clock, Flame,
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

/* ─── Hero dashboard preview ──────────────────────────────────────────────── */
function HeroDashboardPreview({ t }: { t: any }) {
  const tasks = [
    { label: t('families.mock_data.tidy_room'), coins: 30, done: true, color: 'pink' },
    { label: t('families.mock_data.complete_lesson'), coins: 50, done: true, color: 'purple' },
    { label: t('families.mock_data.water_plants'), coins: 25, done: false, color: 'blue' },
    { label: t('families.mock_data.practice_piano'), coins: 40, done: false, color: 'green' },
  ];
  const completed = tasks.filter(t => t.done).length;
  const pct = Math.round((completed / tasks.length) * 100);

  return (
    <div className="relative w-full max-w-sm mx-auto select-none">
      {/* Glow */}
      <div className="absolute -inset-4 bg-gradient-to-br from-[#ff6b6b]/20 to-[#7048e8]/20 dark:from-[#ff6b6b]/10 dark:to-[#7048e8]/10 rounded-3xl blur-3xl -z-10" />

      {/* Card */}
      <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#ff6b6b] to-[#e64980] p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">{t('families.mock_data.panel_header')}</p>
              <p className="text-white font-black text-lg">Sofía</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl">🦕</div>
          </div>
          <div className="flex items-center gap-2 bg-white/15 rounded-xl px-4 py-2">
            <span className="text-2xl">🪙</span>
            <div>
              <p className="text-white font-black text-xl leading-none">1,250</p>
              <p className="text-white/70 text-xs">{t('families.mock_data.accumulated_coins')}</p>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">{t('families.mock_data.today_progress')}</span>
            <span className="text-xs font-black text-orange-600 dark:text-orange-400">{pct}%</span>
          </div>
          <div className="h-2.5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#ff6b6b] to-[#e64980] rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {/* Tasks */}
        <div className="px-5 pb-5 space-y-2">
          {tasks.map((task, i) => (
            <div key={i} className={`flex items-center gap-3 p-3 rounded-xl ${task.done ? 'bg-green-50 dark:bg-green-900/15' : 'bg-gray-50 dark:bg-slate-800/50'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${task.done ? 'bg-green-500' : 'border-2 border-gray-300 dark:border-gray-600'}`}>
                {task.done && <CheckCircle2 className="w-4 h-4 text-white" />}
              </div>
              <span className={`text-sm font-semibold flex-1 ${task.done ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>{task.label}</span>
              <div className="flex items-center gap-1 text-xs font-black text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                🪙 {task.coins}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Streak badge */}
      <div className="absolute -top-3 -right-3 bg-gradient-to-br from-orange-400 to-red-500 text-white px-3 py-1.5 rounded-xl shadow-lg text-xs font-black flex items-center gap-1.5 z-10 animate-glow-pulse">
        <Flame className="w-3.5 h-3.5" /> {t('families.mock_data.streak_days', { count: 7 })}
      </div>
    </div>
  );
}


/* ─── PAGE ────────────────────────────────────────────────────────────────── */
export default function FamiliesPage() {
  const { t, i18n } = useTranslation('landing');
  const lang = i18n.language;

  return (
    <LandingLayout hideCTA={true}>
      <div className="min-h-screen">

        {/* ════════════════════════════════════════════════════════
            HERO — warm amber sunburst, cozy family energy
        ════════════════════════════════════════════════════════ */}
        <section className="relative pt-20 lg:pt-32 pb-0 px-4 overflow-hidden min-h-[92vh] flex flex-col justify-center hero-sunburst dark:bg-[#16112a]">

          {/* Ambient glows */}
          <div className="absolute inset-0 overflow-hidden -z-10 pointer-events-none">
            <div className="absolute top-10 right-[5%] w-[500px] h-[500px] bg-orange-300/15 dark:bg-orange-900/10 rounded-full blur-[100px] animate-orb-1" />
            <div className="absolute bottom-10 left-[10%] w-[400px] h-[400px] bg-pink-300/15 dark:bg-pink-900/8 rounded-full blur-[100px] animate-orb-2" style={{ animationDelay: '3s' }} />
          </div>

          {/* Floating decos */}
          <div className="absolute top-28 left-[6%] text-3xl opacity-40 animate-float pointer-events-none" style={{ animationDelay: '0.5s' }}>👨‍👩‍👧</div>
          <div className="absolute top-40 right-[8%] text-2xl opacity-30 animate-float pointer-events-none" style={{ animationDelay: '1.5s' }}>🪙</div>
          <div className="absolute bottom-32 left-[18%] text-2xl opacity-30 animate-float pointer-events-none" style={{ animationDelay: '0.8s' }}>⭐</div>

          <div className="max-w-7xl mx-auto w-full relative z-10 pb-16">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">

              {/* LEFT */}
              <div className="space-y-6">

                {/* Coming-soon badge */}
                <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full glass-badge border-amber-300/40 dark:border-amber-700/30 shadow-lg animate-fade-in-up">
                  <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-sm font-bold text-amber-800 dark:text-amber-300">{t('families.hero.coming_soon_label')}</span>
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

                <p className="text-base lg:text-lg text-gray-700 dark:text-gray-300 max-w-xl leading-relaxed font-medium animate-fade-in-up-delay-2">
                  {t('families.hero.subtitle')}
                </p>

                {/* Steps */}
                <AnimatedStagger className="flex flex-col gap-3">
                  {[
                    { n: 1, icon: '📋', text: t('families.hero.step_1') },
                    { n: 2, icon: '✅', text: t('families.hero.step_2') },
                    { n: 3, icon: '🎁', text: t('families.hero.step_3') },
                  ].map(step => (
                    <AnimatedItem key={step.n}>
                      <motion.div
                        className="flex items-center gap-3 p-3 rounded-2xl glass-card hover:shadow-md transition-all"
                        whileHover={{ y: -2, transition: { duration: 0.2 } }}
                      >
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 text-white text-xs font-black flex items-center justify-center shadow-md flex-shrink-0">{step.n}</div>
                        <span className="text-base mr-1">{step.icon}</span>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{step.text}</span>
                      </motion.div>
                    </AnimatedItem>
                  ))}
                </AnimatedStagger>
              </div>

              {/* RIGHT — Dashboard mockup */}
              <div className="flex justify-center items-center pt-4 lg:pt-0 animate-fade-in-up-delay-2">
                <HeroDashboardPreview t={t} />
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
