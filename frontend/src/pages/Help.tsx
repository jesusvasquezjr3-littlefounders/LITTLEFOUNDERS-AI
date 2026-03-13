import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ReportFAB } from "@/components/common/ReportFAB";
import {
  HelpCircle,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Gamepad2,
  Shield,
  MessageSquare,
} from "lucide-react";

// ── FAQ Data ───────────────────────────────────────────────────────────────────

const FAQ_ES = [
  {
    icon: BookOpen,
    question: "¿Cómo funciona el sistema de lecciones?",
    answer:
      "Las lecciones están organizadas por aventuras, sagas y temas. Completa cada lección para ganar puntos y desbloquear las siguientes. Tu progreso se guarda automáticamente.",
  },
  {
    icon: Gamepad2,
    question: "¿Los juegos cuentan para mi progreso?",
    answer:
      "Sí, los juegos te permiten practicar conceptos financieros de manera divertida y también acumulan puntos de experiencia en tu perfil.",
  },
  {
    icon: Shield,
    question: "¿Cómo puedo cambiar mi contraseña?",
    answer:
      "Ve a Configuración → Seguridad → Cambiar contraseña. Si entraste con Google o Discord, no tendrás esta opción ya que tu cuenta está vinculada a esos proveedores.",
  },
  {
    icon: MessageSquare,
    question: "¿Puedo usar LittleFounders en otro idioma?",
    answer:
      "¡Sí! Puedes cambiar entre Español e Inglés en cualquier momento desde Configuración → Idioma, o directamente desde el menú del perfil.",
  },
];

const FAQ_EN = [
  {
    icon: BookOpen,
    question: "How does the lesson system work?",
    answer:
      "Lessons are organized by adventures, sagas and topics. Complete each lesson to earn points and unlock the next ones. Your progress is saved automatically.",
  },
  {
    icon: Gamepad2,
    question: "Do games count toward my progress?",
    answer:
      "Yes! Games let you practice financial concepts in a fun way and also accumulate experience points on your profile.",
  },
  {
    icon: Shield,
    question: "How can I change my password?",
    answer:
      "Go to Settings → Security → Change password. If you signed in with Google or Discord, this option won't be available since your account is linked to those providers.",
  },
  {
    icon: MessageSquare,
    question: "Can I use LittleFounders in another language?",
    answer:
      "Yes! You can switch between Spanish and English at any time from Settings → Language, or directly from the profile menu.",
  },
];

// ── FAQ Item Component ─────────────────────────────────────────────────────────

function FAQItem({
  item,
  isOpen,
  onToggle,
}: {
  item: (typeof FAQ_ES)[0];
  isOpen: boolean;
  onToggle: () => void;
}) {
  const Icon = item.icon;
  return (
    <div
      className={`
        rounded-2xl border transition-all duration-200 overflow-hidden
        ${isOpen
          ? "border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30"
          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600"
        }
      `}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 text-left"
      >
        <div className={`flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center
          ${isOpen ? "bg-blue-500 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"}
          transition-colors duration-200
        `}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="flex-1 font-semibold text-sm text-slate-800 dark:text-white">
          {item.question}
        </span>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-blue-500 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
        )}
      </button>
      {isOpen && (
        <div className="px-5 pb-4 animate-in slide-in-from-top-2 duration-200">
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed pl-12">
            {item.answer}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Help Page ──────────────────────────────────────────────────────────────────

const Help = () => {
  const { t, i18n } = useTranslation(["reports", "common"]);
  const lang = i18n.language?.startsWith("en") ? "en" : "es";
  const faqItems = lang === "en" ? FAQ_EN : FAQ_ES;

  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-10 animate-in fade-in duration-300">

        {/* ── Header ── */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-xl mb-2">
            <HelpCircle className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {lang === "en" ? "Help Center" : "Centro de Ayuda"}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-base">
            {lang === "en"
              ? "Find answers to common questions or send us a report."
              : "Encuentra respuestas a preguntas frecuentes o envíanos un reporte."}
          </p>
        </div>

        {/* ── FAQ Section ── */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <span className="w-1.5 h-5 rounded-full bg-gradient-to-b from-blue-500 to-purple-500" />
            {lang === "en" ? "Frequently Asked Questions" : "Preguntas Frecuentes"}
          </h2>
          <div className="space-y-3">
            {faqItems.map((item, i) => (
              <FAQItem
                key={i}
                item={item}
                isOpen={openIndex === i}
                onToggle={() => setOpenIndex(openIndex === i ? null : i)}
              />
            ))}
          </div>
        </section>

        {/* ── Report Section ── */}
        <section className="rounded-2xl bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30 border border-red-100 dark:border-red-900/50 p-6 space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 space-y-1">
              <h2 className="font-bold text-lg text-slate-800 dark:text-white">
                {t("reports:help_page.section_title")}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t("reports:help_page.section_description")}
              </p>
            </div>
          </div>
          <ReportFAB inline />
        </section>

      </div>
    </DashboardLayout>
  );
};

export default Help;
