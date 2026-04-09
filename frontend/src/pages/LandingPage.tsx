import { useState, useEffect } from "react";
import { useTranslation, Trans } from "react-i18next";
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

import { DinoCharacter } from "../components/demo/DinoCharacter";
import { DinaCharacter } from "../components/demo/DinaCharacter";
import DrRhoCharacter from "../components/demo/DrRhoCharacter";
import ZaraVexCharacter from "../components/demo/ZaraVexCharacter";
import { GamifiedLearningSection } from "../components/landing/GamifiedLearningSection";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useLanguage } from "@/hooks/useLanguage";
import { useUserLanguage } from "@/hooks/useUserLanguage";
import { SupportedLanguage } from "@/i18n";

const LandingPage = () => {
  const { t } = useTranslation('landing');
  const { languages, isCurrentLanguage } = useLanguage();
  const { saveLanguagePreference } = useUserLanguage();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const [wordIndex, setWordIndex] = useState(0);
  const rotatorWords = t('hero.rotating_words', { returnObjects: true }) as string[];

  const [topicIndex, setTopicIndex] = useState(0);
  const rotatorTopics = t('hero.rotating_topics', { returnObjects: true }) as string[];

  const [ctaWordIndex, setCtaWordIndex] = useState(0);
  const ctaWords = t('cta.rotating_words', { returnObjects: true }) as string[];

  const [dinaExpr, setDinaExpr] = useState<'neutral' | 'wink'>('neutral');

  useEffect(() => {
    const wordInterval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % rotatorWords.length);
      setCtaWordIndex((prev) => (prev + 1) % ctaWords.length);
    }, 4000); // 4 seconds for audiencies (Kids, Teens, Adults)

    const topicInterval = setInterval(() => {
      setTopicIndex((prev) => (prev + 1) % rotatorTopics.length);
    }, 2800); // 2.8 seconds for topics (Startup, Finance, etc)

    return () => {
      clearInterval(wordInterval);
      clearInterval(topicInterval);
    };
  }, [rotatorWords.length, ctaWords.length, rotatorTopics.length]);

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
    <div className="min-h-screen bg-white dark:bg-slate-950 font-sans selection:bg-pink-100 selection:text-pink-900 dark:selection:bg-pink-900 dark:selection:text-pink-100 transition-colors duration-300">

      {/* --- NAVIGATION --- */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${isScrolled || mobileMenuOpen
        ? 'liquid-glass-subtle py-3'
        : 'bg-transparent py-5'
        }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            {/* Logo */}
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <img src="/logo-sized.png" alt="LittleFounders" className="h-10 w-auto object-contain dark:brightness-110" />
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#problem" className="text-gray-600 dark:text-gray-300 hover:text-pink-600 dark:hover:text-pink-400 font-medium transition-colors">{t('nav.why')}</a>
              <a href="#features" className="text-gray-600 dark:text-gray-300 hover:text-pink-600 dark:hover:text-pink-400 font-medium transition-colors">{t('nav.lessons')}</a>
              <a href="#faq" className="text-gray-600 dark:text-gray-300 hover:text-pink-600 dark:hover:text-pink-400 font-medium transition-colors">{t('nav.faq')}</a>

              <div className="flex items-center gap-2 border-l border-gray-200 dark:border-slate-700 pl-6 pr-6">
                <ThemeToggle />
              </div>

              <Button asChild variant="outline" className="border-pink-200 text-pink-700 hover:bg-pink-50 hover:text-pink-800 dark:border-pink-800 dark:text-pink-300 dark:hover:bg-pink-900/30 dark:hover:text-pink-200 rounded-full px-6 bg-transparent">
                <Link to="/login">{t('nav.login')}</Link>
              </Button>
              <Button asChild className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all rounded-full px-6">
                <Link to="/register">{t('nav.register')}</Link>
              </Button>
            </div>

            {/* Mobile Menu Toggle */}
            <button className="md:hidden text-gray-700 dark:text-gray-200" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 p-4 flex flex-col gap-4 shadow-xl">
            <a href="#problem" className="text-lg font-medium text-gray-700 dark:text-gray-200 py-2 border-b border-gray-50 dark:border-slate-800" onClick={() => setMobileMenuOpen(false)}>{t('nav.why')}</a>
            <a href="#features" className="text-lg font-medium text-gray-700 dark:text-gray-200 py-2 border-b border-gray-50 dark:border-slate-800" onClick={() => setMobileMenuOpen(false)}>{t('nav.lessons')}</a>
            <a href="#faq" className="text-lg font-medium text-gray-700 dark:text-gray-200 py-2 border-b border-gray-50 dark:border-slate-800" onClick={() => setMobileMenuOpen(false)}>{t('faq.title')}</a>

            <div className="flex items-center justify-center py-4 border-b border-gray-50 dark:border-slate-800">
              <ThemeToggle />
            </div>

            <div className="flex flex-col gap-3 mt-2">
              <Button asChild variant="secondary" className="w-full justify-center border-pink-100 text-pink-700 dark:bg-slate-800 dark:text-pink-300 dark:border-slate-700">
                <Link to="/login">{t('nav.login')}</Link>
              </Button>
              <Button asChild className="w-full justify-center bg-pink-600 hover:bg-pink-700 text-white">
                <Link to="/register">{t('nav.register')}</Link>
              </Button>
            </div>
          </div>
        )}
      </nav>

      {/* --- HERO SECTION --- */}
      <header className="relative pt-24 pb-20 lg:pt-36 lg:pb-32 overflow-hidden bg-gradient-to-b from-blue-50/50 to-white dark:from-slate-950 dark:to-slate-900 transition-colors duration-500">

        {/* Abstract Background Shapes */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
          <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-purple-200/20 dark:bg-purple-900/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-pink-200/20 dark:bg-pink-900/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-8">

            {/* Copy (Left) */}
            <div className="flex-1 text-center lg:text-left space-y-8 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300 text-sm font-bold animate-fade-in-up">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-pink-500"></span>
                </span>
                {t('hero.badge')}
              </div>

              <h1 className="text-5xl lg:text-7xl font-black text-gray-900 dark:text-white leading-[1.1] tracking-tight transition-colors">
                {t('hero.title_part1')}{' '}
                <span className="inline-flex overflow-hidden align-bottom">
                  <span
                    key={topicIndex}
                    className="animate-fade-in-up text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-600 block min-w-[300px] sm:min-w-[420px] lg:min-w-[580px]"
                  >
                    {rotatorTopics[topicIndex]}
                  </span>
                </span>{' '}
                {t('hero.title_part2')}{' '}
                <span className="inline-flex overflow-hidden align-bottom">
                  <span
                    key={wordIndex}
                    className="animate-fade-in-up text-pink-600 dark:text-pink-400 block min-w-[200px] sm:min-w-[280px] lg:min-w-[380px]"
                  >
                    {rotatorWords[wordIndex]}.
                  </span>
                </span>
              </h1>

              <p className="text-xl lg:text-2xl text-gray-600 dark:text-gray-300 leading-relaxed transition-colors">
                <Trans i18nKey="hero.subtitle" ns="landing" />
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start pt-4">
                <Button asChild size="lg" className="w-full sm:w-auto px-8 py-7 text-xl rounded-2xl bg-gray-900 hover:bg-gray-800 text-white dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all group">
                  <Link to="/demo">
                    {t('hero.cta_button')}
                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{t('hero.cta_subtext')}</p>
              </div>
            </div>

            {/* Visual (Right) - Characters */}
            <div className="hidden lg:flex flex-1 w-full relative h-[600px] items-center justify-end pointer-events-none">
              {/* Decorative Circle Background */}
              <div className="absolute inset-0 bg-gradient-to-tr from-pink-100 to-purple-100 dark:from-slate-800 dark:to-purple-900/30 rounded-full scale-125 translate-x-20 opacity-50 dark:opacity-30 transition-colors" style={{ borderRadius: '40% 60% 70% 30% / 40% 50% 60% 50%' }}></div>

              {/* Dina - BACK (Larger, Z-0) */}
              <div className="absolute bottom-0 -right-20 w-[650px] h-[650px] z-0 animate-float pointer-events-auto opacity-90" style={{ animationDelay: '1.5s' }}>
                <DinaCharacter expression={dinaExpr} className="drop-shadow-2xl" />
              </div>

              {/* Dr. Rho - MIDDLE (Next to Dina, Z-10) */}
              <div className="absolute bottom-32 -right-5 w-[280px] h-[280px] z-10 animate-float pointer-events-auto" style={{ animationDelay: '2s' }}>
                <DrRhoCharacter mood="wise" className="drop-shadow-2xl" />
              </div>

              {/* Zara Vex - Al otro lado de Dr. Rho */}
              <div className="absolute bottom-36 -right-20 w-[140px] h-[300px] z-15 animate-float pointer-events-auto" style={{ animationDelay: '2.5s' }}>
                <ZaraVexCharacter mood="happy" className="drop-shadow-2xl" />
              </div>

              {/* Dinosaur (Liruf) - FRONT (Smaller, Z-20) - Grounded */}
              <div className="absolute bottom-0 right-64 w-[400px] h-[400px] z-20 animate-float pointer-events-auto" style={{ animationDelay: '0s' }}>
                <DinoCharacter mood="happy" className="drop-shadow-2xl" />
              </div>

            </div>

          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 animate-bounce text-gray-400 hidden lg:block">
          <ChevronDown className="w-8 h-8 opacity-50" />
        </div>
      </header>

      {/* --- LANGUAGE SWITCHER BAR --- */}
      <section className="py-8 bg-gray-50 dark:bg-black transition-colors duration-500 border-y border-gray-200 dark:border-slate-800 z-10 relative overflow-hidden">
        {/* Ambient glows behind the languages */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl h-full bg-pink-500/10 dark:bg-pink-500/5 blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col items-center">
          <h3 className="text-xs sm:text-sm font-bold text-gray-500 dark:text-gray-500 mb-4 uppercase tracking-[0.2em] text-center">
            {t('language.title')}
          </h3>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => saveLanguagePreference(lang.code as SupportedLanguage)}
                className={`flex items-center gap-2 sm:gap-3 px-6 sm:px-8 py-2.5 sm:py-3 rounded-full text-xs sm:text-sm font-bold uppercase tracking-wider transition-all duration-300 border ${
                  isCurrentLanguage(lang.code) 
                    ? "bg-white dark:bg-white/10 text-gray-900 dark:text-white border-pink-200 dark:border-pink-500/50 shadow-lg shadow-pink-500/10 scale-105" 
                    : "bg-transparent text-gray-600 dark:text-gray-400 border-gray-200 dark:border-slate-800 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-slate-700"
                }`}
              >
                <span className="text-xl sm:text-2xl leading-none drop-shadow-md">{lang.flag}</span>
                {lang.name}
              </button>
            ))}
          </div>
        </div>
      </section>

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




      {/* --- FAQ SECTION --- */}
      <section id="faq" className="py-24 bg-pink-50/50 dark:bg-slate-950 transition-colors duration-500">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-10 text-gray-900 dark:text-white transition-colors">{t('faq.title')}</h2>

          <Accordion type="single" collapsible className="w-full space-y-4">
            <AccordionItem value="item-1" className="bg-white dark:bg-slate-900 border-none rounded-2xl shadow-sm px-4 dark:shadow-none transition-colors">
              <AccordionTrigger className="text-lg font-medium text-gray-800 dark:text-gray-200 hover:no-underline hover:text-pink-600 dark:hover:text-pink-400">{t('faq.q1')}</AccordionTrigger>
              <AccordionContent className="text-gray-600 dark:text-gray-400">
                <Trans i18nKey="faq.a1" ns="landing" />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2" className="bg-white dark:bg-slate-900 border-none rounded-2xl shadow-sm px-4 dark:shadow-none transition-colors">
              <AccordionTrigger className="text-lg font-medium text-gray-800 dark:text-gray-200 hover:no-underline hover:text-pink-600 dark:hover:text-pink-400">{t('faq.q2')}</AccordionTrigger>
              <AccordionContent className="text-gray-600 dark:text-gray-400">
                {t('faq.a2')}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" className="bg-white dark:bg-slate-900 border-none rounded-2xl shadow-sm px-4 dark:shadow-none transition-colors">
              <AccordionTrigger className="text-lg font-medium text-gray-800 dark:text-gray-200 hover:no-underline hover:text-pink-600 dark:hover:text-pink-400">{t('faq.q3')}</AccordionTrigger>
              <AccordionContent className="text-gray-600 dark:text-gray-400">
                <Trans i18nKey="faq.a3" ns="landing" />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4" className="bg-white dark:bg-slate-900 border-none rounded-2xl shadow-sm px-4 dark:shadow-none transition-colors">
              <AccordionTrigger className="text-lg font-medium text-gray-800 dark:text-gray-200 hover:no-underline hover:text-pink-600 dark:hover:text-pink-400">{t('faq.q4')}</AccordionTrigger>
              <AccordionContent className="text-gray-600 dark:text-gray-400">
                {t('faq.a4')}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>


      {/* --- CTA / FOOTER --- */}
      <section className="py-24 bg-white dark:bg-slate-950 text-center transition-colors duration-500">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white mb-8 transition-colors">
            {t('cta.title_part1')} <br />
            <span className="inline-block relative">
              <span key={ctaWordIndex} className="animate-fade-in-up inline-block text-pink-600 dark:text-pink-400">
                {ctaWords[ctaWordIndex]}.
              </span>
            </span>
          </h2>
          <p className="text-xl text-gray-500 dark:text-gray-400 mb-10 max-w-xl mx-auto transition-colors">
            {t('cta.subtitle')}
          </p>
          <Button asChild size="lg" className="px-12 py-8 text-2xl rounded-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white shadow-2xl hover:shadow-pink-500/25 transition-all transform hover:scale-105">
            <Link to="/register">
              {t('cta.button')}
            </Link>
          </Button>
          <p className="mt-6 text-sm text-gray-400 dark:text-gray-500">{t('cta.disclaimer')}</p>
        </div>
      </section>

      <footer className="bg-gray-900 dark:bg-black border-t border-gray-800 dark:border-slate-800 py-12 transition-colors duration-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-80 grayscale hover:grayscale-0 transition-all">
            <img src="/logo-sized.png" alt="LittleFounders" className="h-8 w-auto object-contain dark:invert dark:brightness-200" />
          </div>
          <div className="flex items-center gap-6">
            <div className="flex gap-6 text-sm text-gray-500 dark:text-gray-400">
              <Link to="#" className="hover:text-gray-900 dark:hover:text-gray-200">{t('footer.terms')}</Link>
              <Link to="#" className="hover:text-gray-900 dark:hover:text-gray-200">{t('footer.privacy')}</Link>
              <Link to="#" className="hover:text-gray-900 dark:hover:text-gray-200">{t('footer.contact')}</Link>
            </div>
          </div>
          <div className="text-sm text-gray-400 dark:text-gray-600">
            {t('footer.copyright')}
          </div>
        </div>
      </footer>

    </div>
  );
};

export default LandingPage;
