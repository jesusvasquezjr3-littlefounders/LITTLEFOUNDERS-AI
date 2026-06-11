import { useState, useEffect } from "react";
import { useTranslation, Trans } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { hasSession } from "@/lib/guestProfile";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen, Gamepad2, Bot, Layers, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { LandingLayout } from "../components/landing/LandingLayout";

import { GamifiedLearningSection } from "../components/landing/GamifiedLearningSection";
import { useLanguage } from "@/hooks/useLanguage";
import { useUserLanguage } from "@/hooks/useUserLanguage";
import { SupportedLanguage } from "@/i18n";

/* ── Wave divider ─────────────────────────────────────────────────────────── */
function WaveDivider({ flip = false, fromColor, toColor }: { flip?: boolean; fromColor: string; toColor: string }) {
  return (
    <div className={`relative w-full overflow-hidden leading-none ${flip ? 'rotate-180' : ''}`} style={{ height: 70 }}>
      <svg viewBox="0 0 1440 70" preserveAspectRatio="none" className="absolute bottom-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <path d="M0,40 C240,0 480,70 720,35 C960,0 1200,60 1440,30 L1440,70 L0,70 Z" className={toColor} />
      </svg>
    </div>
  );
}

/* ── Floating decorative coin/star ────────────────────────────────────────── */
function FloatingDeco({ className, children, style }: { className?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className={`absolute pointer-events-none select-none text-2xl animate-float ${className}`} style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))', ...style }}>
      {children}
    </div>
  );
}

const LandingPage = () => {
  const { t } = useTranslation('landing');
  const { languages, isCurrentLanguage } = useLanguage();
  const { saveLanguagePreference } = useUserLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    if (hasSession()) navigate('/learn');
  }, [navigate]);

  const [ctaWordIndex, setCtaWordIndex] = useState(0);
  const ctaWords = t('cta.rotating_words', { returnObjects: true }) as string[];


  useEffect(() => {
    const wordInterval = setInterval(() => setCtaWordIndex(p => (p + 1) % ctaWords.length), 4000);
    return () => clearInterval(wordInterval);
  }, [ctaWords.length]);



  const problemCards = [
    { emoji: '📉', color: 'from-red-400 to-rose-500', shadow: 'shadow-red-200 dark:shadow-red-900/40', title: t('problem.card1_title'), text: t('problem.card1_text') },
    { emoji: '😟', color: 'from-violet-400 to-blue-500', shadow: 'shadow-purple-200 dark:shadow-purple-900/45', title: t('problem.card2_title'), text: t('problem.card2_text') },
    { emoji: '💤', color: 'from-slate-400 to-gray-500', shadow: 'shadow-slate-200 dark:shadow-slate-900/40', title: t('problem.card3_title'), text: t('problem.card3_text') },
    { emoji: '💸', color: 'from-violet-400 to-purple-500', shadow: 'shadow-violet-200 dark:shadow-violet-900/40', title: t('problem.card4_title'), text: t('problem.card4_text') },
  ];

  const featureCards = [
    { icon: BookOpen, emoji: '📖', color: 'from-blue-400 to-cyan-500', shadow: 'shadow-blue-200 dark:shadow-blue-900/40', title: t('features.interactive_lessons.title'), desc: t('features.interactive_lessons.description'), badge: null },
    { icon: Gamepad2, emoji: '🎮', color: 'from-violet-400 to-purple-600', shadow: 'shadow-violet-200 dark:shadow-violet-900/40', title: t('features.video_games.title'), desc: t('features.video_games.description'), badge: null },
    { icon: Bot, emoji: '🤖', color: 'from-pink-400 to-rose-500', shadow: 'shadow-pink-200 dark:shadow-pink-900/40', title: t('features.ai_functionality.title'), desc: t('features.ai_functionality.description'), badge: t('features.ai_functionality.badge') },
    { icon: Layers, emoji: '✨', color: 'from-emerald-400 to-teal-500', shadow: 'shadow-emerald-200 dark:shadow-emerald-900/40', title: t('features.more_stuff.title'), desc: t('features.more_stuff.description'), badge: null },
  ];

  return (
    <LandingLayout>

      {/* ══════════════════════════════════════════════════════════
          HERO — warm sunburst background, big playful type
      ══════════════════════════════════════════════════════════ */}
      <header className="relative min-h-[100svh] flex flex-col pt-24 lg:pt-36 overflow-hidden hero-sunburst dark:bg-[#16112a]">

        {/* Ambient glows */}
        <div className="absolute inset-0 pointer-events-none -z-0">
          <div className="absolute top-10 left-1/4 w-96 h-96 rounded-full bg-indigo-300/20 dark:bg-indigo-950/20 blur-[80px] animate-orb-1" />
          <div className="absolute bottom-10 right-1/3 w-80 h-80 rounded-full bg-pink-300/20 dark:bg-pink-700/10 blur-[80px] animate-orb-2" />
          <div className="absolute top-1/2 right-10 w-64 h-64 rounded-full bg-violet-300/15 dark:bg-violet-700/10 blur-[60px] animate-orb-3" />
        </div>


        {/* Main hero grid */}
        <div className="relative z-10 flex-1 flex w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 items-center justify-center pb-8 lg:pb-16">
          <div className="flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16 w-full max-w-6xl">

            {/* Hero Visual Block */}
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
                    src="/Hero-Landing.png" 
                    alt="Niños y adolescentes aprendiendo finanzas e inversión interactiva con LittleFounders" 
                    loading="lazy"
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

            {/* Copy block */}
            <div className="relative z-30 text-center lg:text-left space-y-5 max-w-2xl lg:w-[580px] lg:flex-shrink-0">

              {/* Headline */}
              <h1 className="landing-heading text-4xl md:text-5xl lg:text-6xl font-black leading-[1.1] tracking-tight animate-fade-in-up-delay-1 text-gray-900 dark:text-white">
                <span className="lg:whitespace-nowrap">{t('hero.title_part1')}</span>{' '}
                <span className="relative inline-block">
                  <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b6b] to-[#7048e8]">
                    {t('hero.title_highlight')}
                  </span>
                  {/* Underline squiggle */}
                  <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 12" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
                    <path d="M2 8 C40 2, 80 12, 120 6 C160 0, 185 10, 198 6" stroke="url(#squiggle-grad)" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
                    <defs>
                      <linearGradient id="squiggle-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#ff6b6b"/>
                        <stop offset="100%" stopColor="#7048e8"/>
                      </linearGradient>
                    </defs>
                  </svg>
                </span>{' '}
                <span className="text-gray-800 dark:text-slate-100">{t('hero.title_part2')}</span>
              </h1>

              <p className="landing-body-text text-lg lg:text-xl text-gray-600 dark:text-gray-300 leading-relaxed font-medium animate-fade-in-up-delay-2">
                <Trans i18nKey="hero.subtitle" ns="landing" />
              </p>

              <div className="flex flex-col gap-2 pt-2 animate-fade-in-up-delay-3 text-sm lg:text-base font-bold text-gray-700 dark:text-gray-300">
                <div className="flex items-center justify-center lg:justify-start gap-2">
                  <span className="text-pink-500 text-lg leading-none">✓</span> {t('hero.age_range')}
                </div>
                <div className="flex items-center justify-center lg:justify-start gap-2">
                  <span className="text-violet-500 text-lg leading-none">✓</span> {t('hero.time_required')}
                </div>
                <div className="flex items-center justify-center lg:justify-start gap-2">
                  <span className="text-emerald-500 text-lg leading-none">✓</span> {t('hero.main_benefit')}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start pt-4 animate-fade-in-up-delay-3 w-full">
                <Button asChild size="lg" className="btn-press h-14 px-10 text-lg rounded-2xl bg-gradient-to-r from-pink-500 to-violet-600 hover:from-pink-400 hover:to-violet-500 text-white font-black w-72 border-0 shadow-none">
                  <Link to="/onboarding" className="flex items-center gap-2 justify-center">
                    {t('hero.cta_button')}
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="lg" className="glass-btn-ghost h-14 px-8 text-lg rounded-2xl font-bold text-gray-700 dark:text-gray-200 w-72 transition-all flex justify-center">
                  <Link to="/login">{t('hero.login_link')}</Link>
                </Button>
              </div>
            </div>

          </div>
        </div>

        {/* Wave bottom — hero → problem (always dark #0F0A1E) */}
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none pointer-events-none" style={{ height: 64 }}>
          <svg viewBox="0 0 1440 64" preserveAspectRatio="none" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,32 C360,64 720,8 1080,48 C1260,64 1380,24 1440,38 L1440,64 L0,64 Z" fill="currentColor" className="text-white dark:text-[#080610]" />
          </svg>
        </div>

        {/* Scroll hint */}
        <div className="relative z-10 w-full flex justify-center pb-4 text-gray-400 hidden lg:flex animate-bounce">
          <ChevronDown className="w-5 h-5 opacity-60" />
        </div>

        {/* Language switcher bar */}
        <div className="relative z-10 w-full py-6 border-t border-slate-200/50 dark:border-slate-700/50 glass-panel mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
            <h3 className="text-[10px] sm:text-xs font-bold text-gray-500 dark:text-gray-500 mb-3 sm:mb-4 uppercase tracking-[0.2em]">
              {t('language.title')}
            </h3>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => saveLanguagePreference(lang.code as SupportedLanguage)}
                  className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-300 border ${
                    isCurrentLanguage(lang.code)
                      ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white border-indigo-200 dark:border-indigo-800/40 shadow-md shadow-indigo-200/40 scale-105'
                      : 'bg-transparent text-gray-600 dark:text-gray-400 border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <span className="text-lg leading-none">{lang.flag}</span>
                  {lang.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════
          PROBLEM SECTION — dark, punchy, high contrast
      ══════════════════════════════════════════════════════════ */}
      <section id="problem" className="relative py-24 bg-white dark:bg-[#080610] overflow-hidden">
        {/* Background grid pattern */}
        <div className="absolute inset-0 pointer-events-none opacity-20 text-gray-200 dark:text-gray-800" style={{
          backgroundImage: 'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
          backgroundSize: '48px 48px'
        }} />

        {/* Ambient glows */}
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full bg-violet-600/10 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full bg-pink-600/10 blur-[100px] pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-14">
          <div>
            <h2 className="landing-heading text-3xl md:text-5xl font-black text-gray-900 dark:text-white leading-tight">
              {t('problem.title_part1')}{' '}
              <span className="relative inline-block">
                <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b6b] to-[#7048e8]">{t('problem.title_part2')}</span>
                {/* Underline squiggle */}
                <svg className="absolute top-[75%] left-0 w-full z-0" viewBox="0 0 200 12" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
                  <path d="M2 8 C40 2, 80 12, 120 6 C160 0, 185 10, 198 6" stroke="url(#squiggle-grad-problem)" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
                  <defs>
                    <linearGradient id="squiggle-grad-problem" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#ff6b6b"/>
                      <stop offset="100%" stopColor="#7048e8"/>
                    </linearGradient>
                  </defs>
                </svg>
              </span>
            </h2>
            <p className="landing-body-text relative z-10 mt-14 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed font-medium">
              <Trans i18nKey="problem.subtitle" ns="landing" />
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 text-left">
            {problemCards.map((card, i) => (
              <div key={i} className={`card-tilt relative glass-card rounded-3xl p-6 hover:shadow-2xl`}>
                {/* Morphing Liquid Glass icon background */}
                <div 
                  className="w-16 h-16 relative flex-shrink-0 morphing-blob-frame bg-gradient-to-tr from-[#ff6b6b]/60 via-white/20 to-[#7048e8]/60 dark:from-[#ff6b6b]/45 dark:via-white/5 dark:to-[#7048e8]/45 p-[3px] backdrop-blur-md shadow-md border border-white/40 dark:border-white/15 overflow-hidden mb-5 z-10"
                  style={{ animationDelay: `${i * 0.4}s` }}
                >
                  <div 
                    className={`w-full h-full flex items-center justify-center overflow-hidden bg-gradient-to-br ${card.color} relative`} 
                    style={{ borderRadius: 'inherit' }}
                  >
                    <span className="relative z-10 text-2xl">{card.emoji}</span>
                    {/* Glossy liquid glass reflections */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/35 to-transparent pointer-events-none mix-blend-overlay" />
                    <div className="absolute -inset-full bg-gradient-to-b from-white/15 via-transparent to-transparent rotate-45 pointer-events-none" />
                  </div>
                </div>
                <h3 className="landing-heading font-black text-xl mb-2 text-gray-900 dark:text-white">{card.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{card.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Wave bottom → GamifiedLearning dark bg */}
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none" style={{ height: 60 }}>
          <svg viewBox="0 0 1440 60" preserveAspectRatio="none" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,30 C360,60 720,0 1080,40 C1260,55 1380,25 1440,30 L1440,60 L0,60 Z" fill="currentColor" className="text-indigo-50 dark:text-[#0d0a1f]" />
          </svg>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          GAMIFIED LEARNING (existing animated section)
      ══════════════════════════════════════════════════════════ */}
      <GamifiedLearningSection />

      {/* ══════════════════════════════════════════════════════════
          FEATURES — warm background, playful cards
      ══════════════════════════════════════════════════════════ */}
      <section id="features" className="relative py-24 bg-gradient-to-br from-blue-50/30 via-purple-50/30 to-pink-50/30 dark:from-slate-900 dark:to-slate-950 overflow-hidden">

        {/* Wave top ← from GamifiedLearning dark bg */}
        <div className="absolute top-0 left-0 w-full overflow-hidden leading-none" style={{ height: 60 }}>
          <svg viewBox="0 0 1440 60" preserveAspectRatio="none" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,30 C360,0 720,60 1080,20 C1260,5 1380,45 1440,30 L1440,0 L0,0 Z" fill="currentColor" className="text-slate-50 dark:text-[#0a1628]" />
          </svg>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <h2 className="landing-heading text-4xl md:text-5xl font-black text-gray-900 dark:text-white mb-4 leading-tight">
              {t('features.title')}
            </h2>
            <p className="landing-body-text text-lg text-gray-600 dark:text-gray-300 font-medium">{t('features.subtitle')}</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {featureCards.map((card, i) => (
              <div key={i} className={`card-tilt relative glass-card rounded-3xl p-6 hover:shadow-2xl`}>
                {card.badge && (
                  <div className="absolute top-4 right-4 bg-pink-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                    {card.badge}
                  </div>
                )}
                {/* Morphing Liquid Glass icon background */}
                <div 
                  className="w-16 h-16 relative flex-shrink-0 morphing-blob-frame bg-gradient-to-tr from-[#ff6b6b]/60 via-white/20 to-[#7048e8]/60 dark:from-[#ff6b6b]/45 dark:via-white/5 dark:to-[#7048e8]/45 p-[3px] backdrop-blur-md shadow-md border border-white/40 dark:border-white/15 overflow-hidden mb-5 z-10"
                  style={{ animationDelay: `${(i + 4) * 0.4}s` }}
                >
                  <div 
                    className={`w-full h-full flex items-center justify-center overflow-hidden bg-gradient-to-br ${card.color} relative`} 
                    style={{ borderRadius: 'inherit' }}
                  >
                    <span className="relative z-10 text-2xl">{card.emoji}</span>
                    {/* Glossy liquid glass reflections */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/35 to-transparent pointer-events-none mix-blend-overlay" />
                    <div className="absolute -inset-full bg-gradient-to-b from-white/15 via-transparent to-transparent rotate-45 pointer-events-none" />
                  </div>
                </div>
                <h3 className="landing-heading font-black text-xl mb-2 text-gray-900 dark:text-white">{card.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Wave bottom → ParentCTA dark bg */}
        <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none" style={{ height: 60 }}>
          <svg viewBox="0 0 1440 60" preserveAspectRatio="none" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,20 C480,60 960,0 1440,40 L1440,60 L0,60 Z" fill="currentColor" className="text-violet-50 dark:text-[#0a0520]" />
          </svg>
        </div>
      </section>

    </LandingLayout>
  );
};

export default LandingPage;
