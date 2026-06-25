import React from "react";
import { LandingLayout } from "@/components/landing/LandingLayout";
import { Reveal } from "@/components/landing/Reveal";
import { FileText, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";

interface LegalPageLayoutProps {
  titleKey: string;
  subtitleKey: string;
  eyebrowKey: string;
  effectiveDateKey: string;
  comingSoonKey: string;
  comingSoonDescKey: string;
  contactNoteKey: string;
  children?: React.ReactNode;
}

export const LegalPageLayout: React.FC<LegalPageLayoutProps> = ({
  titleKey,
  subtitleKey,
  eyebrowKey,
  effectiveDateKey,
  comingSoonKey,
  comingSoonDescKey,
  contactNoteKey,
  children,
}) => {
  const { t } = useTranslation("legal");

  return (
    <LandingLayout hideCTA>
      {/* ── Hero header ───────────────────────────────────────── */}
      <header className="relative overflow-hidden bg-gradient-to-b from-slate-50/80 via-white to-white dark:from-[#0b1124] dark:via-[#070b14] dark:to-[#070b14]">
        <div className="absolute inset-0 corp-grid-bg pointer-events-none" />
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full bg-indigo-400/8 dark:bg-indigo-500/6 blur-[140px] pointer-events-none" />
        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-36 lg:pt-44 pb-16 text-center">
          <Reveal as="span" className="corp-eyebrow">{t(eyebrowKey)}</Reveal>
          <Reveal delay={60}>
            <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 dark:text-white leading-tight">
              {t(titleKey)}
            </h1>
          </Reveal>
          <Reveal delay={100}>
            <p className="mt-5 text-base sm:text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl mx-auto">
              {t(subtitleKey)}
            </p>
          </Reveal>
          <Reveal delay={140}>
            <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
              {t(effectiveDateKey)}
            </p>
          </Reveal>
        </div>
      </header>

      {/* ── Main content area ─────────────────────────────────── */}
      <section className="relative py-16 sm:py-24 bg-white dark:bg-[#070b14]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {children ? (
            <div className="prose prose-slate dark:prose-invert prose-headings:font-bold prose-headings:text-slate-900 dark:prose-headings:text-white prose-p:text-slate-600 dark:prose-p:text-slate-400 prose-a:text-indigo-600 dark:prose-a:text-indigo-400 max-w-none">
              {children}
            </div>
          ) : (
            /* Placeholder until content is provided */
            <Reveal>
              <div className="corp-card rounded-3xl p-10 sm:p-14 text-center flex flex-col items-center gap-6">
                <div className="corp-icon-chip w-16 h-16">
                  <FileText className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    {t(comingSoonKey)}
                  </h2>
                  <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
                    {t(comingSoonDescKey)}
                  </p>
                </div>
                <a
                  href="mailto:informame@littlefounders.ai"
                  className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  {t(contactNoteKey)} informame@littlefounders.ai
                </a>
              </div>
            </Reveal>
          )}
        </div>
      </section>
    </LandingLayout>
  );
};
