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

  // Brand-intentional palette — NOT the generic AI indigo/violet
  const steps = [
    {
      icon: UserPlus,
      kicker: t("how_it_works.s1_kicker"),
      title: t("how_it_works.s1_title"),
      desc: t("how_it_works.s1_desc"),
      // Jade: growth, onboarding, fresh starts
      iconBg: "bg-[#1a9e7a]",
      iconShadow: "shadow-[0_8px_20px_-6px_rgba(26,158,122,0.45)]",
      accentText: "text-[#0d7a5f] dark:text-[#34d399]",
      nodeBorder: "border-[#1a9e7a]/40 dark:border-[#1a9e7a]/50",
      nodeText: "text-[#0d7a5f] dark:text-[#34d399]",
    },
    {
      icon: Gamepad2,
      kicker: t("how_it_works.s2_kicker"),
      title: t("how_it_works.s2_title"),
      desc: t("how_it_works.s2_desc"),
      // Amber: knowledge, coins, learning rewards
      iconBg: "bg-[#f6a821]",
      iconShadow: "shadow-[0_8px_20px_-6px_rgba(246,168,33,0.45)]",
      accentText: "text-[#c47808] dark:text-[#fcd34d]",
      nodeBorder: "border-[#f6a821]/40 dark:border-[#f6a821]/50",
      nodeText: "text-[#c47808] dark:text-[#fcd34d]",
    },
    {
      icon: Bot,
      kicker: t("how_it_works.s3_kicker"),
      title: t("how_it_works.s3_title"),
      desc: t("how_it_works.s3_desc"),
      // Sapphire: technology, trust, intelligence
      iconBg: "bg-[#2563eb]",
      iconShadow: "shadow-[0_8px_20px_-6px_rgba(37,99,235,0.40)]",
      accentText: "text-[#1e4dc4] dark:text-[#93c5fd]",
      nodeBorder: "border-[#2563eb]/35 dark:border-[#2563eb]/50",
      nodeText: "text-[#1e4dc4] dark:text-[#93c5fd]",
    },
    {
      icon: LineChart,
      kicker: t("how_it_works.s4_kicker"),
      title: t("how_it_works.s4_title"),
      desc: t("how_it_works.s4_desc"),
      // Coral: achievement, streak, celebration
      iconBg: "bg-[#fb6f6f]",
      iconShadow: "shadow-[0_8px_20px_-6px_rgba(251,111,111,0.40)]",
      accentText: "text-[#d23f51] dark:text-[#fca5a5]",
      nodeBorder: "border-[#fb6f6f]/35 dark:border-[#fb6f6f]/50",
      nodeText: "text-[#d23f51] dark:text-[#fca5a5]",
    },
  ];

  return (
    <LandingLayout>
      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden bg-white dark:bg-[#070b14]">
        <div className="absolute inset-0 corp-grid-bg pointer-events-none" />
        {/* Warm amber glow — on-brand, not generic indigo */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[40rem] h-[40rem] rounded-full bg-amber-400/8 dark:bg-amber-500/8 blur-[140px] pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 lg:pt-44 pb-20 text-center">
          {/* Badge — amber/warm brand color */}
          <Reveal as="span" className="inline-flex items-center gap-2 rounded-full border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
            <Sparkles className="w-3.5 h-3.5" /> {t("how_it_works.hero_badge")}
          </Reveal>
          <Reveal delay={80}>
            <h1 className="mt-6 text-4xl sm:text-5xl font-bold leading-[1.1] text-slate-900 dark:text-white">
              {t("how_it_works.hero_title_1")}{" "}
              {/* Solid accent color — no gradient text (Impeccable rule) */}
              <span className="text-[#1a9e7a] dark:text-[#34d399]">{t("how_it_works.hero_title_grad")}</span>
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
            {/* Vertical connector — warm neutral, not indigo */}
            <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-amber-200/80 via-slate-200 to-transparent dark:from-amber-500/20 dark:via-white/8 -translate-x-1/2" />

            <div className="space-y-10 md:space-y-16">
              {steps.map((step, i) => (
                <Reveal key={i} variant={i % 2 === 0 ? "left" : "right"}>
                  <div className={`md:flex items-center gap-8 ${i % 2 === 1 ? "md:flex-row-reverse" : ""}`}>
                    <div className="md:w-1/2">
                      <div className="corp-card p-8 group transition-all duration-300 hover:-translate-y-1">
                        <div className={`w-12 h-12 rounded-2xl ${step.iconBg} ${step.iconShadow} flex items-center justify-center transition-transform duration-300 group-hover:scale-110`}>
                          <step.icon className="w-6 h-6 text-white" />
                        </div>
                        <p className={`mt-5 text-xs font-semibold uppercase tracking-wider ${step.accentText}`}>{step.kicker}</p>
                        <h3 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{step.title}</h3>
                        <p className="mt-2 text-slate-600 dark:text-slate-400 leading-relaxed">{step.desc}</p>
                      </div>
                    </div>
                    {/* Center node — per-step color */}
                    <div className={`hidden md:flex w-12 h-12 shrink-0 rounded-full bg-white dark:bg-[#0d1426] border-2 ${step.nodeBorder} items-center justify-center font-bold ${step.nodeText} z-10 transition-all duration-300`}>
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
              <div className="corp-card h-full p-8 lg:p-10 group transition-all duration-300 hover:-translate-y-1">
                {/* Amber — kids / fun / play */}
                <div className="w-12 h-12 rounded-2xl bg-[#f6a821] shadow-[0_8px_20px_-6px_rgba(246,168,33,0.45)] flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                  <Smile className="w-6 h-6 text-white" />
                </div>
                <span className="corp-eyebrow mt-5 block">{t("how_it_works.kids_label")}</span>
                <h3 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{t("how_it_works.kids_title")}</h3>
                <ul className="mt-6 space-y-3">
                  {[t("how_it_works.kids_1"), t("how_it_works.kids_2"), t("how_it_works.kids_3")].map((it, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                      <CheckCircle2 className="w-5 h-5 text-[#f6a821] shrink-0" /> {it}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            <Reveal variant="right" delay={100}>
              <div className="corp-card h-full p-8 lg:p-10 group transition-all duration-300 hover:-translate-y-1">
                {/* Jade — parents / safety / growth */}
                <div className="w-12 h-12 rounded-2xl bg-[#1a9e7a] shadow-[0_8px_20px_-6px_rgba(26,158,122,0.45)] flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                  <ShieldCheck className="w-6 h-6 text-white" />
                </div>
                <span className="corp-eyebrow mt-5 block">{t("how_it_works.parents_label")}</span>
                <h3 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{t("how_it_works.parents_title")}</h3>
                <ul className="mt-6 space-y-3">
                  {[t("how_it_works.parents_1"), t("how_it_works.parents_2"), t("how_it_works.parents_3")].map((it, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                      <CheckCircle2 className="w-5 h-5 text-[#1a9e7a] shrink-0" /> {it}
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
            {/* Flat dark — no AI indigo gradient (Impeccable rule) */}
            <div className="relative overflow-hidden rounded-3xl bg-slate-900 px-6 sm:px-12 py-16 text-center">
              <div className="absolute inset-0 corp-grid-bg opacity-20 pointer-events-none" />
              {/* Subtle jade glow — brand, not generic */}
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-[#1a9e7a]/15 blur-[80px] pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-amber-500/12 blur-[80px] pointer-events-none" />
              <div className="relative z-10">
                <h2 className="text-3xl md:text-4xl font-bold text-white">{t("how_it_works.cta_title")}</h2>
                <p className="mt-4 text-white/70 max-w-xl mx-auto leading-relaxed">{t("how_it_works.cta_subtitle")}</p>
                <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
                  <Link
                    to="/onboarding"
                    className="inline-flex items-center justify-center gap-2 text-base font-semibold rounded-xl px-8 py-3.5 bg-[#f6a821] text-slate-900 hover:bg-[#e8880a] transition-colors shadow-[0_8px_20px_-6px_rgba(246,168,33,0.5)]"
                  >
                    {t("how_it_works.cta_button")}
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                  <Link
                    to="/faq"
                    className="inline-flex items-center justify-center gap-2 text-base font-semibold rounded-xl px-8 py-3.5 border border-white/20 text-white hover:bg-white/8 transition-colors"
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
