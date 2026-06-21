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
  Sparkles,
  CheckCircle2,
  Smile,
  ShieldCheck,
} from "lucide-react";

export default function HowItWorksPage() {
  const { t } = useTranslation("landing");

  const steps = [
    {
      icon: UserPlus,
      title: t("how_it_works.s1_title"),
      desc: t("how_it_works.s1_desc"),
      iconBg: "bg-indigo-600",
      iconShadow: "shadow-[0_8px_20px_-6px_rgba(79,70,229,0.45)]",
      nodeBorder: "border-indigo-600/40 dark:border-indigo-500/50",
      nodeText: "text-indigo-700 dark:text-indigo-300",
    },
    {
      icon: Gamepad2,
      title: t("how_it_works.s2_title"),
      desc: t("how_it_works.s2_desc"),
      iconBg: "bg-indigo-500",
      iconShadow: "shadow-[0_8px_20px_-6px_rgba(99,102,241,0.40)]",
      nodeBorder: "border-indigo-500/40 dark:border-indigo-400/50",
      nodeText: "text-blue-600 dark:text-blue-300",
    },
    {
      icon: Bot,
      title: t("how_it_works.s3_title"),
      desc: t("how_it_works.s3_desc"),
      iconBg: "bg-blue-500",
      iconShadow: "shadow-[0_8px_20px_-6px_rgba(59,130,246,0.40)]",
      nodeBorder: "border-blue-500/35 dark:border-blue-400/50",
      nodeText: "text-blue-600 dark:text-blue-300",
    },
    {
      icon: LineChart,
      title: t("how_it_works.s4_title"),
      desc: t("how_it_works.s4_desc"),
      iconBg: "bg-sky-500",
      iconShadow: "shadow-[0_8px_20px_-6px_rgba(14,165,233,0.40)]",
      nodeBorder: "border-sky-500/35 dark:border-sky-400/50",
      nodeText: "text-sky-600 dark:text-sky-300",
    },
  ];

  return (
    <LandingLayout>
      <header className="relative overflow-hidden bg-white dark:bg-[#070b14]">
        <div className="absolute inset-0 corp-grid-bg pointer-events-none" />
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[40rem] h-[40rem] rounded-full bg-indigo-400/8 dark:bg-indigo-500/8 blur-[140px] pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 lg:pt-44 pb-20 text-center">
          <Reveal as="span" className="inline-flex items-center gap-2 rounded-full border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
            <Sparkles className="w-3.5 h-3.5" /> {t("how_it_works.hero_badge")}
          </Reveal>
          <Reveal delay={60}>
            <h1 className="mt-6 text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.1] text-slate-900 dark:text-white">
              {t("how_it_works.hero_title_1")}{" "}
              <span className="text-indigo-600 dark:text-indigo-400">{t("how_it_works.hero_title_grad")}</span>
            </h1>
          </Reveal>
          <Reveal delay={120}>
            <p className="mt-6 text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl mx-auto">
              {t("how_it_works.hero_subtitle")}
            </p>
          </Reveal>
          <Reveal delay={180}>
            <Link
              to="/onboarding"
              className="corp-btn-primary mt-8 inline-flex items-center justify-center gap-2 text-base font-semibold rounded-xl px-7 py-3.5"
            >
              {t("how_it_works.hero_cta")}
              <ArrowRight className="w-5 h-5" />
            </Link>
          </Reveal>
        </div>
      </header>

      <section className="relative py-20 sm:py-28 bg-white dark:bg-[#070b14]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <Reveal>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                {t("how_it_works.steps_title")}
              </h2>
            </Reveal>
          </div>

          <div className="mt-16 relative">
            <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-indigo-200/80 via-slate-200 to-transparent dark:from-indigo-500/20 dark:via-white/8 -translate-x-1/2" />

            <div className="space-y-10 md:space-y-16">
              {steps.map((step, i) => (
                <Reveal key={i} variant={i % 2 === 0 ? "left" : "right"} delay={i * 60}>
                  <div className={`md:flex items-center gap-8 ${i % 2 === 1 ? "md:flex-row-reverse" : ""}`}>
                    <div className="md:w-1/2">
                      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1426] p-8">
                        <div className={`w-12 h-12 rounded-2xl ${step.iconBg} ${step.iconShadow} flex items-center justify-center`}>
                          <step.icon className="w-6 h-6 text-white" />
                        </div>
                        <h3 className="mt-5 text-xl font-bold text-slate-900 dark:text-white">{step.title}</h3>
                        <p className="mt-2 text-slate-600 dark:text-slate-400 leading-relaxed">{step.desc}</p>
                      </div>
                    </div>
                    <div className={`hidden md:flex w-12 h-12 shrink-0 rounded-full bg-white dark:bg-[#0d1426] border-2 ${step.nodeBorder} items-center justify-center font-bold ${step.nodeText} z-10`}>
                      {i + 1}
                    </div>
                    <div className="hidden md:block md:w-1/2" />
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative py-16 sm:py-24 bg-slate-50 dark:bg-[#0a0e1a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <Reveal>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                {t("how_it_works.kids_section_title")}
              </h2>
            </Reveal>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <Reveal variant="left">
              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1426] h-full p-8 lg:p-10">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500 shadow-[0_8px_20px_-6px_rgba(99,102,241,0.45)] flex items-center justify-center">
                  <Smile className="w-6 h-6 text-white" />
                </div>
                <h3 className="mt-5 text-2xl font-bold text-slate-900 dark:text-white">{t("how_it_works.kids_title")}</h3>
                <ul className="mt-6 space-y-3">
                  {[t("how_it_works.kids_1"), t("how_it_works.kids_2"), t("how_it_works.kids_3")].map((it, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                      <CheckCircle2 className="w-5 h-5 text-indigo-500 shrink-0" /> {it}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal variant="right" delay={60}>
              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1426] h-full p-8 lg:p-10">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 shadow-[0_8px_20px_-6px_rgba(79,70,229,0.45)] flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6 text-white" />
                </div>
                <span className="corp-eyebrow mt-5 block">{t("how_it_works.parents_label")}</span>
                <h3 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{t("how_it_works.parents_title")}</h3>
                <ul className="mt-6 space-y-3">
                  {[t("how_it_works.parents_1"), t("how_it_works.parents_2"), t("how_it_works.parents_3")].map((it, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                      <CheckCircle2 className="w-5 h-5 text-indigo-500 shrink-0" /> {it}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="relative py-20 sm:py-28 bg-white dark:bg-[#070b14]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Reveal>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">{t("how_it_works.cta_title")}</h2>
            <p className="mt-4 text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl mx-auto">{t("how_it_works.cta_subtitle")}</p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/onboarding"
                className="corp-btn-primary inline-flex items-center justify-center gap-2 text-base font-semibold rounded-xl px-8 py-3.5"
              >
                {t("how_it_works.cta_button")}
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/faq"
                className="inline-flex items-center justify-center gap-2 text-base font-semibold rounded-xl px-8 py-3.5 border border-slate-300 dark:border-white/15 text-slate-700 dark:text-slate-200 hover:border-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors duration-150"
              >
                {t("how_it_works.cta_secondary")}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </LandingLayout>
  );
}
