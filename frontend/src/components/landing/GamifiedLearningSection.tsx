import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2 } from "lucide-react";
import { NamVsYumGame } from "@/games/nam-vs-yum/components/NamVsYumGame";
import "@/games/nam-vs-yum/nam-vs-yum.css";

const MODULE_PILLS = [
  { emoji: "📚", key: "solution.animation.step1_label",  color: "from-blue-500 to-cyan-500",    bg: "bg-blue-500/10 dark:bg-blue-500/15",    border: "border-blue-300/50 dark:border-blue-500/30",    text: "text-blue-800 dark:text-blue-200" },
  { emoji: "🎮", key: "solution.animation.games_title",  color: "from-violet-500 to-purple-500", bg: "bg-violet-500/10 dark:bg-violet-500/15", border: "border-violet-300/50 dark:border-violet-500/30", text: "text-violet-800 dark:text-violet-200" },
  { emoji: "🚀", key: "solution.animation.sim_title",    color: "from-emerald-500 to-teal-500",  bg: "bg-emerald-500/10 dark:bg-emerald-500/15", border: "border-emerald-300/50 dark:border-emerald-500/30", text: "text-emerald-800 dark:text-emerald-200" },
  { emoji: "🤖", key: "solution.animation.ai_title",     color: "from-pink-500 to-rose-500",     bg: "bg-pink-500/10 dark:bg-pink-500/15",    border: "border-pink-300/50 dark:border-pink-500/30",    text: "text-pink-800 dark:text-pink-200" },
  { emoji: "🏦", key: "solution.animation.bank_title",   color: "from-amber-500 to-orange-500",  bg: "bg-amber-500/10 dark:bg-amber-500/15",  border: "border-amber-300/50 dark:border-amber-500/30",  text: "text-amber-800 dark:text-amber-200" },
];

export function GamifiedLearningSection() {
  const { t } = useTranslation("landing");
  const handleExit = useCallback(() => { /* no-op when embedded in landing */ }, []);

  const benefits = [
    t("solution.benefit1"),
    t("solution.benefit2"),
    t("solution.benefit3"),
  ];

  return (
    <section className="relative py-20 md:py-28 overflow-hidden transition-colors duration-500 text-gray-900 dark:text-white bg-gradient-to-br from-indigo-50 via-violet-50/50 to-slate-50 dark:from-[#0d0a1f] dark:via-[#130d2e] dark:to-[#0a1628]">

      {/* ── Dot-grid texture overlay ── */}
      <div className="absolute inset-0 pointer-events-none opacity-20 dark:opacity-[0.04]"
        style={{
          backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* ── Radial burst from center-right ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 right-0 -translate-y-1/2 w-[700px] h-[700px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, rgba(59,130,246,0.06) 50%, transparent 75%)' }} />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.08) 0%, transparent 70%)' }} />
        <div className="absolute top-0 left-1/3 w-[400px] h-[400px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.07) 0%, transparent 70%)' }} />
      </div>

      {/* ── Floating decorative glyphs ── */}
      <div className="absolute top-12 left-[6%] text-3xl opacity-15 animate-float pointer-events-none" style={{ animationDelay: '0.4s' }}>💡</div>
      <div className="absolute top-20 right-[8%] text-2xl opacity-10 animate-float pointer-events-none" style={{ animationDelay: '1.8s' }}>⭐</div>
      <div className="absolute bottom-16 left-[12%] text-2xl opacity-10 animate-float pointer-events-none" style={{ animationDelay: '0.9s' }}>🪙</div>

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
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-badge text-sm font-bold uppercase tracking-widest text-indigo-700 dark:text-indigo-300 border-indigo-200/40 dark:border-indigo-500/25">
              <span className="w-2 h-2 rounded-full bg-indigo-500 dark:bg-indigo-400 animate-pulse" />
              {t("solution.badge")}
            </div>

            {/* Heading */}
            <h2 className="landing-heading text-3xl sm:text-4xl lg:text-5xl font-black leading-tight tracking-tight">
              {t("solution.title_part1")}
              <br />
              {t("solution.title_part2")}{" "}
              <span className="relative inline-block">
                <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-cyan-600 dark:from-violet-400 dark:to-cyan-400">
                  {t("solution.title_highlight")}
                </span>
                {/* Underline squiggle */}
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 12" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
                  <path d="M2 8 C40 2, 80 12, 120 6 C160 0, 185 10, 198 6" stroke="url(#squiggle-grad-solution)" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
                  <defs>
                    <linearGradient id="squiggle-grad-solution" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#7c3aed"/>
                      <stop offset="100%" stopColor="#0891b2"/>
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

            {/* Module pills — each with a mini gradient icon strip */}
            <div className="flex flex-wrap gap-2.5 justify-center md:justify-start pt-2">
              {MODULE_PILLS.map((pill) => (
                <span key={pill.key}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold ${pill.text} glass-pill transition-all hover:scale-105`}>
                  <span className={`w-4 h-4 rounded-full bg-gradient-to-br ${pill.color} flex items-center justify-center text-[9px]`}>{pill.emoji}</span>
                  {t(pill.key)}
                </span>
              ))}
            </div>
          </div>

          {/* ── Game embed (Ñam vs Yum) ── */}
          <div className="flex-1 w-full order-2 relative flex items-center justify-center">
            {/* Glow halo */}
            <div className="absolute inset-0 rounded-3xl blur-3xl opacity-30 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at center, #7c3aed 0%, #3b82f6 40%, transparent 70%)' }} />
            {/* Game frame — portrait on mobile, wider on desktop */}
            <div className="relative pixel-font rounded-3xl overflow-hidden shadow-[0_0_60px_rgba(124,58,237,0.35)] w-[300px] h-[520px] md:w-full md:h-[540px] md:max-w-none">
              <NamVsYumGame onExit={handleExit} embeddedMode />
            </div>
          </div>

        </div>
      </div>

      {/* ── Wave bottom ── */}
      <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-none pointer-events-none" style={{ height: 64 }}>
        <svg viewBox="0 0 1440 64" preserveAspectRatio="none" className="w-full h-full">
          <path d="M0,30 C480,64 960,10 1440,45 L1440,64 L0,64 Z" fill="#FFF7ED" className="dark:hidden" />
          <path d="M0,30 C480,64 960,10 1440,45 L1440,64 L0,64 Z" className="hidden dark:block" style={{ fill: '#0f172a' }} />
        </svg>
      </div>
    </section>
  );
}

export default GamifiedLearningSection;
