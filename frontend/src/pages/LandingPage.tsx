import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { hasSession } from "@/lib/guestProfile";
import { Reveal } from "@/components/landing/Reveal";
import { LiquidGlassMedia } from "@/components/landing/LiquidGlassMedia";
import { LandingLayout } from "@/components/landing/LandingLayout";
import {
  ArrowRight,
  ShieldCheck,
  Globe,
  Sparkles,
  BookOpen,
  Gamepad2,
  Bot,
  LayoutDashboard,
  Trophy,
  Lock,
  Languages,
  LineChart,
  MonitorSmartphone,
  GraduationCap,
  PlayCircle,
  Star,
} from "lucide-react";

function SectionHeading({
  title,
  subtitle,
  center = true,
}: {
  title: React.ReactNode;
  subtitle?: string;
  center?: boolean;
}) {
  return (
    <div className={`max-w-2xl ${center ? "mx-auto text-center" : ""}`}>
      <Reveal>
        <h2 className="text-2xl md:text-2xl lg:text-xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
          {title}
        </h2>
      </Reveal>
      {subtitle && (
        <Reveal delay={60}>
          <p className="mt-5 text-base md:text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
            {subtitle}
          </p>
        </Reveal>
      )}
    </div>
  );
}

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

const LandingPage = () => {
  const { t } = useTranslation("landing");
  const session = hasSession();
  const startTo = session ? "/learn" : "/onboarding";

  const trustItems = [
    { icon: Lock, label: t("corp.trust.item_1") },
    { icon: ShieldCheck, label: t("corp.trust.item_2") },
    { icon: Sparkles, label: t("corp.trust.item_3") },
    { icon: Globe, label: t("corp.trust.item_4") },
  ];

  const pillars = [
    { icon: GraduationCap, title: t("corp.pillars.p1_title"), desc: t("corp.pillars.p1_desc"), color: "text-indigo-600" },
    { icon: ShieldCheck, title: t("corp.pillars.p2_title"), desc: t("corp.pillars.p2_desc"), color: "text-blue-600" },
    { icon: LayoutDashboard, title: t("corp.pillars.p3_title"), desc: t("corp.pillars.p3_desc"), color: "text-sky-600" },
  ];

  const showcaseItems = [
    { icon: BookOpen, title: t("corp.showcase.b1_title"), desc: t("corp.showcase.b1_desc"), bg: "bg-indigo-50 dark:bg-indigo-500/10", iconColor: "text-indigo-600" },
    { icon: Bot, title: t("corp.showcase.b2_title"), desc: t("corp.showcase.b2_desc"), bg: "bg-emerald-50 dark:bg-emerald-500/10", iconColor: "text-emerald-600" },
    { icon: Gamepad2, title: t("corp.showcase.b3_title"), desc: t("corp.showcase.b3_desc"), bg: "bg-orange-50 dark:bg-orange-500/10", iconColor: "text-orange-600" },
    { icon: LayoutDashboard, title: t("corp.showcase.b4_title"), desc: t("corp.showcase.b4_desc"), bg: "bg-blue-50 dark:bg-blue-500/10", iconColor: "text-blue-600" },
  ];

  const features = [
    { icon: BookOpen, title: t("corp.features.f1_title"), desc: t("corp.features.f1_desc") },
    { icon: Trophy, title: t("corp.features.f2_title"), desc: t("corp.features.f2_desc") },
    { icon: Lock, title: t("corp.features.f3_title"), desc: t("corp.features.f3_desc") },
    { icon: Languages, title: t("corp.features.f4_title"), desc: t("corp.features.f4_desc") },
    { icon: LineChart, title: t("corp.features.f5_title"), desc: t("corp.features.f5_desc") },
    { icon: MonitorSmartphone, title: t("corp.features.f6_title"), desc: t("corp.features.f6_desc") },
  ];

  const testimonials = [
    { quote: t("corp.testimonials.q1"), author: t("corp.testimonials.r1") },
    { quote: t("corp.testimonials.q2"), author: t("corp.testimonials.r2") },
    { quote: t("corp.testimonials.q3"), author: t("corp.testimonials.r3") },
  ];

  return (
    <LandingLayout>
      {/* ── HERO (Isla masiva gris claro) ─────────────────────────────── */}
      <Island className="bg-slate-50 dark:bg-[#0a0e1a]">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 pt-12 lg:pt-16 pb-20">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="max-w-xl">
              <Reveal as="span" className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-800 dark:text-slate-200 mb-6 shadow-sm">
                {t("corp.hero.badge")}
              </Reveal>

              <Reveal delay={60}>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.05] text-slate-900 dark:text-white">
                  {t("corp.hero.title_1")}{" "}
                  <span className="text-indigo-600 dark:text-indigo-400 block sm:inline">{t("corp.hero.title_grad")}</span>{" "}
                  {t("corp.hero.title_2")}
                </h1>
              </Reveal>

              <Reveal delay={120}>
                <p className="mt-6 text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                  {t("corp.hero.subtitle")}
                </p>
              </Reveal>

              <Reveal delay={180}>
                <div className="mt-10 flex flex-col sm:flex-row gap-4">
                  <Link
                    to={startTo}
                    className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-base font-semibold rounded-full px-8 py-4 transition-colors duration-200 shadow-[0_4px_14px_0_rgb(79,70,229,0.39)]"
                  >
                    {session ? t("corp.hero.cta_resume") : t("corp.hero.cta_primary")}
                  </Link>
                  <Link
                    to="/how-it-works"
                    className="inline-flex items-center justify-center gap-2 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 text-base font-semibold rounded-full px-8 py-4 transition-colors duration-200 shadow-sm"
                  >
                    <PlayCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    {t("corp.hero.cta_secondary")}
                  </Link>
                </div>
              </Reveal>
            </div>

            <Reveal variant="scale" delay={100} className="relative w-full aspect-[4/3] rounded-3xl overflow-hidden shadow-xl">
               <LiquidGlassMedia
                  type="video"
                  src="/video/8747232-sd_960_540_25fps.mp4"
                />
            </Reveal>
          </div>
        </div>
      </Island>

      {/* ── STATS / TRUST (Pastillas flotantes en fondo blanco) ───────── */}
      <section className="max-w-[85rem] mx-auto px-4 sm:px-6 lg:px-8 -mt-2 relative z-10 mb-12">
        <div className="flex flex-wrap justify-center gap-4">
          {[
            { value: t("corp.stats.lessons_value"), label: t("corp.stats.lessons_label") },
            { value: t("corp.stats.games_value"), label: t("corp.stats.games_label") },
            { value: t("corp.stats.minutes_value"), label: t("corp.stats.minutes_label") },
          ].map((stat, i) => (
            <Reveal key={i} delay={i * 60}>
              <div className="bg-white dark:bg-[#0d1426] border border-slate-100 dark:border-white/10 rounded-full px-8 py-4 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.1)] flex items-center gap-3">
                <span className="text-xl sm:text-xl font-bold text-slate-900 dark:text-white">{stat.value}</span>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.label}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── SHOWCASE ZIG-ZAG (Fondo blanco de la página) ──────────────── */}
      <section className="py-10 sm:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12">
            <SectionHeading
              title={t("corp.showcase.title")}
              subtitle={t("corp.showcase.subtitle")}
            />
          </div>

          <div className="space-y-16 md:space-y-20">
            {showcaseItems.map((item, i) => (
              <Reveal key={i} variant={i % 2 === 0 ? "left" : "right"} delay={i * 60}>
                <div className={`md:flex items-center gap-12 lg:gap-20 ${i % 2 === 1 ? "md:flex-row-reverse" : ""}`}>
                  {/* Lado de la Imagen/Gráfico (Recuadro pastel) */}
                  <div className="md:w-1/2 mb-10 md:mb-0">
                    <div className={`aspect-square sm:aspect-[4/3] rounded-[2.5rem] ${item.bg} flex items-center justify-center p-6 relative overflow-hidden`}>
                      <item.icon className={`w-32 h-32 ${item.iconColor} opacity-90`} strokeWidth={1.5} />
                    </div>
                  </div>
                  {/* Lado del Texto (Limpio sobre fondo blanco) */}
                  <div className="md:w-1/2">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4 tracking-tight">
                      {item.title}
                    </h3>
                    <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── PILLARS (Isla masiva gris claro) ──────────────────────────── */}
      <Island className="bg-slate-50 dark:bg-[#0a0e1a] my-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 py-12 lg:py-16">
          <SectionHeading
            title={t("corp.pillars.title")}
            subtitle={t("corp.pillars.subtitle")}
          />
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {pillars.map((p, i) => (
              <Reveal key={i} delay={i * 60}>
                <div className="bg-white dark:bg-[#0d1426] rounded-3xl p-6 h-full shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] flex flex-col items-center text-center">
                  <div className={`w-16 h-16 rounded-2xl bg-slate-50 dark:bg-white/5 flex items-center justify-center mb-6`}>
                    <p.icon className={`w-8 h-8 ${p.color}`} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">{p.title}</h3>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{p.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Island>

      {/* ── TESTIMONIALS (Fondo blanco) ───────────────────────────────── */}
      <section className="py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading title={t("corp.testimonials.title")} />
          <div className="mt-16 grid md:grid-cols-3 gap-6">
            {testimonials.map((tst, i) => (
              <Reveal key={i} delay={i * 60}>
                <div className="bg-slate-50 dark:bg-[#0a0e1a] rounded-[2rem] p-6 h-full flex flex-col relative">
                  <div className="absolute top-6 left-8">
                    <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
                  </div>
                  <blockquote className="mt-8 text-slate-800 dark:text-slate-200 leading-relaxed text-lg flex-1 font-medium">
                    "{tst.quote}"
                  </blockquote>
                  <div className="mt-8 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center font-bold text-indigo-700 dark:text-indigo-300">
                      {tst.author.charAt(0)}
                    </div>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {tst.author}
                    </span>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      </LandingLayout>
  );
};

export default LandingPage;
