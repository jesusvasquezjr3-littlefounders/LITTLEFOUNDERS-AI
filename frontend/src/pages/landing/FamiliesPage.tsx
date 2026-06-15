import { useTranslation } from "react-i18next";
import { LandingLayout } from "@/components/landing/LandingLayout";
import { Reveal } from "@/components/landing/Reveal";
import { LiquidGlassMedia } from "@/components/landing/LiquidGlassMedia";
import { EmailWaitlistForm } from "@/components/landing/EmailWaitlistForm";
import {
  Sparkles,
  CheckCircle2,
  Clock,
  Coins,
  Gift,
  LayoutDashboard,
  ShoppingBag,
  Users,
  ShieldCheck,
  TrendingUp,
  MessageCircle,
  Star,
} from "lucide-react";

/* ─── PAGE ────────────────────────────────────────────────────────────────── */
export default function FamiliesPage() {
  const { t, i18n } = useTranslation("landing");
  const lang = i18n.language;

  const taskManagerFeatures = [
    t("families.task_manager.feature_1"),
    t("families.task_manager.feature_2"),
    t("families.task_manager.feature_3"),
    t("families.task_manager.feature_4"),
  ];

  const marketplaceFeatures = [
    t("families.marketplace.feature_1"),
    t("families.marketplace.feature_2"),
    t("families.marketplace.feature_3"),
  ];

  const marketplaceItems = [
    { icon: Coins, title: t("families.marketplace.item_1_title"), desc: t("families.marketplace.item_1_desc"), color: "from-amber-500 to-orange-500" },
    { icon: ShoppingBag, title: t("families.marketplace.item_2_title"), desc: t("families.marketplace.item_2_desc"), color: "from-indigo-500 to-blue-500" },
    { icon: Gift, title: t("families.marketplace.item_3_title"), desc: t("families.marketplace.item_3_desc"), color: "from-emerald-500 to-teal-500" },
  ];

  const parentInsights = [
    { icon: TrendingUp, color: "from-indigo-500 to-blue-500", title: t("families.parent_tools.insight_1_title"), desc: t("families.parent_tools.insight_1_desc") },
    { icon: Coins, color: "from-amber-500 to-orange-500", title: t("families.parent_tools.insight_2_title"), desc: t("families.parent_tools.insight_2_desc") },
    { icon: MessageCircle, color: "from-indigo-500 to-sky-500", title: t("families.parent_tools.insight_3_title"), desc: t("families.parent_tools.insight_3_desc") },
    { icon: ShieldCheck, color: "from-emerald-500 to-teal-500", title: t("families.parent_tools.insight_4_title"), desc: t("families.parent_tools.insight_4_desc") },
    { icon: LayoutDashboard, color: "from-sky-500 to-cyan-500", title: t("families.parent_tools.insight_5_title"), desc: t("families.parent_tools.insight_5_desc") },
    { icon: Star, color: "from-indigo-500 to-blue-500", title: t("families.parent_tools.insight_6_title"), desc: t("families.parent_tools.insight_6_desc") },
  ];

  const benefits = [
    { icon: Users, color: "from-indigo-500 to-sky-500", title: t("families.benefits.benefit_1_title"), desc: t("families.benefits.benefit_1_desc") },
    { icon: TrendingUp, color: "from-indigo-500 to-blue-500", title: t("families.benefits.benefit_2_title"), desc: t("families.benefits.benefit_2_desc") },
    { icon: ShieldCheck, color: "from-emerald-500 to-teal-500", title: t("families.benefits.benefit_3_title"), desc: t("families.benefits.benefit_3_desc") },
    { icon: MessageCircle, color: "from-amber-500 to-orange-500", title: t("families.benefits.benefit_4_title"), desc: t("families.benefits.benefit_4_desc") },
  ];

  const steps = [
    { n: 1, text: t("families.hero.step_1") },
    { n: 2, text: t("families.hero.step_2") },
    { n: 3, text: t("families.hero.step_3") },
  ];

  return (
    <LandingLayout>

      {/* ══════════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════════ */}
      <header className="relative overflow-hidden bg-gradient-to-b from-indigo-50/80 via-white to-white dark:from-[#0b1124] dark:via-[#070b14] dark:to-[#070b14]">
        <div className="absolute inset-0 corp-grid-bg pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-[36rem] h-[36rem] rounded-full bg-indigo-400/15 dark:bg-indigo-600/15 blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 -left-32 w-[32rem] h-[32rem] rounded-full bg-sky-400/10 dark:bg-sky-700/10 blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 lg:pt-40 pb-20">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

            {/* Copy */}
            <div>
              <Reveal as="span" className="inline-flex items-center gap-2 rounded-full border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                <Clock className="w-3.5 h-3.5" /> {t("families.hero.coming_soon_label")}
              </Reveal>

              <Reveal delay={80}>
                <h1 className="mt-6 text-4xl sm:text-5xl lg:text-[3.2rem] font-bold leading-[1.1] text-slate-900 dark:text-white">
                  {t("families.hero.title_part1")}{" "}
                  <span className="corp-gradient-text">{t("families.hero.title_highlight")}</span>{" "}
                  {t("families.hero.title_part2")}
                </h1>
              </Reveal>

              <Reveal delay={160}>
                <p className="mt-6 text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                  {t("families.hero.subtitle")}
                </p>
              </Reveal>

              {/* Steps */}
              <Reveal delay={240}>
                <div className="mt-8 space-y-3">
                  {steps.map((step) => (
                    <div key={step.n} className="corp-card flex items-center gap-4 px-5 py-3.5">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white text-sm font-bold flex items-center justify-center shrink-0 shadow-md">
                        {step.n}
                      </div>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{step.text}</span>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>

            {/* Media */}
            <Reveal variant="scale" delay={120} className="relative z-10">
              <LiquidGlassMedia
                type="image"
                src="/Hero-Families.png"
                alt="LittleFounders Families"
                delay="0.5s"
              />
            </Reveal>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════
          TASK MANAGER
      ══════════════════════════════════════════════════════════ */}
      <section className="relative py-24 bg-white dark:bg-[#070b14]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            <div>
              <Reveal as="span" className="corp-eyebrow">{t("families.task_manager.badge")}</Reveal>
              <Reveal delay={80}>
                <h2 className="mt-3 text-3xl md:text-4xl font-bold text-slate-900 dark:text-white leading-tight">
                  {t("families.task_manager.title")}
                </h2>
              </Reveal>
              <Reveal delay={140}>
                <p className="mt-4 text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                  {t("families.task_manager.description")}
                </p>
              </Reveal>
              <Reveal delay={200}>
                <ul className="mt-6 space-y-3">
                  {taskManagerFeatures.map((feat, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                      <CheckCircle2 className="w-5 h-5 text-indigo-500 shrink-0" /> {feat}
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              {[
                { key: "benefit_1", color: "from-amber-500 to-orange-500", icon: Coins },
                { key: "benefit_2", color: "from-indigo-500 to-blue-500", icon: TrendingUp },
                { key: "benefit_3", color: "from-indigo-500 to-blue-500", icon: Gift },
                { key: "benefit_4", color: "from-emerald-500 to-teal-500", icon: LayoutDashboard },
              ].map(({ key, color, icon: Icon }, i) => (
                <Reveal key={key} delay={i * 80}>
                  <div className="corp-card p-6 h-full">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-md`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
                      {t(`families.task_manager.${key}_title`)}
                    </h3>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {t(`families.task_manager.${key}_desc`)}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          MARKETPLACE
      ══════════════════════════════════════════════════════════ */}
      <section className="relative py-24 bg-slate-50 dark:bg-[#0a0e1a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <Reveal as="span" className="corp-eyebrow">{t("families.marketplace.badge")}</Reveal>
            <Reveal delay={80}>
              <h2 className="mt-3 text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                {t("families.marketplace.title")}
              </h2>
            </Reveal>
            <Reveal delay={140}>
              <p className="mt-4 text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                {t("families.marketplace.description")}
              </p>
            </Reveal>
            <Reveal delay={200}>
              <ul className="mt-5 flex flex-col items-center gap-2">
                {marketplaceFeatures.map((feat, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> {feat}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          <div className="mt-14 grid md:grid-cols-3 gap-6">
            {marketplaceItems.map((item, i) => (
              <Reveal key={i} delay={i * 90}>
                <div className="corp-card h-full p-8">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-lg`}>
                    <item.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="mt-6 text-lg font-bold text-slate-900 dark:text-white">{item.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          PARENT TOOLS
      ══════════════════════════════════════════════════════════ */}
      <section className="relative py-24 bg-white dark:bg-[#070b14]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <Reveal as="span" className="corp-eyebrow">{t("families.parent_tools.badge")}</Reveal>
            <Reveal delay={80}>
              <h2 className="mt-3 text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                {t("families.parent_tools.title")}
              </h2>
            </Reveal>
            <Reveal delay={140}>
              <p className="mt-4 text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                {t("families.parent_tools.description")}
              </p>
            </Reveal>
          </div>

          <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {parentInsights.map((insight, i) => (
              <Reveal key={i} delay={(i % 3) * 90}>
                <div className="corp-card h-full p-7">
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${insight.color} flex items-center justify-center shadow-md`}>
                    <insight.icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="mt-5 text-base font-bold text-slate-900 dark:text-white">{insight.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{insight.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          BENEFITS
      ══════════════════════════════════════════════════════════ */}
      <section className="relative py-24 bg-slate-50 dark:bg-[#0a0e1a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <Reveal as="span" className="corp-eyebrow">{t("families.benefits.badge")}</Reveal>
            <Reveal delay={80}>
              <h2 className="mt-3 text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">
                {t("families.benefits.title")}
              </h2>
            </Reveal>
            <Reveal delay={140}>
              <p className="mt-4 text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                {t("families.benefits.description")}
              </p>
            </Reveal>
          </div>

          <div className="mt-14 grid md:grid-cols-2 gap-6">
            {benefits.map((benefit, i) => (
              <Reveal key={i} variant={i % 2 === 0 ? "left" : "right"} delay={i * 80}>
                <div className="corp-card h-full p-8 flex gap-5">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${benefit.color} flex items-center justify-center shadow-lg shrink-0`}>
                    <benefit.icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{benefit.title}</h3>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{benefit.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          {/* Testimonial */}
          <Reveal delay={200} className="mt-10">
            <figure className="corp-card max-w-xl mx-auto p-8 text-center">
              <div className="flex justify-center gap-1 text-amber-400 mb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-current" />
                ))}
              </div>
              <blockquote className="text-slate-700 dark:text-slate-300 leading-relaxed italic">
                "{t("families.benefits.testimonial_text")}"
              </blockquote>
              <figcaption className="mt-4 text-sm font-semibold text-slate-900 dark:text-white">
                {t("families.benefits.testimonial_author")}
              </figcaption>
            </figure>
          </Reveal>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          CTA — WAITLIST
      ══════════════════════════════════════════════════════════ */}
      <section className="relative py-24 bg-white dark:bg-[#070b14]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl bg-slate-900 dark:bg-gradient-to-br dark:from-indigo-900 dark:to-blue-950 px-6 sm:px-12 py-16 text-center">
              <div className="absolute inset-0 corp-grid-bg opacity-30 pointer-events-none" />
              <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[30rem] h-[30rem] rounded-full bg-indigo-500/20 blur-[100px] pointer-events-none" />
              <div className="relative z-10">
                <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/70 mb-4">
                  <Sparkles className="w-4 h-4" /> {t("families.hero.coming_soon_label")}
                </span>
                <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight max-w-2xl mx-auto">
                  {t("families.cta.title")}
                </h2>
                <p className="mt-4 text-white/70 max-w-xl mx-auto leading-relaxed">
                  {t("families.hero.notify_desc")}
                </p>
                <div className="mt-8 flex justify-center">
                  <EmailWaitlistForm
                    ctaLabel={t("families.hero.notify_cta")}
                    placeholder={t("families.hero.email_placeholder")}
                    successMsg={t("families.hero.email_success")}
                    language={lang}
                    source="families_page"
                  />
                </div>
                <p className="mt-5 text-sm text-white/40">{t("families.cta.disclaimer")}</p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-6">
                  {[t("families.cta.trust_1"), t("families.cta.trust_2"), t("families.cta.trust_3")].map((trust, i) => (
                    <span key={i} className="inline-flex items-center gap-2 text-xs font-semibold text-white/60">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" /> {trust}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

    </LandingLayout>
  );
}
