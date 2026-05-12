import { useState, useEffect } from "react";
import { useTranslation, Trans } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { hasSession } from "@/lib/guestProfile";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen, Gamepad2, Bot, Layers, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { LandingLayout } from "../components/landing/LandingLayout";
import { DinoCharacter } from "../components/characters/DinoCharacter";
import { DinaCharacter } from "../components/characters/DinaCharacter";
import DrRhoCharacter from "../components/characters/DrRhoCharacter";
import ZaraVexCharacter from "../components/characters/ZaraVexCharacter";
import { GamifiedLearningSection } from "../components/landing/GamifiedLearningSection";
import { LandingParentCTA } from "../components/landing/LandingParentCTA";
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
  const [dinaExpr, setDinaExpr] = useState<'neutral' | 'wink'>('neutral');

  useEffect(() => {
    const wordInterval = setInterval(() => setCtaWordIndex(p => (p + 1) % ctaWords.length), 4000);
    return () => clearInterval(wordInterval);
  }, [ctaWords.length]);

  useEffect(() => {
    const interval = setInterval(() => setDinaExpr(p => p === 'neutral' ? 'wink' : 'neutral'), 4000);
    return () => clearInterval(interval);
  }, []);

  const problemCards = [
    { emoji: '📉', bg: 'bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50', border: 'border-red-100 dark:border-red-900/40', accent: 'bg-red-500', title: t('problem.card1_title'), text: t('problem.card1_text') },
    { emoji: '😟', bg: 'bg-orange-50 dark:bg-orange-950/30 hover:bg-orange-100 dark:hover:bg-orange-950/50', border: 'border-orange-100 dark:border-orange-900/40', accent: 'bg-orange-500', title: t('problem.card2_title'), text: t('problem.card2_text') },
    { emoji: '💤', bg: 'bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/60', border: 'border-slate-100 dark:border-slate-700/60', accent: 'bg-slate-400', title: t('problem.card3_title'), text: t('problem.card3_text') },
    { emoji: '💸', bg: 'bg-violet-50 dark:bg-violet-950/30 hover:bg-violet-100 dark:hover:bg-violet-950/50', border: 'border-violet-100 dark:border-violet-900/40', accent: 'bg-violet-500', title: t('problem.card4_title'), text: t('problem.card4_text') },
  ];

  const featureCards = [
    { icon: BookOpen, emoji: '📖', color: 'from-blue-400 to-cyan-500', shadow: 'shadow-blue-200 dark:shadow-blue-900/40', title: t('features.interactive_lessons.title'), desc: t('features.interactive_lessons.description'), badge: null },
    { icon: Gamepad2, emoji: '🎮', color: 'from-violet-400 to-purple-600', shadow: 'shadow-violet-200 dark:shadow-violet-900/40', title: t('features.video_games.title'), desc: t('features.video_games.description'), badge: null },
    { icon: Bot, emoji: '🤖', color: 'from-pink-400 to-rose-500', shadow: 'shadow-pink-200 dark:shadow-pink-900/40', title: t('features.ai_functionality.title'), desc: t('features.ai_functionality.description'), badge: t('features.ai_functionality.badge') },
    { icon: Layers, emoji: '✨', color: 'from-emerald-400 to-teal-500', shadow: 'shadow-emerald-200 dark:shadow-emerald-900/40', title: t('features.more_stuff.title'), desc: t('features.more_stuff.description'), badge: null },
  ];

  return (
    <LandingLayout hideCTA={true}>

      {/* ══════════════════════════════════════════════════════════
          HERO — warm sunburst background, big playful type
      ══════════════════════════════════════════════════════════ */}
      <header className="relative min-h-[100svh] flex flex-col pt-20 lg:pt-28 overflow-hidden hero-sunburst dark:bg-[#16112a]">

        {/* Ambient glows */}
        <div className="absolute inset-0 pointer-events-none -z-0">
          <div className="absolute top-10 left-1/4 w-96 h-96 rounded-full bg-amber-300/20 dark:bg-amber-700/10 blur-[80px] animate-orb-1" />
          <div className="absolute bottom-10 right-1/3 w-80 h-80 rounded-full bg-pink-300/20 dark:bg-pink-700/10 blur-[80px] animate-orb-2" />
          <div className="absolute top-1/2 right-10 w-64 h-64 rounded-full bg-violet-300/15 dark:bg-violet-700/10 blur-[60px] animate-orb-3" />
        </div>

        {/* Floating deco elements */}
        <FloatingDeco className="top-28 left-[8%] opacity-60" style={{ animationDelay: '0s' } as any}>🪙</FloatingDeco>
        <FloatingDeco className="top-48 right-[12%] opacity-40" style={{ animationDelay: '1.2s' } as any}>⭐</FloatingDeco>
        <FloatingDeco className="bottom-40 left-[15%] opacity-50" style={{ animationDelay: '0.7s' } as any}>💡</FloatingDeco>
        <FloatingDeco className="bottom-32 right-[8%] opacity-50" style={{ animationDelay: '2s' } as any}>🚀</FloatingDeco>
        <FloatingDeco className="top-36 left-[40%] opacity-30" style={{ animationDelay: '1.8s' } as any}>✨</FloatingDeco>

        {/* Main hero grid */}
        <div className="relative z-10 flex-1 flex w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 items-center pb-6 lg:pb-10">
          <div className="flex flex-col lg:flex-row items-center gap-4 lg:gap-12 w-full">

            {/* Characters visual block */}
            <div className="w-full relative h-[280px] lg:h-[560px] flex-shrink-0 lg:w-[520px] overflow-visible">

              {/* Decorative blob behind characters */}
              <div
                className="absolute inset-0 bg-gradient-to-tr from-orange-200/60 via-pink-200/50 to-violet-200/40 dark:from-violet-900/40 dark:via-pink-900/30 dark:to-blue-900/30 scale-105"
                style={{ borderRadius: '63% 37% 54% 46% / 55% 48% 52% 45%' }}
              />

              {/* Blurs behind each character */}
              <div className="absolute bottom-0 z-0 animate-float left-1/2 -ml-[150px] w-[300px] h-[300px] lg:left-auto lg:ml-0 lg:-right-16 lg:w-[640px] lg:h-[640px]" style={{ animationDelay: '1.5s' }}>
                <div className="absolute inset-8 lg:inset-20 rounded-full bg-pink-400/20 blur-[50px] lg:blur-[80px]" />
              </div>
              <div className="absolute bottom-0 z-0 animate-float left-0 w-[200px] h-[200px] lg:left-auto lg:right-[13rem] lg:w-[400px] lg:h-[400px]" style={{ animationDelay: '0s' }}>
                <div className="absolute inset-8 lg:inset-16 rounded-full bg-emerald-400/25 blur-[40px] lg:blur-[60px]" />
              </div>

              {/* Characters */}
              <div className="absolute bottom-0 z-10 opacity-90 animate-float left-1/2 -ml-[150px] w-[300px] h-[300px] lg:left-auto lg:ml-0 lg:-right-16 lg:w-[640px] lg:h-[640px]" style={{ animationDelay: '1.5s' }}>
                <DinaCharacter expression={dinaExpr} className="drop-shadow-2xl" />
              </div>
              <div className="absolute bottom-0 z-20 animate-float left-0 w-[200px] h-[200px] lg:left-auto lg:right-[14rem] lg:w-[380px] lg:h-[380px]" style={{ animationDelay: '0s' }}>
                <DinoCharacter mood="happy" className="drop-shadow-2xl" />
              </div>
              <div className="absolute bottom-0 z-10 animate-float right-[80px] w-[130px] h-[130px] lg:right-16 lg:bottom-8 lg:w-[270px] lg:h-[270px]" style={{ animationDelay: '2s' }}>
                <DrRhoCharacter mood="wise" className="drop-shadow-2xl" />
              </div>
              <div className="absolute bottom-0 z-[15] animate-float right-[28px] w-[145px] h-[145px] lg:bottom-10 lg:right-[-3rem] lg:w-[320px] lg:h-[320px]" style={{ animationDelay: '2.5s' }}>
                <ZaraVexCharacter mood="happy" className="drop-shadow-2xl" />
              </div>
            </div>

            {/* Copy block */}
            <div className="relative z-30 flex-1 text-center lg:text-left space-y-5 max-w-xl">

              {/* Live badge */}
              <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-white/80 dark:bg-white/10 backdrop-blur-sm border border-amber-200 dark:border-amber-700/50 shadow-lg animate-fade-in-up">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                </span>
                <span className="text-sm font-bold text-amber-800 dark:text-amber-300">{t('hero.badge')}</span>
              </div>

              {/* Headline */}
              <h1 className="landing-heading text-4xl md:text-5xl lg:text-6xl font-black leading-[1.1] tracking-tight animate-fade-in-up-delay-1 text-gray-900 dark:text-white">
                {t('hero.title_part1')}{' '}
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

              <p className="text-lg lg:text-xl text-gray-600 dark:text-gray-300 leading-relaxed animate-fade-in-up-delay-2">
                <Trans i18nKey="hero.subtitle" ns="landing" />
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start pt-2 animate-fade-in-up-delay-3">
                <Button asChild size="lg" className="btn-press h-14 px-10 text-lg rounded-2xl bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-400 hover:to-pink-400 text-white font-black w-full sm:w-auto border-0 shadow-none">
                  <Link to="/onboarding" className="flex items-center gap-2">
                    {t('hero.cta_button')}
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="lg" className="h-14 px-8 text-lg rounded-2xl border-2 border-gray-300 dark:border-slate-700 bg-white/60 dark:bg-white/5 backdrop-blur-sm hover:bg-white dark:hover:bg-white/10 font-bold text-gray-700 dark:text-gray-200 w-full sm:w-auto transition-all">
                  <Link to="/login">{t('hero.login_link')}</Link>
                </Button>
              </div>

              {/* Trust pills */}
              <div className="flex flex-wrap gap-2 justify-center lg:justify-start animate-fade-in-up-delay-4">
                {[
                  { emoji: '🆓', label: t('hero.trust_free') },
                  { emoji: '🔒', label: t('hero.trust_secure') },
                  { emoji: '🌍', label: t('hero.trust_multilang') },
                ].map((pill) => (
                  <span key={pill.label} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white/70 dark:bg-white/10 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-700 backdrop-blur-sm">
                    {pill.emoji} {pill.label}
                  </span>
                ))}
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
        <div className="relative z-10 w-full py-4 border-t border-amber-200/50 dark:border-slate-700/50 bg-white/40 dark:bg-black/20 backdrop-blur-xl mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
            <h3 className="text-[10px] sm:text-xs font-bold text-gray-500 dark:text-gray-500 mb-2 sm:mb-3 uppercase tracking-[0.2em]">
              {t('language.title')}
            </h3>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => saveLanguagePreference(lang.code as SupportedLanguage)}
                  className={`flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-300 border ${
                    isCurrentLanguage(lang.code)
                      ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white border-orange-300 dark:border-orange-600/50 shadow-md shadow-orange-200/50 scale-105'
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
          <div className="space-y-5">
            <div className="inline-block px-4 py-1.5 rounded-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-widest mb-2">
              🚨 {t('problem.badge')}
            </div>
            <h2 className="landing-heading text-3xl md:text-5xl font-black text-gray-900 dark:text-white leading-tight">
              {t('problem.title_part1')}{' '}
              <span className="relative inline-block text-gray-400 line-through decoration-red-500 decoration-4">
                {t('problem.title_part2')}
              </span>
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed">
              <Trans i18nKey="problem.subtitle" ns="landing" />
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 text-left">
            {problemCards.map((card, i) => (
              <div key={i} className={`group relative p-6 rounded-2xl border ${card.bg} ${card.border} hover:scale-[1.03] transition-all duration-300 hover:shadow-xl overflow-hidden`}>
                {/* Top accent bar */}
                <div className={`absolute top-0 left-0 right-0 h-1 ${card.accent} rounded-t-2xl`} />
                <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-4 text-3xl group-hover:scale-110 transition-transform">
                  {card.emoji}
                </div>
                <h3 className="landing-heading font-black text-lg text-gray-900 dark:text-white mb-2">{card.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{card.text}</p>
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
          FEATURES — warm amber background, playful cards
      ══════════════════════════════════════════════════════════ */}
      <section id="features" className="relative py-24 bg-amber-50 dark:bg-slate-900 overflow-hidden">

        {/* Decorative stars */}
        <div className="absolute top-8 right-16 text-3xl opacity-20 animate-slow-spin pointer-events-none">⭐</div>
        <div className="absolute bottom-12 left-12 text-2xl opacity-20 animate-float pointer-events-none" style={{ animationDelay: '1s' }}>✨</div>
        <div className="absolute top-1/2 right-8 text-2xl opacity-10 animate-float pointer-events-none" style={{ animationDelay: '2s' }}>🌟</div>

        {/* Wave top ← from GamifiedLearning dark bg */}
        <div className="absolute top-0 left-0 w-full overflow-hidden leading-none" style={{ height: 60 }}>
          <svg viewBox="0 0 1440 60" preserveAspectRatio="none" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <path d="M0,30 C360,0 720,60 1080,20 C1260,5 1380,45 1440,30 L1440,0 L0,0 Z" fill="currentColor" className="text-slate-50 dark:text-[#0a1628]" />
          </svg>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-block px-4 py-1.5 rounded-full bg-orange-100 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800/40 text-xs font-bold text-orange-700 dark:text-orange-300 uppercase tracking-widest mb-4">
              🎯 {t('features.badge')}
            </div>
            <h2 className="landing-heading text-4xl md:text-5xl font-black text-gray-900 dark:text-white mb-4 leading-tight">
              {t('features.title')}
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300">{t('features.subtitle')}</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {featureCards.map((card, i) => (
              <div key={i} className={`card-tilt relative bg-white dark:bg-slate-800 rounded-3xl p-6 border border-gray-100 dark:border-slate-700 shadow-lg ${card.shadow} hover:shadow-2xl`}>
                {card.badge && (
                  <div className="absolute top-4 right-4 bg-pink-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                    {card.badge}
                  </div>
                )}
                {/* Gradient icon circle */}
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${card.color} flex items-center justify-center mb-5 text-2xl shadow-lg`}>
                  {card.emoji}
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

      {/* ══════════════════════════════════════════════════════════
          PARENT CTA
      ══════════════════════════════════════════════════════════ */}
      <LandingParentCTA />

    </LandingLayout>
  );
};

export default LandingPage;
