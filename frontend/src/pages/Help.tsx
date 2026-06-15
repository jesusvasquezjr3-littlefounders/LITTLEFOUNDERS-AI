import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ReportFAB } from "@/components/common/ReportFAB";
import { cn } from "@/lib/utils";
import {
  HelpCircle,
  ChevronDown,
  BookOpen,
  Gamepad2,
  Shield,
  MessageSquare,
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
        "corp-card overflow-hidden transition-all duration-300",
        isOpen && "ring-1 ring-indigo-500/20"
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
              ? "bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-md shadow-indigo-500/30"
              : "bg-slate-100 dark:bg-[#0d1426] text-slate-500 dark:text-slate-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/20 group-hover:text-indigo-500"
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
    <div className="corp-card p-5 flex flex-col items-center gap-3 cursor-pointer group">
      <div
        className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:rotate-3",
          gradient
        )}
      >
        <Icon className="w-6 h-6" />
      </div>
      <span className="corp-eyebrow text-center">
        {label}
      </span>
    </div>
  );
}

// ── Help Page ──────────────────────────────────────────────────────────────────

const Help = () => {
  const { t } = useTranslation(["reports"]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const CATEGORIES = [
    { icon: BookOpen, labelKey: "help_page.categories.lessons", gradient: "bg-gradient-to-br from-blue-500 to-cyan-500" },
    { icon: Gamepad2, labelKey: "help_page.categories.games", gradient: "bg-gradient-to-br from-indigo-500 to-blue-500" },
    { icon: Shield, labelKey: "help_page.categories.privacy", gradient: "bg-gradient-to-br from-emerald-500 to-teal-500" },
    { icon: MessageSquare, labelKey: "help_page.categories.contact", gradient: "bg-gradient-to-br from-sky-500 to-blue-500" },
  ];

  const FAQ_KEYS = [
    { icon: BookOpen, q: "help_page.faq.q1.question", a: "help_page.faq.q1.answer" },
    { icon: Gamepad2, q: "help_page.faq.q2.question", a: "help_page.faq.q2.answer" },
    { icon: Shield, q: "help_page.faq.q3.question", a: "help_page.faq.q3.answer" },
    { icon: MessageSquare, q: "help_page.faq.q4.question", a: "help_page.faq.q4.answer" },
  ];

  return (
    <DashboardLayout>
      <div className="corp max-w-6xl mx-auto px-4 py-8 animate-in fade-in duration-300 space-y-8">

        {/* ── Page Header ── */}
        <div className="corp-panel px-7 py-6 flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-xl shadow-indigo-500/25 flex-shrink-0">
            <HelpCircle className="w-7 h-7 text-white" />
          </div>
          <div className="text-left">
            <span className="corp-eyebrow">{t('common:app_name')}</span>
            <h1 className="corp-display mt-1 text-2xl font-bold text-slate-900 dark:text-white">
              {t("reports:help_page.title")}
            </h1>
            <p className="mt-1 text-[10px] md:text-sm text-slate-500 dark:text-slate-400 leading-tight">
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
              <div className="px-1">
                <span className="corp-eyebrow">
                  {t("reports:help_page.popular_questions")}
                </span>
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
                <h2 className="corp-display text-xl font-bold text-slate-900 dark:text-white whitespace-nowrap">
                  {t("reports:help_page.popular_questions")}
                </h2>
                <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
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
            <div className="corp-card p-7 space-y-6">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-xl shadow-indigo-500/25">
                  <MessageSquare className="w-8 h-8 text-white" />
                </div>
                <div className="space-y-2">
                  <h2 className="corp-display text-lg font-bold text-slate-900 dark:text-white leading-tight">
                    {t("reports:help_page.section_title")}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    {t("reports:help_page.section_description")}
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <ReportFAB inline />
              </div>
            </div>

            {/* 24/7 availability badge */}
            <div className="corp-panel-subtle px-5 py-4 flex items-center justify-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-400" />
              <span className="corp-eyebrow text-center">
                {t("reports:help_page.team_available")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Help;
