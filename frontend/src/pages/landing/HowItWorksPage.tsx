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
    { icon: UserPlus, kicker: t("how_it_works.s1_kicker"), title: t("how_it_works.s1_title"), desc: t("how_it_works.s1_desc"), color: "from-indigo-500 to-blue-500" },
    { icon: Gamepad2, kicker: t("how_it_works.s2_kicker"), title: t("how_it_works.s2_title"), desc: t("how_it_works.s2_desc"), color: "from-violet-500 to-fuchsia-500" },
    { icon: Bot, kicker: t("how_it_works.s3_kicker"), title: t("how_it_works.s3_title"), desc: t("how_it_works.s3_desc"), color: "from-sky-500 to-cyan-500" },
    { icon: LineChart, kicker: t("how_it_works.s4_kicker"), title: t("how_it_works.s4_title"), desc: t("how_it_works.s4_desc"), color: "from-emerald-500 to-teal-500" },
  ];

  return (
    <LandingLayout>
      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden bg-gradient-to-b from-indigo-50/80 via-white to-white dark:from-[#0b1124] dark:via-[#070b14] dark:to-[#070b14]">
        <div className="absolute inset-0 corp-grid-bg pointer-events-none" />
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[40rem] h-[40rem] rounded-full bg-indigo-400/12 dark:bg-indigo-600/12 blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 lg:pt-44 pb-20 text-center">
          <Reveal as="span" className="inline-flex items-center gap-2 rounded-full border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
            <Sparkles className="w-3.5 h-3.5" /> {t("how_it_works.hero_badge")}
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mt-6 text-4xl sm:text-5xl font-bold leading-[1.1] text-slate-900 dark:text-white">
              {t("how_it_works.hero_title_1")}{" "}
              <span className="corp-gradient-text">{t("how_it_works.hero_title_grad")}</span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mt-6 text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl mx-auto">
              {t("how_it_works.hero_subtitle")}
            </p>
          </Reveal>
          <Reveal delay={240}>
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

      {/* ── STEPS ─────────────────────────────────────────────────────────── */}
      <section className="relative py-24 bg-white dark:bg-[#070b14]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <Reveal as="span" className="corp-eyebrow">{t("how_it_works.steps_eyebrow")}</Reveal>
            <Reveal delay={80}>
              <h2 className="mt-3 text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                {t("how_it_works.steps_title")}
              </h2>
            </Reveal>
          </div>

          <div className="mt-16 relative">
            {/* Vertical connector line */}
            <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-indigo-200 via-slate-200 to-transparent dark:from-indigo-500/30 dark:via-white/10 -translate-x-1/2" />

            <div className="space-y-10 md:space-y-16">
              {steps.map((step, i) => (
                <Reveal key={i} variant={i % 2 === 0 ? "left" : "right"}>
                  <div className={`md:flex items-center gap-8 ${i % 2 === 1 ? "md:flex-row-reverse" : ""}`}>
                    <div className="md:w-1/2">
                      <div className="corp-card p-8">
                        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-lg`}>
                          <step.icon className="w-6 h-6 text-white" />
                        </div>
                        <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-indigo-500 dark:text-indigo-400">{step.kicker}</p>
                        <h3 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{step.title}</h3>
                        <p className="mt-2 text-slate-600 dark:text-slate-400 leading-relaxed">{step.desc}</p>
                      </div>
                    </div>
                    {/* Center node */}
                    <div className="hidden md:flex w-12 h-12 shrink-0 rounded-full bg-white dark:bg-[#0d1426] border-2 border-indigo-200 dark:border-indigo-500/40 items-center justify-center font-bold text-indigo-600 dark:text-indigo-300 z-10">
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

      {/* ── EXPERIENCE FOR EVERYONE ───────────────────────────────────────── */}
      <section className="relative py-24 bg-slate-50 dark:bg-[#0a0e1a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <Reveal as="span" className="corp-eyebrow">{t("how_it_works.experience_eyebrow")}</Reveal>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <Reveal variant="left">
              <div className="corp-card h-full p-8 lg:p-10">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg">
                  <Smile className="w-6 h-6 text-white" />
                </div>
                <span className="corp-eyebrow mt-5 block">{t("how_it_works.kids_label")}</span>
                <h3 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{t("how_it_works.kids_title")}</h3>
                <ul className="mt-6 space-y-3">
                  {[t("how_it_works.kids_1"), t("how_it_works.kids_2"), t("how_it_works.kids_3")].map((it, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                      <CheckCircle2 className="w-5 h-5 text-violet-500 shrink-0" /> {it}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal variant="right" delay={100}>
              <div className="corp-card h-full p-8 lg:p-10">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg">
                  <ShieldCheck className="w-6 h-6 text-white" />
                </div>
                <span className="corp-eyebrow mt-5 block">{t("how_it_works.parents_label")}</span>
                <h3 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{t("how_it_works.parents_title")}</h3>
                <ul className="mt-6 space-y-3">
                  {[t("how_it_works.parents_1"), t("how_it_works.parents_2"), t("how_it_works.parents_3")].map((it, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" /> {it}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="relative py-24 bg-white dark:bg-[#070b14]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl bg-slate-900 dark:bg-gradient-to-br dark:from-indigo-900 dark:to-blue-950 px-6 sm:px-12 py-16 text-center">
              <div className="absolute inset-0 corp-grid-bg opacity-30 pointer-events-none" />
              <div className="relative z-10">
                <h2 className="text-3xl md:text-4xl font-bold text-white">{t("how_it_works.cta_title")}</h2>
                <p className="mt-4 text-white/70 max-w-xl mx-auto leading-relaxed">{t("how_it_works.cta_subtitle")}</p>
                <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
                  <Link
                    to="/onboarding"
                    className="inline-flex items-center justify-center gap-2 text-base font-semibold rounded-xl px-8 py-3.5 bg-white text-indigo-700 hover:bg-indigo-50 transition-colors shadow-lg"
                  >
                    {t("how_it_works.cta_button")}
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                  <Link
                    to="/faq"
                    className="inline-flex items-center justify-center gap-2 text-base font-semibold rounded-xl px-8 py-3.5 border border-white/25 text-white hover:bg-white/10 transition-colors"
                  >
                    {t("how_it_works.cta_secondary")}
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </LandingLayout>
  );
}
