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
      <section className={`rounded-[2.5rem] md:rounded-[3rem] overflow-hidden ${className}`}>
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
          <Reveal as="span" className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-800 dark:text-slate-200 mb-6 shadow-sm">
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
              className="mt-10 inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-base font-semibold rounded-full px-8 py-4 transition-colors duration-200 shadow-[0_4px_14px_0_rgb(79,70,229,0.39)]"
            >
              {t("how_it_works.hero_cta")}
            </Link>
          </Reveal>
        </div>
      </Island>

      {/* ── STEPS (Zig-Zag, Fondo blanco de la página) ────────────────── */}
      <section className="py-16 sm:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12 md:mb-32">
            <Reveal delay={60}>
              <h2 className="text-2xl md:text-2xl lg:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                {t("how_it_works.steps_title")}
              </h2>
            </Reveal>
          </div>

          <div className="space-y-16 md:space-y-20">
            {steps.map((step, i) => (
              <Reveal key={i} variant={i % 2 === 0 ? "left" : "right"} delay={i * 60}>
                <div className={`md:flex items-center gap-12 lg:gap-20 ${i % 2 === 1 ? "md:flex-row-reverse" : ""}`}>
                  {/* Lado de la Imagen/Gráfico (Recuadro pastel) */}
                  <div className="md:w-1/2 mb-10 md:mb-0 relative">
                    <div className="absolute top-4 left-4 sm:top-6 sm:left-8 w-12 h-12 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center text-xl font-bold text-slate-900 dark:text-white shadow-lg z-10">
                      {i + 1}
                    </div>
                    <div className={`aspect-[4/3] rounded-[2.5rem] ${step.bg} flex items-center justify-center p-6 relative overflow-hidden`}>
                      <step.icon className={`w-32 h-32 ${step.iconColor} opacity-90`} strokeWidth={1.5} />
                    </div>
                  </div>
                  {/* Lado del Texto (Limpio sobre fondo blanco) */}
                  <div className="md:w-1/2">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4 tracking-tight">
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
          <div className="text-center max-w-2xl mx-auto mb-16">
            <Reveal delay={60}>
              <h2 className="text-2xl md:text-2xl lg:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                {t("how_it_works.kids_section_title")}
              </h2>
            </Reveal>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <Reveal variant="left">
              <div className="bg-white dark:bg-[#0d1426] rounded-3xl p-6 h-full shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)]">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-white/5 flex items-center justify-center mb-8">
                  <Smile className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">{t("how_it_works.kids_title")}</h3>
                <ul className="space-y-4">
                  {[t("how_it_works.kids_1"), t("how_it_works.kids_2"), t("how_it_works.kids_3")].map((it, i) => (
                    <li key={i} className="flex items-start gap-4 text-base text-slate-700 dark:text-slate-300">
                      <CheckCircle2 className="w-6 h-6 text-indigo-500 shrink-0 mt-0.5" /> 
                      <span className="leading-relaxed">{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal variant="right" delay={60}>
              <div className="bg-white dark:bg-[#0d1426] rounded-3xl p-6 h-full shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)]">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-white/5 flex items-center justify-center mb-8">
                  <ShieldCheck className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                </div>
                <span className="inline-block px-3 py-1 rounded-full bg-slate-100 dark:bg-white/5 text-xs font-semibold text-slate-600 dark:text-slate-300 mb-4">{t("how_it_works.parents_label")}</span>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">{t("how_it_works.parents_title")}</h3>
                <ul className="space-y-4">
                  {[t("how_it_works.parents_1"), t("how_it_works.parents_2"), t("how_it_works.parents_3")].map((it, i) => (
                    <li key={i} className="flex items-start gap-4 text-base text-slate-700 dark:text-slate-300">
                      <CheckCircle2 className="w-6 h-6 text-indigo-500 shrink-0 mt-0.5" /> 
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
      <section className="bg-slate-900 py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Reveal>
            <h2 className="text-2xl md:text-2xl lg:text-xl font-bold text-white tracking-tight leading-tight mb-8">
              {t("how_it_works.cta_title")}
            </h2>
            <p className="text-xl text-slate-300 leading-relaxed max-w-2xl mx-auto mb-12">
              {t("how_it_works.cta_subtitle")}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                to="/onboarding"
                className="inline-flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white text-lg font-semibold rounded-full px-10 py-5 transition-colors duration-200"
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
