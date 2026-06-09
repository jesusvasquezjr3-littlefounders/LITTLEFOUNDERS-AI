import React from 'react';
import { LandingLayout } from '@/components/landing/LandingLayout';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CheckCircle2, ArrowRight, Zap, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

/* ── Active tier card ──────────────────────────────────────────────────────── */
function ActiveCard({ t }: { t: any }) {
  const features = [
    t('pricing.freemium_feature_1'),
    t('pricing.freemium_feature_2'),
    t('pricing.freemium_feature_3'),
    t('pricing.freemium_feature_4'),
    t('pricing.freemium_feature_5'),
  ];

  return (
    <div className="relative flex flex-col rounded-3xl overflow-hidden shadow-2xl glass-card border-indigo-200/60 dark:border-transparent">
      {/* Rainbow top strip */}
      <div className="h-1 w-full flex-shrink-0" style={{ background: 'linear-gradient(90deg, #f97316, #ec4899, #a855f7, #3b82f6)' }} />

      {/* Light-mode glow / dark-mode glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-64 rounded-full pointer-events-none opacity-30 dark:opacity-100"
        style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.18) 0%, rgba(139,92,246,0.10) 50%, transparent 75%)' }} />

      {/* Badge */}
      <div className="relative z-10 pt-8 px-8 flex justify-center">
        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest text-white"
          style={{ background: 'linear-gradient(135deg, #ff6b6b, #7048e8)' }}>
          <Zap className="w-3 h-3" /> {t('pricing.freemium_badge')}
        </span>
      </div>

      <div className="relative z-10 px-8 pt-6 pb-8 flex flex-col flex-1">
        <h3 className="landing-heading text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-1">
          {t('pricing.freemium_title')}
        </h3>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-5xl font-black text-gray-900 dark:text-white tracking-tighter">{t('pricing.freemium_price')}</span>
          <span className="text-gray-400 dark:text-white/40 text-xs font-bold uppercase tracking-widest">{t('pricing.freemium_period')}</span>
        </div>
        <p className="text-sm text-gray-500 dark:text-white/55 mb-6 leading-relaxed">{t('pricing.freemium_desc')}</p>

        <ul className="space-y-3 mb-8 flex-1">
          {features.map((feat, i) => (
            <li key={i} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #ff6b6b, #7048e8)' }}>
                <CheckCircle2 className="w-3 h-3 text-white" />
              </div>
              <span className="text-sm font-semibold text-gray-700 dark:text-white/80">{feat}</span>
            </li>
          ))}
        </ul>

        <Button asChild size="lg"
          className="btn-press w-full h-12 rounded-2xl font-black text-white border-0 shadow-none"
          style={{ background: 'linear-gradient(135deg, #ff6b6b, #7048e8)' }}>
          <Link to="/onboarding" className="flex items-center justify-center gap-2">
            {t('pricing.freemium_btn')} <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

/* ── Ghost tier card ───────────────────────────────────────────────────────── */
function GhostCard({ titleKey, t }: { titleKey: string; t: any }) {
  return (
    <div className="relative flex flex-col rounded-3xl overflow-hidden border border-gray-200/80 dark:border-white/8 bg-gray-50 dark:bg-white/[0.03] transition-all duration-700 group hover:border-gray-300 dark:hover:border-white/15 hover:shadow-md">

      {/* Coming soon watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
        <span className="text-gray-300/60 dark:text-white/[0.04] font-black text-3xl uppercase tracking-[0.5em] -rotate-12 group-hover:text-gray-300/80 dark:group-hover:text-white/[0.06] transition-colors leading-none text-center">
          {t('pricing.coming_soon')}
        </span>
      </div>

      {/* Lock icon */}
      <div className="relative z-10 pt-8 px-8 flex justify-center">
        <div className="w-10 h-10 rounded-full border border-gray-300 dark:border-white/10 bg-gray-200/60 dark:bg-white/5 flex items-center justify-center">
          <Lock className="w-4 h-4 text-gray-400 dark:text-white/30" />
        </div>
      </div>

      <div className="relative z-10 px-8 pt-6 pb-8 flex flex-col flex-1">
        <h3 className="landing-heading text-xl font-black text-gray-400 dark:text-white/40 uppercase tracking-tight mb-2">
          {t(titleKey)}
        </h3>

        <div className="mb-4 blur-sm select-none">
          <span className="text-4xl font-black text-gray-300 dark:text-white/20 tracking-tighter">???</span>
        </div>

        <ul className="space-y-3 mb-8 flex-1 opacity-30 blur-[2px] group-hover:opacity-40 group-hover:blur-[1px] transition-all duration-700">
          {[1, 2, 3].map(i => (
            <li key={i} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-lg bg-gray-200 dark:bg-white/10 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-3 h-3 text-gray-400 dark:text-white/40" />
              </div>
              <span className="text-sm font-semibold text-gray-400 dark:text-white/50">{'· · · · · · · · ·'}</span>
            </li>
          ))}
        </ul>

        <Button variant="outline"
          className="w-full h-12 rounded-2xl font-bold border border-gray-200 dark:border-white/10 bg-transparent text-gray-400 dark:text-white/25 pointer-events-none uppercase tracking-widest text-xs hover:bg-transparent">
          {t('pricing.very_soon')}
        </Button>
      </div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────────── */
export default function PricingPage() {
  const { t } = useTranslation('landing');

  return (
    <LandingLayout>
      <div className="min-h-screen">

      <section className="relative pt-24 pb-10 px-4 overflow-hidden text-gray-900 dark:text-white hero-sunburst dark:bg-[#16112a]">

        {/* Ambient glow orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-20 right-[5%] w-[400px] h-[400px] bg-indigo-300/20 dark:bg-indigo-950/20 rounded-full blur-[90px] animate-orb-1" />
          <div className="absolute -bottom-20 left-[8%] w-[350px] h-[350px] bg-pink-300/25 dark:bg-pink-700/18 rounded-full blur-[90px] animate-orb-2" style={{ animationDelay: '3s' }} />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto text-center">

          <h1 className="landing-heading text-4xl md:text-5xl lg:text-6xl font-black leading-tight mb-4 animate-fade-in-up-delay-1">
            {t('pricing.title')}
          </h1>
          <div className="flex justify-center mb-4">
            <svg viewBox="0 0 260 14" fill="none" className="w-52" preserveAspectRatio="none">
              <path d="M2 9 C60 2, 130 13, 200 6 C225 3, 248 10, 258 7" stroke="url(#pricing-sq)" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
              <defs>
                <linearGradient id="pricing-sq" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f97316"/><stop offset="100%" stopColor="#a855f7"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <p className="landing-body-text text-lg text-gray-600 dark:text-white/55 leading-relaxed font-medium animate-fade-in-up-delay-2 max-w-xl mx-auto">
            {t('pricing.subtitle')}
          </p>
        </div>

        {/* Wave bottom — light: #FFF7ED, dark: slate-900 */}
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none pointer-events-none" style={{ height: 60 }}>
          <svg viewBox="0 0 1440 60" preserveAspectRatio="none" className="w-full h-full">
            <path d="M0,30 C360,60 720,8 1080,45 C1260,58 1380,18 1440,32 L1440,60 L0,60 Z"
              fill="#eff6ff" className="dark:hidden" />
            <path d="M0,30 C360,60 720,8 1080,45 C1260,58 1380,18 1440,32 L1440,60 L0,60 Z"
              className="hidden dark:block" style={{ fill: '#0f172a' }} />
          </svg>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          PRICING CARDS — light bg in light mode
      ══════════════════════════════════════════════════════ */}
      <section className="relative py-20 px-4 overflow-hidden bg-gradient-to-br from-blue-50/30 via-purple-50/30 to-pink-50/30 dark:from-slate-900 dark:to-slate-950">

        {/* Ambient glow orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-[10%] w-[400px] h-[400px] bg-indigo-300/15 dark:bg-indigo-950/12 rounded-full blur-[80px] animate-orb-1" />
          <div className="absolute bottom-0 left-[5%] w-[350px] h-[350px] bg-pink-300/15 dark:bg-pink-900/10 rounded-full blur-[80px] animate-orb-2" style={{ animationDelay: '3s' }} />
        </div>

        {/* Wave top */}
        <div className="absolute top-0 left-0 w-full overflow-hidden leading-none pointer-events-none" style={{ height: 60 }}>
          <svg viewBox="0 0 1440 60" preserveAspectRatio="none" className="w-full h-full">
            <path d="M0,30 C360,0 720,52 1080,15 C1260,2 1380,42 1440,28 L1440,0 L0,0 Z"
              fill="#eff6ff" className="dark:hidden" />
            <path d="M0,30 C360,0 720,52 1080,15 C1260,2 1380,42 1440,28 L1440,0 L0,0 Z"
              className="hidden dark:block" style={{ fill: '#0f172a' }} />
          </svg>
        </div>

        <div className="relative z-10 max-w-5xl mx-auto pt-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
            <ActiveCard t={t} />
            <GhostCard titleKey="pricing.tier2_title" t={t} />
            <GhostCard titleKey="pricing.tier3_title" t={t} />
          </div>

          <p className="text-center text-sm text-gray-400 dark:text-white/25 mt-10 font-medium">
            {t('hero.cta_subtext')}
          </p>
        </div>
      </section>

      </div>
    </LandingLayout>
  );
}
