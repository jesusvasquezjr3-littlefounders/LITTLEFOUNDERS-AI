import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ReportFAB } from "@/components/common/ReportFAB";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { cn } from "@/lib/utils";
import {
  HelpCircle,
  ChevronDown,
  BookOpen,
  Gamepad2,
  Shield,
  MessageSquare,
  Sparkles,
} from "lucide-react";

// ── FAQ Item Component ─────────────────────────────────────────────────────────

function FAQItem({
  icon: Icon,
  question,
  answer,
  isOpen,
  onToggle,
}: {
  icon: React.ElementType;
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border transition-all duration-300 overflow-hidden",
        isOpen
          ? "liquid-glass-strong border-indigo-400/30 dark:border-indigo-500/30 shadow-lg shadow-indigo-500/5"
          : "liquid-glass-subtle border-transparent hover:border-white/20 dark:hover:border-white/10 hover:scale-[1.005]"
      )}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-5 text-left group"
      >
        <div
          className={cn(
            "flex-shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300",
            isOpen
              ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/30"
              : "bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/20 group-hover:text-indigo-500"
          )}
        >
          <Icon className="w-5 h-5" />
        </div>
        <span className="flex-1 font-bold text-sm text-slate-800 dark:text-white leading-snug">
          {question}
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 flex-shrink-0 transition-all duration-300",
            isOpen
              ? "rotate-180 text-indigo-500"
              : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"
          )}
        />
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-300",
          isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="px-5 pb-5">
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pl-14">
            {answer}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Category Card ──────────────────────────────────────────────────────────────

function CategoryCard({
  icon: Icon,
  label,
  gradient,
}: {
  icon: React.ElementType;
  label: string;
  gradient: string;
}) {
  return (
    <GlassPanel
      variant="subtle"
      className="p-5 rounded-3xl flex flex-col items-center gap-3 hover:scale-[1.04] transition-all duration-300 cursor-pointer group border border-white/10 dark:border-white/5 hover:shadow-xl"
    >
      <div
        className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:rotate-3",
          gradient
        )}
      >
        <Icon className="w-6 h-6" />
      </div>
      <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest group-hover:text-slate-800 dark:group-hover:text-white transition-colors text-center">
        {label}
      </span>
    </GlassPanel>
  );
}

// ── Help Page ──────────────────────────────────────────────────────────────────

const Help = () => {
  const { t } = useTranslation(["reports"]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const CATEGORIES = [
    { icon: BookOpen, labelKey: "help_page.categories.lessons", gradient: "bg-gradient-to-br from-blue-500 to-cyan-500" },
    { icon: Gamepad2, labelKey: "help_page.categories.games", gradient: "bg-gradient-to-br from-purple-500 to-pink-500" },
    { icon: Shield, labelKey: "help_page.categories.privacy", gradient: "bg-gradient-to-br from-emerald-500 to-teal-500" },
    { icon: MessageSquare, labelKey: "help_page.categories.contact", gradient: "bg-gradient-to-br from-orange-500 to-amber-500" },
  ];

  const FAQ_KEYS = [
    { icon: BookOpen, q: "help_page.faq.q1.question", a: "help_page.faq.q1.answer" },
    { icon: Gamepad2, q: "help_page.faq.q2.question", a: "help_page.faq.q2.answer" },
    { icon: Shield, q: "help_page.faq.q3.question", a: "help_page.faq.q3.answer" },
    { icon: MessageSquare, q: "help_page.faq.q4.question", a: "help_page.faq.q4.answer" },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-4 py-8 animate-in fade-in duration-300 space-y-8">

        {/* ── Page Header ── */}
        <div className="relative rounded-3xl overflow-hidden liquid-glass-strong px-7 py-6 flex items-center gap-5">
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-gradient-to-br from-indigo-500/15 to-purple-600/15 rounded-full blur-3xl pointer-events-none" />
          <div className="relative w-14 h-14 rounded-[1.25rem] bg-gradient-to-br from-indigo-500 via-purple-500 to-blue-600 flex items-center justify-center shadow-xl shadow-indigo-500/25 flex-shrink-0">
            <HelpCircle className="w-7 h-7 text-white" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest">{t('common:app_name')}</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase md:normal-case">
              {t("reports:help_page.title")}
            </h1>
            <p className="text-[10px] md:text-sm text-slate-500 dark:text-slate-400 font-bold md:font-medium leading-tight">
              {t("reports:help_page.subtitle")}
            </p>
          </div>
        </div>

        {/* ── Main Content Grid ── */}
        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-8 items-start">

          {/* ── Left Column: Categories + FAQ (8/12) ── */}
          <div className="lg:col-span-8 space-y-10 w-full">

            {/* ── Quick Categories Grid ── */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <div className="w-1 h-5 rounded-full bg-gradient-to-b from-indigo-500 to-purple-600" />
                <h2 className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em]">
                  {t("reports:help_page.popular_questions")}
                </h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {CATEGORIES.map((cat, idx) => (
                  <CategoryCard
                    key={idx}
                    icon={cat.icon}
                    label={t(cat.labelKey as any)}
                    gradient={cat.gradient}
                  />
                ))}
              </div>
            </section>

            {/* ── FAQ Section ── */}
            <section className="space-y-6">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight whitespace-nowrap">
                  {t("reports:help_page.popular_questions")}
                </h2>
                <div className="h-px flex-1 bg-gradient-to-r from-indigo-200 dark:from-indigo-900/50 via-purple-100 dark:via-purple-900/30 to-transparent" />
              </div>

              <div className="space-y-3">
                {FAQ_KEYS.map((item, i) => (
                  <FAQItem
                    key={i}
                    icon={item.icon}
                    question={t(item.q as any)}
                    answer={t(item.a as any)}
                    isOpen={openIndex === i}
                    onToggle={() => setOpenIndex(openIndex === i ? null : i)}
                  />
                ))}
              </div>
            </section>
          </div>

          {/* ── Right Column: Support Panel (4/12) ── */}
          <div className="lg:col-span-4 w-full lg:sticky lg:top-8 space-y-4">

            {/* Support Card */}
            <GlassPanel
              variant="strong"
              className="relative overflow-hidden p-7 rounded-[2rem] space-y-6 shadow-2xl border border-orange-500/10 dark:border-orange-500/10"
            >
              {/* Background accent */}
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br from-red-500/15 to-orange-500/15 rounded-full blur-2xl pointer-events-none" />

              <div className="relative flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 rounded-[1.25rem] bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-xl shadow-red-500/25 transform hover:rotate-3 hover:scale-105 transition-all duration-300">
                  <MessageSquare className="w-8 h-8 text-white" />
                </div>
                <div className="space-y-2">
                  <h2 className="font-black text-lg text-slate-800 dark:text-white uppercase tracking-tight leading-tight">
                    {t("reports:help_page.section_title")}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                    {t("reports:help_page.section_description")}
                  </p>
                </div>
              </div>

              <div className="relative pt-2">
                <ReportFAB inline />
              </div>
            </GlassPanel>

            {/* 24/7 availability badge */}
            <div className="px-5 py-4 rounded-2xl liquid-glass-subtle border border-indigo-500/10 dark:border-indigo-500/10 flex items-center justify-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-sm shadow-green-400" />
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center leading-relaxed">
                {t("reports:help_page.team_available")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Help;
