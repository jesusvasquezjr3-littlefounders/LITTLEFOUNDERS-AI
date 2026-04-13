import { useState, useEffect } from "react";
import { useTranslation, Trans } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { hasSession } from "@/lib/guestProfile";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  BookOpen,
  Menu,
  X,
  Gamepad2,
  Bot,
  Layers
} from "lucide-react";
import { Link } from "react-router-dom";
import { LandingLayout } from "../components/landing/LandingLayout";

import { DinoCharacter } from "../components/characters/DinoCharacter";
import { DinaCharacter } from "../components/characters/DinaCharacter";
import DrRhoCharacter from "../components/characters/DrRhoCharacter";
import ZaraVexCharacter from "../components/characters/ZaraVexCharacter";
import { GamifiedLearningSection } from "../components/landing/GamifiedLearningSection";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useLanguage } from "@/hooks/useLanguage";
import { useUserLanguage } from "@/hooks/useUserLanguage";
import { SupportedLanguage } from "@/i18n";
import { LanguageSelector } from "@/components/ui/LanguageSelector";

const LandingPage = () => {
  const { t } = useTranslation('landing');
  const { languages, isCurrentLanguage } = useLanguage();
  const { saveLanguagePreference } = useUserLanguage();
  const navigate = useNavigate();

  // Redirect to dashboard if user already has a session
  useEffect(() => {
    if (hasSession()) navigate('/learn');
  }, [navigate]);

  const [ctaWordIndex, setCtaWordIndex] = useState(0);
  const ctaWords = t('cta.rotating_words', { returnObjects: true }) as string[];

  const [dinaExpr, setDinaExpr] = useState<'neutral' | 'wink'>('neutral');

  useEffect(() => {
    const wordInterval = setInterval(() => {
      setCtaWordIndex((prev) => (prev + 1) % ctaWords.length);
    }, 4000); 

    return () => {
      clearInterval(wordInterval);
    };
  }, [ctaWords.length]);

  useEffect(() => {
    const interval = setInterval(() => {
      setDinaExpr((prev) => (prev === 'neutral' ? 'wink' : 'neutral'));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Benefits list for solution section
  const benefits = [
    t('solution.benefit1'),
    t('solution.benefit2'),
    t('solution.benefit3')
  ];

  return (
    <LandingLayout>
      {/* --- HERO SECTION --- */}
      <header className="relative min-h-[100svh] flex flex-col pt-20 lg:pt-32 overflow-hidden bg-gradient-to-b from-blue-50/50 to-white dark:from-slate-950 dark:to-slate-900 transition-colors duration-500">

        {/* Abstract Background Shapes */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
          <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-purple-200/20 dark:bg-purple-900/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-pink-200/20 dark:bg-pink-900/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="flex-1 flex w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative items-center pb-8 lg:pb-12">
          <div className="flex flex-col lg:flex-row items-center gap-3 lg:gap-8 w-full">

            {/* ==========================================
                VISUAL BLOCK — first in HTML = top on mobile
                overflow-visible so animate-float transforms aren't clipped
                ========================================== */}
            <div className="w-full relative h-[290px] lg:h-[600px] overflow-visible">
              {/* Decorative Circle Background */}
              <div className="absolute inset-0 bg-gradient-to-tr from-pink-100 to-purple-100 dark:from-slate-800 dark:to-purple-900/30 opacity-40 dark:opacity-25 transition-colors lg:scale-125 lg:translate-x-20" style={{ borderRadius: '40% 60% 70% 30% / 40% 50% 60% 50%' }}></div>

              {/* Dina - large centered backdrop. Desktop: back-right */}
              <div className="absolute bottom-0 z-0 opacity-90 animate-float left-1/2 -ml-[160px] w-[320px] h-[320px] lg:left-auto lg:ml-0 lg:-right-24 lg:w-[700px] lg:h-[700px]" style={{ animationDelay: '1.5s' }}>
                <DinaCharacter expression={dinaExpr} className="drop-shadow-2xl" />
              </div>

              {/* Liruf - overlaps Dina from left */}
              <div className="absolute bottom-0 z-20 animate-float left-0 w-[210px] h-[210px] lg:left-auto lg:right-[15rem] lg:w-[420px] lg:h-[420px]" style={{ animationDelay: '0s' }}>
                <DinoCharacter mood="happy" className="drop-shadow-2xl" />
              </div>

              {/* Dr. Rho - closer to Dina, overlapping her right side */}
              <div className="absolute bottom-0 z-10 animate-float right-[90px] w-[145px] h-[145px] lg:right-20 lg:bottom-10 lg:w-[300px] lg:h-[300px]" style={{ animationDelay: '2s' }}>
                <DrRhoCharacter mood="wise" className="drop-shadow-2xl" />
              </div>

              {/* Zara - beside Rho, framing the right */}
              <div className="absolute bottom-0 z-[15] animate-float right-[35px] w-[160px] h-[160px] lg:bottom-12 lg:right-[-5rem] lg:w-[350px] lg:h-[350px]" style={{ animationDelay: '2.5s' }}>
                <ZaraVexCharacter mood="happy" className="drop-shadow-2xl" />
              </div>
            </div>

            {/* ==========================================
                COPY BLOCK — comes second in HTML, renders
                below Visual on mobile naturally.
                ========================================== */}
            <div className="flex-1 text-center lg:text-left space-y-5 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300 text-sm font-bold animate-fade-in-up">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-pink-500"></span>
                </span>
                {t('hero.badge')}
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 dark:text-white leading-[1.15] tracking-tight transition-colors max-w-4xl">
                {t('hero.title_part1')}{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-600">
                  {t('hero.title_highlight')}
                </span>{' '}
                <span className="text-slate-800 dark:text-slate-100">
                  {t('hero.title_part2')}
                </span>
              </h1>

              <p className="text-xl lg:text-2xl text-gray-600 dark:text-gray-300 leading-relaxed transition-colors">
                <Trans i18nKey="hero.subtitle" ns="landing" />
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-5 justify-center lg:justify-start pt-4">
                {/* Main Adventure Button */}
                <Button asChild size="lg" className="h-16 px-10 text-lg rounded-full border border-slate-900/10 dark:border-white/40 bg-white/30 dark:bg-white/10 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(31,38,135,0.08)] hover:bg-white/40 hover:scale-105 transition-all duration-300 group overflow-hidden border-t-white/60">
                  <Link to="/onboarding">
                    <span className="relative z-10 flex items-center font-bold text-gray-900 dark:text-white">
                      {t('hero.cta_button')}
                      <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-tr from-pink-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </Link>
                </Button>

                {/* Secondary Login Button */}
                <Button asChild variant="ghost" size="lg" className="h-16 px-10 text-lg rounded-full border border-gray-200/60 dark:border-white/10 bg-white/40 dark:bg-slate-900/20 backdrop-blur-md shadow-[0_4px_20px_0_rgba(0,0,0,0.04)] hover:bg-gray-100/50 dark:hover:bg-white/10 hover:scale-105 transition-all duration-300">
                  <Link to="/login" className="font-bold text-gray-700 dark:text-gray-200">
                    {t('hero.login_link')}
                  </Link>
                </Button>
              </div>
            </div>

          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="w-full flex justify-center pb-4 animate-bounce text-gray-400 hidden lg:flex">
          <ChevronDown className="w-6 h-6 opacity-50" />
        </div>

        {/* --- LANGUAGE SWITCHER BAR --- */}
        <div className="w-full py-4 lg:py-5 border-t border-gray-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-black/20 backdrop-blur-xl z-20 relative overflow-hidden mt-auto">
          {/* Ambient glows behind the languages */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl h-full bg-pink-500/10 dark:bg-pink-500/5 blur-3xl pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col items-center">
            <h3 className="text-[10px] sm:text-xs font-bold text-gray-500 dark:text-gray-500 mb-2 sm:mb-3 uppercase tracking-[0.2em] text-center">
              {t('language.title')}
            </h3>
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => saveLanguagePreference(lang.code as SupportedLanguage)}
                  className={`flex items-center gap-2 px-5 sm:px-6 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-300 border ${
                    isCurrentLanguage(lang.code) 
                      ? "bg-white dark:bg-white/10 text-gray-900 dark:text-white border-pink-200 dark:border-pink-500/50 shadow-lg shadow-pink-500/10 scale-105" 
                      : "bg-transparent text-gray-600 dark:text-gray-400 border-gray-200 dark:border-slate-800 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-slate-700"
                  }`}
                >
                  <span className="text-lg sm:text-xl leading-none drop-shadow-md">{lang.flag}</span>
                  {lang.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* --- SCAR TISSUE / PROBLEM SECTION --- */}
      <section id="problem" className="py-24 bg-white dark:bg-slate-950 transition-colors duration-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-16">

          <div className="space-y-6">
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 dark:text-white transition-colors">
              {t('problem.title_part1')} <br />
              <span className="text-gray-400 dark:text-gray-500 decoration-gray-300 dark:decoration-gray-600 line-through decoration-4">{t('problem.title_part2')}</span>
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed transition-colors">
              <Trans i18nKey="problem.subtitle" ns="landing" />
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 text-left">
            <div className="p-6 bg-red-50 dark:bg-red-950/20 rounded-2xl border border-red-100 dark:border-red-900/30 transition-colors hover:shadow-lg dark:hover:shadow-red-900/10">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center mb-4 text-2xl">📉</div>
              <h3 className="font-bold text-lg text-gray-900 dark:text-red-100 mb-2">{t('problem.card1_title')}</h3>
              <p className="text-gray-600 dark:text-gray-400">{t('problem.card1_text')}</p>
            </div>
            <div className="p-6 bg-orange-50 dark:bg-orange-950/20 rounded-2xl border border-orange-100 dark:border-orange-900/30 transition-colors hover:shadow-lg dark:hover:shadow-orange-900/10">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/40 rounded-full flex items-center justify-center mb-4 text-2xl">😟</div>
              <h3 className="font-bold text-lg text-gray-900 dark:text-orange-100 mb-2">{t('problem.card2_title')}</h3>
              <p className="text-gray-600 dark:text-gray-400">{t('problem.card2_text')}</p>
            </div>
            <div className="p-6 bg-gray-50 dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 transition-colors hover:shadow-lg">
              <div className="w-12 h-12 bg-gray-200 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 text-2xl">💤</div>
              <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 mb-2">{t('problem.card3_title')}</h3>
              <p className="text-gray-600 dark:text-gray-400">{t('problem.card3_text')}</p>
            </div>
            <div className="p-6 bg-purple-50 dark:bg-purple-950/20 rounded-2xl border border-purple-100 dark:border-purple-900/30 transition-colors hover:shadow-lg dark:hover:shadow-purple-900/10">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/40 rounded-full flex items-center justify-center mb-4 text-2xl">💸</div>
              <h3 className="font-bold text-lg text-gray-900 dark:text-purple-100 mb-2">{t('problem.card4_title')}</h3>
              <p className="text-gray-600 dark:text-gray-400">{t('problem.card4_text')}</p>
            </div>
          </div>

        </div>
      </section>


      {/* --- TRANSFORMATION / SOLUTION (Remotion Animation) --- */}
      <GamifiedLearningSection />


      {/* --- FEATURE SHOWCASE --- */}
      <section id="features" className="py-24 bg-gray-50 dark:bg-slate-900 transition-colors duration-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4 transition-colors">{t('features.title')}</h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 transition-colors">{t('features.subtitle')}</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Interactive Lessons */}
            <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-lg border border-gray-100 dark:border-slate-700 transition-all hover:-translate-y-1 hover:shadow-xl group">
              <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mb-6 text-blue-600 dark:text-blue-300 group-hover:scale-110 transition-transform">
                <BookOpen className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-xl mb-3 text-gray-900 dark:text-white">{t('features.interactive_lessons.title')}</h3>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                {t('features.interactive_lessons.description')}
              </p>
            </div>

            {/* Video Games */}
            <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-lg border border-gray-100 dark:border-slate-700 transition-all hover:-translate-y-1 hover:shadow-xl group">
              <div className="w-14 h-14 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center mb-6 text-purple-600 dark:text-purple-300 group-hover:scale-110 transition-transform">
                <Gamepad2 className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-xl mb-3 text-gray-900 dark:text-white">{t('features.video_games.title')}</h3>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                {t('features.video_games.description')}
              </p>
            </div>

            {/* AI Functionality */}
            <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-lg border border-gray-100 dark:border-slate-700 transition-all hover:-translate-y-1 hover:shadow-xl group relative overflow-hidden">
              <div className="absolute top-4 right-4 bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                {t('features.ai_functionality.badge')}
              </div>
              <div className="w-14 h-14 bg-pink-100 dark:bg-pink-900/30 rounded-2xl flex items-center justify-center mb-6 text-pink-600 dark:text-pink-300 group-hover:scale-110 transition-transform">
                <Bot className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-xl mb-3 text-gray-900 dark:text-white">{t('features.ai_functionality.title')}</h3>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                {t('features.ai_functionality.description')}
              </p>
            </div>

            {/* More Stuff */}
            <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-lg border border-gray-100 dark:border-slate-700 transition-all hover:-translate-y-1 hover:shadow-xl group">
              <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mb-6 text-green-600 dark:text-green-300 group-hover:scale-110 transition-transform">
                <Layers className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-xl mb-3 text-gray-900 dark:text-white">{t('features.more_stuff.title')}</h3>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                {t('features.more_stuff.description')}
              </p>
            </div>

          </div>
        </div>
      </section>





    </LandingLayout>
  );
};

export default LandingPage;
