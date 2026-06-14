import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, Link } from "react-router-dom";
import { hasSession } from "@/lib/guestProfile";
import { Reveal } from "@/components/landing/Reveal";
import { StockImage } from "@/components/landing/StockImage";
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
  CheckCircle2,
  Star,
  PlayCircle,
} from "lucide-react";

/* ── Reusable section heading ─────────────────────────────────────────────── */
function SectionHeading({
  eyebrow,
  title,
  subtitle,
  center = true,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: string;
  center?: boolean;
}) {
  return (
    <div className={`max-w-2xl ${center ? "mx-auto text-center" : ""}`}>
      <Reveal as="span" className="corp-eyebrow">{eyebrow}</Reveal>
      <Reveal delay={80}>
        <h2 className="mt-3 text-3xl md:text-4xl font-bold text-slate-900 dark:text-white leading-tight">
          {title}
        </h2>
      </Reveal>
      {subtitle && (
        <Reveal delay={140}>
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
  const navigate = useNavigate();

  useEffect(() => {
    if (hasSession()) navigate("/learn");
  }, [navigate]);

  const trustItems = [
    { icon: Lock, label: t("corp.trust.item_1") },
    { icon: ShieldCheck, label: t("corp.trust.item_2") },
    { icon: Sparkles, label: t("corp.trust.item_3") },
    { icon: Globe, label: t("corp.trust.item_4") },
  ];

  const stats = [
    { value: t("corp.stats.lessons_value"), label: t("corp.stats.lessons_label") },
    { value: t("corp.stats.games_value"), label: t("corp.stats.games_label") },
    { value: t("corp.stats.minutes_value"), label: t("corp.stats.minutes_label") },
    { value: t("corp.stats.safe_value"), label: t("corp.stats.safe_label") },
  ];

  const pillars = [
    { icon: GraduationCap, color: "from-indigo-500 to-blue-500", title: t("corp.pillars.p1_title"), desc: t("corp.pillars.p1_desc") },
    { icon: ShieldCheck, color: "from-emerald-500 to-teal-500", title: t("corp.pillars.p2_title"), desc: t("corp.pillars.p2_desc") },
    { icon: LayoutDashboard, color: "from-violet-500 to-fuchsia-500", title: t("corp.pillars.p3_title"), desc: t("corp.pillars.p3_desc") },
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
      {/* ══════════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════════ */}
      <header className="relative overflow-hidden bg-gradient-to-b from-indigo-50/80 via-white to-white dark:from-[#0b1124] dark:via-[#070b14] dark:to-[#070b14]">
        {/* Ambient glow + grid */}
        <div className="absolute inset-0 corp-grid-bg pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-[36rem] h-[36rem] rounded-full bg-indigo-400/15 dark:bg-indigo-600/15 blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 -left-32 w-[32rem] h-[32rem] rounded-full bg-sky-400/10 dark:bg-blue-700/10 blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 lg:pt-40 pb-20">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Copy */}
            <div>
              <Reveal as="span" className="inline-flex items-center gap-2 rounded-full border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                <Sparkles className="w-3.5 h-3.5" /> {t("corp.hero.badge")}
              </Reveal>

              <Reveal delay={80}>
                <h1 className="mt-6 text-4xl sm:text-5xl lg:text-[3.5rem] font-bold leading-[1.08] text-slate-900 dark:text-white">
                  {t("corp.hero.title_1")}{" "}
                  <span className="corp-gradient-text">{t("corp.hero.title_grad")}</span>{" "}
                  {t("corp.hero.title_2")}
                </h1>
              </Reveal>

              <Reveal delay={160}>
                <p className="mt-6 text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                  {t("corp.hero.subtitle")}
                </p>
              </Reveal>

              <Reveal delay={240}>
                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <Link
                    to="/onboarding"
                    className="corp-btn-primary inline-flex items-center justify-center gap-2 text-base font-semibold rounded-xl px-7 py-3.5"
                  >
                    {t("corp.hero.cta_primary")}
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                  <Link
                    to="/how-it-works"
                    className="inline-flex items-center justify-center gap-2 text-base font-semibold rounded-xl px-7 py-3.5 border border-slate-300 dark:border-white/15 text-slate-700 dark:text-slate-200 hover:border-indigo-400 dark:hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
                  >
                    <PlayCircle className="w-5 h-5" />
                    {t("corp.hero.cta_secondary")}
                  </Link>
                </div>
              </Reveal>

              <Reveal delay={320}>
                <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">{t("corp.hero.microcopy")}</p>
              </Reveal>
            </div>

            {/* Media */}
            <Reveal variant="scale" delay={120} className="relative">
              <div className="relative rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white/60 dark:bg-white/5 p-2 shadow-[0_40px_100px_-30px_rgba(37,99,235,0.45)] backdrop-blur">
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-slate-900">
                  <video
                    src="/video/8747232-sd_960_540_25fps.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover corp-kenburns"
                  />
                  <div className="absolute inset-0 bg-gradient-to-tr from-indigo-900/40 via-transparent to-transparent pointer-events-none" />
                </div>
              </div>

              {/* Floating chips */}
              <div className="absolute -bottom-5 -left-3 sm:-left-6 rounded-2xl bg-white dark:bg-[#0d1426] border border-slate-200 dark:border-white/10 shadow-xl px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                  <Trophy className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white leading-none">+50</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{t("solution.animation.coins_label")}</p>
                </div>
              </div>
              <div className="absolute -top-4 -right-3 sm:-right-5 rounded-2xl bg-white dark:bg-[#0d1426] border border-slate-200 dark:border-white/10 shadow-xl px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white leading-none">100%</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{t("corp.stats.safe_label")}</p>
                </div>
              </div>
            </Reveal>
          </div>

          {/* Trust strip */}
          <Reveal delay={120} className="mt-20">
            <p className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500 mb-6">
              {t("corp.trust.caption")}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
              {trustItems.map((item, i) => (
                <div key={i} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                  <item.icon className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                  {item.label}
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════
          STATS BAND
      ══════════════════════════════════════════════════════════ */}
      <section className="relative bg-slate-900 dark:bg-[#0a0e1a] py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((s, i) => (
              <Reveal key={i} delay={i * 80} className="text-center">
                <p className="text-3xl md:text-4xl font-bold corp-gradient-text">{s.value}</p>
                <p className="mt-2 text-sm text-slate-300 dark:text-slate-400">{s.label}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          PILLARS — why it works
      ══════════════════════════════════════════════════════════ */}
      <section className="relative py-24 bg-white dark:bg-[#070b14]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow={t("corp.pillars.eyebrow")}
            title={t("corp.pillars.title")}
            subtitle={t("corp.pillars.subtitle")}
          />
          <div className="mt-14 grid md:grid-cols-3 gap-6">
            {pillars.map((p, i) => (
              <Reveal key={i} delay={i * 100}>
                <div className="corp-card h-full p-8">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${p.color} flex items-center justify-center shadow-lg`}>
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

      {/* ══════════════════════════════════════════════════════════
          SHOWCASE — platform (media + bullet list)
      ══════════════════════════════════════════════════════════ */}
      <section className="relative py-24 bg-slate-50 dark:bg-[#0a0e1a] overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            <Reveal variant="left">
              <div className="relative rounded-3xl border border-slate-200 dark:border-white/10 p-2 shadow-2xl bg-white dark:bg-white/5">
                <StockImage
                  src="https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1100&q=80"
                  alt="Familia aprendiendo finanzas con LittleFounders"
                  className="w-full h-full object-cover"
                  fallbackClassName="aspect-[4/3] rounded-2xl bg-gradient-to-br from-indigo-500/30 via-blue-500/20 to-sky-400/30"
                />
              </div>
            </Reveal>

            <div>
              <SectionHeading
                eyebrow={t("corp.showcase.eyebrow")}
                title={t("corp.showcase.title")}
                subtitle={t("corp.showcase.subtitle")}
                center={false}
              />
              <div className="mt-8 space-y-5">
                {showcaseItems.map((item, i) => (
                  <Reveal key={i} variant="right" delay={i * 90}>
                    <div className="flex gap-4">
                      <div className="w-11 h-11 shrink-0 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center">
                        <item.icon className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
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

      {/* ══════════════════════════════════════════════════════════
          FEATURES GRID
      ══════════════════════════════════════════════════════════ */}
      <section className="relative py-24 bg-white dark:bg-[#070b14]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow={t("corp.features.eyebrow")}
            title={t("corp.features.title")}
            subtitle={t("corp.features.subtitle")}
          />
          <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <Reveal key={i} delay={(i % 3) * 90}>
                <div className="corp-card h-full p-7">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500/10 to-blue-500/10 dark:from-indigo-500/20 dark:to-blue-500/20 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center">
                    <f.icon className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-slate-900 dark:text-white">{f.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          AUDIENCE SPLIT — kids / parents
      ══════════════════════════════════════════════════════════ */}
      <section className="relative py-24 bg-slate-50 dark:bg-[#0a0e1a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 gap-6">
          {/* Kids */}
          <Reveal variant="left">
            <div className="corp-card h-full p-8 lg:p-10">
              <span className="corp-eyebrow">{t("corp.audience.kids_label")}</span>
              <h3 className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">{t("corp.audience.kids_title")}</h3>
              <p className="mt-3 text-slate-600 dark:text-slate-400 leading-relaxed">{t("corp.audience.kids_desc")}</p>
              <ul className="mt-6 space-y-3">
                {[t("corp.audience.kids_1"), t("corp.audience.kids_2"), t("corp.audience.kids_3")].map((it, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                    <CheckCircle2 className="w-5 h-5 text-indigo-500 shrink-0" /> {it}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          {/* Parents */}
          <Reveal variant="right" delay={100}>
            <div className="corp-card h-full p-8 lg:p-10">
              <span className="corp-eyebrow">{t("corp.audience.parents_label")}</span>
              <h3 className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">{t("corp.audience.parents_title")}</h3>
              <p className="mt-3 text-slate-600 dark:text-slate-400 leading-relaxed">{t("corp.audience.parents_desc")}</p>
              <ul className="mt-6 space-y-3">
                {[t("corp.audience.parents_1"), t("corp.audience.parents_2"), t("corp.audience.parents_3")].map((it, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" /> {it}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          TESTIMONIALS
      ══════════════════════════════════════════════════════════ */}
      <section className="relative py-24 bg-white dark:bg-[#070b14]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading eyebrow={t("corp.testimonials.eyebrow")} title={t("corp.testimonials.title")} />
          <div className="mt-14 grid md:grid-cols-3 gap-6">
            {testimonials.map((tst, i) => (
              <Reveal key={i} delay={i * 100}>
                <figure className="corp-card h-full p-7 flex flex-col">
                  <div className="flex gap-1 text-amber-400">
                    {Array.from({ length: 5 }).map((_, s) => (
                      <Star key={s} className="w-4 h-4 fill-current" />
                    ))}
                  </div>
                  <blockquote className="mt-4 text-slate-700 dark:text-slate-300 leading-relaxed flex-1">
                    “{tst.quote}”
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

      {/* ══════════════════════════════════════════════════════════
          SECURITY
      ══════════════════════════════════════════════════════════ */}
      <section className="relative py-24 bg-slate-50 dark:bg-[#0a0e1a] overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <SectionHeading
              eyebrow={t("corp.security.eyebrow")}
              title={t("corp.security.title")}
              subtitle={t("corp.security.subtitle")}
              center={false}
            />
            <ul className="mt-8 space-y-4">
              {securityPoints.map((p, i) => (
                <Reveal key={i} variant="left" delay={i * 80}>
                  <li className="flex items-start gap-3">
                    <span className="mt-0.5 w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-100 dark:border-emerald-500/20 flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </span>
                    <span className="text-slate-700 dark:text-slate-300 leading-relaxed">{p}</span>
                  </li>
                </Reveal>
              ))}
            </ul>
          </div>

          <Reveal variant="right">
            <div className="relative rounded-3xl border border-slate-200 dark:border-white/10 p-2 shadow-2xl bg-white dark:bg-white/5">
              <StockImage
                src="https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1100&q=80"
                alt="Entorno seguro de aprendizaje para niños"
                className="w-full h-full object-cover"
                fallbackClassName="aspect-[4/3] rounded-2xl bg-gradient-to-br from-emerald-500/25 via-teal-500/20 to-indigo-500/25"
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          FAQ TEASER + FINAL CTA
      ══════════════════════════════════════════════════════════ */}
      <section className="relative py-24 bg-white dark:bg-[#070b14]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl bg-slate-900 dark:bg-gradient-to-br dark:from-indigo-900 dark:to-blue-950 px-6 sm:px-12 py-16 text-center">
              <div className="absolute inset-0 corp-grid-bg opacity-30 pointer-events-none" />
              <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[30rem] h-[30rem] rounded-full bg-indigo-500/20 blur-[100px] pointer-events-none" />
              <div className="relative z-10">
                <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight max-w-2xl mx-auto">
                  {t("corp.final_cta.title")}
                </h2>
                <p className="mt-4 text-white/70 max-w-xl mx-auto leading-relaxed">
                  {t("corp.final_cta.subtitle")}
                </p>
                <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
                  <Link
                    to="/onboarding"
                    className="inline-flex items-center justify-center gap-2 text-base font-semibold rounded-xl px-8 py-3.5 bg-white text-indigo-700 hover:bg-indigo-50 transition-colors shadow-lg"
                  >
                    {t("corp.final_cta.primary")}
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                  <Link
                    to="/faq"
                    className="inline-flex items-center justify-center gap-2 text-base font-semibold rounded-xl px-8 py-3.5 border border-white/25 text-white hover:bg-white/10 transition-colors"
                  >
                    {t("corp.faq_teaser.cta")}
                  </Link>
                </div>
                <p className="mt-5 text-sm text-white/50">{t("corp.final_cta.microcopy")}</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </LandingLayout>
  );
};

export default LandingPage;
