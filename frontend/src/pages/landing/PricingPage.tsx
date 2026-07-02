import { LandingLayout } from "@/components/landing/LandingLayout";
import { Reveal } from "@/components/landing/Reveal";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { CheckCircle2, ArrowRight, Zap, Users, Building2, Minus } from "lucide-react";

// El wrapper "Isla" que define el estilo Brilliant.org
function Island({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return (
    <div className="py-4 sm:py-6 px-4 sm:px-6 lg:px-8 max-w-[85rem] mx-auto">
      <section className={`rounded-[2.5rem] md:rounded-[3rem] overflow-hidden border border-slate-200/60 dark:border-white/5 ${className}`}>
        {children}
      </section>
    </div>
  );
}

function ActiveCard({ t }: { t: (key: string) => string }) {
  const features = [
    t("pricing.freemium_feature_1"),
    t("pricing.freemium_feature_2"),
    t("pricing.freemium_feature_3"),
    t("pricing.freemium_feature_4"),
    t("pricing.freemium_feature_5"),
  ];

  return (
    <div className="relative flex flex-col h-full p-8 rounded-3xl bg-white dark:bg-[#0d1426] shadow-[0_4px_20px_-4px_rgba(79,70,229,0.15)] border border-indigo-100 dark:border-indigo-500/20 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:shadow-[0_8px_30px_-8px_rgba(79,70,229,0.25)] dark:hover:shadow-[0_8px_30px_-8px_rgba(79,70,229,0.4)]">
      <div className="absolute -top-3.5 left-8">
        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-indigo-600 text-white text-xs font-bold shadow-sm">
          <Zap className="w-3.5 h-3.5 fill-white" /> {t("pricing.freemium_badge")}
        </span>
      </div>

      <div className="mt-4 mb-8">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white">
          {t("pricing.freemium_title")}
        </h3>
      </div>

      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-5xl font-bold text-slate-900 dark:text-white tracking-tight">
          {t("pricing.freemium_price")}
        </span>
        <span className="text-slate-500 dark:text-slate-400 text-base font-medium">
          {t("pricing.freemium_period")}
        </span>
      </div>
      <p className="text-base text-slate-600 dark:text-slate-400 mb-10 leading-relaxed border-b border-slate-100 dark:border-white/5 pb-8">
        {t("pricing.freemium_desc")}
      </p>

      <ul className="space-y-4 mb-10 flex-1">
        {features.map((feat, i) => (
          <li key={i} className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
            <span className="text-base font-medium text-slate-700 dark:text-slate-300 leading-relaxed">{feat}</span>
          </li>
        ))}
      </ul>

      <Link
        to="/onboarding"
        className="corp-btn-primary inline-flex items-center justify-center gap-2 w-full py-4 rounded-full text-base font-semibold"
      >
        {t("pricing.freemium_btn")}
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
    <div className="flex flex-col h-full p-8 rounded-3xl bg-white/60 dark:bg-[#0d1426]/60 border border-slate-200/60 dark:border-white/5 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.2)] hover:border-slate-200 dark:hover:border-white/10">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center border border-slate-200/60 dark:border-white/5">
          <Icon className="w-6 h-6 text-slate-400 dark:text-slate-500" />
        </div>
        <h3 className="text-xl font-bold text-slate-500 dark:text-slate-400">
          {t(`pricing.${tier}_title`)}
        </h3>
      </div>

      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-4xl font-bold text-slate-300 dark:text-slate-600 tracking-tight">
          {t("pricing.coming_soon_price")}
        </span>
      </div>
      <p className="text-base text-slate-400 dark:text-slate-500 mb-10 leading-relaxed border-b border-slate-100 dark:border-white/5 pb-8">
        {t("pricing.coming_soon")}
      </p>

      <ul className="space-y-4 mb-10 flex-1">
        {features.map((feat, i) => (
          <li key={i} className="flex items-start gap-3">
            <Minus className="w-5 h-5 text-slate-300 dark:text-slate-600 shrink-0 mt-0.5" />
            <span className="text-base text-slate-400 dark:text-slate-500 leading-relaxed">{feat}</span>
          </li>
        ))}
      </ul>

      <div className="inline-flex items-center justify-center w-full py-4 rounded-full text-base font-semibold bg-slate-100/60 dark:bg-white/5 text-slate-400 dark:text-slate-500 cursor-default">
        {t("pricing.very_soon")}
      </div>
    </div>
  );
}

export default function PricingPage() {
  const { t } = useTranslation("landing");

  return (
    <LandingLayout>
      <Island className="bg-slate-50 dark:bg-[#0a0e1a] mb-12">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-12 lg:py-16 text-center">
          <Reveal>
            <span className="inline-flex items-center px-4 py-2 rounded-full bg-white dark:bg-white/5 border border-slate-200/70 dark:border-white/8 text-sm font-semibold text-slate-800 dark:text-slate-200 mb-8 shadow-sm">
              {t("nav.pricing")}
            </span>
          </Reveal>

          <Reveal delay={60}>
            <h1 className="text-4xl lg:text-5xl font-bold leading-tight text-slate-900 dark:text-white tracking-tight max-w-3xl mx-auto">
              {t("pricing.title")}
            </h1>
          </Reveal>

          <Reveal delay={120}>
            <p className="mt-6 text-xl text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl mx-auto mb-12">
              {t("pricing.subtitle")}
            </p>
          </Reveal>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch text-left">
            <Reveal variant="left" className="h-full relative z-10 lg:scale-105">
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
            <p className="text-center text-base text-slate-500 dark:text-slate-400 mt-12 font-medium">
              {t("hero.cta_subtext")}
            </p>
          </Reveal>
        </div>
      </Island>

      </LandingLayout>
  );
}
