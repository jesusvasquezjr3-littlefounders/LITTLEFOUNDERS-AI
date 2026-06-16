import { LandingLayout } from "@/components/landing/LandingLayout";
import { Reveal } from "@/components/landing/Reveal";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { CheckCircle2, ArrowRight, Zap, Lock, Sparkles, Users, Building2 } from "lucide-react";

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
    <div className="corp-card relative flex flex-col overflow-hidden ring-2 ring-indigo-500/50 dark:ring-indigo-400/50 shadow-2xl shadow-indigo-500/10 dark:shadow-indigo-900/20 z-10 md:scale-105 bg-white dark:bg-[#0a0e1a]">
      {/* Accent top strip */}
      <div className="h-1.5 w-full shrink-0 bg-gradient-to-r from-[#1a9e7a] to-[#f6a821]" />

      {/* Subtle top glow */}
      <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full bg-[#1a9e7a]/15 dark:bg-[#1a9e7a]/10 blur-[60px] pointer-events-none" />

      {/* Badge */}
      <div className="relative z-10 pt-8 px-8 flex justify-between items-center mb-2">
        <h3 className="text-2xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">
          {t("pricing.freemium_title")}
        </h3>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-[#0d7a5f] bg-[#1a9e7a]/10 border border-[#1a9e7a]/30 dark:text-[#34d399] dark:bg-[#1a9e7a]/15">
          <Zap className="w-3 h-3" /> {t("pricing.freemium_badge")}
        </span>
      </div>

      <div className="relative z-10 px-8 pb-8 flex flex-col flex-1">
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-5xl font-bold text-slate-900 dark:text-white tracking-tight">
            {t("pricing.freemium_price")}
          </span>
          <span className="text-slate-400 dark:text-slate-500 text-xs font-semibold uppercase tracking-wider">
            {t("pricing.freemium_period")}
          </span>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 leading-relaxed border-b border-slate-100 dark:border-white/5 pb-6">
          {t("pricing.freemium_desc")}
        </p>

        <ul className="space-y-4 mb-8 flex-1">
          {features.map((feat, i) => (
            <li key={i} className="flex items-start gap-3">
              <div className="mt-0.5 w-5 h-5 rounded-lg bg-[#1a9e7a] flex items-center justify-center shrink-0 shadow-sm">
                <CheckCircle2 className="w-3 h-3 text-white" />
              </div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-snug">{feat}</span>
            </li>
          ))}
        </ul>

        <Link
          to="/onboarding"
          className="inline-flex items-center justify-center gap-2 w-full h-12 rounded-xl text-sm font-semibold shadow-lg shadow-[#f6a821]/20 bg-[#f6a821] text-slate-900 hover:bg-[#e8880a] transition-colors"
        >
          {t("pricing.freemium_btn")}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

/* ── Ghost tier card ───────────────────────────────────────────────────────── */
function GhostCard({ 
  tier, 
  icon: Icon,
  t 
}: { 
  tier: "tier2" | "tier3"; 
  icon: React.ElementType;
  t: (key: string) => string 
}) {
  const features = [
    t(`pricing.${tier}_feature_1`),
    t(`pricing.${tier}_feature_2`),
    t(`pricing.${tier}_feature_3`),
  ];

  return (
    <div className="corp-card relative flex flex-col opacity-90 hover:opacity-100 transition-all duration-300 group hover:-translate-y-1">
      {/* Lock overlay watermark */}
      <div className="absolute top-6 right-6 opacity-10 dark:opacity-20 pointer-events-none transition-transform group-hover:scale-110 duration-500">
        <Lock className="w-24 h-24 text-slate-400" />
      </div>

      <div className="relative z-10 pt-8 px-8 flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 flex items-center justify-center shrink-0">
          <Icon className="w-6 h-6 text-slate-400 dark:text-slate-500" />
        </div>
        <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight">
          {t(`pricing.${tier}_title`)}
        </h3>
      </div>

      <div className="relative z-10 px-8 pb-8 flex flex-col flex-1">
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-4xl font-bold text-slate-400 dark:text-slate-500 tracking-tight">
            TBA
          </span>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 leading-relaxed border-b border-slate-100 dark:border-white/5 pb-6">
          {t("pricing.coming_soon")}
        </p>

        <ul className="space-y-4 mb-8 flex-1">
          {features.map((feat, i) => (
            <li key={i} className="flex items-start gap-3 opacity-80">
              <div className="mt-0.5 w-5 h-5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-3 h-3 text-slate-400 dark:text-slate-500" />
              </div>
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-snug">{feat}</span>
            </li>
          ))}
        </ul>

        <div className="inline-flex items-center justify-center w-full h-12 rounded-xl border border-slate-200 dark:border-white/10 text-slate-400 dark:text-slate-500 text-sm font-semibold pointer-events-none bg-slate-50 dark:bg-white/[0.02]">
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
      <header className="relative overflow-hidden bg-white dark:bg-[#070b14]">
        <div className="absolute inset-0 corp-grid-bg pointer-events-none" />
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[40rem] h-[40rem] rounded-full bg-amber-400/8 dark:bg-amber-500/8 blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 lg:pt-44 pb-20 text-center">
          <Reveal as="span" className="inline-flex items-center gap-2 rounded-full border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
            <Sparkles className="w-3.5 h-3.5" /> {t("nav.pricing")}
          </Reveal>

          <Reveal delay={80}>
            <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight text-slate-900 dark:text-white">
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-center">
            <Reveal variant="left" className="h-full">
              <ActiveCard t={t} />
            </Reveal>
            <Reveal delay={80} className="h-full">
              <GhostCard tier="tier2" icon={Users} t={t} />
            </Reveal>
            <Reveal variant="right" delay={160} className="h-full">
              <GhostCard tier="tier3" icon={Building2} t={t} />
            </Reveal>
          </div>

          <Reveal delay={200}>
            <p className="text-center text-sm text-slate-400 dark:text-slate-500 mt-16 font-medium">
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
            <div className="relative overflow-hidden rounded-3xl bg-slate-900 px-6 sm:px-12 py-16 text-center shadow-2xl">
              <div className="absolute inset-0 corp-grid-bg opacity-30 pointer-events-none" />
              <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[30rem] h-[30rem] rounded-full bg-[#1a9e7a]/15 blur-[100px] pointer-events-none" />
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
                    className="inline-flex items-center justify-center gap-2 text-base font-semibold rounded-xl px-8 py-3.5 bg-[#f6a821] text-slate-900 hover:bg-[#e8880a] transition-colors shadow-lg shadow-[#f6a821]/20"
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
                <p className="mt-5 text-sm text-white/50 font-medium">{t("corp.final_cta.microcopy")}</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

    </LandingLayout>
  );
}
