import { LandingLayout } from "@/components/landing/LandingLayout";
import { Reveal } from "@/components/landing/Reveal";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { CheckCircle2, ArrowRight, Zap, Users, Building2, Minus } from "lucide-react";

function ActiveCard({ t }: { t: (key: string) => string }) {
  const features = [
    t("pricing.freemium_feature_1"),
    t("pricing.freemium_feature_2"),
    t("pricing.freemium_feature_3"),
    t("pricing.freemium_feature_4"),
    t("pricing.freemium_feature_5"),
  ];

  return (
    <div className="corp-card relative flex flex-col overflow-hidden ring-2 ring-indigo-500/50 dark:ring-indigo-400/50 shadow-2xl shadow-indigo-500/10 dark:shadow-indigo-900/20 z-10 bg-white dark:bg-[#0a0e1a]">
      <div className="h-1.5 w-full shrink-0 bg-gradient-to-r from-indigo-600 to-blue-500" />

      <div className="relative z-10 pt-8 px-8 flex justify-between items-center mb-2">
        <h3 className="text-2xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">
          {t("pricing.freemium_title")}
        </h3>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-indigo-700 bg-indigo-50 border border-indigo-200 dark:text-indigo-300 dark:bg-indigo-500/15 dark:border-indigo-500/30">
          <Zap className="w-3 h-3" /> {t("pricing.freemium_badge")}
        </span>
      </div>

      <div className="relative z-10 px-8 pb-8 flex flex-col flex-1">
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-5xl font-bold text-slate-900 dark:text-white tracking-tight">
            {t("pricing.freemium_price")}
          </span>
          <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
            {t("pricing.freemium_period")}
          </span>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-8 leading-relaxed border-b border-slate-100 dark:border-white/5 pb-6">
          {t("pricing.freemium_desc")}
        </p>

        <ul className="space-y-4 mb-8 flex-1">
          {features.map((feat, i) => (
            <li key={i} className="flex items-start gap-3">
              <div className="mt-0.5 w-5 h-5 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0 shadow-sm">
                <CheckCircle2 className="w-3 h-3 text-white" />
              </div>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-snug">{feat}</span>
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
    <div className="corp-card relative flex flex-col opacity-90">
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
            {t("pricing.coming_soon_price")}
          </span>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-8 leading-relaxed border-b border-slate-100 dark:border-white/5 pb-6">
          {t("pricing.coming_soon")}
        </p>

        <ul className="space-y-4 mb-8 flex-1">
          {features.map((feat, i) => (
            <li key={i} className="flex items-start gap-3 opacity-80">
              <div className="mt-0.5 w-5 h-5 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center shrink-0">
                <Minus className="w-3 h-3 text-slate-400" />
              </div>
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400 leading-snug">{feat}</span>
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

export default function PricingPage() {
  const { t } = useTranslation("landing");

  return (
    <LandingLayout>

      <header className="relative overflow-hidden bg-white dark:bg-[#070b14]">
        <div className="absolute inset-0 corp-grid-bg pointer-events-none" />
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[40rem] h-[40rem] rounded-full bg-indigo-400/8 dark:bg-indigo-500/8 blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 lg:pt-44 pb-20 text-center">
          <Reveal as="span" className="inline-flex items-center gap-2 rounded-full border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
            <Zap className="w-3.5 h-3.5" /> {t("nav.pricing")}
          </Reveal>

          <Reveal delay={60}>
            <h1 className="mt-6 text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight text-slate-900 dark:text-white">
              {t("pricing.title")}
            </h1>
          </Reveal>

          <Reveal delay={120}>
            <p className="mt-6 text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl mx-auto">
              {t("pricing.subtitle")}
            </p>
          </Reveal>
        </div>
      </header>

      <section className="relative py-20 sm:py-28 bg-slate-50 dark:bg-[#0a0e1a]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-center">
            <Reveal variant="left" className="h-full">
              <ActiveCard t={t} />
            </Reveal>
            <Reveal delay={60} className="h-full">
              <GhostCard tier="tier2" icon={Users} t={t} />
            </Reveal>
            <Reveal variant="right" delay={120} className="h-full">
              <GhostCard tier="tier3" icon={Building2} t={t} />
            </Reveal>
          </div>

          <Reveal delay={180}>
            <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-16 font-medium">
              {t("hero.cta_subtext")}
            </p>
          </Reveal>
        </div>
      </section>

      <section className="relative py-20 sm:py-28 bg-white dark:bg-[#070b14]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Reveal>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 dark:text-white leading-tight">
              {t("corp.final_cta.title")}
            </h2>
            <p className="mt-4 text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl mx-auto">
              {t("corp.final_cta.subtitle")}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/onboarding"
                className="corp-btn-primary inline-flex items-center justify-center gap-2 text-base font-semibold rounded-xl px-8 py-3.5"
              >
                {t("corp.final_cta.primary")}
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/faq"
                className="inline-flex items-center justify-center gap-2 text-base font-semibold rounded-xl px-8 py-3.5 border border-slate-300 dark:border-white/15 text-slate-700 dark:text-slate-200 hover:border-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors duration-150"
              >
                {t("corp.faq_teaser.cta")}
              </Link>
            </div>
            <p className="mt-5 text-sm text-slate-500 dark:text-slate-400 font-medium">{t("corp.final_cta.microcopy")}</p>
          </Reveal>
        </div>
      </section>

    </LandingLayout>
  );
}
