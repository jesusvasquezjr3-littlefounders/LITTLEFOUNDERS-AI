import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { ReportFAB } from "@/components/common/ReportFAB";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { cn } from "@/lib/utils";
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
          ? "liquid-glass-strong border-blue-400/50 dark:border-blue-500/50 scale-[1.01]"
          : "liquid-glass-subtle hover:scale-[1.005]"
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
      <div className="max-w-6xl mx-auto px-4 py-8 animate-in fade-in duration-300">
        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-8 items-start">
          
          {/* ── Left Column: Header & FAQ (8/12) ── */}
          <div className="lg:col-span-8 space-y-12 w-full">
            {/* ── Header ── */}
            <div className="text-center lg:text-left space-y-4">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-[2rem] bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 shadow-2xl mb-2 transform hover:scale-110 transition-transform duration-500">
                <HelpCircle className="w-10 h-10 text-white" />
              </div>
              <div className="space-y-2">
                <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent tracking-tight">
                  {lang === "en" ? "How can we help?" : "¿En qué podemos ayudarte?"}
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-xl font-medium max-w-xl mx-auto lg:mx-0">
                  {lang === "en"
                    ? "Explore categories or check our FAQ below."
                    : "Explora las categorías o revisa nuestras preguntas frecuentes."}
                </p>
              </div>
            </div>

            {/* ── Quick Categories Grid ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: BookOpen, label: lang === 'en' ? 'Lessons' : 'Lecciones', color: 'blue' },
                { icon: Gamepad2, label: lang === 'en' ? 'Games' : 'Juegos', color: 'purple' },
                { icon: Shield, label: lang === 'en' ? 'Privacy' : 'Privacidad', color: 'green' },
                { icon: MessageSquare, label: lang === 'en' ? 'Contact' : 'Contacto', color: 'orange' }
              ].map((cat, idx) => (
                <GlassPanel key={idx} variant="default" className="liquid-glass-subtle p-6 rounded-3xl flex flex-col items-center gap-3 hover:scale-105 transition-all duration-300 cursor-pointer border-none shadow-lg group">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center transition-colors group-hover:bg-opacity-20",
                    cat.color === 'blue' && "bg-blue-500/10 text-blue-500",
                    cat.color === 'purple' && "bg-purple-500/10 text-purple-500",
                    cat.color === 'green' && "bg-green-500/10 text-green-500",
                    cat.color === 'orange' && "bg-orange-500/10 text-orange-500"
                  )}>
                    <cat.icon className="w-6 h-6" />
                  </div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-slate-900 dark:group-hover:text-white">{cat.label}</span>
                </GlassPanel>
              ))}
            </div>

            {/* ── FAQ Section ── */}
            <section className="space-y-8">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">
                  {lang === "en" ? "Popular Questions" : "Preguntas Populares"}
                </h2>
                <div className="h-px flex-1 bg-gradient-to-r from-slate-200 dark:from-slate-700 to-transparent" />
              </div>
              <div className="space-y-4">
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
          </div>

          {/* ── Right Column: Support & Contact (4/12) ── */}
          <div className="lg:col-span-4 w-full lg:sticky lg:top-8 space-y-6">
            <GlassPanel variant="default" className="liquid-glass-strong bg-gradient-to-br from-red-500/10 to-orange-500/10 border-red-500/20 p-8 rounded-[2.5rem] space-y-6 shadow-2xl">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="flex-shrink-0 w-16 h-16 rounded-3xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg transform -rotate-3 hover:rotate-0 transition-transform duration-300">
                  <MessageSquare className="w-8 h-8 text-white" />
                </div>
                <div className="space-y-2">
                  <h2 className="font-black text-xl text-slate-800 dark:text-white uppercase tracking-tight">
                    {t("reports:help_page.section_title")}
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                    {t("reports:help_page.section_description")}
                  </p>
                </div>
              </div>
              <div className="pt-2">
                <ReportFAB inline />
              </div>
            </GlassPanel>

            <div className="px-6 py-4 rounded-3xl bg-blue-500/5 border border-blue-500/10 text-center">
              <p className="text-xs font-bold text-blue-600/60 uppercase tracking-widest leading-relaxed">
                {lang === "en" ? "Our team is here to help you 24/7" : "Nuestro equipo está aquí para ayudarte 24/7"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Help;
