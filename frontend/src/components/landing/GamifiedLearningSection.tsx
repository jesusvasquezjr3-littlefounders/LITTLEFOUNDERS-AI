import React from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2 } from "lucide-react";

export function GamifiedLearningSection() {
  const { t } = useTranslation("landing");

  const benefits = [
    t("solution.benefit1"),
    t("solution.benefit2"),
    t("solution.benefit3"),
  ];
  return (
    <section className="relative py-20 md:py-28 overflow-hidden transition-colors duration-500 text-amber-950 dark:text-white bg-amber-50/50 dark:bg-[#0d0a0a] dark:via-[#0d0905] dark:to-[#0a0e0a]">

      {/* ── Dot-grid texture overlay ── */}
      <div className="absolute inset-0 pointer-events-none opacity-20 dark:opacity-[0.04]"
        style={{
          backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* ── Radial burst from center-right ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Amber glow — brand knowledge/coin color */}
        <div className="absolute top-1/2 right-0 -translate-y-1/2 w-[700px] h-[700px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(246,168,33,0.10) 0%, rgba(245,158,11,0.05) 50%, transparent 75%)' }} />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(26,158,122,0.07) 0%, transparent 70%)' }} />
        <div className="absolute top-0 left-1/3 w-[400px] h-[400px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%)' }} />
      </div>

      {/* ── Wave top — Connects to Problem section ── */}
      <div className="absolute top-0 left-0 w-full overflow-hidden leading-none pointer-events-none" style={{ height: 64 }}>
        <svg viewBox="0 0 1440 64" preserveAspectRatio="none" className="w-full h-full">
          <path d="M0,20 C360,60 720,5 1080,45 C1260,62 1380,22 1440,36 L1440,0 L0,0 Z"
            fill="currentColor" className="text-white dark:text-[#080610]" />
        </svg>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center gap-10 md:gap-16">

          {/* ── Copy ── */}
          <div className="flex-1 space-y-6 text-center md:text-left order-1">

            {/* Badge */}

            {/* Heading */}
            <h2 className="landing-heading text-3xl sm:text-4xl lg:text-5xl font-black leading-tight tracking-tight">
              {t("solution.title_part1")}
              <br />
              {t("solution.title_part2")}{" "}
              <span className="relative inline-block">
                {/* Solid brand color — no gradient text (Impeccable [gradient-text] rule) */}
                <span className="relative z-10 text-[#1a9e7a] dark:text-[#34d399]">
                  {t("solution.title_highlight")}
                </span>
                {/* Amber underline SVG — brand, not indigo */}
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 12" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
                  <path d="M2 8 C40 2, 80 12, 120 6 C160 0, 185 10, 198 6" stroke="url(#squiggle-grad-lf)" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
                  <defs>
                    <linearGradient id="squiggle-grad-lf" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#f6a821"/>
                      <stop offset="100%" stopColor="#1a9e7a"/>
                    </linearGradient>
                  </defs>
                </svg>
              </span>
              .
            </h2>

            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 leading-relaxed max-w-xl mx-auto md:mx-0">
              {t("solution.subtitle")}
            </p>

            {/* Benefits */}
            <ul className="space-y-3 text-left max-w-xl mx-auto md:mx-0">
              {benefits.map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm sm:text-base">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-lg shadow-emerald-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-gray-700 dark:text-gray-300">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Video embed (Loop, muted) ── */}
          <div className="flex-1 w-full order-2 relative flex items-center justify-center min-h-[300px] sm:min-h-[380px] lg:min-h-[480px]">
            {/* Amber/jade halo — brand, not indigo */}
            <div className="absolute inset-0 rounded-3xl blur-3xl opacity-25 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at center, #f6a821 0%, #1a9e7a 55%, transparent 75%)' }} />

            {/* Blurs behind the video */}
            <div className="absolute bottom-0 z-0 animate-float left-1/2 -ml-[120px] w-[240px] h-[240px] lg:left-auto lg:ml-0 lg:-right-6 lg:w-[480px] lg:h-[480px]" style={{ animationDelay: '1.5s' }}>
              {/* Amber glow orb */}
              <div className="absolute inset-6 lg:inset-16 rounded-full bg-amber-400/18 blur-[40px] lg:blur-[70px]" />
            </div>
            <div className="absolute bottom-0 z-0 animate-float left-0 w-[160px] h-[160px] lg:left-auto lg:right-[8rem] lg:w-[320px] lg:h-[320px]" style={{ animationDelay: '0s' }}>
              <div className="absolute inset-6 lg:inset-12 rounded-full bg-emerald-400/25 blur-[30px] lg:blur-[50px]" />
            </div>

            {/* Morphing Blob Video Frame — amber/jade brand colors */}
            <div className="relative w-[340px] h-[235px] sm:w-[460px] sm:h-[315px] lg:w-[620px] lg:h-[420px] flex-shrink-0 morphing-blob-video-frame bg-gradient-to-tr from-[#f6a821]/50 via-white/20 to-[#1a9e7a]/50 dark:from-[#f6a821]/35 dark:via-white/5 dark:to-[#1a9e7a]/35 p-[6px] backdrop-blur-md shadow-[0_25px_60px_-15px_rgba(246,168,33,0.35)] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] border border-white/40 dark:border-white/15 overflow-hidden z-10" style={{ animationDelay: '0.5s' }}>
              <div className="w-full h-full overflow-hidden bg-white/70 dark:bg-slate-900/70 relative" style={{ borderRadius: 'inherit' }}>
                <video
                  src="/video/8747232-sd_960_540_25fps.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-500"
                />
                {/* Glossy liquid glass reflections */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/30 to-transparent pointer-events-none mix-blend-overlay" />
                <div className="absolute -inset-full bg-gradient-to-b from-white/10 via-transparent to-transparent rotate-45 pointer-events-none" />
              </div>
            </div>

            {/* Magical Sparkles/Glitter around the liquid glass video */}
            <svg className="absolute -top-4 left-6 sm:-top-6 sm:left-12 lg:-top-10 lg:left-16 z-20 w-8 h-8 text-yellow-300 pointer-events-none animate-sparkle-1" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C12 0 12.5 8.5 15 11C17.5 13.5 24 12 24 12C24 12 17.5 12.5 15 15C12.5 17.5 12 24 12 24C12 24 11.5 17.5 9 15C6.5 12.5 0 12 0 12C0 12 6.5 11.5 9 11C11.5 8.5 12 0 12 0Z" />
            </svg>
            <svg className="absolute top-6 -right-2 sm:top-10 sm:-right-4 lg:top-14 lg:-right-6 z-20 w-10 h-10 text-amber-300 pointer-events-none animate-sparkle-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C12 0 12.5 8.5 15 11C17.5 13.5 24 12 24 12C24 12 17.5 12.5 15 15C12.5 17.5 12 24 12 24C12 24 11.5 17.5 9 15C6.5 12.5 0 12 0 12C0 12 6.5 11.5 9 11C11.5 8.5 12 0 12 0Z" />
            </svg>
            <svg className="absolute top-1/2 -left-6 sm:-left-8 lg:-left-10 z-20 w-7 h-7 text-yellow-200 pointer-events-none animate-sparkle-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C12 0 12.5 8.5 15 11C17.5 13.5 24 12 24 12C24 12 17.5 12.5 15 15C12.5 17.5 12 24 12 24C12 24 11.5 17.5 9 15C6.5 12.5 0 12 0 12C0 12 6.5 11.5 9 11C11.5 8.5 12 0 12 0Z" />
            </svg>
            <svg className="absolute bottom-4 -right-2 sm:bottom-6 sm:-right-4 lg:bottom-10 lg:-right-6 z-20 w-6 h-6 text-indigo-300 pointer-events-none animate-sparkle-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C12 0 12.5 8.5 15 11C17.5 13.5 24 12 24 12C24 12 17.5 12.5 15 15C12.5 17.5 12 24 12 24C12 24 11.5 17.5 9 15C6.5 12.5 0 12 0 12C0 12 6.5 11.5 9 11C11.5 8.5 12 0 12 0Z" />
            </svg>
            <svg className="absolute -bottom-4 left-10 sm:-bottom-6 sm:left-16 lg:-bottom-8 lg:left-24 z-20 w-8 h-8 text-amber-200 pointer-events-none animate-sparkle-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C12 0 12.5 8.5 15 11C17.5 13.5 24 12 24 12C24 12 17.5 12.5 15 15C12.5 17.5 12 24 12 24C12 24 11.5 17.5 9 15C6.5 12.5 0 12 0 12C0 12 6.5 11.5 9 11C11.5 8.5 12 0 12 0Z" />
            </svg>
          </div>

        </div>
      </div>

      {/* ── Wave bottom ── */}
      <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none pointer-events-none" style={{ height: 64 }}>
        <svg viewBox="0 0 1440 64" preserveAspectRatio="none" className="w-full h-full">
          <path d="M0,30 C480,64 960,10 1440,45 L1440,64 L0,64 Z" fill="#eff6ff" className="dark:hidden" />
          <path d="M0,30 C480,64 960,10 1440,45 L1440,64 L0,64 Z" className="hidden dark:block" style={{ fill: '#0f172a' }} />
        </svg>
      </div>
    </section>
  );
}

export default GamifiedLearningSection;
