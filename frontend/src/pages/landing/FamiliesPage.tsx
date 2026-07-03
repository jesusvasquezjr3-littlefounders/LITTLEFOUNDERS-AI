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
    { icon: Coins, title: t("families.marketplace.item_1_title"), desc: t("families.marketplace.item_1_desc"), color: "text-amber-500" },
    { icon: ShoppingBag, title: t("families.marketplace.item_2_title"), desc: t("families.marketplace.item_2_desc"), color: "text-emerald-500" },
    { icon: Gift, title: t("families.marketplace.item_3_title"), desc: t("families.marketplace.item_3_desc"), color: "text-rose-500" },
  ];

  const parentInsights = [
    { icon: TrendingUp, title: t("families.parent_tools.insight_1_title"), desc: t("families.parent_tools.insight_1_desc"), bg: "bg-blue-50", iconColor: "text-blue-600" },
    { icon: Coins, title: t("families.parent_tools.insight_2_title"), desc: t("families.parent_tools.insight_2_desc"), bg: "bg-indigo-50", iconColor: "text-indigo-600" },
    { icon: MessageCircle, title: t("families.parent_tools.insight_3_title"), desc: t("families.parent_tools.insight_3_desc"), bg: "bg-sky-50", iconColor: "text-sky-600" },
    { icon: ShieldCheck, title: t("families.parent_tools.insight_4_title"), desc: t("families.parent_tools.insight_4_desc"), bg: "bg-emerald-50", iconColor: "text-emerald-600" },
    { icon: LayoutDashboard, title: t("families.parent_tools.insight_5_title"), desc: t("families.parent_tools.insight_5_desc"), bg: "bg-violet-50", iconColor: "text-violet-600" },
    { icon: TrendingUp, title: t("families.parent_tools.insight_6_title"), desc: t("families.parent_tools.insight_6_desc"), bg: "bg-orange-50", iconColor: "text-orange-600" },
  ];

  const benefits = [
    { icon: Users, title: t("families.benefits.benefit_1_title"), desc: t("families.benefits.benefit_1_desc") },
    { icon: TrendingUp, title: t("families.benefits.benefit_2_title"), desc: t("families.benefits.benefit_2_desc") },
    { icon: ShieldCheck, title: t("families.benefits.benefit_3_title"), desc: t("families.benefits.benefit_3_desc") },
    { icon: MessageCircle, title: t("families.benefits.benefit_4_title"), desc: t("families.benefits.benefit_4_desc") },
  ];

  const steps = [
    { n: 1, text: t("families.hero.step_1") },
    { n: 2, text: t("families.hero.step_2") },
    { n: 3, text: t("families.hero.step_3") },
  ];

  return (
    <LandingLayout>
      {/* ── HERO (Isla masiva gris claro) ─────────────────────────────── */}
      <Island className="bg-slate-50 dark:bg-[#0a0e1a]">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 pt-12 lg:pt-16 pb-20">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="max-w-xl">
              <Reveal as="span" className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-white/5 border border-slate-200/70 dark:border-white/8 text-xs font-semibold text-slate-800 dark:text-slate-200 mb-6 shadow-sm">
                {t("families.hero.coming_soon_label")}
              </Reveal>

              <Reveal delay={60}>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.05] text-slate-900 dark:text-white">
                  {t("families.hero.title_part1")}{" "}
                  <span className="text-indigo-600 dark:text-indigo-400 block sm:inline">{t("families.hero.title_highlight")}</span>{" "}
                  {t("families.hero.title_part2")}
                </h1>
              </Reveal>

              <Reveal delay={120}>
                <p className="mt-6 text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                  {t("families.hero.subtitle")}
                </p>
              </Reveal>

              <Reveal delay={180}>
                <div className="mt-10 space-y-4">
                  {steps.map((step) => (
                    <div key={step.n} className="flex items-center gap-4 bg-white dark:bg-white/5 rounded-full p-2 pr-6 shadow-sm w-fit border border-slate-100 dark:border-white/5 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:shadow-[0_4px_12px_-4px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_4px_12px_-4px_rgba(0,0,0,0.2)] hover:border-slate-200 dark:hover:border-white/10">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-base font-bold flex items-center justify-center shrink-0">
                        {step.n}
                      </div>
                      <span className="text-base font-medium text-slate-700 dark:text-slate-300">{step.text}</span>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>

            <Reveal variant="scale" delay={100} className="relative w-full aspect-[4/3] rounded-3xl overflow-hidden shadow-[0_8px_30px_-8px_rgba(0,0,0,0.12)] border border-slate-200/60 dark:border-white/5 bg-white flex items-center justify-center">
              <LiquidGlassMedia
                type="image"
                src="/Hero-Families.webp"
                alt="LittleFounders Families"
              />
            </Reveal>
          </div>
        </div>
      </Island>

      {/* ── TASK MANAGER (Fondo blanco, Zig-Zag style) ────────────────── */}
      <section className="py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            <div className="order-2 lg:order-1">
              <Reveal>
                <span className="corp-eyebrow">{t("families.task_manager.badge")}</span>
              </Reveal>
              <Reveal delay={40}>
                <h2 className="mt-3 text-3xl md:text-4xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
                  {t("families.task_manager.title")}
                </h2>
              </Reveal>
              <Reveal delay={60}>
                <p className="mt-4 text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                  {t("families.task_manager.description")}
                </p>
              </Reveal>
              <Reveal delay={120}>
                <ul className="mt-10 space-y-4">
                  {taskManagerFeatures.map((feat, i) => (
                    <li key={i} className="flex items-start gap-3 text-base text-slate-700 dark:text-slate-300">
                      <CheckCircle2 className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" /> 
                      <span className="leading-relaxed">{feat}</span>
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>

            <div className="order-1 lg:order-2 grid sm:grid-cols-2 gap-5">
              {[
                { key: "benefit_1", icon: Coins },
                { key: "benefit_2", icon: TrendingUp },
                { key: "benefit_3", icon: Gift },
                { key: "benefit_4", icon: LayoutDashboard },
              ].map(({ key, icon: Icon }, i) => (
                <Reveal key={key} delay={i * 60}>
                  <div className="bg-white dark:bg-[#0d1426] p-6 rounded-3xl h-full shadow-[0_1px_3px_-1px_rgba(0,0,0,0.04)] border border-slate-100 dark:border-white/5 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.3)] hover:border-slate-200 dark:hover:border-white/10">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center mb-5 border border-slate-100 dark:border-white/5">
                      <Icon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                      {t(`families.task_manager.${key}_title`)}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                      {t(`families.task_manager.${key}_desc`)}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── MARKETPLACE (Isla masiva gris claro) ──────────────────────── */}
      <Island className="bg-slate-50 dark:bg-[#0a0e1a]">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-12 lg:py-16">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <Reveal>
              <span className="corp-eyebrow">{t("families.marketplace.badge")}</span>
            </Reveal>
            <Reveal delay={40}>
              <h2 className="mt-3 text-3xl md:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
                {t("families.marketplace.title")}
              </h2>
            </Reveal>
            <Reveal delay={60}>
              <p className="mt-4 text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                {t("families.marketplace.description")}
              </p>
            </Reveal>
            <Reveal delay={120}>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                {marketplaceFeatures.map((feat, i) => (
                  <span key={i} className="inline-flex items-center gap-2 bg-white dark:bg-white/5 px-4 py-2 rounded-full text-sm font-medium text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-white/5">
                    <CheckCircle2 className="w-4 h-4 text-indigo-500" /> {feat}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {marketplaceItems.map((item, i) => (
              <Reveal key={i} delay={i * 60}>
                <div className="bg-white dark:bg-[#0d1426] rounded-3xl p-8 h-full shadow-[0_1px_3px_-1px_rgba(0,0,0,0.04)] border border-slate-100 dark:border-white/5 text-center flex flex-col items-center transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.3)] hover:border-slate-200 dark:hover:border-white/10">
                  <div className={`w-16 h-16 rounded-2xl bg-slate-50 dark:bg-white/5 flex items-center justify-center mb-6 border border-slate-100 dark:border-white/5`}>
                    <item.icon className={`w-8 h-8 ${item.color}`} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{item.title}</h3>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Island>

      {/* ── PARENT TOOLS (Fondo blanco) ───────────────────────────────── */}
      <section className="py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-14">
            <Reveal>
              <span className="corp-eyebrow">{t("families.parent_tools.badge")}</span>
            </Reveal>
            <Reveal delay={40}>
              <h2 className="mt-3 text-3xl md:text-4xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
                {t("families.parent_tools.title")}
              </h2>
            </Reveal>
            <Reveal delay={60}>
              <p className="mt-4 text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                {t("families.parent_tools.description")}
              </p>
            </Reveal>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
            {parentInsights.map((insight, i) => (
              <Reveal key={i} delay={(i % 3) * 60}>
                <div className="flex flex-col items-center text-center group">
                  <div className={`w-20 h-20 rounded-3xl ${insight.bg} dark:bg-white/5 flex items-center justify-center mb-5 border border-slate-200/50 dark:border-white/5 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105 group-hover:shadow-[0_4px_12px_-4px_rgba(0,0,0,0.06)] dark:group-hover:shadow-[0_4px_12px_-4px_rgba(0,0,0,0.2)]`}>
                    <insight.icon className={`w-9 h-9 ${insight.iconColor}`} strokeWidth={1.25} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{insight.title}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{insight.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── BENEFITS (Isla masiva gris claro) ─────────────────────────── */}
      <Island className="bg-slate-50 dark:bg-[#0a0e1a] mb-12">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-12 lg:py-16">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <Reveal>
              <span className="corp-eyebrow">{t("families.benefits.badge")}</span>
            </Reveal>
            <Reveal delay={40}>
              <h2 className="mt-3 text-3xl md:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
                {t("families.benefits.title")}
              </h2>
            </Reveal>
            <Reveal delay={60}>
              <p className="mt-4 text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                {t("families.benefits.description")}
              </p>
            </Reveal>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {benefits.map((benefit, i) => (
              <Reveal key={i} variant={i % 2 === 0 ? "left" : "right"} delay={i * 60}>
                <div className="bg-white dark:bg-[#0d1426] rounded-3xl p-8 h-full shadow-[0_1px_3px_-1px_rgba(0,0,0,0.04)] border border-slate-100 dark:border-white/5 flex items-start gap-5 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.3)] hover:border-slate-200 dark:hover:border-white/10">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-white/5 flex items-center justify-center shrink-0 border border-slate-100 dark:border-white/5">
                    <benefit.icon className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{benefit.title}</h3>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{benefit.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Island>

      </LandingLayout>
  );
}
