import { LandingLayout } from "@/components/landing/LandingLayout";
import { Reveal } from "@/components/landing/Reveal";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { CheckCircle2, ArrowRight, Zap, Lock, Sparkles } from "lucide-react";

/* ── Active tier card ──────────────────────────────────────────────────────── */
function ActiveCard({ t }: { t: (key: string) => string }) {
  const features = [
    t("pricing.freemium_feature_1"),
    t("pricing.freemium_feature_2"),
    t("pricing.freemium_feature_3"),
    t("pricing.freemium_feature_4"),
    t("pricing.freemium_feature_5"),
  ];

  return (
    <div className="corp-card relative flex flex-col overflow-hidden ring-2 ring-indigo-500/40 dark:ring-indigo-400/30">
      {/* Accent top strip */}
      <div className="h-1 w-full shrink-0 bg-gradient-to-r from-indigo-500 to-violet-600" />

      {/* Subtle top glow */}
      <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full bg-indigo-400/15 dark:bg-indigo-500/10 blur-[60px] pointer-events-none" />

      {/* Badge */}
      <div className="relative z-10 pt-8 px-8 flex justify-center">
        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest text-white bg-gradient-to-r from-indigo-500 to-violet-600 shadow-lg">
          <Zap className="w-3 h-3" /> {t("pricing.freemium_badge")}
        </span>
      </div>

      <div className="relative z-10 px-8 pt-6 pb-8 flex flex-col flex-1">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight mb-1">
          {t("pricing.freemium_title")}
        </h3>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-5xl font-bold text-slate-900 dark:text-white tracking-tight">
            {t("pricing.freemium_price")}
          </span>
          <span className="text-slate-400 dark:text-slate-500 text-xs font-semibold uppercase tracking-wider">
            {t("pricing.freemium_period")}
          </span>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
          {t("pricing.freemium_desc")}
        </p>

        <ul className="space-y-3 mb-8 flex-1">
          {features.map((feat, i) => (
            <li key={i} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-3 h-3 text-white" />
              </div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{feat}</span>
            </li>
          ))}
        </ul>

        <Link
          to="/onboarding"
          className="corp-btn-primary inline-flex items-center justify-center gap-2 w-full h-12 rounded-xl text-sm font-semibold"
        >
          {t("pricing.freemium_btn")}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

/* ── Ghost tier card ───────────────────────────────────────────────────────── */
function GhostCard({ titleKey, t }: { titleKey: string; t: (key: string) => string }) {
  return (
    <div className="corp-card relative flex flex-col opacity-60 hover:opacity-75 transition-opacity duration-300 group">
      {/* Coming soon watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden rounded-2xl">
        <span className="text-slate-200 dark:text-white/[0.05] font-bold text-2xl uppercase tracking-[0.4em] -rotate-12 leading-none text-center">
          {t("pricing.coming_soon")}
        </span>
      </div>

      {/* Lock icon */}
      <div className="relative z-10 pt-8 px-8 flex justify-center">
        <div className="w-10 h-10 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 flex items-center justify-center">
          <Lock className="w-4 h-4 text-slate-400 dark:text-white/30" />
        </div>
      </div>

      <div className="relative z-10 px-8 pt-6 pb-8 flex flex-col flex-1">
        <h3 className="text-xl font-bold text-slate-400 dark:text-white/40 uppercase tracking-tight mb-2">
          {t(titleKey)}
        </h3>

        <div className="mb-4 blur-sm select-none">
          <span className="text-4xl font-bold text-slate-300 dark:text-white/20 tracking-tight">???</span>
        </div>

        <ul className="space-y-3 mb-8 flex-1 opacity-30 blur-[2px]">
          {[1, 2, 3].map((i) => (
            <li key={i} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-lg bg-slate-200 dark:bg-white/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-3 h-3 text-slate-400 dark:text-white/40" />
              </div>
              <span className="text-sm font-medium text-slate-400 dark:text-white/50">{"· · · · · · · · ·"}</span>
            </li>
          ))}
        </ul>

        <div className="inline-flex items-center justify-center w-full h-12 rounded-xl border border-slate-200 dark:border-white/10 text-slate-400 dark:text-white/25 text-xs font-semibold uppercase tracking-widest pointer-events-none">
          {t("pricing.very_soon")}
        </div>
      </div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────────── */
export default function PricingPage() {
  const { t } = useTranslation("landing");

  return (
    <LandingLayout>

      {/* ══════════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════════ */}
      <header className="relative overflow-hidden bg-gradient-to-b from-indigo-50/80 via-white to-white dark:from-[#0b1124] dark:via-[#070b14] dark:to-[#070b14]">
        <div className="absolute inset-0 corp-grid-bg pointer-events-none" />
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[40rem] h-[40rem] rounded-full bg-indigo-400/12 dark:bg-indigo-600/12 blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 lg:pt-44 pb-20 text-center">
          <Reveal as="span" className="inline-flex items-center gap-2 rounded-full border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
            <Sparkles className="w-3.5 h-3.5" /> {t("nav.pricing")}
          </Reveal>

          <Reveal delay={80}>
            <h1 className="mt-6 text-4xl sm:text-5xl font-bold leading-tight text-slate-900 dark:text-white">
              {t("pricing.title")}
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="mt-6 text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl mx-auto">
              {t("pricing.subtitle")}
            </p>
          </Reveal>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════
          PRICING CARDS
      ══════════════════════════════════════════════════════════ */}
      <section className="relative py-24 bg-slate-50 dark:bg-[#0a0e1a]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
            <Reveal variant="left">
              <ActiveCard t={t} />
            </Reveal>
            <Reveal delay={80}>
              <GhostCard titleKey="pricing.tier2_title" t={t} />
            </Reveal>
            <Reveal variant="right" delay={160}>
              <GhostCard titleKey="pricing.tier3_title" t={t} />
            </Reveal>
          </div>

          <Reveal delay={200}>
            <p className="text-center text-sm text-slate-400 dark:text-slate-500 mt-10 font-medium">
              {t("hero.cta_subtext")}
            </p>
          </Reveal>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          FINAL CTA
      ══════════════════════════════════════════════════════════ */}
      <section className="relative py-24 bg-white dark:bg-[#070b14]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl bg-slate-900 dark:bg-gradient-to-br dark:from-indigo-900 dark:to-blue-950 px-6 sm:px-12 py-16 text-center">
              <div className="absolute inset-0 corp-grid-bg opacity-30 pointer-events-none" />
              <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[30rem] h-[30rem] rounded-full bg-indigo-500/20 blur-[100px] pointer-events-none" />
              <div className="relative z-10">
                <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight max-w-2xl mx-auto">
                  {t("corp.final_cta.title")}
                </h2>
                <p className="mt-4 text-white/70 max-w-xl mx-auto leading-relaxed">
                  {t("corp.final_cta.subtitle")}
                </p>
                <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
                  <Link
                    to="/onboarding"
                    className="inline-flex items-center justify-center gap-2 text-base font-semibold rounded-xl px-8 py-3.5 bg-white text-indigo-700 hover:bg-indigo-50 transition-colors shadow-lg"
                  >
                    {t("corp.final_cta.primary")}
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                  <Link
                    to="/faq"
                    className="inline-flex items-center justify-center gap-2 text-base font-semibold rounded-xl px-8 py-3.5 border border-white/25 text-white hover:bg-white/10 transition-colors"
                  >
                    {t("corp.faq_teaser.cta")}
                  </Link>
                </div>
                <p className="mt-5 text-sm text-white/50">{t("corp.final_cta.microcopy")}</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

    </LandingLayout>
  );
}
