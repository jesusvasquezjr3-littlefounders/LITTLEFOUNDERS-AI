import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { LandingLayout } from "@/components/landing/LandingLayout";
import { Reveal } from "@/components/landing/Reveal";
import {
  ArrowRight,
  UserPlus,
  Gamepad2,
  Bot,
  LineChart,
  CheckCircle2,
  Smile,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

// El wrapper "Isla" que define el estilo Brilliant.org (recuadros grandes flotantes)
function Island({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return (
    <div className="py-4 sm:py-6 px-4 sm:px-6 lg:px-8 max-w-[85rem] mx-auto">
      <section className={`rounded-[2.5rem] md:rounded-[3rem] overflow-hidden border border-slate-200/60 dark:border-white/5 ${className}`}>
        {children}
      </section>
    </div>
  );
}

export default function HowItWorksPage() {
  const { t } = useTranslation("landing");

  const steps = [
    {
      icon: UserPlus,
      title: t("how_it_works.s1_title"),
      desc: t("how_it_works.s1_desc"),
      bg: "bg-indigo-50 dark:bg-indigo-500/10",
      iconColor: "text-indigo-600",
    },
    {
      icon: Gamepad2,
      title: t("how_it_works.s2_title"),
      desc: t("how_it_works.s2_desc"),
      bg: "bg-emerald-50 dark:bg-emerald-500/10",
      iconColor: "text-emerald-600",
    },
    {
      icon: Bot,
      title: t("how_it_works.s3_title"),
      desc: t("how_it_works.s3_desc"),
      bg: "bg-orange-50 dark:bg-orange-500/10",
      iconColor: "text-orange-600",
    },
    {
      icon: LineChart,
      title: t("how_it_works.s4_title"),
      desc: t("how_it_works.s4_desc"),
      bg: "bg-sky-50 dark:bg-sky-500/10",
      iconColor: "text-sky-600",
    },
  ];

  return (
    <LandingLayout>
      {/* ── HERO (Isla masiva gris claro) ─────────────────────────────── */}
      <Island className="bg-slate-50 dark:bg-[#0a0e1a]">
        <div className="max-w-4xl mx-auto px-6 pt-24 pb-24 text-center">
          <Reveal as="span" className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-white/5 border border-slate-200/70 dark:border-white/8 text-xs font-semibold text-slate-800 dark:text-slate-200 mb-6 shadow-sm">
            {t("how_it_works.hero_badge")}
          </Reveal>
          <Reveal delay={60}>
            <h1 className="mt-4 text-4xl md:text-5xl font-bold tracking-tight leading-[1.05] text-slate-900 dark:text-white">
              {t("how_it_works.hero_title_1")}{" "}
              <span className="text-indigo-600 dark:text-indigo-400">{t("how_it_works.hero_title_grad")}</span>
            </h1>
          </Reveal>
          <Reveal delay={120}>
            <p className="mt-8 text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl mx-auto">
              {t("how_it_works.hero_subtitle")}
            </p>
          </Reveal>
          <Reveal delay={180}>
            <Link
              to="/onboarding"
              className="corp-btn-primary mt-10 inline-flex items-center justify-center gap-2 text-base font-semibold rounded-full px-8 py-4"
            >
              {t("how_it_works.hero_cta")}
            </Link>
          </Reveal>
        </div>
      </Island>

      {/* ── STEPS (Zig-Zag, Fondo blanco de la página) ────────────────── */}
      <section className="py-16 sm:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16 md:mb-24">
            <Reveal>
              <span className="corp-eyebrow">{t("how_it_works.steps_eyebrow")}</span>
            </Reveal>
            <Reveal delay={40}>
              <h2 className="mt-3 text-3xl md:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
                {t("how_it_works.steps_title")}
              </h2>
            </Reveal>
          </div>

          <div className="space-y-20 md:space-y-28">
            {steps.map((step, i) => (
              <Reveal key={i} variant={i % 2 === 0 ? "left" : "right"} delay={i * 60}>
                <div className={`md:flex items-center gap-12 lg:gap-20 ${i % 2 === 1 ? "md:flex-row-reverse" : ""}`}>
                  <div className="md:w-1/2 mb-10 md:mb-0 relative">
                    <div className="absolute top-4 left-4 sm:top-6 sm:left-8 w-11 h-11 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center text-lg font-bold text-slate-900 dark:text-white shadow-[0_2px_8px_-2px_rgba(0,0,0,0.15)] z-10 border border-slate-100 dark:border-white/10">
                      {i + 1}
                    </div>
                    <div className={`aspect-[4/3] rounded-[2.5rem] ${step.bg} flex items-center justify-center p-6 relative overflow-hidden border border-slate-200/50 dark:border-white/5 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:shadow-[0_8px_30px_-8px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_8px_30px_-8px_rgba(0,0,0,0.25)] hover:border-slate-200/80 dark:hover:border-white/10 group`}>
                      <step.icon className={`w-28 h-28 sm:w-32 sm:h-32 ${step.iconColor} opacity-90 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105`} strokeWidth={1.25} />
                    </div>
                  </div>
                  <div className="md:w-1/2">
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 tracking-tight">
                      {step.title}
                    </h3>
                    <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── KIDS & PARENTS (Isla masiva gris claro) ───────────────────── */}
      <Island className="bg-slate-50 dark:bg-[#0a0e1a] mb-12">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-12 lg:py-16">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <Reveal>
              <span className="corp-eyebrow">{t("how_it_works.experience_eyebrow")}</span>
            </Reveal>
            <Reveal delay={40}>
              <h2 className="mt-3 text-3xl md:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
                {t("how_it_works.kids_section_title")}
              </h2>
            </Reveal>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <Reveal variant="left">
              <div className="bg-white dark:bg-[#0d1426] rounded-3xl p-8 h-full shadow-[0_1px_3px_-1px_rgba(0,0,0,0.04)] border border-slate-100 dark:border-white/5 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.3)] hover:border-slate-200 dark:hover:border-white/10">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-white/5 flex items-center justify-center mb-8 border border-slate-100 dark:border-white/5">
                  <Smile className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">{t("how_it_works.kids_title")}</h3>
                <ul className="space-y-4">
                  {[t("how_it_works.kids_1"), t("how_it_works.kids_2"), t("how_it_works.kids_3")].map((it, i) => (
                    <li key={i} className="flex items-start gap-3 text-base text-slate-700 dark:text-slate-300">
                      <CheckCircle2 className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" /> 
                      <span className="leading-relaxed">{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal variant="right" delay={60}>
              <div className="bg-white dark:bg-[#0d1426] rounded-3xl p-8 h-full shadow-[0_1px_3px_-1px_rgba(0,0,0,0.04)] border border-slate-100 dark:border-white/5 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.3)] hover:border-slate-200 dark:hover:border-white/10">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-white/5 flex items-center justify-center mb-8 border border-slate-100 dark:border-white/5">
                  <ShieldCheck className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                </div>
                <span className="corp-eyebrow mb-4">{t("how_it_works.parents_label")}</span>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">{t("how_it_works.parents_title")}</h3>
                <ul className="space-y-4">
                  {[t("how_it_works.parents_1"), t("how_it_works.parents_2"), t("how_it_works.parents_3")].map((it, i) => (
                    <li key={i} className="flex items-start gap-3 text-base text-slate-700 dark:text-slate-300">
                      <CheckCircle2 className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" /> 
                      <span className="leading-relaxed">{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </Island>

      {/* ── FINAL CTA (Full width dark) ───────────────────────────────── */}
      <section className="bg-slate-900 py-16 sm:py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Reveal>
            <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight leading-tight mb-6">
              {t("how_it_works.cta_title")}
            </h2>
            <p className="text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto mb-10">
              {t("how_it_works.cta_subtitle")}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                to="/onboarding"
                className="corp-btn-primary inline-flex items-center justify-center gap-2 text-lg font-semibold rounded-full px-10 py-5"
              >
                {t("how_it_works.cta_button")}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </LandingLayout>
  );
}
