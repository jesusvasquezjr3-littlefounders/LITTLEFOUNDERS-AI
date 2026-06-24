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
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white leading-tight">
          {title}
        </h2>
      </Reveal>
      {subtitle && (
        <Reveal delay={60}>
          <p className="mt-4 text-base md:text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
            {subtitle}
          </p>
        </Reveal>
      )}
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
    { icon: GraduationCap, title: t("corp.pillars.p1_title"), desc: t("corp.pillars.p1_desc") },
    { icon: ShieldCheck, title: t("corp.pillars.p2_title"), desc: t("corp.pillars.p2_desc") },
    { icon: LayoutDashboard, title: t("corp.pillars.p3_title"), desc: t("corp.pillars.p3_desc") },
  ];

  const showcaseItems = [
    { icon: BookOpen, title: t("corp.showcase.b1_title"), desc: t("corp.showcase.b1_desc") },
    { icon: Bot, title: t("corp.showcase.b2_title"), desc: t("corp.showcase.b2_desc") },
    { icon: Gamepad2, title: t("corp.showcase.b3_title"), desc: t("corp.showcase.b3_desc") },
    { icon: LayoutDashboard, title: t("corp.showcase.b4_title"), desc: t("corp.showcase.b4_desc") },
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

  const securityPoints = [
    t("corp.security.point_1"),
    t("corp.security.point_2"),
    t("corp.security.point_3"),
    t("corp.security.point_4"),
  ];

  return (
    <LandingLayout>
      <header className="relative overflow-hidden bg-gradient-to-b from-indigo-50/80 via-white to-white dark:from-[#0b1124] dark:via-[#070b14] dark:to-[#070b14]">
        <div className="absolute inset-0 corp-grid-bg pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-[36rem] h-[36rem] rounded-full bg-indigo-400/15 dark:bg-indigo-600/10 blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 lg:pt-40 pb-20">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div>
              <Reveal as="span" className="corp-eyebrow">
                <Sparkles className="w-3.5 h-3.5" /> {t("corp.hero.badge")}
              </Reveal>

              <Reveal delay={60}>
                <h1 className="mt-6 text-3xl sm:text-4xl lg:text-[3.5rem] font-bold leading-[1.08] text-slate-900 dark:text-white">
                  {t("corp.hero.title_1")}{" "}
                  <span className="text-indigo-600 dark:text-indigo-400">{t("corp.hero.title_grad")}</span>{" "}
                  {t("corp.hero.title_2")}
                </h1>
              </Reveal>

              <Reveal delay={120}>
                <p className="mt-6 text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                  {t("corp.hero.subtitle")}
                </p>
              </Reveal>

              <Reveal delay={180}>
                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <Link
                    to={startTo}
                    className="corp-btn-primary inline-flex items-center justify-center gap-2 text-base font-semibold rounded-xl px-7 py-3.5"
                  >
                    {session ? t("corp.hero.cta_resume") : t("corp.hero.cta_primary")}
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                  <Link
                    to="/how-it-works"
                    className="text-base font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 active:scale-[0.97] transition-[color,transform] duration-150 inline-flex items-center gap-2 px-7 py-3.5"
                  >
                    <PlayCircle className="w-5 h-5" />
                    {t("corp.hero.cta_secondary")}
                  </Link>
                </div>
              </Reveal>

              <Reveal delay={240}>
                <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">{t("corp.hero.microcopy")}</p>
              </Reveal>
            </div>

            <Reveal variant="scale" delay={100} className="relative z-10">
                <LiquidGlassMedia
                  type="video"
                  src="/video/8747232-sd_960_540_25fps.mp4"
                />
            </Reveal>
          </div>

          <Reveal delay={100} className="mt-20">
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
              {trustItems.map((item, i) => (
                <div key={i} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                  <item.icon className="w-4 h-4 text-indigo-500" />
                  {item.label}
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </header>

      <section className="relative bg-slate-900 dark:bg-[#0a0e1a] py-16">
        <h2 className="sr-only">{t("corp.stats.heading")}</h2>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
            {[
              { value: t("corp.stats.lessons_value"), label: t("corp.stats.lessons_label") },
              { value: t("corp.stats.games_value"), label: t("corp.stats.games_label") },
              { value: t("corp.stats.minutes_value"), label: t("corp.stats.minutes_label") },
              { value: t("corp.stats.safe_value"), label: t("corp.stats.safe_label") },
            ].map((s, i) => (
              <Reveal key={i} delay={i * 60} className="text-center">
                <p className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight">{s.value}</p>
                <p className="mt-2 text-sm font-medium text-slate-400">{s.label}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-20 sm:py-28 bg-white dark:bg-[#070b14]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            title={t("corp.pillars.title")}
            subtitle={t("corp.pillars.subtitle")}
          />
          <div className="mt-14 grid md:grid-cols-3 gap-6">
            {pillars.map((p, i) => (
              <Reveal key={i} delay={i * 60}>
                <div className="corp-card h-full p-8">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 shadow-[0_8px_20px_-6px_rgba(79,70,229,0.45)] flex items-center justify-center">
                    <p.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="mt-6 text-xl font-bold text-slate-900 dark:text-white">{p.title}</h3>
                  <p className="mt-3 text-slate-600 dark:text-slate-400 leading-relaxed">{p.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-16 sm:py-24 bg-slate-50 dark:bg-[#0a0e1a] overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            <Reveal variant="left" className="relative z-10">
                <LiquidGlassMedia
                  type="image"
                  src="https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&w=1100&q=80"
                  alt="Happy kids learning finance together with LittleFounders"
                />
            </Reveal>

            <div>
              <SectionHeading
                title={t("corp.showcase.title")}
                subtitle={t("corp.showcase.subtitle")}
                center={false}
              />
              <div className="mt-8 space-y-5">
                {showcaseItems.map((item, i) => (
                  <Reveal key={i} variant="right" delay={i * 60}>
                    <div className="flex gap-4">
                      <div className="w-11 h-11 shrink-0 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center">
                        <item.icon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">{item.title}</h3>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative py-16 sm:py-24 bg-white dark:bg-[#070b14]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            title={t("corp.features.title")}
            subtitle={t("corp.features.subtitle")}
          />
          <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <Reveal key={i} delay={(i % 3) * 60}>
                <div className="corp-card h-full p-7">
                  <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center">
                    <f.icon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-slate-900 dark:text-white">{f.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-16 sm:py-24 bg-white dark:bg-[#070b14]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading title={t("corp.testimonials.title")} />
          <div className="mt-14 grid md:grid-cols-3 gap-6">
            {testimonials.map((tst, i) => (
              <Reveal key={i} delay={i * 60}>
                <figure className="corp-card h-full p-7 flex flex-col">
                  <blockquote className="text-slate-700 dark:text-slate-300 leading-relaxed flex-1">
                    "{tst.quote}"
                  </blockquote>
                  <figcaption className="mt-5 text-sm font-semibold text-slate-900 dark:text-white">
                    {tst.author}
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-16 sm:py-24 bg-slate-50 dark:bg-[#0a0e1a] overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <SectionHeading
              title={t("corp.security.title")}
              subtitle={t("corp.security.subtitle")}
              center={false}
            />
            <ul className="mt-8 space-y-4">
              {securityPoints.map((p, i) => (
                <Reveal key={i} variant="left" delay={i * 60}>
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </span>
                    <span className="text-slate-700 dark:text-slate-300 leading-relaxed">{p}</span>
                  </li>
                </Reveal>
              ))}
            </ul>
          </div>

          <Reveal variant="right" className="relative z-10">
            <LiquidGlassMedia
              type="image"
              src="https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1100&q=80"
              alt="Entorno seguro de aprendizaje para niños"
              fallbackClassName="w-full h-full bg-gradient-to-br from-indigo-500/25 via-blue-500/20 to-sky-400/25"
            />
          </Reveal>
        </div>
      </section>

      <section className="relative py-20 sm:py-28 bg-slate-50 dark:bg-[#0a0e1a]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Reveal>
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white leading-tight">
              {t("corp.final_cta.title")}
            </h2>
            <p className="mt-4 text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl mx-auto">
              {t("corp.final_cta.subtitle")}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to={startTo}
                className="corp-btn-primary inline-flex items-center justify-center gap-2 text-base font-semibold rounded-xl px-8 py-3.5"
              >
                {session ? t("corp.hero.cta_resume") : t("corp.final_cta.primary")}
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/faq"
                className="corp-btn-secondary inline-flex items-center justify-center gap-2 text-base font-semibold rounded-xl px-8 py-3.5"
              >
                {t("corp.faq_teaser.cta")}
              </Link>
            </div>
            <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">{t("corp.final_cta.microcopy")}</p>
          </Reveal>
        </div>
      </section>
    </LandingLayout>
  );
};

export default LandingPage;
