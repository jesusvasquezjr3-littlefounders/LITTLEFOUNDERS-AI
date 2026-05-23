import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Star, Users, Gamepad2, Trophy } from "lucide-react";

/* ── Stat chip ─────────────────────────────────────────────────────────────── */
function StatChip({ emoji, value, label }: { emoji: string; value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-5 py-3 rounded-2xl glass-chip">
      <span className="text-xl">{emoji}</span>
      <span className="text-gray-900 dark:text-white font-black text-lg leading-none">{value}</span>
      <span className="text-gray-500 dark:text-white/50 text-[11px] font-medium">{label}</span>
    </div>
  );
}

export const LandingParentCTA: React.FC = () => {
  const { t } = useTranslation("landing");

  return (
    <section className="relative py-28 lg:py-36 overflow-hidden text-gray-900 dark:text-white bg-gradient-to-br from-violet-50 to-pink-50 dark:from-[#0a0520] dark:to-[#060d20]">

      {/* ── Radial starburst from center ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.14) 0%, rgba(139,92,246,0.10) 35%, rgba(59,130,246,0.06) 60%, transparent 80%)' }} />
      </div>

      {/* ── Dot-grid texture ── */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.035]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.9) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* ── Concentric ring decoration ── */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        {[400, 560, 720].map((size, i) => (
          <div key={size} className="absolute rounded-full border border-gray-200 dark:border-white/[0.04]"
            style={{ width: size, height: size, top: -size / 2, left: -size / 2, animationDelay: `${i * 0.4}s` }} />
        ))}
      </div>

      {/* ── Floating deco ── */}
      <div className="absolute top-10 left-[8%]  text-3xl opacity-20 animate-float pointer-events-none" style={{ animationDelay: '0s' }}>🚀</div>
      <div className="absolute top-16 right-[6%] text-2xl opacity-15 animate-float pointer-events-none" style={{ animationDelay: '1.3s' }}>⭐</div>
      <div className="absolute bottom-12 left-[14%] text-2xl opacity-15 animate-float pointer-events-none" style={{ animationDelay: '0.7s' }}>🪙</div>
      <div className="absolute bottom-10 right-[10%] text-3xl opacity-15 animate-float pointer-events-none" style={{ animationDelay: '2s' }}>🎉</div>
      <div className="absolute top-1/2 left-[4%]  text-xl opacity-10 animate-float pointer-events-none" style={{ animationDelay: '1.6s' }}>✨</div>
      <div className="absolute top-1/3 right-[4%] text-xl opacity-10 animate-float pointer-events-none" style={{ animationDelay: '0.4s' }}>💡</div>

      {/* ── Wave top ── */}
      <div className="absolute top-0 left-0 w-full overflow-hidden leading-none pointer-events-none" style={{ height: 64 }}>
        <svg viewBox="0 0 1440 64" preserveAspectRatio="none" className="w-full h-full">
          <path d="M0,45 C480,10 960,55 1440,20 L1440,0 L0,0 Z" fill="#FFF7ED" className="dark:hidden" />
          <path d="M0,45 C480,10 960,55 1440,20 L1440,0 L0,0 Z" className="hidden dark:block" style={{ fill: '#0f172a' }} />
        </svg>
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">

        {/* Top badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-pink-500/30 bg-pink-500/10 text-pink-600 dark:text-pink-300 text-sm font-bold mb-8 animate-fade-in-up">
          <span className="w-2 h-2 rounded-full bg-pink-400 animate-pulse" />
          {t("cta_parents.disclaimer")}
        </div>

        {/* Heading */}
        <h2 className="landing-heading text-4xl md:text-5xl lg:text-6xl font-black leading-[1.1] tracking-tight mb-6 animate-fade-in-up-delay-1">
          {t("cta_parents.title")}
        </h2>

        <p className="text-lg md:text-xl text-gray-600 dark:text-white/60 mb-10 max-w-2xl mx-auto leading-relaxed animate-fade-in-up-delay-2">
          {t("cta_parents.subtitle")}
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 justify-center mb-14 animate-fade-in-up-delay-3">
          <Button asChild size="lg"
            className="btn-press h-14 px-10 text-lg rounded-2xl font-black text-white border-0 shadow-none w-full sm:w-auto"
            style={{ background: 'linear-gradient(135deg, #ec4899 0%, #a855f7 100%)' }}>
            <Link to="/onboarding" className="flex items-center gap-2">
              {t("cta_parents.button")}
              <ArrowRight className="w-5 h-5" />
            </Link>
          </Button>

          <Button asChild variant="ghost" size="lg"
            className="h-14 px-8 text-lg rounded-2xl font-bold border-2 border-gray-300 dark:border-white/15 bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-white/8 text-gray-700 dark:text-white/80 hover:text-gray-900 dark:hover:text-white w-full sm:w-auto transition-all">
            <Link to="/login">{t("cta_parents.login_link")}</Link>
          </Button>
        </div>

        {/* Disclaimer */}
        <p className="mt-8 text-sm text-gray-500 dark:text-white/30 animate-fade-in-up-delay-4">
          {t("hero.cta_subtext")}
        </p>
      </div>
    </section>
  );
};
