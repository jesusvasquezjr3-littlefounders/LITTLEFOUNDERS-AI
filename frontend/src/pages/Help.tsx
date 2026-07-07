import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ReportFAB } from "@/components/common/ReportFAB";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  BookOpen,
  Gamepad2,
  Shield,
  MessageSquare,
} from "lucide-react";

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
        "bg-white dark:bg-[#0d1426] rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden transition-[box-shadow,border-color] duration-200 ease-out",
        isOpen && "ring-1 ring-indigo-500/20 border-indigo-200/50 dark:border-indigo-500/20 shadow-sm"
      )}
    >
      <button onClick={onToggle} className="w-full flex items-center gap-4 px-5 py-4 text-left group">
        <div
          className={cn(
            "flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-[background-color,color,box-shadow] duration-200",
            isOpen
              ? "bg-indigo-600 text-white"
              : "bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-500/10 group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
          )}
        >
          <Icon className="w-5 h-5" />
        </div>
        <span className="flex-1 corp-body font-semibold">
          {question}
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 flex-shrink-0 transition-[transform,color] duration-200 ease-out",
            isOpen ? "rotate-180 text-indigo-500" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"
          )}
        />
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="px-5 pb-5">
            <p className="corp-body-sm pl-14">
              {answer}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const Help = () => {
  const { t } = useTranslation(["reports"]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const CATEGORIES = [
    { icon: BookOpen, labelKey: "help_page.categories.lessons" },
    { icon: Gamepad2, labelKey: "help_page.categories.games" },
    { icon: Shield, labelKey: "help_page.categories.privacy" },
    { icon: MessageSquare, labelKey: "help_page.categories.contact" },
  ];

  const FAQ_KEYS = [
    { icon: BookOpen, q: "help_page.faq.q1.question", a: "help_page.faq.q1.answer" },
    { icon: Gamepad2, q: "help_page.faq.q2.question", a: "help_page.faq.q2.answer" },
    { icon: Shield, q: "help_page.faq.q3.question", a: "help_page.faq.q3.answer" },
    { icon: MessageSquare, q: "help_page.faq.q4.question", a: "help_page.faq.q4.answer" },
  ];

  return (
    <div className="corp max-w-6xl mx-auto pb-16 px-4 pt-8 animate-in fade-in duration-300">

      {/* ── Page header ────────────────────────────────────────────── */}
      <div className="mb-8">
        <h1 className="corp-h1">
          {t("reports:help_page.title")}
        </h1>
        <p className="mt-2 corp-body">
          {t("reports:help_page.subtitle")}
        </p>
      </div>

      {/* ── Layout ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* ── Left: Content (8/12) ─────────────────────────────────── */}
        <div className="lg:col-span-8 space-y-8">

          {/* Categories */}
          <div className="corp-panel rounded-[2.5rem] p-6 md:p-8">
            <span className="corp-eyebrow">{t("reports:help_page.popular_questions")}</span>
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {CATEGORIES.map((cat, idx) => (
                <div key={idx} className="corp-card rounded-2xl p-5 flex flex-col items-center text-center gap-3">
                  <div className="corp-icon-chip w-12 h-12">
                    <cat.icon className="w-6 h-6" />
                  </div>
                  <span className="corp-label">
                    {t(cat.labelKey as any)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* FAQ */}
          <div className="corp-panel rounded-[2.5rem] p-6 md:p-8">
            <span className="corp-eyebrow">{t("reports:help_page.popular_questions")}</span>
            <div className="mt-6 space-y-3">
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
          </div>
        </div>

        {/* ── Right: Support Panel (4/12) ──────────────────────────── */}
        <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-8">

          <div className="corp-panel rounded-[2.5rem] p-8 flex flex-col items-center text-center gap-5">
            <div className="corp-icon-chip w-14 h-14">
              <MessageSquare className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h2 className="corp-h4">
                {t("reports:help_page.section_title")}
              </h2>
              <p className="corp-body-sm">
                {t("reports:help_page.section_description")}
              </p>
            </div>
            <div className="w-full pt-2">
              <ReportFAB inline />
            </div>
          </div>

          <div className="corp-panel rounded-full px-5 py-3 flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="corp-eyebrow">{t("reports:help_page.team_available")}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Help;
