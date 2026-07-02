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
    <div className="corp-card relative flex flex-col h-full p-8 ring-2 ring-indigo-500/30 dark:ring-indigo-400/30">
      <div className="flex justify-between items-start gap-4 mb-6">
        <div>
          <span className="corp-badge corp-badge--brand">
            <Zap className="w-3 h-3" /> {t("pricing.freemium_badge")}
          </span>
          <h3 className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">
            {t("pricing.freemium_title")}
          </h3>
        </div>
      </div>

      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-5xl font-bold text-slate-900 dark:text-white tracking-tight">
          {t("pricing.freemium_price")}
        </span>
        <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">
          {t("pricing.freemium_period")}
        </span>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-8 leading-relaxed border-b border-slate-100 dark:border-white/5 pb-6">
        {t("pricing.freemium_desc")}
      </p>

      <ul className="space-y-4 mb-8 flex-1">
        {features.map((feat, i) => (
          <li key={i} className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
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
    <div className="corp-card flex flex-col h-full p-8">
      <div className="flex items-center gap-4 mb-6">
        <div className="corp-icon-chip w-12 h-12">
          <Icon className="w-6 h-6" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white">
          {t(`pricing.${tier}_title`)}
        </h3>
      </div>

      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-4xl font-bold text-slate-400 dark:text-slate-500 tracking-tight">
          {t("pricing.coming_soon_price")}
        </span>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 leading-relaxed border-b border-slate-100 dark:border-white/5 pb-6">
        {t("pricing.coming_soon")}
      </p>

      <ul className="space-y-4 mb-8 flex-1">
        {features.map((feat, i) => (
          <li key={i} className="flex items-start gap-3">
            <Minus className="w-5 h-5 text-slate-400 dark:text-slate-500 shrink-0 mt-0.5" />
            <span className="text-sm text-slate-500 dark:text-slate-400 leading-snug">{feat}</span>
          </li>
        ))}
      </ul>

      <div className="corp-btn-secondary inline-flex items-center justify-center w-full h-12 rounded-xl text-sm font-semibold opacity-60 cursor-default pointer-events-none">
        {t("pricing.very_soon")}
      </div>
    </div>
  );
}

export default function PricingPage() {
  const { t } = useTranslation("landing");

  return (
    <LandingLayout>

      <header className="relative overflow-hidden bg-gradient-to-b from-indigo-50/80 via-white to-white dark:from-[#0b1124] dark:via-[#070b14] dark:to-[#070b14]">
        <div className="absolute inset-0 corp-grid-bg pointer-events-none" />
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[40rem] h-[40rem] rounded-full bg-indigo-400/10 dark:bg-indigo-500/8 blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 lg:pt-44 pb-20 text-center">
          <Reveal as="span" className="corp-eyebrow">
            {t("nav.pricing")}
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
                className="corp-btn-secondary inline-flex items-center justify-center gap-2 text-base font-semibold rounded-xl px-8 py-3.5"
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
